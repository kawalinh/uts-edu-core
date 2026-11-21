import type {
  AlternativeSlotSuggestion,
  CSPCostReport,
  ClassSession,
  ConflictCheckResult,
  ConflictViolation,
  CoursePrerequisite,
  CourseSection,
  CourseSubject,
  RoomType,
  UTSState,
} from '../types/uts';

export const DAY_LABELS: Record<number, string> = {
  2: 'Thứ Hai',
  3: 'Thứ Ba',
  4: 'Thứ Tư',
  5: 'Thứ Năm',
  6: 'Thứ Sáu',
  7: 'Thứ Bảy',
};

export const SHIFT_DEFS = [
  { id: 'MORNING' as const, label: 'Ca Sáng', periodsLabel: 'Tiết 1 - 4', startPeriod: 1, endPeriod: 5, timeRange: '07:00 - 10:35' },
  { id: 'AFTERNOON' as const, label: 'Ca Chiều', periodsLabel: 'Tiết 6 - 9', startPeriod: 6, endPeriod: 10, timeRange: '13:00 - 16:35' },
  { id: 'EVENING' as const, label: 'Ca Tối', periodsLabel: 'Tiết 11 - 13', startPeriod: 11, endPeriod: 13, timeRange: '18:00 - 20:45' },
];

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  HALL: 'Hội trường lớn',
  THEORY: 'Phòng lý thuyết',
  LAB_COMP: 'Phòng Lab Máy tính',
  LAB_LANG: 'Phòng Lab Ngoại ngữ',
  LAB_PHYSICS: 'Phòng Thí nghiệm Vật lý/KT',
};

export const PERIOD_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: '07:00', end: '07:50' },
  2: { start: '07:55', end: '08:45' },
  3: { start: '08:55', end: '09:45' },
  4: { start: '09:50', end: '10:40' },
  5: { start: '10:45', end: '11:35' },
  6: { start: '13:00', end: '13:50' },
  7: { start: '13:55', end: '14:45' },
  8: { start: '14:55', end: '15:45' },
  9: { start: '15:50', end: '16:40' },
  10: { start: '16:45', end: '17:35' },
  11: { start: '18:00', end: '18:50' },
  12: { start: '18:55', end: '19:45' },
  13: { start: '19:50', end: '20:40' },
};

export function getPeriodTimeRange(startPeriod: number, totalPeriods: number): string {
  const endPeriod = Math.min(13, startPeriod + totalPeriods - 1);
  const start = PERIOD_TIMES[startPeriod]?.start ?? '07:00';
  const end = PERIOD_TIMES[endPeriod]?.end ?? '10:40';
  return `${start} - ${end}`;
}

export function getShiftForPeriod(startPeriod: number): 'MORNING' | 'AFTERNOON' | 'EVENING' {
  if (startPeriod <= 5) return 'MORNING';
  if (startPeriod <= 10) return 'AFTERNOON';
  return 'EVENING';
}

export function getDateForWeekAndDay(weekIndex: number, dayOfWeek: number): string {
  // Base week 12 starts Monday 2026-11-23 (matches SRS Section 6 payload dates!)
  const baseMonday = new Date(Date.UTC(2026, 10, 23));
  const deltaDays = (weekIndex - 12) * 7 + (dayOfWeek - 2);
  const target = new Date(baseMonday.getTime() + deltaDays * 86400000);
  return target.toISOString().slice(0, 10);
}

export function periodsOverlap(startA: number, durA: number, startB: number, durB: number): boolean {
  const endA = startA + durA - 1;
  const endB = startB + durB - 1;
  return startA <= endB && startB <= endA;
}

export const COURSE_PERIOD_GUIDE = {
  formulaSummary: '1 Tín chỉ = 15 tiết (LT/BT/TL) hoặc 30 tiết (TH). Tổng tiết = LT + BT + TL + TH.',
  validBoundSummary: 'Biên tổng tiết hợp lệ chuẩn Bộ GD&ĐT: từ [Số TC × 15] đến [Số TC × 30] tiết.',
  items: [
    {
      code: 'LT',
      name: 'Lý thuyết',
      norm: '1 TC = 15 tiết',
      roomHint: 'Phòng lý thuyết / Hội trường lớn',
      description: 'Giảng dạy kiến thức nền tảng, nguyên lý chuyên ngành trên lớp.',
    },
    {
      code: 'BT',
      name: 'Bài tập',
      norm: '1 TC = 15 tiết',
      roomHint: 'Phòng lý thuyết / Phòng đa năng',
      description: 'Hướng dẫn giải bài tập, củng cố kỹ năng vận dụng lý thuyết (có thể có Trợ giảng TA).',
    },
    {
      code: 'TL',
      name: 'Thảo luận / Seminar',
      norm: '1 TC = 15 tiết',
      roomHint: 'Phòng lý thuyết / Phòng chuyên đề',
      description: 'Thảo luận nhóm, thuyết trình học thuật, phản biện chuyên đề.',
    },
    {
      code: 'TH',
      name: 'Thực hành / Thí nghiệm',
      norm: '1 TC = 30 tiết',
      roomHint: 'Phòng Lab Máy tính / Thí nghiệm KT / Lab Ngoại ngữ',
      description: 'Thực hành trên máy tính, thiết bị thí nghiệm; thường yêu cầu tách tốp Lab theo sức chứa.',
    },
  ],
};

export function isRoomTypeCompatible(required: RoomType, actual: RoomType): boolean {
  if (required === actual) return true;
  // Theory courses can also be placed in HALL (BR-TT-04 merged theory classes)
  if (required === 'THEORY' && actual === 'HALL') return true;
  return false;
}

export function getAllowedRoomTypesForSection(
  section: CourseSection,
  course?: CourseSubject
): RoomType[] {
  if (section.allowedRoomTypes && section.allowedRoomTypes.length > 0) {
    return Array.from(new Set(section.allowedRoomTypes));
  }
  const courseTypes =
    course?.requiredRoomTypes && course.requiredRoomTypes.length > 0
      ? course.requiredRoomTypes
      : course?.requiredRoomType
        ? [course.requiredRoomType]
        : [section.requiredRoomType];

  // If the section specifically designates a PRACTICE or THEORY session on a multi-room course:
  // - Always include section.requiredRoomType
  // - Also allow compatible room types defined at the course level matching the session nature
  if (section.sessionType === 'PRACTICE') {
    const labTypes = courseTypes.filter((t) => t !== 'THEORY' && t !== 'HALL');
    return Array.from(new Set([section.requiredRoomType, ...labTypes]));
  }
  if (section.sessionType === 'THEORY' || section.sessionType === 'DISCUSSION') {
    // Allow section's required room type plus all course-level types (so mixed LT+TH courses can be flexibly scheduled in THEORY, HALL, or assigned LAB)
    return Array.from(new Set([section.requiredRoomType, ...courseTypes]));
  }
  return Array.from(new Set([section.requiredRoomType, ...courseTypes]));
}

export function isRoomTypesCompatible(allowedTypes: RoomType[], actual: RoomType): boolean {
  return allowedTypes.some((req) => isRoomTypeCompatible(req, actual));
}

export function formatRoomTypesList(types: RoomType[]): string {
  const unique = Array.from(new Set(types));
  return unique.map((t) => ROOM_TYPE_LABELS[t] ?? t).join(', ');
}

export interface ConflictCheckParams {
  sectionId: string;
  roomId: string;
  weekIndex: number;
  dayOfWeek: number;
  startPeriod: number;
  totalPeriods: number;
  excludeSessionId?: string;
  includeSuggestions?: boolean;
}

/**
 * SRS Section 5.2 Real-time Conflict Checking Algorithm
 */
export function checkScheduleConflict(
  state: UTSState,
  params: ConflictCheckParams
): ConflictCheckResult {
  const t0 = performance.now();
  const violations: ConflictViolation[] = [];

  const section = state.sections.find((s) => s.sectionId === params.sectionId);
  const room = state.classrooms.find((r) => r.roomId === params.roomId);

  if (!section || !room) {
    return {
      isValid: false,
      hasWarnings: false,
      violations: [
        {
          severity: 'HARD',
          code: 'HARD_ERR_ROOM_UNAVAILABLE',
          message: 'Không tìm thấy lớp học phần hoặc phòng học mục tiêu.',
        },
      ],
      suggestions: [],
      executionTimeMs: Math.max(1, Math.round(performance.now() - t0)),
    };
  }

  const course = state.courses.find((c) => c.courseId === section.courseId);
  const activeSessions = state.sessions.filter(
    (s) =>
      s.sessionId !== params.excludeSessionId &&
      s.status !== 'CANCELLED' &&
      s.status !== 'RESCHEDULED' &&
      s.weekIndex === params.weekIndex
  );

  // 0. Operational Status check
  if (room.operationalStatus !== 'AVAILABLE') {
    violations.push({
      severity: 'HARD',
      code: 'HARD_ERR_ROOM_UNAVAILABLE',
      message: `Phòng ${room.roomCode} hiện đang ở trạng thái ${room.operationalStatus === 'MAINTENANCE' ? 'Bảo trì' : 'Tạm khóa'}.`,
    });
  }

  // 1. Capacity Check (BR_RULE_04): S_lop <= C_phong
  if (section.enrolledCount > room.maxCapacity) {
    violations.push({
      severity: 'HARD',
      code: 'HARD_ERR_OVER_CAPACITY',
      message: `Sĩ số lớp (${section.enrolledCount} SV) vượt quá sức chứa phòng ${room.roomCode} (${room.maxCapacity} chỗ).`,
    });
  }

  // 2. Room Type Compatibility (BR_RULE_05 — supports multi-select Course requiredRoomTypes)
  const allowedRoomTypes = getAllowedRoomTypesForSection(section, course);
  if (!isRoomTypesCompatible(allowedRoomTypes, room.roomType)) {
    violations.push({
      severity: 'HARD',
      code: 'HARD_ERR_INVALID_ROOM_TYPE',
      message: `Sai chủng loại phòng: Học phần ${course?.courseCode ?? section.sectionCode} chấp nhận [${formatRoomTypesList(allowedRoomTypes)}], không thể xếp vào ${ROOM_TYPE_LABELS[room.roomType]} (${room.roomCode}).`,
    });
  }

  // 3. Room Overlap Check (BR_RULE_01)
  const roomConflict = activeSessions.find(
    (s) =>
      s.roomId === params.roomId &&
      s.dayOfWeek === params.dayOfWeek &&
      periodsOverlap(s.startPeriod, s.totalPeriods, params.startPeriod, params.totalPeriods)
  );
  if (roomConflict) {
    const conflictSec = state.sections.find((sec) => sec.sectionId === roomConflict.sectionId);
    const conflictCourse = state.courses.find((c) => c.courseId === conflictSec?.courseId);
    const leadAssign = conflictSec?.instructors.find((i) => i.role === 'LEAD') ?? conflictSec?.instructors[0];
    const conflictInstr = state.instructors.find((i) => i.instructorId === leadAssign?.instructorId);
    violations.push({
      severity: 'HARD',
      code: 'HARD_ERR_ROOM_DOUBLE_BOOKED',
      message: `Xung đột phòng học: Phòng ${room.roomCode} đã được phân bổ cho Lớp ${conflictCourse?.courseCode ?? conflictSec?.sectionCode} (${conflictCourse?.courseName ?? ''}${conflictInstr ? ` - ${conflictInstr.title} ${conflictInstr.fullName}` : ''}) vào ${DAY_LABELS[params.dayOfWeek]}, Tiết ${roomConflict.startPeriod}-${roomConflict.startPeriod + roomConflict.totalPeriods - 1}.`,
      conflictingSessionId: roomConflict.sessionId,
      conflictingEntityName: conflictCourse?.courseCode ?? conflictSec?.sectionCode,
    });
  }

  // 4. Instructor Overlap, Fixed Availability & Daily Workload Check (BR_RULE_02 & BR_RULE_08)
  const targetShift = getShiftForPeriod(params.startPeriod);
  for (const assign of section.instructors) {
    const instr = state.instructors.find((i) => i.instructorId === assign.instructorId);
    if (!instr) continue;

    // Overlap check
    const instrConflict = activeSessions.find((s) => {
      if (s.dayOfWeek !== params.dayOfWeek) return false;
      if (!periodsOverlap(s.startPeriod, s.totalPeriods, params.startPeriod, params.totalPeriods)) return false;
      const otherSec = state.sections.find((sec) => sec.sectionId === s.sectionId);
      return otherSec?.instructors.some((oi) => oi.instructorId === instr.instructorId);
    });

    if (instrConflict) {
      const otherSec = state.sections.find((sec) => sec.sectionId === instrConflict.sectionId);
      const otherRoom = state.classrooms.find((r) => r.roomId === instrConflict.roomId);
      violations.push({
        severity: 'HARD',
        code: 'HARD_ERR_INSTRUCTOR_OVERLAP',
        message: `Trùng lịch giảng viên: ${instr.title} ${instr.fullName} đã dạy lớp ${otherSec?.sectionCode ?? ''} tại phòng ${otherRoom?.roomCode ?? ''} trong khung giờ này.`,
        conflictingSessionId: instrConflict.sessionId,
        conflictingEntityName: `${instr.title} ${instr.fullName}`,
      });
    }

    // Personal Availability Constraint (BR-FM-02)
    const avail = state.availabilities.find(
      (a) => a.instructorId === instr.instructorId && a.dayOfWeek === params.dayOfWeek && a.shift === targetShift
    );
    if (avail) {
      if (avail.constraintType === 'HARD_BUSY') {
        violations.push({
          severity: 'HARD',
          code: 'HARD_ERR_INSTRUCTOR_UNAVAILABLE',
          message: `Giảng viên ${instr.title} ${instr.fullName} có lịch bận cố định (${avail.reason}) vào ${DAY_LABELS[params.dayOfWeek]} (${targetShift === 'MORNING' ? 'Sáng' : targetShift === 'AFTERNOON' ? 'Chiều' : 'Tối'}).`,
          conflictingEntityName: `${instr.title} ${instr.fullName}`,
        });
      } else {
        violations.push({
          severity: 'SOFT',
          code: 'WARN_INSTRUCTOR_SOFT_AVOID',
          message: `Lưu ý sư phạm: ${instr.title} ${instr.fullName} đánh dấu không ưu tiên khung giờ này (${avail.reason}).`,
        });
      }
    }

    // Daily Workload Check (> maxHoursPerDay, default 6 periods/day)
    const dailyPeriods = activeSessions
      .filter((s) => {
        if (s.dayOfWeek !== params.dayOfWeek) return false;
        const otherSec = state.sections.find((sec) => sec.sectionId === s.sectionId);
        return otherSec?.instructors.some((oi) => oi.instructorId === instr.instructorId);
      })
      .reduce((acc, s) => acc + s.totalPeriods, 0);

    if (dailyPeriods + params.totalPeriods > instr.maxHoursPerDay) {
      violations.push({
        severity: 'SOFT',
        code: 'WARN_MAX_WORKLOAD_EXCEEDED',
        message: `Cường độ giảng dạy: ${instr.title} ${instr.fullName} sẽ dạy ${dailyPeriods + params.totalPeriods} tiết trong ${DAY_LABELS[params.dayOfWeek]} (vượt ngưỡng ${instr.maxHoursPerDay} tiết/ngày — BR_RULE_08).`,
      });
    }

    // Building Travel Distance Check (BR_RULE_09)
    const targetBuilding = state.buildings.find((b) => b.buildingId === room.buildingId);
    const adjacentSession = activeSessions.find((s) => {
      if (s.dayOfWeek !== params.dayOfWeek) return false;
      const otherSec = state.sections.find((sec) => sec.sectionId === s.sectionId);
      if (!otherSec?.instructors.some((oi) => oi.instructorId === instr.instructorId)) return false;
      const otherEnd = s.startPeriod + s.totalPeriods - 1;
      const targetEnd = params.startPeriod + params.totalPeriods - 1;
      return Math.abs(otherEnd - params.startPeriod) <= 1 || Math.abs(targetEnd - s.startPeriod) <= 1;
    });
    if (adjacentSession && targetBuilding) {
      const otherRoom = state.classrooms.find((r) => r.roomId === adjacentSession.roomId);
      const otherBuilding = state.buildings.find((b) => b.buildingId === otherRoom?.buildingId);
      if (otherBuilding && otherBuilding.distanceGroup !== targetBuilding.distanceGroup) {
        violations.push({
          severity: 'SOFT',
          code: 'WARN_TRAVEL_GAP',
          message: `Khoảng cách di chuyển > 500m (BR_RULE_09): ${instr.title} ${instr.fullName} có 2 ca sát nhau giữa ${otherBuilding.buildingName} và ${targetBuilding.buildingName}.`,
        });
      }
    }
  }

  // 5. Student Cohort Overlap Check (BR_RULE_03)
  for (const cohortId of section.cohortClassIds) {
    const cohort = state.classes.find((c) => c.classId === cohortId);
    const cohortConflict = activeSessions.find((s) => {
      if (s.dayOfWeek !== params.dayOfWeek) return false;
      if (!periodsOverlap(s.startPeriod, s.totalPeriods, params.startPeriod, params.totalPeriods)) return false;
      const otherSec = state.sections.find((sec) => sec.sectionId === s.sectionId);
      // Note: If two sections are split Lab groups of the SAME course (groupLabel starts with Tốp), allow non-overlapping or alert if same cohort
      if (!otherSec) return false;
      return otherSec.cohortClassIds.includes(cohortId);
    });

    if (cohortConflict) {
      const otherSec = state.sections.find((sec) => sec.sectionId === cohortConflict.sectionId);
      const otherCourse = state.courses.find((c) => c.courseId === otherSec?.courseId);
      violations.push({
        severity: 'HARD',
        code: 'HARD_ERR_COHORT_OVERLAP',
        message: `Trùng lịch sinh viên: Lớp cơ hữu ${cohort?.classCode ?? cohortId} đã có lịch học môn ${otherCourse?.courseCode ?? otherSec?.sectionCode} vào khung giờ này.`,
        conflictingSessionId: cohortConflict.sessionId,
        conflictingEntityName: cohort?.classCode ?? cohortId,
      });
    }
  }

  // Soft Rule BR_RULE_07: Even periods (2 or 4)
  if (params.totalPeriods % 2 !== 0) {
    violations.push({
      severity: 'SOFT',
      code: 'WARN_ODD_PERIODS',
      message: `Phân bổ tiết lẻ (${params.totalPeriods} tiết): Nên bố trí theo cụm chẵn 2 hoặc 4 tiết liên tục (BR_RULE_07).`,
    });
  }

  // Soft Rule BR_RULE_10: Room Fill Ratio efficiency (avoid putting <30 students into >150 hall or <50% fill)
  const fillRatio = section.enrolledCount / room.maxCapacity;
  if (section.enrolledCount <= room.maxCapacity && ((section.enrolledCount < 30 && room.maxCapacity >= 150) || fillRatio < 0.45)) {
    violations.push({
      severity: 'SOFT',
      code: 'WARN_ROOM_UNDERUTILIZED',
      message: `Lãng phí công suất phòng (BR_RULE_10): Lớp ${section.enrolledCount} SV xếp vào phòng ${room.roomCode} (${room.maxCapacity} chỗ, tỷ lệ lấp đầy ${Math.round(fillRatio * 100)}%).`,
    });
  }

  const hardViolations = violations.filter((v) => v.severity === 'HARD');
  const softViolations = violations.filter((v) => v.severity === 'SOFT');

  const suggestions =
    params.includeSuggestions && hardViolations.length > 0
      ? findTopAlternativeSlots(state, {
          sectionId: params.sectionId,
          preferredDayOfWeek: params.dayOfWeek,
          preferredStartPeriod: params.startPeriod,
          totalPeriods: params.totalPeriods,
          weekIndex: params.weekIndex,
          excludeSessionId: params.excludeSessionId,
        })
      : [];

  return {
    isValid: hardViolations.length === 0,
    hasWarnings: softViolations.length > 0,
    violations,
    suggestions,
    executionTimeMs: Math.max(2, Math.round(performance.now() - t0)),
  };
}

/**
 * BR-TT-03: Smart Top 3 Alternative Slots Recommendation
 */
export function findTopAlternativeSlots(
  state: UTSState,
  opts: {
    sectionId: string;
    preferredDayOfWeek: number;
    preferredStartPeriod: number;
    totalPeriods: number;
    weekIndex: number;
    excludeSessionId?: string;
    limit?: number;
  }
): AlternativeSlotSuggestion[] {
  const section = state.sections.find((s) => s.sectionId === opts.sectionId);
  if (!section) return [];

  const candidates: AlternativeSlotSuggestion[] = [];
  const candidateStarts = [opts.preferredStartPeriod, 1, 6, 11].filter(
    (v, idx, arr) => arr.indexOf(v) === idx
  );
  const candidateDays = [
    opts.preferredDayOfWeek,
    2,
    3,
    4,
    5,
    6,
    7,
  ].filter((v, idx, arr) => arr.indexOf(v) === idx);

  const course = state.courses.find((c) => c.courseId === section.courseId);
  const allowedRoomTypes = getAllowedRoomTypesForSection(section, course);
  const eligibleRooms = state.classrooms.filter(
    (r) =>
      r.operationalStatus === 'AVAILABLE' &&
      r.maxCapacity >= section.enrolledCount &&
      isRoomTypesCompatible(allowedRoomTypes, r.roomType)
  );

  for (const day of candidateDays) {
    for (const startP of candidateStarts) {
      if (startP + opts.totalPeriods - 1 > 13) continue;
      for (const room of eligibleRooms) {
        const res = checkScheduleConflict(state, {
          sectionId: opts.sectionId,
          roomId: room.roomId,
          weekIndex: opts.weekIndex,
          dayOfWeek: day,
          startPeriod: startP,
          totalPeriods: opts.totalPeriods,
          excludeSessionId: opts.excludeSessionId,
          includeSuggestions: false,
        });
        if (res.isValid) {
          const seatWaste = room.maxCapacity - section.enrolledCount;
          const sameSlotBonus = day === opts.preferredDayOfWeek && startP === opts.preferredStartPeriod ? 0 : 18;
          const sameDayBonus = day === opts.preferredDayOfWeek ? 0 : 10;
          const softPenalty = res.violations.length * 25 + seatWaste * 0.4 + sameSlotBonus + sameDayBonus;
          const sfr = Math.round((section.enrolledCount / room.maxCapacity) * 100);

          candidates.push({
            rank: 0,
            roomId: room.roomId,
            roomCode: room.roomCode,
            roomName: room.roomName,
            roomCapacity: room.maxCapacity,
            dayOfWeek: day,
            sessionDate: getDateForWeekAndDay(opts.weekIndex, day),
            startPeriod: startP,
            totalPeriods: opts.totalPeriods,
            seatFillRatio: sfr,
            reason:
              day === opts.preferredDayOfWeek && startP === opts.preferredStartPeriod
                ? `Cùng khung giờ · Phòng trống tương đương (lấp đầy ${sfr}%)`
                : `Khung giờ trống thay thế · Tối ưu sức chứa (lấp đầy ${sfr}%)`,
            softPenalty,
          });
        }
      }
    }
  }

  candidates.sort((a, b) => a.softPenalty - b.softPenalty);
  // Deduplicate so user sees diverse rooms/slots
  const picked: AlternativeSlotSuggestion[] = [];
  const seenKey = new Set<string>();
  for (const c of candidates) {
    const key = `${c.roomId}_${c.dayOfWeek}_${c.startPeriod}`;
    if (!seenKey.has(key)) {
      seenKey.add(key);
      picked.push({ ...c, rank: picked.length + 1 });
    }
    if (picked.length >= (opts.limit ?? 3)) break;
  }
  return picked;
}

/**
 * SRS Section 5.1 Mathematical CSP Cost Evaluator
 * Cost(S) = sum(w_c * Violation(c, S))
 */
export function evaluateCSPCost(state: UTSState, weekIndex: number): CSPCostReport {
  const activeSessions = state.sessions.filter(
    (s) => s.weekIndex === weekIndex && s.status !== 'CANCELLED' && s.status !== 'RESCHEDULED'
  );

  let hardViolationCount = 0;
  let workloadViolations = 0;
  let underutilizedViolations = 0;
  let oddPeriodViolations = 0;
  let softAvoidViolations = 0;
  let travelViolations = 0;

  for (const s of activeSessions) {
    const check = checkScheduleConflict(state, {
      sectionId: s.sectionId,
      roomId: s.roomId,
      weekIndex: s.weekIndex,
      dayOfWeek: s.dayOfWeek,
      startPeriod: s.startPeriod,
      totalPeriods: s.totalPeriods,
      excludeSessionId: s.sessionId,
      includeSuggestions: false,
    });
    for (const v of check.violations) {
      if (v.severity === 'HARD') hardViolationCount++;
      else if (v.code === 'WARN_MAX_WORKLOAD_EXCEEDED') workloadViolations++;
      else if (v.code === 'WARN_ROOM_UNDERUTILIZED') underutilizedViolations++;
      else if (v.code === 'WARN_ODD_PERIODS') oddPeriodViolations++;
      else if (v.code === 'WARN_INSTRUCTOR_SOFT_AVOID') softAvoidViolations++;
      else if (v.code === 'WARN_TRAVEL_GAP') travelViolations++;
    }
  }

  const breakdown = [
    { ruleCode: 'BR_RULE_08', label: 'Vượt trần 6 tiết/ngày giảng viên', weight: 30, violations: workloadViolations, cost: workloadViolations * 30 },
    { ruleCode: 'BR_RULE_10', label: 'Lãng phí sức chứa phòng (<45% lấp đầy)', weight: 15, violations: underutilizedViolations, cost: underutilizedViolations * 15 },
    { ruleCode: 'BR_RULE_09', label: 'Di chuyển giữa 2 cơ sở sát ca (>500m)', weight: 25, violations: travelViolations, cost: travelViolations * 25 },
    { ruleCode: 'BR_RULE_07', label: 'Xếp lẻ tiết không theo cụm 2/4 tiết', weight: 10, violations: oddPeriodViolations, cost: oddPeriodViolations * 10 },
    { ruleCode: 'BR-FM-02', label: 'Trùng khung giờ không ưu tiên của GV', weight: 12, violations: softAvoidViolations, cost: softAvoidViolations * 12 },
  ];

  const totalSoftCost = breakdown.reduce((sum, b) => sum + b.cost, 0);
  return { hardViolationCount, totalSoftCost, breakdown };
}

/**
 * SRS-WEB-01: Cycle Detection Algorithm (DFS) for Course Prerequisites
 */
export function detectPrerequisiteCycle(
  prerequisites: CoursePrerequisite[],
  newCourseId: string,
  newPrereqId: string
): boolean {
  if (newCourseId === newPrereqId) return true;
  const graph = new Map<string, string[]>();
  for (const p of prerequisites) {
    const list = graph.get(p.courseId) ?? [];
    list.push(p.prerequisiteCourseId);
    graph.set(p.courseId, list);
  }
  const current = graph.get(newCourseId) ?? [];
  current.push(newPrereqId);
  graph.set(newCourseId, current);

  // Check if newPrereqId can reach newCourseId
  const visited = new Set<string>();
  const stack = [newPrereqId];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node === newCourseId) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    const neighbors = graph.get(node) ?? [];
    for (const n of neighbors) {
      stack.push(n);
    }
  }
  return false;
}

/**
 * SRS-WEB-01: Validate Total Hours = LT + BT + TL + TH vs Credits
 */
export function validateCourseHours(course: Pick<CourseSubject, 'credits' | 'theoryPeriods' | 'exercisePeriods' | 'discussionPeriods' | 'practicalPeriods'>): {
  totalHours: number;
  isRatioValid: boolean;
  warningCode?: 'WARN_INVALID_CREDIT_HOUR_RATIO';
  message?: string;
} {
  const totalHours =
    course.theoryPeriods + course.exercisePeriods + course.discussionPeriods + course.practicalPeriods;
  // Standard Vietnam university credit norm: 1 credit = 15 LT/BT/TL periods or 30 TH periods
  const expectedMin = course.credits * 15;
  const expectedMax = course.credits * 30;
  if (totalHours < expectedMin || totalHours > expectedMax) {
    return {
      totalHours,
      isRatioValid: false,
      warningCode: 'WARN_INVALID_CREDIT_HOUR_RATIO',
      message: `Tổng số tiết (${totalHours}) nằm ngoài biên chuẩn [${expectedMin}–${expectedMax} tiết] cho học phần ${course.credits} tín chỉ.`,
    };
  }
  return { totalHours, isRatioValid: true };
}

/**
 * Operational KPIs Dashboard Calculator (Technical Proposal Section 7.1 & UAC-03)
 */
export interface DashboardKPIs {
  rur: number; // Room Utilization Rate %
  sfr: number; // Seat Fill Ratio %
  svi: number; // Schedule Volatility Index %
  slaOnTimeRate: number; // % requests within 24h
  avgSlaHours: number;
  totalActiveSessions: number;
  unassignedSectionCount: number;
  hardConflictsCount: number;
  pendingRequestsCount: number;
  openIncidentsCount: number;
  heatmap: {
    dayOfWeek: number;
    dayLabel: string;
    shiftId: 'MORNING' | 'AFTERNOON' | 'EVENING';
    shiftLabel: string;
    usedRooms: number;
    availableRooms: number;
    occupancyRate: number;
    sessionsCount: number;
  }[];
  instructorLoads: {
    instructorId: string;
    name: string;
    facultyName: string;
    type: string;
    weeklyPeriods: number;
    maxWeeklyPeriods: number;
    maxDailyUsed: number;
    maxDailyCap: number;
    status: 'OPTIMAL' | 'OVERLOADED' | 'UNDERLOADED';
  }[];
}

export function calculateKPIs(
  state: UTSState,
  filters?: { campusCode?: string; buildingId?: string; facultyId?: string }
): DashboardKPIs {
  const filteredBuildings = state.buildings.filter(
    (b) =>
      (!filters?.campusCode || filters.campusCode === 'ALL' || b.campusCode === filters.campusCode) &&
      (!filters?.buildingId || filters.buildingId === 'ALL' || b.buildingId === filters.buildingId)
  );
  const allowedBuildingIds = new Set(filteredBuildings.map((b) => b.buildingId));

  const filteredRooms = state.classrooms.filter(
    (r) => allowedBuildingIds.has(r.buildingId) && r.operationalStatus === 'AVAILABLE'
  );
  const allowedRoomIds = new Set(filteredRooms.map((r) => r.roomId));

  const weekSessionsAll = state.sessions.filter((s) => s.weekIndex === state.activeWeek);
  const filteredSessions = weekSessionsAll.filter((s) => {
    if (!allowedRoomIds.has(s.roomId)) return false;
    if (filters?.facultyId && filters.facultyId !== 'ALL') {
      const sec = state.sections.find((sec) => sec.sectionId === s.sectionId);
      const course = state.courses.find((c) => c.courseId === sec?.courseId);
      if (course?.facultyId !== filters.facultyId) return false;
    }
    return true;
  });

  const activeSessions = filteredSessions.filter(
    (s) => s.status !== 'CANCELLED' && s.status !== 'RESCHEDULED'
  );

  // RUR = (Total room hours used) / (Available rooms * 6 days * 12 standard usable periods/day)
  const totalPeriodsUsed = activeSessions.reduce((acc, s) => acc + s.totalPeriods, 0);
  const totalPeriodsCapacity = Math.max(1, filteredRooms.length * 6 * 12);
  const rur = Number(((totalPeriodsUsed / totalPeriodsCapacity) * 100).toFixed(1));

  // SFR = sum(S_lop) / sum(C_phong_duoc_dung) * 100%
  let sumEnrolled = 0;
  let sumRoomCapacity = 0;
  for (const s of activeSessions) {
    const sec = state.sections.find((x) => x.sectionId === s.sectionId);
    const room = state.classrooms.find((r) => r.roomId === s.roomId);
    if (sec && room) {
      sumEnrolled += sec.enrolledCount;
      sumRoomCapacity += room.maxCapacity;
    }
  }
  const sfr = sumRoomCapacity > 0 ? Number(((sumEnrolled / sumRoomCapacity) * 100).toFixed(1)) : 0;

  // SVI = changed sessions / total planned sessions * 100%
  const changedCount = filteredSessions.filter(
    (s) =>
      s.status === 'CANCELLED' ||
      s.status === 'RESCHEDULED' ||
      s.status === 'MAKEUP' ||
      s.status === 'ROOM_CHANGED' ||
      s.status === 'PENDING_CHANGE'
  ).length;
  const svi =
    filteredSessions.length > 0
      ? Number(((changedCount / filteredSessions.length) * 100).toFixed(1))
      : 0;

  // SLA On-time Resolution
  const decidedReqs = state.changeRequests.filter(
    (r) => r.approvalStatus === 'APPROVED' || r.approvalStatus === 'REJECTED'
  );
  let onTimeCount = 0;
  let totalHours = 0;
  for (const req of decidedReqs) {
    const start = new Date(req.createdAt).getTime();
    const end = new Date(req.academicApprovedAt ?? req.facultyApprovedAt ?? req.createdAt).getTime();
    const diffHours = Math.max(0.5, (end - start) / 3600000);
    totalHours += diffHours;
    if (diffHours <= 24) onTimeCount++;
  }
  const slaOnTimeRate =
    decidedReqs.length > 0 ? Number(((onTimeCount / decidedReqs.length) * 100).toFixed(1)) : 100;
  const avgSlaHours = decidedReqs.length > 0 ? Number((totalHours / decidedReqs.length).toFixed(1)) : 4.2;

  // Heatmap Matrix: 6 days x 3 shifts
  const heatmap: DashboardKPIs['heatmap'] = [];
  for (const day of [2, 3, 4, 5, 6, 7]) {
    for (const shift of SHIFT_DEFS) {
      const shiftSessions = activeSessions.filter(
        (s) => s.dayOfWeek === day && getShiftForPeriod(s.startPeriod) === shift.id
      );
      const usedRoomSet = new Set(shiftSessions.map((s) => s.roomId));
      const availCount = Math.max(1, filteredRooms.length);
      heatmap.push({
        dayOfWeek: day,
        dayLabel: DAY_LABELS[day],
        shiftId: shift.id,
        shiftLabel: shift.label,
        usedRooms: usedRoomSet.size,
        availableRooms: filteredRooms.length,
        occupancyRate: Math.round((usedRoomSet.size / availCount) * 100),
        sessionsCount: shiftSessions.length,
      });
    }
  }

  // Instructor Loads
  const allActiveWeekSessions = weekSessionsAll.filter(
    (s) => s.status !== 'CANCELLED' && s.status !== 'RESCHEDULED'
  );
  const instructorLoads = state.instructors
    .filter((i) => !filters?.facultyId || filters.facultyId === 'ALL' || i.facultyId === filters.facultyId)
    .map((instr) => {
      const fac = state.faculties.find((f) => f.facultyId === instr.facultyId);
      const instrSessions = allActiveWeekSessions.filter((s) => {
        const sec = state.sections.find((x) => x.sectionId === s.sectionId);
        return sec?.instructors.some((a) => a.instructorId === instr.instructorId);
      });
      const weeklyPeriods = instrSessions.reduce((sum, s) => sum + s.totalPeriods, 0);
      const dailyMap = new Map<number, number>();
      for (const s of instrSessions) {
        dailyMap.set(s.dayOfWeek, (dailyMap.get(s.dayOfWeek) ?? 0) + s.totalPeriods);
      }
      const maxDailyUsed = Math.max(0, ...Array.from(dailyMap.values()));
      let status: 'OPTIMAL' | 'OVERLOADED' | 'UNDERLOADED' = 'OPTIMAL';
      if (maxDailyUsed > instr.maxHoursPerDay || weeklyPeriods > instr.maxHoursPerWeek) {
        status = 'OVERLOADED';
      } else if (weeklyPeriods < 4) {
        status = 'UNDERLOADED';
      }
      return {
        instructorId: instr.instructorId,
        name: `${instr.title} ${instr.fullName}`,
        facultyName: fac?.code ?? '',
        type: instr.instructorType === 'FULL_TIME' ? 'Cơ hữu' : instr.instructorType === 'VISITING' ? 'Thỉnh giảng' : 'Trợ giảng',
        weeklyPeriods,
        maxWeeklyPeriods: instr.maxHoursPerWeek,
        maxDailyUsed,
        maxDailyCap: instr.maxHoursPerDay,
        status,
      };
    })
    .sort((a, b) => b.weeklyPeriods - a.weeklyPeriods);

  const scheduledSectionIds = new Set(allActiveWeekSessions.map((s) => s.sectionId));
  const unassignedSectionCount = state.sections.filter(
    (sec) => sec.status === 'OPEN' || !scheduledSectionIds.has(sec.sectionId)
  ).length;

  const csp = evaluateCSPCost(state, state.activeWeek);

  return {
    rur,
    sfr,
    svi,
    slaOnTimeRate,
    avgSlaHours,
    totalActiveSessions: activeSessions.length,
    unassignedSectionCount,
    hardConflictsCount: csp.hardViolationCount,
    pendingRequestsCount: state.changeRequests.filter(
      (r) => r.approvalStatus === 'PENDING_FACULTY_APPROVAL' || r.approvalStatus === 'PENDING_ACADEMIC_APPROVAL'
    ).length,
    openIncidentsCount: state.incidents.filter((i) => i.status !== 'RESOLVED').length,
    heatmap,
    instructorLoads,
  };
}

/**
 * Deterministic Greedy CSP Solver: places all unassigned sections with 0 Hard Conflicts & minimal Soft Cost
 */
export function autoSolveUnassignedCSP(state: UTSState): {
  newSessions: ClassSession[];
  placedSectionIds: string[];
  unplacedSectionIds: string[];
} {
  const workingState: UTSState = {
    ...state,
    sessions: [...state.sessions],
  };

  const activeSessionSecIds = new Set(
    workingState.sessions
      .filter((s) => s.weekIndex === state.activeWeek && s.status !== 'CANCELLED' && s.status !== 'RESCHEDULED')
      .map((s) => s.sectionId)
  );

  // Sort unassigned sections by highest difficulty first (largest enrolledCount & specialized Lab rooms)
  const unassigned = workingState.sections
    .filter((sec) => !activeSessionSecIds.has(sec.sectionId))
    .sort((a, b) => {
      const aSpec = a.requiredRoomType === 'THEORY' ? 0 : 1;
      const bSpec = b.requiredRoomType === 'THEORY' ? 0 : 1;
      if (aSpec !== bSpec) return bSpec - aSpec;
      return b.enrolledCount - a.enrolledCount;
    });

  const newSessions: ClassSession[] = [];
  const placedSectionIds: string[] = [];
  const unplacedSectionIds: string[] = [];

  for (const sec of unassigned) {
    const suggestions = findTopAlternativeSlots(workingState, {
      sectionId: sec.sectionId,
      preferredDayOfWeek: 2,
      preferredStartPeriod: 1,
      totalPeriods: sec.periodsPerSession,
      weekIndex: state.activeWeek,
      limit: 1,
    });
    if (suggestions.length > 0) {
      const best = suggestions[0];
      const created: ClassSession = {
        sessionId: `SES_AUTO_${Date.now().toString().slice(-4)}_${placedSectionIds.length + 1}`,
        sectionId: sec.sectionId,
        roomId: best.roomId,
        sessionDate: best.sessionDate,
        weekIndex: state.activeWeek,
        dayOfWeek: best.dayOfWeek,
        startPeriod: best.startPeriod,
        totalPeriods: best.totalPeriods,
        sessionType: sec.sessionType,
        status: 'CONFIRMED',
        note: 'Phân bổ tự động bởi Bộ giải CSP tối ưu hóa sức chứa',
      };
      workingState.sessions.push(created);
      newSessions.push(created);
      placedSectionIds.push(sec.sectionId);
    } else {
      unplacedSectionIds.push(sec.sectionId);
    }
  }

  return { newSessions, placedSectionIds, unplacedSectionIds };
}

/**
 * Generate RFC 5545 iCalendar (.ics) file content (BR-MO-05 / SRS-MOB-03)
 */
export function generateICalendarContent(
  state: UTSState,
  sessions: ClassSession[],
  calendarTitle: string
): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UTS EduCore//University Timetabling System//VI',
    `X-WR-CALNAME:${calendarTitle}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const s of sessions) {
    if (s.status === 'CANCELLED' || s.status === 'RESCHEDULED') continue;
    const sec = state.sections.find((x) => x.sectionId === s.sectionId);
    const course = state.courses.find((c) => c.courseId === sec?.courseId);
    const room = state.classrooms.find((r) => r.roomId === s.roomId);
    const building = state.buildings.find((b) => b.buildingId === room?.buildingId);
    const leadId = sec?.instructors.find((i) => i.role === 'LEAD')?.instructorId;
    const instr = state.instructors.find((i) => i.instructorId === leadId);

    const endP = Math.min(13, s.startPeriod + s.totalPeriods - 1);
    const startHM = (PERIOD_TIMES[s.startPeriod]?.start ?? '07:00').replace(':', '');
    const endHM = (PERIOD_TIMES[endP]?.end ?? '10:40').replace(':', '');
    const dateCompact = s.sessionDate.replace(/-/g, '');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${s.sessionId}@uts-educore.edu.vn`);
    lines.push(`DTSTART:${dateCompact}T${startHM}00`);
    lines.push(`DTEND:${dateCompact}T${endHM}00`);
    lines.push(
      `SUMMARY:[${course?.courseCode ?? sec?.sectionCode}] ${course?.courseName ?? 'Lịch học'} (${s.status === 'MAKEUP' ? 'Học bù' : 'Chính thức'})`
    );
    lines.push(`LOCATION:${room?.roomCode ?? ''} - ${building?.buildingName ?? ''}`);
    lines.push(
      `DESCRIPTION:Lớp HP: ${sec?.sectionCode ?? ''} | Tiết ${s.startPeriod}-${endP} | GV: ${instr ? `${instr.title} ${instr.fullName}` : 'Đang cập nhật'}`
    );
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
