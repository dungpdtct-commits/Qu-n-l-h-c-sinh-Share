import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, getDocs, writeBatch, doc, onSnapshot, disableNetwork } from 'firebase/firestore';
import { db as firestoreDb } from '../lib/firebase';
import { db } from '../db/dexie';
import { useAuth } from '../lib/AuthContext';
import { isQuotaExceeded, markQuotaExceeded, isQuotaError, isCloudSyncEnabled } from '../lib/firestoreUtils';

export const useCloudSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const { user } = useAuth();
  
  // Keep a ref to the latest pushToCloud to use in event listeners
  const pushToCloudRef = useRef<() => Promise<void>>();

  const pushToCloud = useCallback(async () => {
    if (!isCloudSyncEnabled()) {
      setSyncStatus('Chế độ Offline (Đồng bộ đám mây đang tắt)');
      return;
    }
    if (!user) {
      setSyncStatus('Lỗi: Cần đăng nhập để đồng bộ');
      return;
    }
    if (isQuotaExceeded()) {
      setSyncStatus('Chế độ Offline (Hết hạn ngạch Cloud)');
      return;
    }
    setIsSyncing(true);
    setSyncStatus('Đang đẩy dữ liệu lên Cloud...');

    try {
      // Delta Sync: Only push modified or newly created documents
      const lastSyncTimeStr = localStorage.getItem('last_successful_sync_time');
      const lastSyncTime = lastSyncTimeStr ? new Date(lastSyncTimeStr).getTime() : 0;
      const currentSyncStartTime = new Date().toISOString();

      const getItemTimestamp = (item: any) => {
        const times = [
          item.updated_at,
          item.last_updated,
          item.created_at,
          item.join_date,
          item.leave_date,
        ].map(t => t ? new Date(t).getTime() : 0);
        return Math.max(0, ...times.filter(t => !isNaN(t)));
      };

      // Get all local data
      const classes = await db.classes.toArray();
      const students = await db.students.toArray();
      const classStudents = await db.class_students.toArray();
      const sessions = await db.sessions.toArray();
      const studentSessions = await db.student_sessions.toArray();
      const warnings = await db.warnings.toArray();
      const knowledgeTags = await db.knowledge_tags.toArray();

      const filteredClasses = classes.filter(item => getItemTimestamp(item) > lastSyncTime);
      const filteredStudents = students.filter(item => getItemTimestamp(item) > lastSyncTime);
      const filteredClassStudents = classStudents.filter(item => getItemTimestamp(item) > lastSyncTime);
      const filteredSessions = sessions.filter(item => getItemTimestamp(item) > lastSyncTime);
      const filteredStudentSessions = studentSessions.filter(item => getItemTimestamp(item) > lastSyncTime);
      const filteredWarnings = warnings.filter(item => getItemTimestamp(item) > lastSyncTime);
      const filteredKnowledgeTags = knowledgeTags
        .filter(item => getItemTimestamp(item) > lastSyncTime)
        .map(tag => ({
          ...tag,
          reference_link: tag.reference_link || ''
        }));

      const totalUpdatesCount = 
        filteredClasses.length +
        filteredStudents.length +
        filteredClassStudents.length +
        filteredSessions.length +
        filteredStudentSessions.length +
        filteredWarnings.length +
        filteredKnowledgeTags.length;

      if (totalUpdatesCount === 0) {
        setSyncStatus('Dữ liệu đã đồng bộ (Không có thay đổi)');
        // Update anyway to prevent checking old records next time
        localStorage.setItem('last_successful_sync_time', currentSyncStartTime);
        setIsSyncing(false);
        setTimeout(() => setSyncStatus(null), 3000);
        return;
      }

      const batch = writeBatch(firestoreDb);

      const sanitizeData = (obj: any) => {
        return Object.entries(obj).reduce((acc, [key, value]) => {
          if (value !== undefined) {
            acc[key] = value;
          }
          return acc;
        }, {} as any);
      };

      const pushTable = (tableName: string, data: any[]) => {
        data.forEach(item => {
          if (item && item.id) {
            const docRef = doc(collection(firestoreDb, tableName), String(item.id));
            batch.set(docRef, sanitizeData(item), { merge: true });
          }
        });
      };

      pushTable('classes', filteredClasses);
      pushTable('students', filteredStudents);
      pushTable('class_students', filteredClassStudents);
      pushTable('sessions', filteredSessions);
      pushTable('student_sessions', filteredStudentSessions);
      pushTable('warnings', filteredWarnings);
      pushTable('knowledge_tags', filteredKnowledgeTags);

      await batch.commit();
      localStorage.setItem('last_successful_sync_time', currentSyncStartTime);
      setSyncStatus(`Đẩy thành công ${totalUpdatesCount} bản ghi cập nhật!`);
    } catch (error: any) {
      if (error?.code === 'resource-exhausted' || error?.message?.includes('Quota limit exceeded') || error?.message?.includes('quota')) {
        sessionStorage.setItem('firestore_quota_exceeded', 'true');
        console.warn('[Cloud Sync] Đã đạt giới hạn ghi Firestore miễn phí trong ngày. Chuyển sang hoàn toàn Offline IndexedDB.');
        setSyncStatus('Lỗi: Đã hết hạn ngạch ghi Firestore miễn phí trong ngày. Dữ liệu đã được lưu an toàn tại máy (Offline IndexedDB).');
      } else {
        console.error('Push to cloud error:', error);
        setSyncStatus(`Lỗi: ${error.message}`);
      }
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 3000);
    }
  }, [user]);
  
  pushToCloudRef.current = pushToCloud;

  const pullFromCloud = useCallback(async () => {
    if (!isCloudSyncEnabled()) {
      setSyncStatus('Chế độ Offline (Đồng bộ đám mây đang tắt)');
      return;
    }
    if (!user) {
      setSyncStatus('Lỗi: Cần đăng nhập để đồng bộ');
      return;
    }
    setIsSyncing(true);
    setSyncStatus('Đang tải dữ liệu từ Cloud...');
    
    setTimeout(() => {
      setSyncStatus('Đang đồng bộ ngầm (real-time)...');
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 3000);
    }, 1000);
  }, [user]);

  // Real-time synchronization from Firestore to Dexie using onSnapshot
  useEffect(() => {
    if (!user) return;

    if (isQuotaExceeded()) {
      try {
        disableNetwork(firestoreDb).catch(() => {});
      } catch (_) {}
      return;
    }

    const unsubs: (() => void)[] = [];

    const stopAllListeners = () => {
      unsubs.forEach(unsub => {
        try { unsub(); } catch (_) {}
      });
      unsubs.length = 0;
    };

    const setupListener = (tableName: string, dexieTable: any) => {
      const colRef = collection(firestoreDb, tableName);
      const unsub = onSnapshot(colRef, async (snapshot) => {
        try {
          await db.transaction('rw', dexieTable, async () => {
            const changes = snapshot.docChanges();
            for (const change of changes) {
              const data = { ...change.doc.data(), id: change.doc.id };
              if (change.type === 'added' || change.type === 'modified') {
                await dexieTable.put(data);
              } else if (change.type === 'removed') {
                await dexieTable.delete(data.id);
              }
            }
          });
        } catch (err) {
          console.error(`Error syncing ${tableName} to Dexie:`, err);
        }
      }, (error) => {
        if (isQuotaError(error) || error?.code === 'resource-exhausted') {
          markQuotaExceeded();
          stopAllListeners();
        } else if (error?.code === 'unavailable') {
          console.warn(`[Cloud Sync] Firestore hiện không khả dụng (offline hoặc sự cố mạng) cho bảng ${tableName}. Chạy ở chế độ Offline IndexedDB.`);
          stopAllListeners();
        } else {
          console.error(`Error listening to ${tableName}:`, error);
        }
      });
      unsubs.push(unsub);
    };

    setupListener('classes', db.classes);
    setupListener('students', db.students);
    setupListener('class_students', db.class_students);
    setupListener('sessions', db.sessions);
    setupListener('student_sessions', db.student_sessions);
    setupListener('warnings', db.warnings);
    setupListener('knowledge_tags', db.knowledge_tags);

    return () => {
      stopAllListeners();
    };
  }, [user]);

  // Tự động đẩy dữ liệu khi thoát hoặc ẩn ứng dụng (chỉ khi chưa vượt quá quota)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && pushToCloudRef.current) {
        if (!isQuotaExceeded()) {
          pushToCloudRef.current().catch(() => {});
        }
      }
    };
    
    const handleBeforeUnload = () => {
      if (pushToCloudRef.current) {
        if (!isQuotaExceeded()) {
          pushToCloudRef.current().catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
