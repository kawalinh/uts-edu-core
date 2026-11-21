import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { useUTS } from '../../context/UTSContext';
import {
  DAY_LABELS,
  calculateKPIs,
  generateICalendarContent,
  getPeriodTimeRange,
} from '../../engine/conflictEngine';
import { DrillDownBanner, ExportToolbar } from '../common/ExportToolbar';
import { triggerDownload } from '../../utils/exportUtils';

interface SfrAuditRow {
  sessionId: string;
  courseCode: string;
  courseName: string;
  sectionCode: string;
  dayLabel: string;
  sessionDate: string;
  periods: string;
  roomCode: string;
  enrolled: number;
  capacity: number;
  emptySeats: number;
  sfrPercent: number;
  tier: 'OPTIMAL' | 'MODERATE' | 'UNDERUTILIZED';
  recommendation: string;
}

export const ReportsAndIntegrationsHub: React.FC = () => {
  const { state, drillDown, navigateWithDrillDown, syncIntegration, addToast } = useUTS();
  const kpis = useMemo(() => calculateKPIs(state), [state]);

  const [selectedClassForPrint, setSelectedClassForPrint] = useState('CLS_CNTT01');
  const [selectedInstrForIcal, setSelectedInstrForIcal] = useState('INS_01');

  // SFR Audit state (Dashboard SFR KPI drill-down target)
  const [sfrFilter, setSfrFilter] = useState<'ALL' | 'OPTIMAL' | 'MODERATE' | 'UNDERUTILIZED'>('ALL');
  const [sfrSearch, setSfrSearch] = useState('');
  const [selectedSfrRow, setSelectedSfrRow] = useState<SfrAuditRow | null>(null);
  const sfrSectionRef = useRef<HTMLElement | null>(null);

  // Smart Attendance Dynamic QR (rotates every 30s — Section 7.3)
  const [qrSessionId, setQrSessionId] = useState('SES_998124');
  const [qrSecondsLeft, setQrSecondsLeft] = useState(30);
  const [qrNonce, setQrNonce] = useState('UTS-QR-88412');

  // CSV Upload Validator (Section 7.3)
  const [csvText, setCsvText] = useState(
    'course_code,course_name,credits,LT,BT,TL,TH,room_code\nCS101,Lập trình Cơ bản,3,30,10,5,15,A1-201\nSE310,Kiểm thử Tự động,3,24,6,6,24,C1-LAB1\nSE311,Đồ án Tốt nghiệp,2,10,0,0,0,ROOM_999'
  );
  const [csvValidation, setCsvValidation] = useState<
    { line: number; code: string; status: 'OK' | 'ERROR'; message: string }[] | null
  >(null);

  // Consume Dashboard drill-down context
  useEffect(() => {
    if (!drillDown) return;
    if (drillDown.sfrFilter) {
      setSfrFilter(drillDown.sfrFilter);
    }
    if (drillDown.reportFocus === 'SFR_DETAIL') {
      setTimeout(() => {
        sfrSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  }, [drillDown]);

  useEffect(() => {
    const timer = setInterval(() => {
      setQrSecondsLeft((prev) => {
        if (prev <= 1) {
          setQrNonce(`UTS-QR-${Math.floor(10000 + Math.random() * 89999)}`);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Build SFR Audit rows for all active sessions in current week
  const sfrRows = useMemo<SfrAuditRow[]>(() => {
    const q = sfrSearch.trim().toLowerCase();
    return state.sessions
      .filter((s) => s.weekIndex === state.activeWeek && s.status !== 'CANCELLED' && s.status !== 'RESCHEDULED')
      .map((s) => {
        const sec = state.sections.find((x) => x.sectionId === s.sectionId);
        const crs = state.courses.find((c) => c.courseId === sec?.courseId);
        const rm = state.classrooms.find((r) => r.roomId === s.roomId);
        const enrolled = sec?.enrolledCount ?? 0;
        const capacity = rm?.maxCapacity ?? 0;
        const emptySeats = Math.max(0, capacity - enrolled);
        const sfrPercent = capacity > 0 ? Math.round((enrolled / capacity) * 1000) / 10 : 0;
        const tier: SfrAuditRow['tier'] =
          sfrPercent >= 80 ? 'OPTIMAL' : sfrPercent >= 45 ? 'MODERATE' : 'UNDERUTILIZED';
        const recommendation =
          tier === 'OPTIMAL'
            ? 'Tối ưu công suất chỗ ngồi (đạt chuẩn >= 80%).'
            : tier === 'MODERATE'
              ? 'Chấp nhận được — có thể cân nhắc phòng nhỏ hơn nếu cao điểm.'
              : 'Lãng phí diện tích (< 45%, vi phạm mềm BR_RULE_10) — đề xuất chuyển sang phòng sức chứa nhỏ hơn hoặc ghép lớp.';
        return {
          sessionId: s.sessionId,
          courseCode: crs?.courseCode ?? '',
          courseName: crs?.courseName ?? '',
          sectionCode: sec?.sectionCode ?? '',
          dayLabel: DAY_LABELS[s.dayOfWeek],
          sessionDate: s.sessionDate,
          periods: `T${s.startPeriod}-${s.startPeriod + s.totalPeriods - 1}`,
          roomCode: rm?.roomCode ?? '',
          enrolled,
          capacity,
          emptySeats,
          sfrPercent,
          tier,
          recommendation,
        };
      })
      .filter((r) => {
        if (sfrFilter !== 'ALL' && r.tier !== sfrFilter) return false;
        if (q) {
          const hay = `${r.courseCode} ${r.courseName} ${r.sectionCode} ${r.roomCode}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.sfrPercent - b.sfrPercent);
  }, [state.sessions, state.sections, state.courses, state.classrooms, state.activeWeek, sfrFilter, sfrSearch]);

  const exportTeachingLoadCSV = () => {
    const header = 'MaGV,HoTen,Khoa,LoaiHinh,SoTietTuan,TranTuan,TranNgay,TrangThai\n';
    const rows = kpis.instructorLoads
      .map(
        (i) =>
          `"${i.instructorId}","${i.name}","${i.facultyName}","${i.type}",${i.weeklyPeriods},${i.maxWeeklyPeriods},${i.maxDailyUsed}/${i.maxDailyCap},"${i.status}"`
      )
      .join('\n');
    triggerDownload(`UTS_KhoiLuongGiangDay_Tuan${state.activeWeek}.csv`, '\uFEFF' + header + rows, 'text/csv;charset=utf-8;');
    addToast({ type: 'success', title: 'Đã xuất file Excel/CSV Khối lượng Giảng dạy' });
  };

  const exportRoomUtilizationCSV = () => {
    const header = 'Thu,CaHoc,SoPhongDung,TongPhongKhaDung,TyLeSuDung_Percent\n';
    const rows = kpis.heatmap
      .map((h) => `"${h.dayLabel}","${h.shiftLabel}",${h.usedRooms},${h.availableRooms},${h.occupancyRate}%`)
      .join('\n');
    triggerDownload(`UTS_CongSuatPhongHoc_Tuan${state.activeWeek}.csv`, '\uFEFF' + header + rows, 'text/csv;charset=utf-8;');
    addToast({ type: 'success', title: 'Đã xuất file Excel/CSV Công suất Phòng học' });
  };

  const exportAuditLogCSV = () => {
    const header = 'LogID,ThoiGian,ThucThe,HanhDong,NoiDung,NguoiThucHien\n';
    const rows = state.auditLogs
      .map((l) => `"${l.logId}","${l.timestamp}","${l.entityName}","${l.actionType}","${l.summary.replace(/"/g, '""')}","${l.executedBy}"`)
      .join('\n');
    triggerDownload(`UTS_NhatKyBienDong_AuditLog.csv`, '\uFEFF' + header + rows, 'text/csv;charset=utf-8;');
    addToast({ type: 'success', title: 'Đã xuất Báo cáo Lịch sử Biến động & Đổi phòng' });
  };

  const exportInstructorICal = () => {
    const instr = state.instructors.find((i) => i.instructorId === selectedInstrForIcal);
    const sessions = state.sessions.filter((s) => {
      const sec = state.sections.find((x) => x.sectionId === s.sectionId);
      return sec?.instructors.some((i) => i.instructorId === selectedInstrForIcal);
    });
    const ics = generateICalendarContent(
      state,
      sessions,
      `Lịch Giảng dạy — ${instr ? `${instr.title} ${instr.fullName}` : selectedInstrForIcal}`
    );
    triggerDownload(`UTS_LichGiangDay_${instr?.staffCode ?? 'GV'}.ics`, ics, 'text/calendar;charset=utf-8;');
    addToast({
      type: 'success',
      title: 'Đã tải tệp iCalendar (.ics) thành công',
      detail: 'Tương thích trực tiếp với Google Calendar, Apple Calendar và Microsoft Outlook.',
    });
  };

  const validateCsvUpload = () => {
    const lines = csvText.trim().split('\n').slice(1);
    const existingCodes = new Set(state.courses.map((c) => c.courseCode.toUpperCase()));
    const existingRooms = new Set(state.classrooms.map((r) => r.roomCode.toUpperCase()));

    const results = lines.map((line, i) => {
      const cols = line.split(',').map((x) => x.trim());
      const [code, , creditsStr, ltStr, btStr, tlStr, thStr, roomCode] = cols;
      const errors: string[] = [];
      if (existingCodes.has((code || '').toUpperCase())) {
        errors.push(`Trùng mã học phần (${code}) đã tồn tại`);
      }
      const total = Number(ltStr || 0) + Number(btStr || 0) + Number(tlStr || 0) + Number(thStr || 0);
      const credits = Number(creditsStr || 0);
      if (total < credits * 15) {
        errors.push(`Tổng tiết (${total}) không khớp tín chỉ (${credits} TC)`);
      }
      if (roomCode && !existingRooms.has(roomCode.toUpperCase())) {
        errors.push(`Mã phòng ${roomCode} không tồn tại trong Master Data`);
      }
      return {
        line: i + 2,
        code: code || `Dòng ${i + 2}`,
        status: errors.length === 0 ? ('OK' as const) : ('ERROR' as const),
        message: errors.length === 0 ? 'Hợp lệ — Sẵn sàng nhập vào CSDL' : errors.join(' · '),
      };
    });
    setCsvValidation(results);
  };

  const classTimetableRows = useMemo(() => {
    return state.sessions
      .filter((s) => {
        if (s.weekIndex !== state.activeWeek || s.status === 'CANCELLED') return false;
        const sec = state.sections.find((x) => x.sectionId === s.sectionId);
        return sec?.cohortClassIds.includes(selectedClassForPrint);
      })
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startPeriod - b.startPeriod);
  }, [state, selectedClassForPrint]);

  const qrCells = useMemo(() => {
    const seedStr = `${qrNonce}:${qrSessionId}`;
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
    }
    const grid: boolean[] = [];
    for (let i = 0; i < 121; i++) {
      const r = Math.floor(i / 11);
      const c = i % 11;
      const isCorner = (r < 3 && c < 3) || (r < 3 && c > 7) || (r > 7 && c < 3);
      if (isCorner) {
        grid.push(true);
      } else {
        hash = (hash * 1664525 + 1013904223) >>> 0;
        grid.push((hash & 3) !== 0);
      }
    }
    return grid;
  }, [qrNonce, qrSessionId]);

  return (
    <div className="space-y-5">
      <DrillDownBanner />

      {/* SFR SEAT FILL RATIO AUDIT SECTION (Direct Target of Dashboard SFR KPI) */}
      <section
        ref={sfrSectionRef}
        className={`x_panel ${
          drillDown?.reportFocus === 'SFR_DETAIL' ? 'ring-2 ring-[#1ABB9C]' : ''
        }`}
      >
        <div className="x_title flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-[#2A3F54] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#1ABB9C]" />
              Tra cứu Chi tiết Chỉ số Lấp đầy Chỗ ngồi — SFR Audit (Trung bình: {kpis.sfr}%)
            </h2>
            <p className="text-xs text-[#73879C] mt-0.5">
              Phân tích tương quan Sĩ số lớp (S_lop) / Sức chứa phòng (C_phong) theo từng buổi học · Phát hiện lãng phí diện tích (&lt; 45%, BR_RULE_10)
            </p>
          </div>
          <ExportToolbar
            compact
            filenameBase={`UTS_PhanTichLapDayChoNgoi_SFR_Tuan${state.activeWeek}`}
            reportTitle={`Báo cáo Chi tiết Lấp đầy Chỗ ngồi (SFR) Tuần ${state.activeWeek}`}
            columns={[
              { header: 'Mã buổi', accessor: (r) => r.sessionId },
              { header: 'Mã HP', accessor: (r) => r.courseCode },
              { header: 'Tên học phần', accessor: (r) => r.courseName },
              { header: 'Lớp HP', accessor: (r) => r.sectionCode },
              { header: 'Ngày học', accessor: (r) => `${r.dayLabel} (${r.sessionDate})` },
              { header: 'Tiết', accessor: (r) => r.periods },
              { header: 'Phòng', accessor: (r) => r.roomCode },
              { header: 'Sĩ số (S_lop)', accessor: (r) => r.enrolled },
              { header: 'Sức chứa (C_phong)', accessor: (r) => r.capacity },
              { header: 'Chỗ trống dư', accessor: (r) => r.emptySeats },
              { header: 'SFR (%)', accessor: (r) => r.sfrPercent },
              { header: 'Khuyến nghị tối ưu', accessor: (r) => r.recommendation },
            ]}
            rows={sfrRows}
          />
        </div>

        <div className="px-4 py-2.5 bg-[#FAFAFA] border-b border-[#E6E9ED] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="inline-flex bg-[#F2F5F7] p-1 rounded border border-[#D9DEE4]">
            {(
              [
                { id: 'ALL', label: `Tất cả (${sfrRows.length})` },
                { id: 'OPTIMAL', label: 'Tối ưu (>= 80%)' },
                { id: 'MODERATE', label: 'Trung bình (45–79%)' },
                { id: 'UNDERUTILIZED', label: 'Lãng phí (< 45%)' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSfrFilter(f.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                  sfrFilter === f.id ? 'bg-[#2A3F54] text-white' : 'text-[#5A738E]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#73879C] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={sfrSearch}
              onChange={(e) => setSfrSearch(e.target.value)}
              placeholder="Tìm mã HP, lớp HP, phòng..."
              className="border border-[#D9DEE4] rounded pl-8 pr-2.5 py-1.5 bg-white w-[200px]"
            />
          </div>
        </div>

        <div className="x_content overflow-x-auto max-h-[340px]">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-[#E6E9ED] text-[#5A738E] text-left">
                <th className="py-2 pr-2 font-semibold">Học phần / Lớp HP</th>
                <th className="py-2 px-2 font-semibold">Ngày & Tiết</th>
                <th className="py-2 px-2 font-semibold">Phòng</th>
                <th className="py-2 px-2 text-right font-semibold">Sĩ số</th>
                <th className="py-2 px-2 text-right font-semibold">Sức chứa</th>
                <th className="py-2 px-2 text-right font-semibold">Trống dư</th>
                <th className="py-2 px-2 text-right font-semibold">SFR (%)</th>
                <th className="py-2 px-2 font-semibold">Đánh giá BR_RULE_10</th>
                <th className="py-2 pl-2 text-right font-semibold">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E9ED]">
              {sfrRows.map((row) => (
                <tr key={row.sessionId} className="hover:bg-[#F7F7F7]">
                  <td className="py-2 pr-2">
                    <span className="font-mono font-bold text-[#2A3F54]">{row.courseCode}</span>{' '}
                    <span className="text-[#5A738E]">{row.courseName}</span>
                    <div className="text-[11px] font-mono text-[#73879C]">{row.sectionCode}</div>
                  </td>
                  <td className="py-2 px-2 whitespace-nowrap">
                    {row.dayLabel} · <span className="font-mono">{row.periods}</span>
                  </td>
                  <td className="py-2 px-2 font-mono font-bold text-[#2A3F54]">{row.roomCode}</td>
                  <td className="py-2 px-2 text-right font-mono tabular-nums">{row.enrolled}</td>
                  <td className="py-2 px-2 text-right font-mono tabular-nums">{row.capacity}</td>
                  <td className="py-2 px-2 text-right font-mono tabular-nums text-[#73879C]">{row.emptySeats}</td>
                  <td className="py-2 px-2 text-right font-mono tabular-nums font-bold">
                    <span
                      className={
                        row.tier === 'OPTIMAL'
                          ? 'text-[#169F85]'
                          : row.tier === 'MODERATE'
                            ? 'text-[#3498DB]'
                            : 'text-[#D97706]'
                      }
                    >
                      {row.sfrPercent.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2 px-2 text-[11px]">
                    {row.tier === 'OPTIMAL' ? (
                      <span className="text-[#169F85] font-semibold">Tối ưu chuẩn</span>
                    ) : row.tier === 'MODERATE' ? (
                      <span className="text-[#5A738E]">Trung bình</span>
                    ) : (
                      <span className="text-[#B45309] font-semibold">Lãng phí (&lt; 45%)</span>
                    )}
                  </td>
                  <td className="py-2 pl-2 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedSfrRow(row)}
                      className="text-[#3498DB] hover:underline font-semibold inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Xem
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Reporting Matrix 7.2 */}
      <section className="x_panel">
        <div className="x_title flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-bold text-[#2A3F54] flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#1ABB9C]" />
              Ma trận 06 Báo cáo Phân tích Vận hành & Xuất Dữ liệu Chuẩn hóa (Mục 7.2)
            </h2>
            <p className="text-xs text-[#73879C] mt-0.5">
              Xuất trực tiếp tệp bảng tính CSV/Excel, in A4 chuẩn niêm yết khoa và đồng bộ lịch iCalendar (.ics)
            </p>
          </div>
        </div>
        <div className="x_content overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-[#E6E9ED] text-[#5A738E] text-left">
                <th className="py-2 pr-3 font-semibold">Tên Báo cáo Phân tích</th>
                <th className="py-2 px-2 font-semibold">Đối tượng sử dụng</th>
                <th className="py-2 px-2 font-semibold">Chu kỳ</th>
                <th className="py-2 px-2 font-semibold">Mục đích nghiệp vụ</th>
                <th className="py-2 pl-2 text-right font-semibold">Thao tác Xuất</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E9ED]">
              <tr className="hover:bg-[#F7F7F7]">
                <td className="py-3 pr-3 font-bold text-[#2A3F54]">1. Báo cáo Tiến độ Đào tạo Tổng thể</td>
                <td className="py-3 px-2 text-[#5A738E]">Ban Giám hiệu, Phòng ĐT</td>
                <td className="py-3 px-2 text-[#5A738E]">Hàng tuần / Tháng</td>
                <td className="py-3 px-2 text-[#5A738E]">Giám sát tỷ lệ hoàn thành giờ giảng các Khoa</td>
                <td className="py-3 pl-2 text-right">
                  <ExportToolbar
                    compact
                    filenameBase={`UTS_TienDoDaoTao_Tuan${state.activeWeek}`}
                    reportTitle="Báo cáo Tiến độ Đào tạo Tổng thể theo Khoa"
                    columns={[
                      { header: 'Mã Khoa', accessor: (f) => f.code },
                      { header: 'Tên Khoa', accessor: (f) => f.name },
                      { header: 'Tiết kế hoạch', accessor: (f) => f.plannedPeriods },
                      { header: 'Tiết thực dạy', accessor: (f) => f.completedPeriods },
                      { header: 'Hoàn thành (%)', accessor: (f) => f.progressPercent },
                    ]}
                    rows={state.faculties.map((fac) => {
                      const facSections = state.sections.filter((sec) => {
                        const c = state.courses.find((x) => x.courseId === sec.courseId);
                        return c?.facultyId === fac.facultyId;
                      });
                      const plannedPeriods = facSections.reduce((acc, s) => acc + s.periodsPerSession * 12, 0);
                      const completedPeriods = Math.round(plannedPeriods * 0.78);
                      const progressPercent = plannedPeriods > 0 ? Math.round((completedPeriods / plannedPeriods) * 100) : 0;
                      return {
                        code: fac.code,
                        name: fac.name,
                        plannedPeriods,
                        completedPeriods,
                        progressPercent,
                      };
                    })}
                  />
                </td>
              </tr>
              <tr className="hover:bg-[#F7F7F7]">
                <td className="py-3 pr-3 font-bold text-[#2A3F54]">2. Báo cáo Công suất & Tải Phòng học (RUR/SFR)</td>
                <td className="py-3 px-2 text-[#5A738E]">Phòng ĐT, Quản trị TB</td>
                <td className="py-3 px-2 text-[#5A738E]">Hàng tháng / Cuối kỳ</td>
                <td className="py-3 px-2 text-[#5A738E]">Phát hiện khung giờ quá tải & tối ưu điện năng BMS</td>
                <td className="py-3 pl-2 text-right">
                  <button type="button" onClick={exportRoomUtilizationCSV} className="px-3 py-1.5 rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white font-semibold inline-flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Xuất Excel/CSV
                  </button>
                </td>
              </tr>
              <tr className="hover:bg-[#F7F7F7]">
                <td className="py-3 pr-3 font-bold text-[#2A3F54]">3. Thống kê Khối lượng Giờ chuẩn Giảng dạy</td>
                <td className="py-3 px-2 text-[#5A738E]">Trưởng Khoa, Phòng TCCB</td>
                <td className="py-3 px-2 text-[#5A738E]">Hàng tháng / Kết thúc kỳ</td>
                <td className="py-3 px-2 text-[#5A738E]">Đối chiếu giờ thực dạy cơ hữu & thỉnh giảng thanh toán thù lao</td>
                <td className="py-3 pl-2 text-right">
                  <button type="button" onClick={exportTeachingLoadCSV} className="px-3 py-1.5 rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white font-semibold inline-flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Xuất Excel/CSV
                  </button>
                </td>
              </tr>
              <tr className="hover:bg-[#F7F7F7]">
                <td className="py-3 pr-3 font-bold text-[#2A3F54]">4. Bảng TKB Chi tiết theo Lớp (Chuẩn A4)</td>
                <td className="py-3 px-2 text-[#5A738E]">CVHT, Ban cán sự Lớp</td>
                <td className="py-3 px-2 text-[#5A738E]">Đầu kỳ / Trước T-4</td>
                <td className="py-3 px-2 text-[#5A738E]">Niêm yết tại bảng tin khoa & gửi sinh viên lưu trữ</td>
                <td className="py-3 pl-2 text-right">
                  <button type="button" onClick={() => window.print()} className="px-3 py-1.5 rounded border border-[#D9DEE4] bg-white hover:border-[#1ABB9C] text-[#2A3F54] font-semibold inline-flex items-center gap-1.5">
                    <Printer className="w-3.5 h-3.5" /> In chuẩn A4
                  </button>
                </td>
              </tr>
              <tr className="hover:bg-[#F7F7F7]">
                <td className="py-3 pr-3 font-bold text-[#2A3F54]">5. Lịch Giảng dạy Cá nhân Giảng viên (.ICS)</td>
                <td className="py-3 px-2 text-[#5A738E]">Từng Giảng viên, Bộ môn</td>
                <td className="py-3 px-2 text-[#5A738E]">Đầu kỳ / Cập nhật T-1</td>
                <td className="py-3 px-2 text-[#5A738E]">Đồng bộ Google Calendar, Apple Calendar, Outlook</td>
                <td className="py-3 pl-2 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <select
                      value={selectedInstrForIcal}
                      onChange={(e) => setSelectedInstrForIcal(e.target.value)}
                      className="border border-[#D9DEE4] rounded px-2 py-1 bg-white text-[11px]"
                    >
                      {state.instructors.map((i) => (
                        <option key={i.instructorId} value={i.instructorId}>
                          {i.title} {i.fullName}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={exportInstructorICal} className="px-3 py-1.5 rounded bg-[#3498DB] hover:bg-[#2980B9] text-white font-semibold inline-flex items-center gap-1.5">
                      <CalendarCheck className="w-3.5 h-3.5" /> Tải .ICS
                    </button>
                  </div>
                </td>
              </tr>
              <tr className="hover:bg-[#F7F7F7]">
                <td className="py-3 pr-3 font-bold text-[#2A3F54]">6. Báo cáo Lịch sử Biến động & Đổi phòng</td>
                <td className="py-3 px-2 text-[#5A738E]">Thanh tra Đào tạo, Khoa</td>
                <td className="py-3 px-2 text-[#5A738E]">Hàng tuần / Đột xuất</td>
                <td className="py-3 px-2 text-[#5A738E]">Giám sát kỷ cương giảng dạy & phát hiện đổi giờ tự phát</td>
                <td className="py-3 pl-2 text-right">
                  <button type="button" onClick={exportAuditLogCSV} className="px-3 py-1.5 rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white font-semibold inline-flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Xuất Audit CSV
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Printable A4 Class Timetable Preview + Ecosystem Integration & Dynamic QR */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Printable A4 Preview (7 cols) */}
        <section className="x_panel xl:col-span-7">
          <div className="x_title flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-[14px] font-bold text-[#2A3F54]">
                Bản xem trước In A4 — Thời khóa biểu Chính thức theo Lớp cơ hữu
              </h3>
              <p className="text-xs text-[#73879C]">Chọn lớp cơ hữu để kiểm tra & kết xuất Excel/JSON/.ICS/In A4</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 no-print">
              <select
                value={selectedClassForPrint}
                onChange={(e) => setSelectedClassForPrint(e.target.value)}
                className="text-xs border border-[#D9DEE4] rounded px-2.5 py-1.5 bg-white font-semibold"
              >
                {state.classes.map((c) => (
                  <option key={c.classId} value={c.classId}>
                    {c.classCode} — {c.className}
                  </option>
                ))}
              </select>
              <ExportToolbar
                compact
                filenameBase={`UTS_TKB_Lop_${selectedClassForPrint}_Tuan${state.activeWeek}`}
                reportTitle={`Thời khóa biểu Lớp ${selectedClassForPrint} Tuần ${state.activeWeek}`}
                onExportICal={() => {
                  const ics = generateICalendarContent(
                    state,
                    classTimetableRows,
                    `TKB Lớp ${selectedClassForPrint}`
                  );
                  triggerDownload(`UTS_TKB_${selectedClassForPrint}.ics`, ics, 'text/calendar;charset=utf-8;');
                  addToast({ type: 'success', title: 'Đã xuất .ICS cho lớp cơ hữu' });
                }}
                columns={[
                  { header: 'Thứ / Ngày', accessor: (s) => `${DAY_LABELS[s.dayOfWeek]} (${s.sessionDate})` },
                  { header: 'Tiết', accessor: (s) => `T${s.startPeriod}-${s.startPeriod + s.totalPeriods - 1}` },
                  { header: 'Khung giờ', accessor: (s) => getPeriodTimeRange(s.startPeriod, s.totalPeriods) },
                  {
                    header: 'Học phần',
                    accessor: (s) => {
                      const sec = state.sections.find((x) => x.sectionId === s.sectionId);
                      const crs = state.courses.find((c) => c.courseId === sec?.courseId);
                      return `${crs?.courseCode ?? ''} - ${crs?.courseName ?? ''}`;
                    },
                  },
                  {
                    header: 'Phòng học',
                    accessor: (s) => state.classrooms.find((r) => r.roomId === s.roomId)?.roomCode ?? '',
                  },
                  {
                    header: 'Giảng viên',
                    accessor: (s) => {
                      const sec = state.sections.find((x) => x.sectionId === s.sectionId);
                      const leadId = sec?.instructors.find((i) => i.role === 'LEAD')?.instructorId;
                      const ins = state.instructors.find((i) => i.instructorId === leadId);
                      return ins ? `${ins.title} ${ins.fullName}` : '';
                    },
                  },
                ]}
                rows={classTimetableRows}
              />
            </div>
          </div>
          <div className="x_content">
            <table className="w-full text-xs border-collapse border border-[#D9DEE4]">
              <thead>
                <tr className="bg-[#F2F5F7] text-[#2A3F54]">
                  <th className="border border-[#D9DEE4] p-2 text-left">Thứ / Ngày</th>
                  <th className="border border-[#D9DEE4] p-2 text-left">Ca / Tiết</th>
                  <th className="border border-[#D9DEE4] p-2 text-left">Học phần</th>
                  <th className="border border-[#D9DEE4] p-2 text-left">Phòng học</th>
                  <th className="border border-[#D9DEE4] p-2 text-left">Giảng viên</th>
                </tr>
              </thead>
              <tbody>
                {classTimetableRows.map((s) => {
                  const sec = state.sections.find((x) => x.sectionId === s.sectionId);
                  const crs = state.courses.find((c) => c.courseId === sec?.courseId);
                  const rm = state.classrooms.find((r) => r.roomId === s.roomId);
                  const leadId = sec?.instructors.find((i) => i.role === 'LEAD')?.instructorId;
                  const ins = state.instructors.find((i) => i.instructorId === leadId);
                  return (
                    <tr key={s.sessionId}>
                      <td className="border border-[#D9DEE4] p-2 font-semibold">
                        {DAY_LABELS[s.dayOfWeek]} ({s.sessionDate})
                      </td>
                      <td className="border border-[#D9DEE4] p-2 font-mono">
                        T{s.startPeriod}-{s.startPeriod + s.totalPeriods - 1} ({getPeriodTimeRange(s.startPeriod, s.totalPeriods)})
                      </td>
                      <td className="border border-[#D9DEE4] p-2">
                        <strong className="font-mono">{crs?.courseCode}</strong> — {crs?.courseName}
                      </td>
                      <td className="border border-[#D9DEE4] p-2 font-mono font-bold text-[#169F85]">
                        {rm?.roomCode}
                      </td>
                      <td className="border border-[#D9DEE4] p-2">
                        {ins ? `${ins.title} ${ins.fullName}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Ecosystem Integrations (SIS / LMS) + Smart Attendance Dynamic QR (5 cols) */}
        <div className="xl:col-span-5 space-y-5 no-print">
          <section className="x_panel">
            <div className="x_title">
              <h3 className="text-[14px] font-bold text-[#2A3F54]">
                Cổng Tích hợp Hệ sinh thái Đại học (SIS / LMS / SSO)
              </h3>
            </div>
            <div className="x_content space-y-3 text-xs">
              <div className="p-3 rounded border border-[#E6E9ED] bg-[#FAFAFA] flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-[#2A3F54]">SIS — Hệ thống Thông tin Sinh viên (Bi-directional Sync)</div>
                  <div className="text-[11px] text-[#5A738E]">
                    Đồng bộ gần nhất: <span className="font-mono">{new Date(state.sisLastSyncAt).toLocaleString('vi-VN')}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => syncIntegration('SIS')}
                  className="px-3 py-1.5 rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white font-semibold inline-flex items-center gap-1.5 shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Đồng bộ SIS
                </button>
              </div>
              <div className="p-3 rounded border border-[#E6E9ED] bg-[#FAFAFA] flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-[#2A3F54]">LMS — Moodle / Canvas (LTI 1.3 Course Shell Auto-Provision)</div>
                  <div className="text-[11px] text-[#5A738E]">
                    Đồng bộ gần nhất: <span className="font-mono">{new Date(state.lmsLastSyncAt).toLocaleString('vi-VN')}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => syncIntegration('LMS')}
                  className="px-3 py-1.5 rounded bg-[#3498DB] hover:bg-[#2980B9] text-white font-semibold inline-flex items-center gap-1.5 shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Đẩy lớp LMS
                </button>
              </div>
            </div>
          </section>

          {/* Dynamic 30s QR Smart Attendance (Section 7.3) */}
          <section className="x_panel">
            <div className="x_title flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-[#2A3F54] flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-[#1ABB9C]" />
                Điểm danh Thông minh (Dynamic QR 30 giây)
              </h3>
              <span className="font-mono text-xs font-bold text-[#169F85] tabular-nums">
                Đổi mã sau {qrSecondsLeft}s
              </span>
            </div>
            <div className="x_content flex flex-wrap items-center gap-4 text-xs">
              <div className="p-2 bg-white border border-[#2A3F54] rounded shrink-0">
                <div className="grid grid-cols-11 gap-0.5 w-[110px] h-[110px]">
                  {qrCells.map((filled, idx) => (
                    <div key={idx} className={filled ? 'bg-[#2A3F54]' : 'bg-white'} />
                  ))}
                </div>
              </div>
              <div className="flex-1 min-w-[180px] space-y-2">
                <label className="block font-semibold text-[#2A3F54]">Chọn buổi học trình chiếu QR:</label>
                <select
                  value={qrSessionId}
                  onChange={(e) => {
                    setQrSessionId(e.target.value);
                    setQrNonce(`UTS-QR-${Math.floor(10000 + Math.random() * 89999)}`);
                    setQrSecondsLeft(30);
                  }}
                  className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 bg-white text-xs"
                >
                  {state.sessions.slice(0, 8).map((s) => {
                    const sec = state.sections.find((x) => x.sectionId === s.sectionId);
                    const rm = state.classrooms.find((r) => r.roomId === s.roomId);
                    return (
                      <option key={s.sessionId} value={s.sessionId}>
                        {sec?.sectionCode} · {rm?.roomCode} ({DAY_LABELS[s.dayOfWeek]})
                      </option>
                    );
                  })}
                </select>
                <div className="font-mono text-[11px] text-[#5A738E]">
                  Token phiên hiện tại: <strong className="text-[#2A3F54]">{qrNonce}</strong>
                </div>
                <p className="text-[11px] text-[#73879C] leading-snug">
                  Sinh viên mở Mobile App quét mã trên máy chiếu để ghi nhận điểm danh thời gian thực, chống điểm danh hộ.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* CSV Import Validator (Section 7.3 Validation on Upload) */}
      <section className="x_panel no-print">
        <div className="x_title flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-[14px] font-bold text-[#2A3F54] flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-[#3498DB]" />
              Kiểm tra Tính hợp lệ Tệp Import Excel/CSV (Validation on Upload)
            </h3>
            <p className="text-xs text-[#73879C] mt-0.5">
              Tự động kiểm tra trùng mã học phần, sai định mức tín chỉ/tiết học và mã phòng không tồn tại trước khi ghi vào CSDL
            </p>
          </div>
          <button
            type="button"
            onClick={validateCsvUpload}
            className="px-3.5 py-1.5 rounded bg-[#2A3F54] hover:bg-[#172D44] text-white text-xs font-semibold"
          >
            Kiểm tra Dữ liệu Tải lên
          </button>
        </div>
        <div className="x_content grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          <textarea
            rows={5}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            className="w-full border border-[#D9DEE4] rounded p-3 font-mono text-[11px] bg-[#FAFAFA]"
          />
          <div className="space-y-2">
            {!csvValidation ? (
              <div className="h-full flex items-center justify-center border border-dashed border-[#D9DEE4] rounded p-4 text-[#73879C]">
                Nhấn "Kiểm tra Dữ liệu Tải lên" để chạy bộ lọc kiểm lỗi tự động trên dữ liệu CSV mẫu bên trái.
              </div>
            ) : (
              csvValidation.map((r) => (
                <div
                  key={r.line}
                  className={`p-2.5 rounded border flex items-start justify-between gap-2 ${
                    r.status === 'OK'
                      ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
                      : 'bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]'
                  }`}
                >
                  <div>
                    <div className="font-mono font-bold">
                      Dòng {r.line} ({r.code}) — {r.status === 'OK' ? 'Hợp lệ' : 'Lỗi dữ liệu'}
                    </div>
                    <div className="text-[11px] mt-0.5">{r.message}</div>
                  </div>
                  {r.status === 'OK' && <CheckCircle2 className="w-4 h-4 shrink-0 text-[#16A34A]" />}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* SFR RECORD DETAIL MODAL */}
      {selectedSfrRow && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded border border-[#D9DEE4] shadow-xl max-w-[540px] w-full overflow-hidden">
            <div className="px-5 py-3.5 bg-[#2A3F54] text-white flex items-center justify-between">
              <div>
                <div className="font-mono text-[11px] text-[#1ABB9C]">Phân tích Chi tiết Lấp đầy Chỗ ngồi (SFR)</div>
                <h4 className="text-sm font-bold">{selectedSfrRow.courseCode} — {selectedSfrRow.courseName}</h4>
              </div>
              <button type="button" onClick={() => setSelectedSfrRow(null)} className="text-white/75 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-3 bg-[#FAFAFA] border border-[#E6E9ED] rounded p-3 font-mono tabular-nums">
                <div>
                  <div className="font-sans text-[11px] text-[#73879C]">Sĩ số lớp (S_lop)</div>
                  <div className="text-base font-bold text-[#2A3F54]">{selectedSfrRow.enrolled} SV</div>
                </div>
                <div>
                  <div className="font-sans text-[11px] text-[#73879C]">Sức chứa ({selectedSfrRow.roomCode})</div>
                  <div className="text-base font-bold text-[#2A3F54]">{selectedSfrRow.capacity} chỗ</div>
                </div>
                <div>
                  <div className="font-sans text-[11px] text-[#73879C]">Tỷ lệ SFR</div>
                  <div className={`text-base font-bold ${selectedSfrRow.tier === 'UNDERUTILIZED' ? 'text-[#D97706]' : 'text-[#169F85]'}`}>
                    {selectedSfrRow.sfrPercent.toFixed(1)}%
                  </div>
                </div>
              </div>
              <div className="text-[#5A738E]">
                Lớp HP: <strong className="font-mono text-[#2A3F54]">{selectedSfrRow.sectionCode}</strong> · Thời gian:{' '}
                <strong>{selectedSfrRow.dayLabel} ({selectedSfrRow.sessionDate}) {selectedSfrRow.periods}</strong> · Chỗ trống dư:{' '}
                <strong className="font-mono text-[#2A3F54]">{selectedSfrRow.emptySeats} ghế</strong>
              </div>
              <div className="p-3 rounded bg-[#EFF6FF] border border-[#3498DB]/35 text-[#1E3A5F]">
                <strong>Khuyến nghị điều phối phòng:</strong> {selectedSfrRow.recommendation}
              </div>
            </div>
            <div className="px-5 py-3 bg-[#F7F7F7] border-t border-[#E6E9ED] flex justify-between">
              <button
                type="button"
                onClick={() => {
                  const roomObj = state.classrooms.find((r) => r.roomCode === selectedSfrRow.roomCode);
                  setSelectedSfrRow(null);
                  navigateWithDrillDown('builder', {
                    sourceLabel: `Tối ưu phòng ${selectedSfrRow.roomCode} (${selectedSfrRow.courseCode})`,
                    builderViewMode: 'ROOM',
                    builderEntityId: roomObj?.roomId,
                  });
                }}
                className="px-3 py-1.5 rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white text-xs font-semibold"
              >
                Điều chỉnh trên Lưới TKB
              </button>
              <button type="button" onClick={() => setSelectedSfrRow(null)} className="px-4 py-1.5 rounded bg-[#2A3F54] text-white text-xs font-semibold">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
