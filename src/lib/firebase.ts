import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, disableNetwork } from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';

// Build active config: Start with bundled config, override with Vite env variables if provided
let activeConfig: any = { ...firebaseConfigData };
const metaEnv = (import.meta as any).env || {};

if (metaEnv.VITE_FIREBASE_API_KEY) {
  activeConfig.apiKey = metaEnv.VITE_FIREBASE_API_KEY;
}
if (metaEnv.VITE_FIREBASE_AUTH_DOMAIN) {
  activeConfig.authDomain = metaEnv.VITE_FIREBASE_AUTH_DOMAIN;
}
if (metaEnv.VITE_FIREBASE_PROJECT_ID) {
  activeConfig.projectId = metaEnv.VITE_FIREBASE_PROJECT_ID;
}
if (metaEnv.VITE_FIREBASE_STORAGE_BUCKET) {
  activeConfig.storageBucket = metaEnv.VITE_FIREBASE_STORAGE_BUCKET;
}
if (metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID) {
  activeConfig.messagingSenderId = metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID;
}
if (metaEnv.VITE_FIREBASE_APP_ID) {
  activeConfig.appId = metaEnv.VITE_FIREBASE_APP_ID;
}
if (metaEnv.VITE_FIREBASE_DATABASE_ID) {
  activeConfig.firestoreDatabaseId = metaEnv.VITE_FIREBASE_DATABASE_ID;
}

try {
  const useCustom = localStorage.getItem('use_custom_firebase') === 'true';
  const customStr = localStorage.getItem('custom_firebase_config');
  if (useCustom && customStr) {
    const parsed = JSON.parse(customStr);
    if (parsed && parsed.apiKey && parsed.projectId) {
      activeConfig = { ...activeConfig, ...parsed };
      console.log('[Firebase Init] Kích hoạt Firebase Đám Mây Cá Nhân thành công:', parsed.projectId);
    }
  }
} catch (e) {
  console.warn('[Firebase Init] Không thể tải cấu hình Firebase cá nhân:', e);
}

const app = !getApps().length ? initializeApp(activeConfig) : getApp();
const auth = getAuth(app);

// Determine database ID:
// If custom database is defined, use it.
// If project matches AI Studio provisioned project, use the provisioned database ID.
// Otherwise (e.g. personal Firebase project with standard default database), use default database.
const isAiStudioProject = activeConfig.projectId === 'gen-lang-client-0542163673' || activeConfig.projectId === (firebaseConfigData as any).projectId;
const resolvedDatabaseId = activeConfig.firestoreDatabaseId || (isAiStudioProject ? (firebaseConfigData as any).firestoreDatabaseId : undefined);

const db = resolvedDatabaseId ? getFirestore(app, resolvedDatabaseId) : getFirestore(app);

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
