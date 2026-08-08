import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, disableNetwork } from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';

let activeConfig: any = firebaseConfigData;

try {
  const useCustom = localStorage.getItem('use_custom_firebase') === 'true';
  const customStr = localStorage.getItem('custom_firebase_config');
  if (useCustom && customStr) {
    const parsed = JSON.parse(customStr);
    if (parsed && parsed.apiKey && parsed.projectId) {
      activeConfig = { ...firebaseConfigData, ...parsed };
      console.log('[Firebase Init] Kích hoạt Firebase Đám Mây Cá Nhân thành công:', parsed.projectId);
    }
  }
} catch (e) {
  console.warn('[Firebase Init] Không thể tải cấu hình Firebase cá nhân:', e);
}

const app = !getApps().length ? initializeApp(activeConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app, activeConfig.firestoreDatabaseId || (firebaseConfigData as any).firestoreDatabaseId);

// Auto disable network if quota exceeded or cloud sync is disabled
try {
  const isSyncDisabled = localStorage.getItem('cloud_sync_enabled') === 'false';
  const today = new Date().toDateString();
  const savedQuotaDate = localStorage.getItem('firestore_quota_exceeded_date');
  const isQuotaExceeded = savedQuotaDate === today || sessionStorage.getItem('firestore_quota_exceeded') === 'true';
  
  if (isSyncDisabled || isQuotaExceeded) {
    disableNetwork(db).then(() => {
      console.log('[Firestore Init] Đã chủ động ngắt kết nối mạng Firestore để chạy chế độ Offline-First mượt mà (Tránh lỗi Quota / Sync đang tắt).');
    }).catch(err => {
      console.warn('[Firestore Init] Không thể ngắt kết nối mạng Firestore:', err);
    });
  }
} catch (e) {
  console.warn('[Firestore Init] Lỗi cấu hình offline-first cho Firestore:', e);
}

const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};

export { app, auth, db, googleProvider };
