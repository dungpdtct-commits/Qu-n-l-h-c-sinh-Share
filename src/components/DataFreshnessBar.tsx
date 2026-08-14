import React, { useState, useEffect } from 'react';
import { RefreshCw, HardDrive, CheckCircle2, AlertCircle, Cloud, Clock, Gauge } from 'lucide-react';
import {
  isQuotaExceeded,
  isCloudSyncEnabled,
  getFirestoreUsage,
  FIRESTORE_FREE_LIMITS,
  FirestoreQuotaStats,
} from '../lib/firestoreUtils';

interface DataFreshnessBarProps {
  isSyncing?: boolean;
  syncStatus?: string | null;
  onPullFromCloud?: () => Promise<void> | void;
  onInspectCloud?: () => void;
  totalCount?: number;
  entityName?: string;
}

export const DataFreshnessBar: React.FC<DataFreshnessBarProps> = ({
  isSyncing = false,
  syncStatus,
  onPullFromCloud,
  onInspectCloud,
  totalCount,
  entityName = 'bản ghi',
}) => {
  const [lastCheckedTime, setLastCheckedTime] = useState<string>(() => {
    return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [usageStats, setUsageStats] = useState<FirestoreQuotaStats>(getFirestoreUsage());

  useEffect(() => {
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onPullFromCloud) {
        await onPullFromCloud();
      }
      setLastCheckedTime(
        new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    } catch (err) {
      console.warn('Refresh data failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const cloudEnabled = isCloudSyncEnabled() && !isQuotaExceeded();
  const writePercent = ((usageStats.writes / FIRESTORE_FREE_LIMITS.writes) * 100).toFixed(1);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Status Badge */}
        {isSyncing || isRefreshing ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold text-[11px] border border-blue-200 dark:border-blue-800 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
            <span>Đang tải dữ liệu từ Cloud...</span>
          </span>
        ) : cloudEnabled ? (
          <button
            onClick={onInspectCloud}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] border border-emerald-200/80 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
            title="Bấm để xem chi tiết đối soát & hạn mức sử dụng Cloud"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <span>Đồng bộ Thời Gian Thực (Cloud Live)</span>
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold text-[11px] border border-amber-200 dark:border-amber-800">
            <HardDrive className="w-3.5 h-3.5 text-amber-600" />
            <span>Dữ liệu Cục bộ (IndexedDB Offline)</span>
          </span>
        )}

        {/* Quota Indicator badge */}
        {cloudEnabled && onInspectCloud && (
          <button
            onClick={onInspectCloud}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 px-2 py-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
            title="Hạn mức ghi Cloud đã dùng hôm nay / Hạn mức miễn phí Firebase 20.000 lượt"
          >
            <Gauge className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Hạn mức: <strong className="text-emerald-700 dark:text-emerald-400">{usageStats.writes}</strong>/20.000 ({writePercent}%)</span>
          </button>
        )}

        {/* Timestamp */}
        <div className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 text-[11px]">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Lần kiểm tra gần nhất: <strong className="text-slate-700 dark:text-slate-300">{lastCheckedTime}</strong></span>
        </div>

        {/* Count string if available */}
        {typeof totalCount === 'number' && (
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
            Hiện có: <strong>{totalCount}</strong> {entityName}
          </span>
        )}
      </div>

      {/* Manual Refresh Button */}
      {onPullFromCloud && (
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || isSyncing}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-all flex items-center gap-1.5 text-xs shadow-xs disabled:opacity-50 cursor-pointer"
          title="Tải lại và cập nhật dữ liệu mới nhất từ Cloud"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
          <span>{isRefreshing ? 'Đang cập nhật...' : 'Cập nhật từ Cloud'}</span>
        </button>
      )}
    </div>
  );
};
