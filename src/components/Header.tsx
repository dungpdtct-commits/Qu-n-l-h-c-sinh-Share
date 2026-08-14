import React from 'react';
import { UserRole, SchoolYear } from '../types';
import {
  GraduationCap,
  UserCheck,
  ShieldAlert,
  Sun,
  Moon,
  Search,
  BookOpen,
  CloudCheck,
  LogIn,
  LogOut,
  UploadCloud,
  DownloadCloud,
  Loader2
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useCloudSync } from '../hooks/useCloudSync';
import { isQuotaExceeded, getFirestoreUsage, FIRESTORE_FREE_LIMITS, FirestoreQuotaStats } from '../lib/firestoreUtils';
import { Gauge } from 'lucide-react';

interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  p1WarningCount: number;
  onOpenWarningCenter: () => void;
  onOpenCloudSyncModal: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  p1WarningCount,
  onOpenWarningCenter,
  onOpenCloudSyncModal,
  theme,
  onToggleTheme,
  searchQuery,
  onSearchChange,
}) => {
  const { user, loading, signIn, signOut } = useAuth();
  const { isSyncing, syncStatus, pushToCloud, pullFromCloud } = useCloudSync();
  const quotaExceeded = isQuotaExceeded();
  const [usageStats, setUsageStats] = React.useState<FirestoreQuotaStats>(getFirestoreUsage());

  React.useEffect(() => {
    const handleUsageUpdate = (e: any) => {
      if (e?.detail) {
        setUsageStats(e.detail);
      } else {
        setUsageStats(getFirestoreUsage());
      }
    };
    window.addEventListener('firestore-usage-updated', handleUsageUpdate);
    return () => {
      window.removeEventListener('firestore-usage-updated', handleUsageUpdate);
    };
  }, []);

  const writePercent = ((usageStats.writes / FIRESTORE_FREE_LIMITS.writes) * 100).toFixed(1);

  return (
    <header id="app-header" className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 lg:px-6 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left: Branding */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-600/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-snug">
                Smart Edu Manager
              </h1>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Toán THCS (Lớp 6 - 9)
              </p>
            </div>
          </div>
        </div>

        {/* Center: Search Bar */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="global-search-input"
            type="text"
            placeholder="Tìm tên học sinh, lớp, SĐT..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 pl-9 pr-3 py-2 rounded-xl border border-transparent focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-all outline-none"
          />
        </div>

        {/* Right: Role Switcher & Action Indicators */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          {/* Firestore Sync Indicator & Inspection Trigger */}
          <button
            onClick={onOpenCloudSyncModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all cursor-pointer shadow-2xs"
            title="Bấm để mở Trung tâm Giám sát Đồng bộ Đám mây & Xem chi tiết dữ liệu & hạn mức"
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Đang đẩy Cloud...</span>
              </>
            ) : quotaExceeded ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                <span className="hidden sm:inline">Offline (Hạn ngạch Cloud)</span>
              </>
            ) : (
              <>
                <CloudCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden lg:inline">Cloud Live:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-300">
                  {usageStats.writes}/20k
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-200/80 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-extrabold hidden sm:inline">
                  {writePercent}%
                </span>
              </>
            )}
          </button>

          {/* Sync Quick Action Buttons */}
          {user && !isSyncing && (
             <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
               <button
                 onClick={pushToCloud}
                 className="flex items-center justify-center p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors"
                 title="Đẩy thay đổi lên Cloud ngay (Delta Push)"
               >
                 <UploadCloud className="w-4 h-4" />
               </button>
               <button
                 onClick={pullFromCloud}
                 className="flex items-center justify-center p-1.5 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/50 rounded-lg transition-colors"
                 title="Tải dữ liệu từ Cloud về"
               >
                 <DownloadCloud className="w-4 h-4" />
               </button>
             </div>
          )}

          {/* P1 Warning Alert Badge */}
          <button
            id="p1-warning-badge-btn"
            onClick={onOpenWarningCenter}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              p1WarningCount > 0
                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <ShieldAlert className={`w-4 h-4 ${p1WarningCount > 0 ? 'text-rose-600 dark:text-rose-400' : ''}`} />
            <span>Cảnh báo P1: {p1WarningCount}</span>
          </button>

          {/* User Role Switcher */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              id="role-teacher-btn"
              onClick={() => onRoleChange('Teacher')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                currentRole === 'Teacher'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
              title="Chuyển sang quyền Giáo viên chính"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Giáo viên</span>
            </button>
            <button
              id="role-ta-btn"
              onClick={() => onRoleChange('TA')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                currentRole === 'TA'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
              title="Chuyển sang quyền Trợ giảng (TA)"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Trợ giảng</span>
            </button>
          </div>

          {/* Theme Toggle Button */}
          <button
            id="theme-toggle-btn"
            onClick={onToggleTheme}
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800 rounded-xl transition-colors"
            title="Đổi giao diện Sáng / Tối"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Auth Button */}
          {!loading && (
            user ? (
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 p-2 px-3 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:text-rose-400 dark:bg-rose-950/50 dark:hover:bg-rose-900/50 rounded-xl transition-colors"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Đăng xuất</span>
              </button>
            ) : (
              <button
                onClick={signIn}
                className="flex items-center gap-1.5 p-2 px-3 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
                title="Đăng nhập Google"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden md:inline">Đăng nhập</span>
              </button>
            )
          )}
        </div>
      </div>
    </header>
  );
};
