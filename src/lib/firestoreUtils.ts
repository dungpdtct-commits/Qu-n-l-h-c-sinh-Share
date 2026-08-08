import { setDoc, deleteDoc, addDoc, WriteBatch, disableNetwork } from 'firebase/firestore';
import { db } from './firebase';

export const isCloudSyncEnabled = (): boolean => {
  return localStorage.getItem('cloud_sync_enabled') !== 'false';
};

export const isQuotaExceeded = (): boolean => {
  if (!isCloudSyncEnabled()) return true; // Treat as exceeded to run strictly offline
  const today = new Date().toDateString();
  const savedQuotaDate = localStorage.getItem('firestore_quota_exceeded_date');
  return savedQuotaDate === today || sessionStorage.getItem('firestore_quota_exceeded') === 'true';
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
    return await addDoc(collectionRef, data);
  } catch (error: any) {
    if (isQuotaError(error)) {
      markQuotaExceeded();
    } else {
      console.warn('[Firestore safeAddDoc]', error);
    }
    return null;
  }
};

export const safeBatchCommit = async (batch: WriteBatch): Promise<boolean> => {
  if (!isCloudSyncEnabled() || isQuotaExceeded()) return false;
  try {
    await batch.commit();
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
