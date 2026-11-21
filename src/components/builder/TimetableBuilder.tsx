import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Brain,
  CalendarCheck,
  CheckCircle2,
  Combine,
  ExternalLink,
  Eye,
  GripVertical,
  Lock,
  Play,
  Search,
  ShieldAlert,
  Sparkles,
  Split,
  Unlock,
  X,
} from 'lucide-react';
import { useUTS } from '../../context/UTSContext';
import {
  DAY_LABELS,
  ROOM_TYPE_LABELS,
  SHIFT_DEFS,
  checkScheduleConflict,
  evaluateCSPCost,
  formatRoomTypesList,
  generateICalendarContent,
  getAllowedRoomTypesForSection,
  getDateForWeekAndDay,
  getPeriodTimeRange,
  getShiftForPeriod,
} from '../../engine/conflictEngine';
import type { AlternativeSlotSuggestion, ClassSession, ConflictViolation } from '../../types/uts';
import { DrillDownBanner, ExportToolbar } from '../common/ExportToolbar';
import { triggerDownload } from '../../utils/exportUtils';

type ViewMode = 'ROOM' | 'CLASS' | 'INSTRUCTOR' | 'FACULTY';

interface DragPayload {
  kind: 'SECTION' | 'SESSION';
  sectionId: string;
  sessionId?: string;
  totalPeriods: number;
}

interface ConflictModalState {
  sectionId: string;
  sessionId?: string;
  targetRoomId: string;
  dayOfWeek: number;
  startPeriod: number;
  totalPeriods: number;
  violations: ConflictViolation[];
  suggestions: AlternativeSlotSuggestion[];
  executionTimeMs: number;
}

export const TimetableBuilder: React.FC = () => {
  const {
    state,
    drillDown,
    navigateWithDrillDown,
    currentRole,
    roleCapabilities,
    assignSession,
    splitSection,
    mergeSections,
    autoSolveCSP,
    toggleFreeze,
    addToast,
  } = useUTS();

  const [viewMode, setViewMode] = useState<ViewMode>('ROOM');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [targetRoomForDrop, setTargetRoomForDrop] = useState<string>('ROOM_A1_201');
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [hoverCell, setHoverCell] = useState<{ day: number; shiftId: string; roomId: string } | null>(null);
  const [conflictModal, setConflictModal] = useState<ConflictModalState | null>(null);

  // Drill-down panels & record detail modal
  const [slotInspect, setSlotInspect] = useState<{
    day: number;
    shift: 'MORNING' | 'AFTERNOON' | 'EVENING';
  } | null>(null);
  const [showCspAudit, setShowCspAudit] = useState<boolean>(false);
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<ClassSession | null>(null);

  // Merge modal state
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSelectedIds, setMergeSelectedIds] = useState<string[]>([]);

  // Manual assign modal (click fallback for non-drag users)
  const [assignModalSectionId, setAssignModalSectionId] = useState<string | null>(null);
  const [manualDay, setManualDay] = useState<number>(3);
  const [manualShiftStart, setManualShiftStart] = useState<number>(1);
  const [manualRoomId, setManualRoomId] = useState<string>('ROOM_A1_201');

  // AI High Thinking CSP Advisor drawer state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiQuestion, setAiQuestion] = useState(
    'Phân tích tải giảng đường hiện tại, đề xuất chiến lược giãn tải buổi sáng giữa tuần và xử lý các lớp Lab chưa xếp lịch.'
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Consume Dashboard drill-down context automatically
  useEffect(() => {
    if (!drillDown) return;
    if (drillDown.builderViewMode) {
      setViewMode(drillDown.builderViewMode);
    }
    if (drillDown.builderEntityId) {
      setSelectedEntityId(drillDown.builderEntityId);
    } else if (drillDown.builderViewMode) {
      setSelectedEntityId('ALL');
    }
    if (drillDown.builderFocus === 'SLOT_DETAIL' && drillDown.builderDay && drillDown.builderShift) {
      setSlotInspect({ day: drillDown.builderDay, shift: drillDown.builderShift });
      setShowCspAudit(false);
    } else if (drillDown.builderFocus === 'CSP_AUDIT') {
      setShowCspAudit(true);
      setSlotInspect(null);
    } else if (drillDown.builderFocus === 'UNASSIGNED') {
      setSlotInspect(null);
      setShowCspAudit(false);
    }
  }, [drillDown]);

  // Auto-scope grid when switching roles (when not arriving from an explicit Dashboard drill-down)
  useEffect(() => {
    if (drillDown) return;
    if (currentRole.role === 'INSTRUCTOR' && currentRole.instructorId) {
      setViewMode('INSTRUCTOR');
      setSelectedEntityId(currentRole.instructorId);
    } else if (currentRole.role === 'STUDENT' && currentRole.classId) {
      setViewMode('CLASS');
      setSelectedEntityId(currentRole.classId);
    } else if (currentRole.role === 'FACULTY_HEAD' && currentRole.facultyId) {
      setViewMode('FACULTY');
      setSelectedEntityId(currentRole.facultyId);
    } else {
      setViewMode('ROOM');
      setSelectedEntityId('ALL');
    }
  }, [currentRole, drillDown]);

  const canEdit = !state.isFrozen && roleCapabilities.permissions.canEditSchedule;

  const cspReport = useMemo(() => evaluateCSPCost(state, state.activeWeek), [state]);

  // Active sessions in current week
  const weekSessions = useMemo(
    () => state.sessions.filter((s) => s.weekIndex === state.activeWeek),
    [state.sessions, state.activeWeek]
  );

  // Unassigned queue
  const unassignedSections = useMemo(() => {
    const scheduledIds = new Set(
      weekSessions
        .filter((s) => s.status !== 'CANCELLED' && s.status !== 'RESCHEDULED')
        .map((s) => s.sectionId)
    );
    return state.sections.filter((sec) => sec.status === 'OPEN' || !scheduledIds.has(sec.sectionId));
  }, [state.sections, weekSessions]);

  // Filter sessions based on 4 View Modes + Search Query
  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return weekSessions.filter((s) => {
      const sec = state.sections.find((x) => x.sectionId === s.sectionId);
      const course = state.courses.find((c) => c.courseId === sec?.courseId);
      const room = state.classrooms.find((r) => r.roomId === s.roomId);
      const leadId = sec?.instructors.find((i) => i.role === 'LEAD')?.instructorId;
      const instr = state.instructors.find((i) => i.instructorId === leadId);

      if (selectedEntityId !== 'ALL') {
        if (viewMode === 'ROOM' && s.roomId !== selectedEntityId) return false;
        if (viewMode === 'CLASS' && !sec?.cohortClassIds.includes(selectedEntityId)) return false;
        if (viewMode === 'INSTRUCTOR' && !sec?.instructors.some((i) => i.instructorId === selectedEntityId)) {
          return false;
        }
        if (viewMode === 'FACULTY' && course?.facultyId !== selectedEntityId) return false;
      }

      if (q) {
        const hay = [
          course?.courseCode,
          course?.courseName,
          sec?.sectionCode,
          room?.roomCode,
          instr?.fullName,
          s.sessionId,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [weekSessions, viewMode, selectedEntityId, searchQuery, state.sections, state.courses, state.classrooms, state.instructors]);

  // Slot Detail computation (for Heatmap drill-down)
  const slotDetailData = useMemo(() => {
    if (!slotInspect) return null;
    const shiftMeta = SHIFT_DEFS.find((s) => s.id === slotInspect.shift);
    const sessionsInSlot = weekSessions.filter(
      (s) =>
        s.dayOfWeek === slotInspect.day &&
        getShiftForPeriod(s.startPeriod) === slotInspect.shift &&
        s.status !== 'CANCELLED' &&
        s.status !== 'RESCHEDULED'
    );
    const busyRoomIds = new Set(sessionsInSlot.map((s) => s.roomId));
    const freeRooms = state.classrooms.filter(
      (r) => r.operationalStatus === 'AVAILABLE' && !busyRoomIds.has(r.roomId)
    );
    return {
      dayLabel: DAY_LABELS[slotInspect.day],
      dateStr: getDateForWeekAndDay(state.activeWeek, slotInspect.day),
      shiftMeta,
      sessionsInSlot,
      freeRooms,
    };
  }, [slotInspect, weekSessions, state.classrooms, state.activeWeek]);

  // CSP Audit detailed rows (sessions contributing to soft penalties)
  const cspAuditSessions = useMemo(() => {
    return weekSessions
      .filter((s) => s.status !== 'CANCELLED' && s.status !== 'RESCHEDULED')
      .map((s) => {
        const sec = state.sections.find((x) => x.sectionId === s.sectionId);
        const course = state.courses.find((c) => c.courseId === sec?.courseId);
        const room = state.classrooms.find((r) => r.roomId === s.roomId);
        const sfr = sec && room && room.maxCapacity > 0 ? Math.round((sec.enrolledCount / room.maxCapacity) * 100) : 0;
        const issues: string[] = [];
        if (sfr < 45) issues.push(`BR_RULE_10: Lấp đầy thấp (${sfr}%)`);
        if (s.startPeriod >= 11) issues.push('SFT_EVENING: Xếp ca tối');
        if (sec && room && sec.enrolledCount > room.maxCapacity) issues.push('HARD_CAPACITY: Vượt sức chứa');
        return {
          session: s,
          courseCode: course?.courseCode ?? '—',
          courseName: course?.courseName ?? '—',
          sectionCode: sec?.sectionCode ?? '—',
          roomCode: room?.roomCode ?? '—',
          enrolled: sec?.enrolledCount ?? 0,
          capacity: room?.maxCapacity ?? 0,
          sfr,
          issues,
        };
      });
  }, [weekSessions, state.sections, state.courses, state.classrooms]);

  const entityOptions = useMemo(() => {
    if (viewMode === 'ROOM') {
      return state.classrooms.map((r) => ({
        id: r.roomId,
        label: `${r.roomCode} — ${r.roomName} (${r.maxCapacity} chỗ)`,
      }));
    }
    if (viewMode === 'CLASS') {
      return state.classes.map((c) => ({
        id: c.classId,
        label: `${c.classCode} — ${c.className} (${c.studentCount} SV)`,
      }));
    }
    if (viewMode === 'INSTRUCTOR') {
      return state.instructors.map((i) => ({
        id: i.instructorId,
        label: `${i.title} ${i.fullName} (${i.staffCode})`,
      }));
    }
    return state.faculties.map((f) => ({
      id: f.facultyId,
      label: `${f.code} — ${f.name}`,
    }));
  }, [viewMode, state]);

  const effectiveRoomIdForDrop = useMemo(() => {
    if (viewMode === 'ROOM' && selectedEntityId !== 'ALL') return selectedEntityId;
    return targetRoomForDrop;
  }, [viewMode, selectedEntityId, targetRoomForDrop]);

  const evaluateDropPreview = (day: number, startPeriod: number) => {
    if (!dragging) return null;
    return checkScheduleConflict(state, {
      sectionId: dragging.sectionId,
      roomId: effectiveRoomIdForDrop,
      weekIndex: state.activeWeek,
      dayOfWeek: day,
      startPeriod,
      totalPeriods: dragging.totalPeriods,
      excludeSessionId: dragging.sessionId,
      includeSuggestions: false,
    });
  };

  const executeAssignment = async (
    sectionId: string,
    roomId: string,
    dayOfWeek: number,
    startPeriod: number,
    totalPeriods: number,
    sessionId?: string
  ) => {
    if (state.isFrozen) {
      addToast({
        type: 'warning',
        title: 'Thời khóa biểu đang Đóng băng (Mốc T-1)',
        detail: 'Vui lòng mở khóa dự thảo hoặc sử dụng Cổng Phê duyệt Biến động Lịch.',
      });
      return;
    }

    const localCheck = checkScheduleConflict(state, {
      sectionId,
      roomId,
      weekIndex: state.activeWeek,
      dayOfWeek,
      startPeriod,
      totalPeriods,
      excludeSessionId: sessionId,
      includeSuggestions: true,
    });

    if (!localCheck.isValid) {
      setConflictModal({
        sectionId,
        sessionId,
        targetRoomId: roomId,
        dayOfWeek,
        startPeriod,
        totalPeriods,
        violations: localCheck.violations,
        suggestions: localCheck.suggestions,
        executionTimeMs: localCheck.executionTimeMs,
      });
      return;
    }

    const res = await assignSession({
      session_id: sessionId,
      section_id: sectionId,
      room_id: roomId,
      day_of_week: dayOfWeek,
      start_period: startPeriod,
      total_periods: totalPeriods,
    });

    if (!res.ok && res.error) {
      setConflictModal({
        sectionId,
        sessionId,
        targetRoomId: roomId,
        dayOfWeek,
        startPeriod,
        totalPeriods,
        violations: res.error.violations ?? [
          { severity: 'HARD', code: res.error.code ?? 'HARD_ERR_ROOM_DOUBLE_BOOKED', message: res.error.message },
        ],
        suggestions: res.error.suggestions ?? [],
        executionTimeMs: 12,
      });
    }
  };

  const triggerUAC01Test = () => {
    const ma102 = state.sections.find((s) => s.sectionId === 'SEC_MA102_01') ?? unassignedSections[0];
    if (!ma102) {
      addToast({
        type: 'info',
        title: 'Lớp MA102 đã được xếp lịch trước đó',
        detail: 'Bạn có thể thử kéo bất kỳ buổi học nào trùng vào phòng A1-201 Thứ Ba Tiết 1-4.',
      });
      return;
    }
    executeAssignment(ma102.sectionId, 'ROOM_A1_201', 3, 1, 4);
  };

  const runAiCspAnalyze = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);
    try {
      const res = await fetch('/api/v1/ai/csp-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: aiQuestion }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setAiError(json.error?.message || 'Không thể kết nối mô hình suy luận AI.');
      } else {
        setAiResult(json.data.analysis);
      }
    } catch {
      setAiError('Lỗi kết nối tới máy chủ phân tích CSP.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleExportGridICal = () => {
    const ics = generateICalendarContent(
      state,
      filteredSessions,
      `TKB Tuần ${state.activeWeek} (${viewMode})`
    );
    triggerDownload(
      `UTS_TKB_Tuan${state.activeWeek}_${viewMode}.ics`,
      ics,
      'text/calendar;charset=utf-8;'
    );
    addToast({
      type: 'success',
      title: `Đã xuất lịch iCalendar (.ics) — ${filteredSessions.length} buổi học`,
      detail: 'Tương thích Google Calendar, Apple Calendar và Microsoft Outlook.',
    });
  };

  const statusTone = (status: string) => {
    switch (status) {
      case 'MAKEUP':
        return 'border-[#F39C12] bg-[#FFFBEB] text-[#92400E]';
      case 'ROOM_CHANGED':
        return 'border-[#9B59B6] bg-[#FAF5FF] text-[#6B21A8]';
      case 'CANCELLED':
        return 'border-[#CBD5E1] bg-[#F8FAFC] text-[#94A3B8] line-through opacity-75';
      case 'PENDING_CHANGE':
        return 'border-[#F59E0B] bg-[#FEF3C7] text-[#92400E]';
      default:
        return 'border-[#3498DB]/50 bg-[#EFF6FF] text-[#1E3A5F]';
    }
  };

  const statusText = (status: string) => {
    switch (status) {
      case 'MAKEUP':
        return 'Học bù';
      case 'ROOM_CHANGED':
        return 'Đổi phòng';
      case 'CANCELLED':
        return 'Đã báo nghỉ';
      case 'PENDING_CHANGE':
        return 'Chờ duyệt đổi';
      default:
        return 'Chính thức';
    }
  };

  // Exportable rows for main timetable grid
  const exportableGridRows = useMemo(() => {
    return filteredSessions.map((sess) => {
      const sec = state.sections.find((x) => x.sectionId === sess.sectionId);
      const course = state.courses.find((c) => c.courseId === sec?.courseId);
      const room = state.classrooms.find((r) => r.roomId === sess.roomId);
      const leadId = sec?.instructors.find((i) => i.role === 'LEAD')?.instructorId;
      const instr = state.instructors.find((i) => i.instructorId === leadId);
      const cohorts = (sec?.cohortClassIds ?? [])
        .map((cid) => state.classes.find((c) => c.classId === cid)?.classCode)
        .filter(Boolean)
        .join('; ');
      return {
        sessionId: sess.sessionId,
        day: DAY_LABELS[sess.dayOfWeek],
        date: sess.sessionDate,
        periods: `T${sess.startPeriod}-${sess.startPeriod + sess.totalPeriods - 1}`,
        timeRange: getPeriodTimeRange(sess.startPeriod, sess.totalPeriods),
        courseCode: course?.courseCode ?? '',
        courseName: course?.courseName ?? '',
        sectionCode: sec?.sectionCode ?? '',
        enrolled: sec?.enrolledCount ?? 0,
        roomCode: room?.roomCode ?? '',
        roomCapacity: room?.maxCapacity ?? 0,
        instructor: instr ? `${instr.title} ${instr.fullName}` : '',
        cohorts,
        status: statusText(sess.status),
      };
    });
  }, [filteredSessions, state.sections, state.courses, state.classrooms, state.instructors, state.classes]);

  const exportableUnassignedRows = useMemo(() => {
    return unassignedSections.map((sec) => {
      const course = state.courses.find((c) => c.courseId === sec.courseId);
      const leadId = sec.instructors.find((i) => i.role === 'LEAD')?.instructorId;
      const instr = state.instructors.find((i) => i.instructorId === leadId);
      return {
        sectionCode: sec.sectionCode,
        courseCode: course?.courseCode ?? '',
        courseName: course?.courseName ?? '',
        enrolledCount: sec.enrolledCount,
        roomType: ROOM_TYPE_LABELS[sec.requiredRoomType],
        periodsPerSession: sec.periodsPerSession,
        instructor: instr ? `${instr.title} ${instr.fullName}` : 'Chưa gán',
        groupLabel: sec.groupLabel ?? 'Toàn lớp',
      };
    });
  }, [unassignedSections, state.courses, state.instructors]);

  // Detail modal computed references
  const detailSessionMeta = useMemo(() => {
    if (!selectedSessionDetail) return null;
    const sec = state.sections.find((x) => x.sectionId === selectedSessionDetail.sectionId);
    const course = state.courses.find((c) => c.courseId === sec?.courseId);
    const room = state.classrooms.find((r) => r.roomId === selectedSessionDetail.roomId);
    const building = state.buildings.find((b) => b.buildingId === room?.buildingId);
    const faculty = state.faculties.find((f) => f.facultyId === course?.facultyId);
    const cohorts = (sec?.cohortClassIds ?? [])
      .map((cid) => state.classes.find((c) => c.classId === cid))
      .filter(Boolean);
    const sfr = sec && room && room.maxCapacity > 0 ? Math.round((sec.enrolledCount / room.maxCapacity) * 100) : 0;
    return { sec, course, room, building, faculty, cohorts, sfr };
  }, [selectedSessionDetail, state]);

  return (
    <div className="space-y-4">
      <DrillDownBanner />

      {/* SLOT DETAIL PANEL (Heatmap Drill-down) */}
      {slotDetailData && slotInspect && (
        <section className="x_panel border border-[#1ABB9C]/50">
          <div className="x_title flex flex-wrap items-center justify-between gap-2 bg-[#F0FDF4]">
            <div>
              <h3 className="text-[14px] font-bold text-[#2A3F54]">
                Chi tiết Khung giờ: {slotDetailData.dayLabel} ({slotDetailData.dateStr}) · {slotDetailData.shiftMeta?.label} ({slotDetailData.shiftMeta?.periodsLabel})
              </h3>
              <p className="text-xs text-[#5A738E] mt-0.5">
                Đang sử dụng <strong className="font-mono text-[#2A3F54]">{slotDetailData.sessionsInSlot.length}</strong> buổi học · Còn trống{' '}
                <strong className="font-mono text-[#169F85]">{slotDetailData.freeRooms.length}</strong> phòng khả dụng
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ExportToolbar
                compact
                filenameBase={`UTS_ChiTietKhungGio_T${slotInspect.day}_${slotInspect.shift}`}
                reportTitle={`Chi tiết khung giờ ${slotDetailData.dayLabel} - ${slotDetailData.shiftMeta?.label}`}
                columns={[
                  { header: 'Mã buổi', accessor: (r) => r.sessionId },
                  { header: 'Học phần', accessor: (r) => r.course },
                  { header: 'Lớp HP', accessor: (r) => r.section },
                  { header: 'Phòng', accessor: (r) => r.room },
                  { header: 'Sĩ số / Sức chứa', accessor: (r) => r.cap },
                  { header: 'Giảng viên', accessor: (r) => r.instructor },
                ]}
                rows={slotDetailData.sessionsInSlot.map((s) => {
                  const sec = state.sections.find((x) => x.sectionId === s.sectionId);
                  const crs = state.courses.find((c) => c.courseId === sec?.courseId);
                  const rm = state.classrooms.find((r) => r.roomId === s.roomId);
                  const leadId = sec?.instructors.find((i) => i.role === 'LEAD')?.instructorId;
                  const ins = state.instructors.find((i) => i.instructorId === leadId);
                  return {
                    sessionId: s.sessionId,
                    course: `${crs?.courseCode ?? ''} - ${crs?.courseName ?? ''}`,
                    section: sec?.sectionCode ?? '',
                    room: rm?.roomCode ?? '',
                    cap: `${sec?.enrolledCount ?? 0}/${rm?.maxCapacity ?? 0}`,
                    instructor: ins ? `${ins.title} ${ins.fullName}` : '',
                  };
                })}
              />
              <button
                type="button"
                onClick={() => setSlotInspect(null)}
                className="p-1 text-[#5A738E] hover:text-[#2A3F54]"
                aria-label="Đóng bảng chi tiết khung giờ"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="x_content grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
            <div className="lg:col-span-7 overflow-x-auto">
              <div className="font-bold text-[#2A3F54] mb-2">
                Danh sách Buổi học Đang diễn ra ({slotDetailData.sessionsInSlot.length})
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[#E6E9ED] text-[#5A738E] text-left">
                    <th className="py-1.5 pr-2">Phòng</th>
                    <th className="py-1.5 px-2">Học phần</th>
                    <th className="py-1.5 px-2">Giảng viên</th>
                    <th className="py-1.5 px-2 text-right">Sĩ số/Sức chứa</th>
                    <th className="py-1.5 pl-2 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E9ED]">
                  {slotDetailData.sessionsInSlot.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-[#73879C]">
                        Không có buổi học nào được xếp trong khung giờ này.
                      </td>
                    </tr>
                  ) : (
                    slotDetailData.sessionsInSlot.map((s) => {
                      const sec = state.sections.find((x) => x.sectionId === s.sectionId);
                      const crs = state.courses.find((c) => c.courseId === sec?.courseId);
                      const rm = state.classrooms.find((r) => r.roomId === s.roomId);
                      const leadId = sec?.instructors.find((i) => i.role === 'LEAD')?.instructorId;
                      const ins = state.instructors.find((i) => i.instructorId === leadId);
                      return (
                        <tr key={s.sessionId} className="hover:bg-[#F7F7F7]">
                          <td className="py-2 pr-2 font-mono font-bold text-[#169F85]">{rm?.roomCode}</td>
                          <td className="py-2 px-2">
                            <span className="font-mono font-semibold text-[#2A3F54]">{crs?.courseCode}</span>{' '}
                            <span className="text-[#5A738E]">{crs?.courseName}</span>
                          </td>
                          <td className="py-2 px-2 text-[#5A738E]">{ins ? `${ins.title} ${ins.fullName}` : '—'}</td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums">
                            {sec?.enrolledCount}/{rm?.maxCapacity}
                          </td>
                          <td className="py-2 pl-2 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedSessionDetail(s)}
                              className="text-[#3498DB] hover:underline font-semibold inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" /> Xem
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-[#E6E9ED] pt-3 lg:pt-0 lg:pl-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-[#169F85]">
                  Phòng học Còn trống trong Ca này ({slotDetailData.freeRooms.length})
                </div>
                <ExportToolbar
                  compact
                  filenameBase={`UTS_PhongTrong_T${slotInspect.day}_${slotInspect.shift}`}
                  reportTitle={`Danh sách phòng trống ${slotDetailData.dayLabel} ${slotDetailData.shiftMeta?.label}`}
                  columns={[
                    { header: 'Mã phòng', accessor: (r) => r.roomCode },
                    { header: 'Tên phòng', accessor: (r) => r.roomName },
                    { header: 'Loại phòng', accessor: (r) => ROOM_TYPE_LABELS[r.roomType] },
                    { header: 'Sức chứa', accessor: (r) => r.maxCapacity },
                  ]}
                  rows={slotDetailData.freeRooms}
                />
              </div>
              <div className="space-y-1.5 max-h-[210px] overflow-y-auto">
                {slotDetailData.freeRooms.map((r) => (
                  <div
                    key={r.roomId}
                    className="px-2.5 py-2 rounded border border-[#E6E9ED] bg-[#FAFAFA] flex items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-mono font-bold text-[#2A3F54]">{r.roomCode}</span>{' '}
                      <span className="text-[#5A738E]">· {ROOM_TYPE_LABELS[r.roomType]}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono tabular-nums">
                      <span className="text-[#2A3F54] font-semibold">{r.maxCapacity} chỗ</span>
                      <button
                        type="button"
                        onClick={() => {
                          setTargetRoomForDrop(r.roomId);
                          addToast({
                            type: 'info',
                            title: `Đã chọn ${r.roomCode} làm phòng mục tiêu kéo thả`,
                          });
                        }}
                        className="font-sans text-[11px] font-semibold text-[#169F85] hover:underline"
                      >
                        Chọn gán
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CSP AUDIT BREAKDOWN PANEL (CSP KPI Drill-down) */}
      {showCspAudit && (
        <section className="x_panel border border-[#3498DB]/50">
          <div className="x_title flex flex-wrap items-center justify-between gap-2 bg-[#EFF6FF]">
            <div>
              <h3 className="text-[14px] font-bold text-[#2A3F54]">
                Báo cáo Kiểm định Ràng buộc CSP — Xung đột cứng: {cspReport.hardViolationCount} · Tổng điểm phạt Cost(S): {cspReport.totalSoftCost}
              </h3>
              <p className="text-xs text-[#5A738E] mt-0.5">
                Phân rã chi tiết từng quy tắc ràng buộc mềm và kiểm tra từng buổi học đang vận hành trong Tuần {state.activeWeek}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ExportToolbar
                compact
                filenameBase={`UTS_KiemDinhCSP_Tuan${state.activeWeek}`}
                reportTitle={`Báo cáo Kiểm định Ràng buộc CSP Tuần ${state.activeWeek}`}
                columns={[
                  { header: 'Mã buổi', accessor: (r) => r.session.sessionId },
                  { header: 'Học phần', accessor: (r) => `${r.courseCode} - ${r.courseName}` },
                  { header: 'Lớp HP', accessor: (r) => r.sectionCode },
                  { header: 'Phòng', accessor: (r) => r.roomCode },
                  { header: 'Sĩ số', accessor: (r) => r.enrolled },
                  { header: 'Sức chứa', accessor: (r) => r.capacity },
                  { header: 'SFR (%)', accessor: (r) => r.sfr },
                  { header: 'Ghi nhận ràng buộc', accessor: (r) => (r.issues.length ? r.issues.join('; ') : 'Đạt chuẩn 100%') },
                ]}
                rows={cspAuditSessions}
              />
              <button
                type="button"
                onClick={() => setShowCspAudit(false)}
                className="p-1 text-[#5A738E] hover:text-[#2A3F54]"
                aria-label="Đóng bảng kiểm định CSP"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="x_content space-y-3 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {cspReport.breakdown.map((b) => (
                <div key={b.ruleCode} className="p-3 rounded border border-[#E6E9ED] bg-[#FAFAFA]">
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-bold text-[#2A3F54]">{b.ruleCode}</span>
                    <span className={b.violations > 0 ? 'text-[#D97706] font-bold' : 'text-[#169F85] font-bold'}>
                      {b.violations} vi phạm · +{b.cost}đ
                    </span>
                  </div>
                  <div className="text-[11px] text-[#5A738E] mt-1">{b.label} (Trọng số w={b.weight})</div>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto max-h-[220px]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[#E6E9ED] text-[#5A738E] text-left">
                    <th className="py-1.5 pr-2">Học phần / Lớp HP</th>
                    <th className="py-1.5 px-2">Phòng</th>
                    <th className="py-1.5 px-2 text-right">Sĩ số / Sức chứa</th>
                    <th className="py-1.5 px-2 text-right">SFR</th>
                    <th className="py-1.5 px-2">Đánh giá Ràng buộc</th>
                    <th className="py-1.5 pl-2 text-right">Xem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E9ED]">
                  {cspAuditSessions.map((row) => (
                    <tr key={row.session.sessionId} className="hover:bg-[#F7F7F7]">
                      <td className="py-1.5 pr-2">
                        <span className="font-mono font-bold text-[#2A3F54]">{row.courseCode}</span> · {row.sectionCode}
                      </td>
                      <td className="py-1.5 px-2 font-mono">{row.roomCode}</td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {row.enrolled}/{row.capacity}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold">
                        <span className={row.sfr < 45 ? 'text-[#D97706]' : 'text-[#169F85]'}>{row.sfr}%</span>
                      </td>
                      <td className="py-1.5 px-2">
                        {row.issues.length === 0 ? (
                          <span className="text-[#169F85] font-medium">Đạt chuẩn tối ưu</span>
                        ) : (
                          <span className="text-[#B45309] font-medium">{row.issues.join(' · ')}</span>
                        )}
                      </td>
                      <td className="py-1.5 pl-2 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedSessionDetail(row.session)}
                          className="text-[#3498DB] hover:underline font-semibold"
                        >
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Control Toolbar Panel */}
      <section className="x_panel">
        <div className="x_title flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* 4-Dimension View Mode Segmented Control */}
            <div className="inline-flex bg-[#F2F5F7] p-1 rounded border border-[#D9DEE4]">
              {(
                [
                  { id: 'ROOM', label: 'Theo Phòng học' },
                  { id: 'CLASS', label: 'Theo Lớp cơ hữu' },
                  { id: 'INSTRUCTOR', label: 'Theo Giảng viên' },
                  { id: 'FACULTY', label: 'Theo Khoa / BM' },
                ] as { id: ViewMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setViewMode(m.id);
                    setSelectedEntityId('ALL');
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                    viewMode === m.id
                      ? 'bg-[#2A3F54] text-white'
                      : 'text-[#5A738E] hover:text-[#2A3F54]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <select
              value={selectedEntityId}
              onChange={(e) => setSelectedEntityId(e.target.value)}
              aria-label="Lọc đối tượng chi tiết"
              className="text-xs bg-white border border-[#D9DEE4] rounded px-3 py-2 text-[#2A3F54] font-medium min-w-[200px] focus:outline-none focus:border-[#1ABB9C]"
            >
              <option value="ALL">Hiển thị tất cả ({entityOptions.length})</option>
              {entityOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#73879C] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm mã môn, phòng, GV..."
                className="text-xs bg-white border border-[#D9DEE4] rounded pl-8 pr-3 py-2 text-[#2A3F54] w-[180px] focus:outline-none focus:border-[#1ABB9C]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={triggerUAC01Test}
              className="px-3 py-1.5 text-xs font-semibold rounded border border-[#E74C3C]/40 bg-[#FEF2F2] text-[#B91C1C] hover:bg-[#FEE2E2] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Kiểm thử UAC-01
            </button>
            <button
              type="button"
              onClick={() => setMergeOpen(true)}
              disabled={!canEdit}
              className="px-3 py-1.5 text-xs font-semibold rounded border border-[#D9DEE4] bg-white text-[#2A3F54] hover:border-[#1ABB9C] disabled:opacity-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Combine className="w-3.5 h-3.5 text-[#3498DB]" />
              Ghép lớp Lý thuyết
            </button>
            <button
              type="button"
              onClick={autoSolveCSP}
              disabled={!canEdit || unassignedSections.length === 0}
              className="px-3 py-1.5 text-xs font-semibold rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white disabled:opacity-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              Tự động Xếp lịch CSP
            </button>
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded bg-[#2A3F54] hover:bg-[#172D44] text-white transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Brain className="w-3.5 h-3.5 text-[#1ABB9C]" />
              Phân tích CSP (AI)
            </button>
          </div>
        </div>

        {/* Sub-toolbar: Target Room Selector for Drag-Drop + Freeze State */}
        <div className="px-4 py-2.5 bg-[#FAFAFA] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-semibold text-[#2A3F54]">Phòng mục tiêu khi kéo thả:</span>
            <select
              value={effectiveRoomIdForDrop}
              onChange={(e) => {
                setTargetRoomForDrop(e.target.value);
                if (viewMode === 'ROOM' && selectedEntityId !== 'ALL') {
                  setSelectedEntityId(e.target.value);
                }
              }}
              className="text-xs bg-white border border-[#D9DEE4] rounded px-2.5 py-1 font-mono font-medium text-[#2A3F54] focus:outline-none focus:border-[#1ABB9C]"
            >
              {state.classrooms.map((r) => (
                <option key={r.roomId} value={r.roomId}>
                  {r.roomCode} · {ROOM_TYPE_LABELS[r.roomType]} · {r.maxCapacity} chỗ
                  {r.operationalStatus !== 'AVAILABLE' ? ` [${r.operationalStatus}]` : ''}
                </option>
              ))}
            </select>
            <span className="text-[#73879C]">
              Nhấn vào bất kỳ thẻ buổi học nào trên lưới để xem hồ sơ chi tiết bản ghi.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
            <button
              type="button"
              onClick={() => setShowCspAudit((v) => !v)}
              className="text-[#2A3F54] hover:underline"
            >
              Xung đột cứng: <strong className="text-[#169F85]">{cspReport.hardViolationCount}</strong> · Cost(S):{' '}
              <strong className="text-[#3498DB]">{cspReport.totalSoftCost}</strong>
            </button>
            <button
              type="button"
              disabled={!roleCapabilities.permissions.canFreezeTimetable}
              onClick={() => toggleFreeze(!state.isFrozen)}
              className={`px-2.5 py-1 rounded text-[11px] font-sans font-semibold inline-flex items-center gap-1 border whitespace-nowrap shrink-0 disabled:opacity-50 ${
                state.isFrozen
                  ? 'bg-[#FFF7ED] border-[#F39C12] text-[#B45309]'
                  : 'bg-white border-[#D9DEE4] text-[#2A3F54] hover:border-[#2A3F54]'
              }`}
            >
              {state.isFrozen ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              {state.isFrozen ? 'Đã khóa T-1' : 'Dự thảo T-4'}
            </button>
          </div>
        </div>
      </section>

      {/* Main Workspace: Unassigned Queue (3 cols) + Interactive Grid (9 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Unassigned Sections Queue */}
        <aside
          className={`x_panel xl:col-span-3 ${
            drillDown?.builderFocus === 'UNASSIGNED' ? 'ring-2 ring-[#F39C12]' : ''
          }`}
        >
          <div className="x_title space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-bold text-[#2A3F54]">
                  Hàng đợi Chưa xếp lịch ({unassignedSections.length})
                </h3>
                <p className="text-[11px] text-[#73879C] mt-0.5">Kéo thả vào lưới hoặc nhấn gán nhanh</p>
              </div>
            </div>
            {unassignedSections.length > 0 && (
              <ExportToolbar
                compact
                filenameBase={`UTS_HangDoiChuaXepLich_Tuan${state.activeWeek}`}
                reportTitle={`Hàng đợi Lớp học phần chưa xếp lịch Tuần ${state.activeWeek}`}
                columns={[
                  { header: 'Mã LHP', accessor: (r) => r.sectionCode },
                  { header: 'Mã HP', accessor: (r) => r.courseCode },
                  { header: 'Tên học phần', accessor: (r) => r.courseName },
                  { header: 'Sĩ số', accessor: (r) => r.enrolledCount },
                  { header: 'Loại phòng yêu cầu', accessor: (r) => r.roomType },
                  { header: 'Tiết/buổi', accessor: (r) => r.periodsPerSession },
                  { header: 'Giảng viên', accessor: (r) => r.instructor },
                  { header: 'Phân nhóm', accessor: (r) => r.groupLabel },
                ]}
                rows={exportableUnassignedRows}
              />
            )}
          </div>
          <div className="p-3 space-y-2.5 max-h-[640px] overflow-y-auto">
            {unassignedSections.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#73879C] space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#1ABB9C] mx-auto" />
                <div className="font-semibold text-[#2A3F54]">100% lớp học phần đã được xếp lịch</div>
                <p>Không còn khối học phần nào tồn đọng trong hàng đợi Tuần {state.activeWeek}.</p>
              </div>
            ) : (
              unassignedSections.map((sec) => {
                const course = state.courses.find((c) => c.courseId === sec.courseId);
                const leadId = sec.instructors.find((i) => i.role === 'LEAD')?.instructorId;
                const instr = state.instructors.find((i) => i.instructorId === leadId);
                const needsLabSplit = sec.requiredRoomType === 'LAB_COMP' && sec.enrolledCount > 35;

                return (
                  <div
                    key={sec.sectionId}
                    draggable={canEdit}
                    onDragStart={() =>
                      setDragging({
                        kind: 'SECTION',
                        sectionId: sec.sectionId,
                        totalPeriods: sec.periodsPerSession,
                      })
                    }
                    onDragEnd={() => {
                      setDragging(null);
                      setHoverCell(null);
                    }}
                    className={`p-3 rounded border bg-white transition-colors ${
                      canEdit ? 'cursor-grab active:cursor-grabbing hover:border-[#1ABB9C]' : 'opacity-80'
                    } border-[#D9DEE4]`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-bold text-[#2A3F54] truncate">
                          {course?.courseCode} · {sec.sectionCode}
                        </div>
                        <div className="text-xs font-semibold text-[#34495E] mt-0.5 leading-snug">
                          {course?.courseName}
                        </div>
                      </div>
                      <GripVertical className="w-4 h-4 text-[#94A3B8] shrink-0 mt-0.5" />
                    </div>

                    <div className="mt-2 text-[11px] text-[#5A738E] space-y-0.5">
                      <div>
                        Sĩ số: <strong className="font-mono text-[#2A3F54]">{sec.enrolledCount} SV</strong> · Phòng:{' '}
                        <span className="text-[#169F85] font-medium">
                          {formatRoomTypesList(getAllowedRoomTypesForSection(sec, course))}
                        </span>
                      </div>
                      <div>
                        GV: {instr ? `${instr.title} ${instr.fullName}` : 'Chưa phân công'} ·{' '}
                        <span className="font-mono">{sec.periodsPerSession} tiết</span>
                      </div>
                      {sec.groupLabel && (
                        <div className="text-[#D97706] font-medium">{sec.groupLabel}</div>
                      )}
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-[#E6E9ED] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => {
                          setAssignModalSectionId(sec.sectionId);
                          setManualRoomId(effectiveRoomIdForDrop);
                        }}
                        className="text-[11px] font-semibold text-[#169F85] hover:underline disabled:opacity-50"
                      >
                        Chọn slot thủ công
                      </button>
                      {needsLabSplit && (
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => splitSection(sec.sectionId, 2)}
                          className="px-2 py-1 text-[11px] font-semibold rounded bg-[#FFF7ED] border border-[#F39C12]/50 text-[#B45309] hover:bg-[#FFEDD5] inline-flex items-center gap-1"
                        >
                          <Split className="w-3 h-3" />
                          Tách 2 tốp Lab
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Interactive Timetable Matrix Grid (Mon-Sat x 3 Shifts) */}
        <section className="x_panel xl:col-span-9">
          <div className="x_title flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-bold text-[#2A3F54]">
                Ma trận Thời khóa biểu Tuần {state.activeWeek} (23/11 – 28/11/2026)
              </h3>
              <p className="text-xs text-[#73879C] mt-0.5">
                Hiển thị {filteredSessions.length} buổi học · Nhấn vào từng buổi học để xem hồ sơ chi tiết hoặc kéo thả để đổi ca
              </p>
            </div>
            <ExportToolbar
              compact
              filenameBase={`UTS_ThoiKhoaBieu_Tuan${state.activeWeek}_${viewMode}`}
              reportTitle={`Thời khóa biểu Tuần ${state.activeWeek} (${viewMode})`}
              onExportICal={handleExportGridICal}
              columns={[
                { header: 'Mã buổi', accessor: (r) => r.sessionId },
                { header: 'Thứ', accessor: (r) => r.day },
                { header: 'Ngày học', accessor: (r) => r.date },
                { header: 'Tiết', accessor: (r) => r.periods },
                { header: 'Khung giờ', accessor: (r) => r.timeRange },
                { header: 'Mã HP', accessor: (r) => r.courseCode },
                { header: 'Tên học phần', accessor: (r) => r.courseName },
                { header: 'Lớp HP', accessor: (r) => r.sectionCode },
                { header: 'Sĩ số', accessor: (r) => r.enrolled },
                { header: 'Phòng', accessor: (r) => r.roomCode },
                { header: 'Sức chứa', accessor: (r) => r.roomCapacity },
                { header: 'Giảng viên', accessor: (r) => r.instructor },
                { header: 'Lớp cơ hữu', accessor: (r) => r.cohorts },
                { header: 'Trạng thái', accessor: (r) => r.status },
              ]}
              rows={exportableGridRows}
            />
          </div>

          <div className="p-3 overflow-x-auto">
            <table className="w-full border-collapse min-w-[820px] table-fixed">
              <thead>
                <tr className="bg-[#2A3F54] text-white text-xs">
                  <th className="py-2.5 px-3 text-left font-semibold w-[112px] border border-[#35495D]">
                    Ca / Tiết học
                  </th>
                  {[2, 3, 4, 5, 6, 7].map((day) => (
                    <th key={day} className="py-2.5 px-2 text-center font-semibold border border-[#35495D]">
                      <div>{DAY_LABELS[day]}</div>
                      <div className="text-[10px] font-mono text-white/70 font-normal">
                        {getDateForWeekAndDay(state.activeWeek, day).slice(5).split('-').reverse().join('/')}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SHIFT_DEFS.map((shift) => (
                  <tr key={shift.id}>
                    <td className="p-3 border border-[#E6E9ED] bg-[#FAFAFA] align-top">
                      <div className="text-xs font-bold text-[#2A3F54]">{shift.label}</div>
                      <div className="text-[11px] font-mono text-[#169F85] font-semibold mt-0.5">
                        {shift.periodsLabel}
                      </div>
                      <div className="text-[10px] font-mono text-[#73879C] mt-1">{shift.timeRange}</div>
                    </td>
                    {[2, 3, 4, 5, 6, 7].map((day) => {
                      const cellSessions = filteredSessions.filter(
                        (s) => s.dayOfWeek === day && getShiftForPeriod(s.startPeriod) === shift.id
                      );

                      const isInspectedSlot =
                        slotInspect?.day === day && slotInspect?.shift === shift.id;
                      const isHovering = hoverCell?.day === day && hoverCell?.shiftId === shift.id;
                      const preview = isHovering ? evaluateDropPreview(day, shift.startPeriod) : null;

                      let dropBorderClass = isInspectedSlot
                        ? 'border-2 border-[#1ABB9C] bg-[#F0FDF4]/60'
                        : 'border-[#E6E9ED] bg-white';
                      if (preview) {
                        if (!preview.isValid) {
                          dropBorderClass = 'border-2 border-[#EF4444] bg-[#FEF2F2]';
                        } else if (preview.hasWarnings) {
                          dropBorderClass = 'border-2 border-[#F39C12] bg-[#FFFBEB]';
                        } else {
                          dropBorderClass = 'border-2 border-[#22C55E] bg-[#F0FDF4]';
                        }
                      }

                      return (
                        <td
                          key={day}
                          onDragOver={(e) => {
                            if (!canEdit || !dragging) return;
                            e.preventDefault();
                            setHoverCell({ day, shiftId: shift.id, roomId: effectiveRoomIdForDrop });
                          }}
                          onDragLeave={() => setHoverCell(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setHoverCell(null);
                            if (!dragging) return;
                            executeAssignment(
                              dragging.sectionId,
                              effectiveRoomIdForDrop,
                              day,
                              shift.startPeriod,
                              dragging.totalPeriods,
                              dragging.sessionId
                            );
                            setDragging(null);
                          }}
                          className={`p-1.5 border align-top min-h-[120px] transition-colors ${dropBorderClass}`}
                        >
                          {preview && (
                            <div
                              className={`mb-1.5 px-2 py-1 rounded text-[10px] font-semibold ${
                                !preview.isValid
                                  ? 'bg-[#EF4444] text-white'
                                  : preview.hasWarnings
                                    ? 'bg-[#F39C12] text-white'
                                    : 'bg-[#22C55E] text-white'
                              }`}
                            >
                              {!preview.isValid
                                ? `Xung đột: ${preview.violations[0]?.code.replace('HARD_ERR_', '')}`
                                : preview.hasWarnings
                                  ? 'Khả dụng (Có lưu ý mềm)'
                                  : `Thả vào ${state.classrooms.find((r) => r.roomId === effectiveRoomIdForDrop)?.roomCode}`}
                            </div>
                          )}

                          <div className="space-y-1.5 min-h-[104px]">
                            {cellSessions.map((sess) => {
                              const sec = state.sections.find((x) => x.sectionId === sess.sectionId);
                              const course = state.courses.find((c) => c.courseId === sec?.courseId);
                              const room = state.classrooms.find((r) => r.roomId === sess.roomId);
                              const leadId = sec?.instructors.find((i) => i.role === 'LEAD')?.instructorId;
                              const instr = state.instructors.find((i) => i.instructorId === leadId);

                              return (
                                <div
                                  key={sess.sessionId}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => setSelectedSessionDetail(sess)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setSelectedSessionDetail(sess);
                                    }
                                  }}
                                  draggable={canEdit && sess.status !== 'CANCELLED'}
                                  onDragStart={() =>
                                    setDragging({
                                      kind: 'SESSION',
                                      sectionId: sess.sectionId,
                                      sessionId: sess.sessionId,
                                      totalPeriods: sess.totalPeriods,
                                    })
                                  }
                                  onDragEnd={() => {
                                    setDragging(null);
                                    setHoverCell(null);
                                  }}
                                  className={`p-2 rounded border text-[11px] leading-snug transition-colors hover:ring-1 hover:ring-[#2A3F54] cursor-pointer ${statusTone(sess.status)}`}
                                >
                                  <div className="flex items-center justify-between gap-1 font-mono font-bold">
                                    <span className="truncate">{course?.courseCode}</span>
                                    <span className="shrink-0">{room?.roomCode}</span>
                                  </div>
                                  <div className="font-semibold truncate mt-0.5" title={course?.courseName}>
                                    {course?.courseName}
                                  </div>
                                  <div className="text-[10px] opacity-85 truncate mt-0.5">
                                    {instr ? `${instr.title} ${instr.fullName}` : 'Chưa gán GV'}
                                  </div>
                                  <div className="text-[10px] opacity-80 flex items-center justify-between mt-1 pt-1 border-t border-current/15 font-mono">
                                    <span>T{sess.startPeriod}-{sess.startPeriod + sess.totalPeriods - 1}</span>
                                    <span className="font-sans font-semibold">{statusText(sess.status)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CSP Soft Constraint Breakdown Bar */}
          <div className="px-4 py-3 border-t border-[#E6E9ED] bg-[#FAFAFA] flex flex-wrap items-center justify-between gap-3 text-[11px]">
            <div className="flex flex-wrap items-center gap-3 text-[#5A738E]">
              <span>● Chính thức</span>
              <span className="text-[#B45309]">● Học bù</span>
              <span className="text-[#6B21A8]">● Đổi phòng</span>
              <span className="text-[#94A3B8] line-through">● Báo nghỉ</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[#5A738E]">
              {cspReport.breakdown.map((item) => (
                <button
                  key={item.ruleCode}
                  type="button"
                  onClick={() => setShowCspAudit(true)}
                  className="font-mono tabular-nums hover:underline"
                >
                  {item.ruleCode}: <strong className={item.violations > 0 ? 'text-[#D97706]' : 'text-[#169F85]'}>{item.violations}</strong> (w={item.weight})
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* SESSION RECORD DETAIL MODAL */}
      {selectedSessionDetail && detailSessionMeta && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded border border-[#D9DEE4] shadow-xl max-w-[600px] w-full overflow-hidden">
            <div className="px-5 py-3.5 bg-[#2A3F54] text-white flex items-center justify-between">
              <div>
                <div className="font-mono text-[11px] text-[#1ABB9C]">
                  Hồ sơ Buổi học · {selectedSessionDetail.sessionId}
                </div>
                <h4 className="text-sm font-bold mt-0.5">
                  {detailSessionMeta.course?.courseCode} — {detailSessionMeta.course?.courseName}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSessionDetail(null)}
                className="text-white/75 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#FAFAFA] border border-[#E6E9ED] rounded p-3">
                <div>
                  <div className="text-[11px] text-[#73879C]">Ngày & Ca học</div>
                  <div className="font-bold text-[#2A3F54] mt-0.5">
                    {DAY_LABELS[selectedSessionDetail.dayOfWeek]} ({selectedSessionDetail.sessionDate})
                  </div>
                  <div className="font-mono text-[11px] text-[#169F85]">
                    Tiết {selectedSessionDetail.startPeriod}-
                    {selectedSessionDetail.startPeriod + selectedSessionDetail.totalPeriods - 1} (
                    {getPeriodTimeRange(selectedSessionDetail.startPeriod, selectedSessionDetail.totalPeriods)})
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#73879C]">Phòng học & Tòa nhà</div>
                  <div className="font-mono font-bold text-[#2A3F54] mt-0.5">
                    {detailSessionMeta.room?.roomCode} ({detailSessionMeta.room?.maxCapacity} chỗ)
                  </div>
                  <div className="text-[11px] text-[#5A738E]">
                    {detailSessionMeta.building?.buildingName} · Tầng {detailSessionMeta.room?.floorNumber}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#73879C]">Sĩ số & Lấp đầy (SFR)</div>
                  <div className="font-mono font-bold text-[#2A3F54] mt-0.5">
                    {detailSessionMeta.sec?.enrolledCount} / {detailSessionMeta.room?.maxCapacity} SV
                  </div>
                  <div
                    className={`font-mono text-[11px] font-semibold ${
                      detailSessionMeta.sfr < 45 ? 'text-[#D97706]' : 'text-[#169F85]'
                    }`}
                  >
                    SFR: {detailSessionMeta.sfr}% · {statusText(selectedSessionDetail.status)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="font-bold text-[#2A3F54] mb-1">Thông tin Học phần & Định mức tiết</div>
                  <div className="text-[#5A738E] space-y-1">
                    <div>Lớp HP: <span className="font-mono font-semibold text-[#2A3F54]">{detailSessionMeta.sec?.sectionCode}</span></div>
                    <div>Khoa phụ trách: <strong>{detailSessionMeta.faculty?.name}</strong></div>
                    <div>
                      Cấu phần ({detailSessionMeta.course?.credits} TC):{' '}
                      <span className="font-mono text-[#2A3F54]">
                        LT {detailSessionMeta.course?.theoryPeriods} · BT {detailSessionMeta.course?.exercisePeriods} · TL {detailSessionMeta.course?.discussionPeriods} · TH {detailSessionMeta.course?.practicalPeriods}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="font-bold text-[#2A3F54] mb-1">Đội ngũ Giảng viên & Lớp cơ hữu</div>
                  <div className="text-[#5A738E] space-y-1">
                    {(detailSessionMeta.sec?.instructors ?? []).map((asg) => {
                      const ins = state.instructors.find((i) => i.instructorId === asg.instructorId);
                      return (
                        <div key={asg.assignmentId}>
                          <strong>{ins ? `${ins.title} ${ins.fullName}` : asg.instructorId}</strong> ({asg.role})
                        </div>
                      );
                    })}
                    <div>
                      Lớp cơ hữu:{' '}
                      <span className="font-mono text-[#2A3F54]">
                        {detailSessionMeta.cohorts.map((c) => c!.classCode).join(', ') || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedSessionDetail.note && (
                <div className="p-2.5 rounded bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E]">
                  <strong>Ghi chú vận hành:</strong> {selectedSessionDetail.note}
                </div>
              )}
            </div>
            <div className="px-5 py-3 bg-[#F7F7F7] border-t border-[#E6E9ED] flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const ics = generateICalendarContent(
                      state,
                      [selectedSessionDetail],
                      `${detailSessionMeta.course?.courseCode ?? 'UTS'} - ${selectedSessionDetail.sessionDate}`
                    );
                    triggerDownload(
                      `UTS_${detailSessionMeta.course?.courseCode ?? 'Session'}_${selectedSessionDetail.sessionDate}.ics`,
                      ics,
                      'text/calendar;charset=utf-8;'
                    );
                    addToast({ type: 'success', title: 'Đã xuất tệp iCalendar (.ics) cho buổi học' });
                  }}
                  className="px-3 py-1.5 rounded bg-[#3498DB] hover:bg-[#2980B9] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  Xuất .ICS buổi này
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const sId = selectedSessionDetail.sessionId;
                    setSelectedSessionDetail(null);
                    navigateWithDrillDown('workflow', {
                      sourceLabel: `Điều chỉnh buổi học ${detailSessionMeta.course?.courseCode ?? sId}`,
                      description: `Chuyển tới Cổng Đổi lịch từ hồ sơ buổi học ${sId}`,
                      workflowFilter: 'ALL',
                    });
                  }}
                  className="px-3 py-1.5 rounded border border-[#D9DEE4] bg-white hover:border-[#1ABB9C] text-[#2A3F54] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#1ABB9C]" />
                  Cổng Báo nghỉ / Đổi lịch
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSessionDetail(null)}
                className="px-4 py-1.5 rounded bg-[#2A3F54] hover:bg-[#172D44] text-white text-xs font-semibold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFLICT ANALYSIS & TOP-3 SMART ALTERNATIVES MODAL (SRS-WEB-03 & UAC-01) */}
      {conflictModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded border border-[#E74C3C] shadow-xl max-w-[680px] w-full overflow-hidden">
            <div className="px-5 py-3.5 bg-[#FEF2F2] border-b border-[#FECACA] flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-[#B91C1C]">
                <AlertOctagon className="w-5 h-5 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold">
                    Phát hiện Xung đột Cứng — Đã chặn thao tác xếp lịch (HTTP 409)
                  </h4>
                  <div className="text-[11px] font-mono text-[#991B1B]">
                    Real-time Conflict Engine · Thời gian quét: {conflictModal.executionTimeMs}ms
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConflictModal(null)}
                className="text-[#991B1B] hover:text-[#7F1D1D]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="space-y-2">
                {conflictModal.violations.map((v, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded border text-xs ${
                      v.severity === 'HARD'
                        ? 'bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]'
                        : 'bg-[#FFFBEB] border-[#FCD34D] text-[#92400E]'
                    }`}
                  >
                    <div className="font-mono font-bold text-[11px] flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {v.code} ({v.severity === 'HARD' ? 'Ràng buộc cứng' : 'Cảnh báo mềm'})
                    </div>
                    <p className="mt-1 leading-relaxed">{v.message}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-[#2A3F54] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#1ABB9C]" />
                    Đề xuất Top {conflictModal.suggestions.length} Phương án Thay thế Khả dĩ Nhất (BR-TT-03)
                  </h5>
                  <span className="text-[11px] text-[#73879C]">Ưu tiên lấp đầy chỗ ngồi min(C_phong - S_lop)</span>
                </div>

                {conflictModal.suggestions.length === 0 ? (
                  <div className="p-4 rounded border border-[#E6E9ED] bg-[#F7F7F7] text-xs text-[#5A738E]">
                    Không tìm thấy phòng trống cùng sức chứa trong tuần này. Khuyến nghị sử dụng tính năng{' '}
                    <strong>Tách tốp thực hành Lab</strong> để chia nhỏ sĩ số lớp.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {conflictModal.suggestions.map((sug) => (
                      <div
                        key={`${sug.roomId}_${sug.dayOfWeek}_${sug.startPeriod}`}
                        className="p-3 rounded border border-[#D9DEE4] hover:border-[#1ABB9C] bg-[#FAFAFA] flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5 text-xs">
                          <div className="font-bold text-[#2A3F54]">
                            Phương án #{sug.rank}: Phòng <span className="font-mono text-[#169F85]">{sug.roomCode}</span> ({sug.roomCapacity} chỗ) ·{' '}
                            {DAY_LABELS[sug.dayOfWeek]} ({sug.sessionDate}) · Tiết {sug.startPeriod}-
                            {sug.startPeriod + sug.totalPeriods - 1}
                          </div>
                          <div className="text-[11px] text-[#5A738E]">
                            {sug.reason} · Khung giờ {getPeriodTimeRange(sug.startPeriod, sug.totalPeriods)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await assignSession({
                              session_id: conflictModal.sessionId,
                              section_id: conflictModal.sectionId,
                              room_id: sug.roomId,
                              day_of_week: sug.dayOfWeek,
                              start_period: sug.startPeriod,
                              total_periods: sug.totalPeriods,
                            });
                            if (res.ok) setConflictModal(null);
                          }}
                          className="px-3 py-1.5 text-xs font-semibold rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white whitespace-nowrap"
                        >
                          Áp dụng ngay
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-3 bg-[#F7F7F7] border-t border-[#E6E9ED] flex justify-end">
              <button
                type="button"
                onClick={() => setConflictModal(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded border border-[#D9DEE4] bg-white text-[#2A3F54] hover:bg-[#EDEDED]"
              >
                Đóng & giữ vị trí cũ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL ASSIGN MODAL */}
      {assignModalSectionId && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded border border-[#D9DEE4] shadow-xl max-w-[460px] w-full">
            <div className="px-5 py-3.5 border-b border-[#E6E9ED] flex items-center justify-between">
              <h4 className="text-sm font-bold text-[#2A3F54]">Chọn Khung giờ & Phòng học</h4>
              <button type="button" onClick={() => setAssignModalSectionId(null)} className="text-[#73879C]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#2A3F54] mb-1">Thứ trong tuần</label>
                <select
                  value={manualDay}
                  onChange={(e) => setManualDay(Number(e.target.value))}
                  className="w-full border border-[#D9DEE4] rounded px-3 py-2 bg-white"
                >
                  {[2, 3, 4, 5, 6, 7].map((d) => (
                    <option key={d} value={d}>
                      {DAY_LABELS[d]} ({getDateForWeekAndDay(state.activeWeek, d)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#2A3F54] mb-1">Ca học (4 tiết chuẩn)</label>
                <select
                  value={manualShiftStart}
                  onChange={(e) => setManualShiftStart(Number(e.target.value))}
                  className="w-full border border-[#D9DEE4] rounded px-3 py-2 bg-white"
                >
                  <option value={1}>Ca Sáng (Tiết 1 - 4 · 07:00 - 10:40)</option>
                  <option value={6}>Ca Chiều (Tiết 6 - 9 · 13:00 - 16:40)</option>
                  <option value={11}>Ca Tối (Tiết 11 - 13 · 18:00 - 20:40)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#2A3F54] mb-1">Phòng học phân bổ</label>
                <select
                  value={manualRoomId}
                  onChange={(e) => setManualRoomId(e.target.value)}
                  className="w-full border border-[#D9DEE4] rounded px-3 py-2 bg-white font-mono"
                >
                  {state.classrooms.map((r) => (
                    <option key={r.roomId} value={r.roomId}>
                      {r.roomCode} · {ROOM_TYPE_LABELS[r.roomType]} · {r.maxCapacity} chỗ
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-5 py-3 bg-[#F7F7F7] border-t border-[#E6E9ED] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAssignModalSectionId(null)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded border border-[#D9DEE4] bg-white text-[#5A738E]"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={async () => {
                  const secId = assignModalSectionId;
                  setAssignModalSectionId(null);
                  await executeAssignment(secId, manualRoomId, manualDay, manualShiftStart, manualShiftStart === 11 ? 3 : 4);
                }}
                className="px-4 py-1.5 text-xs font-semibold rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white"
              >
                Kiểm tra & Gán lịch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MERGE THEORY SECTIONS MODAL (BR-TT-04) */}
      {mergeOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded border border-[#D9DEE4] shadow-xl max-w-[520px] w-full">
            <div className="px-5 py-3.5 border-b border-[#E6E9ED] flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-[#2A3F54]">Ghép Lớp Lý thuyết vào Hội trường lớn (BR-TT-04)</h4>
                <p className="text-[11px] text-[#73879C]">Chọn từ 2 lớp lý thuyết trở lên để gộp sĩ số và tối ưu giảng viên</p>
              </div>
              <button type="button" onClick={() => setMergeOpen(false)} className="text-[#73879C]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-[360px] overflow-y-auto">
              {state.sections
                .filter((s) => s.sessionType === 'THEORY')
                .map((sec) => {
                  const course = state.courses.find((c) => c.courseId === sec.courseId);
                  const checked = mergeSelectedIds.includes(sec.sectionId);
                  return (
                    <label
                      key={sec.sectionId}
                      className={`flex items-center justify-between p-3 rounded border cursor-pointer text-xs ${
                        checked ? 'border-[#1ABB9C] bg-[#1ABB9C]/5' : 'border-[#E6E9ED] hover:bg-[#F7F7F7]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setMergeSelectedIds((prev) =>
                              prev.includes(sec.sectionId)
                                ? prev.filter((id) => id !== sec.sectionId)
                                : [...prev, sec.sectionId]
                            )
                          }
                          className="accent-[#1ABB9C]"
                        />
                        <div>
                          <div className="font-mono font-bold text-[#2A3F54]">{sec.sectionCode}</div>
                          <div className="text-[#5A738E]">{course?.courseName}</div>
                        </div>
                      </div>
                      <span className="font-mono font-semibold text-[#2A3F54]">{sec.enrolledCount} SV</span>
                    </label>
                  );
                })}
            </div>
            <div className="px-5 py-3 bg-[#F7F7F7] border-t border-[#E6E9ED] flex items-center justify-between">
              <span className="text-xs text-[#5A738E]">
                Tổng sĩ số sau ghép:{' '}
                <strong className="font-mono text-[#2A3F54]">
                  {state.sections
                    .filter((s) => mergeSelectedIds.includes(s.sectionId))
                    .reduce((acc, s) => acc + s.enrolledCount, 0)}{' '}
                  SV
                </strong>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMergeOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded border border-[#D9DEE4] bg-white text-[#5A738E]"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={mergeSelectedIds.length < 2}
                  onClick={async () => {
                    const ok = await mergeSections(mergeSelectedIds);
                    if (ok) {
                      setMergeSelectedIds([]);
                      setMergeOpen(false);
                    }
                  }}
                  className="px-4 py-1.5 text-xs font-semibold rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white disabled:opacity-50"
                >
                  Xác nhận Ghép lớp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI HIGH THINKING CSP ADVISOR DRAWER */}
      {aiOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-end">
          <div className="bg-white h-full w-full max-w-[540px] shadow-2xl border-l border-[#D9DEE4] flex flex-col">
            <div className="px-5 py-4 bg-[#2A3F54] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Brain className="w-5 h-5 text-[#1ABB9C]" />
                <div>
                  <h4 className="text-sm font-bold">Trợ lý Suy luận Chuyên sâu CSP (Thinking High)</h4>
                  <p className="text-[11px] text-white/75">Phân tích đa biến ràng buộc cứng/mềm & tối ưu công suất giảng đường</p>
                </div>
              </div>
              <button type="button" onClick={() => setAiOpen(false)} className="text-white/75 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#2A3F54] mb-1.5">Câu hỏi hoặc bài toán điều phối phức tạp</label>
                <textarea
                  rows={3}
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  className="w-full border border-[#D9DEE4] rounded p-3 text-xs text-[#2A3F54] focus:outline-none focus:border-[#1ABB9C]"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={runAiCspAnalyze}
                  className="px-4 py-2 rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white font-semibold disabled:opacity-60 inline-flex items-center gap-2"
                >
                  <Brain className="w-4 h-4" />
                  {aiLoading ? 'Đang suy luận đa biến...' : 'Chạy Phân tích Suy luận Sâu'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    autoSolveCSP();
                    setAiOpen(false);
                  }}
                  className="px-3.5 py-2 rounded border border-[#D9DEE4] bg-white text-[#2A3F54] font-semibold hover:border-[#1ABB9C]"
                >
                  Chạy Bộ giải CSP nội bộ ngay
                </button>
              </div>

              {aiError && (
                <div className="p-3.5 rounded border border-[#F39C12] bg-[#FFFBEB] text-[#92400E] leading-relaxed">
                  <div className="font-bold mb-1">Thông báo cấu hình API suy luận chuyên sâu</div>
                  <p>{aiError}</p>
                </div>
              )}

              {aiResult && (
                <div className="p-4 rounded border border-[#E6E9ED] bg-[#F7F7F7] text-[#2A3F54] whitespace-pre-wrap leading-relaxed">
                  {aiResult}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
