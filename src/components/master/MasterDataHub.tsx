import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Database,
  Edit3,
  Eye,
  GitBranch,
  Info,
  Layers,
  Plus,
  Search,
  Trash2,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { useUTS } from '../../context/UTSContext';
import {
  COURSE_PERIOD_GUIDE,
  DAY_LABELS,
  ROOM_TYPE_LABELS,
  SHIFT_DEFS,
  formatRoomTypesList,
  generateICalendarContent,
  getPeriodTimeRange,
  validateCourseHours,
} from '../../engine/conflictEngine';
import type {
  AcademicClass,
  Classroom,
  CourseSubject,
  Instructor,
  InstructorRole,
  InstructorType,
  PrerequisiteRuleType,
  RoomType,
} from '../../types/uts';
import { DrillDownBanner, ExportToolbar } from '../common/ExportToolbar';
import { triggerDownload } from '../../utils/exportUtils';
import { MasterCatalogManager } from '../admin/MasterCatalogManager';

type MasterTab = 'TREE' | 'COURSES' | 'ROOMS' | 'INSTRUCTORS' | 'CATALOGS';

export const MasterDataHub: React.FC = () => {
  const {
    state,
    drillDown,
    navigateWithDrillDown,
    currentRole,
    roleCapabilities,
    hasPermission,
    addToast,
    createCourse,
    updateCourse,
    deleteCourse,
    addPrerequisite,
    updateRoomStatus,
    toggleInstructorAvailability,
    updateIncidentStatus,
    assignInstructorToSection,
    createInstructor,
    updateInstructor,
    deleteInstructor,
  } = useUTS();

  const [activeTab, setActiveTab] = useState<MasterTab>('COURSES');

  // Filter / Search states across tabs
  const [treeFacultyFilter, setTreeFacultyFilter] = useState<string>('ALL');
  const [treeSearch, setTreeSearch] = useState<string>('');
  const [courseSearch, setCourseSearch] = useState<string>('');
  const [courseFacultyFilter, setCourseFacultyFilter] = useState<string>('ALL');
  const [roomSearch, setRoomSearch] = useState<string>('');
  const [roomCampusFilter, setRoomCampusFilter] = useState<string>('ALL');
  const [roomBuildingFilter, setRoomBuildingFilter] = useState<string>('ALL');
  const [roomStatusFilter, setRoomStatusFilter] = useState<string>('ALL');
  const [incidentStatusFilter, setIncidentStatusFilter] = useState<string>('ALL');
  const [instrSearch, setInstrSearch] = useState<string>('');
  const [instrFacultyFilter, setInstrFacultyFilter] = useState<string>('ALL');

  // Record detail modals
  const [detailClass, setDetailClass] = useState<AcademicClass | null>(null);
  const [detailCourse, setDetailCourse] = useState<CourseSubject | null>(null);
  const [detailRoom, setDetailRoom] = useState<Classroom | null>(null);
  const [detailInstructor, setDetailInstructor] = useState<Instructor | null>(null);

  const incidentsSectionRef = useRef<HTMLElement | null>(null);

  // New / Edit Course Form State (SRS-WEB-01)
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [confirmDeleteCourseId, setConfirmDeleteCourseId] = useState<string | null>(null);
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [courseNameEn, setCourseNameEn] = useState('');
  const [facultyId, setFacultyId] = useState('FAC_IT');
  const [departmentId, setDepartmentId] = useState('DEP_SE');
  const [credits, setCredits] = useState(3);
  const [lt, setLt] = useState(30);
  const [bt, setBt] = useState(10);
  const [tl, setTl] = useState(5);
  const [th, setTh] = useState(15);
  const [reqRoomTypes, setReqRoomTypes] = useState<RoomType[]>(['THEORY', 'LAB_COMP']);
  const [examMode, setExamMode] = useState<'MODULAR' | 'CONSOLIDATED'>('CONSOLIDATED');
  const [examModelCode, setExamModelCode] = useState<string>('EXM_CONSOLIDATED');
  const [showPeriodGuide, setShowPeriodGuide] = useState(false);

  // New / Edit Instructor Form State
  const [showInstrForm, setShowInstrForm] = useState(false);
  const [editingInstrId, setEditingInstrId] = useState<string | null>(null);
  const [confirmDeleteInstrId, setConfirmDeleteInstrId] = useState<string | null>(null);
  const [insStaffCode, setInsStaffCode] = useState('');
  const [insTitle, setInsTitle] = useState('ThS.');
  const [insFullName, setInsFullName] = useState('');
  const [insFacultyId, setInsFacultyId] = useState('FAC_IT');
  const [insEmail, setInsEmail] = useState('');
  const [insType, setInsType] = useState<InstructorType>('FULL_TIME');
  const [insMaxDay, setInsMaxDay] = useState(6);

  // New Prerequisite Form State (Cycle Detection Demo!)
  const [preCourseId, setPreCourseId] = useState('CRS_CS101');
  const [preTargetId, setPreTargetId] = useState('CRS_IT305');
  const [preRuleType, setPreRuleType] = useState<PrerequisiteRuleType>('MANDATORY');
  const [cycleError, setCycleError] = useState<string | null>(null);

  // Selected instructor for Availability Matrix & Multi-Instructor assignment form
  const [selectedInstructorId, setSelectedInstructorId] = useState('INS_01');
  const [assignSectionId, setAssignSectionId] = useState('SEC_IT305_01');
  const [assignInstrId, setAssignInstrId] = useState('INS_04');
  const [assignInstrRole, setAssignInstrRole] = useState<InstructorRole>('TA');
  const [assignPeriods, setAssignPeriods] = useState<number>(15);

  // Live Granular CRUD Permissions
  const canCreateCourse = hasPermission('MASTER_COURSES', 'create');
  const canUpdateCourse = hasPermission('MASTER_COURSES', 'update');
  const canDeleteCourse = hasPermission('MASTER_COURSES', 'delete');
  const canCreateInstr = hasPermission('MASTER_INSTRUCTORS', 'create');
  const canUpdateInstr = hasPermission('MASTER_INSTRUCTORS', 'update');
  const canDeleteInstr = hasPermission('MASTER_INSTRUCTORS', 'delete');

  // Role-aware scoping when role changes (without overriding explicit drillDown)
  useEffect(() => {
    if (drillDown) return;
    if (currentRole.role === 'FACULTY_HEAD' && currentRole.facultyId) {
      setTreeFacultyFilter(currentRole.facultyId);
      setCourseFacultyFilter(currentRole.facultyId);
      setInstrFacultyFilter(currentRole.facultyId);
    } else if (currentRole.role === 'INSTRUCTOR' && currentRole.instructorId) {
      setSelectedInstructorId(currentRole.instructorId);
      setInstrFacultyFilter(currentRole.facultyId ?? 'ALL');
    } else {
      setTreeFacultyFilter('ALL');
      setCourseFacultyFilter('ALL');
      setInstrFacultyFilter('ALL');
    }
  }, [currentRole, drillDown]);

  // Consume drillDown from Dashboard
  useEffect(() => {
    if (!drillDown) return;
    if (drillDown.masterTab) setActiveTab(drillDown.masterTab);
    if (drillDown.facultyId) {
      setTreeFacultyFilter(drillDown.facultyId);
      setCourseFacultyFilter(drillDown.facultyId);
      setInstrFacultyFilter(drillDown.facultyId);
    }
    if (drillDown.campusCode) setRoomCampusFilter(drillDown.campusCode);
    if (drillDown.buildingId) setRoomBuildingFilter(drillDown.buildingId);
    if (drillDown.instructorId) setSelectedInstructorId(drillDown.instructorId);
    if (drillDown.roomMetricFocus === 'INCIDENTS') {
      setIncidentStatusFilter('OPEN');
      setTimeout(() => {
        incidentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  }, [drillDown]);

  const ratioPreview = validateCourseHours({
    credits,
    theoryPeriods: lt,
    exercisePeriods: bt,
    discussionPeriods: tl,
    practicalPeriods: th,
  });

  const activeWeekSessions = useMemo(
    () =>
      state.sessions.filter(
        (s) => s.weekIndex === state.activeWeek && s.status !== 'CANCELLED' && s.status !== 'RESCHEDULED'
      ),
    [state.sessions, state.activeWeek]
  );

  // TAB 1: Filtered faculties & exportable classes
  const filteredFaculties = useMemo(() => {
    return state.faculties.filter(
      (f) => treeFacultyFilter === 'ALL' || f.facultyId === treeFacultyFilter
    );
  }, [state.faculties, treeFacultyFilter]);

  const exportableTreeRows = useMemo(() => {
    const q = treeSearch.trim().toLowerCase();
    return state.classes
      .map((cls) => {
        const maj = state.majors.find((m) => m.majorId === cls.majorId);
        const fac = state.faculties.find((f) => f.facultyId === maj?.facultyId);
        const advisor = state.instructors.find((i) => i.instructorId === cls.advisorId);
        const weekSessCount = activeWeekSessions.filter((s) => {
          const sec = state.sections.find((x) => x.sectionId === s.sectionId);
          return sec?.cohortClassIds.includes(cls.classId);
        }).length;
        return {
          cls,
          facultyId: fac?.facultyId ?? '',
          facultyName: fac ? `${fac.code} - ${fac.name}` : '',
          majorCode: maj?.majorCode ?? '',
          majorName: maj?.majorName ?? '',
          degreeLevel: maj?.degreeLevel ?? '',
          educationSystem: maj?.educationSystem ?? '',
          classCode: cls.classCode,
          className: cls.className,
          academicYear: cls.academicYear,
          studentCount: cls.studentCount,
          advisor: advisor ? `${advisor.title} ${advisor.fullName}` : 'Chưa gán',
          weekSessCount,
        };
      })
      .filter((row) => {
        if (treeFacultyFilter !== 'ALL' && row.facultyId !== treeFacultyFilter) return false;
        if (q) {
          const hay = `${row.classCode} ${row.className} ${row.majorName} ${row.facultyName}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [state.classes, state.majors, state.faculties, state.instructors, state.sections, activeWeekSessions, treeFacultyFilter, treeSearch]);

  // TAB 2: Filtered courses
  const filteredCourses = useMemo(() => {
    const q = courseSearch.trim().toLowerCase();
    return state.courses.filter((c) => {
      if (courseFacultyFilter !== 'ALL' && c.facultyId !== courseFacultyFilter) return false;
      if (q) {
        const hay = `${c.courseCode} ${c.courseName} ${c.courseNameEn}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [state.courses, courseSearch, courseFacultyFilter]);

  // TAB 3: Classrooms enriched with live RUR % and session stats
  const enrichedRooms = useMemo(() => {
    const q = roomSearch.trim().toLowerCase();
    return state.classrooms
      .map((r) => {
        const bld = state.buildings.find((b) => b.buildingId === r.buildingId);
        const roomSessions = activeWeekSessions.filter((s) => s.roomId === r.roomId);
        const usedPeriods = roomSessions.reduce((acc, s) => acc + s.totalPeriods, 0);
        const rurPercent = r.operationalStatus === 'AVAILABLE' ? Math.round((usedPeriods / 72) * 1000) / 10 : 0;
        const avgSfr =
          roomSessions.length > 0 && r.maxCapacity > 0
            ? Math.round(
                (roomSessions.reduce((acc, s) => {
                  const sec = state.sections.find((x) => x.sectionId === s.sectionId);
                  return acc + (sec?.enrolledCount ?? 0) / r.maxCapacity;
                }, 0) /
                  roomSessions.length) *
                  1000
              ) / 10
            : 0;
        return {
          room: r,
          building: bld,
          sessionCount: roomSessions.length,
          usedPeriods,
          rurPercent,
          avgSfr,
        };
      })
      .filter((row) => {
        if (roomCampusFilter !== 'ALL' && row.building?.campusCode !== roomCampusFilter) return false;
        if (roomBuildingFilter !== 'ALL' && row.room.buildingId !== roomBuildingFilter) return false;
        if (roomStatusFilter !== 'ALL' && row.room.operationalStatus !== roomStatusFilter) return false;
        if (q) {
          const hay = `${row.room.roomCode} ${row.room.roomName} ${row.building?.buildingName ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [
    state.classrooms,
    state.buildings,
    state.sections,
    activeWeekSessions,
    roomCampusFilter,
    roomBuildingFilter,
    roomStatusFilter,
    roomSearch,
  ]);

  const filteredIncidents = useMemo(() => {
    return state.incidents.filter((inc) => {
      if (incidentStatusFilter === 'ALL') return true;
      return inc.status === incidentStatusFilter;
    });
  }, [state.incidents, incidentStatusFilter]);

  // TAB 4: Instructors enriched with live weekly load
  const enrichedInstructors = useMemo(() => {
    const q = instrSearch.trim().toLowerCase();
    return state.instructors
      .map((ins) => {
        const fac = state.faculties.find((f) => f.facultyId === ins.facultyId);
        const insSessions = activeWeekSessions.filter((s) => {
          const sec = state.sections.find((x) => x.sectionId === s.sectionId);
          return sec?.instructors.some((i) => i.instructorId === ins.instructorId);
        });
        const weeklyPeriods = insSessions.reduce((acc, s) => acc + s.totalPeriods, 0);
        const availCount = state.availabilities.filter((a) => a.instructorId === ins.instructorId).length;
        return {
          ins,
          facultyName: fac?.name ?? '',
          weeklyPeriods,
          sessionCount: insSessions.length,
          availCount,
        };
      })
      .filter((row) => {
        if (instrFacultyFilter !== 'ALL' && row.ins.facultyId !== instrFacultyFilter) return false;
        if (q) {
          const hay = `${row.ins.fullName} ${row.ins.staffCode} ${row.facultyName}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [
    state.instructors,
    state.faculties,
    state.sections,
    state.availabilities,
    activeWeekSessions,
    instrSearch,
    instrFacultyFilter,
  ]);

  const toggleReqRoomType = (rt: RoomType) => {
    setReqRoomTypes((prev) => {
      if (prev.includes(rt)) {
        if (prev.length === 1) return prev; // Keep at least 1 selected
        return prev.filter((x) => x !== rt);
      }
      return [...prev, rt];
    });
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode.trim() || !courseName.trim()) return;
    if (reqRoomTypes.length === 0) {
      addToast({ type: 'error', title: 'Vui lòng chọn ít nhất 1 loại phòng bắt buộc' });
      return;
    }
    const payload = {
      courseCode,
      courseName,
      courseNameEn,
      facultyId,
      departmentId,
      credits,
      theoryPeriods: lt,
      exercisePeriods: bt,
      discussionPeriods: tl,
      practicalPeriods: th,
      requiredRoomType: reqRoomTypes[0],
      requiredRoomTypes: reqRoomTypes,
      examMode,
      examModelCode,
    };
    const res = editingCourseId
      ? await updateCourse(editingCourseId, payload)
      : await createCourse(payload);
    if (res.ok) {
      setEditingCourseId(null);
      setCourseCode('');
      setCourseName('');
      setCourseNameEn('');
    }
  };

  const startEditCourse = (c: CourseSubject) => {
    setEditingCourseId(c.courseId);
    setCourseCode(c.courseCode);
    setCourseName(c.courseName);
    setCourseNameEn(c.courseNameEn);
    setFacultyId(c.facultyId);
    setDepartmentId(c.departmentId);
    setCredits(c.credits);
    setLt(c.theoryPeriods);
    setBt(c.exercisePeriods);
    setTl(c.discussionPeriods);
    setTh(c.practicalPeriods);
    setReqRoomTypes(c.requiredRoomTypes?.length ? c.requiredRoomTypes : [c.requiredRoomType]);
    setExamMode(c.examMode);
    setExamModelCode(c.examModelCode ?? (c.examMode === 'MODULAR' ? 'EXM_MODULAR' : 'EXM_CONSOLIDATED'));
  };

  const resetCourseForm = () => {
    setEditingCourseId(null);
    setCourseCode('');
    setCourseName('');
    setCourseNameEn('');
  };

  const resetInstrForm = () => {
    setEditingInstrId(null);
    setInsStaffCode('');
    setInsTitle('ThS.');
    setInsFullName('');
    setInsFacultyId(currentRole.facultyId ?? 'FAC_IT');
    setInsEmail('');
    setInsType('FULL_TIME');
    setInsMaxDay(6);
    setShowInstrForm(false);
  };

  const startEditInstructor = (ins: Instructor) => {
    setEditingInstrId(ins.instructorId);
    setInsStaffCode(ins.staffCode);
    setInsTitle(ins.title);
    setInsFullName(ins.fullName);
    setInsFacultyId(ins.facultyId);
    setInsEmail(ins.email);
    setInsType(ins.instructorType);
    setInsMaxDay(ins.maxHoursPerDay);
    setShowInstrForm(true);
  };

  const handleSaveInstructor = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<Instructor> = {
      staffCode: insStaffCode,
      title: insTitle,
      fullName: insFullName,
      facultyId: insFacultyId,
      email: insEmail,
      instructorType: insType,
      maxHoursPerDay: insMaxDay,
    };
    const res = editingInstrId
      ? await updateInstructor(editingInstrId, payload)
      : await createInstructor(payload);
    if (res.ok) resetInstrForm();
  };

  const handleAddPrereq = async (e: React.FormEvent) => {
    e.preventDefault();
    setCycleError(null);
    const res = await addPrerequisite(preCourseId, preTargetId, preRuleType);
    if (!res.ok && res.error) {
      setCycleError(res.error);
    }
  };

  const selectedInstructor = state.instructors.find((i) => i.instructorId === selectedInstructorId);

  return (
    <div className="space-y-4">
      <DrillDownBanner />

      {/* Sub-navigation Tabs */}
      <div className="x_panel px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'TREE', label: '1. Cây Đào tạo Đa tầng (BR-MD-01)', icon: Layers },
              { id: 'COURSES', label: '2. Học phần 4 Cấu phần & Tiên quyết', icon: BookOpen },
              { id: 'ROOMS', label: '3. Giảng đường, RUR, BMS/IoT & Sự cố', icon: Building2 },
              { id: 'INSTRUCTORS', label: '4. Giảng viên, Lịch bận & Đa GV', icon: Users },
              { id: 'CATALOGS', label: '5. Danh mục CRUD (Tòa nhà · Khoa · Phòng · Mô hình thi)', icon: Database },
            ] as { id: MasterTab; label: string; icon: React.ComponentType<{ className?: string }> }[]
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#2A3F54] text-white'
                    : 'bg-[#F2F5F7] text-[#5A738E] hover:text-[#2A3F54]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#1ABB9C]' : ''}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 5: CENTRALIZED SYSTEM MASTER DATA CATALOGS (CRUD) */}
      {activeTab === 'CATALOGS' && <MasterCatalogManager />}

      {/* TAB 1: ACADEMIC TREE (BR-MD-01) */}
      {activeTab === 'TREE' && (
        <section className="x_panel">
          <div className="x_title flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold text-[#2A3F54]">
                Cấu trúc Cây Đào tạo Đại học: Bậc → Hệ → Khoa/Viện → Ngành → Niên khóa → Lớp Cơ hữu
              </h2>
              <p className="text-xs text-[#73879C] mt-0.5">
                Nhấn vào từng thẻ Lớp Cơ hữu để xem chi tiết danh sách buổi học trong Tuần {state.activeWeek}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#73879C] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={treeSearch}
                  onChange={(e) => setTreeSearch(e.target.value)}
                  placeholder="Tìm lớp, ngành..."
                  className="text-xs border border-[#D9DEE4] rounded pl-8 pr-2.5 py-1.5 bg-white w-[160px]"
                />
              </div>
              <select
                value={treeFacultyFilter}
                onChange={(e) => setTreeFacultyFilter(e.target.value)}
                className="text-xs border border-[#D9DEE4] rounded px-2.5 py-1.5 bg-white"
              >
                <option value="ALL">Tất cả Khoa/Viện</option>
                {state.faculties.map((f) => (
                  <option key={f.facultyId} value={f.facultyId}>
                    {f.code} — {f.name}
                  </option>
                ))}
              </select>
              <ExportToolbar
                compact
                filenameBase="UTS_CayDaoTao_LopCoHuu"
                reportTitle="Danh mục Cây đào tạo & Lớp cơ hữu"
                columns={[
                  { header: 'Khoa / Viện', accessor: (r) => r.facultyName },
                  { header: 'Mã ngành', accessor: (r) => r.majorCode },
                  { header: 'Tên ngành', accessor: (r) => r.majorName },
                  { header: 'Bậc / Hệ', accessor: (r) => `${r.degreeLevel} - ${r.educationSystem}` },
                  { header: 'Mã lớp', accessor: (r) => r.classCode },
                  { header: 'Niên khóa', accessor: (r) => r.academicYear },
                  { header: 'Sĩ số SV', accessor: (r) => r.studentCount },
                  { header: 'Cố vấn học tập', accessor: (r) => r.advisor },
                  { header: 'Số buổi học tuần', accessor: (r) => r.weekSessCount },
                ]}
                rows={exportableTreeRows}
              />
            </div>
          </div>
          <div className="x_content space-y-4">
            {filteredFaculties.map((fac) => {
              const facMajors = state.majors.filter((m) => m.facultyId === fac.facultyId);
              return (
                <div key={fac.facultyId} className="border border-[#E6E9ED] rounded overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#2A3F54] text-white flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="font-bold">
                      {fac.code} — {fac.name}
                    </div>
                    <div className="text-white/80">
                      Trưởng khoa: {fac.deanName} · {facMajors.length} ngành đào tạo
                    </div>
                  </div>
                  <div className="p-4 space-y-3 bg-white">
                    {facMajors.map((maj) => {
                      const q = treeSearch.trim().toLowerCase();
                      const majClasses = state.classes.filter((c) => {
                        if (c.majorId !== maj.majorId) return false;
                        if (!q) return true;
                        return `${c.classCode} ${c.className} ${maj.majorName}`.toLowerCase().includes(q);
                      });
                      if (q && majClasses.length === 0) return null;
                      return (
                        <div key={maj.majorId} className="border border-[#E6E9ED] rounded p-3 bg-[#FAFAFA]">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div>
                              <span className="font-mono font-bold text-[#169F85]">{maj.majorCode}</span>{' '}
                              <span className="font-bold text-[#2A3F54]">{maj.majorName}</span>
                            </div>
                            <div className="text-[#73879C]">
                              {maj.degreeLevel} · {maj.educationSystem} ·{' '}
                              <strong className="font-mono text-[#2A3F54]">{maj.totalCreditsRequired} TC</strong>
                            </div>
                          </div>
                          <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {majClasses.map((cls) => {
                              const advisor = state.instructors.find((i) => i.instructorId === cls.advisorId);
                              const sessCount = activeWeekSessions.filter((s) => {
                                const sec = state.sections.find((x) => x.sectionId === s.sectionId);
                                return sec?.cohortClassIds.includes(cls.classId);
                              }).length;
                              return (
                                <button
                                  key={cls.classId}
                                  type="button"
                                  onClick={() => setDetailClass(cls)}
                                  className="p-2.5 rounded bg-white border border-[#E6E9ED] hover:border-[#1ABB9C] text-left text-xs transition-colors"
                                >
                                  <div className="flex items-center justify-between font-mono font-bold text-[#2A3F54]">
                                    <span>{cls.classCode}</span>
                                    <span className="text-[#169F85]">{cls.studentCount} SV</span>
                                  </div>
                                  <div className="text-[11px] text-[#5A738E] mt-0.5">{cls.academicYear}</div>
                                  <div className="text-[11px] text-[#73879C] mt-0.5 flex items-center justify-between">
                                    <span>CVHT: {advisor ? `${advisor.title} ${advisor.fullName}` : 'Chưa gán'}</span>
                                    <span className="text-[#3498DB] font-semibold">{sessCount} buổi/tuần</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 2: COURSES (LT/BT/TL/TH) + PREREQUISITE CYCLE DETECTION */}
      {activeTab === 'COURSES' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* Course Table */}
          <section className="x_panel xl:col-span-8">
            <div className="x_title flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-bold text-[#2A3F54]">
                  Danh mục Học phần & Định mức 4 Cấu phần Tiết (mst_courses)
                </h2>
                <p className="text-xs text-[#73879C] mt-0.5">
                  Hiển thị {filteredCourses.length} / {state.courses.length} học phần · Nhấn vào dòng để xem chi tiết lớp học phần & tiên quyết
                </p>
              </div>
              <ExportToolbar
                compact
                filenameBase="UTS_DanhMucHocPhan_4CauPhan"
                reportTitle="Danh mục Học phần 4 cấu phần (LT/BT/TL/TH)"
                columns={[
                  { header: 'Mã HP', accessor: (c) => c.courseCode },
                  { header: 'Tên tiếng Việt', accessor: (c) => c.courseName },
                  { header: 'Tên tiếng Anh', accessor: (c) => c.courseNameEn },
                  { header: 'Tín chỉ', accessor: (c) => c.credits },
                  { header: 'Tiết LT', accessor: (c) => c.theoryPeriods },
                  { header: 'Tiết BT', accessor: (c) => c.exercisePeriods },
                  { header: 'Tiết TL', accessor: (c) => c.discussionPeriods },
                  { header: 'Tiết TH', accessor: (c) => c.practicalPeriods },
                  {
                    header: 'Tổng tiết',
                    accessor: (c) => c.theoryPeriods + c.exercisePeriods + c.discussionPeriods + c.practicalPeriods,
                  },
                  {
                    header: 'Loại phòng bắt buộc',
                    accessor: (c) => formatRoomTypesList(c.requiredRoomTypes?.length ? c.requiredRoomTypes : [c.requiredRoomType]),
                  },
                  { header: 'Mô hình thi', accessor: (c) => (c.examMode === 'MODULAR' ? 'Cuốn chiếu' : 'Tập trung') },
                ]}
                rows={filteredCourses}
              />
            </div>

            <div className="px-4 py-2.5 bg-[#FAFAFA] border-b border-[#E6E9ED] flex flex-wrap items-center gap-2 text-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#73879C] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  placeholder="Tìm mã hoặc tên học phần..."
                  className="border border-[#D9DEE4] rounded pl-8 pr-3 py-1.5 bg-white w-[220px]"
                />
              </div>
              <select
                value={courseFacultyFilter}
                onChange={(e) => setCourseFacultyFilter(e.target.value)}
                className="border border-[#D9DEE4] rounded px-2.5 py-1.5 bg-white"
              >
                <option value="ALL">Tất cả Khoa phụ trách</option>
                {state.faculties.map((f) => (
                  <option key={f.facultyId} value={f.facultyId}>
                    {f.code} — {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="x_content overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#E6E9ED] text-[#5A738E] text-left">
                    <th className="py-2 pr-3 font-semibold">Mã HP</th>
                    <th className="py-2 px-2 font-semibold">Tên học phần (Việt / Anh)</th>
                    <th className="py-2 px-2 text-right font-semibold">TC</th>
                    <th className="py-2 px-2 text-right font-semibold">LT</th>
                    <th className="py-2 px-2 text-right font-semibold">BT</th>
                    <th className="py-2 px-2 text-right font-semibold">TL</th>
                    <th className="py-2 px-2 text-right font-semibold">TH</th>
                    <th className="py-2 px-2 text-right font-semibold">Tổng</th>
                    <th className="py-2 pl-2 font-semibold">Loại phòng</th>
                    {(canUpdateCourse || canDeleteCourse) && (
                      <th className="py-2 pl-2 text-right font-semibold">CRUD</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E9ED]">
                  {filteredCourses.map((c) => {
                    const total = c.theoryPeriods + c.exercisePeriods + c.discussionPeriods + c.practicalPeriods;
                    return (
                      <tr
                        key={c.courseId}
                        onClick={() => setDetailCourse(c)}
                        className="hover:bg-[#EFF6FF]/60 cursor-pointer"
                      >
                        <td className="py-2.5 pr-3 font-mono font-bold text-[#2A3F54]">{c.courseCode}</td>
                        <td className="py-2.5 px-2">
                          <div className="font-semibold text-[#2A3F54]">{c.courseName}</div>
                          <div className="text-[11px] text-[#73879C]">{c.courseNameEn}</div>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums font-semibold">{c.credits}</td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums">{c.theoryPeriods}</td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums">{c.exercisePeriods}</td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums">{c.discussionPeriods}</td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums">{c.practicalPeriods}</td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums font-bold text-[#169F85]">
                          {total}
                        </td>
                        <td className="py-2.5 pl-2 text-[#5A738E]">
                          {formatRoomTypesList(c.requiredRoomTypes?.length ? c.requiredRoomTypes : [c.requiredRoomType])}
                        </td>
                        {(canUpdateCourse || canDeleteCourse) && (
                          <td
                            className="py-2.5 pl-2 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center gap-1">
                              {canUpdateCourse && (
                                <button
                                  type="button"
                                  title="Chỉnh sửa học phần"
                                  onClick={() => startEditCourse(c)}
                                  className="p-1 rounded border border-[#3498DB] text-[#3498DB] hover:bg-[#EFF6FF]"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              )}
                              {canDeleteCourse &&
                                (confirmDeleteCourseId === c.courseId ? (
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await deleteCourse(c.courseId);
                                        setConfirmDeleteCourseId(null);
                                      }}
                                      className="px-1.5 py-0.5 rounded bg-[#E74C3C] text-white text-[10px] font-semibold"
                                    >
                                      Xóa
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteCourseId(null)}
                                      className="p-0.5 text-[#73879C]"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    title="Xóa học phần"
                                    onClick={() => setConfirmDeleteCourseId(c.courseId)}
                                    className="p-1 rounded border border-[#FCA5A5] text-[#B91C1C] hover:bg-[#FEF2F2]"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                ))}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Right Column: Add / Edit Course Form + Prerequisite Cycle Detection */}
          <div className="xl:col-span-4 space-y-5">
            <section className="x_panel">
              <div className="x_title flex items-center justify-between gap-2">
                <h3 className="text-[14px] font-bold text-[#2A3F54] flex items-center gap-1.5">
                  {editingCourseId ? (
                    <Edit3 className="w-4 h-4 text-[#3498DB]" />
                  ) : (
                    <Plus className="w-4 h-4 text-[#1ABB9C]" />
                  )}
                  {editingCourseId ? 'Chỉnh sửa Học phần (LT/BT/TL/TH)' : 'Thêm Học phần mới (LT/BT/TL/TH)'}
                </h3>
                <div className="flex items-center gap-1.5">
                  {editingCourseId && (
                    <button
                      type="button"
                      onClick={resetCourseForm}
                      className="text-[11px] text-[#73879C] hover:text-[#2A3F54] underline"
                    >
                      Hủy
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPeriodGuide((v) => !v)}
                    title="Xem giải thích chi tiết định mức LT/BT/TL/TH & tỷ lệ tín chỉ"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-[#3498DB] hover:bg-[#EFF6FF] border border-[#BFDBFE]"
                  >
                    <Info className="w-3.5 h-3.5" />
                    Hướng dẫn
                  </button>
                </div>
              </div>

              {/* Interactive LT/BT/TL/TH Standard Explanation Panel */}
              {showPeriodGuide && (
                <div className="mx-4 mt-3 p-3 rounded bg-[#F0F9FF] border border-[#BAE6FD] text-[11px] space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-[#0C4A6E]">
                      Quy chuẩn Định mức 4 Cấu phần Tiết (Bộ GD&ĐT)
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPeriodGuide(false)}
                      className="text-[#0369A1] hover:text-[#0C4A6E]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-[#0369A1] space-y-0.5">
                    <div>• {COURSE_PERIOD_GUIDE.formulaSummary}</div>
                    <div>• {COURSE_PERIOD_GUIDE.validBoundSummary}</div>
                  </div>
                  <div className="space-y-1.5 pt-1 border-t border-[#BAE6FD]">
                    {COURSE_PERIOD_GUIDE.items.map((item) => (
                      <div key={item.code} className="leading-snug">
                        <strong className="font-mono text-[#0C4A6E]">{item.code} ({item.name})</strong>{' '}
                        <span className="font-mono text-[#169F85]">[{item.norm}]</span>: {item.description}{' '}
                        <span className="text-[#5A738E]">Gợi ý phòng: {item.roomHint}.</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-[#0369A1] bg-white/80 rounded p-2 border border-[#BAE6FD]">
                    <strong>Ví dụ chuẩn (3 TC có thực hành):</strong> LT=30, BT=10, TL=5, TH=15 → Tổng 60 tiết (nằm trong biên 45–90 tiết) · Chọn nhiều loại phòng: <em>Phòng lý thuyết + Phòng Lab Máy tính</em>.
                  </div>
                </div>
              )}

              {!(editingCourseId ? canUpdateCourse : canCreateCourse) ? (
                <div className="x_content text-xs text-[#5A738E] space-y-2">
                  <div className="p-3 rounded bg-[#FAFAFA] border border-[#E6E9ED]">
                    Vai trò <strong className="text-[#2A3F54]">{currentRole.label}</strong> hiện không có quyền{' '}
                    <strong>{editingCourseId ? 'Sửa' : 'Thêm mới'}</strong> trên chức năng{' '}
                    <span className="font-mono font-semibold">MASTER_COURSES</span>. Quản trị viên có thể bật/tắt quyền này trong mục{' '}
                    <strong>Quản trị HT → Nhóm quyền & Phân quyền CRUD</strong>.
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateCourse} className="x_content space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-semibold text-[#2A3F54] mb-1">Mã học phần *</label>
                      <input
                        required
                        placeholder="VD: SE401"
                        value={courseCode}
                        onChange={(e) => setCourseCode(e.target.value)}
                        className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#2A3F54] mb-1">Số tín chỉ</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={credits}
                        onChange={(e) => setCredits(Number(e.target.value))}
                        className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-[#2A3F54] mb-1">Tên học phần (Tiếng Việt) *</label>
                    <input
                      required
                      placeholder="VD: Kiến trúc Phần mềm Doanh nghiệp"
                      value={courseName}
                      onChange={(e) => setCourseName(e.target.value)}
                      className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#2A3F54] mb-1">Tên tiếng Anh</label>
                    <input
                      placeholder="Enterprise Software Architecture"
                      value={courseNameEn}
                      onChange={(e) => setCourseNameEn(e.target.value)}
                      className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5"
                    />
                  </div>

                  {/* 4 Period Components with Info Trigger */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#2A3F54]">
                        Phân bổ 4 cấu phần tiết (LT / BT / TL / TH)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowPeriodGuide((v) => !v)}
                        className="text-[11px] text-[#3498DB] hover:underline inline-flex items-center gap-0.5"
                      >
                        <Info className="w-3 h-3" /> Tỷ lệ chuẩn
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#5A738E] mb-1" title="Lý thuyết (1 TC = 15 tiết)">
                          LT <span className="font-normal text-[10px]">(15t/TC)</span>
                        </label>
                        <input type="number" min={0} value={lt} onChange={(e) => setLt(Number(e.target.value))} className="w-full border border-[#D9DEE4] rounded px-2 py-1 font-mono" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#5A738E] mb-1" title="Bài tập (1 TC = 15 tiết)">
                          BT <span className="font-normal text-[10px]">(15t/TC)</span>
                        </label>
                        <input type="number" min={0} value={bt} onChange={(e) => setBt(Number(e.target.value))} className="w-full border border-[#D9DEE4] rounded px-2 py-1 font-mono" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#5A738E] mb-1" title="Thảo luận (1 TC = 15 tiết)">
                          TL <span className="font-normal text-[10px]">(15t/TC)</span>
                        </label>
                        <input type="number" min={0} value={tl} onChange={(e) => setTl(Number(e.target.value))} className="w-full border border-[#D9DEE4] rounded px-2 py-1 font-mono" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#5A738E] mb-1" title="Thực hành/Thí nghiệm (1 TC = 30 tiết)">
                          TH <span className="font-normal text-[10px]">(30t/TC)</span>
                        </label>
                        <input type="number" min={0} value={th} onChange={(e) => setTh(Number(e.target.value))} className="w-full border border-[#D9DEE4] rounded px-2 py-1 font-mono" />
                      </div>
                    </div>
                  </div>

                  <div
                    className={`p-2 rounded text-[11px] ${
                      ratioPreview.isRatioValid
                        ? 'bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]'
                        : 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]'
                    }`}
                  >
                    Tổng tiết: <strong className="font-mono">{ratioPreview.totalHours}</strong> (Biên chuẩn{' '}
                    <span className="font-mono">{credits * 15}–{credits * 30}</span>) —{' '}
                    {ratioPreview.isRatioValid
                      ? 'Hợp lệ chuẩn tín chỉ'
                      : `${ratioPreview.warningCode}: ${ratioPreview.message}`}
                  </div>

                  {/* MULTI-SELECT REQUIRED ROOM TYPES */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="font-semibold text-[#2A3F54]">
                        Loại phòng bắt buộc (Chọn nhiều: {reqRoomTypes.length})
                      </label>
                      <button
                        type="button"
                        onClick={() => setReqRoomTypes(['THEORY', 'LAB_COMP'])}
                        className="text-[11px] text-[#169F85] hover:underline"
                      >
                        Preset: LT + Lab MT
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 p-2.5 rounded bg-[#FAFAFA] border border-[#D9DEE4]">
                      {(Object.entries(ROOM_TYPE_LABELS) as [RoomType, string][]).map(([rt, label]) => {
                        const checked = reqRoomTypes.includes(rt);
                        return (
                          <label
                            key={rt}
                            className={`flex items-center justify-between gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${
                              checked ? 'bg-[#1ABB9C]/10 text-[#2A3F54] font-semibold' : 'text-[#5A738E] hover:bg-white'
                            }`}
                          >
                            <span className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleReqRoomType(rt)}
                              />
                              <span>{label}</span>
                            </span>
                            <span className="font-mono text-[10px] text-[#73879C]">{rt}</span>
                          </label>
                        );
                      })}
                    </div>
                    {th > 0 && !reqRoomTypes.some((r) => r.startsWith('LAB_')) && (
                      <div className="text-[11px] text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] rounded p-1.5">
                        Lưu ý: Học phần có {th} tiết Thực hành (TH), nên tích chọn thêm Phòng Lab chuyên dụng.
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-semibold text-[#2A3F54] mb-1">Khoa phụ trách</label>
                      <select
                        value={facultyId}
                        onChange={(e) => {
                          setFacultyId(e.target.value);
                          const dep = state.departments.find((d) => d.facultyId === e.target.value);
                          if (dep) setDepartmentId(dep.departmentId);
                        }}
                        className="w-full border border-[#D9DEE4] rounded px-2 py-1.5 bg-white"
                      >
                        {state.faculties.map((f) => (
                          <option key={f.facultyId} value={f.facultyId}>{f.code}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-[#2A3F54] mb-1">Mô hình thi (Master Data)</label>
                      <select
                        value={examModelCode}
                        onChange={(e) => {
                          const code = e.target.value;
                          setExamModelCode(code);
                          const matched = state.examModels.find((m) => m.code === code);
                          if (matched) setExamMode(matched.baseMode);
                        }}
                        className="w-full border border-[#D9DEE4] rounded px-2 py-1.5 bg-white"
                      >
                        {state.examModels.map((em) => (
                          <option key={em.modelId} value={em.code}>
                            {em.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button type="submit" className="px-4 py-1.5 rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white font-semibold">
                      {editingCourseId ? 'Lưu cập nhật học phần' : 'Lưu học phần'}
                    </button>
                  </div>
                </form>
              )}
            </section>

            {/* Prerequisite Cycle Detection Panel */}
            <section className="x_panel">
              <div className="x_title">
                <h3 className="text-[14px] font-bold text-[#2A3F54] flex items-center gap-1.5">
                  <GitBranch className="w-4 h-4 text-[#3498DB]" />
                  Cây Tiên quyết & Chống Vòng lặp (Cycle Detection)
                </h3>
              </div>
              <div className="x_content space-y-3 text-xs">
                <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                  {state.prerequisites.map((p) => {
                    const c = state.courses.find((x) => x.courseId === p.courseId);
                    const req = state.courses.find((x) => x.courseId === p.prerequisiteCourseId);
                    return (
                      <div key={p.prerequisiteId} className="flex items-center justify-between py-1.5 border-b border-[#E6E9ED] last:border-b-0">
                        <span className="font-mono font-semibold text-[#2A3F54]">
                          {c?.courseCode} <span className="text-[#73879C] font-sans">yêu cầu</span> {req?.courseCode}
                        </span>
                        <span className="text-[11px] text-[#5A738E]">
                          {p.ruleType === 'MANDATORY' ? 'Bắt buộc' : p.ruleType === 'PRIOR' ? 'Học trước' : 'Song hành'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <form onSubmit={handleAddPrereq} className="pt-2 border-t border-[#E6E9ED] space-y-2">
                  <div className="text-[11px] text-[#73879C]">
                    Thử nghiệm chọn <strong className="font-mono text-[#2A3F54]">CS101</strong> yêu cầu{' '}
                    <strong className="font-mono text-[#2A3F54]">IT305</strong> để kiểm tra thuật toán phát hiện chu trình vô tận (CS101 → IT305 → CS202 → CS101).
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={preCourseId} onChange={(e) => setPreCourseId(e.target.value)} className="border border-[#D9DEE4] rounded px-2 py-1.5 bg-white font-mono">
                      {state.courses.map((c) => (
                        <option key={c.courseId} value={c.courseId}>{c.courseCode}</option>
                      ))}
                    </select>
                    <select value={preTargetId} onChange={(e) => setPreTargetId(e.target.value)} className="border border-[#D9DEE4] rounded px-2 py-1.5 bg-white font-mono">
                      {state.courses.map((c) => (
                        <option key={c.courseId} value={c.courseId}>Yêu cầu: {c.courseCode}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <select value={preRuleType} onChange={(e) => setPreRuleType(e.target.value as PrerequisiteRuleType)} className="border border-[#D9DEE4] rounded px-2 py-1.5 bg-white">
                      <option value="MANDATORY">Tiên quyết bắt buộc</option>
                      <option value="PRIOR">Học trước</option>
                      <option value="COREQUISITE">Song hành</option>
                    </select>
                    <button type="submit" className="px-3 py-1.5 rounded bg-[#2A3F54] hover:bg-[#172D44] text-white font-semibold">
                      Kiểm tra & Thêm
                    </button>
                  </div>
                  {cycleError && (
                    <div className="p-2.5 rounded bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-[11px] flex items-start gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{cycleError}</span>
                    </div>
                  )}
                </form>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* TAB 3: CLASSROOMS, LIVE RUR %, BMS/IOT & FIELD INCIDENTS */}
      {activeTab === 'ROOMS' && (
        <div className="space-y-5">
          <section
            className={`x_panel ${
              drillDown?.roomMetricFocus === 'RUR' ? 'ring-2 ring-[#1ABB9C]' : ''
            }`}
          >
            <div className="x_title flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold text-[#2A3F54]">
                  Danh mục Giảng đường, Tỷ lệ Khai thác RUR (%) & BMS/IoT (mst_classrooms)
                </h2>
                <p className="text-xs text-[#73879C] mt-0.5">
                  Hiển thị {enrichedRooms.length} / {state.classrooms.length} phòng · Nhấn vào từng phòng để xem chi tiết lịch sử dụng và thiết bị
                </p>
              </div>
              <ExportToolbar
                compact
                filenameBase={`UTS_DanhMucPhongHoc_RUR_Tuan${state.activeWeek}`}
                reportTitle={`Báo cáo Danh mục Phòng học & Tỷ lệ Khai thác RUR Tuần ${state.activeWeek}`}
                columns={[
                  { header: 'Mã phòng', accessor: (r) => r.room.roomCode },
                  { header: 'Tên phòng', accessor: (r) => r.room.roomName },
                  { header: 'Cơ sở', accessor: (r) => r.building?.campusName ?? '' },
                  { header: 'Tòa nhà', accessor: (r) => r.building?.buildingName ?? '' },
                  { header: 'Loại phòng', accessor: (r) => ROOM_TYPE_LABELS[r.room.roomType] },
                  { header: 'Sức chứa', accessor: (r) => r.room.maxCapacity },
                  { header: 'Số buổi/tuần', accessor: (r) => r.sessionCount },
                  { header: 'Tiết sử dụng/72', accessor: (r) => r.usedPeriods },
                  { header: 'RUR (%)', accessor: (r) => r.rurPercent },
                  { header: 'SFR TB (%)', accessor: (r) => r.avgSfr },
                  { header: 'BMS/IoT', accessor: (r) => r.room.iotPowerState },
                  { header: 'Trạng thái', accessor: (r) => r.room.operationalStatus },
                ]}
                rows={enrichedRooms}
              />
            </div>

            <div className="px-4 py-2.5 bg-[#FAFAFA] border-b border-[#E6E9ED] flex flex-wrap items-center gap-2 text-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#73879C] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  placeholder="Tìm mã phòng, tòa nhà..."
                  className="border border-[#D9DEE4] rounded pl-8 pr-3 py-1.5 bg-white w-[190px]"
                />
              </div>
              <select
                value={roomCampusFilter}
                onChange={(e) => {
                  setRoomCampusFilter(e.target.value);
                  setRoomBuildingFilter('ALL');
                }}
                className="border border-[#D9DEE4] rounded px-2.5 py-1.5 bg-white"
              >
                <option value="ALL">Tất cả Cơ sở</option>
                <option value="CS1">Cơ sở 1 (Trung tâm)</option>
                <option value="CS2">Cơ sở 2 (Khu Công nghệ cao)</option>
              </select>
              <select
                value={roomBuildingFilter}
                onChange={(e) => setRoomBuildingFilter(e.target.value)}
                className="border border-[#D9DEE4] rounded px-2.5 py-1.5 bg-white"
              >
                <option value="ALL">Tất cả Tòa nhà</option>
                {state.buildings
                  .filter((b) => roomCampusFilter === 'ALL' || b.campusCode === roomCampusFilter)
                  .map((b) => (
                    <option key={b.buildingId} value={b.buildingId}>
                      {b.buildingCode} — {b.buildingName}
                    </option>
                  ))}
              </select>
              <select
                value={roomStatusFilter}
                onChange={(e) => setRoomStatusFilter(e.target.value)}
                className="border border-[#D9DEE4] rounded px-2.5 py-1.5 bg-white"
              >
                <option value="ALL">Mọi trạng thái</option>
                <option value="AVAILABLE">Khả dụng</option>
                <option value="MAINTENANCE">Đang bảo trì</option>
                <option value="LOCKED">Tạm khóa</option>
              </select>
            </div>

            <div className="x_content overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#E6E9ED] text-[#5A738E] text-left">
                    <th className="py-2 pr-3 font-semibold">Mã phòng</th>
                    <th className="py-2 px-2 font-semibold">Tên phòng & Tòa nhà</th>
                    <th className="py-2 px-2 font-semibold">Chủng loại</th>
                    <th className="py-2 px-2 text-right font-semibold">Sức chứa</th>
                    <th className="py-2 px-2 text-right font-semibold">Buổi / Tiết</th>
                    <th className="py-2 px-2 text-right font-semibold">RUR (%)</th>
                    <th className="py-2 px-2 font-semibold">IoT / BMS</th>
                    <th className="py-2 px-2 font-semibold">Trạng thái</th>
                    <th className="py-2 pl-2 text-right font-semibold">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E9ED]">
                  {enrichedRooms.map(({ room: r, building: bld, sessionCount, usedPeriods, rurPercent }) => (
                    <tr key={r.roomId} className="hover:bg-[#F7F7F7]">
                      <td className="py-2.5 pr-3 font-mono font-bold text-[#2A3F54]">{r.roomCode}</td>
                      <td className="py-2.5 px-2">
                        <div className="font-semibold text-[#2A3F54]">{r.roomName}</div>
                        <div className="text-[11px] text-[#73879C]">
                          {bld?.buildingName} · Tầng {r.floorNumber} ({bld?.campusName})
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-[#5A738E]">{ROOM_TYPE_LABELS[r.roomType]}</td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums font-bold text-[#2A3F54]">
                        {r.maxCapacity}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[#5A738E]">
                        {sessionCount} buổi · {usedPeriods}/72t
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums font-bold">
                        <span className={rurPercent >= 15 ? 'text-[#169F85]' : 'text-[#5A738E]'}>
                          {rurPercent.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-[11px] font-medium">
                        <span className="inline-flex items-center gap-1 text-[#2A3F54]">
                          <Zap
                            className={`w-3.5 h-3.5 ${
                              r.iotPowerState === 'AUTO_ON' ? 'text-[#1ABB9C]' : 'text-[#94A3B8]'
                            }`}
                          />
                          {r.iotPowerState === 'AUTO_ON'
                            ? 'Bật (-15p)'
                            : r.iotPowerState === 'STANDBY'
                              ? 'Chờ'
                              : 'Ngắt'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <select
                          value={r.operationalStatus}
                          disabled={!roleCapabilities.permissions.canEditMasterData}
                          onChange={(e) => updateRoomStatus(r.roomId, e.target.value as any)}
                          className={`text-xs font-semibold border rounded px-2 py-1 bg-white disabled:opacity-60 ${
                            r.operationalStatus === 'AVAILABLE'
                              ? 'border-[#1ABB9C] text-[#169F85]'
                              : r.operationalStatus === 'MAINTENANCE'
                                ? 'border-[#F39C12] text-[#B45309]'
                                : 'border-[#E74C3C] text-[#B91C1C]'
                          }`}
                        >
                          <option value="AVAILABLE">Khả dụng</option>
                          <option value="MAINTENANCE">Đang bảo trì</option>
                          <option value="LOCKED">Tạm khóa</option>
                        </select>
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <button
                          type="button"
                          onClick={() => setDetailRoom(r)}
                          className="text-[#3498DB] hover:underline font-semibold inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5" /> Hồ sơ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Field Equipment Incidents from Mobile App (BR-MO-04) */}
          <section
            ref={incidentsSectionRef}
            className={`x_panel ${
              drillDown?.roomMetricFocus === 'INCIDENTS' ? 'ring-2 ring-[#E74C3C]' : ''
            }`}
          >
            <div className="x_title flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[14px] font-bold text-[#2A3F54] flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-[#F39C12]" />
                  Phản ánh Sự cố Thiết bị Giảng đường Hiện trường ({filteredIncidents.length})
                </h3>
                <p className="text-xs text-[#73879C] mt-0.5">
                  Tiếp nhận tức thời từ Giảng viên & Sinh viên qua Mobile App cho Phòng Quản trị Thiết bị
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={incidentStatusFilter}
                  onChange={(e) => setIncidentStatusFilter(e.target.value)}
                  className="text-xs border border-[#D9DEE4] rounded px-2.5 py-1.5 bg-white"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="OPEN">Chờ tiếp nhận</option>
                  <option value="IN_PROGRESS">Đang xử lý kỹ thuật</option>
                  <option value="RESOLVED">Đã khắc phục</option>
                </select>
                <ExportToolbar
                  compact
                  filenameBase="UTS_SuCoThietBiGiangDuong"
                  reportTitle="Danh sách Sự cố Thiết bị Giảng đường"
                  columns={[
                    { header: 'Mã sự cố', accessor: (i) => i.incidentId },
                    {
                      header: 'Phòng học',
                      accessor: (i) => state.classrooms.find((r) => r.roomId === i.roomId)?.roomCode ?? i.roomId,
                    },
                    { header: 'Hạng mục', accessor: (i) => i.category },
                    { header: 'Mô tả sự cố', accessor: (i) => i.description },
                    { header: 'Người phản ánh', accessor: (i) => i.reportedBy },
                    { header: 'Khung giờ', accessor: (i) => i.sessionTimeLabel },
                    { header: 'Trạng thái', accessor: (i) => i.status },
                  ]}
                  rows={filteredIncidents}
                />
              </div>
            </div>
            <div className="x_content divide-y divide-[#E6E9ED]">
              {filteredIncidents.map((inc) => {
                const room = state.classrooms.find((r) => r.roomId === inc.roomId);
                return (
                  <div key={inc.incidentId} className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-[#2A3F54]">
                        <span className="font-mono text-[#169F85]">{inc.incidentId}</span> · Phòng{' '}
                        <span className="font-mono">{room?.roomCode ?? inc.roomId}</span> · {inc.category}
                      </div>
                      <p className="text-[#5A738E]">{inc.description}</p>
                      <div className="text-[11px] text-[#73879C]">
                        Người báo: {inc.reportedBy} · Khung giờ: {inc.sessionTimeLabel}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={inc.status}
                        disabled={!roleCapabilities.permissions.canResolveIncident}
                        onChange={(e) => updateIncidentStatus(inc.incidentId, e.target.value as any)}
                        className="text-xs border border-[#D9DEE4] rounded px-2.5 py-1 bg-white font-semibold text-[#2A3F54] disabled:opacity-60"
                      >
                        <option value="OPEN">Chờ tiếp nhận</option>
                        <option value="IN_PROGRESS">Đang xử lý kỹ thuật</option>
                        <option value="RESOLVED">Đã khắc phục</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: INSTRUCTORS, AVAILABILITY MATRIX & MULTI-INSTRUCTOR ASSIGNMENT */}
      {activeTab === 'INSTRUCTORS' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <section className="x_panel xl:col-span-6">
            <div className="x_title flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-bold text-[#2A3F54]">
                  Hồ sơ Giảng viên & Định mức Sư phạm ({enrichedInstructors.length})
                </h2>
                <p className="text-xs text-[#73879C] mt-0.5">
                  Chọn giảng viên để thiết lập lịch bận hoặc mở hồ sơ lịch giảng chi tiết
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canCreateInstr && (
                  <button
                    type="button"
                    onClick={() => {
                      resetInstrForm();
                      setShowInstrForm(true);
                    }}
                    className="px-2.5 py-1.5 rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm GV
                  </button>
                )}
                <ExportToolbar
                  compact
                  filenameBase={`UTS_HoSoGiangVien_Tuan${state.activeWeek}`}
                  reportTitle={`Danh sách Giảng viên & Khối lượng giảng dạy Tuần ${state.activeWeek}`}
                  columns={[
                    { header: 'Mã cán bộ', accessor: (r) => r.ins.staffCode },
                    { header: 'Học hàm / Học vị', accessor: (r) => r.ins.title },
                    { header: 'Họ và tên', accessor: (r) => r.ins.fullName },
                    { header: 'Khoa', accessor: (r) => r.facultyName },
                    { header: 'Loại hình', accessor: (r) => r.ins.instructorType },
                    { header: 'Tiết giảng tuần', accessor: (r) => r.weeklyPeriods },
                    { header: 'Trần tiết/ngày', accessor: (r) => r.ins.maxHoursPerDay },
                    { header: 'Số khung bận', accessor: (r) => r.availCount },
                  ]}
                  rows={enrichedInstructors}
                />
              </div>
            </div>

            {showInstrForm && (editingInstrId ? canUpdateInstr : canCreateInstr) && (
              <form
                onSubmit={handleSaveInstructor}
                className="p-3.5 bg-[#F8FAFC] border-b border-[#E6E9ED] space-y-2.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#2A3F54]">
                    {editingInstrId ? 'Chỉnh sửa Hồ sơ Giảng viên' : 'Thêm mới Hồ sơ Giảng viên'}
                  </span>
                  <button type="button" onClick={resetInstrForm} className="text-[#73879C] hover:text-[#2A3F54]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    required
                    value={insStaffCode}
                    onChange={(e) => setInsStaffCode(e.target.value)}
                    placeholder="Mã CB (GV-IT09)"
                    className="border border-[#D9DEE4] rounded px-2 py-1.5 font-mono uppercase bg-white"
                  />
                  <input
                    value={insTitle}
                    onChange={(e) => setInsTitle(e.target.value)}
                    placeholder="Học vị (TS., ThS.)"
                    className="border border-[#D9DEE4] rounded px-2 py-1.5 bg-white"
                  />
                  <input
                    required
                    value={insFullName}
                    onChange={(e) => setInsFullName(e.target.value)}
                    placeholder="Họ và tên *"
                    className="border border-[#D9DEE4] rounded px-2 py-1.5 bg-white"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={insFacultyId}
                    onChange={(e) => setInsFacultyId(e.target.value)}
                    className="border border-[#D9DEE4] rounded px-2 py-1.5 bg-white"
                  >
                    {state.faculties.map((f) => (
                      <option key={f.facultyId} value={f.facultyId}>
                        {f.code} — {f.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={insType}
                    onChange={(e) => setInsType(e.target.value as InstructorType)}
                    className="border border-[#D9DEE4] rounded px-2 py-1.5 bg-white"
                  >
                    <option value="FULL_TIME">Cơ hữu</option>
                    <option value="VISITING">Thỉnh giảng</option>
                    <option value="TA">Trợ giảng / Lab Tech</option>
                  </select>
                  <input
                    type="email"
                    value={insEmail}
                    onChange={(e) => setInsEmail(e.target.value)}
                    placeholder="Email @university.edu.vn"
                    className="border border-[#D9DEE4] rounded px-2 py-1.5 bg-white"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-1.5 text-[#5A738E]">
                    <span>Trần tiết/ngày:</span>
                    <input
                      type="number"
                      min={2}
                      max={10}
                      value={insMaxDay}
                      onChange={(e) => setInsMaxDay(Number(e.target.value))}
                      className="w-16 border border-[#D9DEE4] rounded px-2 py-1 font-mono bg-white"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={resetInstrForm}
                      className="px-2.5 py-1 rounded border border-[#D9DEE4] text-[#5A738E]"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 rounded bg-[#2A3F54] text-white font-semibold"
                    >
                      {editingInstrId ? 'Lưu cập nhật' : 'Lưu Giảng viên'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div className="px-4 py-2.5 bg-[#FAFAFA] border-b border-[#E6E9ED] flex flex-wrap items-center gap-2 text-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#73879C] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={instrSearch}
                  onChange={(e) => setInstrSearch(e.target.value)}
                  placeholder="Tìm họ tên, mã GV..."
                  className="border border-[#D9DEE4] rounded pl-8 pr-2.5 py-1.5 bg-white w-[180px]"
                />
              </div>
              <select
                value={instrFacultyFilter}
                onChange={(e) => setInstrFacultyFilter(e.target.value)}
                className="border border-[#D9DEE4] rounded px-2.5 py-1.5 bg-white"
              >
                <option value="ALL">Tất cả Khoa</option>
                {state.faculties.map((f) => (
                  <option key={f.facultyId} value={f.facultyId}>
                    {f.code} — {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="x_content divide-y divide-[#E6E9ED]">
              {enrichedInstructors.map(({ ins, facultyName, weeklyPeriods, availCount }) => {
                const selected = ins.instructorId === selectedInstructorId;
                return (
                  <div
                    key={ins.instructorId}
                    className={`py-2.5 px-3 flex items-center justify-between gap-2 transition-colors ${
                      selected ? 'bg-[#1ABB9C]/10' : 'hover:bg-[#F7F7F7]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedInstructorId(ins.instructorId)}
                      className="text-left flex-1 min-w-0"
                    >
                      <div className="text-xs font-bold text-[#2A3F54] truncate">
                        {ins.title} {ins.fullName}{' '}
                        <span className="font-mono font-normal text-[#73879C]">({ins.staffCode})</span>
                      </div>
                      <div className="text-[11px] text-[#5A738E]">
                        {facultyName} ·{' '}
                        {ins.instructorType === 'FULL_TIME'
                          ? 'Cơ hữu'
                          : ins.instructorType === 'VISITING'
                            ? 'Thỉnh giảng'
                            : 'Trợ giảng / Kỹ thuật Lab'}
                      </div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right text-[11px] font-mono tabular-nums">
                        <div className="font-semibold text-[#169F85]">{weeklyPeriods} tiết/tuần</div>
                        <div className="text-[#73879C]">Trần {ins.maxHoursPerDay}t/ngày · {availCount} bận</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDetailInstructor(ins)}
                        className="px-2 py-1 text-[11px] font-semibold text-[#3498DB] hover:underline"
                      >
                        Lịch dạy
                      </button>
                      {canUpdateInstr && (
                        <button
                          type="button"
                          title="Chỉnh sửa giảng viên"
                          onClick={() => startEditInstructor(ins)}
                          className="p-1 rounded border border-[#3498DB] text-[#3498DB] hover:bg-[#EFF6FF]"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      )}
                      {canDeleteInstr &&
                        (confirmDeleteInstrId === ins.instructorId ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteInstructor(ins.instructorId);
                                setConfirmDeleteInstrId(null);
                              }}
                              className="px-1.5 py-0.5 rounded bg-[#E74C3C] text-white text-[10px] font-semibold"
                            >
                              Xóa
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteInstrId(null)}
                              className="p-0.5 text-[#73879C]"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            title="Xóa giảng viên"
                            onClick={() => setConfirmDeleteInstrId(ins.instructorId)}
                            className="p-1 rounded border border-[#FCA5A5] text-[#B91C1C] hover:bg-[#FEF2F2]"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="xl:col-span-6 space-y-5">
            {/* Personal Availability Matrix (BR-FM-02) */}
            <section className="x_panel">
              <div className="x_title flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-[14px] font-bold text-[#2A3F54]">
                    Lịch bận Cá nhân: {selectedInstructor ? `${selectedInstructor.title} ${selectedInstructor.fullName}` : ''}
                  </h3>
                  <p className="text-xs text-[#73879C] mt-0.5">
                    Nhấn vào từng ô để chuyển vòng: Rảnh → Bận cố định (Hard) → Hạn chế (Soft). Đồng bộ Conflict Engine.
                  </p>
                </div>
                {selectedInstructor && (
                  <button
                    type="button"
                    onClick={() => setDetailInstructor(selectedInstructor)}
                    className="text-xs font-semibold text-[#169F85] hover:underline whitespace-nowrap"
                  >
                    Xem hồ sơ lịch giảng
                  </button>
                )}
              </div>
              <div className="x_content overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E6E9ED] text-[#5A738E]">
                      <th className="py-2 pr-2 text-left">Ca / Thứ</th>
                      {[2, 3, 4, 5, 6, 7].map((d) => (
                        <th key={d} className="py-2 px-1 text-center">{DAY_LABELS[d]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SHIFT_DEFS.map((sh) => (
                      <tr key={sh.id} className="border-b border-[#E6E9ED] last:border-b-0">
                        <td className="py-2 pr-2 font-semibold text-[#2A3F54]">{sh.label}</td>
                        {[2, 3, 4, 5, 6, 7].map((day) => {
                          const existing = state.availabilities.find(
                            (a) =>
                              a.instructorId === selectedInstructorId &&
                              a.dayOfWeek === day &&
                              a.shift === sh.id
                          );
                          const nextState =
                            !existing
                              ? 'HARD_BUSY'
                              : existing.constraintType === 'HARD_BUSY'
                                ? 'SOFT_AVOID'
                                : null;

                          const canEditThisAvail =
                            roleCapabilities.permissions.canEditAllAvailability ||
                            (roleCapabilities.permissions.canEditOwnAvailability &&
                              currentRole.instructorId === selectedInstructorId);

                          return (
                            <td key={day} className="p-1">
                              <button
                                type="button"
                                disabled={!canEditThisAvail}
                                onClick={() =>
                                  toggleInstructorAvailability(
                                    selectedInstructorId,
                                    day,
                                    sh.id,
                                    nextState,
                                    nextState === 'HARD_BUSY'
                                      ? 'Bận cố định / Họp chuyên môn'
                                      : 'Không ưu tiên giảng dạy'
                                  )
                                }
                                className={`w-full py-2 px-1 rounded text-[11px] font-semibold border transition-colors disabled:opacity-55 ${
                                  existing?.constraintType === 'HARD_BUSY'
                                    ? 'bg-[#FEF2F2] border-[#E74C3C] text-[#B91C1C]'
                                    : existing?.constraintType === 'SOFT_AVOID'
                                      ? 'bg-[#FFFBEB] border-[#F39C12] text-[#B45309]'
                                      : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534] hover:border-[#1ABB9C]'
                                }`}
                              >
                                {existing?.constraintType === 'HARD_BUSY'
                                  ? 'Bận (Cứng)'
                                  : existing?.constraintType === 'SOFT_AVOID'
                                    ? 'Hạn chế'
                                    : 'Rảnh'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Multi-Instructor Section Assignment View & Faculty Assignment Form (BR-FM-03) */}
            <section className="x_panel">
              <div className="x_title flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-[14px] font-bold text-[#2A3F54]">
                    Phân công Đa Giảng viên Đứng lớp (BR-FM-03)
                  </h3>
                  <p className="text-xs text-[#73879C] mt-0.5">
                    Phân định Giảng viên chính (LT), Đồng giảng dạy, Trợ giảng (BT) và Cán bộ Kỹ thuật Lab (TH)
                  </p>
                </div>
              </div>
              <div className="x_content space-y-3 text-xs">
                {roleCapabilities.permissions.canAssignInstructors && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await assignInstructorToSection({
                        sectionId: assignSectionId,
                        instructorId: assignInstrId,
                        role: assignInstrRole,
                        assignedPeriods: assignPeriods,
                      });
                    }}
                    className="p-3 rounded bg-[#F0FDF4] border border-[#BBF7D0] space-y-2"
                  >
                    <div className="font-bold text-[#166534]">
                      Phân công nhanh Giảng viên vào Lớp Học phần ({currentRole.shortLabel})
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={assignSectionId}
                        onChange={(e) => setAssignSectionId(e.target.value)}
                        className="border border-[#D9DEE4] rounded px-2 py-1.5 bg-white font-mono"
                      >
                        {state.sections.map((s) => (
                          <option key={s.sectionId} value={s.sectionId}>
                            {s.sectionCode}
                          </option>
                        ))}
                      </select>
                      <select
                        value={assignInstrId}
                        onChange={(e) => setAssignInstrId(e.target.value)}
                        className="border border-[#D9DEE4] rounded px-2 py-1.5 bg-white"
                      >
                        {state.instructors.map((i) => (
                          <option key={i.instructorId} value={i.instructorId}>
                            {i.title} {i.fullName}
                          </option>
                        ))}
                      </select>
                      <select
                        value={assignInstrRole}
                        onChange={(e) => setAssignInstrRole(e.target.value as InstructorRole)}
                        className="border border-[#D9DEE4] rounded px-2 py-1.5 bg-white"
                      >
                        <option value="LEAD">Giảng viên chính (LEAD)</option>
                        <option value="CO_TEACHER">Đồng giảng dạy (CO_TEACHER)</option>
                        <option value="TA">Trợ giảng bài tập (TA)</option>
                        <option value="LAB_TECH">Cán bộ kỹ thuật Lab (LAB_TECH)</option>
                      </select>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={2}
                          max={60}
                          value={assignPeriods}
                          onChange={(e) => setAssignPeriods(Number(e.target.value))}
                          className="w-20 border border-[#D9DEE4] rounded px-2 py-1.5 bg-white font-mono"
                        />
                        <span className="text-[#5A738E]">tiết</span>
                        <button
                          type="submit"
                          className="ml-auto px-3 py-1.5 rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white font-semibold whitespace-nowrap"
                        >
                          Phân công
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                <div className="divide-y divide-[#E6E9ED]">
                  {state.sections.slice(0, 6).map((sec) => {
                    const course = state.courses.find((c) => c.courseId === sec.courseId);
                    return (
                      <div key={sec.sectionId} className="py-2.5 first:pt-0 last:pb-0">
                        <div className="font-semibold text-[#2A3F54]">
                          <span className="font-mono text-[#169F85]">{sec.sectionCode}</span> — {course?.courseName}
                        </div>
                        <div className="mt-1 space-y-0.5 text-[11px] text-[#5A738E]">
                          {sec.instructors.map((asg) => {
                            const ins = state.instructors.find((i) => i.instructorId === asg.instructorId);
                            const roleMap = {
                              LEAD: 'Giảng viên chính',
                              CO_TEACHER: 'Đồng giảng dạy',
                              TA: 'Trợ giảng bài tập',
                              LAB_TECH: 'Cán bộ kỹ thuật Lab',
                            };
                            return (
                              <div key={asg.assignmentId} className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3 h-3 text-[#1ABB9C]" />
                                  {ins ? `${ins.title} ${ins.fullName}` : asg.instructorId} — {roleMap[asg.role]}
                                </span>
                                <span className="font-mono tabular-nums">{asg.assignedPeriods} tiết</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* DETAIL MODAL 1: ACADEMIC CLASS SCHEDULE */}
      {detailClass && (() => {
        const maj = state.majors.find((m) => m.majorId === detailClass.majorId);
        const advisor = state.instructors.find((i) => i.instructorId === detailClass.advisorId);
        const classSessions = activeWeekSessions
          .filter((s) => {
            const sec = state.sections.find((x) => x.sectionId === s.sectionId);
            return sec?.cohortClassIds.includes(detailClass.classId);
          })
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startPeriod - b.startPeriod);
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded border border-[#D9DEE4] shadow-xl max-w-[660px] w-full overflow-hidden">
              <div className="px-5 py-3.5 bg-[#2A3F54] text-white flex items-center justify-between">
                <div>
                  <div className="font-mono text-[11px] text-[#1ABB9C]">Hồ sơ Lớp Cơ hữu · {detailClass.classCode}</div>
                  <h4 className="text-sm font-bold">{detailClass.className} ({detailClass.studentCount} SV)</h4>
                </div>
                <button type="button" onClick={() => setDetailClass(null)} className="text-white/75 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#FAFAFA] border border-[#E6E9ED] rounded p-3">
                  <div>
                    <div>Ngành: <strong>{maj?.majorName}</strong> ({maj?.majorCode})</div>
                    <div className="text-[#5A738E]">Niên khóa: {detailClass.academicYear} · CVHT: {advisor ? `${advisor.title} ${advisor.fullName}` : '—'}</div>
                  </div>
                  <ExportToolbar
                    compact
                    filenameBase={`UTS_LichLop_${detailClass.classCode}`}
                    reportTitle={`Thời khóa biểu lớp ${detailClass.classCode}`}
                    columns={[
                      { header: 'Thứ', accessor: (s) => DAY_LABELS[s.dayOfWeek] },
                      { header: 'Ngày', accessor: (s) => s.sessionDate },
                      { header: 'Tiết', accessor: (s) => `T${s.startPeriod}-${s.startPeriod + s.totalPeriods - 1}` },
                      {
                        header: 'Học phần',
                        accessor: (s) => {
                          const sec = state.sections.find((x) => x.sectionId === s.sectionId);
                          const c = state.courses.find((k) => k.courseId === sec?.courseId);
                          return `${c?.courseCode ?? ''} - ${c?.courseName ?? ''}`;
                        },
                      },
                      {
                        header: 'Phòng',
                        accessor: (s) => state.classrooms.find((r) => r.roomId === s.roomId)?.roomCode ?? '',
                      },
                    ]}
                    rows={classSessions}
                  />
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[#E6E9ED] text-[#5A738E] text-left">
                      <th className="py-1.5 pr-2">Thứ / Ngày</th>
                      <th className="py-1.5 px-2">Tiết</th>
                      <th className="py-1.5 px-2">Học phần</th>
                      <th className="py-1.5 pl-2 text-right">Phòng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E9ED]">
                    {classSessions.map((s) => {
                      const sec = state.sections.find((x) => x.sectionId === s.sectionId);
                      const crs = state.courses.find((c) => c.courseId === sec?.courseId);
                      const rm = state.classrooms.find((r) => r.roomId === s.roomId);
                      return (
                        <tr key={s.sessionId}>
                          <td className="py-2 pr-2 font-semibold text-[#2A3F54]">{DAY_LABELS[s.dayOfWeek]} ({s.sessionDate})</td>
                          <td className="py-2 px-2 font-mono">T{s.startPeriod}-{s.startPeriod + s.totalPeriods - 1}</td>
                          <td className="py-2 px-2"><strong className="font-mono">{crs?.courseCode}</strong> — {crs?.courseName}</td>
                          <td className="py-2 pl-2 text-right font-mono font-bold text-[#169F85]">{rm?.roomCode}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 bg-[#F7F7F7] border-t border-[#E6E9ED] flex justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const cls = detailClass;
                    setDetailClass(null);
                    navigateWithDrillDown('builder', {
                      sourceLabel: `Lịch lớp cơ hữu ${cls.classCode}`,
                      builderViewMode: 'CLASS',
                      builderEntityId: cls.classId,
                    });
                  }}
                  className="px-3 py-1.5 rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white text-xs font-semibold"
                >
                  Mở trên Lưới Xếp lịch
                </button>
                <button type="button" onClick={() => setDetailClass(null)} className="px-4 py-1.5 rounded bg-[#2A3F54] text-white text-xs font-semibold">
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* DETAIL MODAL 2: COURSE SUBJECT */}
      {detailCourse && (() => {
        const relatedSections = state.sections.filter((s) => s.courseId === detailCourse.courseId);
        const prereqs = state.prerequisites.filter((p) => p.courseId === detailCourse.courseId);
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded border border-[#D9DEE4] shadow-xl max-w-[640px] w-full overflow-hidden">
              <div className="px-5 py-3.5 bg-[#2A3F54] text-white flex items-center justify-between">
                <div>
                  <div className="font-mono text-[11px] text-[#1ABB9C]">Hồ sơ Học phần · {detailCourse.courseCode}</div>
                  <h4 className="text-sm font-bold">{detailCourse.courseName} ({detailCourse.credits} tín chỉ)</h4>
                </div>
                <button type="button" onClick={() => setDetailCourse(null)} className="text-white/75 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-4 gap-2 text-center font-mono">
                  <div className="p-2.5 rounded bg-[#FAFAFA] border border-[#E6E9ED]">
                    <div className="text-[10px] text-[#73879C]">Lý thuyết (LT)</div>
                    <div className="text-base font-bold text-[#2A3F54]">{detailCourse.theoryPeriods}</div>
                  </div>
                  <div className="p-2.5 rounded bg-[#FAFAFA] border border-[#E6E9ED]">
                    <div className="text-[10px] text-[#73879C]">Bài tập (BT)</div>
                    <div className="text-base font-bold text-[#2A3F54]">{detailCourse.exercisePeriods}</div>
                  </div>
                  <div className="p-2.5 rounded bg-[#FAFAFA] border border-[#E6E9ED]">
                    <div className="text-[10px] text-[#73879C]">Thảo luận (TL)</div>
                    <div className="text-base font-bold text-[#2A3F54]">{detailCourse.discussionPeriods}</div>
                  </div>
                  <div className="p-2.5 rounded bg-[#FAFAFA] border border-[#E6E9ED]">
                    <div className="text-[10px] text-[#73879C]">Thực hành (TH)</div>
                    <div className="text-base font-bold text-[#169F85]">{detailCourse.practicalPeriods}</div>
                  </div>
                </div>
                <div className="p-3 rounded bg-[#F0F9FF] border border-[#BAE6FD] text-[11px] space-y-1">
                  <div className="font-bold text-[#0C4A6E] flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" /> Quy chuẩn LT/BT/TL/TH & Loại phòng cho phép
                  </div>
                  <div className="text-[#0369A1]">
                    • {COURSE_PERIOD_GUIDE.formulaSummary} (Biên hợp lệ cho {detailCourse.credits} TC:{' '}
                    <strong>{detailCourse.credits * 15}–{detailCourse.credits * 30} tiết</strong>; Thực tế:{' '}
                    <strong>
                      {detailCourse.theoryPeriods + detailCourse.exercisePeriods + detailCourse.discussionPeriods + detailCourse.practicalPeriods} tiết
                    </strong>)
                  </div>
                  <div className="text-[#2A3F54]">
                    • <strong>Loại phòng bắt buộc (Đa chọn):</strong>{' '}
                    <span className="font-semibold text-[#169F85]">
                      {formatRoomTypesList(
                        detailCourse.requiredRoomTypes?.length
                          ? detailCourse.requiredRoomTypes
                          : [detailCourse.requiredRoomType]
                      )}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="font-bold text-[#2A3F54] mb-1">Điều kiện tiên quyết ({prereqs.length})</div>
                  {prereqs.length === 0 ? (
                    <div className="text-[#73879C]">Không yêu cầu học phần tiên quyết.</div>
                  ) : (
                    prereqs.map((p) => {
                      const req = state.courses.find((c) => c.courseId === p.prerequisiteCourseId);
                      return (
                        <div key={p.prerequisiteId} className="text-[#5A738E]">
                          · <strong className="font-mono text-[#2A3F54]">{req?.courseCode}</strong> — {req?.courseName} ({p.ruleType})
                        </div>
                      );
                    })
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="font-bold text-[#2A3F54]">Các Lớp học phần đang mở ({relatedSections.length})</div>
                    <ExportToolbar
                      compact
                      filenameBase={`UTS_LopHocPhan_${detailCourse.courseCode}`}
                      reportTitle={`Danh sách lớp học phần của ${detailCourse.courseCode}`}
                      columns={[
                        { header: 'Mã LHP', accessor: (s) => s.sectionCode },
                        { header: 'Sĩ số', accessor: (s) => s.enrolledCount },
                        { header: 'Sĩ số tối đa', accessor: (s) => s.capacityMax },
                        { header: 'Loại phòng', accessor: (s) => ROOM_TYPE_LABELS[s.requiredRoomType] },
                        { header: 'Trạng thái', accessor: (s) => s.status },
                      ]}
                      rows={relatedSections}
                    />
                  </div>
                  <div className="space-y-1.5">
                    {relatedSections.map((sec) => (
                      <div key={sec.sectionId} className="p-2.5 rounded border border-[#E6E9ED] flex items-center justify-between">
                        <div>
                          <span className="font-mono font-bold text-[#2A3F54]">{sec.sectionCode}</span> · {sec.enrolledCount}/{sec.capacityMax} SV
                        </div>
                        <span className="font-semibold text-[#169F85]">{sec.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-5 py-3 bg-[#F7F7F7] border-t border-[#E6E9ED] flex justify-end">
                <button type="button" onClick={() => setDetailCourse(null)} className="px-4 py-1.5 rounded bg-[#2A3F54] text-white text-xs font-semibold">
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* DETAIL MODAL 3: CLASSROOM DETAIL & BOOKED SESSIONS */}
      {detailRoom && (() => {
        const bld = state.buildings.find((b) => b.buildingId === detailRoom.buildingId);
        const roomSessions = activeWeekSessions
          .filter((s) => s.roomId === detailRoom.roomId)
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startPeriod - b.startPeriod);
        const usedPeriods = roomSessions.reduce((acc, s) => acc + s.totalPeriods, 0);
        const rur = Math.round((usedPeriods / 72) * 1000) / 10;
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded border border-[#D9DEE4] shadow-xl max-w-[680px] w-full overflow-hidden">
              <div className="px-5 py-3.5 bg-[#2A3F54] text-white flex items-center justify-between">
                <div>
                  <div className="font-mono text-[11px] text-[#1ABB9C]">Hồ sơ Giảng đường · {detailRoom.roomCode}</div>
                  <h4 className="text-sm font-bold">{detailRoom.roomName} · {bld?.buildingName} (Tầng {detailRoom.floorNumber})</h4>
                </div>
                <button type="button" onClick={() => setDetailRoom(null)} className="text-white/75 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-3 gap-3 bg-[#FAFAFA] border border-[#E6E9ED] rounded p-3 font-mono tabular-nums">
                  <div>
                    <div className="font-sans text-[11px] text-[#73879C]">Sức chứa chuẩn</div>
                    <div className="text-base font-bold text-[#2A3F54]">{detailRoom.maxCapacity} chỗ</div>
                  </div>
                  <div>
                    <div className="font-sans text-[11px] text-[#73879C]">Hiệu suất RUR Tuần {state.activeWeek}</div>
                    <div className="text-base font-bold text-[#169F85]">{rur}% ({usedPeriods}/72t)</div>
                  </div>
                  <div>
                    <div className="font-sans text-[11px] text-[#73879C]">BMS / Trạng thái</div>
                    <div className="text-sm font-bold text-[#2A3F54]">{detailRoom.iotPowerState} · {detailRoom.operationalStatus}</div>
                  </div>
                </div>

                <div>
                  <div className="font-bold text-[#2A3F54] mb-1">Trang thiết bị phòng học</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {detailRoom.equipment.map((eq) => (
                      <div
                        key={eq.equipmentId}
                        className={`p-2 rounded border flex items-center justify-between ${
                          eq.status === 'FAULTY'
                            ? 'bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]'
                            : 'bg-white border-[#E6E9ED] text-[#2A3F54]'
                        }`}
                      >
                        <span>{eq.name} (x{eq.quantity})</span>
                        <span className="font-semibold">{eq.status === 'FAULTY' ? 'Đang hỏng' : 'Tốt'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="font-bold text-[#2A3F54]">Lịch sử dụng Phòng trong Tuần {state.activeWeek} ({roomSessions.length} buổi)</div>
                    <ExportToolbar
                      compact
                      filenameBase={`UTS_LichPhong_${detailRoom.roomCode}_Tuan${state.activeWeek}`}
                      reportTitle={`Lịch khai thác phòng ${detailRoom.roomCode} Tuần ${state.activeWeek}`}
                      columns={[
                        { header: 'Thứ', accessor: (s) => DAY_LABELS[s.dayOfWeek] },
                        { header: 'Ngày', accessor: (s) => s.sessionDate },
                        { header: 'Tiết', accessor: (s) => `T${s.startPeriod}-${s.startPeriod + s.totalPeriods - 1}` },
                        {
                          header: 'Học phần',
                          accessor: (s) => {
                            const sec = state.sections.find((x) => x.sectionId === s.sectionId);
                            const c = state.courses.find((k) => k.courseId === sec?.courseId);
                            return `${c?.courseCode ?? ''} - ${c?.courseName ?? ''}`;
                          },
                        },
                        {
                          header: 'Sĩ số',
                          accessor: (s) => state.sections.find((x) => x.sectionId === s.sectionId)?.enrolledCount ?? 0,
                        },
                      ]}
                      rows={roomSessions}
                    />
                  </div>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-[#E6E9ED] text-[#5A738E] text-left">
                        <th className="py-1.5 pr-2">Thứ / Ngày</th>
                        <th className="py-1.5 px-2">Tiết / Giờ</th>
                        <th className="py-1.5 px-2">Học phần</th>
                        <th className="py-1.5 pl-2 text-right">Sĩ số / SFR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6E9ED]">
                      {roomSessions.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-[#73879C]">Phòng chưa có buổi học nào trong tuần này.</td>
                        </tr>
                      ) : (
                        roomSessions.map((s) => {
                          const sec = state.sections.find((x) => x.sectionId === s.sectionId);
                          const crs = state.courses.find((c) => c.courseId === sec?.courseId);
                          const sfr = sec ? Math.round((sec.enrolledCount / detailRoom.maxCapacity) * 100) : 0;
                          return (
                            <tr key={s.sessionId}>
                              <td className="py-2 pr-2 font-semibold">{DAY_LABELS[s.dayOfWeek]} ({s.sessionDate})</td>
                              <td className="py-2 px-2 font-mono">T{s.startPeriod}-{s.startPeriod + s.totalPeriods - 1}</td>
                              <td className="py-2 px-2"><strong className="font-mono">{crs?.courseCode}</strong> — {crs?.courseName}</td>
                              <td className="py-2 pl-2 text-right font-mono tabular-nums">{sec?.enrolledCount} SV ({sfr}%)</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="px-5 py-3 bg-[#F7F7F7] border-t border-[#E6E9ED] flex justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const rm = detailRoom;
                    setDetailRoom(null);
                    navigateWithDrillDown('builder', {
                      sourceLabel: `Lịch phòng ${rm.roomCode}`,
                      builderViewMode: 'ROOM',
                      builderEntityId: rm.roomId,
                    });
                  }}
                  className="px-3 py-1.5 rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white text-xs font-semibold"
                >
                  Mở trên Lưới Xếp lịch
                </button>
                <button type="button" onClick={() => setDetailRoom(null)} className="px-4 py-1.5 rounded bg-[#2A3F54] text-white text-xs font-semibold">
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* DETAIL MODAL 4: INSTRUCTOR SCHEDULE */}
      {detailInstructor && (() => {
        const insSessions = activeWeekSessions
          .filter((s) => {
            const sec = state.sections.find((x) => x.sectionId === s.sectionId);
            return sec?.instructors.some((i) => i.instructorId === detailInstructor.instructorId);
          })
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startPeriod - b.startPeriod);
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded border border-[#D9DEE4] shadow-xl max-w-[660px] w-full overflow-hidden">
              <div className="px-5 py-3.5 bg-[#2A3F54] text-white flex items-center justify-between">
                <div>
                  <div className="font-mono text-[11px] text-[#1ABB9C]">Lịch Giảng dạy Cá nhân · {detailInstructor.staffCode}</div>
                  <h4 className="text-sm font-bold">{detailInstructor.title} {detailInstructor.fullName}</h4>
                </div>
                <button type="button" onClick={() => setDetailInstructor(null)} className="text-white/75 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[#5A738E]">
                    Tổng buổi Tuần {state.activeWeek}: <strong className="font-mono text-[#2A3F54]">{insSessions.length}</strong> · Email: {detailInstructor.email}
                  </div>
                  <ExportToolbar
                    compact
                    filenameBase={`UTS_LichGiang_${detailInstructor.staffCode}`}
                    reportTitle={`Lịch giảng dạy ${detailInstructor.title} ${detailInstructor.fullName}`}
                    onExportICal={() => {
                      const ics = generateICalendarContent(
                        state,
                        insSessions,
                        `Lịch dạy ${detailInstructor.title} ${detailInstructor.fullName}`
                      );
                      triggerDownload(`UTS_LichDay_${detailInstructor.staffCode}.ics`, ics, 'text/calendar;charset=utf-8;');
                      addToast({ type: 'success', title: 'Đã xuất tệp iCalendar (.ics) cá nhân' });
                    }}
                    columns={[
                      { header: 'Thứ', accessor: (s) => DAY_LABELS[s.dayOfWeek] },
                      { header: 'Ngày', accessor: (s) => s.sessionDate },
                      { header: 'Tiết', accessor: (s) => `T${s.startPeriod}-${s.startPeriod + s.totalPeriods - 1}` },
                      { header: 'Giờ học', accessor: (s) => getPeriodTimeRange(s.startPeriod, s.totalPeriods) },
                      {
                        header: 'Học phần',
                        accessor: (s) => {
                          const sec = state.sections.find((x) => x.sectionId === s.sectionId);
                          const c = state.courses.find((k) => k.courseId === sec?.courseId);
                          return `${c?.courseCode ?? ''} - ${c?.courseName ?? ''}`;
                        },
                      },
                      {
                        header: 'Phòng',
                        accessor: (s) => state.classrooms.find((r) => r.roomId === s.roomId)?.roomCode ?? '',
                      },
                    ]}
                    rows={insSessions}
                  />
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[#E6E9ED] text-[#5A738E] text-left">
                      <th className="py-1.5 pr-2">Thứ / Ngày</th>
                      <th className="py-1.5 px-2">Tiết / Giờ</th>
                      <th className="py-1.5 px-2">Học phần</th>
                      <th className="py-1.5 pl-2 text-right">Phòng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E9ED]">
                    {insSessions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-[#73879C]">Giảng viên chưa có buổi giảng nào trong tuần này.</td>
                      </tr>
                    ) : (
                      insSessions.map((s) => {
                        const sec = state.sections.find((x) => x.sectionId === s.sectionId);
                        const crs = state.courses.find((c) => c.courseId === sec?.courseId);
                        const rm = state.classrooms.find((r) => r.roomId === s.roomId);
                        return (
                          <tr key={s.sessionId}>
                            <td className="py-2 pr-2 font-semibold">{DAY_LABELS[s.dayOfWeek]} ({s.sessionDate})</td>
                            <td className="py-2 px-2 font-mono">T{s.startPeriod}-{s.startPeriod + s.totalPeriods - 1}</td>
                            <td className="py-2 px-2"><strong className="font-mono">{crs?.courseCode}</strong> — {crs?.courseName}</td>
                            <td className="py-2 pl-2 text-right font-mono font-bold text-[#169F85]">{rm?.roomCode}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 bg-[#F7F7F7] border-t border-[#E6E9ED] flex justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const ins = detailInstructor;
                    setDetailInstructor(null);
                    navigateWithDrillDown('builder', {
                      sourceLabel: `Lịch giảng viên ${ins.fullName}`,
                      builderViewMode: 'INSTRUCTOR',
                      builderEntityId: ins.instructorId,
                    });
                  }}
                  className="px-3 py-1.5 rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  Mở trên Lưới Xếp lịch
                </button>
                <button type="button" onClick={() => setDetailInstructor(null)} className="px-4 py-1.5 rounded bg-[#2A3F54] text-white text-xs font-semibold">
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
