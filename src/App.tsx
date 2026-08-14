import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initializeDefaultSystemData } from './db/dexie';
import {
  UserRole,
  SchoolYear,
  ClassItem,
  Student,
  Warning,
  KnowledgeTag,
} from './types';
import { TabKey, Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { ClassManagement } from './components/ClassManagement';
import { GradeEntry } from './components/GradeEntry';
import { UltraFastGradeEntry } from './components/UltraFastGradeEntry';
import { WarningCenter } from './components/WarningCenter';
import { KnowledgeMap } from './components/KnowledgeMap';
import { StudentRoster } from './components/StudentRoster';
import { AuditAndReports } from './components/AuditAndReports';
import { SettingsModal } from './components/SettingsModal';
import { useFirestore } from './hooks/useFirestore';
import { useCloudSync } from './hooks/useCloudSync';
import { useAuth } from './lib/AuthContext';
import { Loader2 } from 'lucide-react';
import { QuotaBanner } from './components/QuotaBanner';
import { CloudSyncStatusModal } from './components/CloudSyncStatusModal';
import { sortStudentsByName } from './utils/sortUtils';

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);

  // App State
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem('smart_edu_user_role');
    return (saved === 'TA' || saved === 'Assistant') ? 'TA' : 'Teacher';
  });

  useEffect(() => {
    localStorage.setItem('smart_edu_user_role', currentRole);
  }, [currentRole]);

  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [searchQuery, setSearchQuery] = useState('');
  const [userApiKey, setUserApiKey] = useState('');

  const { user, loading: authLoading } = useAuth();
  const { isSyncing, syncStatus, pullFromCloud } = useCloudSync();

  // Cloud Sync Inspector Modal State
  const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState(false);

  // Selected Class ID for Grade Entry shortcut
  const [gradeEntryClassId, setGradeEntryClassId] = useState<string | undefined>(undefined);

  // Warning Resolution Modal State
  const [activeResolveWarning, setActiveResolveWarning] = useState<Warning | null>(null);

  // Initialize default system tables on load
  useEffect(() => {
    async function init() {
      try {
        await initializeDefaultSystemData();
      } catch (err) {
        console.error('Dexie system initialization error:', err);
      } finally {
        setIsInitializing(false);
      }
    }
    init();
  }, []);

  // Sync theme to root class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Dexie Live Queries
  const classes = useLiveQuery(() => db.classes.toArray()) || [];
  const rawStudents = useLiveQuery(() => db.students.toArray()) || [];
  const students = React.useMemo(() => sortStudentsByName(rawStudents), [rawStudents]);
  const warnings = useLiveQuery(() => db.warnings.toArray()) || [];
  const knowledgeTags = useLiveQuery(() => db.knowledge_tags.toArray()) || [];

  const p1Count = warnings.filter((w) => !w.resolved && w.priority === 'P1').length;

  const handleSelectClassForGradeEntry = (classId: string) => {
    setGradeEntryClassId(classId);
    setActiveTab('grade-entry');
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col items-center justify-center space-y-4 font-sans">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600 dark:text-emerald-500" />
        <h1 className="text-sm font-bold text-slate-700 dark:text-slate-200">Khởi tạo Smart Edu Manager...</h1>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors`}>
      <QuotaBanner />
      {/* Top Header */}
      <Header
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        p1WarningCount={p1Count}
        onOpenWarningCenter={() => setActiveTab('warnings')}
        onOpenCloudSyncModal={() => setIsCloudSyncModalOpen(true)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main Content Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col lg:flex-row gap-0">
        {/* Left Fixed Navigation Sidebar */}
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} p1Count={p1Count} />

        {/* Main View Area */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <Dashboard
              classes={classes}
              students={students}
              warnings={warnings}
              onNavigateTab={setActiveTab}
              onResolveWarning={(w) => {
                setActiveResolveWarning(w);
                setActiveTab('warnings');
              }}
              isLoadingData={isInitializing}
              isSyncing={isSyncing}
              syncStatus={syncStatus}
              onPullFromCloud={pullFromCloud}
              onInspectCloud={() => setIsCloudSyncModalOpen(true)}
            />
          )}

          {activeTab === 'classes' && (
            <ClassManagement
              classes={classes}
              selectedYearId=""
              currentRole={currentRole}
              onRefresh={() => {}}
              onSelectClassForGradeEntry={handleSelectClassForGradeEntry}
            />
          )}

          {activeTab === 'grade-entry' && (
            <UltraFastGradeEntry
              classes={classes}
              selectedClassId={gradeEntryClassId || classes[0]?.id}
              onSelectClassId={setGradeEntryClassId}
              onRefreshData={() => {}}
            />
          )}

          {activeTab === 'warnings' && (
            <WarningCenter
              warnings={warnings}
              students={students}
              classes={classes}
              onRefresh={() => {}}
            />
          )}

          {activeTab === 'knowledge-map' && (
            <KnowledgeMap
              students={students}
              knowledgeTags={knowledgeTags}
              userApiKey={userApiKey}
              currentRole={currentRole}
            />
          )}

          {activeTab === 'students' && (
            <StudentRoster
              students={students}
              classes={classes}
              currentRole={currentRole}
              onRefresh={() => {}}
              isLoadingData={isInitializing}
            />
          )}

          {activeTab === 'audit-reports' && (
            <AuditAndReports students={students} onRefresh={() => {}} />
          )}

          {activeTab === 'settings' && (
            <SettingsModal
              apiKey={userApiKey}
              onSaveApiKey={setUserApiKey}
              theme={theme}
              currentRole={currentRole}
              onToggleTheme={handleToggleTheme}
            />
          )}
        </main>
      </div>

      {/* Cloud Sync & Storage Inspection Modal */}
      <CloudSyncStatusModal
        isOpen={isCloudSyncModalOpen}
        onClose={() => setIsCloudSyncModalOpen(false)}
      />
    </div>
  );
}
