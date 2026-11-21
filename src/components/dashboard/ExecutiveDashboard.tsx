import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Lock,
  Unlock,
  Wrench,
} from 'lucide-react';
import { useUTS } from '../../context/UTSContext';
import {
  DAY_LABELS,
  SHIFT_DEFS,
  calculateKPIs,
  evaluateCSPCost,
} from '../../engine/conflictEngine';
import type { LifecycleStage } from '../../types/uts';
import { ExportToolbar } from '../common/ExportToolbar';

const LIFECYCLE_STEPS: { id: LifecycleStage; milestone: string; title: string; desc: string }[] = [
  { id: 'T12_COHORTS', milestone: 'Mốc T-12 Tuần', title: 'Quy hoạch Khóa & Lớp cơ hữu', desc: 'Chốt niên khóa, hệ đào tạo & sĩ số lớp hành chính' },
  { id: 'T10_CURRICULUM', milestone: 'Mốc T-10 Tuần', title: 'Chương trình khung & Định mức', desc: 'Phân rã 4 cấu phần LT/BT/TL/TH & môn tiên quyết' },
  { id: 'T8_SEMESTER_PLAN', milestone: 'Mốc T-8 Tuần', title: 'Kế hoạch Tuần & Mô hình Thi', desc: 'Phân bổ 15–22 tuần học & Thi cuốn chiếu / Tập trung' },
  { id: 'T4_MACRO_SCHEDULE', milestone: 'Mốc T-4 đến T-6', title: 'Lập lịch Thứ/Tiết/Phòng học', desc: 'Phòng Đào tạo xếp lịch vĩ mô & công bố dự thảo' },
  { id: 'T1_FROZEN', milestone: 'Mốc T-1 Tuần', title: 'Chốt Giảng viên & Đóng băng', desc: 'Khóa lịch chính thức, đẩy Mobile App & LMS' },
];

export const ExecutiveDashboard: React.FC = () => {
  const { state, setActiveNav, navigateWithDrillDown, toggleFreeze, currentRole, roleCapabilities } = useUTS();

  const [campusFilter, setCampusFilter] = useState<string>('ALL');
  const [buildingFilter, setBuildingFilter] = useState<string>('ALL');
  const [facultyFilter, setFacultyFilter] = useState<string>('ALL');
  const [selectedHeatCell, setSelectedHeatCell] = useState<{ dayOfWeek: number; shiftId: 'MORNING' | 'AFTERNOON' | 'EVENING' } | null>(null);

  useEffect(() => {
    if (currentRole.role === 'FACULTY_HEAD' && currentRole.facultyId) {
      setFacultyFilter(currentRole.facultyId);
    } else {
      setFacultyFilter('ALL');
    }
  }, [currentRole]);

  const kpis = useMemo(
    () =>
      calculateKPIs(state, {
        campusCode: campusFilter,
        buildingId: buildingFilter,
        facultyId: facultyFilter,
      }),
    [state, campusFilter, buildingFilter, facultyFilter]
  );

  const cspReport = useMemo(() => evaluateCSPCost(state, state.activeWeek), [state]);
  const activeStageIndex = LIFECYCLE_STEPS.findIndex((s) => s.id === state.lifecycleStage);

  const getHeatColor = (rate: number): string => {
    if (rate >= 70) return 'bg-[#E74C3C] text-white';
    if (rate >= 45) return 'bg-[#F39C12] text-white';
    if (rate >= 20) return 'bg-[#1ABB9C] text-white';
    if (rate > 0) return 'bg-[#1ABB9C]/25 text-[#2A3F54]';
    return 'bg-[#F7F7F7] text-[#73879C]';
  };

  const selectedCellDetail = useMemo(() => {
    if (!selectedHeatCell) return null;
    const cell = kpis.heatmap.find(
      (h) => h.dayOfWeek === selectedHeatCell.dayOfWeek && h.shiftId === selectedHeatCell.shiftId
    );
    const matchingSessions = state.sessions.filter((s) => {
      if (s.weekIndex !== state.activeWeek || s.status === 'CANCELLED' || s.status === 'RESCHEDULED') return false;
      if (s.dayOfWeek !== selectedHeatCell.dayOfWeek) return false;
      const shift = s.startPeriod <= 5 ? 'MORNING' : s.startPeriod <= 10 ? 'AFTERNOON' : 'EVENING';
      return shift === selectedHeatCell.shiftId;
    });
    return { cell, matchingSessions };
  }, [selectedHeatCell, kpis.heatmap, state]);

  const canChangeFreeze = currentRole.role === 'SCHEDULER' || currentRole.role === 'EXECUTIVE' || currentRole.role === 'SYS_ADMIN';

  const kpiSummaryRows = useMemo(
    () => [
      { code: 'RUR', name: 'Tỷ lệ Sử dụng Giảng đường', value: `${kpis.rur}%`, target: '+25% công suất (BO-03)', detail: `${kpis.totalActiveSessions} buổi đang vận hành` },
      { code: 'SFR', name: 'Chỉ số Lấp đầy Chỗ ngồi', value: `${kpis.sfr}%`, target: '≥ 85% (BR_RULE_10)', detail: 'Tổng sĩ số / Tổng sức chứa phòng dùng' },
      { code: 'SVI', name: 'Tỷ lệ Biến động Lịch học', value: `${kpis.svi}%`, target: 'Càng thấp càng ổn định', detail: `${kpis.pendingRequestsCount} đơn đang chờ duyệt` },
      { code: 'SLA', name: 'Tỷ lệ Xử lý Đổi lịch Đúng hạn', value: `${kpis.slaOnTimeRate}%`, target: '< 24 giờ (12h + 12h)', detail: `Trung bình ${kpis.avgSlaHours} giờ / hồ sơ` },
      { code: 'CSP_HARD', name: 'Xung đột Cứng (BO-01)', value: `${kpis.hardConflictsCount}`, target: '0 xung đột', detail: `Điểm phạt mềm CSP: ${cspReport.totalSoftCost}` },
      { code: 'QUEUE', name: 'Hàng đợi Chưa xếp lịch', value: `${kpis.unassignedSectionCount}`, target: '0 lớp tồn đọng', detail: `${kpis.openIncidentsCount} sự cố thiết bị đang mở` },
    ],
    [kpis, cspReport.totalSoftCost]
  );

  return (
    <div className="space-y-5">
      {/* Role-Specific Workspace Strip — Adapts dynamically across all 6 RBAC Roles */}
      <section className="x_panel">
        <div className="px-4 py-3 border-b border-[#E6E9ED] bg-[#2A3F54] text-white flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs">
            <span className="text-[#1ABB9C] font-bold">Phiên làm việc theo Vai trò: {currentRole.label}</span>
            <span className="text-white/75"> · {roleCapabilities.scopeSummary}</span>
          </div>
          <span className="font-mono text-[11px] text-white/80">
            {currentRole.userName} ({currentRole.role})
          </span>
        </div>
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 bg-white">
          {roleCapabilities.quickActions.map((qa) => (
            <button
              key={qa.label}
              type="button"
              onClick={() => setActiveNav(qa.targetNav)}
              className="group p-2.5 rounded border border-[#E6E9ED] hover:border-[#1ABB9C] hover:bg-[#1ABB9C]/5 text-left transition-colors"
            >
              <div className="flex items-center justify-between gap-1 text-xs font-bold text-[#2A3F54] group-hover:text-[#169F85]">
                <span className="truncate">{qa.label}</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0 text-[#94A3B8] group-hover:text-[#1ABB9C]" />
              </div>
              <div className="text-[11px] text-[#73879C] mt-0.5 truncate">{qa.description}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Classic Gentelella Top Tile Count KPI Strip — EVERY TILE DRILLS DOWN TO ITS DETAIL PAGE */}
      <section className="x_panel">
        <div className="px-4 py-2.5 border-b border-[#E6E9ED] flex flex-wrap items-center justify-between gap-2 bg-[#FAFAFA]">
          <div className="text-xs text-[#5A738E]">
            <strong className="text-[#2A3F54]">Chỉ số Điều hành Thời gian thực (Tuần {state.activeWeek})</strong> — Nhấp vào bất kỳ chỉ số nào bên dưới để xem danh sách bản ghi chi tiết
          </div>
          <ExportToolbar
            compact
            filenameBase={`UTS_TongHopKPI_Tuan${state.activeWeek}`}
            reportTitle={`Tổng hợp Chỉ số Điều hành KPIs — Tuần ${state.activeWeek}`}
            rows={kpiSummaryRows}
            columns={[
              { header: 'Mã chỉ số', accessor: (r) => r.code },
              { header: 'Tên chỉ số KPI', accessor: (r) => r.name },
              { header: 'Giá trị thực tế', accessor: (r) => r.value },
              { header: 'Ngưỡng mục tiêu', accessor: (r) => r.target },
              { header: 'Ghi chú chi tiết', accessor: (r) => r.detail },
            ]}
          />
        </div>

        <div className="px-3 py-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-y-3">
          {/* KPI 1: RUR -> Master Data Rooms (RUR breakdown per room) */}
          <button
            type="button"
            onClick={() =>
              navigateWithDrillDown('master', {
                sourceLabel: `Sử dụng Giảng đường (RUR: ${kpis.rur}%)`,
                description: 'Chi tiết tỷ lệ khai thác công suất theo từng phòng học & tòa nhà',
                masterTab: 'ROOMS',
                campusCode: campusFilter,
                buildingId: buildingFilter,
                roomMetricFocus: 'RUR',
              })
            }
            className="group text-left px-3 py-1.5 rounded hover:bg-[#1ABB9C]/5 xl:border-r border-[#D9DEE4] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ABB9C]"
          >
            <div className="flex items-center justify-between gap-1 text-[12px] text-[#73879C] font-medium">
              <span className="truncate">Sử dụng Giảng đường (RUR)</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#1ABB9C] shrink-0" />
            </div>
            <div className="text-[28px] font-bold text-[#2A3F54] group-hover:text-[#169F85] font-mono tabular-nums leading-tight mt-1 transition-colors">
              {kpis.rur}%
            </div>
            <div className="text-[11px] text-[#169F85] font-medium mt-1">
              Xem công suất từng phòng →
            </div>
          </button>

          {/* KPI 2: SFR -> Reports SFR Detailed Session Fill Ratio Audit */}
          <button
            type="button"
            onClick={() =>
              navigateWithDrillDown('reports', {
                sourceLabel: `Lấp đầy Chỗ ngồi (SFR: ${kpis.sfr}%)`,
                description: 'Phân tích tỷ lệ lấp đầy sĩ số trên sức chứa của từng buổi học (BR_RULE_10)',
                reportFocus: 'SFR_DETAIL',
                sfrFilter: 'ALL',
              })
            }
            className="group text-left px-3 py-1.5 rounded hover:bg-[#1ABB9C]/5 xl:border-r border-[#D9DEE4] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ABB9C]"
          >
            <div className="flex items-center justify-between gap-1 text-[12px] text-[#73879C] font-medium">
              <span className="truncate">Lấp đầy Chỗ ngồi (SFR)</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#1ABB9C] shrink-0" />
            </div>
            <div className={`text-[28px] font-bold font-mono tabular-nums leading-tight mt-1 ${kpis.sfr >= 80 ? 'text-[#1ABB9C]' : 'text-[#F39C12]'}`}>
              {kpis.sfr}%
            </div>
            <div className="text-[11px] text-[#5A738E] group-hover:text-[#2A3F54] mt-1">
              Soi chi tiết từng lớp/phòng →
            </div>
          </button>

          {/* KPI 3: SVI -> Workflow & Changed Sessions */}
          <button
            type="button"
            onClick={() =>
              navigateWithDrillDown('workflow', {
                sourceLabel: `Biến động Lịch học (SVI: ${kpis.svi}%)`,
                description: 'Toàn bộ các buổi học bị báo nghỉ, đổi phòng, học bù và hồ sơ điều chỉnh',
                workflowFilter: 'SVI_CHANGES',
              })
            }
            className="group text-left px-3 py-1.5 rounded hover:bg-[#1ABB9C]/5 xl:border-r border-[#D9DEE4] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ABB9C]"
          >
            <div className="flex items-center justify-between gap-1 text-[12px] text-[#73879C] font-medium">
              <span className="truncate">Biến động Lịch học (SVI)</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#1ABB9C] shrink-0" />
            </div>
            <div className="text-[28px] font-bold text-[#2A3F54] group-hover:text-[#169F85] font-mono tabular-nums leading-tight mt-1 transition-colors">
              {kpis.svi}%
            </div>
            <div className="text-[11px] text-[#5A738E] group-hover:text-[#2A3F54] mt-1">
              {kpis.pendingRequestsCount} đơn chờ · Xem biến động →
            </div>
          </button>

          {/* KPI 4: SLA On-Time -> Workflow SLA Tracking */}
          <button
            type="button"
            onClick={() =>
              navigateWithDrillDown('workflow', {
                sourceLabel: `Xử lý Đúng hạn SLA (${kpis.slaOnTimeRate}%)`,
                description: `Thời gian phản hồi trung bình ${kpis.avgSlaHours}h (Mục tiêu < 24h: 12h Bộ môn + 12h Phòng ĐT)`,
                workflowFilter: 'SLA_TRACKING',
              })
            }
            className="group text-left px-3 py-1.5 rounded hover:bg-[#1ABB9C]/5 xl:border-r border-[#D9DEE4] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ABB9C]"
          >
            <div className="flex items-center justify-between gap-1 text-[12px] text-[#73879C] font-medium">
              <span className="truncate">Duyệt đúng hạn SLA (&lt;24h)</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#1ABB9C] shrink-0" />
            </div>
            <div className="text-[28px] font-bold text-[#1ABB9C] font-mono tabular-nums leading-tight mt-1">
              {kpis.slaOnTimeRate}%
            </div>
            <div className="text-[11px] text-[#5A738E] group-hover:text-[#2A3F54] mt-1">
              TB {kpis.avgSlaHours}h · Bảng theo dõi SLA →
            </div>
          </button>

          {/* KPI 5: Hard Conflicts & CSP Cost -> Builder CSP Audit */}
          <button
            type="button"
            onClick={() =>
              navigateWithDrillDown('builder', {
                sourceLabel: `Kiểm toán Xung đột CSP (Cứng: ${kpis.hardConflictsCount} · Phạt mềm: ${cspReport.totalSoftCost})`,
                description: 'Chi tiết hàm mục tiêu Cost(S) = Σ w·P và các ràng buộc vi phạm trên lưới lịch',
                builderFocus: 'CSP_AUDIT',
              })
            }
            className="group text-left px-3 py-1.5 rounded hover:bg-[#1ABB9C]/5 xl:border-r border-[#D9DEE4] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ABB9C]"
          >
            <div className="flex items-center justify-between gap-1 text-[12px] text-[#73879C] font-medium">
              <span className="truncate">Xung đột Cứng (BO-01)</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#1ABB9C] shrink-0" />
            </div>
            <div className={`text-[28px] font-bold font-mono tabular-nums leading-tight mt-1 ${kpis.hardConflictsCount === 0 ? 'text-[#169F85]' : 'text-[#E74C3C]'}`}>
              {kpis.hardConflictsCount}
            </div>
            <div className="text-[11px] text-[#169F85] font-medium mt-1">
              Phạt mềm {cspReport.totalSoftCost} · Xem chi tiết CSP →
            </div>
          </button>

          {/* KPI 6: Unassigned Queue -> Builder Focused on Unassigned Queue */}
          <button
            type="button"
            onClick={() =>
              navigateWithDrillDown('builder', {
                sourceLabel: `Hàng đợi Chưa xếp lịch (${kpis.unassignedSectionCount} lớp học phần)`,
                description: 'Danh sách lớp học phần cần phân bổ phòng học hoặc tách tốp Lab',
                builderFocus: 'UNASSIGNED',
              })
            }
            className="group text-left px-3 py-1.5 rounded hover:bg-[#1ABB9C]/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ABB9C]"
          >
            <div className="flex items-center justify-between gap-1 text-[12px] text-[#73879C] font-medium">
              <span className="truncate">Hàng đợi chưa xếp lịch</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#1ABB9C] shrink-0" />
            </div>
            <div className="text-[28px] font-bold text-[#3498DB] font-mono tabular-nums leading-tight mt-1">
              {kpis.unassignedSectionCount}
            </div>
            <div className="text-[11px] text-[#5A738E] group-hover:text-[#2A3F54] mt-1">
              {kpis.totalActiveSessions} buổi đang học · Xếp lịch →
            </div>
          </button>
        </div>
      </section>

      {/* 4-Step Academic Planning & Lifecycle Lock Bar */}
      <section className="x_panel">
        <div className="x_title flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-[#2A3F54]">
              Quy trình 4 Bước Lập Kế hoạch Đào tạo & Đóng băng Lịch học
            </h2>
            <p className="text-xs text-[#73879C] mt-0.5">
              Nhấp từng mốc thời gian để mở thẳng phân hệ chức năng tương ứng
            </p>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button
              type="button"
              onClick={() => setActiveNav('builder')}
              className="px-3.5 py-2 text-xs font-semibold rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Mở Bảng Lập lịch (Builder)
            </button>
            {canChangeFreeze && (
              <button
                type="button"
                onClick={() => toggleFreeze(!state.isFrozen, state.isFrozen ? 'T4_MACRO_SCHEDULE' : 'T1_FROZEN')}
                className={`px-3.5 py-2 text-xs font-semibold rounded border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
                  state.isFrozen
                    ? 'bg-[#FFF7ED] border-[#F39C12] text-[#B45309] hover:bg-[#FFEDD5]'
                    : 'bg-[#2A3F54] border-[#2A3F54] text-white hover:bg-[#172D44]'
                }`}
              >
                {state.isFrozen ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                {state.isFrozen ? 'Mở khóa Dự thảo' : 'Đóng băng TKB (T-1)'}
              </button>
            )}
          </div>
        </div>
        <div className="x_content">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {LIFECYCLE_STEPS.map((step, idx) => {
              const isDone = idx < activeStageIndex || (state.isFrozen && step.id === 'T1_FROZEN');
              const isCurrent = idx === activeStageIndex && !state.isFrozen;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    if (step.id === 'T12_COHORTS') {
                      navigateWithDrillDown('master', {
                        sourceLabel: 'Bước 1 (T-12): Quy hoạch Khóa & Lớp cơ hữu',
                        masterTab: 'TREE',
                      });
                    } else if (step.id === 'T10_CURRICULUM') {
                      navigateWithDrillDown('master', {
                        sourceLabel: 'Bước 2 (T-10): Chương trình khung & Định mức 4 cấu phần tiết',
                        masterTab: 'COURSES',
                      });
                    } else if (step.id === 'T8_SEMESTER_PLAN') {
                      navigateWithDrillDown('planning', {
                        sourceLabel: 'Bước 3 (T-8): Kế hoạch 18 Tuần & Mô hình Thi',
                        planningFocus: 'ALLOCATION',
                      });
                    } else if (step.id === 'T4_MACRO_SCHEDULE') {
                      navigateWithDrillDown('builder', {
                        sourceLabel: 'Bước 4 (T-4 đến T-6): Lập lịch Thứ/Tiết/Phòng học',
                      });
                    } else {
                      navigateWithDrillDown('master', {
                        sourceLabel: 'Mốc T-1: Chốt Phân công Giảng viên & Đóng băng TKB',
                        masterTab: 'INSTRUCTORS',
                      });
                    }
                  }}
                  className={`group text-left p-3 rounded border transition-colors ${
                    isCurrent
                      ? 'border-[#1ABB9C] bg-[#1ABB9C]/5'
                      : isDone
                        ? 'border-[#E6E9ED] bg-[#F7F7F7]/70 hover:border-[#1ABB9C]'
                        : 'border-[#E6E9ED] bg-white hover:border-[#1ABB9C]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className={isCurrent ? 'text-[#169F85]' : isDone ? 'text-[#2A3F54]' : 'text-[#73879C]'}>
                      {step.milestone}
                    </span>
                    {isDone ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#1ABB9C]" />
                    ) : (
                      <ArrowUpRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#1ABB9C]" />
                    )}
                  </div>
                  <div className="text-[13px] font-bold text-[#2A3F54] mt-1">{step.title}</div>
                  <div className="text-[11px] text-[#73879C] mt-1 leading-snug">{step.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Analytics Split: Room Utilization Heatmap (UAC-03) + Faculty Teaching Progress */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Heatmap Panel (7 cols) */}
        <section className="x_panel xl:col-span-7 flex flex-col">
          <div className="x_title flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold text-[#2A3F54]">
                Biểu đồ Nhiệt Công suất Giảng đường (Room Utilization Heatmap)
              </h2>
              <p className="text-xs text-[#73879C] mt-0.5">
                Nhấp vào bất kỳ ô Thứ × Ca học nào để xem chi tiết buổi học & mở thẳng lưới lịch khung giờ đó
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 no-print">
              <select
                value={campusFilter}
                onChange={(e) => {
                  setCampusFilter(e.target.value);
                  setBuildingFilter('ALL');
                }}
                aria-label="Lọc theo Cơ sở"
                className="text-xs bg-white border border-[#D9DEE4] rounded px-2.5 py-1.5 text-[#2A3F54] focus:outline-none focus:border-[#1ABB9C]"
              >
                <option value="ALL">Tất cả Cơ sở</option>
                <option value="CS1_MAIN">Cơ sở 1 — Trung tâm</option>
                <option value="CS2_TECH">Cơ sở 2 — Khu Lab</option>
              </select>
              <select
                value={buildingFilter}
                onChange={(e) => setBuildingFilter(e.target.value)}
                aria-label="Lọc theo Tòa nhà"
                className="text-xs bg-white border border-[#D9DEE4] rounded px-2.5 py-1.5 text-[#2A3F54] focus:outline-none focus:border-[#1ABB9C]"
              >
                <option value="ALL">Tất cả Tòa nhà</option>
                {state.buildings
                  .filter((b) => campusFilter === 'ALL' || b.campusCode === campusFilter)
                  .map((b) => (
                    <option key={b.buildingId} value={b.buildingId}>
                      {b.buildingName}
                    </option>
                  ))}
              </select>
              <select
                value={facultyFilter}
                onChange={(e) => setFacultyFilter(e.target.value)}
                aria-label="Lọc theo Khoa"
                className="text-xs bg-white border border-[#D9DEE4] rounded px-2.5 py-1.5 text-[#2A3F54] focus:outline-none focus:border-[#1ABB9C]"
              >
                <option value="ALL">Tất cả Khoa</option>
                {state.faculties.map((f) => (
                  <option key={f.facultyId} value={f.facultyId}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="x_content flex-1 flex flex-col justify-between gap-4">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E6E9ED] text-[#73879C]">
                    <th className="py-2 pr-3 text-left font-semibold w-[135px]">Ca học / Thứ</th>
                    {[2, 3, 4, 5, 6, 7].map((d) => (
                      <th key={d} className="py-2 px-1.5 text-center font-semibold">
                        {DAY_LABELS[d]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SHIFT_DEFS.map((shift) => (
                    <tr key={shift.id} className="border-b border-[#E6E9ED] last:border-b-0">
                      <td className="py-2.5 pr-3">
                        <div className="font-semibold text-[#2A3F54]">{shift.label}</div>
                        <div className="text-[11px] font-mono text-[#73879C]">{shift.periodsLabel}</div>
                      </td>
                      {[2, 3, 4, 5, 6, 7].map((day) => {
                        const cell = kpis.heatmap.find(
                          (h) => h.dayOfWeek === day && h.shiftId === shift.id
                        );
                        const rate = cell?.occupancyRate ?? 0;
                        const isSelected =
                          selectedHeatCell?.dayOfWeek === day && selectedHeatCell?.shiftId === shift.id;
                        return (
                          <td key={day} className="p-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedHeatCell({ dayOfWeek: day, shiftId: shift.id })}
                              onDoubleClick={() =>
                                navigateWithDrillDown('builder', {
                                  sourceLabel: `Heatmap: ${DAY_LABELS[day]} · ${shift.label} (${rate}%)`,
                                  description: `${cell?.usedRooms ?? 0}/${cell?.availableRooms ?? 0} phòng đang sử dụng`,
                                  builderDay: day,
                                  builderShift: shift.id,
                                  builderFocus: 'SLOT_DETAIL',
                                })
                              }
                              className={`w-full py-3 px-2 rounded text-center transition-transform hover:scale-[1.02] ${getHeatColor(rate)} ${
                                isSelected ? 'ring-2 ring-[#2A3F54] ring-offset-1' : ''
                              }`}
                            >
                              <div className="font-mono tabular-nums text-[15px] font-bold leading-none">
                                {rate}%
                              </div>
                              <div className="text-[10px] opacity-90 mt-1 font-mono tabular-nums">
                                {cell?.usedRooms ?? 0}/{cell?.availableRooms ?? 0} phòng
                              </div>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Selected Heatmap Cell Drill-Down Action Bar + Export */}
            <div className="pt-3 border-t border-[#E6E9ED] space-y-2.5 text-[11px] text-[#73879C]">
              {selectedCellDetail?.cell && (
                <div className="p-3 rounded bg-[#F7F7F7] border border-[#D9DEE4] flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="text-[#2A3F54]">
                    <strong>{selectedCellDetail.cell.dayLabel} · {selectedCellDetail.cell.shiftLabel}</strong>:{' '}
                    <span className="font-mono font-bold text-[#169F85]">{selectedCellDetail.cell.occupancyRate}%</span>{' '}
                    ({selectedCellDetail.matchingSessions.length} buổi học ·{' '}
                    {Math.max(0, selectedCellDetail.cell.availableRooms - selectedCellDetail.cell.usedRooms)} phòng còn trống)
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      navigateWithDrillDown('builder', {
                        sourceLabel: `Khung giờ ${selectedCellDetail.cell!.dayLabel} · ${selectedCellDetail.cell!.shiftLabel}`,
                        description: `Chi tiết ${selectedCellDetail.matchingSessions.length} buổi học & danh sách phòng trống khả dụng`,
                        builderDay: selectedHeatCell!.dayOfWeek,
                        builderShift: selectedHeatCell!.shiftId,
                        builderFocus: 'SLOT_DETAIL',
                      })
                    }
                    className="px-3 py-1.5 rounded bg-[#2A3F54] hover:bg-[#172D44] text-white text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    Xem danh sách buổi học & phòng trống
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-[#2A3F54]">Mức tải:</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-[#F7F7F7] border border-[#D9DEE4]" /> 0%
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-[#1ABB9C]/25" /> 1–19%
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-[#1ABB9C]" /> 20–44%
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-[#F39C12]" /> 45–69%
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-[#E74C3C]" /> ≥70%
                  </span>
                </div>
                <ExportToolbar
                  compact
                  filenameBase={`UTS_Heatmap_CongSuatPhong_Tuan${state.activeWeek}`}
                  reportTitle={`Biểu đồ Nhiệt Công suất Phòng học — Tuần ${state.activeWeek}`}
                  rows={kpis.heatmap}
                  columns={[
                    { header: 'Thứ', accessor: (h) => h.dayLabel },
                    { header: 'Ca học', accessor: (h) => h.shiftLabel },
                    { header: 'Số phòng đang dùng', accessor: (h) => h.usedRooms },
                    { header: 'Tổng phòng khả dụng', accessor: (h) => h.availableRooms },
                    { header: 'Tỷ lệ sử dụng (%)', accessor: (h) => `${h.occupancyRate}%` },
                    { header: 'Số buổi học', accessor: (h) => h.sessionsCount },
                  ]}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Gentelella Widget Summary: Teaching Progress by Faculty (CLICKABLE DRILL-DOWN) + Attention Queue */}
        <section className="x_panel xl:col-span-5 flex flex-col">
          <div className="x_title flex items-center justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-bold text-[#2A3F54]">
                Tiến độ Đào tạo Tổng thể theo Khoa
              </h2>
              <p className="text-xs text-[#73879C] mt-0.5">
                Nhấp từng Khoa để xem cây đào tạo, lớp cơ hữu & lịch học chi tiết của Khoa đó
              </p>
            </div>
            <ExportToolbar
              compact
              filenameBase="UTS_TienDoDaoTao_TheoKhoa"
              reportTitle="Báo cáo Tiến độ Đào tạo Tổng thể theo Khoa"
              rows={state.faculties}
              columns={[
                { header: 'Mã Khoa', accessor: (f) => f.code },
                { header: 'Tên Khoa / Viện', accessor: (f) => f.name },
                { header: 'Trưởng Khoa', accessor: (f) => f.deanName },
                { header: 'Giờ thực dạy', accessor: (f) => f.completedHours },
                { header: 'Giờ kế hoạch', accessor: (f) => f.targetHours },
                { header: 'Tỷ lệ hoàn thành (%)', accessor: (f) => `${Math.round((f.completedHours / f.targetHours) * 100)}%` },
              ]}
            />
          </div>
          <div className="x_content flex-1 flex flex-col justify-between gap-5">
            <div className="space-y-3">
              {state.faculties.map((fac) => {
                const pct = Math.min(100, Math.round((fac.completedHours / fac.targetHours) * 100));
                return (
                  <button
                    key={fac.facultyId}
                    type="button"
                    onClick={() =>
                      navigateWithDrillDown('builder', {
                        sourceLabel: `Tiến độ Khoa: ${fac.name} (${pct}%)`,
                        description: `${fac.completedHours}/${fac.targetHours} giờ · Trưởng khoa: ${fac.deanName}`,
                        builderViewMode: 'FACULTY',
                        builderEntityId: fac.facultyId,
                      })
                    }
                    className="group w-full text-left p-2 -mx-2 rounded hover:bg-[#F7F7F7] transition-colors space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#2A3F54] group-hover:text-[#169F85] truncate pr-2 inline-flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-[#73879C] shrink-0" />
                        {fac.name}
                      </span>
                      <span className="font-mono tabular-nums text-[#73879C] shrink-0 inline-flex items-center gap-1">
                        {fac.completedHours}/{fac.targetHours} giờ ({pct}%)
                        <ArrowUpRight className="w-3 h-3 text-[#94A3B8] group-hover:text-[#1ABB9C]" />
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-[#F2F5F7] rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-[#1ABB9C] transition-[width] duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-[#73879C]">
                      Trưởng khoa: {fac.deanName}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Operational Attention Queue — 3 Direct Drill-down Shortcuts */}
            <div className="pt-4 border-t border-[#E6E9ED] space-y-2.5">
              <div className="text-xs font-bold text-[#2A3F54]">Hạng mục Cần Xử lý Tức thời</div>
              <div className="divide-y divide-[#E6E9ED] border border-[#E6E9ED] rounded">
                <button
                  type="button"
                  onClick={() =>
                    navigateWithDrillDown('workflow', {
                      sourceLabel: `Đơn chờ phê duyệt SLA (${kpis.pendingRequestsCount} hồ sơ)`,
                      description: 'Danh sách đơn báo nghỉ & dạy bù cần xử lý trong hạn 24 giờ',
                      workflowFilter: 'PENDING',
                    })
                  }
                  className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-[#F7F7F7] transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ClipboardCheck className="w-4 h-4 text-[#F39C12] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#2A3F54] truncate">
                        {kpis.pendingRequestsCount} đơn báo nghỉ / dạy bù đang chờ duyệt SLA
                      </div>
                      <div className="text-[11px] text-[#73879C]">Mở hàng đợi phê duyệt Cấp 1 & Cấp 2</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#73879C] shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigateWithDrillDown('builder', {
                      sourceLabel: `Hàng đợi Chưa xếp lịch (${kpis.unassignedSectionCount} lớp HP)`,
                      description: 'Kéo thả, tách tốp Lab hoặc tự động giải CSP',
                      builderFocus: 'UNASSIGNED',
                    })
                  }
                  className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-[#F7F7F7] transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AlertTriangle className="w-4 h-4 text-[#3498DB] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#2A3F54] truncate">
                        {kpis.unassignedSectionCount} lớp học phần trong hàng đợi chờ phân bổ
                      </div>
                      <div className="text-[11px] text-[#73879C]">Hỗ trợ kéo thả, tách tốp Lab & bộ giải CSP</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#73879C] shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigateWithDrillDown('master', {
                      sourceLabel: `Sự cố Thiết bị Giảng đường đang mở (${kpis.openIncidentsCount} phản ánh)`,
                      description: 'Danh sách sự cố thiết bị do Giảng viên & Sinh viên gửi từ hiện trường',
                      masterTab: 'ROOMS',
                      roomMetricFocus: 'INCIDENTS',
                    })
                  }
                  className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-[#F7F7F7] transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Wrench className="w-4 h-4 text-[#E74C3C] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#2A3F54] truncate">
                        {kpis.openIncidentsCount} sự cố thiết bị giảng đường cần xử lý kỹ thuật
                      </div>
                      <div className="text-[11px] text-[#73879C]">Xem danh sách phản ánh hiện trường & cập nhật trạng thái</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#73879C] shrink-0" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Bottom Row: Teaching Load Distribution Bar Chart (CLICK ANY BAR TO DRILL DOWN!) + Recent Audit Trail */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="x_panel xl:col-span-7">
          <div className="x_title flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-bold text-[#2A3F54]">
                Chỉ số Cân bằng Giờ dạy Giảng viên (Teaching Load Distribution)
              </h2>
              <p className="text-xs text-[#73879C] mt-0.5">
                Nhấp vào bất kỳ cột giảng viên nào để mở thẳng lịch giảng dạy & lịch bận cá nhân của giảng viên đó
              </p>
            </div>
            <ExportToolbar
              compact
              filenameBase={`UTS_CanBangGioDay_Tuan${state.activeWeek}`}
              reportTitle={`Thống kê Khối lượng Giờ dạy Giảng viên — Tuần ${state.activeWeek}`}
              rows={kpis.instructorLoads}
              columns={[
                { header: 'Mã GV', accessor: (i) => i.instructorId },
                { header: 'Họ tên Giảng viên', accessor: (i) => i.name },
                { header: 'Khoa', accessor: (i) => i.facultyName },
                { header: 'Loại hình', accessor: (i) => i.type },
                { header: 'Số tiết tuần', accessor: (i) => i.weeklyPeriods },
                { header: 'Trần tuần', accessor: (i) => i.maxWeeklyPeriods },
                { header: 'Tối đa ngày / Trần', accessor: (i) => `${i.maxDailyUsed}/${i.maxDailyCap}` },
                { header: 'Đánh giá tải', accessor: (i) => i.status },
              ]}
            />
          </div>
          <div className="x_content">
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={kpis.instructorLoads}
                  margin={{ top: 10, right: 16, left: -12, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6E9ED" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#5A738E' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={48}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#5A738E' }} unit=" tiết" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#D9DEE4',
                      borderRadius: '3px',
                      fontSize: '12px',
                    }}
                    formatter={(value: any, _name: any, item: any) => [
                      `${value} tiết / tuần (Tối đa ngày: ${item.payload.maxDailyUsed}/${item.payload.maxDailyCap} tiết) — Nhấp để xem chi tiết`,
                      item.payload.type,
                    ]}
                  />
                  <Bar
                    dataKey="weeklyPeriods"
                    radius={[2, 2, 0, 0]}
                    maxBarSize={38}
                    className="cursor-pointer"
                    onClick={(data: any) => {
                      if (data?.instructorId) {
                        navigateWithDrillDown('builder', {
                          sourceLabel: `Lịch Giảng dạy: ${data.name} (${data.weeklyPeriods} tiết/tuần)`,
                          description: `${data.type} · Khoa ${data.facultyName} · Cao điểm ${data.maxDailyUsed}/${data.maxDailyCap} tiết/ngày`,
                          builderViewMode: 'INSTRUCTOR',
                          builderEntityId: data.instructorId,
                        });
                      }
                    }}
                  >
                    {kpis.instructorLoads.map((entry) => (
                      <Cell
                        key={entry.instructorId}
                        fill={
                          entry.status === 'OVERLOADED'
                            ? '#E74C3C'
                            : entry.status === 'UNDERLOADED'
                              ? '#94A3B8'
                              : '#1ABB9C'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Recent Audit Logs — CLICK ANY ROW TO OPEN ITS FULL JSON DIFF IN WORKFLOW/AUDIT PAGE */}
        <section className="x_panel xl:col-span-5">
          <div className="x_title flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-bold text-[#2A3F54]">Nhật ký Vận hành & Kiểm toán Gần nhất</h2>
              <p className="text-xs text-[#73879C] mt-0.5">Nhấp từng bản ghi để xem đối chiếu JSON Old/New & Rollback</p>
            </div>
            <button
              type="button"
              onClick={() =>
                navigateWithDrillDown('workflow', {
                  sourceLabel: 'Toàn bộ Nhật ký Kiểm toán (Audit_Log)',
                  workflowFilter: 'ALL',
                })
              }
              className="text-xs font-semibold text-[#169F85] hover:underline"
            >
              Xem toàn bộ
            </button>
          </div>
          <div className="x_content">
            <div className="divide-y divide-[#E6E9ED]">
              {state.auditLogs.slice(0, 5).map((log) => (
                <button
                  key={log.logId}
                  type="button"
                  onClick={() =>
                    navigateWithDrillDown('workflow', {
                      sourceLabel: `Chi tiết Nhật ký Kiểm toán: ${log.logId}`,
                      description: log.summary,
                      highlightAuditLogId: log.logId,
                    })
                  }
                  className="group w-full text-left py-2.5 px-2 -mx-2 rounded hover:bg-[#F7F7F7] transition-colors first:pt-1"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-mono font-semibold text-[#2A3F54] group-hover:text-[#169F85] inline-flex items-center gap-1">
                      {log.logId} · {log.actionType}
                      <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                    <span className="font-mono tabular-nums text-[#73879C]">
                      {new Date(log.timestamp).toLocaleString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-[#5A738E] mt-1 leading-snug">{log.summary}</p>
                  <div className="text-[11px] text-[#73879C] mt-0.5">Thực hiện: {log.executedBy}</div>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
