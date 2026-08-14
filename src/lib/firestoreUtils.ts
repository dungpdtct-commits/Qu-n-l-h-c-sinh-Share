import { setDoc, deleteDoc, addDoc, WriteBatch, disableNetwork, enableNetwork } from 'firebase/firestore';
import { db } from './firebase';

export interface FirestoreQuotaStats {
  date: string;
  writes: number;
  reads: number;
  deletes: number;
  lastUpdated: number;
  limits: {
    writes: number;
    reads: number;
    deletes: number;
    storageMb: number;
  };
}

export const FIRESTORE_FREE_LIMITS = {
  writes: 20000,   // 20,000 document writes / day
  reads: 50000,    // 50,000 document reads / day
  deletes: 20000,  // 20,000 document deletes / day
  storageMb: 1024, // 1 GB free stored data
};

const USAGE_KEY_PREFIX = 'firestore_daily_usage_';

export const getTodayKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const getFirestoreUsage = (): FirestoreQuotaStats => {
  const todayKey = getTodayKey();
  const raw = localStorage.getItem(`${USAGE_KEY_PREFIX}${todayKey}`);
  let data = {
    date: todayKey,
    writes: 0,
    reads: 0,
    deletes: 0,
    lastUpdated: Date.now(),
  };

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.date === todayKey) {
        data = { ...data, ...parsed };
      }
    } catch {
      // ignore parse error
    }
  }

  return {
    ...data,
    limits: FIRESTORE_FREE_LIMITS,
  };
};

export const trackFirestoreUsage = (type: 'writes' | 'reads' | 'deletes', count = 1): FirestoreQuotaStats => {
  if (count <= 0) return getFirestoreUsage();
  const todayKey = getTodayKey();
  const current = getFirestoreUsage();
  current[type] = (current[type] || 0) + count;
  current.lastUpdated = Date.now();

  try {
    localStorage.setItem(
      `${USAGE_KEY_PREFIX}${todayKey}`,
      JSON.stringify({
        date: todayKey,
        writes: current.writes,
        reads: current.reads,
        deletes: current.deletes,
        lastUpdated: current.lastUpdated,
      })
    );
    // Dispatch custom event for real-time reactivity in UI
    window.dispatchEvent(new CustomEvent('firestore-usage-updated', { detail: current }));
  } catch {
    // ignore storage error
  }

  return current;
};

export const resetFirestoreUsageCounter = (): FirestoreQuotaStats => {
  const todayKey = getTodayKey();
  const initial = {
    date: todayKey,
    writes: 0,
    reads: 0,
    deletes: 0,
    lastUpdated: Date.now(),
    limits: FIRESTORE_FREE_LIMITS,
  };
  localStorage.setItem(`${USAGE_KEY_PREFIX}${todayKey}`, JSON.stringify(initial));
  window.dispatchEvent(new CustomEvent('firestore-usage-updated', { detail: initial }));
  return initial;
};

export const isCloudSyncEnabled = (): boolean => {
  return localStorage.getItem('cloud_sync_enabled') !== 'false';
};

export const isQuotaExceeded = (): boolean => {
  if (!isCloudSyncEnabled()) return true; // Treat as exceeded to run strictly offline
  const today = new Date().toDateString();
  const savedQuotaDate = localStorage.getItem('firestore_quota_exceeded_date');
  return savedQuotaDate === today || sessionStorage.getItem('firestore_quota_exceeded') === 'true';
};

export const resetQuotaLock = async (): Promise<boolean> => {
  try {
    localStorage.removeItem('firestore_quota_exceeded_date');
    sessionStorage.removeItem('firestore_quota_exceeded');
    if (db) {
      await enableNetwork(db);
      console.log('[Firestore System] Đã kích hoạt lại kết nối Cloud Firestore.');
    }
    return true;
  } catch (err) {
    console.warn('[Firestore System] Lỗi khi kích hoạt lại mạng:', err);
    return false;
  }
};

export const markQuotaExceeded = (): void => {
  const today = new Date().toDateString();
  localStorage.setItem('firestore_quota_exceeded_date', today);
  sessionStorage.setItem('firestore_quota_exceeded', 'true');
  console.warn('[Firestore System] Đã đạt giới hạn ghi Firestore miễn phí trong ngày (Quota limit exceeded). Toàn bộ dữ liệu được lưu an toàn tuyệt đối trên thiết bị (Offline IndexedDB).');
  
  try {
    disableNetwork(db).then(() => {
      console.log('[Firestore System] Đã ngắt kết nối mạng Firestore để tránh lặp lỗi và bảo mật băng thông.');
    }).catch(err => {
      console.warn('[Firestore System] Lỗi khi ngắt kết nối mạng:', err);
    });
  } catch (err) {
    console.warn('[Firestore System] Lỗi đồng bộ ngắt kết nối mạng:', err);
  }
};

export const isQuotaError = (error: any): boolean => {
  if (!error) return false;
  const msg = String(error.message || error).toLowerCase();
  const code = String(error.code || '').toLowerCase();
  return (
    code === 'resource-exhausted' ||
    msg.includes('quota limit exceeded') ||
    msg.includes('quota exceeded') ||
    msg.includes('resource-exhausted') ||
    msg.includes('429')
  );
};

export const safeSetDoc = async (docRef: any, data: any, options?: any): Promise<boolean> => {
  if (!isCloudSyncEnabled() || isQuotaExceeded()) return false;
  try {
    if (options) {
      await setDoc(docRef, data, options);
    } else {
      await setDoc(docRef, data);
    }
    trackFirestoreUsage('writes', 1);
    return true;
  } catch (error: any) {
    if (isQuotaError(error)) {
      markQuotaExceeded();
    } else {
      console.warn('[Firestore safeSetDoc]', error);
    }
    return false;
  }
};

export const safeDeleteDoc = async (docRef: any): Promise<boolean> => {
  if (!isCloudSyncEnabled() || isQuotaExceeded()) return false;
  try {
    await deleteDoc(docRef);
    trackFirestoreUsage('deletes', 1);
    return true;
  } catch (error: any) {
    if (isQuotaError(error)) {
      markQuotaExceeded();
    } else {
      console.warn('[Firestore safeDeleteDoc]', error);
    }
    return false;
  }
};

export const safeAddDoc = async (collectionRef: any, data: any): Promise<any> => {
  if (!isCloudSyncEnabled() || isQuotaExceeded()) return null;
  try {
    const docRef = await addDoc(collectionRef, data);
    trackFirestoreUsage('writes', 1);
    return docRef;
  } catch (error: any) {
    if (isQuotaError(error)) {
      markQuotaExceeded();
    } else {
      console.warn('[Firestore safeAddDoc]', error);
    }
    return null;
  }
};

export const safeBatchCommit = async (batch: WriteBatch, opCount = 1): Promise<boolean> => {
  if (!isCloudSyncEnabled() || isQuotaExceeded()) return false;
  try {
    await batch.commit();
    trackFirestoreUsage('writes', opCount);
    return true;
  } catch (error: any) {
    if (isQuotaError(error)) {
      markQuotaExceeded();
    } else {
      console.warn('[Firestore safeBatchCommit]', error);
    }
    return false;
  }
};

