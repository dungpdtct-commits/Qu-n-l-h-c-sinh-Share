import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, getDocs, writeBatch, doc, onSnapshot, disableNetwork, enableNetwork } from 'firebase/firestore';
import { db as firestoreDb } from '../lib/firebase';
import { db, setRemoteSyncing } from '../db/dexie';
import { useAuth } from '../lib/AuthContext';
import { isQuotaExceeded, markQuotaExceeded, isQuotaError, isCloudSyncEnabled, trackFirestoreUsage } from '../lib/firestoreUtils';
import { logSyncActivity } from '../lib/syncActivityLogger';

const LAST_SYNC_KEY = 'last_successful_sync_time';

// Helper function to prevent any async promise from hanging indefinitely
function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMessage));
    }, ms);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function getItemTimestamp(item: any): number {
  const ts = item.updated_at || item.created_at || item.last_updated || item.timestamp;
  if (!ts) return Infinity;
  if (typeof ts === 'number') return ts;
  const parsed = new Date(ts).getTime();
  return isNaN(parsed) ? Infinity : parsed;
}

export const purgeStudentCascade = async (studentId: string | number) => {
  const sidStr = String(studentId);
  const sidNum = Number(studentId);
  const isNum = !isNaN(sidNum);

  console.log(`[purgeStudentCascade] Initiating cascading delete for student #${studentId}`);
  setRemoteSyncing(true);
  try {
    await db.transaction('rw', [db.students, db.class_students, db.student_sessions, db.warnings, db.knowledge_results, db.ai_diagnoses], async () => {
      await db.students.delete(sidStr);
      if (isNum) await db.students.delete(sidNum as any);

      const delByField = async (table: any) => {
        await table.where('student_id').equals(sidStr).delete();
        if (isNum) await table.where('student_id').equals(sidNum).delete();
      };

      await delByField(db.class_students);
      await delByField(db.student_sessions);
      await delByField(db.warnings);
      await delByField(db.knowledge_results);
      await delByField(db.ai_diagnoses);
    });
    console.log(`[purgeStudentCascade] Successfully purged student #${studentId} and related records locally`);
  } catch (err) {
    console.warn(`[purgeStudentCascade] Error deleting student ${studentId}:`, err);
  } finally {
    setRemoteSyncing(false);
  }
};

export const useCloudSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const { user } = useAuth();
  
  // Keep a ref to the latest pushToCloud to use in event listeners
  const pushToCloudRef = useRef<(forceAll?: boolean) => Promise<void>>();

  // Safety watchdog: If isSyncing stays true for more than 15s without resolving, force reset
  useEffect(() => {
    if (!isSyncing) return;
    const watchdogTimer = setTimeout(() => {
      console.warn('[Cloud Sync] Đồng bộ vượt quá 15 giây, tự động giải phóng trạng thái giao diện.');
      setIsSyncing(false);
      setSyncStatus('Đồng bộ mất nhiều thời gian do mạng, dữ liệu vẫn được lưu 100% cục bộ.');
      setTimeout(() => setSyncStatus(null), 4000);
    }, 15000);

    return () => clearTimeout(watchdogTimer);
  }, [isSyncing]);

  const pushToCloud = useCallback(async (forceAll = false) => {
    if (!isCloudSyncEnabled()) {
      setSyncStatus('Chế độ Offline (Đồng bộ đám mây đang tắt)');
      setTimeout(() => setSyncStatus(null), 2500);
      return;
    }
    if (isQuotaExceeded()) {
      setSyncStatus('Chế độ Offline (Hết hạn ngạch Cloud)');
      setTimeout(() => setSyncStatus(null), 2500);
      return;
    }

    const lastSyncTs = localStorage.getItem(LAST_SYNC_KEY);
    const lastSyncTime = lastSyncTs ? new Date(lastSyncTs).getTime() : 0;
    const isDelta = !forceAll && lastSyncTime > 0;
    const deltaThreshold = isDelta ? lastSyncTime - 5000 : 0;

    setIsSyncing(true);
    setSyncStatus(isDelta ? 'Đang đồng bộ thay đổi mới (Delta)...' : 'Đang đẩy toàn bộ dữ liệu lên Cloud...');

    try {
      try {
        await withTimeout(enableNetwork(firestoreDb), 3000, 'Không thể kết nối mạng Firestore');
      } catch (_) {}

      // 1. Fetch tombstones to prevent pushing previously deleted records with timeout
      let deletedIds = new Set<string>();
      let deletedStudentIds = new Set<string>();
      try {
        const deletedSnap = await withTimeout(
          getDocs(collection(firestoreDb, 'deleted_records')),
          6000,
          'Quá thời gian tải danh sách đã xóa'
        );
        trackFirestoreUsage('reads', deletedSnap.size || 1);
        deletedSnap.docs.forEach(docSnap => {
          const d = docSnap.data();
          if (d.id) deletedIds.add(String(d.id));
          if (d.student_id) deletedStudentIds.add(String(d.student_id));
        });
      } catch (err) {
        console.warn('[Cloud Sync] Bỏ qua kiểm tra tombstones (timeout/offline):', err);
      }

      // Purge any local zombie records matching tombstones first
      for (const delSid of deletedStudentIds) {
        await purgeStudentCascade(delSid);
      }

      const isRecordDeleted = (item: any) => {
        const itemId = String(item.id || '');
        const itemStudentId = String(item.student_id || '');
        return deletedIds.has(itemId) || (itemStudentId && deletedStudentIds.has(itemStudentId));
      };

      // Get all local data from Dexie after tombstone purge
      const classes = await db.classes.toArray();
      const students = await db.students.toArray();
      const classStudents = await db.class_students.toArray();
      const sessions = await db.sessions.toArray();
      const studentSessions = await db.student_sessions.toArray();
      const warnings = await db.warnings.toArray();
      const knowledgeTags = await db.knowledge_tags.toArray();
      const schoolYears = await db.school_years.toArray();
      const settings = await db.settings.toArray();
      const knowledgeResults = await db.knowledge_results.toArray();
      const aiDiagnoses = await db.ai_diagnoses.toArray();
      const auditLogs = await db.audit_logs.toArray();

      // Clean up individual deleted records locally
      for (const st of students) {
        if (isRecordDeleted(st)) await purgeStudentCascade(st.id);
      }
      for (const cs of classStudents) {
        if (isRecordDeleted(cs)) await db.class_students.delete(cs.id);
      }
      for (const ss of studentSessions) {
        if (isRecordDeleted(ss)) await db.student_sessions.delete(ss.id);
      }
      for (const w of warnings) {
        if (isRecordDeleted(w)) await db.warnings.delete(w.id);
      }

      // Prepare items to push (filter out deleted items & apply delta filter if applicable)
      const allOperations: { tableName: string; item: any }[] = [];

      const addTableItems = (tableName: string, items: any[]) => {
        items.forEach(item => {
          if (item && item.id && !isRecordDeleted(item)) {
            if (!isDelta || getItemTimestamp(item) >= deltaThreshold) {
              allOperations.push({ tableName, item });
            }
          }
        });
      };

      addTableItems('classes', classes);
      addTableItems('students', students);
      addTableItems('class_students', classStudents);
      addTableItems('sessions', sessions);
      addTableItems('student_sessions', studentSessions);
      addTableItems('warnings', warnings);
      addTableItems('knowledge_tags', knowledgeTags);
      addTableItems('school_years', schoolYears);
      addTableItems('settings', settings);
      addTableItems('knowledge_results', knowledgeResults);
      addTableItems('ai_diagnoses', aiDiagnoses);
      addTableItems('audit_logs', auditLogs);

      if (allOperations.length === 0) {
        setSyncStatus('Dữ liệu đã đồng bộ mới nhất');
        localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
        setIsSyncing(false);
        setTimeout(() => setSyncStatus(null), 2500);
        return;
      }

      const sanitizeData = (obj: any) => {
        return Object.entries(obj).reduce((acc, [key, value]) => {
          if (value !== undefined) {
            acc[key] = value;
          }
          return acc;
        }, {} as any);
      };

      // Firestore writeBatch limit is 500 operations.
      // Chunk all operations into batches of max 400 with strict timeout on commit.
      const BATCH_SIZE = 400;
      for (let i = 0; i < allOperations.length; i += BATCH_SIZE) {
        const chunk = allOperations.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(firestoreDb);
        chunk.forEach(({ tableName, item }) => {
          const docRef = doc(collection(firestoreDb, tableName), String(item.id));
          batch.set(docRef, sanitizeData(item), { merge: true });
        });
        
        await withTimeout(
          batch.commit(),
          8000,
          'Mạng phản hồi chậm khi ghi lên Cloud (Gói dữ liệu đã được lưu cục bộ)'
        );
        trackFirestoreUsage('writes', chunk.length);
      }

      const currentSyncStartTime = new Date().toISOString();
      localStorage.setItem(LAST_SYNC_KEY, currentSyncStartTime);
      setSyncStatus(`Đã đồng bộ ${allOperations.length} bản ghi lên Cloud thành công!`);
      logSyncActivity({
        tableName: 'Tất cả các bảng',
        action: 'push_batch',
        description: `Đã đồng bộ thành công ${allOperations.length} bản ghi lên Cloud`,
        status: 'success',
      });
    } catch (error: any) {
      if (error?.code === 'resource-exhausted' || error?.message?.includes('Quota limit exceeded') || error?.message?.includes('quota')) {
        sessionStorage.setItem('firestore_quota_exceeded', 'true');
        console.warn('[Cloud Sync] Đã đạt giới hạn ghi Firestore miễn phí trong ngày.');
        setSyncStatus('Lỗi: Đã hết hạn ngạch ghi Firestore miễn phí trong ngày.');
      } else {
        console.error('Push to cloud error:', error);
        setSyncStatus(`Thông báo: ${error.message || 'Không thể kết nối đến máy chủ Cloud'}`);
      }
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 3500);
    }
  }, [user]);
  
  pushToCloudRef.current = pushToCloud;

  const pullFromCloud = useCallback(async () => {
    if (!isCloudSyncEnabled()) {
      setSyncStatus('Chế độ Offline (Đồng bộ đám mây đang tắt)');
      return;
    }
    if (isQuotaExceeded()) {
      setSyncStatus('Chế độ Offline (Hết hạn ngạch Cloud)');
      return;
    }
    setIsSyncing(true);
    setSyncStatus('Đang tải dữ liệu từ Cloud...');
    
    try {
      enableNetwork(firestoreDb).catch(() => {});

      // 1. Fetch tombstones
      let deletedIds = new Set<string>();
      let deletedStudentIds = new Set<string>();
      try {
        const deletedSnap = await withTimeout(
          getDocs(collection(firestoreDb, 'deleted_records')),
          6000,
          'Quá thời gian tải danh sách đã xóa'
        );
        deletedSnap.docs.forEach(docSnap => {
          const d = docSnap.data();
          if (d.id) deletedIds.add(String(d.id));
          if (d.student_id) deletedStudentIds.add(String(d.student_id));
        });
      } catch (err) {
        console.warn('[Pull From Cloud] Error fetching tombstones:', err);
      }

      // Purge local Dexie records matching tombstones
      for (const delSid of deletedStudentIds) {
        await purgeStudentCascade(delSid);
      }

      const isRecordDeleted = (id: string, studentId?: string) => {
        return deletedIds.has(String(id)) || (studentId && deletedStudentIds.has(String(studentId)));
      };

      // 2. Fetch all collections from Firestore in parallel
      const collectionsToSync = [
        { name: 'classes', table: db.classes },
        { name: 'students', table: db.students },
        { name: 'class_students', table: db.class_students },
        { name: 'sessions', table: db.sessions },
        { name: 'student_sessions', table: db.student_sessions },
        { name: 'warnings', table: db.warnings },
        { name: 'knowledge_tags', table: db.knowledge_tags },
        { name: 'school_years', table: db.school_years },
        { name: 'settings', table: db.settings },
        { name: 'knowledge_results', table: db.knowledge_results },
        { name: 'ai_diagnoses', table: db.ai_diagnoses },
        { name: 'audit_logs', table: db.audit_logs },
      ];

      const pullResults = await Promise.all(
        collectionsToSync.map(async (col) => {
          try {
            const snap = await withTimeout(
              getDocs(collection(firestoreDb, col.name)),
              8000,
              `Quá thời gian tải bảng ${col.name}`
            );
            trackFirestoreUsage('reads', snap.size || 1);
            const remoteDocIds = new Set<string>();
            const docsToPut: any[] = [];

            snap.docs.forEach(docSnap => {
              const data: any = { ...docSnap.data(), id: docSnap.id };
              remoteDocIds.add(String(docSnap.id));
              const studentId = data.student_id || (col.name === 'students' ? data.id : undefined);
              if (!isRecordDeleted(data.id, studentId)) {
                docsToPut.push(data);
              }
            });

            return { col, remoteDocIds, docsToPut };
          } catch (err) {
            console.warn(`[Pull From Cloud] Error pulling ${col.name}:`, err);
            return null;
          }
        })
      );

      let totalPulled = 0;
      setRemoteSyncing(true);
      try {
        const lockTables = collectionsToSync.map(c => c.table);
        await db.transaction('rw', lockTables, async () => {
          for (const res of pullResults) {
            if (!res) continue;
            const { col, remoteDocIds, docsToPut } = res;

            // Reconcile missing remote docs
            const localItems = await (col.table as any).toArray();
            for (const localItem of localItems) {
              const localIdStr = String(localItem.id);
              if (!remoteDocIds.has(localIdStr)) {
                if (col.name === 'students') {
                  await purgeStudentCascade(localItem.id);
                } else {
                  await (col.table as any).delete(localItem.id);
                }
              }
            }

            if (docsToPut.length > 0) {
              await (col.table as any).bulkPut(docsToPut);
              totalPulled += docsToPut.length;
            }
          }
        });
      } finally {
        setRemoteSyncing(false);
      }

      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      const finalStudents = await db.students.toArray();
      setSyncStatus(`Tải thành công ${totalPulled} bản ghi (Còn ${finalStudents.length} học sinh hiện tại) từ Cloud!`);
      logSyncActivity({
        tableName: 'Tất cả các bảng',
        action: 'pull_batch',
        description: `Đã tải về thành công ${totalPulled} bản ghi từ Cloud`,
        status: 'success',
      });
    } catch (err: any) {
      console.error('[Pull From Cloud] Error:', err);
      setSyncStatus(`Lỗi tải từ Cloud: ${err.message}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 3000);
    }
  }, [user]);

  // Real-time synchronization from Firestore to Dexie using onSnapshot with debounced batching
  useEffect(() => {
    // Clear legacy/stale quota lock from localStorage if sessionStorage is not explicitly locked
    if (sessionStorage.getItem('firestore_quota_exceeded') !== 'true') {
      localStorage.removeItem('firestore_quota_exceeded_date');
    }

    if (isQuotaExceeded()) {
      try {
        disableNetwork(firestoreDb).catch(() => {});
      } catch (_) {}
      return;
    }

    // Ensure network is enabled for real-time listeners
    try {
      enableNetwork(firestoreDb).catch(() => {});
    } catch (_) {}

    const unsubs: (() => void)[] = [];

    const stopAllListeners = () => {
      unsubs.forEach(unsub => {
        try { unsub(); } catch (_) {}
      });
      unsubs.length = 0;
    };

    // Queue for batching real-time updates across collections into a single Dexie transaction
    const pendingPuts = new Map<any, any[]>();
    const pendingDeletes = new Map<any, (string | number)[]>();
    let batchTimer: any = null;

    const flushBatchedUpdates = async () => {
      batchTimer = null;
      if (pendingPuts.size === 0 && pendingDeletes.size === 0) return;

      const putsToProcess = new Map(pendingPuts);
      const deletesToProcess = new Map(pendingDeletes);
      pendingPuts.clear();
      pendingDeletes.clear();

      setRemoteSyncing(true);
      try {
        for (const [table, items] of putsToProcess.entries()) {
          if (items.length > 0 && table) {
            console.log(`[Firestore Listener: Flush] Bulk putting ${items.length} item(s) into Dexie table.`);
            await table.bulkPut(items);
          }
        }
        for (const [table, ids] of deletesToProcess.entries()) {
          if (ids.length > 0 && table) {
            const strIds = ids.map((id) => String(id));
            const numIds = ids.map((id) => Number(id)).filter((id) => !isNaN(id));
            const allIds = Array.from(new Set([...strIds, ...numIds]));
            console.log(`[Firestore Listener: Flush] Bulk deleting ${allIds.length} ID(s) from Dexie table.`);
            await table.bulkDelete(allIds);
          }
        }
      } catch (err) {
        console.error('[Firestore Listener: Flush] Error executing batched realtime puts/deletes:', err);
      } finally {
        setRemoteSyncing(false);
      }
    };

    const scheduleBatchFlush = () => {
      if (!batchTimer) {
        batchTimer = setTimeout(flushBatchedUpdates, 0);
      }
    };

    const setupListener = (tableName: string, dexieTable: any) => {
      const colRef = collection(firestoreDb, tableName);
      const unsub = onSnapshot(colRef, async (snapshot) => {
        try {
          const changes = snapshot.docChanges();
          console.log(
            `[Firestore Listener: ${tableName}] Snapshot event received. Total docs: ${snapshot.size}, changes: ${changes.length}, hasPendingWrites: ${snapshot.metadata.hasPendingWrites}, fromCache: ${snapshot.metadata.fromCache}`
          );

          // Echo Loopback Guard: Skip changes that originated from local pending writes
          if (snapshot.metadata.hasPendingWrites) {
            console.log(`[Firestore Listener: ${tableName}] Ignored snapshot due to local pending writes (hasPendingWrites=true)`);
            return;
          }

          if (changes.length === 0) return;

          for (const change of changes) {
            const docId = change.doc.id;
            const rawData = change.doc.data();
            const data = { ...rawData, id: docId };

            console.log(`[Firestore Listener: ${tableName}] Change event [type=${change.type}] for doc #${docId}`, change.type !== 'removed' ? data : '');

            if (change.type === 'added' || change.type === 'modified') {
              if (dexieTable) {
                if (!pendingPuts.has(dexieTable)) pendingPuts.set(dexieTable, []);
                pendingPuts.get(dexieTable)!.push(data);
              }
            } else if (change.type === 'removed') {
              if (tableName === 'students') {
                console.log(`[Firestore Listener: ${tableName}] Processing removal for student #${docId}`);
                await purgeStudentCascade(docId);
              } else if (dexieTable) {
                console.log(`[Firestore Listener: ${tableName}] Queuing deletion for doc #${docId}`);
                if (!pendingDeletes.has(dexieTable)) pendingDeletes.set(dexieTable, []);
                pendingDeletes.get(dexieTable)!.push(docId);
              }
            }
          }

          scheduleBatchFlush();
        } catch (err) {
          console.error(`[Firestore Listener: ${tableName}] Error processing snapshot:`, err);
        }
      }, (error) => {
        if (isQuotaError(error) || error?.code === 'resource-exhausted') {
          console.warn(`[Firestore Listener: ${tableName}] Quota limit reached.`);
          markQuotaExceeded();
          stopAllListeners();
        } else if (error?.code === 'unavailable') {
          console.warn(`[Firestore Listener: ${tableName}] Firestore connection temporarily unavailable. Auto-reconnecting...`);
        } else {
          console.error(`[Firestore Listener: ${tableName}] Listener error:`, error);
        }
      });
      unsubs.push(unsub);
    };

    // Listen to tombstones (deleted_records)
    const setupTombstoneListener = () => {
      const colRef = collection(firestoreDb, 'deleted_records');
      const unsub = onSnapshot(colRef, async (snapshot) => {
        try {
          if (snapshot.metadata.hasPendingWrites) {
            console.log('[Firestore Listener: Tombstones] Ignoring local pending write snapshot.');
            return;
          }

          const changes = snapshot.docChanges();
          if (changes.length > 0) {
            console.log(`[Firestore Listener: Tombstones] Snapshot received with ${changes.length} change(s).`);
          }

          setRemoteSyncing(true);
          try {
            for (const change of changes) {
              if (change.type === 'added' || change.type === 'modified') {
                const data = change.doc.data();
                const targetTable = data.table_name;
                const targetId = data.id;
                const studentId = data.student_id;

                console.log(`[Firestore Listener: Tombstones] Received tombstone [type=${change.type}] for table=${targetTable}, id=${targetId}, student_id=${studentId}`);

                if (studentId) {
                  await purgeStudentCascade(studentId);
                }
                if (targetTable && targetId && (db as any)[targetTable]) {
                  try {
                    const targetTableObj = (db as any)[targetTable];
                    console.log(`[Firestore Listener: Tombstones] Deleting record #${targetId} from table ${targetTable}`);
                    await targetTableObj.delete(String(targetId));
                    if (!isNaN(Number(targetId))) {
                      await targetTableObj.delete(Number(targetId));
                    }
                  } catch (delErr) {
                    console.warn(`[Firestore Listener: Tombstones] Error deleting #${targetId} from ${targetTable}:`, delErr);
                  }
                }
              }
            }
          } finally {
            setRemoteSyncing(false);
          }
        } catch (err) {
          console.error('[Firestore Listener: Tombstones] Error processing snapshot:', err);
        }
      }, (err) => {
        console.warn('[Firestore Listener: Tombstones] Listener error:', err);
      });
      unsubs.push(unsub);
    };

    setupTombstoneListener();
    setupListener('classes', db.classes);
    setupListener('students', db.students);
    setupListener('class_students', db.class_students);
    setupListener('sessions', db.sessions);
    setupListener('student_sessions', db.student_sessions);
    setupListener('warnings', db.warnings);
    setupListener('knowledge_tags', db.knowledge_tags);
    setupListener('school_years', db.school_years);
    setupListener('settings', db.settings);
    setupListener('knowledge_results', db.knowledge_results);
    setupListener('ai_diagnoses', db.ai_diagnoses);
    setupListener('audit_logs', db.audit_logs);

    // Initial background sync on app start to pull any missed offline updates automatically
    pullFromCloud().catch(() => {});

    // Auto-reconnect listener: automatically run delta sync when internet returns
    const handleOnline = () => {
      if (pushToCloudRef.current && !isQuotaExceeded()) {
        pushToCloudRef.current(false).catch(() => {});
      }
    };
    window.addEventListener('online', handleOnline);

    return () => {
      stopAllListeners();
      if (batchTimer) clearTimeout(batchTimer);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Tự động bảo vệ dữ liệu khi người dùng đóng tab hoặc thoát trình duyệt
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pushToCloudRef.current && !isQuotaExceeded()) {
        pushToCloudRef.current(false).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return {
    isSyncing,
    syncStatus,
    pushToCloud,
    pullFromCloud
  };
};


