import React, { useState, useEffect } from 'react';
import { AlertTriangle, HardDrive, RefreshCw, ExternalLink, X } from 'lucide-react';
import { resetQuotaLock } from '../lib/firestoreUtils';

export const QuotaBanner: React.FC = () => {
  const [showQuotaWarning, setShowQuotaWarning] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const checkQuota = () => {
      if (sessionStorage.getItem('firestore_quota_exceeded') === 'true') {
        setShowQuotaWarning(true);
      } else {
        setShowQuotaWarning(false);
      }
    };

    checkQuota();
    const interval = setInterval(checkQuota, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleRetryConnection = async () => {
    setIsRetrying(true);
    await resetQuotaLock();
    setTimeout(() => {
      setIsRetrying(false);
      setShowQuotaWarning(false);
      window.location.reload();
    }, 600);
  };

  if (!showQuotaWarning || dismissed) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/80 border-b border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 px-4 py-2.5 text-xs font-medium transition-all shadow-sm flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div className="p-1.5 bg-amber-100 dark:bg-amber-900/60 rounded-lg text-amber-800 dark:text-amber-300 flex-shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="font-bold flex items-center gap-1.5 text-slate-900 dark:text-amber-100">
            <span>Thông báo Hạn ngạch Cloud (Firestore)</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
              <HardDrive className="w-3 h-3" /> Offline IndexedDB 100% An toàn
            </span>
          </div>
          <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 truncate">
            Tạm dừng gửi Firestore do đạt giới hạn trong ngày. Toàn bộ dữ liệu đang lưu an toàn tuyệt đối trên máy của bạn.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleRetryConnection}
          disabled={isRetrying}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-200/60 dark:hover:bg-emerald-900/60 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-700 transition-colors cursor-pointer"
          title="Mở khóa và thử kết nối lại Cloud ngay"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
          <span>{isRetrying ? 'Đang kết nối...' : 'Thử kết nối lại'}</span>
        </button>

        <a
          href="https://firebase.google.com/pricing#cloud-firestore"
          target="_blank"
          rel="noreferrer"
          className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:underline px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/50"
        >
          <span>Bảng giá</span>
          <ExternalLink className="w-3 h-3" />
        </a>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-amber-200/60 dark:hover:bg-amber-900/60 rounded-lg text-amber-700 dark:text-amber-300 transition-colors cursor-pointer"
          title="Đóng thông báo"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
