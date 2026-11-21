import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarRange, CheckCircle2, ClipboardList, Search, Settings2, Users, X } from 'lucide-react';
import { useUTS } from '../../context/UTSContext';
import { DAY_LABELS, ROOM_TYPE_LABELS, getPeriodTimeRange } from '../../engine/conflictEngine';
import type { ExamScheduleItem } from '../../types/uts';
import { DrillDownBanner, ExportToolbar } from '../common/ExportToolbar';

export const SemesterAndExamsHub: React.FC = () => {
  const { state, drillDown, navigateWithDrillDown, hasPermission } = useUTS();
  const [examFilter, setExamFilter] = useState<'ALL' | 'MODULAR' | 'CONSOLIDATED'>('ALL');
  const [allocSearch, setAllocSearch] = useState('');
  const [examSearch, setExamSearch] = useState('');
  const [selectedExam, setSelectedExam] = useState<ExamScheduleItem | null>(null);

  const examsRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (drillDown?.planningFocus === 'EXAMS') {
      setTimeout(() => {
        examsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  }, [drillDown]);

  const weeks = Array.from({ length: 18 }, (_, i) => i + 1);

  const filteredAllocations = useMemo(() => {
    const q = allocSearch.trim().toLowerCase();
    return state.weekAllocations.filter((alloc) => {
      const crs = state.courses.find((c) => c.courseId === alloc.courseId);
      if (!q) return true;
      return `${crs?.courseCode ?? ''} ${crs?.courseName ?? ''}`.toLowerCase().includes(q);
    });
  }, [state.weekAllocations, state.courses, allocSearch]);

  const filteredExams = useMemo(() => {
    const q = examSearch.trim().toLowerCase();
    return state.exams.filter((e) => {
      if (examFilter !== 'ALL' && e.examMode !== examFilter) return false;
      if (q) {
        const crs = state.courses.find((c) => c.courseId === e.courseId);
        const rm = state.classrooms.find((r) => r.roomId === e.roomId);
        const hay = `${e.examId} ${crs?.courseCode ?? ''} ${crs?.courseName ?? ''} ${rm?.roomCode ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [state.exams, state.courses, state.classrooms, examFilter, examSearch]);

  return (
    <div className="space-y-5">
      <DrillDownBanner />

      {/* Step 3: 18-Week Semester Allocation Matrix (T-8 Milestone) */}
      <section
        className={`x_panel ${
          drillDown?.planningFocus === 'ALLOCATION' ? 'ring-2 ring-[#1ABB9C]' : ''
        }`}
      >
        <div className="x_title flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-[#2A3F54] flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-[#1ABB9C]" />
              Bước 3: Phân bổ Thời lượng 18 Tuần Học kỳ & Lịch Thi (Mốc T-8 Tuần)
            </h2>
            <p className="text-xs text-[#73879C] mt-0.5">
              Áp dụng quy tắc phân bổ cụm tiết chẵn (4 hoặc 8 tiết/tuần) · Tuần 1–15 giảng dạy · Tuần 16–18 thi tập trung
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#73879C] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={allocSearch}
                onChange={(e) => setAllocSearch(e.target.value)}
                placeholder="Tìm mã hoặc tên HP..."
                className="text-xs border border-[#D9DEE4] rounded pl-8 pr-2.5 py-1.5 bg-white w-[170px]"
              />
            </div>
            <ExportToolbar
              compact
              filenameBase="UTS_KeHoachPhanBo_18Tuan"
              reportTitle="Ma trận Phân bổ Thời lượng 18 Tuần Học kỳ"
              columns={[
                {
                  header: 'Mã HP',
                  accessor: (a) => state.courses.find((c) => c.courseId === a.courseId)?.courseCode ?? a.courseId,
                },
                {
                  header: 'Tên học phần',
                  accessor: (a) => state.courses.find((c) => c.courseId === a.courseId)?.courseName ?? '',
                },
                { header: 'Tuần bắt đầu', accessor: (a) => `T${a.startWeek}` },
                { header: 'Tuần kết thúc', accessor: (a) => `T${a.endWeek}` },
                { header: 'Tiết/tuần', accessor: (a) => a.periodsPerWeek },
                { header: 'Tuần thi', accessor: (a) => `T${a.examWeek}` },
                {
                  header: 'Mô hình thi',
                  accessor: (a) =>
                    state.courses.find((c) => c.courseId === a.courseId)?.examMode === 'MODULAR'
                      ? 'Thi cuốn chiếu'
                      : 'Thi tập trung',
                },
              ]}
              rows={filteredAllocations}
            />
          </div>
        </div>
        <div className="x_content overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[920px]">
            <thead>
              <tr className="border-b-2 border-[#E6E9ED] text-[#5A738E]">
                <th className="py-2 pr-3 text-left font-semibold w-[220px]">Học phần & Mô hình thi</th>
                {weeks.map((w) => (
                  <th
                    key={w}
                    className={`py-2 px-1 text-center font-mono text-[11px] ${
                      w === state.activeWeek
                        ? 'bg-[#2A3F54] text-white'
                        : w >= 16
                          ? 'bg-[#FEF2F2] text-[#B91C1C]'
                          : ''
                    }`}
                  >
                    T{w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E9ED]">
              {filteredAllocations.map((alloc) => {
                const crs = state.courses.find((c) => c.courseId === alloc.courseId);
                return (
                  <tr key={alloc.courseId} className="hover:bg-[#FAFAFA]">
                    <td className="py-2.5 pr-3">
                      <div className="font-mono font-bold text-[#2A3F54]">
                        {crs?.courseCode}{' '}
                        <span className="font-sans font-normal text-[#5A738E]">— {crs?.courseName}</span>
                      </div>
                      <div className="text-[11px] text-[#73879C]">
                        {crs?.examMode === 'MODULAR' ? 'Thi cuốn chiếu sau môn' : 'Thi tập trung cuối kỳ'} ·{' '}
                        <span className="font-mono">{alloc.periodsPerWeek} tiết/tuần</span>
                      </div>
                    </td>
                    {weeks.map((w) => {
                      const isTeaching = w >= alloc.startWeek && w <= alloc.endWeek;
                      const isExam = w === alloc.examWeek;
                      return (
                        <td
                          key={w}
                          className={`p-1 text-center ${
                            w === state.activeWeek ? 'bg-[#2A3F54]/5' : ''
                          }`}
                        >
                          {isExam ? (
                            <div
                              title={`Tuần ${w}: Thi kết thúc môn ${crs?.courseCode}`}
                              className="py-1.5 rounded bg-[#E74C3C] text-white font-mono text-[10px] font-bold"
                            >
                              THI
                            </div>
                          ) : isTeaching ? (
                            <div
                              title={`Tuần ${w}: ${alloc.periodsPerWeek} tiết`}
                              className="py-1.5 rounded bg-[#1ABB9C] text-white font-mono text-[10px] font-semibold"
                            >
                              {alloc.periodsPerWeek}
                            </div>
                          ) : (
                            <span className="text-[#CBD5E1]">·</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Master Data Sync: Active Exam Models Catalog */}
      <section className="x_panel">
        <div className="x_title flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-bold text-[#2A3F54] flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-[#3498DB]" />
              Danh mục Mô hình Thi đang áp dụng (Đồng bộ Master Data — {state.examModels.length} mô hình)
            </h2>
            <p className="text-xs text-[#73879C] mt-0.5">
              Quy chuẩn thời lượng, tỷ lệ giãn cách chỗ ngồi và định mức giám thị áp dụng tự động cho các học phần và ca thi bên dưới
            </p>
          </div>
          {hasPermission('MASTER_EXAM_MODELS', 'update') && (
            <button
              type="button"
              onClick={() =>
                navigateWithDrillDown('master', {
                  sourceLabel: 'Từ Kế hoạch & Lịch thi → Quản trị Danh mục Mô hình thi',
                  masterTab: 'CATALOGS',
                })
              }
              className="px-3 py-1.5 rounded border border-[#1ABB9C] text-[#169F85] hover:bg-[#1ABB9C]/10 text-xs font-semibold flex items-center gap-1.5"
            >
              <Settings2 className="w-3.5 h-3.5" />
              Cấu hình Mô hình thi (Master Data)
            </button>
          )}
        </div>
        <div className="x_content grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {state.examModels.map((em) => {
            const linkedCourses = state.courses.filter((c) => c.examModelCode === em.code).length;
            return (
              <div
                key={em.modelId}
                className={`p-3 rounded border transition-colors ${
                  em.isActive ? 'border-[#E6E9ED] bg-[#FAFAFA]' : 'border-[#E6E9ED] bg-[#F7F7F7] opacity-65'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-[#2A3F54]">{em.code}</span>
                  <span
                    className={`font-semibold text-[11px] ${
                      em.baseMode === 'MODULAR' ? 'text-[#169F85]' : 'text-[#3498DB]'
                    }`}
                  >
                    {em.baseMode === 'MODULAR' ? 'Cuốn chiếu' : 'Tập trung'}
                  </span>
                </div>
                <div className="font-semibold text-[#2A3F54] mt-1">{em.name}</div>
                <div className="grid grid-cols-2 gap-1 mt-2 font-mono text-[11px] text-[#5A738E]">
                  <div>Thời lượng: {em.durationMinutes}p</div>
                  <div>Giãn cách: ≤{em.maxRoomFillPercent}%</div>
                  <div>Giám thị: 1/{em.studentsPerProctor} SV</div>
                  <div>Áp dụng: {linkedCourses} HP</div>
                </div>
                <div className="mt-1.5 text-[11px] text-[#73879C] truncate" title={em.allowedRoomTypes.map((t) => ROOM_TYPE_LABELS[t]).join(', ')}>
                  Phòng: {em.allowedRoomTypes.map((t) => ROOM_TYPE_LABELS[t]).join(', ')}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Exam Scheduling & Proctor Assignment (BR_RULE_11) */}
      <section
        ref={examsRef}
        className={`x_panel ${
          drillDown?.planningFocus === 'EXAMS' ? 'ring-2 ring-[#E74C3C]' : ''
        }`}
      >
        <div className="x_title flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-[#2A3F54] flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-[#E74C3C]" />
              Điều phối Lịch thi Kết thúc Học phần, Phòng thi & Giám thị (BR_RULE_11)
            </h2>
            <p className="text-xs text-[#73879C] mt-0.5">
              Nhấn vào bất kỳ ca thi nào để xem chi tiết tỷ lệ giãn cách 50% sức chứa và phân công giám thị
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#73879C] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={examSearch}
                onChange={(e) => setExamSearch(e.target.value)}
                placeholder="Tìm mã ca thi, môn, phòng..."
                className="text-xs border border-[#D9DEE4] rounded pl-8 pr-2.5 py-1.5 bg-white w-[180px]"
              />
            </div>
            <div className="inline-flex bg-[#F2F5F7] p-1 rounded border border-[#D9DEE4]">
              {(
                [
                  { id: 'ALL', label: `Tất cả (${state.exams.length})` },
                  { id: 'MODULAR', label: 'Cuốn chiếu' },
                  { id: 'CONSOLIDATED', label: 'Tập trung' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setExamFilter(f.id)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                    examFilter === f.id ? 'bg-[#2A3F54] text-white' : 'text-[#5A738E]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <ExportToolbar
              compact
              filenameBase="UTS_LichThiKetThucHocPhan"
              reportTitle="Danh sách Lịch thi Kết thúc Học phần & Giám thị"
              columns={[
                { header: 'Mã ca thi', accessor: (e) => e.examId },
                {
                  header: 'Học phần',
                  accessor: (e) => {
                    const c = state.courses.find((x) => x.courseId === e.courseId);
                    return `${c?.courseCode ?? ''} - ${c?.courseName ?? ''}`;
                  },
                },
                {
                  header: 'Lớp HP',
                  accessor: (e) => state.sections.find((s) => s.sectionId === e.sectionId)?.sectionCode ?? '',
                },
                { header: 'Mô hình thi', accessor: (e) => (e.examMode === 'MODULAR' ? 'Cuốn chiếu' : 'Tập trung') },
                { header: 'Tuần thi', accessor: (e) => `T${e.examWeek}` },
                { header: 'Ngày thi', accessor: (e) => `${DAY_LABELS[e.dayOfWeek]} (${e.examDate})` },
                { header: 'Tiết', accessor: (e) => `T${e.startPeriod}-${e.startPeriod + e.totalPeriods - 1}` },
                {
                  header: 'Phòng thi',
                  accessor: (e) => state.classrooms.find((r) => r.roomId === e.roomId)?.roomCode ?? '',
                },
                { header: 'Thí sinh', accessor: (e) => e.candidateCount },
                {
                  header: 'Giám thị',
                  accessor: (e) =>
                    e.proctorIds
                      .map((id) => state.instructors.find((i) => i.instructorId === id))
                      .filter(Boolean)
                      .map((i) => `${i!.title} ${i!.fullName}`)
                      .join('; '),
                },
              ]}
              rows={filteredExams}
            />
          </div>
        </div>
        <div className="x_content overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-[#E6E9ED] text-[#5A738E] text-left">
                <th className="py-2 pr-3 font-semibold">Mã Ca thi</th>
                <th className="py-2 px-2 font-semibold">Học phần & Lớp HP</th>
                <th className="py-2 px-2 font-semibold">Mô hình Thi</th>
                <th className="py-2 px-2 font-semibold">Ngày & Ca thi</th>
                <th className="py-2 px-2 font-semibold">Phòng thi & Giãn cách (50%)</th>
                <th className="py-2 px-2 font-semibold">Giám thị Coi thi (Cùng BM)</th>
                <th className="py-2 pl-2 text-right font-semibold">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E9ED]">
              {filteredExams.map((ex) => {
                const crs = state.courses.find((c) => c.courseId === ex.courseId);
                const sec = state.sections.find((s) => s.sectionId === ex.sectionId);
                const rm = state.classrooms.find((r) => r.roomId === ex.roomId);
                const examModel = state.examModels.find((m) => m.code === crs?.examModelCode);
                const fillPct = examModel?.maxRoomFillPercent ?? 50;
                const safeExamCap = rm ? Math.floor((rm.maxCapacity * fillPct) / 100) : 0;
                const proctors = ex.proctorIds
                  .map((id) => state.instructors.find((i) => i.instructorId === id))
                  .filter(Boolean);

                return (
                  <tr
                    key={ex.examId}
                    onClick={() => setSelectedExam(ex)}
                    className="hover:bg-[#EFF6FF]/60 cursor-pointer"
                  >
                    <td className="py-3 pr-3 font-mono font-bold text-[#2A3F54]">{ex.examId}</td>
                    <td className="py-3 px-2">
                      <div className="font-bold text-[#2A3F54]">
                        {crs?.courseCode} — {crs?.courseName}
                      </div>
                      <div className="font-mono text-[11px] text-[#73879C]">{sec?.sectionCode}</div>
                    </td>
                    <td className="py-3 px-2">
                      <div
                        className={`font-semibold ${
                          ex.examMode === 'MODULAR' ? 'text-[#169F85]' : 'text-[#3498DB]'
                        }`}
                      >
                        {ex.examMode === 'MODULAR' ? 'Cuốn chiếu (Tuần ' + ex.examWeek + ')' : 'Tập trung (Tuần ' + ex.examWeek + ')'}
                      </div>
                      {examModel && (
                        <div className="font-mono text-[10px] text-[#73879C]">
                          {examModel.code} · {examModel.durationMinutes}p · ≤{fillPct}% chỗ
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <div className="font-semibold text-[#2A3F54]">
                        {DAY_LABELS[ex.dayOfWeek]} · {ex.examDate}
                      </div>
                      <div className="font-mono text-[11px] text-[#5A738E]">
                        Tiết {ex.startPeriod}-{ex.startPeriod + ex.totalPeriods - 1} ({getPeriodTimeRange(ex.startPeriod, ex.totalPeriods)})
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="font-mono font-bold text-[#2A3F54]">{rm?.roomCode}</div>
                      <div
                        className={`text-[11px] font-mono tabular-nums ${
                          ex.candidateCount <= safeExamCap ? 'text-[#169F85]' : 'text-[#D97706]'
                        }`}
                      >
                        {ex.candidateCount} thí sinh / {safeExamCap} chỗ giãn cách
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="space-y-0.5 text-[#2A3F54]">
                        {proctors.map((p) => (
                          <div key={p!.instructorId} className="inline-flex items-center gap-1 mr-2">
                            <Users className="w-3 h-3 text-[#73879C]" />
                            <span>{p!.title} {p!.fullName}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 pl-2 text-right">
                      <span className="inline-flex items-center gap-1 font-semibold text-[#169F85]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {ex.status === 'PUBLISHED' ? 'Đã công bố App' : 'Đã xếp lịch'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* EXAM RECORD DETAIL MODAL */}
      {selectedExam && (() => {
        const crs = state.courses.find((c) => c.courseId === selectedExam.courseId);
        const sec = state.sections.find((s) => s.sectionId === selectedExam.sectionId);
        const rm = state.classrooms.find((r) => r.roomId === selectedExam.roomId);
        const safeCap = rm ? Math.floor(rm.maxCapacity * 0.5) : 0;
        const proctors = selectedExam.proctorIds
          .map((id) => state.instructors.find((i) => i.instructorId === id))
          .filter(Boolean);
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded border border-[#D9DEE4] shadow-xl max-w-[540px] w-full overflow-hidden">
              <div className="px-5 py-3.5 bg-[#2A3F54] text-white flex items-center justify-between">
                <div>
                  <div className="font-mono text-[11px] text-[#1ABB9C]">Hồ sơ Ca thi · {selectedExam.examId}</div>
                  <h4 className="text-sm font-bold">{crs?.courseCode} — {crs?.courseName}</h4>
                </div>
                <button type="button" onClick={() => setSelectedExam(null)} className="text-white/75 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-[#FAFAFA] border border-[#E6E9ED] rounded p-3">
                  <div>
                    <div className="text-[11px] text-[#73879C]">Thời gian thi</div>
                    <div className="font-bold text-[#2A3F54]">{DAY_LABELS[selectedExam.dayOfWeek]} ({selectedExam.examDate})</div>
                    <div className="font-mono text-[11px] text-[#169F85]">
                      Tiết {selectedExam.startPeriod}-{selectedExam.startPeriod + selectedExam.totalPeriods - 1} ({getPeriodTimeRange(selectedExam.startPeriod, selectedExam.totalPeriods)})
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#73879C]">Phòng thi & Giãn cách 50%</div>
                    <div className="font-mono font-bold text-[#2A3F54]">{rm?.roomCode} ({rm?.maxCapacity} chỗ chuẩn)</div>
                    <div className={`font-mono text-[11px] font-semibold ${selectedExam.candidateCount <= safeCap ? 'text-[#169F85]' : 'text-[#D97706]'}`}>
                      {selectedExam.candidateCount} thí sinh / {safeCap} giới hạn an toàn
                    </div>
                  </div>
                </div>
                <div>
                  <div className="font-bold text-[#2A3F54] mb-1">Lớp học phần & Giám thị coi thi</div>
                  <div className="text-[#5A738E]">Lớp HP: <span className="font-mono font-semibold text-[#2A3F54]">{sec?.sectionCode}</span></div>
                  <div className="mt-1 space-y-1">
                    {proctors.map((p) => (
                      <div key={p!.instructorId} className="text-[#2A3F54]">
                        · {p!.title} {p!.fullName} ({p!.staffCode})
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-5 py-3 bg-[#F7F7F7] border-t border-[#E6E9ED] flex justify-end">
                <button type="button" onClick={() => setSelectedExam(null)} className="px-4 py-1.5 rounded bg-[#2A3F54] text-white text-xs font-semibold">
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
