import React, { useState, useEffect } from 'react';
import { Settings, WarningThresholds, PronounConfig, WarningRuleConfig, SchoolYear } from '../types';
import { db, clearAllDataToBlankSlate, seedDemoData, deleteOnlyDemoTestData } from '../db/dexie';
import { doc, disableNetwork, enableNetwork } from 'firebase/firestore';
import { db as firestoreDb } from '../lib/firebase';
import { safeSetDoc, safeDeleteDoc } from '../lib/firestoreUtils';
import { UserRole } from '../types';
import {
  Settings as SettingsIcon,
  Key,
  Sliders,
  UserCheck,
  Save,
  CheckCircle2,
  Moon,
  Sun,
  Lock,
  AlertCircle,
  Trash2,
  Cloud,
  CloudOff,
  ShieldAlert,
  Database,
  Sparkles,
  Calendar,
  Plus,
  Check,
  Server,
} from 'lucide-react';

interface SettingsModalProps {
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  theme: 'light' | 'dark';
  currentRole?: UserRole;
  onToggleTheme: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  apiKey,
  onSaveApiKey,
  theme,
  currentRole = 'Teacher',
  onToggleTheme,
}) => {
  const isAdmin = currentRole === 'Teacher';
  const [inputApiKey, setInputApiKey] = useState(apiKey);
  const [teacherTitle, setTeacherTitle] = useState('Thầy');
  const [teacherName, setTeacherName] = useState('Nguyễn Văn Toán');
  const [studentPronoun, setStudentPronoun] = useState('Con');

  const [selectedProfile, setSelectedProfile] = useState<'standard' | 'specialized' | 'remedial'>('standard');
  const [profileConfigs, setProfileConfigs] = useState({
    standard: { maxAbsences: 2, consecutiveLowTests: 2, consecutiveLowHomework: 3, scoreDropThreshold: 2.0, minTestScore: 5.0, minHomeworkScore: 5.0 },
    specialized: { maxAbsences: 2, consecutiveLowTests: 2, consecutiveLowHomework: 3, scoreDropThreshold: 2.0, minTestScore: 7.0, minHomeworkScore: 7.0 },
    remedial: { maxAbsences: 2, consecutiveLowTests: 2, consecutiveLowHomework: 3, scoreDropThreshold: 2.0, minTestScore: 4.0, minHomeworkScore: 4.0 }
  });

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(
    localStorage.getItem('cloud_sync_enabled') !== 'false'
  );
  const [quotaExceeded, setQuotaExceeded] = useState(() => {
    const today = new Date().toDateString();
    return localStorage.getItem('firestore_quota_exceeded_date') === today || 
           sessionStorage.getItem('firestore_quota_exceeded') === 'true';
  });
  const [isWipingCloud, setIsWipingCloud] = useState(false);
  const [wipeCloudStatus, setWipeCloudStatus] = useState<string | null>(null);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);

  // Personal Firebase Cloud Sync states
  const [useCustomFirebase, setUseCustomFirebase] = useState(
    localStorage.getItem('use_custom_firebase') === 'true'
  );
  const [fbApiKey, setFbApiKey] = useState('');
  const [fbAuthDomain, setFbAuthDomain] = useState('');
  const [fbProjectId, setFbProjectId] = useState('');
  const [fbStorageBucket, setFbStorageBucket] = useState('');
  const [fbMessagingSenderId, setFbMessagingSenderId] = useState('');
  const [fbAppId, setFbAppId] = useState('');
  const [fbFirestoreDbId, setFbFirestoreDbId] = useState('');
  const [pastedJson, setPastedJson] = useState('');
  const [customFbSaveStatus, setCustomFbSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    const savedConfig = localStorage.getItem('custom_firebase_config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setFbApiKey(parsed.apiKey || '');
        setFbAuthDomain(parsed.authDomain || '');
        setFbProjectId(parsed.projectId || '');
        setFbStorageBucket(parsed.storageBucket || '');
        setFbMessagingSenderId(parsed.messagingSenderId || '');
        setFbAppId(parsed.appId || '');
        setFbFirestoreDbId(parsed.firestoreDatabaseId || '');
      } catch (e) {
        console.error('Error loading custom firebase config:', e);
      }
    }
  }, []);

  const handleParseJsonConfig = () => {
    if (!pastedJson.trim()) return;
    try {
      // Clean string if user pastes js object or json
      let cleanText = pastedJson.trim();
      if (!cleanText.startsWith('{')) {
        const match = cleanText.match(/\{[\s\S]*\}/);
        if (match) cleanText = match[0];
      }
      // Replace unquoted keys if JS object format
      cleanText = cleanText.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
      // Replace single quotes with double quotes
      cleanText = cleanText.replace(/'/g, '"');

      const parsed = JSON.parse(cleanText);
      if (parsed.apiKey) setFbApiKey(parsed.apiKey);
      if (parsed.authDomain) setFbAuthDomain(parsed.authDomain);
      if (parsed.projectId) setFbProjectId(parsed.projectId);
      if (parsed.storageBucket) setFbStorageBucket(parsed.storageBucket);
      if (parsed.messagingSenderId) setFbMessagingSenderId(parsed.messagingSenderId);
      if (parsed.appId) setFbAppId(parsed.appId);
      if (parsed.firestoreDatabaseId) setFbFirestoreDbId(parsed.firestoreDatabaseId);

      setCustomFbSaveStatus('✅ Trích xuất JSON thành công! Hãy bấm "Lưu Cấu Hình Firebase Cá Nhân".');
      setTimeout(() => setCustomFbSaveStatus(null), 4000);
    } catch (e) {
      setCustomFbSaveStatus('❌ Định dạng JSON không hợp lệ. Vui lòng kiểm tra lại!');
      setTimeout(() => setCustomFbSaveStatus(null), 4000);
    }
  };

  const handleSaveCustomFirebaseConfig = () => {
    const configObj = {
      apiKey: fbApiKey.trim(),
      authDomain: fbAuthDomain.trim(),
      projectId: fbProjectId.trim(),
      storageBucket: fbStorageBucket.trim(),
      messagingSenderId: fbMessagingSenderId.trim(),
      appId: fbAppId.trim(),
      firestoreDatabaseId: fbFirestoreDbId.trim() || undefined,
    };

    localStorage.setItem('custom_firebase_config', JSON.stringify(configObj));
    localStorage.setItem('use_custom_firebase', String(useCustomFirebase));

    setCustomFbSaveStatus('🎉 Đã lưu cấu hình Firebase cá nhân thành công! Vui lòng tải lại trang để áp dụng.');
    setTimeout(() => setCustomFbSaveStatus(null), 5000);
  };

  useEffect(() => {
    const msg = localStorage.getItem('demo_action_message');
    if (msg) {
      setDemoMessage(msg);
      localStorage.removeItem('demo_action_message');
      const timer = setTimeout(() => {
        setDemoMessage(null);
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleWipeCloudData = async () => {
    setIsWipingCloud(true);
    setWipeCloudStatus('Đang kết nối để dọn dẹp Đám mây...');
    try {
      if (firestoreDb) {
        const collectionsToClear = [
          'classes',
          'students',
          'class_students',
          'sessions',
          'student_sessions',
          'warnings',
          'ai_diagnoses',
          'knowledge_results'
        ];

        const { collection, getDocs, writeBatch } = await import('firebase/firestore');

        let successCount = 0;
        let quotaIssue = false;

        for (const colName of collectionsToClear) {
          try {
            const colRef = collection(firestoreDb, colName);
            const snapshot = await getDocs(colRef);
            if (!snapshot.empty) {
              const batch = writeBatch(firestoreDb);
              snapshot.docs.forEach((docSnap) => {
                batch.delete(docSnap.ref);
              });
              await batch.commit();
            }
            successCount++;
          } catch (colErr: any) {
            console.warn(`[Wipe Cloud] Clear error for ${colName}:`, colErr);
            if (colErr?.code === 'resource-exhausted' || colErr?.message?.includes('quota') || colErr?.message?.includes('exceeded')) {
              quotaIssue = true;
            }
          }
        }

        if (quotaIssue) {
          setWipeCloudStatus('Lỗi: Hôm nay đã hết hạn ngạch (quota) ghi/xóa miễn phí của Firestore. Vui lòng quay lại nhấn nút này vào NGÀY MAI!');
        } else if (successCount === collectionsToClear.length) {
          setWipeCloudStatus('Thành công: Đã xoá sạch 100% dữ liệu cũ trên Firestore Cloud! Thầy cô có thể bật Đồng bộ ngay bây giờ.');
        } else {
          setWipeCloudStatus('Đã dọn dẹp xong phần dữ liệu có thể truy cập.');
        }
      } else {
        setWipeCloudStatus('Lỗi: Chưa cấu hình kết nối đám mây Firestore.');
      }
    } catch (err: any) {
      console.error('[Wipe Cloud] Error:', err);
      setWipeCloudStatus('Có lỗi xảy ra khi dọn dẹp Đám mây: ' + (err?.message || 'Lỗi mạng'));
    } finally {
      setIsWipingCloud(false);
    }
  };

  useEffect(() => {
    db.settings.toArray().then((sList) => {
      if (sList.length > 0) {
        const s = sList[0];
        if (s.gemini_api_key) setInputApiKey(s.gemini_api_key);
        if (s.pronoun_config) {
          setTeacherTitle(s.pronoun_config.teacher_title);
          setTeacherName(s.pronoun_config.teacher_name);
          setStudentPronoun(s.pronoun_config.student_pronoun);
        }
        
        // Restore profile configs if present, otherwise fallback to warning_rule_config
        const newProfiles = { ...profileConfigs };
        const defaultBase = s.warning_rule_config || {
          maxAbsences: 2, consecutiveLowTests: 2, consecutiveLowHomework: 3, scoreDropThreshold: 2.0, minTestScore: 5.0, minHomeworkScore: 5.0
        } as WarningRuleConfig;

        if (s.class_profile_configs) {
          if (s.class_profile_configs.standard) {
             newProfiles.standard = { 
               maxAbsences: s.class_profile_configs.standard.maxAbsences,
               consecutiveLowTests: s.class_profile_configs.standard.consecutiveLowTests,
               consecutiveLowHomework: s.class_profile_configs.standard.consecutiveLowHomework,
               scoreDropThreshold: s.class_profile_configs.standard.scoreDropThreshold,
               minTestScore: s.class_profile_configs.standard.minTestScore ?? 5.0,
               minHomeworkScore: s.class_profile_configs.standard.minHomeworkScore ?? 5.0
             };
          }
          if (s.class_profile_configs.specialized) {
             newProfiles.specialized = { 
               maxAbsences: s.class_profile_configs.specialized.maxAbsences,
               consecutiveLowTests: s.class_profile_configs.specialized.consecutiveLowTests,
               consecutiveLowHomework: s.class_profile_configs.specialized.consecutiveLowHomework,
               scoreDropThreshold: s.class_profile_configs.specialized.scoreDropThreshold,
               minTestScore: s.class_profile_configs.specialized.minTestScore ?? 7.0,
               minHomeworkScore: s.class_profile_configs.specialized.minHomeworkScore ?? 7.0
             };
          }
          if (s.class_profile_configs.remedial) {
             newProfiles.remedial = { 
               maxAbsences: s.class_profile_configs.remedial.maxAbsences,
               consecutiveLowTests: s.class_profile_configs.remedial.consecutiveLowTests,
               consecutiveLowHomework: s.class_profile_configs.remedial.consecutiveLowHomework,
               scoreDropThreshold: s.class_profile_configs.remedial.scoreDropThreshold,
               minTestScore: s.class_profile_configs.remedial.minTestScore ?? 4.0,
               minHomeworkScore: s.class_profile_configs.remedial.minHomeworkScore ?? 4.0
             };
          }
        } else {
          // Backward compat
          newProfiles.standard = {
            maxAbsences: defaultBase.maxAbsences,
            consecutiveLowTests: defaultBase.consecutiveLowTests,
            consecutiveLowHomework: defaultBase.consecutiveLowHomework,
            scoreDropThreshold: defaultBase.scoreDropThreshold,
            minTestScore: defaultBase.minTestScore ?? 5.0,
            minHomeworkScore: defaultBase.minHomeworkScore ?? 5.0,
          };
          newProfiles.specialized = { ...newProfiles.standard, minTestScore: 7.0, minHomeworkScore: 7.0 };
          newProfiles.remedial = { ...newProfiles.standard, minTestScore: 4.0, minHomeworkScore: 4.0 };
        }
        setProfileConfigs(newProfiles);
      }
    });
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    onSaveApiKey(inputApiKey);

    const sList = await db.settings.toArray();
    const now = new Date().toISOString();

    let currentWarningConfig = sList.length > 0 && sList[0].warning_rule_config 
      ? sList[0].warning_rule_config 
      : {
          minTestScore: 5.0,
          consecutiveLowTests: 2,
          maxAbsences: 2,
          minHomeworkScore: 5.0,
          consecutiveLowHomework: 3,
          scoreDropThreshold: 2.0,
          excellentTestScore: 9.0,
          progressIncreaseThreshold: 1.5,
          enablePraiseAttendanceHw: true,
      };
      
    // Update the base config with standard profile values to ensure compatibility
    currentWarningConfig = {
      ...currentWarningConfig,
      maxAbsences: profileConfigs.standard.maxAbsences,
      consecutiveLowTests: profileConfigs.standard.consecutiveLowTests,
      consecutiveLowHomework: profileConfigs.standard.consecutiveLowHomework,
      scoreDropThreshold: profileConfigs.standard.scoreDropThreshold,
    };
    
    // Construct the full profile configs by merging with base
    const fullProfileConfigs = {
      standard: { ...currentWarningConfig, ...profileConfigs.standard },
      specialized: { ...currentWarningConfig, ...profileConfigs.specialized },
      remedial: { ...currentWarningConfig, ...profileConfigs.remedial },
    };

    const newSetting: Settings = {
      gemini_api_key: inputApiKey,
      warning_rule_config: currentWarningConfig,
      class_profile_configs: fullProfileConfigs,
      pronoun_config: {
        teacher_title: teacherTitle,
        teacher_name: teacherName,
        student_pronoun: studentPronoun,
      },
      theme: theme,
      updated_at: now,
    };

    let settingId = sList.length > 0 ? sList[0].id : undefined;
    if (settingId) {
      await db.settings.update(settingId, newSetting);
    } else {
      settingId = await db.settings.add(newSetting);
    }

    if (firestoreDb && settingId) {
      await safeSetDoc(doc(firestoreDb, 'settings', String(settingId)), {
        ...newSetting,
        id: settingId
      }, { merge: true });
    }

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div id="settings-view" className="space-y-6">
      {demoMessage === 'seed_success' && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-4 rounded-2xl flex items-start gap-3 shadow-sm animate-fadeIn">
          <div className="p-1.5 bg-emerald-500 rounded-lg text-white shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-100">
              Nạp dữ liệu mẫu thử nghiệm thành công!
            </h4>
            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5 leading-relaxed">
              Hệ thống đã tự động bổ sung các lớp học mẫu (<strong>9A1, 9B2, 8A2</strong>), phân phối chương trình môn Toán, danh sách học sinh mẫu cùng các nhận xét và cảnh báo mẫu tương ứng. <span className="underline decoration-dotted font-semibold">Bảo toàn dữ liệu:</span> Toàn bộ các dữ liệu thật do thầy cô tự nhập trước đó đều được <strong>giữ nguyên vẹn 100%</strong>.
            </p>
          </div>
          <button onClick={() => setDemoMessage(null)} className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 ml-auto text-xs font-bold shrink-0 p-1">✕</button>
        </div>
      )}

      {demoMessage === 'delete_success' && (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 p-4 rounded-2xl flex items-start gap-3 shadow-sm animate-fadeIn">
          <div className="p-1.5 bg-rose-500 rounded-lg text-white shrink-0">
            <Trash2 className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold text-rose-900 dark:text-rose-100">
              Đã xóa dữ liệu thử nghiệm thành công!
            </h4>
            <p className="text-[11px] text-rose-800 dark:text-rose-300 mt-0.5 leading-relaxed">
              Đã gỡ bỏ sạch sẽ toàn bộ các lớp học mẫu (9A1, 9B2, 8A2), danh sách học sinh mẫu, điểm số mẫu và các cảnh báo học tập tương ứng. <span className="underline decoration-dotted font-semibold">An tâm tuyệt đối:</span> Tất cả dữ liệu thực tế do thầy cô tự tạo trước đó đều được <strong>bảo toàn nguyên vẹn 100%</strong> và không bị ảnh hưởng.
            </p>
          </div>
          <button onClick={() => setDemoMessage(null)} className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 ml-auto text-xs font-bold shrink-0 p-1">✕</button>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Cài Đặt Cấu Hình Hệ Thống
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý Gemini API Key, ngưỡng cảnh báo tự động P1/P2 và danh xưng Thầy/Cô.
          </p>
        </div>

        <button
          onClick={onToggleTheme}
          className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 border border-slate-200 dark:border-slate-700"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          <span>Giao diện: {theme === 'dark' ? 'Tối (Dark)' : 'Sáng (Light)'}</span>
        </button>
      </div>

      {!isAdmin && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-medium flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Bạn đang xem với quyền <strong>Trợ giảng (Assistant)</strong>. Chỉ Admin (Giáo viên chính) mới được phép thay đổi cài đặt hệ thống.</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Lưu cấu hình hệ thống thành công!</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Gemini API Key */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Cấu Hình Gemini API Key (AI Diagnostic)
            </h3>
          </div>

          <p className="text-xs text-slate-500">
            API Key dùng để kích hoạt tính năng Gemini 1.5 Flash chẩn đoán học tập thông minh và viết tóm tắt Zalo Phụ huynh.
          </p>

          <input
            type="password"
            value={inputApiKey}
            onChange={(e) => setInputApiKey(e.target.value)}
            placeholder="Nhập Gemini API Key của bạn..."
            className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl outline-none focus:border-emerald-500"
          />
        </div>

        {/* Warning Thresholds */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Ngưỡng Cảnh Báo (Warning Engine)
              </h3>
            </div>
            
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSelectedProfile('standard')}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  selectedProfile === 'standard' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
                }`}
              >
                Tiêu chuẩn
              </button>
              <button
                type="button"
                onClick={() => setSelectedProfile('specialized')}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  selectedProfile === 'specialized' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
                }`}
              >
                Lớp Chuyên
              </button>
              <button
                type="button"
                onClick={() => setSelectedProfile('remedial')}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  selectedProfile === 'remedial' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
                }`}
              >
                Phụ đạo
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Ngưỡng Vắng Không Phép (Số buổi)
              </label>
              <input
                type="number"
                min="1"
                max="5"
                value={profileConfigs[selectedProfile].maxAbsences}
                onChange={(e) => setProfileConfigs(prev => ({
                  ...prev,
                  [selectedProfile]: { ...prev[selectedProfile], maxAbsences: Number(e.target.value) }
                }))}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl outline-none focus:border-emerald-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Kích hoạt Cảnh báo P1 khi đạt ngưỡng.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Ngưỡng Điểm Bài Kiểm Tra (&lt; Đ)
              </label>
              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={profileConfigs[selectedProfile].minTestScore}
                onChange={(e) => setProfileConfigs(prev => ({
                  ...prev,
                  [selectedProfile]: { ...prev[selectedProfile], minTestScore: Number(e.target.value) }
                }))}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl outline-none focus:border-emerald-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Bài thi dưới ngưỡng này được coi là kém.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Ngưỡng Điểm BTVN (&lt; Đ)
              </label>
              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={profileConfigs[selectedProfile].minHomeworkScore}
                onChange={(e) => setProfileConfigs(prev => ({
                  ...prev,
                  [selectedProfile]: { ...prev[selectedProfile], minHomeworkScore: Number(e.target.value) }
                }))}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl outline-none focus:border-emerald-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Điểm BTVN dưới ngưỡng này được coi là kém.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Chuỗi Bài Kiểm Tra Điểm Yếu (Số buổi)
              </label>
              <input
                type="number"
                min="1"
                max="5"
                value={profileConfigs[selectedProfile].consecutiveLowTests}
                onChange={(e) => setProfileConfigs(prev => ({
                  ...prev,
                  [selectedProfile]: { ...prev[selectedProfile], consecutiveLowTests: Number(e.target.value) }
                }))}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl outline-none focus:border-emerald-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Kích hoạt Cảnh báo P1 khi điểm thấp liên tiếp.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Ngưỡng Thiếu BTVN (Số buổi)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={profileConfigs[selectedProfile].consecutiveLowHomework}
                onChange={(e) => setProfileConfigs(prev => ({
                  ...prev,
                  [selectedProfile]: { ...prev[selectedProfile], consecutiveLowHomework: Number(e.target.value) }
                }))}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl outline-none focus:border-emerald-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Kích hoạt Cảnh báo P1 khi thiếu bài liên tiếp.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Ngưỡng Sụt Giảm Điểm P2 (Đ)
              </label>
              <input
                type="number"
                min="0.5"
                max="5.0"
                step="0.5"
                value={profileConfigs[selectedProfile].scoreDropThreshold}
                onChange={(e) => setProfileConfigs(prev => ({
                  ...prev,
                  [selectedProfile]: { ...prev[selectedProfile], scoreDropThreshold: Number(e.target.value) }
                }))}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl outline-none focus:border-emerald-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Cảnh báo P2 nếu điểm giảm sâu so với TB.
              </p>
            </div>
          </div>
        </div>

        {/* Pronoun & Title Settings */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Xưng Hô & Tên Giáo Viên Cho Báo Cáo
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Xưng Hô Giáo Viên
              </label>
              <select
                value={teacherTitle}
                onChange={(e) => setTeacherTitle(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl outline-none"
              >
                <option value="Thầy">Thầy</option>
                <option value="Cô">Cô</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Họ và Tên Giáo Viên Chính
              </label>
              <input
                type="text"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Gọi Học Sinh Trong Báo Cáo
              </label>
              <select
                value={studentPronoun}
                onChange={(e) => setStudentPronoun(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl outline-none"
              >
                <option value="Con">Con (Ví dụ: "Con Nguyễn Minh Anh")</option>
                <option value="Em">Em (Ví dụ: "Em Nguyễn Minh Anh")</option>
              </select>
            </div>
          </div>
        </div>

        {/* Cloud Sync Config */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Đồng Bộ Đám Mây & Chế Độ Hoạt Động (Cloud Sync)
            </h3>
          </div>

          <p className="text-xs text-slate-500">
            Tính năng đồng bộ tự động lên máy chủ lưu trữ Cloud (Firestore) giúp bảo vệ dữ liệu và đồng bộ tức thời giữa máy tính và điện thoại của giáo viên / trợ giảng.
          </p>

          <div className="flex flex-col md:flex-row md:items-center justify-between bg-slate-50 dark:bg-slate-800 p-5 rounded-xl border border-slate-100 dark:border-slate-700 gap-4">
            <div className="space-y-1.5 flex-1 pr-0 md:pr-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Trạng thái Đồng Bộ Đám Mây:
                </span>
                {quotaExceeded ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    Offline (Tự động chuyển do Hết Hạn Ngạch)
                  </span>
                ) : cloudSyncEnabled ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    BẬT (Đang kết nối Đám Mây)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    TẮT (Chạy Offline Trắng)
                  </span>
                )}
              </div>
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {quotaExceeded ? (
                  <>
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">Cảnh báo:</span> Hôm nay hệ thống Cloud đã hết hạn ngạch (quota) ghi/xóa miễn phí của Google Firestore. Ứng dụng đã tự động chuyển sang chế độ <strong>Chạy Offline</strong> để bảo vệ dữ liệu. Mọi điểm số thầy cô nhập vẫn được lưu trữ cực kỳ an toàn trên máy này. Đám mây sẽ hoạt động trở lại vào ngày mai!
                  </>
                ) : cloudSyncEnabled ? (
                  "Mọi hoạt động, lớp học, điểm số, và cảnh báo học tập sẽ được tự động đồng bộ tức thời hai chiều lên đám mây Cloud Firestore, giúp lưu trữ an toàn và cho phép đăng nhập trên nhiều thiết bị."
                ) : (
                  "Thầy cô đang chạy ở chế độ Offline Trắng. Toàn bộ dữ liệu nằm 100% trên thiết bị cá nhân của thầy cô và không kết nối Internet. Phù hợp khi muốn dùng cơ sở dữ liệu hoàn toàn sạch, mới."
                )}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                const newValue = !cloudSyncEnabled;
                localStorage.setItem('cloud_sync_enabled', String(newValue));
                setCloudSyncEnabled(newValue);
                
                if (firestoreDb) {
                  if (newValue) {
                    enableNetwork(firestoreDb)
                      .then(() => {
                        console.log('[Firestore Sync] Activated network connection.');
                        // Attempt to reset quota visual if they try to re-enable
                        sessionStorage.removeItem('firestore_quota_exceeded');
                        setQuotaExceeded(false);
                      })
                      .catch((err) => console.warn('[Firestore Sync] Failed to enable network:', err));
                  } else {
                    disableNetwork(firestoreDb)
                      .then(() => console.log('[Firestore Sync] Deactivated network connection (Strict Offline Mode).'))
                      .catch((err) => console.warn('[Firestore Sync] Failed to disable network:', err));
                  }
                }
              }}
              className={`px-4 py-2.5 text-xs font-bold rounded-xl shadow-sm transition-all whitespace-nowrap shrink-0 flex items-center gap-2 border ${
                quotaExceeded
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:hover:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/40'
                  : cloudSyncEnabled
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
              }`}
            >
              {quotaExceeded ? (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Hạn Ngạch Quá Tải</span>
                </>
              ) : cloudSyncEnabled ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Đồng Bộ: BẬT</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-slate-500" />
                  <span>Đồng Bộ: TẮT</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-rose-50/50 dark:bg-rose-950/10 p-4 rounded-xl border border-rose-100 dark:border-rose-900/30 space-y-3">
            <div>
              <span className="block text-xs font-bold text-rose-800 dark:text-rose-300">
                Xóa sạch dữ liệu trên Cloud (Wipe Cloud Firestore)
              </span>
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Nút này cho phép dọn dẹp và xóa sạch các bảng dữ liệu cũ trên Firestore Cloud. Hữu ích khi thầy cô muốn xoá dữ liệu cũ trên Cloud sau khi hạn ngạch reset vào ngày mai để tránh dữ liệu cũ bị đồng bộ kéo ngược về.
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <button
                type="button"
                disabled={isWipingCloud}
                onClick={handleWipeCloudData}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                {isWipingCloud ? 'Đang dọn dẹp...' : 'Dọn Sạch Dữ Liệu Đám Mây'}
              </button>

              {wipeCloudStatus && (
                <span className={`text-[11px] font-semibold ${
                  wipeCloudStatus.startsWith('Thành công') 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : wipeCloudStatus.startsWith('Lỗi') 
                      ? 'text-rose-600 dark:text-rose-400' 
                      : 'text-slate-600 dark:text-slate-400'
                }`}>
                  {wipeCloudStatus}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Personal Firebase Cloud Configuration */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Đồng Bộ Đám Mây Cá Nhân (Personal Firebase Sync)
              </h3>
            </div>
            
            <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Dùng Firebase Cá Nhân:</span>
              <button
                type="button"
                onClick={() => {
                  const newVal = !useCustomFirebase;
                  setUseCustomFirebase(newVal);
                  localStorage.setItem('use_custom_firebase', String(newVal));
                }}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  useCustomFirebase ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    useCustomFirebase ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Cho phép từng giáo viên kết nối trực tiếp với dự án <strong>Firebase Cloud Firestore</strong> riêng của mình (hoàn toàn miễn phí trên Google Firebase Console) để sao lưu và tự động đồng bộ dữ liệu độc lập giữa các máy tính, không chung dữ liệu với bất kỳ ai.
          </p>

          {/* Quick Paste JSON */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
              💡 Dán nhanh SDK Firebase Config (Dạng JSON hoặc Object từ Firebase Console):
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <textarea
                rows={2}
                value={pastedJson}
                onChange={(e) => setPastedJson(e.target.value)}
                placeholder='{ "apiKey": "AIzaSy...", "authDomain": "my-app.firebaseapp.com", "projectId": "my-app-123", ... }'
                className="flex-1 text-[11px] font-mono p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleParseJsonConfig}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg text-xs font-bold shrink-0 self-end sm:self-center"
              >
                Trích Xuất
              </button>
            </div>
          </div>

          {/* Manual Input Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                API Key (apiKey)
              </label>
              <input
                type="text"
                value={fbApiKey}
                onChange={(e) => setFbApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Project ID (projectId)
              </label>
              <input
                type="text"
                value={fbProjectId}
                onChange={(e) => setFbProjectId(e.target.value)}
                placeholder="my-math-app-123"
                className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Auth Domain (authDomain)
              </label>
              <input
                type="text"
                value={fbAuthDomain}
                onChange={(e) => setFbAuthDomain(e.target.value)}
                placeholder="my-math-app-123.firebaseapp.com"
                className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                App ID (appId)
              </label>
              <input
                type="text"
                value={fbAppId}
                onChange={(e) => setFbAppId(e.target.value)}
                placeholder="1:123456789:web:abcdef..."
                className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleSaveCustomFirebaseConfig}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              Lưu Cấu Hình Firebase Cá Nhân
            </button>

            {customFbSaveStatus && (
              <span className={`text-xs font-bold ${
                customFbSaveStatus.startsWith('🎉') || customFbSaveStatus.startsWith('✅')
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}>
                {customFbSaveStatus}
              </span>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!isAdmin}
            className={`px-6 py-3 rounded-xl font-bold text-xs shadow-md flex items-center gap-2 ${
              isAdmin
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            {isAdmin ? <Save className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            <span>{isAdmin ? 'Lưu Tất Cả Cài Đặt' : 'Bị Khóa (Quyền Trợ Giảng)'}</span>
          </button>
        </div>
      </form>

      {/* Seed Demo Data Section */}
      <div className="bg-emerald-50 dark:bg-emerald-950/20 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
            Dữ Liệu Thử Nghiệm (Demo Data)
          </h3>
        </div>

        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          Nếu thầy cô đang thử nghiệm ứng dụng và muốn trải nghiệm đầy đủ các tính năng nhanh chóng, thầy cô có thể nhấn nút để nạp tự động danh sách lớp học mẫu (9A1, 9B2, 8A2), học sinh mẫu, phân phối chương trình môn Toán, điểm số kiểm tra, và các cảnh báo học tập tương ứng.
          <br />
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Ưu điểm:</span> Hệ thống nạp dữ liệu thông minh sẽ <strong>giữ nguyên vẹn tất cả dữ liệu thật do thầy cô tự tạo</strong> trước đó, chỉ ghi đè dữ liệu mẫu cũ.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!isAdmin}
            onClick={async () => {
              if (window.confirm("Thầy cô có chắc chắn muốn nạp dữ liệu mẫu? Hệ thống sẽ cập nhật dữ liệu mẫu thử nghiệm. Các dữ liệu do thầy cô tự tạo trước đó sẽ được GIỮ NGUYÊN HOÀN TOÀN.")) {
                try {
                  localStorage.setItem('demo_action_message', 'seed_success');
                  await seedDemoData();
                  window.location.reload();
                } catch (err) {
                  console.error("Failed to seed demo data:", err);
                  localStorage.removeItem('demo_action_message');
                  alert("Đã xảy ra lỗi khi nạp dữ liệu mẫu.");
                }
              }
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Nạp Dữ Liệu Mẫu
          </button>

          <button
            type="button"
            disabled={!isAdmin}
            onClick={async () => {
              if (window.confirm("Thầy cô có chắc chắn muốn xóa toàn bộ dữ liệu mẫu thử nghiệm? Toàn bộ các dữ liệu thật do thầy cô tự tạo trước đó sẽ được GIỮ LẠI NGUYÊN VẸN, không bị ảnh hưởng.")) {
                try {
                  localStorage.setItem('demo_action_message', 'delete_success');
                  await deleteOnlyDemoTestData();
                  window.location.reload();
                } catch (err) {
                  console.error("Failed to delete demo data:", err);
                  localStorage.removeItem('demo_action_message');
                  alert("Đã xảy ra lỗi khi xóa dữ liệu thử nghiệm.");
                }
              }
            }}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs rounded-xl shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5 border border-slate-300 dark:border-slate-700"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            Xóa Dữ Liệu Thử Nghiệm
          </button>
        </div>
      </div>

      {/* Reset Database to Blank Slate */}
      <div className="bg-rose-50 dark:bg-rose-950/20 p-5 rounded-2xl border border-rose-200 dark:border-rose-900/50 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          <h3 className="text-sm font-bold text-rose-900 dark:text-rose-100">
            Khởi Tạo Hệ Thống Sạch (Chuyển đổi sang App Trắng)
          </h3>
        </div>

        <p className="text-xs text-rose-700 dark:text-rose-300">
          Hành động này sẽ xóa vĩnh viễn toàn bộ dữ liệu chạy thử mẫu hiện tại bao gồm: <strong>Lớp học, danh sách học sinh, lịch sử các buổi học, điểm danh, điểm số, nhận xét và cảnh báo</strong>. 
          Hệ thống sẽ giữ lại danh mục chuyên đề kiến thức Toán THCS (Đại số, Hình học) để thầy cô có thể bắt đầu sử dụng ngay mà không cần cấu hình lại từ đầu.
        </p>

        {!showResetConfirm ? (
          <button
            type="button"
            disabled={!isAdmin}
            onClick={() => setShowResetConfirm(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors disabled:opacity-50"
          >
            Chuyển đổi sang App Trắng
          </button>
        ) : (
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-rose-200 dark:border-rose-900 shadow-inner space-y-3">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Xác nhận hành động xóa: Nhập chính xác từ <span className="text-rose-600 font-extrabold">"XÓA"</span> vào ô dưới đây để xác nhận:
            </p>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="XÓA"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                className="px-3 py-2 text-xs border border-rose-300 dark:border-rose-800 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-rose-500 max-w-[120px]"
              />
              
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={resetConfirmText !== 'XÓA' || isResetting}
                  onClick={async () => {
                    setIsResetting(true);
                    try {
                      await clearAllDataToBlankSlate();
                      window.location.reload();
                    } catch (err) {
                      console.error('Failed to reset db:', err);
                      setIsResetting(false);
                    }
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors disabled:opacity-30 flex items-center gap-1"
                >
                  {isResetting ? 'Đang thực hiện...' : 'Xác Nhận Xóa Hết'}
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setShowResetConfirm(false);
                    setResetConfirmText('');
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
