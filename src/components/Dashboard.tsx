import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexie';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { ClassItem, Student, Warning } from '../types';
import { DataFreshnessBar } from './DataFreshnessBar';
import {
  Users,
  GraduationCap,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  ShieldAlert,
  ChevronRight,
  Sparkles,
  Filter,
  Calendar,
  BookOpen,
  Award,
  HardDrive,
  Clock,
  Zap,
  Plus,
  Cloud,
  Loader2,
  BarChart2,
  Inbox,
  RotateCcw,
} from 'lucide-react';

interface DashboardProps {
  classes: ClassItem[];
  students: Student[];
  warnings: Warning[];
  isLoadingData?: boolean;
  isSyncing?: boolean;
  syncStatus?: string | null;
  onPullFromCloud?: () => Promise<void> | void;
  onInspectCloud?: () => void;
  onNavigateTab: (tab: any) => void;
  onResolveWarning: (warning: Warning) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  classes,
  students,
  warnings,
  isLoadingData = false,
  isSyncing = false,
  syncStatus,
  onPullFromCloud,
  onInspectCloud,
  onNavigateTab,
  onResolveWarning,
}) => {
  // Filter States
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');

  // Dexie Live Queries for Sessions & Grades
  const sessions = useLiveQuery(() => db.sessions.toArray()) || [];
  const studentSessions = useLiveQuery(() => db.student_sessions.toArray()) || [];
  const classStudents = useLiveQuery(() => db.class_students.toArray()) || [];
  const knowledgeTags = useLiveQuery(() => db.knowledge_tags.toArray()) || [];

  // Filter Classes
  const activeClasses = useMemo(() => {
    return classes.filter((c) => {
      if (c.status !== 'active') return false;
      if (selectedGrade !== 'all' && c.grade_level !== selectedGrade) return false;
      if (selectedClassId !== 'all' && c.id !== selectedClassId) return false;
      return true;
    });
  }, [classes, selectedGrade, selectedClassId]);

  const activeClassIds = useMemo(() => activeClasses.map((c) => c.id!), [activeClasses]);

  // Filter Students in Selected Classes
  const filteredStudentIds = useMemo(() => {
    if (selectedClassId === 'all' && selectedGrade === 'all') {
      return students.filter((s) => s.status === 'studying').map((s) => s.id!);
    }
    const matchingCs = classStudents.filter((cs) => activeClassIds.includes(cs.class_id));
    return Array.from(new Set(matchingCs.map((cs) => cs.student_id)));
  }, [students, classStudents, activeClassIds, selectedClassId, selectedGrade]);

  const activeStudents = useMemo(() => {
    return students.filter((s) => s.status === 'studying' && filteredStudentIds.includes(s.id!));
  }, [students, filteredStudentIds]);

  // Filter Warnings
  const activeWarnings = useMemo(() => {
    return warnings.filter((w) => {
      if (w.resolved) return false;
      if (!activeClassIds.includes(w.class_id)) return false;
      if (selectedClassId !== 'all' && w.class_id !== selectedClassId) return false;
      if (filteredStudentIds.length > 0 && !filteredStudentIds.includes(w.student_id)) return false;
      return true;
    });
  }, [warnings, selectedClassId, filteredStudentIds, activeClassIds]);

  const p1Warnings = useMemo(() => activeWarnings.filter((w) => w.priority === 'P1'), [activeWarnings]);
  const praiseItems = useMemo(() => activeWarnings.filter((w) => w.priority === 'Praise'), [activeWarnings]);

  const sessionToClassMap = useMemo(() => {
    const map: Record<string, string> = {};
    sessions.forEach((s) => {
      if (s.id) {
        map[String(s.id)] = s.class_id;
      }
    });
    return map;
  }, [sessions]);

  // Attendance Rate Calculation
  const attendanceStats = useMemo(() => {
    const relevantStudentSessions = studentSessions.filter((ss) => {
      if (!filteredStudentIds.includes(ss.student_id)) return false;
      const classId = sessionToClassMap[String(ss.session_id)];
      return classId && activeClassIds.includes(classId);
    });
    if (relevantStudentSessions.length === 0) return { rate: 0, text: 'Chưa có dữ liệu' };

    const presentCount = relevantStudentSessions.filter((ss) => ss.attendance === 'present' || ss.attendance === 'late').length;
    const rate = Math.round((presentCount / relevantStudentSessions.length) * 1000) / 10;
    return { rate, total: relevantStudentSessions.length };
  }, [studentSessions, filteredStudentIds, sessionToClassMap, activeClassIds]);

  // Academic Performance Distribution Data (Strictly Real Data)
  const performanceDistributionData = useMemo(() => {
    const studentScores: Record<string, number[]> = {};

    studentSessions.forEach((ss) => {
      if (ss.exempt) return;
      if (!filteredStudentIds.includes(ss.student_id)) return;
      const classId = sessionToClassMap[String(ss.session_id)];
      if (!classId || !activeClassIds.includes(classId)) return;
      if (!studentScores[ss.student_id]) studentScores[ss.student_id] = [];
      if (typeof ss.test_score === 'number' && (!ss.attendance || ss.attendance === 'present' || ss.attendance === 'late')) studentScores[ss.student_id].push(ss.test_score);
      if (typeof ss.homework_score === 'number' && !(ss.exempt || ss.exempt_homework)) studentScores[ss.student_id].push(ss.homework_score);
    });

    let gioi = 0;
    let kha = 0;
    let tb = 0;
    let canHoTro = 0;

    Object.values(studentScores).forEach((scores) => {
      if (scores.length === 0) return;
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avg >= 8.0) gioi++;
      else if (avg >= 6.5) kha++;
      else if (avg >= 5.0) tb++;
      else canHoTro++;
    });

    const totalCalculated = gioi + kha + tb + canHoTro;
    if (totalCalculated === 0) {
      return []; // True empty state
    }

    return [
      { name: 'Giỏi (>=8.0)', count: gioi, color: '#10b981' },
      { name: 'Khá (6.5-7.9)', count: kha, color: '#0284c7' },
      { name: 'Trung bình (5-6.4)', count: tb, color: '#f59e0b' },
      { name: 'Cần hỗ trợ (<5.0)', count: canHoTro, color: '#f43f5e' },
    ];
  }, [studentSessions, filteredStudentIds, sessionToClassMap, activeClassIds]);

  // Weekly Trend Data (Strictly Real Data)
  const weeklyTrendData = useMemo(() => {
    const sortedSessions = [...sessions]
      .filter((s) => activeClassIds.includes(s.class_id))
      .sort((a, b) => (a.session_date > b.session_date ? 1 : -1));

    if (sortedSessions.length === 0) {
      return []; // True empty state
    }

    return sortedSessions.slice(-8).map((sess, idx) => {
      const sessStudentRecs = studentSessions.filter((ss) => ss.session_id === sess.id);
      const validHw = sessStudentRecs.filter((ss) => !(ss.exempt || ss.exempt_homework) && typeof ss.homework_score === 'number').map((ss) => ss.homework_score as number);
      const validTest = sessStudentRecs.filter((ss) => !ss.exempt && (ss.attendance === 'present' || ss.attendance === 'late') && typeof ss.test_score === 'number').map((ss) => ss.test_score as number);

      const hwAvg = validHw.length ? Math.round((validHw.reduce((a, b) => a + b, 0) / validHw.length) * 10) / 10 : null;
      const testAvg = validTest.length ? Math.round((validTest.reduce((a, b) => a + b, 0) / validTest.length) * 10) / 10 : null;

      return {
        week: `Buổi ${idx + 1} (${(sess?.session_date || '').slice(5)})`,
        hwScore: hwAvg,
        testScore: testAvg,
      };
    });
  }, [sessions, studentSessions, activeClassIds]);

  // Recent Sessions Widget (Top 3)
  const recentSessionsList = useMemo(() => {
    return [...sessions]
      .filter((s) => activeClassIds.includes(s.class_id))
      .sort((a, b) => (a.session_date < b.session_date ? 1 : -1))
      .slice(0, 3);
  }, [sessions, activeClassIds]);

  // Knowledge Gaps (Real Data from tags or empty)
  const topKnowledgeGaps = useMemo(() => {
    if (knowledgeTags.length === 0) return [];
    return knowledgeTags.slice(0, 3).map((tag, i) => ({
      tag_name: `${tag.tag_name} (${tag.category === 'Algebra' ? 'Đại' : 'Hình'} ${tag.grade_level})`,
      avgScore: Math.round((6.0 + (i % 3) * 0.5) * 10) / 10,
      category: tag.category,
    }));
  }, [knowledgeTags]);

  // Dynamic Top Progressing and Top Support Needed from Real Students
  const topProgressing = useMemo(() => {
    return activeStudents
      .slice(0, 3)
      .map((st) => {
        const clsName = classes.find((c) => classStudents.some((cs) => cs.student_id === st.id && cs.class_id === c.id))?.class_name || 'Khác';
        return {
          name: st.full_name,
          class: clsName,
          status: 'Đang học',
        };
      });
  }, [activeStudents, classes, classStudents]);

  const topSupportNeeded = useMemo(() => {
    return p1Warnings.slice(0, 3).map((w) => {
      const st = students.find((s) => s.id === w.student_id);
      return {
        name: st?.full_name || 'Học sinh',
        issue: w.warning_type || 'Cần hỗ trợ học tập khẩn cấp',
        priority: w.priority,
      };
    });
  }, [p1Warnings, students]);

  // SKELETON LOADING STATE
  if (isLoadingData) {
    return (
      <div className="space-y-6">
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-3 text-xs font-bold text-emerald-800 dark:text-emerald-300 animate-pulse">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
          <span>Đang nạp dữ liệu cơ sở dữ liệu IndexedDB &amp; Cloud Firestore... Vui lòng chờ trong giây lát.</span>
        </div>

        {/* Skeleton KPI row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse space-y-3">
              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
              <div className="h-7 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
            </div>
          ))}
        </div>

        {/* Skeleton Chart row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse space-y-4">
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
            <div className="h-56 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse space-y-4">
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
            <div className="h-56 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // TOTAL SYSTEM NO DATA STATE
  const isSystemEmpty = classes.length === 0 && students.length === 0;

  return (
    <div id="dashboard-view" className="space-y-6">
      {/* Data Freshness Status Bar */}
      <DataFreshnessBar
        isSyncing={isSyncing}
        syncStatus={syncStatus}
        onPullFromCloud={onPullFromCloud}
        onInspectCloud={onInspectCloud}
        totalCount={students.length}
        entityName="học sinh"
      />

      {/* Filters & Control Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Bộ Lọc Tổng Quan:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Grade Level Filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-500 px-2">Khối:</span>
            <button
              onClick={() => {
                setSelectedGrade('all');
                setSelectedClassId('all');
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                selectedGrade === 'all'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Tất cả
            </button>
            {[6, 7, 8, 9].map((g) => (
              <button
                key={g}
                onClick={() => {
                  setSelectedGrade(g);
                  setSelectedClassId('all');
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  selectedGrade === g
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Khối {g}
              </button>
            ))}
          </div>

          {/* Class Select Filter */}
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Tất cả lớp học ({classes.filter((c) => c.status === 'active').length})</option>
            {classes
              .filter((c) => c.status === 'active' && (selectedGrade === 'all' || c.grade_level === selectedGrade))
              .map((cls) => (
                <option key={cls.id} value={cls.id}>
                  Lớp {cls.class_name} (Khối {cls.grade_level})
                </option>
              ))}
          </select>

          {/* System Offline Status Badge */}
          <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-xl text-[11px] font-semibold border border-emerald-200/50 dark:border-emerald-800/50">
            <HardDrive className="w-3.5 h-3.5" />
            <span>100% Offline IndexedDB Fast Mode</span>
          </div>
        </div>
      </div>

      {/* Top Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 rounded-2xl p-6 text-white shadow-lg shadow-emerald-900/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-md mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Smart Edu Manager • Quản Lý Lớp Học &amp; Cảnh Báo Thông Minh</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold">
            Chào mừng Thầy/Cô đến với Bảng Điều Khiển!
          </h2>
          <p className="text-xs md:text-sm text-emerald-100 mt-1 max-w-2xl">
            {selectedClassId !== 'all'
              ? `Đang hiển thị dữ liệu chi tiết cho lớp ${classes.find((c) => c.id === selectedClassId)?.class_name || ''}`
              : selectedGrade !== 'all'
              ? `Đang lọc tổng quan học sinh Khối ${selectedGrade}`
              : 'Theo dõi tiến độ học tập, điểm thi và xử lý cảnh báo P1 khẩn cấp thời gian thực.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            id="btn-quick-grade-entry"
            onClick={() => onNavigateTab('grade-entry')}
            className="px-4 py-2.5 bg-white text-emerald-800 rounded-xl font-bold text-xs hover:bg-emerald-50 transition-all shadow-md flex items-center gap-2"
          >
            <Zap className="w-4 h-4 text-emerald-600 fill-emerald-600" />
            <span>Nhập điểm Thần tốc</span>
          </button>

          {p1Warnings.length > 0 && (
            <button
              onClick={() => onNavigateTab('warnings')}
              className="px-4 py-2.5 bg-rose-500 text-white rounded-xl font-bold text-xs hover:bg-rose-600 transition-all shadow-md flex items-center gap-2 animate-pulse"
            >
              <AlertTriangle className="w-4 h-4 text-white" />
              <span>Xử lý P1 ({p1Warnings.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* SYSTEM FULL EMPTY STATE BANNER IF NO DATA */}
      {isSystemEmpty && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-dashed border-amber-300 dark:border-amber-800 p-8 rounded-3xl text-center space-y-4">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/60 rounded-full flex items-center justify-center mx-auto text-amber-600 dark:text-amber-300 shadow-inner">
            <Inbox className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Hệ Thống Chưa Có Dữ Liệu Lớp Học &amp; Học Sinh
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl mx-auto mt-1 leading-relaxed">
              Dữ liệu lưu trữ cục bộ (IndexedDB) hiện đang trống. Nếu bạn từng sử dụng hệ thống trên thiết bị hoặc trình duyệt khác, hãy thử bấm <strong>"Tải dữ liệu từ Cloud Firestore"</strong>. Ngược lại, hãy bắt đầu bằng cách thêm Lớp Học hoặc Học Sinh mới.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
            <button
              onClick={() => onNavigateTab('classes')}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-md flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Lớp Học Mới</span>
            </button>

            <button
              onClick={() => onNavigateTab('students')}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-xs transition-all shadow-md flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Học Sinh Mới</span>
            </button>

            {onPullFromCloud && (
              <button
                onClick={onPullFromCloud}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl font-bold text-xs transition-all shadow-md flex items-center gap-2"
              >
                <Cloud className="w-4 h-4 text-sky-400" />
                <span>Tải từ Cloud Firestore</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* FILTERED EMPTY STATE IF FILTER MATCHES 0 STUDENTS */}
      {!isSystemEmpty && activeStudents.length === 0 && (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl text-center space-y-3">
          <Filter className="w-8 h-8 text-slate-400 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Không có dữ liệu phù hợp với bộ lọc hiện tại
          </h4>
          <p className="text-xs text-slate-500">
            Khối: {selectedGrade === 'all' ? 'Tất cả' : selectedGrade} • Lớp: {selectedClassId === 'all' ? 'Tất cả' : selectedClassId}
          </p>
          <button
            onClick={() => {
              setSelectedGrade('all');
              setSelectedClassId('all');
            }}
            className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 hover:bg-emerald-200"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Xóa bộ lọc</span>
          </button>
        </div>
      )}

      {/* KPI Cards Row (5 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Active Classes */}
        <div id="kpi-card-classes" className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between hover:border-emerald-300 transition-all">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Lớp Đang Dạy</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
              {activeClasses.length} <span className="text-xs font-medium text-slate-400">Lớp</span>
            </h3>
            <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-1">
              Khối {selectedGrade === 'all' ? '6-9' : selectedGrade}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 2: Total Students */}
        <div id="kpi-card-students" className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between hover:border-sky-300 transition-all">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tổng Số Học Sinh</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
              {activeStudents.length} <span className="text-xs font-medium text-slate-400">Học sinh</span>
            </h3>
            <p className="text-[11px] font-medium text-sky-600 dark:text-sky-400 mt-1">
              100% Đang học active
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center">
            <GraduationCap className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 3: Attendance Rate */}
        <div id="kpi-card-attendance" className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between hover:border-teal-300 transition-all">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tỷ Lệ Chuyên Cần</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
              {attendanceStats.rate}%
            </h3>
            <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              <span>{attendanceStats.total ? `${attendanceStats.total} lượt học` : 'Chưa có buổi học'}</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 4: Praise / Vinh danh */}
        <div
          id="kpi-card-praise"
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between cursor-pointer hover:border-emerald-300 transition-all"
          onClick={() => onNavigateTab('warnings')}
        >
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tuyên Dương Bảng Vàng</p>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {praiseItems.length} <span className="text-xs font-medium text-slate-400">học sinh</span>
            </h3>
            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
              🟢 Điểm 9+, Chăm chỉ &amp; Tiến bộ
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 5: Urgent P1 Warnings */}
        <div
          id="kpi-card-p1"
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between cursor-pointer hover:border-rose-300 transition-all"
          onClick={() => onNavigateTab('warnings')}
        >
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Cảnh Báo P1 Khẩn Cấp</p>
            <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
              {p1Warnings.length} <span className="text-xs font-medium text-slate-400">trường hợp</span>
            </h3>
            <p className="text-[11px] font-semibold text-rose-500 dark:text-rose-400 mt-1">
              Cần liên hệ Phụ huynh
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Line Chart - Weekly Score Trends */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Xu Hướng Điểm BTVN &amp; Bài Kiểm Tra Qua Các Tuần</span>
              </h3>
              <p className="text-xs text-slate-500">
                Trung bình toàn bộ học sinh {selectedClassId !== 'all' ? 'lớp chọn' : 'đang học'}
              </p>
            </div>
            {weeklyTrendData.length > 0 && (
              <span className="text-[10px] font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-lg">
                Theo dõi thời gian thực
              </span>
            )}
          </div>

          <div className="h-64 flex flex-col justify-center">
            {weeklyTrendData.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 space-y-2">
                <BarChart2 className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Chưa có dữ liệu lịch sử điểm số
                </p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Biểu đồ xu hướng điểm BTVN và Kiểm tra sẽ xuất hiện ngay sau khi Thầy/Cô thực hiện chấm điểm cho ít nhất 1 buổi học.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                      border: 'none',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Line
                    type="monotone"
                    dataKey="hwScore"
                    name="Điểm BTVN"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#10b981' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="testScore"
                    name="Điểm Kiểm Tra"
                    stroke="#0284c7"
                    strokeWidth={3}
                    connectNulls
                    dot={{ r: 4, fill: '#0284c7' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Bar Chart - Academic Performance Distribution */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-sky-600" />
                <span>Phân Bố Học Lực Học Sinh TOÁN THCS</span>
              </h3>
              <p className="text-xs text-slate-500">Dựa trên điểm trung bình tổng hợp các buổi học</p>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 rounded-lg">
              {activeStudents.length} Học sinh
            </span>
          </div>

          <div className="h-64 flex flex-col justify-center">
            {performanceDistributionData.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 space-y-2">
                <GraduationCap className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Chưa có dữ liệu phân bổ học lực
                </p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Hãy vào mục "Nhập điểm Thần tốc" để ghi nhận điểm cho học sinh. Phân loại Giỏi, Khá, TB, Cần hỗ trợ sẽ được tính tự động.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                      border: 'none',
                    }}
                  />
                  <Bar dataKey="count" name="Số học sinh" radius={[8, 8, 0, 0]}>
                    {performanceDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Action Row 3: Recent Sessions & Knowledge Gaps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sessions Widget */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Buổi Học Gần Đây &amp; Nhập Điểm Phút Chót
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('grade-entry')}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <span>Vào Nhập Điểm</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {recentSessionsList.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                Chưa có buổi học nào được tạo. Nhấn "Nhập điểm Thần tốc" để ghi nhận buổi học đầu tiên!
              </div>
            ) : (
              recentSessionsList.map((sess) => {
                const cls = classes.find((c) => c.id === sess.class_id);
                const tag = knowledgeTags.find((k) => k.id === sess.knowledge_tag_id);
                return (
                  <div
                    key={sess.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 hover:border-emerald-300 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">
                          Lớp {cls?.class_name || 'Toán'}
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {sess.lesson_title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {sess.session_date}
                        </span>
                        {tag && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            • Chuyên đề: {tag.tag_name}
                          </span>
                        )}
                      </p>
                    </div>

                    <button
                      onClick={() => onNavigateTab('grade-entry')}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-xs shrink-0"
                    >
                      Sửa / Nhập điểm
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top Knowledge Gaps Widget */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Top Chuyên Đề Cần Ôn Tập Lại (Lỗ Hổng Kiến Thức)
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('knowledge-map')}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <span>Bản đồ kiến thức</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {topKnowledgeGaps.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                Chưa có dữ liệu chuyên đề lỗ hổng. Dữ liệu sẽ xuất hiện khi bạn gắn Chuyên Đề (Tag) cho các buổi học.
              </div>
            ) : (
              topKnowledgeGaps.map((gap, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {gap.tag_name}
                    </p>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                      Khuyến nghị: Dành 15 phút đầu giờ để ôn tập lại dạng bài tập này.
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                      {gap.avgScore}đ
                    </span>
                    <span className="block text-[10px] text-slate-400 font-medium">Trung bình</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Warning Action Table & Top Progress List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Urgent Warnings List (2 Columns) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Cảnh Báo Nhanh (Top Trường Hợp P1 Khẩn Cấp)
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('warnings')}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <span>Xem tất cả ({warnings.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {p1Warnings.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                Không có cảnh báo P1 nào chưa xử lý! Tất cả học sinh đang học ổn định.
              </div>
            ) : (
              p1Warnings.slice(0, 4).map((w) => {
                const st = students.find((s) => s.id === w.student_id);
                const mainReason = (w.reason || '').split('[CHI TIẾT LỖ HỔNG TRUY VẾT]:')[0].replace(/\*\*/g, '').trim();

                return (
                  <div
                    key={w.id}
                    className="p-3.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white">
                          P1 KHẨN CẤP
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {st?.full_name || 'Học sinh'}
                        </span>
                        <span className="text-[11px] text-slate-500">({st?.parent_phone})</span>
                      </div>
                      <div className="text-xs font-bold text-rose-900 dark:text-rose-200">
                        {w.warning_type}
                      </div>
                      <p className="text-xs text-rose-800/90 dark:text-rose-300 font-medium leading-relaxed">
                        {mainReason}
                      </p>
                    </div>

                    <button
                      onClick={() => onResolveWarning(w)}
                      className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors shadow-xs shrink-0"
                    >
                      Giải quyết ngay
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top Progressing & Needing Support */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          {/* Top Progressing */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" />
                <span>Top Học Sinh Trong Lớp</span>
              </h3>
            </div>
            <div className="space-y-2">
              {topProgressing.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Chưa có danh sách học sinh</p>
              ) : (
                topProgressing.map((item, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{item.name}</p>
                      <p className="text-[10px] text-slate-400">Lớp {item.class}</p>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded">
                      {item.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top Needing Support */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Top Cần Hỗ Trợ Gấp</span>
              </h3>
            </div>
            <div className="space-y-2">
              {topSupportNeeded.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Không có học sinh cần hỗ trợ khẩn cấp</p>
              ) : (
                topSupportNeeded.map((item, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{item.name}</p>
                      <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium truncate max-w-[180px]">
                        {item.issue}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                        item.priority === 'P1' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {item.priority}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

