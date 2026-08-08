import React, { useState, useEffect } from 'react';
import { AlertTriangle, HardDrive, CheckCircle2, ExternalLink, X } from 'lucide-react';

export const QuotaBanner: React.FC = () => {
  const [showQuotaWarning, setShowQuotaWarning] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkQuota = () => {
      if (sessionStorage.getItem('firestore_quota_exceeded') === 'true') {
        setShowQuotaWarning(true);
      }
    };

    checkQuota();
    const interval = setInterval(checkQuota, 2000);
    return () => clearInterval(interval);
  }, []);

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
            Đã đạt giới hạn ghi Firestore miễn phí trong ngày. Dữ liệu của bạn được lưu 100% trên bộ nhớ trình duyệt local. Hạn ngạch cloud sẽ tự động khôi phục vào ngày mai.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <a
          href="https://firebase.google.com/pricing#cloud-firestore"
          target="_blank"
          rel="noreferrer"
          className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:underline px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/50"
        >
          <span>Chi tiết bảng giá</span>
          <ExternalLink className="w-3 h-3" />
        </a>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-amber-200/60 dark:hover:bg-amber-900/60 rounded-lg text-amber-700 dark:text-amber-300 transition-colors"
          title="Đóng thông báo"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
