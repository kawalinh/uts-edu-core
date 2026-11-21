import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  FilePlus2,
  History,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { useUTS } from '../../context/UTSContext';
import {
  DAY_LABELS,
  findTopAlternativeSlots,
  getPeriodTimeRange,
} from '../../engine/conflictEngine';
import type { ApprovalStatus, AuditLog, ChangeRequestType } from '../../types/uts';
import { DrillDownBanner, ExportToolbar } from '../common/ExportToolbar';

const STATUS_META: Record<ApprovalStatus, { label: string; colorClass: string }> = {
  PENDING_FACULTY_APPROVAL: { label: 'Chờ duyệt Cấp 1 (Khoa / Bộ môn)', colorClass: 'text-[#D97706]' },
  PENDING_ACADEMIC_APPROVAL: { label: 'Chờ duyệt Cấp 2 (Phòng Đào tạo)', colorClass: 'text-[#2563EB]' },
  APPROVED: { label: 'Đã phê duyệt & Ban hành', colorClass: 'text-[#169F85]' },
  REJECTED: { label: 'Đã từ chối', colorClass: 'text-[#E74C3C]' },
  ROLLED_BACK: { label: 'Đã quay lui (Rollback)', colorClass: 'text-[#73879C]' },
};

const REQ_TYPE_LABELS: Record<ChangeRequestType, string> = {
  LEAVE_AND_MAKEUP: 'Báo nghỉ đột xuất & Dạy bù',
  RESCHEDULE_TIME: 'Đổi ca / giờ dạy',
  CHANGE_ROOM: 'Đổi phòng học',
};

type WorkflowFilterMode = 'ALL' | 'PENDING' | 'DECIDED' | 'SLA_TRACKING' | 'SVI_CHANGES';

export const ChangeManagementHub: React.FC = () => {
  const {
    state,
    drillDown,
    currentRole,
    switchRole,
    submitChangeRequest,
    processRequestAction,
    rollbackAudit,
  } = useUTS();

  const [filterStatus, setFilterStatus] = useState<WorkflowFilterMode>('ALL');
  const [reqSearch, setReqSearch] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [notesByReq, setNotesByReq] = useState<Record<string, string>>({});
  const [overrideRoomByReq, setOverrideRoomByReq] = useState<Record<string, string>>({});
  const [selectedAuditDetail, setSelectedAuditDetail] = useState<AuditLog | null>(null);

  const auditSectionRef = useRef<HTMLElement | null>(null);

  // Create new request modal
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('SES_UAC02_WEB');
  const [reqType, setReqType] = useState<ChangeRequestType>('LEAVE_AND_MAKEUP');
  const [reasonCode, setReasonCode] = useState<'SICKNESS' | 'BUSINESS_TRIP' | 'FACILITY_ISSUE' | 'PERSONAL'>('SICKNESS');
  const [reasonDetail, setReasonDetail] = useState('Giảng viên đi công tác đột xuất, đề xuất dạy bù tại phòng trống không xung đột.');
  const [chosenSlotIndex, setChosenSlotIndex] = useState<number>(0);

  // Consume Dashboard drill-down context
  useEffect(() => {
    if (!drillDown) return;
    if (drillDown.workflowFilter) {
      setFilterStatus(drillDown.workflowFilter);
    }
    if (drillDown.highlightAuditLogId) {
      const found = state.auditLogs.find((l) => l.logId === drillDown.highlightAuditLogId);
      if (found) {
        setSelectedAuditDetail(found);
      }
      setTimeout(() => {
        auditSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  }, [drillDown, state.auditLogs]);

  // SVI changed sessions in current week (for SVI KPI drill-down)
  const sviChangedSessions = useMemo(() => {
    return state.sessions
      .filter(
        (s) =>
          s.weekIndex === state.activeWeek &&
          (s.status === 'CANCELLED' ||
            s.status === 'RESCHEDULED' ||
            s.status === 'MAKEUP' ||
            s.status === 'ROOM_CHANGED' ||
            s.status === 'PENDING_CHANGE')
      )
      .map((s) => {
        const sec = state.sections.find((x) => x.sectionId === s.sectionId);
        const crs = state.courses.find((c) => c.courseId === sec?.courseId);
        const rm = state.classrooms.find((r) => r.roomId === s.roomId);
        const leadId = sec?.instructors.find((i) => i.role === 'LEAD')?.instructorId;
        const ins = state.instructors.find((i) => i.instructorId === leadId);
        return {
          session: s,
          courseCode: crs?.courseCode ?? '',
          courseName: crs?.courseName ?? '',
          sectionCode: sec?.sectionCode ?? '',
          roomCode: rm?.roomCode ?? '',
          instructor: ins ? `${ins.title} ${ins.fullName}` : '',
        };
      });
  }, [state.sessions, state.sections, state.courses, state.classrooms, state.instructors, state.activeWeek]);

  const filteredRequests = useMemo(() => {
    const q = reqSearch.trim().toLowerCase();
    return state.changeRequests.filter((r) => {
      if (filterStatus === 'PENDING') {
        if (r.approvalStatus !== 'PENDING_FACULTY_APPROVAL' && r.approvalStatus !== 'PENDING_ACADEMIC_APPROVAL') {
          return false;
        }
      } else if (filterStatus === 'DECIDED') {
        if (r.approvalStatus === 'PENDING_FACULTY_APPROVAL' || r.approvalStatus === 'PENDING_ACADEMIC_APPROVAL') {
          return false;
        }
      }
      if (q) {
        const origSession = state.sessions.find((s) => s.sessionId === r.originalSessionId);
        const sec = state.sections.find((s) => s.sectionId === origSession?.sectionId);
        const crs = state.courses.find((c) => c.courseId === sec?.courseId);
        const reqIns = state.instructors.find((i) => i.instructorId === r.requesterId);
        const hay = `${r.requestId} ${crs?.courseCode ?? ''} ${crs?.courseName ?? ''} ${reqIns?.fullName ?? ''} ${r.reasonDetail}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [state.changeRequests, state.sessions, state.sections, state.courses, state.instructors, filterStatus, reqSearch]);

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return state.auditLogs.filter((l) => {
      if (!q) return true;
      return `${l.logId} ${l.actionType} ${l.entityName} ${l.summary} ${l.executedBy}`.toLowerCase().includes(q);
    });
  }, [state.auditLogs, auditSearch]);

  const availableSlotsForCreate = useMemo(() => {
    const sess = state.sessions.find((s) => s.sessionId === selectedSessionId);
    if (!sess) return [];
    return findTopAlternativeSlots(state, {
      sectionId: sess.sectionId,
      preferredDayOfWeek: 7,
      preferredStartPeriod: 1,
      totalPeriods: sess.totalPeriods,
      weekIndex: sess.weekIndex,
      excludeSessionId: sess.sessionId,
      limit: 5,
    });
  }, [selectedSessionId, state]);

  const canApproveLevel1 =
    currentRole.role === 'FACULTY_HEAD' || currentRole.role === 'SYS_ADMIN' || currentRole.role === 'EXECUTIVE';
  const canApproveLevel2 =
    currentRole.role === 'SCHEDULER' || currentRole.role === 'SYS_ADMIN' || currentRole.role === 'EXECUTIVE';

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const slot = availableSlotsForCreate[chosenSlotIndex];
    if (!slot) return;
    const origSess = state.sessions.find((s) => s.sessionId === selectedSessionId);
    const sec = state.sections.find((x) => x.sectionId === origSess?.sectionId);
    const leadInstrId = sec?.instructors.find((i) => i.role === 'LEAD')?.instructorId ?? 'INS_01';

    const res = await submitChangeRequest({
      original_session_id: selectedSessionId,
      requester_id: leadInstrId,
      request_type: reqType,
      reason_code: reasonCode,
      reason_detail: reasonDetail,
      proposed_makeup: {
        day_of_week: slot.dayOfWeek,
        start_period: slot.startPeriod,
        total_periods: slot.totalPeriods,
        preferred_room_id: slot.roomId,
        date: slot.sessionDate,
      },
    });
    if (res.ok) setCreateOpen(false);
  };

  return (
    <div className="space-y-5">
      <DrillDownBanner />

      {/* SVI VOLATILITY DETAIL SECTION (Shown prominently when drilling from Dashboard SVI KPI or SVI_CHANGES tab) */}
      {filterStatus === 'SVI_CHANGES' && (
        <section className="x_panel border border-[#3498DB]/50">
          <div className="x_title flex flex-wrap items-center justify-between gap-3 bg-[#EFF6FF]">
            <div>
              <h2 className="text-[15px] font-bold text-[#2A3F54]">
                Chi tiết Các Buổi học Biến động trong Tuần {state.activeWeek} (Chỉ số SVI)
              </h2>
              <p className="text-xs text-[#5A738E] mt-0.5">
                Liệt kê toàn bộ buổi học có trạng thái Báo nghỉ, Học bù, Đổi phòng hoặc Đang chờ duyệt đổi ({sviChangedSessions.length} bản ghi)
              </p>
            </div>
            <ExportToolbar
              compact
              filenameBase={`UTS_BienDongLich_SVI_Tuan${state.activeWeek}`}
              reportTitle={`Chi tiết Biến động Lịch học (SVI) Tuần ${state.activeWeek}`}
              columns={[
                { header: 'Mã buổi', accessor: (r) => r.session.sessionId },
                { header: 'Mã HP', accessor: (r) => r.courseCode },
                { header: 'Tên học phần', accessor: (r) => r.courseName },
                { header: 'Lớp HP', accessor: (r) => r.sectionCode },
                { header: 'Ngày học', accessor: (r) => `${DAY_LABELS[r.session.dayOfWeek]} (${r.session.sessionDate})` },
                { header: 'Tiết', accessor: (r) => `T${r.session.startPeriod}-${r.session.startPeriod + r.session.totalPeriods - 1}` },
                { header: 'Phòng', accessor: (r) => r.roomCode },
                { header: 'Giảng viên', accessor: (r) => r.instructor },
                { header: 'Trạng thái SVI', accessor: (r) => r.session.status },
                { header: 'Ghi chú', accessor: (r) => r.session.note ?? '' },
              ]}
              rows={sviChangedSessions}
            />
          </div>
          <div className="x_content overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-[#E6E9ED] text-[#5A738E] text-left">
                  <th className="py-2 pr-3 font-semibold">Mã buổi</th>
                  <th className="py-2 px-2 font-semibold">Học phần / Lớp HP</th>
                  <th className="py-2 px-2 font-semibold">Ngày & Tiết</th>
                  <th className="py-2 px-2 font-semibold">Phòng</th>
                  <th className="py-2 px-2 font-semibold">Giảng viên</th>
                  <th className="py-2 px-2 font-semibold">Trạng thái Biến động</th>
                  <th className="py-2 pl-2 font-semibold">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E9ED]">
                {sviChangedSessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-5 text-center text-[#73879C]">
                      Không có buổi học nào biến động trong Tuần {state.activeWeek} (SVI = 0%).
                    </td>
                  </tr>
                ) : (
                  sviChangedSessions.map((r) => (
                    <tr key={r.session.sessionId} className="hover:bg-[#F7F7F7]">
                      <td className="py-2.5 pr-3 font-mono font-bold text-[#2A3F54]">{r.session.sessionId}</td>
                      <td className="py-2.5 px-2">
                        <span className="font-mono font-bold text-[#2A3F54]">{r.courseCode}</span> — {r.courseName}
                        <div className="text-[11px] font-mono text-[#73879C]">{r.sectionCode}</div>
                      </td>
                      <td className="py-2.5 px-2">
                        <div>{DAY_LABELS[r.session.dayOfWeek]} ({r.session.sessionDate})</div>
                        <div className="font-mono text-[11px] text-[#5A738E]">
                          T{r.session.startPeriod}-{r.session.startPeriod + r.session.totalPeriods - 1}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 font-mono font-bold text-[#169F85]">{r.roomCode}</td>
                      <td className="py-2.5 px-2 text-[#5A738E]">{r.instructor}</td>
                      <td className="py-2.5 px-2 font-semibold text-[#D97706]">{r.session.status}</td>
                      <td className="py-2.5 pl-2 text-[#5A738E]">{r.session.note || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Workflow Header & Role Helper */}
      <section className="x_panel">
        <div className="x_title flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-[#2A3F54]">
              Cổng Tiếp nhận & Phê duyệt Biến động Lịch Đa cấp (BR-CM-01 & BR-CM-02)
            </h2>
            <p className="text-xs text-[#73879C] mt-0.5">
              Chu trình trực tuyến 2 cấp: Giảng viên khởi tạo → Cấp 1: Trưởng Bộ môn (SLA 12h) → Cấp 2: Phòng Đào tạo cấp phòng (SLA 12h)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExportToolbar
              compact
              filenameBase="UTS_HoSoDoiLich_SLA"
              reportTitle="Danh sách Hồ sơ Báo nghỉ / Đổi lịch & Theo dõi SLA"
              columns={[
                { header: 'Mã hồ sơ', accessor: (r) => r.requestId },
                { header: 'Loại yêu cầu', accessor: (r) => REQ_TYPE_LABELS[r.requestType] },
                { header: 'Trạng thái', accessor: (r) => STATUS_META[r.approvalStatus].label },
                {
                  header: 'Người đề xuất',
                  accessor: (r) => {
                    const ins = state.instructors.find((i) => i.instructorId === r.requesterId);
                    return ins ? `${ins.title} ${ins.fullName}` : r.requesterId;
                  },
                },
                { header: 'Lý do', accessor: (r) => r.reasonDetail },
                { header: 'Ngày đề xuất bù', accessor: (r) => `${DAY_LABELS[r.proposedDayOfWeek]} (${r.proposedDate})` },
                {
                  header: 'Phòng đề xuất',
                  accessor: (r) => state.classrooms.find((rm) => rm.roomId === r.proposedRoomId)?.roomCode ?? '',
                },
                { header: 'Thời điểm tạo', accessor: (r) => r.createdAt },
                { header: 'Hạn SLA 24h', accessor: (r) => r.slaDeadline },
              ]}
              rows={filteredRequests}
            />
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="px-3.5 py-1.5 rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              Tạo đơn Báo nghỉ / Đổi lịch
            </button>
          </div>
        </div>

        {/* Filter & Role Switch Bar */}
        <div className="px-4 py-2.5 bg-[#FAFAFA] border-b border-[#E6E9ED] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex bg-[#F2F5F7] p-1 rounded border border-[#D9DEE4]">
              {(
                [
                  { id: 'ALL', label: `Tất cả (${state.changeRequests.length})` },
                  {
                    id: 'PENDING',
                    label: `Chờ duyệt (${state.changeRequests.filter((r) => r.approvalStatus.startsWith('PENDING')).length})`,
                  },
                  { id: 'DECIDED', label: 'Đã xử lý' },
                  { id: 'SLA_TRACKING', label: 'Giám sát SLA < 24h' },
                  { id: 'SVI_CHANGES', label: `Buổi biến động SVI (${sviChangedSessions.length})` },
                ] as { id: WorkflowFilterMode; label: string }[]
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFilterStatus(t.id)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                    filterStatus === t.id ? 'bg-[#2A3F54] text-white' : 'text-[#5A738E] hover:text-[#2A3F54]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#73879C] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={reqSearch}
                onChange={(e) => setReqSearch(e.target.value)}
                placeholder="Tìm mã đơn, môn, GV..."
                className="border border-[#D9DEE4] rounded pl-8 pr-2.5 py-1.5 bg-white w-[180px]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[#73879C]">Chuyển nhanh vai trò duyệt:</span>
            <button
              type="button"
              onClick={() => switchRole('FACULTY_HEAD')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold border whitespace-nowrap ${
                currentRole.role === 'FACULTY_HEAD'
                  ? 'bg-[#2A3F54] text-white border-[#2A3F54]'
                  : 'bg-white text-[#2A3F54] border-[#D9DEE4] hover:border-[#1ABB9C]'
              }`}
            >
              Trưởng Bộ môn (Cấp 1)
            </button>
            <button
              type="button"
              onClick={() => switchRole('SCHEDULER')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold border whitespace-nowrap ${
                currentRole.role === 'SCHEDULER'
                  ? 'bg-[#2A3F54] text-white border-[#2A3F54]'
                  : 'bg-white text-[#2A3F54] border-[#D9DEE4] hover:border-[#1ABB9C]'
              }`}
            >
              Phòng Đào tạo (Cấp 2)
            </button>
          </div>
        </div>

        {/* Requests List */}
        <div className="x_content space-y-4">
          {filteredRequests.map((req) => {
            const origSession = state.sessions.find((s) => s.sessionId === req.originalSessionId);
            const sec = state.sections.find((s) => s.sectionId === origSession?.sectionId);
            const course = state.courses.find((c) => c.courseId === sec?.courseId);
            const requester = state.instructors.find((i) => i.instructorId === req.requesterId);
            const oldRoom = state.classrooms.find((r) => r.roomId === origSession?.roomId);
            const proposedRoom = state.classrooms.find((r) => r.roomId === req.proposedRoomId);
            const statusInfo = STATUS_META[req.approvalStatus];

            const isLvl1 = req.approvalStatus === 'PENDING_FACULTY_APPROVAL';
            const isLvl2 = req.approvalStatus === 'PENDING_ACADEMIC_APPROVAL';
            const slaHoursLeft = Math.max(
              1,
              Math.round((new Date(req.slaDeadline).getTime() - Date.now()) / 3600000)
            );
            const elapsedHours = Math.max(
              0.2,
              Math.round(((Date.now() - new Date(req.createdAt).getTime()) / 3600000) * 10) / 10
            );

            return (
              <div
                key={req.requestId}
                className={`border rounded bg-white overflow-hidden ${
                  filterStatus === 'SLA_TRACKING' ? 'border-[#3498DB]/60' : 'border-[#D9DEE4]'
                }`}
              >
                <div className="px-4 py-3 bg-[#F7F7F7] border-b border-[#E6E9ED] flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-[#2A3F54]">{req.requestId}</span>
                    <span aria-hidden="true" className="text-[#94A3B8]">·</span>
                    <span className="font-semibold text-[#2A3F54]">{REQ_TYPE_LABELS[req.requestType]}</span>
                    <span aria-hidden="true" className="text-[#94A3B8]">·</span>
                    <span className={`font-bold ${statusInfo.colorClass}`}>{statusInfo.label}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono tabular-nums text-[#5A738E]">
                    {(isLvl1 || isLvl2) ? (
                      <span className="inline-flex items-center gap-1 text-[#D97706] font-semibold">
                        <Clock className="w-3.5 h-3.5" />
                        Đã trôi {elapsedHours}h · Còn ~{slaHoursLeft}h / 24h SLA
                      </span>
                    ) : (
                      <span className="text-[#169F85] font-semibold">Hoàn tất trong hạn SLA (&lt; 24h)</span>
                    )}
                    <span>Tạo lúc: {new Date(req.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
                  {/* Context & Before/After Comparison */}
                  <div className="lg:col-span-7 space-y-3">
                    <div>
                      <div className="font-bold text-[13px] text-[#2A3F54]">
                        {course?.courseCode} — {course?.courseName} ({sec?.sectionCode} · {sec?.enrolledCount} SV)
                      </div>
                      <div className="text-[#5A738E] mt-0.5">
                        Người đề xuất: <strong>{requester ? `${requester.title} ${requester.fullName}` : req.requesterId}</strong> · Lý do: {req.reasonDetail}
                      </div>
                    </div>

                    {/* Visual Before / After Diff */}
                    <div className="grid grid-cols-1 sm:grid-cols-11 gap-2 items-center bg-[#FAFAFA] border border-[#E6E9ED] rounded p-3">
                      <div className="sm:col-span-5">
                        <div className="text-[11px] font-semibold text-[#73879C]">TRƯỚC THAY ĐỔI (LỊCH GỐC)</div>
                        <div className="font-semibold text-[#2A3F54] mt-0.5">
                          {origSession ? `${DAY_LABELS[origSession.dayOfWeek]} (${origSession.sessionDate})` : '—'}
                        </div>
                        <div className="font-mono text-[11px] text-[#5A738E]">
                          Tiết {origSession?.startPeriod}-{origSession ? origSession.startPeriod + origSession.totalPeriods - 1 : ''} · Phòng {oldRoom?.roomCode}
                        </div>
                      </div>
                      <div className="sm:col-span-1 flex justify-center">
                        <ArrowRight className="w-4 h-4 text-[#1ABB9C]" />
                      </div>
                      <div className="sm:col-span-5">
                        <div className="text-[11px] font-semibold text-[#169F85]">SAU THAY ĐỔI (ĐỀ XUẤT BÙ)</div>
                        <div className="font-semibold text-[#2A3F54] mt-0.5">
                          {DAY_LABELS[req.proposedDayOfWeek]} ({req.proposedDate})
                        </div>
                        <div className="font-mono text-[11px] text-[#169F85] font-semibold">
                          Tiết {req.proposedStartPeriod}-{req.proposedStartPeriod + req.proposedTotalPeriods - 1} · Phòng {proposedRoom?.roomCode} ({proposedRoom?.maxCapacity} chỗ)
                        </div>
                      </div>
                    </div>

                    {/* Approval Trail */}
                    <div className="space-y-1 text-[11px] text-[#5A738E]">
                      {req.facultyApprovedBy && (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#1ABB9C] shrink-0" />
                          <span>
                            <strong>Cấp 1 (Khoa/BM):</strong> {req.facultyApprovedBy} — {req.facultyNote}
                          </span>
                        </div>
                      )}
                      {req.academicApprovedBy && (
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#3498DB] shrink-0" />
                          <span>
                            <strong>Cấp 2 (Phòng ĐT):</strong> {req.academicApprovedBy} — {req.academicNote}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Panel */}
                  <div className="lg:col-span-5 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-[#E6E9ED] pt-3 lg:pt-0 lg:pl-4 gap-3">
                    {isLvl1 || isLvl2 ? (
                      <>
                        <div className="space-y-2.5">
                          {isLvl2 && (
                            <div>
                              <label className="block text-[11px] font-semibold text-[#2A3F54] mb-1">
                                Điều phối phòng thay thế (Phòng Đào tạo)
                              </label>
                              <select
                                value={overrideRoomByReq[req.requestId] ?? req.proposedRoomId}
                                onChange={(e) =>
                                  setOverrideRoomByReq((prev) => ({ ...prev, [req.requestId]: e.target.value }))
                                }
                                className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 bg-white font-mono text-xs"
                              >
                                {state.classrooms
                                  .filter((r) => r.operationalStatus === 'AVAILABLE')
                                  .map((r) => (
                                    <option key={r.roomId} value={r.roomId}>
                                      {r.roomCode} ({r.maxCapacity} chỗ) — {r.roomName}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          )}
                          <div>
                            <label className="block text-[11px] font-semibold text-[#2A3F54] mb-1">
                              Ghi chú phê duyệt / lý do
                            </label>
                            <input
                              placeholder={
                                isLvl1
                                  ? 'VD: Xác nhận chuyên môn, đề nghị Phòng ĐT cấp phòng...'
                                  : 'VD: Đã đối chiếu phòng trống, phê duyệt ban hành...'
                              }
                              value={notesByReq[req.requestId] ?? ''}
                              onChange={(e) =>
                                setNotesByReq((prev) => ({ ...prev, [req.requestId]: e.target.value }))
                              }
                              className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 text-xs"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          {isLvl1 && !canApproveLevel1 && (
                            <div className="text-[11px] text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] rounded px-2.5 py-1.5">
                              Cần quyền <strong>Trưởng Bộ môn / Khoa</strong> để xác nhận Cấp 1.
                            </div>
                          )}
                          {isLvl2 && !canApproveLevel2 && (
                            <div className="text-[11px] text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] rounded px-2.5 py-1.5">
                              Cần quyền <strong>Chuyên viên Phòng Đào tạo</strong> để cấp phòng & ban hành Cấp 2.
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={(isLvl1 && !canApproveLevel1) || (isLvl2 && !canApproveLevel2)}
                              onClick={() =>
                                processRequestAction(
                                  req.requestId,
                                  'APPROVE',
                                  notesByReq[req.requestId],
                                  overrideRoomByReq[req.requestId]
                                )
                              }
                              className="flex-1 py-2 px-3 rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white font-semibold disabled:opacity-45 inline-flex items-center justify-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {isLvl1 ? 'Xác nhận Chuyên môn (Cấp 1)' : 'Phê duyệt Cấp phòng & Ban hành'}
                            </button>
                            <button
                              type="button"
                              disabled={(isLvl1 && !canApproveLevel1) || (isLvl2 && !canApproveLevel2)}
                              onClick={() =>
                                processRequestAction(req.requestId, 'REJECT', notesByReq[req.requestId])
                              }
                              className="py-2 px-3 rounded border border-[#E74C3C]/50 text-[#B91C1C] hover:bg-[#FEF2F2] font-semibold disabled:opacity-45 inline-flex items-center gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Từ chối
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="h-full flex flex-col justify-center items-start text-xs text-[#5A738E] bg-[#FAFAFA] rounded p-3 border border-[#E6E9ED]">
                        <div className="font-bold text-[#2A3F54]">Hồ sơ đã hoàn tất xử lý</div>
                        <p className="mt-1 leading-snug">
                          Trạng thái buổi học trên TKB và thông báo đẩy Before/After đã được đồng bộ tự động tới giảng viên và toàn bộ sinh viên lớp.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* AUDIT LOG & ROLLBACK ENGINE (BR-CM-03) */}
      <section ref={auditSectionRef} className="x_panel">
        <div className="x_title flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-[#2A3F54] flex items-center gap-2">
              <History className="w-4 h-4 text-[#3498DB]" />
              Nhật ký Kiểm toán Toàn diện (Audit_Log) & Quay lui Trạng thái (Rollback)
            </h2>
            <p className="text-xs text-[#73879C] mt-0.5">
              Hiển thị {filteredAuditLogs.length} / {state.auditLogs.length} bản ghi · Nhấn vào dòng để xem đối chiếu Old_Values / New_Values
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#73879C] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Tìm mã log, hành động..."
                className="text-xs border border-[#D9DEE4] rounded pl-8 pr-2.5 py-1.5 bg-white w-[180px]"
              />
            </div>
            <ExportToolbar
              compact
              filenameBase="UTS_NhatKyKiemToan_AuditLog"
              reportTitle="Nhật ký Kiểm toán Toàn diện (Audit_Log)"
              columns={[
                { header: 'Mã Log', accessor: (l) => l.logId },
                { header: 'Thời điểm', accessor: (l) => l.timestamp },
                { header: 'Bảng dữ liệu', accessor: (l) => l.entityName },
                { header: 'Hành động', accessor: (l) => l.actionType },
                { header: 'Tóm tắt biến động', accessor: (l) => l.summary },
                { header: 'Old_Values', accessor: (l) => (l.oldValues ? JSON.stringify(l.oldValues) : '') },
                { header: 'New_Values', accessor: (l) => (l.newValues ? JSON.stringify(l.newValues) : '') },
                { header: 'Người thực hiện', accessor: (l) => `${l.executedBy} (${l.executedRole})` },
              ]}
              rows={filteredAuditLogs}
            />
          </div>
        </div>
        <div className="x_content overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-[#E6E9ED] text-[#5A738E] text-left">
                <th className="py-2 pr-3 font-semibold">Mã Log / Thời điểm</th>
                <th className="py-2 px-2 font-semibold">Bảng / Hành động</th>
                <th className="py-2 px-2 font-semibold">Nội dung Biến động & Diff (Old → New)</th>
                <th className="py-2 px-2 font-semibold">Người thực hiện</th>
                <th className="py-2 pl-2 text-right font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E9ED]">
              {filteredAuditLogs.map((log) => {
                const isHighlighted = drillDown?.highlightAuditLogId === log.logId;
                return (
                  <tr
                    key={log.logId}
                    className={`hover:bg-[#F7F7F7] ${isHighlighted ? 'bg-[#EFF6FF]' : ''}`}
                  >
                    <td className="py-2.5 pr-3 font-mono tabular-nums whitespace-nowrap">
                      <div className="font-bold text-[#2A3F54]">{log.logId}</div>
                      <div className="text-[10px] text-[#73879C]">
                        {new Date(log.timestamp).toLocaleString('vi-VN')}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      <div className="font-mono text-[11px] text-[#3498DB] font-semibold">{log.actionType}</div>
                      <div className="font-mono text-[10px] text-[#73879C]">{log.entityName}</div>
                    </td>
                    <td className="py-2.5 px-2 max-w-[440px]">
                      <div className="font-medium text-[#2A3F54]">{log.summary}</div>
                      {log.oldValues && log.newValues && (
                        <div className="mt-1 font-mono text-[10px] text-[#5A738E] truncate">
                          Old: {JSON.stringify(log.oldValues)} → New: {JSON.stringify(log.newValues)}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      <div className="font-semibold text-[#2A3F54]">{log.executedBy}</div>
                      <div className="text-[10px] text-[#73879C]">{log.executedRole}</div>
                    </td>
                    <td className="py-2.5 pl-2 text-right whitespace-nowrap space-x-2">
                      <button
                        type="button"
                        onClick={() => setSelectedAuditDetail(log)}
                        className="text-[#3498DB] hover:underline font-semibold inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> Diff
                      </button>
                      {log.canRollback && !log.rolledBack ? (
                        <button
                          type="button"
                          onClick={() => rollbackAudit(log.logId)}
                          className="px-2.5 py-1 rounded border border-[#F39C12] bg-[#FFFBEB] text-[#B45309] hover:bg-[#FEF3C7] text-[11px] font-semibold inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Rollback
                        </button>
                      ) : log.rolledBack ? (
                        <span className="text-[11px] text-[#73879C] font-medium">Đã Rollback</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* AUDIT LOG RECORD DETAIL MODAL */}
      {selectedAuditDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded border border-[#D9DEE4] shadow-xl max-w-[640px] w-full overflow-hidden">
            <div className="px-5 py-3.5 bg-[#2A3F54] text-white flex items-center justify-between">
              <div>
                <div className="font-mono text-[11px] text-[#1ABB9C]">Chi tiết Bản ghi Kiểm toán · {selectedAuditDetail.logId}</div>
                <h4 className="text-sm font-bold">{selectedAuditDetail.actionType} trên {selectedAuditDetail.entityName}</h4>
              </div>
              <button type="button" onClick={() => setSelectedAuditDetail(null)} className="text-white/75 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-[#FAFAFA] border border-[#E6E9ED] rounded p-3">
                <div>
                  <div className="text-[11px] text-[#73879C]">Thời điểm ghi nhận</div>
                  <div className="font-mono font-bold text-[#2A3F54]">
                    {new Date(selectedAuditDetail.timestamp).toLocaleString('vi-VN')}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#73879C]">Người thực hiện / Vai trò</div>
                  <div className="font-bold text-[#2A3F54]">
                    {selectedAuditDetail.executedBy} ({selectedAuditDetail.executedRole})
                  </div>
                </div>
              </div>
              <div>
                <div className="font-bold text-[#2A3F54] mb-1">Mô tả nghiệp vụ</div>
                <div className="text-[#5A738E]">{selectedAuditDetail.summary}</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="font-mono text-[11px] font-bold text-[#B91C1C] mb-1">Old_Values (Trước biến động)</div>
                  <pre className="p-3 rounded bg-[#FEF2F2] border border-[#FECACA] text-[11px] font-mono text-[#7F1D1D] overflow-x-auto">
                    {selectedAuditDetail.oldValues ? JSON.stringify(selectedAuditDetail.oldValues, null, 2) : 'null (Bản ghi mới)'}
                  </pre>
                </div>
                <div>
                  <div className="font-mono text-[11px] font-bold text-[#166534] mb-1">New_Values (Sau biến động)</div>
                  <pre className="p-3 rounded bg-[#F0FDF4] border border-[#BBF7D0] text-[11px] font-mono text-[#14532D] overflow-x-auto">
                    {selectedAuditDetail.newValues ? JSON.stringify(selectedAuditDetail.newValues, null, 2) : 'null'}
                  </pre>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 bg-[#F7F7F7] border-t border-[#E6E9ED] flex items-center justify-between">
              <div>
                {selectedAuditDetail.canRollback && !selectedAuditDetail.rolledBack && (
                  <button
                    type="button"
                    onClick={async () => {
                      await rollbackAudit(selectedAuditDetail.logId);
                      setSelectedAuditDetail(null);
                    }}
                    className="px-3.5 py-1.5 rounded bg-[#F39C12] hover:bg-[#D97706] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Khôi phục Rollback ngay
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedAuditDetail(null)}
                className="px-4 py-1.5 rounded bg-[#2A3F54] text-white text-xs font-semibold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW CHANGE REQUEST MODAL */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded border border-[#D9DEE4] shadow-xl max-w-[540px] w-full">
            <div className="px-5 py-3.5 border-b border-[#E6E9ED] flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-[#2A3F54]">Khởi tạo Đơn Báo nghỉ / Đổi lịch / Dạy bù</h4>
                <p className="text-[11px] text-[#73879C]">Hệ thống tự động lọc các slot trống không xung đột với lớp sinh viên</p>
              </div>
              <button type="button" onClick={() => setCreateOpen(false)} className="text-[#73879C]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#2A3F54] mb-1">Chọn buổi học cần điều chỉnh</label>
                <select
                  value={selectedSessionId}
                  onChange={(e) => {
                    setSelectedSessionId(e.target.value);
                    setChosenSlotIndex(0);
                  }}
                  className="w-full border border-[#D9DEE4] rounded px-3 py-2 bg-white"
                >
                  {state.sessions
                    .filter((s) => s.weekIndex === state.activeWeek && s.status !== 'CANCELLED')
                    .map((s) => {
                      const sec = state.sections.find((x) => x.sectionId === s.sectionId);
                      const crs = state.courses.find((c) => c.courseId === sec?.courseId);
                      const rm = state.classrooms.find((r) => r.roomId === s.roomId);
                      return (
                        <option key={s.sessionId} value={s.sessionId}>
                          {crs?.courseCode} ({crs?.courseName}) · {DAY_LABELS[s.dayOfWeek]} T{s.startPeriod}-{s.startPeriod + s.totalPeriods - 1} · {rm?.roomCode}
                        </option>
                      );
                    })}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#2A3F54] mb-1">Loại yêu cầu</label>
                  <select value={reqType} onChange={(e) => setReqType(e.target.value as ChangeRequestType)} className="w-full border border-[#D9DEE4] rounded px-2.5 py-2 bg-white">
                    <option value="LEAVE_AND_MAKEUP">Báo nghỉ & Dạy bù</option>
                    <option value="RESCHEDULE_TIME">Đổi ca / giờ dạy</option>
                    <option value="CHANGE_ROOM">Đổi phòng học</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#2A3F54] mb-1">Nhóm lý do</label>
                  <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value as any)} className="w-full border border-[#D9DEE4] rounded px-2.5 py-2 bg-white">
                    <option value="SICKNESS">Ốm đau đột xuất</option>
                    <option value="BUSINESS_TRIP">Công tác / Hội thảo</option>
                    <option value="FACILITY_ISSUE">Sự cố trang thiết bị phòng</option>
                    <option value="PERSONAL">Lý do cá nhân</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-[#2A3F54] mb-1">Chi tiết lý do *</label>
                <textarea
                  required
                  rows={2}
                  value={reasonDetail}
                  onChange={(e) => setReasonDetail(e.target.value)}
                  className="w-full border border-[#D9DEE4] rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#2A3F54] mb-1">
                  Chọn Slot dạy bù khả dụng (Đã kiểm tra 0 xung đột lớp & phòng)
                </label>
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                  {availableSlotsForCreate.map((slot, idx) => (
                    <label
                      key={`${slot.roomId}_${slot.dayOfWeek}_${slot.startPeriod}`}
                      className={`flex items-center justify-between p-2.5 rounded border cursor-pointer ${
                        chosenSlotIndex === idx ? 'border-[#1ABB9C] bg-[#1ABB9C]/5' : 'border-[#E6E9ED]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={chosenSlotIndex === idx}
                          onChange={() => setChosenSlotIndex(idx)}
                          className="accent-[#1ABB9C]"
                        />
                        <div>
                          <div className="font-semibold text-[#2A3F54]">
                            {DAY_LABELS[slot.dayOfWeek]} ({slot.sessionDate}) · Tiết {slot.startPeriod}-
                            {slot.startPeriod + slot.totalPeriods - 1} ({getPeriodTimeRange(slot.startPeriod, slot.totalPeriods)})
                          </div>
                          <div className="text-[11px] text-[#5A738E]">
                            Phòng <strong className="font-mono text-[#169F85]">{slot.roomCode}</strong> ({slot.roomCapacity} chỗ · Lấp đầy {slot.seatFillRatio}%)
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#E6E9ED]">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-3.5 py-1.5 rounded border border-[#D9DEE4] text-[#5A738E] font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={availableSlotsForCreate.length === 0}
                  className="px-4 py-1.5 rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white font-semibold disabled:opacity-50"
                >
                  Gửi đơn (SLA 24h)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
