import { useState, useEffect } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  signInAnonymously as firebaseSignInAnonymously,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { UserRole } from '../types';

export interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  role: UserRole;
  isAdmin: boolean;
  isAssistant: boolean;
  loginWithGoogle: () => Promise<void>;
  loginAnonymously: () => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (newRole: UserRole) => void;
  canExecuteAction: (action: 'manage_classes' | 'delete_student' | 'archive_class' | 'promote_class' | 'edit_settings') => boolean;
}

export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Default role stored in localStorage or default to 'Admin'
  const [role, setRole] = useState<UserRole>(() => {
    const savedRole = localStorage.getItem('smart_edu_user_role');
    return (savedRole === 'TA' || savedRole === 'Assistant') ? 'TA' : 'Teacher';
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const switchRole = (newRole: UserRole) => {
    setRole(newRole);
    localStorage.setItem('smart_edu_user_role', newRole);
  };

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Google Sign-In Error:', err);
      throw err;
    }
  };

  const loginAnonymously = async () => {
    try {
      await firebaseSignInAnonymously(auth);
    } catch (err) {
      console.error('Anonymous Sign-In Error:', err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error('Logout Error:', err);
      throw err;
    }
  };

  const isAdmin = role === 'Teacher' || role === 'Admin' as any;
  const isAssistant = role === 'TA' || role === 'Assistant' as any;

  const canExecuteAction = (action: 'manage_classes' | 'delete_student' | 'archive_class' | 'promote_class' | 'edit_settings'): boolean => {
    // Only Admin (Teacher / Giáo viên chính) can execute dangerous/management actions
    if (isAssistant) {
      return false;
    }
    return true;
  };

  return {
    user,
    loading,
    role,
    isAdmin,
    isAssistant,
    loginWithGoogle,
    loginAnonymously,
    logout,
    switchRole,
    canExecuteAction,
  };
};

export default useAuth;
