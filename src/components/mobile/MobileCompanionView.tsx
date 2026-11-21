import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Download,
  MapPin,
  Send,
  Smartphone,
  Wifi,
  WifiOff,
  Wrench,
} from 'lucide-react';
import { useUTS } from '../../context/UTSContext';
import {
  DAY_LABELS,
  findTopAlternativeSlots,
  generateICalendarContent,
  getPeriodTimeRange,
} from '../../engine/conflictEngine';
import type { UTSState } from '../../types/uts';
import { ExportToolbar } from '../common/ExportToolbar';

type MobileTab = 'SCHEDULE' | 'NOTIFS' | 'QUICK_LEAVE' | 'MAP_INCIDENT';

export const MobileCompanionView: React.FC = () => {
  const {
    state,
    currentRole,
    highlightedSessionId,
    setHighlightedSessionId,
    submitChangeRequest,
    reportIncident,
    setActiveNav,
    addToast,
  } = useUTS();

  const [persona, setPersona] = useState<'STUDENT' | 'INSTRUCTOR'>(
    currentRole.role === 'STUDENT' ? 'STUDENT' : 'INSTRUCTOR'
  );
  const [mobileTab, setMobileTab] = useState<MobileTab>('SCHEDULE');
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    if (currentRole.role === 'STUDENT') setPersona('STUDENT');
    else if (currentRole.role === 'INSTRUCTOR') setPersona('INSTRUCTOR');
  }, [currentRole.role]);
  const [reminderMinutes, setReminderMinutes] = useState<15 | 30 | 60>(30);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('BLD_B2');

  // 3-Tap Quick Leave & Makeup Form (SRS-MOB-03 & UAC-02)
  const [leaveSessionId, setLeaveSessionId] = useState<string>('SES_UAC02_WEB');
  const [leaveReason, setLeaveReason] = useState<'SICKNESS' | 'BUSINESS_TRIP' | 'PERSONAL'>('SICKNESS');
  const [leaveNote, setLeaveNote] = useState('Giảng viên bị ốm đột xuất, đề xuất dạy bù sáng Thứ Bảy.');
  const [selectedMakeupIdx, setSelectedMakeupIdx] = useState<number>(0);

  // Field Incident Reporter (BR-MO-04)
  const [incRoomId, setIncRoomId] = useState<string>('ROOM_B2_301');
  const [incCategory, setIncCategory] = useState<'PROJECTOR' | 'AC' | 'AUDIO' | 'COMPUTER' | 'FURNITURE'>('PROJECTOR');
  const [incDesc, setIncDesc] = useState('');

  // Cache-First / Offline mode support (SRS-MOB-01)
  const effectiveState: UTSState = useMemo(() => {
    if (!offlineMode) return state;
    try {
      const raw = localStorage.getItem('uts_offline_cache_v1');
      if (raw) return JSON.parse(raw) as UTSState;
    } catch {
      // fallback
    }
    return state;
  }, [offlineMode, state]);

  const mySessions = useMemo(() => {
    return effectiveState.sessions
      .filter((s) => {
        if (s.weekIndex !== effectiveState.activeWeek) return false;
        const sec = effectiveState.sections.find((x) => x.sectionId === s.sectionId);
        if (!sec) return false;
        if (persona === 'STUDENT') {
          return sec.cohortClassIds.includes('CLS_CNTT01');
        }
        return sec.instructors.some((i) => i.instructorId === 'INS_01');
      })
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startPeriod - b.startPeriod);
  }, [effectiveState, persona]);

  const myExams = useMemo(() => {
    return effectiveState.exams.filter((ex) => {
      const sec = effectiveState.sections.find((x) => x.sectionId === ex.sectionId);
      if (persona === 'STUDENT') return sec?.cohortClassIds.includes('CLS_CNTT01');
      return ex.proctorIds.includes('INS_01') || sec?.instructors.some((i) => i.instructorId === 'INS_01');
    });
  }, [effectiveState, persona]);

  const availableMakeupSlots = useMemo(() => {
    const sess = effectiveState.sessions.find((s) => s.sessionId === leaveSessionId);
    if (!sess) return [];
    return findTopAlternativeSlots(effectiveState, {
      sectionId: sess.sectionId,
      preferredDayOfWeek: 7,
      preferredStartPeriod: 1,
      totalPeriods: sess.totalPeriods,
      weekIndex: sess.weekIndex,
      excludeSessionId: sess.sessionId,
      limit: 4,
    });
  }, [effectiveState, leaveSessionId]);

  const handleQuickLeaveSubmit = async () => {
    if (offlineMode) {
      addToast({
        type: 'warning',
        title: 'Đang ở chế độ Ngoại tuyến (Offline)',
        detail: 'Vui lòng bật lại kết nối mạng để gửi đơn xin nghỉ về máy chủ.',
      });
      return;
    }
    const slot = availableMakeupSlots[selectedMakeupIdx];
    if (!slot) return;
    const res = await submitChangeRequest({
      original_session_id: leaveSessionId,
      requester_id: 'INS_01',
      request_type: 'LEAVE_AND_MAKEUP',
      reason_code: leaveReason,
      reason_detail: leaveNote,
      proposed_makeup: {
        day_of_week: slot.dayOfWeek,
        start_period: slot.startPeriod,
        total_periods: slot.totalPeriods,
        preferred_room_id: slot.roomId,
        date: slot.sessionDate,
      },
    });
    if (res.ok) {
      setMobileTab('SCHEDULE');
    }
  };

  const handleIncidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incDesc.trim()) return;
    const ok = await reportIncident({
      roomId: incRoomId,
      category: incCategory,
      description: incDesc,
      sessionTimeLabel: 'Ca học hiện tại · Mobile App',
    });
    if (ok) setIncDesc('');
  };

  const handleDownloadMyIcal = () => {
    const ics = generateICalendarContent(
      effectiveState,
      mySessions,
      persona === 'STUDENT' ? 'Lịch học SV Nguyễn Minh Khôi (K24-CNTT01)' : 'Lịch dạy ThS. Nguyễn Văn A'
    );
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = persona === 'STUDENT' ? 'UTS_LichHoc_K24CNTT01.ics' : 'UTS_LichDay_NguyenVanA.ics';
    a.click();
    URL.revokeObjectURL(url);
    addToast({ type: 'success', title: 'Đã xuất lịch cá nhân (.ics) đồng bộ Google / Apple Calendar' });
  };

  const getCardStyle = (status: string) => {
    switch (status) {
      case 'MAKEUP':
        return 'bg-[#FFFBEB] border-[#F39C12] text-[#92400E]';
      case 'ROOM_CHANGED':
        return 'bg-[#FAF5FF] border-[#9B59B6] text-[#6B21A8]';
      case 'CANCELLED':
        return 'bg-[#F8FAFC] border-[#CBD5E1] text-[#94A3B8] line-through';
      case 'PENDING_CHANGE':
        return 'bg-[#FEF3C7] border-[#D97706] text-[#92400E]';
      default:
        return 'bg-[#EFF6FF] border-[#3498DB] text-[#1E3A5F]';
    }
  };

  const selectedBuildingRooms = effectiveState.classrooms.filter(
    (r) => r.buildingId === selectedBuildingId
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* Left Side: Mobile App Context & Synchronization Controls (5 cols) */}
      <div className="xl:col-span-5 space-y-4">
        <section className="x_panel">
          <div className="x_title">
            <h2 className="text-[15px] font-bold text-[#2A3F54] flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#1ABB9C]" />
              Phân hệ Ứng dụng Di động — Đồng bộ Hai chiều Thời gian thực
            </h2>
            <p className="text-xs text-[#73879C] mt-0.5">
              Mô phỏng trực tiếp ứng dụng iOS/Android của Sinh viên & Giảng viên kết nối cùng kho dữ liệu với Web Portal
            </p>
          </div>
          <div className="x_content space-y-4 text-xs">
            <div>
              <div className="font-semibold text-[#2A3F54] mb-1.5">Chọn Tài khoản Đăng nhập trên Ứng dụng:</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPersona('INSTRUCTOR')}
                  className={`p-3 rounded border text-left transition-colors ${
                    persona === 'INSTRUCTOR'
                      ? 'border-[#1ABB9C] bg-[#1ABB9C]/10'
                      : 'border-[#D9DEE4] bg-white hover:bg-[#F7F7F7]'
                  }`}
                >
                  <div className="font-bold text-[#2A3F54]">Giảng viên</div>
                  <div className="text-[11px] text-[#5A738E]">ThS. Nguyễn Văn A · BM CNPM</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPersona('STUDENT');
                    if (mobileTab === 'QUICK_LEAVE') setMobileTab('SCHEDULE');
                  }}
                  className={`p-3 rounded border text-left transition-colors ${
                    persona === 'STUDENT'
                      ? 'border-[#1ABB9C] bg-[#1ABB9C]/10'
                      : 'border-[#D9DEE4] bg-white hover:bg-[#F7F7F7]'
                  }`}
                >
                  <div className="font-bold text-[#2A3F54]">Sinh viên</div>
                  <div className="text-[11px] text-[#5A738E]">Nguyễn Minh Khôi · K24-CNTT01</div>
                </button>
              </div>
            </div>

            {/* Offline Cache Simulation (TC-APP-OFFLINE-001) */}
            <div className="p-3 rounded border border-[#E6E9ED] bg-[#FAFAFA] flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-[#2A3F54] flex items-center gap-1.5">
                  {offlineMode ? (
                    <WifiOff className="w-4 h-4 text-[#E74C3C]" />
                  ) : (
                    <Wifi className="w-4 h-4 text-[#1ABB9C]" />
                  )}
                  Bộ nhớ đệm Ngoại tuyến (Offline Cache — SQLite)
                </div>
                <div className="text-[11px] text-[#5A738E] mt-0.5">
                  {offlineMode
                    ? 'Đang ngắt mạng — Đọc lịch tức thời (<100ms) từ bộ nhớ cục bộ.'
                    : 'Đang kết nối trực tuyến — Tự động đồng bộ ETag/WebSockets.'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOfflineMode((v) => !v)}
                className={`px-3 py-1.5 rounded text-[11px] font-semibold border whitespace-nowrap ${
                  offlineMode
                    ? 'bg-[#FEF2F2] border-[#E74C3C] text-[#B91C1C]'
                    : 'bg-white border-[#D9DEE4] text-[#2A3F54] hover:border-[#1ABB9C]'
                }`}
              >
                {offlineMode ? 'Bật lại Mạng' : 'Thử chế độ Offline'}
              </button>
            </div>

            {/* UAC-02 Guided Walkthrough Card */}
            <div className="p-3.5 rounded border border-[#3498DB]/40 bg-[#EFF6FF] space-y-2">
              <div className="font-bold text-[#1E3A5F]">Kịch bản Kiểm thử Khép kín UAC-02 (Mobile ↔ Web):</div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-[#334155]">
                <li>Trên điện thoại bên phải (tài khoản Giảng viên), mở tab <strong>Báo nghỉ / Bù</strong>.</li>
                <li>Chọn buổi dạy sáng Thứ Năm (Lập trình Web · B2-301), chọn slot bù trống và nhấn Gửi đơn.</li>
                <li>
                  Chuyển sang{' '}
                  <button
                    type="button"
                    onClick={() => setActiveNav('workflow')}
                    className="font-bold text-[#169F85] underline"
                  >
                    Cổng Phê duyệt Đa cấp
                  </button>{' '}
                  để duyệt Cấp 1 (Bộ môn) & Cấp 2 (Phòng ĐT).
                </li>
                <li>Quay lại Mobile App (tài khoản Sinh viên) xem lịch nghỉ gạch ngang, buổi bù màu cam & Push Notification Before/After!</li>
              </ol>
            </div>

            {/* Reminder & iCal Quick Settings */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E6E9ED]">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#2A3F54]">Nhắc lịch trước giờ học:</span>
                {([15, 30, 60] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setReminderMinutes(m)}
                    className={`px-2 py-1 rounded font-mono text-[11px] font-semibold border ${
                      reminderMinutes === m
                        ? 'bg-[#2A3F54] text-white border-[#2A3F54]'
                        : 'bg-white text-[#5A738E] border-[#D9DEE4]'
                    }`}
                  >
                    {m}p
                  </button>
                ))}
              </div>
              <ExportToolbar
                compact
                filenameBase={persona === 'STUDENT' ? 'UTS_LichHoc_K24CNTT01' : 'UTS_LichDay_NguyenVanA'}
                reportTitle={persona === 'STUDENT' ? 'Lịch học cá nhân K24-CNTT01' : 'Lịch giảng dạy ThS. Nguyễn Văn A'}
                onExportICal={handleDownloadMyIcal}
                iCalLabel="Xuất .ICS"
                columns={[
                  { header: 'Thứ', accessor: (s) => DAY_LABELS[s.dayOfWeek] },
                  { header: 'Ngày', accessor: (s) => s.sessionDate },
                  { header: 'Tiết', accessor: (s) => `T${s.startPeriod}-${s.startPeriod + s.totalPeriods - 1}` },
                  { header: 'Giờ học', accessor: (s) => getPeriodTimeRange(s.startPeriod, s.totalPeriods) },
                  {
                    header: 'Học phần',
                    accessor: (s) => {
                      const sec = effectiveState.sections.find((x) => x.sectionId === s.sectionId);
                      const crs = effectiveState.courses.find((c) => c.courseId === sec?.courseId);
                      return `${crs?.courseCode ?? ''} - ${crs?.courseName ?? ''}`;
                    },
                  },
                  {
                    header: 'Phòng',
                    accessor: (s) => effectiveState.classrooms.find((r) => r.roomId === s.roomId)?.roomCode ?? '',
                  },
                  { header: 'Trạng thái', accessor: (s) => s.status },
                ]}
                rows={mySessions}
              />
            </div>
          </div>
        </section>
      </div>

      {/* Right Side: Interactive Mobile Companion Viewport (7 cols) */}
      <div className="xl:col-span-7 flex justify-center">
        <div className="w-full max-w-[430px] bg-white border-2 border-[#2A3F54] rounded-[24px] shadow-xl overflow-hidden flex flex-col min-h-[680px]">
          {/* Mobile App Top Bar */}
          <div className="bg-[#2A3F54] text-white px-5 pt-4 pb-3.5">
            <div className="flex items-center justify-between text-[11px] text-white/75 mb-2">
              <span className="font-mono">09:15 · UTS Mobile</span>
              <span className="inline-flex items-center gap-1 font-semibold">
                {offlineMode ? (
                  <>
                    <WifiOff className="w-3 h-3 text-[#F39C12]" /> Offline Cache
                  </>
                ) : (
                  <>
                    <Wifi className="w-3 h-3 text-[#1ABB9C]" /> Đồng bộ trực tuyến
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold">
                  {persona === 'INSTRUCTOR' ? 'ThS. Nguyễn Văn A' : 'Nguyễn Minh Khôi'}
                </div>
                <div className="text-[11px] text-[#1ABB9C]">
                  {persona === 'INSTRUCTOR'
                    ? 'Giảng viên · Bộ môn CNPM'
                    : 'Sinh viên · Lớp K24-CNTT01'}
                </div>
              </div>
              <div className="text-right text-[11px] text-white/80 font-mono">
                <div>Tuần {effectiveState.activeWeek}</div>
                <div>Nhắc -{reminderMinutes}p</div>
              </div>
            </div>
          </div>

          {/* Mobile App Content Body */}
          <div className="flex-1 bg-[#F7F7F7] p-4 overflow-y-auto max-h-[540px] space-y-3">
            {/* TAB 1: PERSONALIZED SCHEDULE (SRS-MOB-01) */}
            {mobileTab === 'SCHEDULE' && (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#2A3F54]">
                    {persona === 'INSTRUCTOR' ? 'Lịch Giảng dạy Tuần 12' : 'Thời khóa biểu Cá nhân Tuần 12'}
                  </span>
                  <span className="text-[11px] font-mono text-[#73879C]">{mySessions.length} buổi</span>
                </div>

                {/* Color Legend */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#5A738E]">
                  <span className="text-[#1E3A5F] font-semibold">■ Chính thức</span>
                  <span className="text-[#B45309] font-semibold">■ Học bù</span>
                  <span className="text-[#6B21A8] font-semibold">■ Đổi phòng</span>
                  <span className="text-[#B91C1C] font-semibold">■ Lịch thi</span>
                  <span className="text-[#94A3B8] line-through">■ Báo nghỉ</span>
                </div>

                <div className="space-y-2.5">
                  {mySessions.map((sess) => {
                    const sec = effectiveState.sections.find((x) => x.sectionId === sess.sectionId);
                    const crs = effectiveState.courses.find((c) => c.courseId === sec?.courseId);
                    const rm = effectiveState.classrooms.find((r) => r.roomId === sess.roomId);
                    const bld = effectiveState.buildings.find((b) => b.buildingId === rm?.buildingId);
                    const isHighlighted = highlightedSessionId === sess.sessionId;

                    return (
                      <div
                        key={sess.sessionId}
                        onClick={() => setHighlightedSessionId(null)}
                        className={`p-3 rounded-lg border transition-all ${getCardStyle(sess.status)} ${
                          isHighlighted ? 'ring-2 ring-[#1ABB9C] ring-offset-2' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono font-bold">
                          <span>
                            {DAY_LABELS[sess.dayOfWeek]} · {sess.sessionDate.slice(5).split('-').reverse().join('/')}
                          </span>
                          <span>
                            Tiết {sess.startPeriod}-{sess.startPeriod + sess.totalPeriods - 1}
                          </span>
                        </div>
                        <div className="text-[13px] font-bold mt-1">
                          {crs?.courseCode} — {crs?.courseName}
                        </div>
                        <div className="text-[11px] mt-1 flex items-center justify-between">
                          <span>
                            Phòng <strong className="font-mono">{rm?.roomCode}</strong> ({bld?.buildingName}, Tầng {rm?.floorNumber})
                          </span>
                          <span className="font-mono text-[10px]">{getPeriodTimeRange(sess.startPeriod, sess.totalPeriods)}</span>
                        </div>
                        {sess.note && (
                          <div className="mt-1.5 pt-1.5 border-t border-current/15 text-[11px] opacity-90">
                            {sess.note}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Upcoming Exams (Red Coding) */}
                {myExams.length > 0 && (
                  <div className="pt-2 space-y-2">
                    <div className="text-xs font-bold text-[#B91C1C]">Lịch thi Kết thúc Môn sắp tới</div>
                    {myExams.map((ex) => {
                      const crs = effectiveState.courses.find((c) => c.courseId === ex.courseId);
                      const rm = effectiveState.classrooms.find((r) => r.roomId === ex.roomId);
                      return (
                        <div
                          key={ex.examId}
                          className="p-3 rounded-lg border border-[#E74C3C] bg-[#FEF2F2] text-[#991B1B] text-xs"
                        >
                          <div className="flex justify-between font-mono text-[11px] font-bold">
                            <span>THI KẾT THÚC MÔN · Tuần {ex.examWeek}</span>
                            <span>{ex.examDate}</span>
                          </div>
                          <div className="font-bold mt-0.5">
                            {crs?.courseCode} — {crs?.courseName}
                          </div>
                          <div className="text-[11px] mt-0.5">
                            Phòng thi: <strong className="font-mono">{rm?.roomCode}</strong> · Tiết {ex.startPeriod}-
                            {ex.startPeriod + ex.totalPeriods - 1}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* TAB 2: PUSH NOTIFICATIONS & DEEP LINKING (SRS-MOB-02) */}
            {mobileTab === 'NOTIFS' && (
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-[#2A3F54]">
                  Hộp thư Thông báo Đẩy ({effectiveState.notifications.length})
                </div>
                {effectiveState.notifications.map((n) => (
                  <button
                    key={n.notificationId}
                    type="button"
                    onClick={() => {
                      if (n.sessionId) {
                        setHighlightedSessionId(n.sessionId);
                        setMobileTab('SCHEDULE');
                      }
                    }}
                    className="w-full text-left p-3 rounded-lg bg-white border border-[#D9DEE4] hover:border-[#1ABB9C] space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2 text-xs">
                      <span className="font-bold text-[#2A3F54]">{n.title}</span>
                      <span className="font-mono text-[10px] text-[#73879C] shrink-0">
                        {new Date(n.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#5A738E] leading-snug">{n.body}</p>
                    {n.beforeSummary && n.afterSummary && (
                      <div className="p-2 rounded bg-[#F7F7F7] border border-[#E6E9ED] text-[11px] space-y-0.5">
                        <div className="text-[#94A3B8] line-through">Trước: {n.beforeSummary}</div>
                        <div className="text-[#169F85] font-semibold">Sau: {n.afterSummary}</div>
                      </div>
                    )}
                    {n.deepLink && (
                      <div className="text-[10px] font-mono text-[#3498DB]">
                        Chạm để mở chi tiết ({n.deepLink})
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* TAB 3: INSTRUCTOR 3-TAP QUICK LEAVE & MAKEUP (SRS-MOB-03) */}
            {mobileTab === 'QUICK_LEAVE' && (
              <div className="space-y-3 text-xs">
                <div className="font-bold text-[#2A3F54]">
                  Báo nghỉ Đột xuất & Đăng ký Dạy bù Nhanh (3 chạm)
                </div>

                <div className="p-3 rounded-lg bg-white border border-[#D9DEE4] space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5A738E] mb-1">
                      Bước 1: Chọn buổi dạy cần báo nghỉ
                    </label>
                    <select
                      value={leaveSessionId}
                      onChange={(e) => {
                        setLeaveSessionId(e.target.value);
                        setSelectedMakeupIdx(0);
                      }}
                      className="w-full border border-[#D9DEE4] rounded px-2.5 py-2 bg-white text-xs"
                    >
                      {mySessions
                        .filter((s) => s.status !== 'CANCELLED')
                        .map((s) => {
                          const sec = effectiveState.sections.find((x) => x.sectionId === s.sectionId);
                          const crs = effectiveState.courses.find((c) => c.courseId === sec?.courseId);
                          const rm = effectiveState.classrooms.find((r) => r.roomId === s.roomId);
                          return (
                            <option key={s.sessionId} value={s.sessionId}>
                              {crs?.courseCode} · {DAY_LABELS[s.dayOfWeek]} T{s.startPeriod}-{s.startPeriod + s.totalPeriods - 1} · {rm?.roomCode}
                            </option>
                          );
                        })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#5A738E] mb-1">
                      Bước 2: Chọn lý do nghỉ
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'SICKNESS', label: 'Ốm đau' },
                          { id: 'BUSINESS_TRIP', label: 'Công tác' },
                          { id: 'PERSONAL', label: 'Cá nhân' },
                        ] as const
                      ).map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setLeaveReason(r.id)}
                          className={`py-2 rounded border text-[11px] font-semibold ${
                            leaveReason === r.id
                              ? 'bg-[#2A3F54] text-white border-[#2A3F54]'
                              : 'bg-white text-[#5A738E] border-[#D9DEE4]'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#5A738E] mb-1">
                      Bước 3: Chọn slot dạy bù trống (0 xung đột lớp & phòng)
                    </label>
                    <div className="space-y-1.5">
                      {availableMakeupSlots.map((slot, idx) => (
                        <button
                          key={`${slot.roomId}_${slot.dayOfWeek}_${slot.startPeriod}`}
                          type="button"
                          onClick={() => setSelectedMakeupIdx(idx)}
                          className={`w-full text-left p-2.5 rounded border text-[11px] ${
                            selectedMakeupIdx === idx
                              ? 'border-[#1ABB9C] bg-[#1ABB9C]/10 text-[#2A3F54]'
                              : 'border-[#E6E9ED] bg-[#FAFAFA] text-[#5A738E]'
                          }`}
                        >
                          <div className="font-bold">
                            {DAY_LABELS[slot.dayOfWeek]} ({slot.sessionDate}) · Tiết {slot.startPeriod}-
                            {slot.startPeriod + slot.totalPeriods - 1}
                          </div>
                          <div className="font-mono text-[#169F85]">
                            Phòng {slot.roomCode} ({slot.roomCapacity} chỗ · Lấp đầy {slot.seatFillRatio}%)
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <input
                      value={leaveNote}
                      onChange={(e) => setLeaveNote(e.target.value)}
                      placeholder="Ghi chú ngắn cho Trưởng Bộ môn..."
                      className="w-full border border-[#D9DEE4] rounded px-2.5 py-2 text-xs"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleQuickLeaveSubmit}
                    className="w-full py-2.5 rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white font-bold inline-flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Gửi Đơn Báo nghỉ & Dạy bù ngay
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: CAMPUS MAP & FIELD INCIDENT REPORT (BR-MO-03 & BR-MO-04) */}
            {mobileTab === 'MAP_INCIDENT' && (
              <div className="space-y-3 text-xs">
                <div className="font-bold text-[#2A3F54]">Bản đồ Khuôn viên Giảng đường (Campus Map)</div>
                <div className="bg-white border border-[#D9DEE4] rounded-lg p-3">
                  <svg viewBox="0 0 360 165" className="w-full h-auto">
                    <rect x="0" y="0" width="360" height="165" rx="6" fill="#F2F5F7" />
                    {/* Campus roads */}
                    <path d="M 10 85 L 350 85 M 180 10 L 180 155" stroke="#CBD5E1" strokeWidth="8" />
                    {/* Building A1 */}
                    <g
                      onClick={() => setSelectedBuildingId('BLD_A1')}
                      className="cursor-pointer"
                    >
                      <rect
                        x="25"
                        y="18"
                        width="125"
                        height="52"
                        rx="4"
                        fill={selectedBuildingId === 'BLD_A1' ? '#1ABB9C' : '#2A3F54'}
                      />
                      <text x="87" y="42" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="700">
                        Nhà A1 (Lý thuyết)
                      </text>
                      <text x="87" y="57" textAnchor="middle" fill="#E2E8F0" fontSize="9">
                        A1-201 · A1-202 · A1-305
                      </text>
                    </g>
                    {/* Building B2 */}
                    <g
                      onClick={() => setSelectedBuildingId('BLD_B2')}
                      className="cursor-pointer"
                    >
                      <rect
                        x="205"
                        y="18"
                        width="130"
                        height="52"
                        rx="4"
                        fill={selectedBuildingId === 'BLD_B2' ? '#1ABB9C' : '#2A3F54'}
                      />
                      <text x="270" y="42" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="700">
                        Nhà B2 (Học thuật)
                      </text>
                      <text x="270" y="57" textAnchor="middle" fill="#E2E8F0" fontSize="9">
                        B2-301 · B2-302 · B2-405
                      </text>
                    </g>
                    {/* Building H1 */}
                    <g
                      onClick={() => setSelectedBuildingId('BLD_H1')}
                      className="cursor-pointer"
                    >
                      <rect
                        x="25"
                        y="102"
                        width="125"
                        height="48"
                        rx="4"
                        fill={selectedBuildingId === 'BLD_H1' ? '#1ABB9C' : '#3498DB'}
                      />
                      <text x="87" y="124" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="700">
                        Hội trường H1
                      </text>
                      <text x="87" y="138" textAnchor="middle" fill="#E2E8F0" fontSize="9">
                        H1-100 · H1-200
                      </text>
                    </g>
                    {/* Building C1 Lab */}
                    <g
                      onClick={() => setSelectedBuildingId('BLD_C1')}
                      className="cursor-pointer"
                    >
                      <rect
                        x="205"
                        y="102"
                        width="130"
                        height="48"
                        rx="4"
                        fill={selectedBuildingId === 'BLD_C1' ? '#1ABB9C' : '#9B59B6'}
                      />
                      <text x="270" y="124" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="700">
                        Khu Lab C1 (CS2)
                      </text>
                      <text x="270" y="138" textAnchor="middle" fill="#E2E8F0" fontSize="9">
                        Lab Máy tính · NN · Điện tử
                      </text>
                    </g>
                  </svg>

                  <div className="mt-2 pt-2 border-t border-[#E6E9ED] space-y-1">
                    {selectedBuildingRooms.map((r) => (
                      <div key={r.roomId} className="flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-[#2A3F54]">
                          {r.roomCode} (Tầng {r.floorNumber})
                        </span>
                        <span className="text-[#5A738E]">
                          {r.maxCapacity} chỗ ·{' '}
                          <strong className={r.operationalStatus === 'AVAILABLE' ? 'text-[#169F85]' : 'text-[#E74C3C]'}>
                            {r.operationalStatus === 'AVAILABLE' ? 'Khả dụng' : 'Bảo trì'}
                          </strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Field Incident Reporter (BR-MO-04) */}
                <form
                  onSubmit={handleIncidentSubmit}
                  className="bg-white border border-[#D9DEE4] rounded-lg p-3 space-y-2.5"
                >
                  <div className="font-bold text-[#2A3F54] flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-[#F39C12]" />
                    Báo hỏng Thiết bị Phòng học Hiện trường
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={incRoomId}
                      onChange={(e) => setIncRoomId(e.target.value)}
                      className="border border-[#D9DEE4] rounded px-2 py-1.5 bg-white font-mono text-[11px]"
                    >
                      {effectiveState.classrooms.map((r) => (
                        <option key={r.roomId} value={r.roomId}>{r.roomCode}</option>
                      ))}
                    </select>
                    <select
                      value={incCategory}
                      onChange={(e) => setIncCategory(e.target.value as any)}
                      className="border border-[#D9DEE4] rounded px-2 py-1.5 bg-white text-[11px]"
                    >
                      <option value="PROJECTOR">Máy chiếu</option>
                      <option value="AC">Điều hòa</option>
                      <option value="AUDIO">Micro / Âm thanh</option>
                      <option value="COMPUTER">Máy tính Lab</option>
                      <option value="FURNITURE">Bàn ghế</option>
                    </select>
                  </div>
                  <input
                    required
                    value={incDesc}
                    onChange={(e) => setIncDesc(e.target.value)}
                    placeholder="Mô tả nhanh sự cố (VD: Micro không dây hết pin, âm thanh rè)..."
                    className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 text-xs"
                  />
                  <button
                    type="submit"
                    className="w-full py-2 rounded bg-[#2A3F54] hover:bg-[#172D44] text-white font-semibold inline-flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#1ABB9C]" />
                    Gửi phản ánh tới Phòng Quản trị TB
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Mobile App Bottom Tab Navigation */}
          <div className="bg-white border-t border-[#D9DEE4] grid grid-cols-4 text-[10px] font-semibold">
            <button
              type="button"
              onClick={() => setMobileTab('SCHEDULE')}
              className={`py-2.5 flex flex-col items-center gap-1 ${
                mobileTab === 'SCHEDULE' ? 'text-[#1ABB9C]' : 'text-[#73879C]'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Lịch cá nhân
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('NOTIFS')}
              className={`py-2.5 flex flex-col items-center gap-1 ${
                mobileTab === 'NOTIFS' ? 'text-[#1ABB9C]' : 'text-[#73879C]'
              }`}
            >
              <Bell className="w-4 h-4" />
              Thông báo
            </button>
            <button
              type="button"
              disabled={persona === 'STUDENT'}
              onClick={() => setMobileTab('QUICK_LEAVE')}
              className={`py-2.5 flex flex-col items-center gap-1 disabled:opacity-35 ${
                mobileTab === 'QUICK_LEAVE' ? 'text-[#1ABB9C]' : 'text-[#73879C]'
              }`}
            >
              <CalendarPlus className="w-4 h-4" />
              Báo nghỉ / Bù
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('MAP_INCIDENT')}
              className={`py-2.5 flex flex-col items-center gap-1 ${
                mobileTab === 'MAP_INCIDENT' ? 'text-[#1ABB9C]' : 'text-[#73879C]'
              }`}
            >
              <MapPin className="w-4 h-4" />
              Bản đồ & TB
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
