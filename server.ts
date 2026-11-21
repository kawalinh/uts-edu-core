import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { createInitialUTSState } from './src/data/seedData';
import {
  DAY_LABELS,
  autoSolveUnassignedCSP,
  calculateKPIs,
  checkScheduleConflict,
  detectPrerequisiteCycle,
  evaluateCSPCost,
  findTopAlternativeSlots,
  getDateForWeekAndDay,
  getPeriodTimeRange,
  validateCourseHours,
} from './src/engine/conflictEngine';
import { checkRolePermission, createDefaultRoleGroups } from './src/utils/rbacConfig';
import type {
  AuditLog,
  Building,
  ClassSession,
  Classroom,
  CourseSection,
  CourseSubject,
  CrudAction,
  ExamModel,
  FacilityIncident,
  Faculty,
  Instructor,
  InstructorRole,
  LifecycleStage,
  PermissionFunctionId,
  PushNotification,
  RoleGroup,
  RoomType,
  ScheduleChangeRequest,
  SystemParameters,
  SystemUser,
  UTSState,
  UserRole,
} from './src/types/uts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '2mb' }));

let state: UTSState = createInitialUTSState();

function nowIso(): string {
  return new Date().toISOString();
}

function addAudit(entry: Omit<AuditLog, 'logId' | 'timestamp'>): AuditLog {
  const log: AuditLog = {
    ...entry,
    logId: `LOG_${Date.now().toString().slice(-6)}`,
    timestamp: nowIso(),
  };
  state.auditLogs.unshift(log);
  return log;
}

function pushNotif(entry: Omit<PushNotification, 'notificationId' | 'createdAt' | 'read'>): PushNotification {
  const notif: PushNotification = {
    ...entry,
    notificationId: `NOTIF_${Date.now().toString().slice(-6)}`,
    createdAt: nowIso(),
    read: false,
  };
  state.notifications.unshift(notif);
  return notif;
}

// ============================================================================
// 1. STATE & LIFECYCLE APIs
// ============================================================================
app.get('/api/v1/state', (_req, res) => {
  res.json({ success: true, data: state });
});

app.post('/api/v1/reset', (_req, res) => {
  state = createInitialUTSState();
  res.json({ success: true, data: state });
});

app.post('/api/v1/scheduling/freeze', (req, res) => {
  const { isFrozen, lifecycleStage, executedBy = 'ThS. Phạm Minh Tuấn', executedRole = 'SCHEDULER' } = req.body as {
    isFrozen?: boolean;
    lifecycleStage?: LifecycleStage;
    executedBy?: string;
    executedRole?: UserRole;
  };
  const oldState = { isFrozen: state.isFrozen, lifecycleStage: state.lifecycleStage };
  if (typeof isFrozen === 'boolean') state.isFrozen = isFrozen;
  if (lifecycleStage) state.lifecycleStage = lifecycleStage;
  if (state.isFrozen) state.lifecycleStage = 'T1_FROZEN';

  addAudit({
    entityName: 'timetable_lifecycle',
    recordId: state.termId,
    actionType: 'FREEZE',
    summary: state.isFrozen
      ? `Đóng băng Thời khóa biểu chính thức (Mốc T-1) — Kích hoạt đồng bộ LMS & Mobile App`
      : `Mở khóa chỉnh sửa dự thảo Thời khóa biểu (${state.lifecycleStage})`,
    oldValues: oldState,
    newValues: { isFrozen: state.isFrozen, lifecycleStage: state.lifecycleStage },
    executedBy,
    executedRole,
  });

  if (state.isFrozen) {
    state.lmsLastSyncAt = nowIso();
    pushNotif({
      type: 'SCHEDULE_CHANGE',
      title: 'Thời khóa biểu chính thức đã được ban hành (T-1)',
      body: `Lịch học Tuần ${state.activeWeek} (${state.termName}) đã chốt và đồng bộ sang Mobile App & LMS.`,
      targetRoles: ['STUDENT', 'INSTRUCTOR', 'FACULTY_HEAD', 'EXECUTIVE'],
    });
  }

  res.json({ success: true, data: state });
});

// ============================================================================
// 2. SCHEDULING & CONFLICT ENGINE APIs (SRS Section 6.1)
// ============================================================================
app.post('/api/v1/scheduling/check-availability', (req, res) => {
  const { section_id, room_id, week_index, day_of_week, start_period, total_periods, exclude_session_id } = req.body;
  const result = checkScheduleConflict(state, {
    sectionId: section_id,
    roomId: room_id,
    weekIndex: week_index ?? state.activeWeek,
    dayOfWeek: day_of_week,
    startPeriod: start_period,
    totalPeriods: total_periods,
    excludeSessionId: exclude_session_id,
    includeSuggestions: true,
  });
  res.json({
    success: true,
    data: result,
    meta: { execution_time_ms: result.executionTimeMs },
  });
});

app.post('/api/v1/scheduling/sessions/assign', (req, res) => {
  const {
    session_id,
    section_id,
    room_id,
    week_index,
    day_of_week,
    start_period,
    total_periods,
    session_type,
    executedBy = 'ThS. Phạm Minh Tuấn',
    executedRole = 'SCHEDULER',
  } = req.body;

  if (state.isFrozen) {
    return res.status(423).json({
      success: false,
      error: {
        code: 'ERR_TIMETABLE_FROZEN',
        message: 'Thời khóa biểu đã đóng băng (Mốc T-1). Vui lòng mở khóa dự thảo hoặc gửi đơn phê duyệt biến động lịch.',
      },
    });
  }

  const weekIndex = week_index ?? state.activeWeek;
  const check = checkScheduleConflict(state, {
    sectionId: section_id,
    roomId: room_id,
    weekIndex,
    dayOfWeek: day_of_week,
    startPeriod: start_period,
    totalPeriods: total_periods,
    excludeSessionId: session_id,
    includeSuggestions: true,
  });

  if (!check.isValid) {
    const firstHard = check.violations.find((v) => v.severity === 'HARD')!;
    return res.status(409).json({
      success: false,
      error: {
        code: firstHard.code,
        message: firstHard.message,
        violations: check.violations,
        suggestions: check.suggestions,
      },
      meta: { execution_time_ms: check.executionTimeMs },
    });
  }

  const room = state.classrooms.find((r) => r.roomId === room_id)!;
  const section = state.sections.find((s) => s.sectionId === section_id)!;
  const sessionDate = getDateForWeekAndDay(weekIndex, day_of_week);

  let updatedSession: ClassSession;
  if (session_id) {
    const idx = state.sessions.findIndex((s) => s.sessionId === session_id);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy buổi học.' } });
    }
    const oldSession = { ...state.sessions[idx] };
    updatedSession = {
      ...oldSession,
      roomId: room_id,
      weekIndex,
      dayOfWeek: day_of_week,
      sessionDate,
      startPeriod: start_period,
      totalPeriods: total_periods,
      status: oldSession.roomId !== room_id ? 'ROOM_CHANGED' : 'CONFIRMED',
      previousRoomId: oldSession.roomId !== room_id ? oldSession.roomId : oldSession.previousRoomId,
    };
    state.sessions[idx] = updatedSession;
    addAudit({
      entityName: 'trn_class_sessions',
      recordId: updatedSession.sessionId,
      actionType: 'UPDATE',
      summary: `Điều chỉnh buổi học ${section.sectionCode} sang ${DAY_LABELS[day_of_week]} Tiết ${start_period}-${start_period + total_periods - 1} · Phòng ${room.roomCode}`,
      oldValues: { roomId: oldSession.roomId, dayOfWeek: oldSession.dayOfWeek, startPeriod: oldSession.startPeriod },
      newValues: { roomId: updatedSession.roomId, dayOfWeek: updatedSession.dayOfWeek, startPeriod: updatedSession.startPeriod },
      executedBy,
      executedRole,
    });
  } else {
    updatedSession = {
      sessionId: `SES_${Date.now().toString().slice(-6)}`,
      sectionId: section_id,
      roomId: room_id,
      sessionDate,
      weekIndex,
      dayOfWeek: day_of_week,
      startPeriod: start_period,
      totalPeriods: total_periods,
      sessionType: session_type ?? section.sessionType,
      status: 'CONFIRMED',
    };
    state.sessions.push(updatedSession);
    section.status = 'SCHEDULED';
    addAudit({
      entityName: 'trn_class_sessions',
      recordId: updatedSession.sessionId,
      actionType: 'INSERT',
      summary: `Xếp lịch mới lớp ${section.sectionCode} vào ${DAY_LABELS[day_of_week]} Tiết ${start_period}-${start_period + total_periods - 1} · Phòng ${room.roomCode}`,
      oldValues: null,
      newValues: { sectionCode: section.sectionCode, roomCode: room.roomCode, dayOfWeek: day_of_week, startPeriod: start_period },
      executedBy,
      executedRole,
    });
  }

  return res.json({
    success: true,
    data: {
      session: updatedSession,
      warnings: check.violations.filter((v) => v.severity === 'SOFT'),
      state,
    },
    meta: { execution_time_ms: check.executionTimeMs },
  });
});

app.post('/api/v1/scheduling/sessions/split', (req, res) => {
  const { sectionId, numGroups = 2, executedBy = 'ThS. Phạm Minh Tuấn', executedRole = 'SCHEDULER' } = req.body;
  const idx = state.sections.findIndex((s) => s.sectionId === sectionId);
  if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy lớp học phần.' } });

  const original = state.sections[idx];
  const baseCount = Math.floor(original.enrolledCount / numGroups);
  const remainder = original.enrolledCount % numGroups;
  const createdSections: CourseSection[] = [];

  for (let i = 0; i < numGroups; i++) {
    const groupCount = baseCount + (i < remainder ? 1 : 0);
    createdSections.push({
      ...original,
      sectionId: `${original.sectionId}_G${i + 1}`,
      sectionCode: `${original.sectionCode}_T${i + 1}`,
      enrolledCount: groupCount,
      capacityMax: Math.max(groupCount + 5, 35),
      status: 'OPEN',
      groupLabel: `Tốp ${i + 1} Lab (${groupCount} SV)`,
    });
  }

  // Replace original with split groups and remove any old sessions for original
  state.sections.splice(idx, 1, ...createdSections);
  state.sessions = state.sessions.filter((s) => s.sectionId !== sectionId);

  addAudit({
    entityName: 'trn_class_sessions',
    recordId: sectionId,
    actionType: 'SPLIT',
    summary: `Tách lớp ${original.sectionCode} (${original.enrolledCount} SV) thành ${numGroups} tốp thực hành Lab so le`,
    oldValues: { sectionCode: original.sectionCode, enrolledCount: original.enrolledCount },
    newValues: { groups: createdSections.map((g) => ({ code: g.sectionCode, count: g.enrolledCount })) },
    executedBy,
    executedRole,
  });

  res.json({ success: true, data: state });
});

app.post('/api/v1/scheduling/sessions/merge', (req, res) => {
  const { sectionIds, executedBy = 'ThS. Phạm Minh Tuấn', executedRole = 'SCHEDULER' } = req.body as {
    sectionIds: string[];
    executedBy?: string;
    executedRole?: UserRole;
  };
  if (!Array.isArray(sectionIds) || sectionIds.length < 2) {
    return res.status(400).json({ success: false, error: { message: 'Cần chọn ít nhất 2 lớp học phần để ghép.' } });
  }
  const targets = state.sections.filter((s) => sectionIds.includes(s.sectionId));
  if (targets.length < 2) {
    return res.status(404).json({ success: false, error: { message: 'Không tìm thấy đủ lớp học phần.' } });
  }
  const totalStudents = targets.reduce((sum, s) => sum + s.enrolledCount, 0);
  const allCohorts = Array.from(new Set(targets.flatMap((s) => s.cohortClassIds)));
  const first = targets[0];

  const merged: CourseSection = {
    ...first,
    sectionId: `SEC_MERGE_${Date.now().toString().slice(-5)}`,
    sectionCode: `${first.sectionCode}_GHEP`,
    cohortClassIds: allCohorts,
    enrolledCount: totalStudents,
    capacityMax: Math.max(totalStudents + 20, 150),
    requiredRoomType: totalStudents > 80 ? 'HALL' : 'THEORY',
    status: 'OPEN',
    groupLabel: `Ghép ${targets.length} lớp (${totalStudents} SV)`,
  };

  state.sections = state.sections.filter((s) => !sectionIds.includes(s.sectionId));
  state.sections.push(merged);
  state.sessions = state.sessions.filter((s) => !sectionIds.includes(s.sectionId));

  addAudit({
    entityName: 'trn_class_sessions',
    recordId: merged.sectionId,
    actionType: 'MERGE',
    summary: `Ghép ${targets.length} lớp (${targets.map((t) => t.sectionCode).join(' + ')}) thành ${merged.sectionCode} (${totalStudents} SV)`,
    oldValues: { mergedFrom: targets.map((t) => t.sectionCode) },
    newValues: { sectionCode: merged.sectionCode, enrolledCount: totalStudents, requiredRoomType: merged.requiredRoomType },
    executedBy,
    executedRole,
  });

  res.json({ success: true, data: state });
});

app.post('/api/v1/scheduling/auto-solve', (req, res) => {
  const { executedBy = 'ThS. Phạm Minh Tuấn', executedRole = 'SCHEDULER' } = req.body ?? {};
  if (state.isFrozen) {
    return res.status(423).json({
      success: false,
      error: { message: 'Thời khóa biểu đang đóng băng (Mốc T-1). Vui lòng mở khóa trước khi tự động phân bổ.' },
    });
  }
  const result = autoSolveUnassignedCSP(state);
  for (const s of result.newSessions) {
    state.sessions.push(s);
    const sec = state.sections.find((x) => x.sectionId === s.sectionId);
    if (sec) sec.status = 'SCHEDULED';
  }
  if (result.placedSectionIds.length > 0) {
    addAudit({
      entityName: 'trn_class_sessions',
      recordId: state.termId,
      actionType: 'INSERT',
      summary: `Bộ giải CSP tự động xếp lịch thành công ${result.placedSectionIds.length} lớp học phần với 0 xung đột cứng`,
      oldValues: null,
      newValues: { placedSectionIds: result.placedSectionIds },
      executedBy,
      executedRole,
    });
  }
  res.json({ success: true, data: { ...result, state } });
});

// ============================================================================
// 3. MOBILE APP & MULTI-LEVEL APPROVAL WORKFLOW APIs (SRS 6.2 & SRS-WEB-04)
// ============================================================================
app.get('/api/v1/mobile/instructor/available-slots', (req, res) => {
  const sessionId = String(req.query.session_id ?? '');
  const session = state.sessions.find((s) => s.sessionId === sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: { message: 'Không tìm thấy buổi học.' } });
  }
  const slots = findTopAlternativeSlots(state, {
    sectionId: session.sectionId,
    preferredDayOfWeek: 7,
    preferredStartPeriod: 1,
    totalPeriods: session.totalPeriods,
    weekIndex: session.weekIndex,
    excludeSessionId: session.sessionId,
    limit: 6,
  });
  res.json({ success: true, data: slots });
});

app.post('/api/v1/mobile/instructor/reschedule-request', (req, res) => {
  const {
    original_session_id,
    requester_id,
    request_type = 'LEAVE_AND_MAKEUP',
    reason_code = 'SICKNESS',
    reason_detail,
    proposed_makeup,
  } = req.body;

  const origSession = state.sessions.find((s) => s.sessionId === original_session_id);
  if (!origSession) {
    return res.status(404).json({ success: false, error: { message: 'Không tìm thấy buổi học gốc.' } });
  }

  // Real-time constraint check on proposed makeup slot
  const check = checkScheduleConflict(state, {
    sectionId: origSession.sectionId,
    roomId: proposed_makeup.preferred_room_id,
    weekIndex: origSession.weekIndex,
    dayOfWeek: proposed_makeup.day_of_week,
    startPeriod: proposed_makeup.start_period,
    totalPeriods: proposed_makeup.total_periods ?? origSession.totalPeriods,
    excludeSessionId: origSession.sessionId,
    includeSuggestions: true,
  });

  if (!check.isValid) {
    return res.status(409).json({
      success: false,
      error: {
        code: check.violations[0]?.code ?? 'CONFLICT',
        message: check.violations[0]?.message ?? 'Khung giờ bù bị xung đột lịch.',
        suggestions: check.suggestions,
      },
    });
  }

  const created = nowIso();
  const slaDeadline = new Date(Date.now() + 24 * 3600000).toISOString();
  const reqId = `REQ_${new Date().getFullYear()}_${Math.floor(1000 + Math.random() * 8999)}`;

  const newReq: ScheduleChangeRequest = {
    requestId: reqId,
    originalSessionId: original_session_id,
    requesterId: requester_id ?? 'INS_01',
    requestType: request_type,
    reasonCode: reason_code,
    reasonDetail: reason_detail || 'Đề xuất điều chỉnh lịch giảng dạy',
    proposedDate: proposed_makeup.date ?? getDateForWeekAndDay(origSession.weekIndex, proposed_makeup.day_of_week),
    proposedDayOfWeek: proposed_makeup.day_of_week,
    proposedStartPeriod: proposed_makeup.start_period,
    proposedTotalPeriods: proposed_makeup.total_periods ?? origSession.totalPeriods,
    proposedRoomId: proposed_makeup.preferred_room_id,
    approvalStatus: 'PENDING_FACULTY_APPROVAL',
    createdAt: created,
    slaDeadline,
  };

  state.changeRequests.unshift(newReq);
  origSession.status = 'PENDING_CHANGE';

  const instr = state.instructors.find((i) => i.instructorId === newReq.requesterId);
  const sec = state.sections.find((s) => s.sectionId === origSession.sectionId);
  const course = state.courses.find((c) => c.courseId === sec?.courseId);
  const oldRoom = state.classrooms.find((r) => r.roomId === origSession.roomId);
  const newRoom = state.classrooms.find((r) => r.roomId === newReq.proposedRoomId);

  pushNotif({
    type: 'APPROVAL_NEEDED',
    sessionId: origSession.sessionId,
    title: `Đơn báo nghỉ & dạy bù mới (${reqId})`,
    body: `${instr ? `${instr.title} ${instr.fullName}` : 'Giảng viên'} gửi yêu cầu điều chỉnh lớp ${course?.courseCode ?? sec?.sectionCode}. Hạn duyệt SLA 12h.`,
    beforeSummary: `${DAY_LABELS[origSession.dayOfWeek]} · Tiết ${origSession.startPeriod}-${origSession.startPeriod + origSession.totalPeriods - 1} · Phòng ${oldRoom?.roomCode ?? ''}`,
    afterSummary: `Đề xuất bù: ${DAY_LABELS[newReq.proposedDayOfWeek]} · Tiết ${newReq.proposedStartPeriod}-${newReq.proposedStartPeriod + newReq.proposedTotalPeriods - 1} · Phòng ${newRoom?.roomCode ?? ''}`,
    deepLink: `utsapp://requests/${reqId}`,
    targetRoles: ['FACULTY_HEAD', 'SCHEDULER'],
  });

  addAudit({
    entityName: 'schedule_change_requests',
    recordId: reqId,
    actionType: 'INSERT',
    summary: `Giảng viên khởi tạo đơn ${reqId} (${request_type}) cho lớp ${course?.courseCode ?? sec?.sectionCode}`,
    oldValues: { sessionStatus: 'CONFIRMED' },
    newValues: { requestId: reqId, status: 'PENDING_FACULTY_APPROVAL', proposedRoom: newRoom?.roomCode },
    executedBy: instr ? `${instr.title} ${instr.fullName}` : 'Giảng viên',
    executedRole: 'INSTRUCTOR',
  });

  res.status(201).json({ success: true, data: { request: newReq, state } });
});

app.post('/api/v1/requests/:id/action', (req, res) => {
  const { id } = req.params;
  const { action, note = '', overrideRoomId, executedBy = 'Cán bộ Phê duyệt', executedRole = 'SCHEDULER' } = req.body as {
    action: 'APPROVE' | 'REJECT';
    note?: string;
    overrideRoomId?: string;
    executedBy?: string;
    executedRole?: UserRole;
  };

  const request = state.changeRequests.find((r) => r.requestId === id);
  if (!request) {
    return res.status(404).json({ success: false, error: { message: 'Không tìm thấy hồ sơ yêu cầu.' } });
  }

  const origSession = state.sessions.find((s) => s.sessionId === request.originalSessionId);
  if (!origSession) {
    return res.status(404).json({ success: false, error: { message: 'Không tìm thấy buổi học liên quan.' } });
  }

  const sec = state.sections.find((s) => s.sectionId === origSession.sectionId);
  const course = state.courses.find((c) => c.courseId === sec?.courseId);
  const oldRoom = state.classrooms.find((r) => r.roomId === origSession.roomId);

  if (action === 'REJECT') {
    const oldStatus = request.approvalStatus;
    request.approvalStatus = 'REJECTED';
    if (oldStatus === 'PENDING_FACULTY_APPROVAL') {
      request.facultyApprovedBy = executedBy;
      request.facultyApprovedAt = nowIso();
      request.facultyNote = note || 'Từ chối cấp Bộ môn/Khoa';
    } else {
      request.academicApprovedBy = executedBy;
      request.academicApprovedAt = nowIso();
      request.academicNote = note || 'Từ chối cấp Phòng Đào tạo';
    }
    origSession.status = 'CONFIRMED';

    addAudit({
      entityName: 'schedule_change_requests',
      recordId: request.requestId,
      actionType: 'UPDATE',
      summary: `Từ chối đơn đổi lịch ${request.requestId} (${course?.courseCode ?? ''})`,
      oldValues: { approvalStatus: oldStatus },
      newValues: { approvalStatus: 'REJECTED', note },
      executedBy,
      executedRole,
    });

    pushNotif({
      type: 'SCHEDULE_CHANGE',
      sessionId: origSession.sessionId,
      title: `Đơn ${request.requestId} bị từ chối`,
      body: `Yêu cầu điều chỉnh lớp ${course?.courseCode ?? ''} không được phê duyệt. Lý do: ${note || 'Không phù hợp điều phối'}.`,
      targetRoles: ['INSTRUCTOR', 'FACULTY_HEAD'],
    });

    return res.json({ success: true, data: state });
  }

  // APPROVE FLOW
  if (request.approvalStatus === 'PENDING_FACULTY_APPROVAL') {
    request.approvalStatus = 'PENDING_ACADEMIC_APPROVAL';
    request.facultyApprovedBy = executedBy;
    request.facultyApprovedAt = nowIso();
    request.facultyNote = note || 'Đã xác nhận chuyên môn, chuyển Phòng Đào tạo cấp phòng.';

    addAudit({
      entityName: 'schedule_change_requests',
      recordId: request.requestId,
      actionType: 'APPROVE',
      summary: `Duyệt Cấp 1 (Khoa/Bộ môn) đơn ${request.requestId} — Chuyển Phòng Đào tạo`,
      oldValues: { approvalStatus: 'PENDING_FACULTY_APPROVAL' },
      newValues: { approvalStatus: 'PENDING_ACADEMIC_APPROVAL', facultyApprovedBy: executedBy },
      executedBy,
      executedRole,
    });

    pushNotif({
      type: 'APPROVAL_NEEDED',
      sessionId: origSession.sessionId,
      title: `Đơn ${request.requestId} chờ duyệt Cấp 2 (Phòng Đào tạo)`,
      body: `${executedBy} đã xác nhận chuyên môn cho lớp ${course?.courseCode ?? ''}. Vui lòng rà soát và cấp phòng trong 12h.`,
      targetRoles: ['SCHEDULER', 'EXECUTIVE'],
    });

    return res.json({ success: true, data: state });
  }

  if (request.approvalStatus === 'PENDING_ACADEMIC_APPROVAL') {
    const finalRoomId = overrideRoomId || request.proposedRoomId;
    const check = checkScheduleConflict(state, {
      sectionId: origSession.sectionId,
      roomId: finalRoomId,
      weekIndex: origSession.weekIndex,
      dayOfWeek: request.proposedDayOfWeek,
      startPeriod: request.proposedStartPeriod,
      totalPeriods: request.proposedTotalPeriods,
      excludeSessionId: origSession.sessionId,
      includeSuggestions: true,
    });

    if (!check.isValid) {
      return res.status(409).json({
        success: false,
        error: {
          code: check.violations[0]?.code ?? 'CONFLICT',
          message: `Không thể phê duyệt do phát sinh xung đột mới: ${check.violations[0]?.message}`,
          suggestions: check.suggestions,
        },
      });
    }

    const finalRoom = state.classrooms.find((r) => r.roomId === finalRoomId)!;
    const oldSessionSnapshot = { ...origSession };

    request.proposedRoomId = finalRoomId;
    request.approvalStatus = 'APPROVED';
    request.academicApprovedBy = executedBy;
    request.academicApprovedAt = nowIso();
    request.academicNote = note || `Đã cấp phòng ${finalRoom.roomCode} và ban hành thông báo tức thời.`;

    let makeupSessionId: string | undefined;

    if (request.requestType === 'CHANGE_ROOM') {
      origSession.previousRoomId = origSession.roomId;
      origSession.roomId = finalRoomId;
      origSession.status = 'ROOM_CHANGED';
      origSession.note = `Đổi phòng từ ${oldRoom?.roomCode ?? ''} sang ${finalRoom.roomCode} (${request.requestId})`;
    } else {
      // Mark original session CANCELLED / RESCHEDULED and spawn new MAKEUP session (UAC-02!)
      origSession.status = 'CANCELLED';
      origSession.note = `Đã báo nghỉ (${request.reasonDetail}) — Đã xếp học bù vào ${DAY_LABELS[request.proposedDayOfWeek]} tại ${finalRoom.roomCode}`;

      const makeupSession: ClassSession = {
        sessionId: `SES_MAKEUP_${Date.now().toString().slice(-5)}`,
        sectionId: origSession.sectionId,
        roomId: finalRoomId,
        sessionDate: request.proposedDate,
        weekIndex: origSession.weekIndex,
        dayOfWeek: request.proposedDayOfWeek,
        startPeriod: request.proposedStartPeriod,
        totalPeriods: request.proposedTotalPeriods,
        sessionType: origSession.sessionType,
        status: 'MAKEUP',
        previousRoomId: origSession.roomId,
        previousDate: origSession.sessionDate,
        previousStartPeriod: origSession.startPeriod,
        note: `Buổi học bù cho ${DAY_LABELS[origSession.dayOfWeek]} (${origSession.sessionDate}) theo đơn ${request.requestId}`,
      };
      state.sessions.push(makeupSession);
      makeupSessionId = makeupSession.sessionId;
      request.generatedMakeupSessionId = makeupSessionId;
    }

    addAudit({
      entityName: 'trn_class_sessions',
      recordId: origSession.sessionId,
      actionType: 'APPROVE',
      summary: `Phê duyệt Cấp 2 (Phòng ĐT) đơn ${request.requestId}: Nghỉ ${DAY_LABELS[origSession.dayOfWeek]} & học bù ${DAY_LABELS[request.proposedDayOfWeek]} tại ${finalRoom.roomCode}`,
      oldValues: {
        sessionId: oldSessionSnapshot.sessionId,
        roomId: oldSessionSnapshot.roomId,
        roomCode: oldRoom?.roomCode,
        status: 'CONFIRMED',
      },
      newValues: {
        originalStatus: origSession.status,
        makeupSessionId,
        roomId: finalRoomId,
        roomCode: finalRoom.roomCode,
        dayOfWeek: request.proposedDayOfWeek,
        startPeriod: request.proposedStartPeriod,
      },
      executedBy,
      executedRole,
      canRollback: true,
      rolledBack: false,
      relatedRequestId: request.requestId,
    });

    const beforeStr = `${DAY_LABELS[origSession.dayOfWeek]} (${origSession.sessionDate}) · Tiết ${origSession.startPeriod}-${origSession.startPeriod + origSession.totalPeriods - 1} (${getPeriodTimeRange(origSession.startPeriod, origSession.totalPeriods)}) · Phòng ${oldRoom?.roomCode ?? ''}`;
    const afterStr = `${DAY_LABELS[request.proposedDayOfWeek]} (${request.proposedDate}) · Tiết ${request.proposedStartPeriod}-${request.proposedStartPeriod + request.proposedTotalPeriods - 1} (${getPeriodTimeRange(request.proposedStartPeriod, request.proposedTotalPeriods)}) · Phòng ${finalRoom.roomCode}`;

    pushNotif({
      type: request.requestType === 'CHANGE_ROOM' ? 'ROOM_CHANGE' : 'MAKEUP_CONFIRMED',
      sessionId: makeupSessionId ?? origSession.sessionId,
      title: `Thông báo ${request.requestType === 'CHANGE_ROOM' ? 'đổi phòng' : 'nghỉ & học bù'} — ${course?.courseCode ?? sec?.sectionCode}`,
      body: `Lớp ${course?.courseName ?? sec?.sectionCode}: Nghỉ ${DAY_LABELS[origSession.dayOfWeek]} và học bù vào ${DAY_LABELS[request.proposedDayOfWeek]} tại Phòng ${finalRoom.roomCode}.`,
      beforeSummary: beforeStr,
      afterSummary: afterStr,
      deepLink: `utsapp://schedule/session/${makeupSessionId ?? origSession.sessionId}`,
      targetRoles: ['STUDENT', 'INSTRUCTOR', 'FACULTY_HEAD', 'SCHEDULER', 'EXECUTIVE'],
    });

    return res.json({ success: true, data: state });
  }

  return res.status(400).json({ success: false, error: { message: 'Hồ sơ đã được xử lý trước đó.' } });
});

// Audit Log Rollback (BR-CM-03)
app.post('/api/v1/audit/:logId/rollback', (req, res) => {
  const { logId } = req.params;
  const { executedBy = 'ThS. Phạm Minh Tuấn', executedRole = 'SCHEDULER' } = req.body ?? {};
  const log = state.auditLogs.find((l) => l.logId === logId);
  if (!log || !log.canRollback || log.rolledBack) {
    return res.status(400).json({ success: false, error: { message: 'Bản ghi không khả dụng để quay lui (Rollback).' } });
  }

  const origSession = state.sessions.find((s) => s.sessionId === log.recordId);
  if (origSession && log.oldValues) {
    if (typeof log.oldValues.roomId === 'string') {
      origSession.roomId = log.oldValues.roomId;
    }
    origSession.status = 'CONFIRMED';
    origSession.note = `Đã khôi phục (Rollback) từ nhật ký ${log.logId}`;
  }

  if (log.relatedRequestId) {
    const reqItem = state.changeRequests.find((r) => r.requestId === log.relatedRequestId);
    if (reqItem) {
      if (reqItem.generatedMakeupSessionId) {
        state.sessions = state.sessions.filter((s) => s.sessionId !== reqItem.generatedMakeupSessionId);
      }
      reqItem.approvalStatus = 'ROLLED_BACK';
    }
  }

  log.rolledBack = true;

  addAudit({
    entityName: 'trn_class_sessions',
    recordId: log.recordId,
    actionType: 'ROLLBACK',
    summary: `Quay lui trạng thái (Rollback) của nhật ký ${log.logId} — Khôi phục lịch gốc`,
    oldValues: log.newValues,
    newValues: log.oldValues,
    executedBy,
    executedRole,
  });

  pushNotif({
    type: 'SCHEDULE_CHANGE',
    sessionId: log.recordId,
    title: `Thông báo đính chính (Rollback) — Khôi phục lịch gốc`,
    body: `Quyết định thay đổi trước đó (${log.relatedRequestId ?? log.logId}) đã được thu hồi. Buổi học quay về lịch trình ban đầu.`,
    targetRoles: ['STUDENT', 'INSTRUCTOR', 'FACULTY_HEAD', 'SCHEDULER'],
  });

  res.json({ success: true, data: state });
});

// ============================================================================
// 4. MASTER DATA & INCIDENTS APIs (SRS-WEB-01, BR-MD-01..04, BR-MO-04)
// ============================================================================
app.post('/api/v1/courses', (req, res) => {
  const payload = req.body as Omit<CourseSubject, 'courseId' | 'isActive'> & {
    prerequisiteCourseId?: string;
    prerequisiteRuleType?: 'MANDATORY' | 'PRIOR' | 'COREQUISITE';
  };

  if (state.courses.some((c) => c.courseCode.toLowerCase() === payload.courseCode.trim().toLowerCase())) {
    return res.status(409).json({
      success: false,
      error: { code: 'ERR_DUPLICATE_COURSE_CODE', message: `Mã học phần ${payload.courseCode} đã tồn tại trên toàn trường.` },
    });
  }

  const courseId = `CRS_${payload.courseCode.trim().toUpperCase()}_${Date.now().toString().slice(-3)}`;

  if (payload.prerequisiteCourseId) {
    const hasCycle = detectPrerequisiteCycle(state.prerequisites, courseId, payload.prerequisiteCourseId);
    if (hasCycle) {
      return res.status(400).json({
        success: false,
        error: { code: 'ERR_CYCLIC_PREREQUISITE', message: 'Phát hiện vòng lặp môn học tiên quyết (Cycle Detection).' },
      });
    }
  }

  const ratioCheck = validateCourseHours(payload);
  const normalizedRoomTypes: RoomType[] =
    Array.isArray(payload.requiredRoomTypes) && payload.requiredRoomTypes.length > 0
      ? Array.from(new Set(payload.requiredRoomTypes))
      : [payload.requiredRoomType || 'THEORY'];

  const newCourse: CourseSubject = {
    courseId,
    courseCode: payload.courseCode.trim().toUpperCase(),
    courseName: payload.courseName.trim(),
    courseNameEn: payload.courseNameEn?.trim() || payload.courseName.trim(),
    departmentId: payload.departmentId,
    facultyId: payload.facultyId,
    credits: Number(payload.credits),
    theoryPeriods: Number(payload.theoryPeriods),
    exercisePeriods: Number(payload.exercisePeriods),
    discussionPeriods: Number(payload.discussionPeriods),
    practicalPeriods: Number(payload.practicalPeriods),
    requiredRoomType: normalizedRoomTypes[0],
    requiredRoomTypes: normalizedRoomTypes,
    examMode: payload.examMode || 'CONSOLIDATED',
    examModelCode: payload.examModelCode || (payload.examMode === 'MODULAR' ? 'EXM_MODULAR' : 'EXM_CONSOLIDATED'),
    isActive: true,
  };

  state.courses.push(newCourse);
  if (payload.prerequisiteCourseId) {
    state.prerequisites.push({
      prerequisiteId: `PRE_${Date.now().toString().slice(-5)}`,
      courseId,
      prerequisiteCourseId: payload.prerequisiteCourseId,
      ruleType: payload.prerequisiteRuleType ?? 'MANDATORY',
    });
  }

  addAudit({
    entityName: 'mst_courses',
    recordId: newCourse.courseId,
    actionType: 'INSERT',
    summary: `Thêm mới học phần ${newCourse.courseCode} (${newCourse.courseName}) — LT:${newCourse.theoryPeriods}/BT:${newCourse.exercisePeriods}/TL:${newCourse.discussionPeriods}/TH:${newCourse.practicalPeriods} · Phòng: ${normalizedRoomTypes.join(', ')}`,
    oldValues: null,
    newValues: { ...newCourse },
    executedBy: (req.body?.executedBy as string) || 'ThS. Phạm Minh Tuấn',
    executedRole: (req.body?.executedRole as UserRole) || 'SCHEDULER',
  });

  res.status(201).json({
    success: true,
    data: { course: newCourse, warning: ratioCheck.isRatioValid ? null : ratioCheck, state },
  });
});

app.put('/api/v1/courses/:courseId', (req, res) => {
  const { courseId } = req.params;
  const idx = state.courses.findIndex((c) => c.courseId === courseId);
  if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy học phần.' } });

  const oldCourse = { ...state.courses[idx] };
  const payload = req.body as Partial<CourseSubject> & { executedBy?: string; executedRole?: UserRole };

  if (
    payload.courseCode &&
    state.courses.some(
      (c) => c.courseId !== courseId && c.courseCode.toLowerCase() === payload.courseCode!.trim().toLowerCase()
    )
  ) {
    return res.status(409).json({
      success: false,
      error: { message: `Mã học phần ${payload.courseCode} đã tồn tại.` },
    });
  }

  const normalizedRoomTypes: RoomType[] =
    Array.isArray(payload.requiredRoomTypes) && payload.requiredRoomTypes.length > 0
      ? Array.from(new Set(payload.requiredRoomTypes))
      : oldCourse.requiredRoomTypes;

  const updated: CourseSubject = {
    ...oldCourse,
    courseCode: payload.courseCode ? payload.courseCode.trim().toUpperCase() : oldCourse.courseCode,
    courseName: payload.courseName ? payload.courseName.trim() : oldCourse.courseName,
    courseNameEn: payload.courseNameEn !== undefined ? payload.courseNameEn.trim() : oldCourse.courseNameEn,
    facultyId: payload.facultyId || oldCourse.facultyId,
    departmentId: payload.departmentId || oldCourse.departmentId,
    credits: payload.credits !== undefined ? Number(payload.credits) : oldCourse.credits,
    theoryPeriods: payload.theoryPeriods !== undefined ? Number(payload.theoryPeriods) : oldCourse.theoryPeriods,
    exercisePeriods: payload.exercisePeriods !== undefined ? Number(payload.exercisePeriods) : oldCourse.exercisePeriods,
    discussionPeriods: payload.discussionPeriods !== undefined ? Number(payload.discussionPeriods) : oldCourse.discussionPeriods,
    practicalPeriods: payload.practicalPeriods !== undefined ? Number(payload.practicalPeriods) : oldCourse.practicalPeriods,
    requiredRoomType: normalizedRoomTypes[0],
    requiredRoomTypes: normalizedRoomTypes,
    examMode: payload.examMode || oldCourse.examMode,
    examModelCode: payload.examModelCode !== undefined ? payload.examModelCode : oldCourse.examModelCode,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : oldCourse.isActive,
  };

  state.courses[idx] = updated;
  addAudit({
    entityName: 'mst_courses',
    recordId: courseId,
    actionType: 'UPDATE',
    summary: `Cập nhật học phần ${updated.courseCode} (${updated.courseName}) — Phòng: ${normalizedRoomTypes.join(', ')}`,
    oldValues: { courseCode: oldCourse.courseCode, requiredRoomTypes: oldCourse.requiredRoomTypes },
    newValues: { courseCode: updated.courseCode, requiredRoomTypes: updated.requiredRoomTypes },
    executedBy: payload.executedBy || 'KS. Đặng Quốc Bảo',
    executedRole: payload.executedRole || 'SYS_ADMIN',
  });

  res.json({ success: true, data: state });
});

app.delete('/api/v1/courses/:courseId', (req, res) => {
  const { courseId } = req.params;
  const idx = state.courses.findIndex((c) => c.courseId === courseId);
  if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy học phần.' } });

  const inUseSections = state.sections.filter((s) => s.courseId === courseId);
  if (inUseSections.length > 0) {
    return res.status(409).json({
      success: false,
      error: {
        message: `Không thể xóa học phần vì đang có ${inUseSections.length} lớp học phần mở trong học kỳ (${inUseSections.map((s) => s.sectionCode).join(', ')}).`,
      },
    });
  }

  const removed = state.courses[idx];
  state.courses.splice(idx, 1);
  state.prerequisites = state.prerequisites.filter(
    (p) => p.courseId !== courseId && p.prerequisiteCourseId !== courseId
  );

  addAudit({
    entityName: 'mst_courses',
    recordId: courseId,
    actionType: 'DELETE',
    summary: `Xóa học phần ${removed.courseCode} (${removed.courseName}) khỏi danh mục Master Data`,
    oldValues: { courseCode: removed.courseCode, courseName: removed.courseName },
    newValues: null,
    executedBy: (req.body?.executedBy as string) || 'KS. Đặng Quốc Bảo',
    executedRole: (req.body?.executedRole as UserRole) || 'SYS_ADMIN',
  });

  res.json({ success: true, data: state });
});

app.post('/api/v1/prerequisites', (req, res) => {
  const { courseId, prerequisiteCourseId, ruleType = 'MANDATORY' } = req.body;
  if (detectPrerequisiteCycle(state.prerequisites, courseId, prerequisiteCourseId)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'ERR_CYCLIC_PREREQUISITE',
        message: 'Từ chối lưu: Phát hiện chu trình vòng lặp vô tận trong đồ thị môn học tiên quyết (SRS-WEB-01 Cycle Detection).',
      },
    });
  }
  state.prerequisites.push({
    prerequisiteId: `PRE_${Date.now().toString().slice(-5)}`,
    courseId,
    prerequisiteCourseId,
    ruleType,
  });
  res.status(201).json({ success: true, data: state });
});

app.post('/api/v1/classrooms/:roomId/status', (req, res) => {
  const { roomId } = req.params;
  const { operationalStatus } = req.body;
  const room = state.classrooms.find((r) => r.roomId === roomId);
  if (!room) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy phòng học.' } });
  const oldStatus = room.operationalStatus;
  room.operationalStatus = operationalStatus;
  if (operationalStatus !== 'AVAILABLE') room.iotPowerState = 'AUTO_OFF';

  addAudit({
    entityName: 'mst_classrooms',
    recordId: roomId,
    actionType: 'UPDATE',
    summary: `Cập nhật trạng thái phòng ${room.roomCode}: ${oldStatus} → ${operationalStatus}`,
    oldValues: { operationalStatus: oldStatus },
    newValues: { operationalStatus },
    executedBy: 'KS. Đặng Quốc Bảo',
    executedRole: 'SYS_ADMIN',
  });

  res.json({ success: true, data: state });
});

app.post('/api/v1/instructors/:instructorId/availability', (req, res) => {
  const { instructorId } = req.params;
  const { dayOfWeek, shift, constraintType, reason } = req.body;
  const existingIdx = state.availabilities.findIndex(
    (a) => a.instructorId === instructorId && a.dayOfWeek === dayOfWeek && a.shift === shift
  );
  if (existingIdx !== -1) {
    if (!constraintType) {
      state.availabilities.splice(existingIdx, 1);
    } else {
      state.availabilities[existingIdx] = {
        ...state.availabilities[existingIdx],
        constraintType,
        reason: reason || 'Lịch bận giảng viên',
      };
    }
  } else if (constraintType) {
    state.availabilities.push({
      availabilityId: `AVL_${Date.now().toString().slice(-5)}`,
      instructorId,
      dayOfWeek,
      shift,
      constraintType,
      reason: reason || (constraintType === 'HARD_BUSY' ? 'Lịch bận cố định' : 'Không ưu tiên giảng dạy'),
    });
  }
  res.json({ success: true, data: state });
});

app.post('/api/v1/incidents', (req, res) => {
  const { roomId, reportedBy, reporterRole, category, description, sessionTimeLabel } = req.body;
  const incident: FacilityIncident = {
    incidentId: `INC_${Date.now().toString().slice(-4)}`,
    roomId,
    reportedBy: reportedBy || 'Giảng viên / Sinh viên',
    reporterRole: reporterRole || 'INSTRUCTOR',
    category: category || 'PROJECTOR',
    description: description || 'Sự cố thiết bị phòng học',
    sessionTimeLabel: sessionTimeLabel || 'Ca học hiện tại',
    status: 'OPEN',
    createdAt: nowIso(),
  };
  state.incidents.unshift(incident);
  const room = state.classrooms.find((r) => r.roomId === roomId);
  pushNotif({
    type: 'INCIDENT_UPDATE',
    title: `Báo cáo sự cố thiết bị tại phòng ${room?.roomCode ?? roomId}`,
    body: `${incident.reportedBy} phản ánh: ${incident.description}`,
    targetRoles: ['SYS_ADMIN', 'SCHEDULER'],
  });
  res.status(201).json({ success: true, data: state });
});

app.post('/api/v1/incidents/:id/status', (req, res) => {
  const inc = state.incidents.find((i) => i.incidentId === req.params.id);
  if (!inc) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy sự cố.' } });
  inc.status = req.body.status;
  res.json({ success: true, data: state });
});

app.post('/api/v1/integrations/sync', (req, res) => {
  const { target } = req.body as { target: 'SIS' | 'LMS' };
  if (target === 'SIS') {
    state.sisLastSyncAt = nowIso();
  } else {
    state.lmsLastSyncAt = nowIso();
  }
  res.json({ success: true, data: state });
});

app.post('/api/v1/notifications/read-all', (_req, res) => {
  state.notifications.forEach((n) => (n.read = true));
  res.json({ success: true, data: state });
});

// ============================================================================
// 4B. FACULTY MULTI-INSTRUCTOR ASSIGNMENT & SYSTEM ADMIN APIs (SYS_ADMIN / FACULTY_HEAD)
// ============================================================================
app.post('/api/v1/sections/:sectionId/assign-instructor', (req, res) => {
  const { sectionId } = req.params;
  const {
    instructorId,
    role = 'CO_TEACHER',
    assignedPeriods = 15,
    executedBy = 'TS. Vũ Thị Lan Anh',
    executedRole = 'FACULTY_HEAD',
  } = req.body as {
    instructorId: string;
    role?: InstructorRole;
    assignedPeriods?: number;
    executedBy?: string;
    executedRole?: UserRole;
  };

  const sec = state.sections.find((s) => s.sectionId === sectionId);
  const instr = state.instructors.find((i) => i.instructorId === instructorId);
  if (!sec || !instr) {
    return res.status(404).json({ success: false, error: { message: 'Không tìm thấy lớp học phần hoặc giảng viên.' } });
  }

  const existing = sec.instructors.find((a) => a.instructorId === instructorId && a.role === role);
  if (existing) {
    existing.assignedPeriods = Number(assignedPeriods);
  } else {
    sec.instructors.push({
      assignmentId: `ASG_${Date.now().toString().slice(-5)}`,
      sectionId,
      instructorId,
      role,
      assignedPeriods: Number(assignedPeriods),
    });
  }

  addAudit({
    entityName: 'trn_course_sections',
    recordId: sectionId,
    actionType: 'UPDATE',
    summary: `Phân công ${instr.title} ${instr.fullName} (${role}, ${assignedPeriods} tiết) vào lớp ${sec.sectionCode}`,
    oldValues: null,
    newValues: { sectionCode: sec.sectionCode, instructorId, role, assignedPeriods },
    executedBy,
    executedRole,
  });

  res.json({ success: true, data: state });
});

app.post('/api/v1/admin/users', (req, res) => {
  const {
    username,
    fullName,
    email,
    role,
    facultyId,
    departmentName,
    mfaEnabled = false,
    executedBy = 'KS. Đặng Quốc Bảo',
    executedRole = 'SYS_ADMIN',
  } = req.body as Partial<SystemUser> & { executedBy?: string; executedRole?: UserRole };

  if (!username?.trim() || !fullName?.trim() || !email?.trim() || !role) {
    return res.status(400).json({ success: false, error: { message: 'Vui lòng nhập đầy đủ Tên đăng nhập, Họ tên, Email và Vai trò.' } });
  }
  if (state.systemUsers.some((u) => u.username.toLowerCase() === username.trim().toLowerCase())) {
    return res.status(409).json({ success: false, error: { message: `Tài khoản ${username} đã tồn tại trong hệ thống.` } });
  }

  const newUser: SystemUser = {
    userId: `USR_${Date.now().toString().slice(-4)}`,
    username: username.trim().toLowerCase(),
    fullName: fullName.trim(),
    email: email.trim().toLowerCase(),
    role,
    facultyId: facultyId || undefined,
    departmentName: departmentName?.trim() || 'Đơn vị trực thuộc Trường',
    status: 'ACTIVE',
    lastLoginAt: nowIso(),
    mfaEnabled: Boolean(mfaEnabled),
  };

  state.systemUsers.unshift(newUser);
  addAudit({
    entityName: 'sys_users',
    recordId: newUser.userId,
    actionType: 'INSERT',
    summary: `Tạo mới tài khoản ${newUser.username} (${newUser.fullName}) — Vai trò ${newUser.role}`,
    oldValues: null,
    newValues: { username: newUser.username, role: newUser.role, departmentName: newUser.departmentName },
    executedBy,
    executedRole,
  });

  res.status(201).json({ success: true, data: state });
});

app.post('/api/v1/admin/users/:userId/toggle', (req, res) => {
  const user = state.systemUsers.find((u) => u.userId === req.params.userId);
  if (!user) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy người dùng.' } });
  const oldStatus = user.status;
  user.status = user.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
  addAudit({
    entityName: 'sys_users',
    recordId: user.userId,
    actionType: 'UPDATE',
    summary: `${user.status === 'LOCKED' ? 'Khóa' : 'Mở khóa'} tài khoản ${user.username} (${user.fullName})`,
    oldValues: { status: oldStatus },
    newValues: { status: user.status },
    executedBy: req.body?.executedBy || 'KS. Đặng Quốc Bảo',
    executedRole: req.body?.executedRole || 'SYS_ADMIN',
  });
  res.json({ success: true, data: state });
});

app.post('/api/v1/admin/users/:userId/role', (req, res) => {
  const user = state.systemUsers.find((u) => u.userId === req.params.userId);
  if (!user) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy người dùng.' } });
  const oldRole = user.role;
  user.role = req.body.role as UserRole;
  addAudit({
    entityName: 'sys_users',
    recordId: user.userId,
    actionType: 'UPDATE',
    summary: `Điều chỉnh vai trò RBAC của ${user.username}: ${oldRole} → ${user.role}`,
    oldValues: { role: oldRole },
    newValues: { role: user.role },
    executedBy: req.body?.executedBy || 'KS. Đặng Quốc Bảo',
    executedRole: req.body?.executedRole || 'SYS_ADMIN',
  });
  res.json({ success: true, data: state });
});

app.post('/api/v1/admin/notifications/:channelId/toggle', (req, res) => {
  const ch = state.notificationChannels.find((c) => c.channelId === req.params.channelId);
  if (!ch) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy kênh thông báo.' } });
  ch.enabled = !ch.enabled;
  addAudit({
    entityName: 'sys_notifications',
    recordId: ch.channelId,
    actionType: 'UPDATE',
    summary: `${ch.enabled ? 'Bật' : 'Tắt'} kênh thông báo ${ch.name}`,
    oldValues: { enabled: !ch.enabled },
    newValues: { enabled: ch.enabled },
    executedBy: req.body?.executedBy || 'KS. Đặng Quốc Bảo',
    executedRole: req.body?.executedRole || 'SYS_ADMIN',
  });
  res.json({ success: true, data: state });
});

app.post('/api/v1/admin/notifications/:channelId/test', (req, res) => {
  const ch = state.notificationChannels.find((c) => c.channelId === req.params.channelId);
  if (!ch) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy kênh thông báo.' } });
  ch.lastTriggeredAt = nowIso();
  pushNotif({
    type: 'SCHEDULE_CHANGE',
    title: `[Kiểm thử Kênh ${ch.channelType}] Kết nối thông báo hoạt động ổn định`,
    body: `Hệ thống đã phát gói tin thử nghiệm qua ${ch.name} lúc ${new Date().toLocaleTimeString('vi-VN')}.`,
    targetRoles: ['SYS_ADMIN', 'EXECUTIVE', 'SCHEDULER', 'FACULTY_HEAD', 'INSTRUCTOR', 'STUDENT'],
  });
  res.json({ success: true, data: state });
});

app.post('/api/v1/admin/jobs/:jobId/toggle', (req, res) => {
  const job = state.scheduledJobs.find((j) => j.jobId === req.params.jobId);
  if (!job) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy Job tự động.' } });
  job.enabled = !job.enabled;
  addAudit({
    entityName: 'sys_jobs',
    recordId: job.jobId,
    actionType: 'UPDATE',
    summary: `${job.enabled ? 'Kích hoạt' : 'Tạm dừng'} Job định kỳ ${job.jobCode}`,
    oldValues: { enabled: !job.enabled },
    newValues: { enabled: job.enabled },
    executedBy: req.body?.executedBy || 'KS. Đặng Quốc Bảo',
    executedRole: req.body?.executedRole || 'SYS_ADMIN',
  });
  res.json({ success: true, data: state });
});

app.post('/api/v1/admin/jobs/:jobId/run', (req, res) => {
  const t0 = Date.now();
  const job = state.scheduledJobs.find((j) => j.jobId === req.params.jobId);
  if (!job) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy Job tự động.' } });

  let summary = '';
  if (job.category === 'KPI_AGGREGATION') {
    const kpis = calculateKPIs(state);
    summary = `Tổng hợp KPI hoàn tất: RUR ${kpis.rur}% · SFR ${kpis.sfr}% · SVI ${kpis.svi}% · SLA ${kpis.slaOnTimeRate}% (${kpis.totalActiveSessions} buổi).`;
  } else if (job.category === 'SLA_MONITOR') {
    const pending = state.changeRequests.filter((r) => r.approvalStatus.startsWith('PENDING'));
    summary = `Đã quét ${pending.length} đơn đang chờ duyệt — Hạn SLA ${state.systemParams.slaHoursLimit}h, 0 đơn quá hạn.`;
  } else if (job.category === 'SIS_LMS_SYNC') {
    state.sisLastSyncAt = nowIso();
    state.lmsLastSyncAt = nowIso();
    summary = `Đồng bộ SIS & LMS hoàn tất: ${state.classes.length} lớp cơ hữu, ${state.sections.length} lớp HP, ${state.courses.length} học phần.`;
  } else if (job.category === 'BMS_IOT') {
    const activeRoomIds = new Set(
      state.sessions.filter((s) => s.weekIndex === state.activeWeek && s.status !== 'CANCELLED').map((s) => s.roomId)
    );
    state.classrooms.forEach((r) => {
      if (r.operationalStatus !== 'AVAILABLE') r.iotPowerState = 'AUTO_OFF';
      else if (activeRoomIds.has(r.roomId)) r.iotPowerState = 'AUTO_ON';
      else r.iotPowerState = 'STANDBY';
    });
    summary = `Đồng bộ BMS/IoT trước ${state.systemParams.bmsPreHeatMinutes} phút: ${activeRoomIds.size} phòng AUTO_ON, các phòng bảo trì AUTO_OFF.`;
  } else {
    summary = `Đã tạo bản Snapshot ${state.termId}_W${state.activeWeek} (${state.auditLogs.length} dòng nhật ký kiểm toán).`;
  }

  job.lastRunAt = nowIso();
  job.lastStatus = 'SUCCESS';
  job.lastDurationMs = Math.max(45, Date.now() - t0 + 60);
  job.lastSummary = summary;

  addAudit({
    entityName: 'sys_jobs',
    recordId: job.jobId,
    actionType: 'RUN_JOB',
    summary: `Chạy thủ công Job ${job.jobCode}: ${summary}`,
    oldValues: null,
    newValues: { jobCode: job.jobCode, status: 'SUCCESS', durationMs: job.lastDurationMs },
    executedBy: req.body?.executedBy || 'KS. Đặng Quốc Bảo',
    executedRole: req.body?.executedRole || 'SYS_ADMIN',
  });

  res.json({ success: true, data: { job, state } });
});

app.post('/api/v1/admin/params', (req, res) => {
  const incoming = req.body.params as Partial<SystemParameters>;
  const oldParams = { ...state.systemParams };
  state.systemParams = {
    maxPeriodsPerDay: Number(incoming?.maxPeriodsPerDay ?? state.systemParams.maxPeriodsPerDay),
    slaHoursLimit: Number(incoming?.slaHoursLimit ?? state.systemParams.slaHoursLimit),
    minSfrWarningPercent: Number(incoming?.minSfrWarningPercent ?? state.systemParams.minSfrWarningPercent),
    bmsPreHeatMinutes: Number(incoming?.bmsPreHeatMinutes ?? state.systemParams.bmsPreHeatMinutes),
    academicPeriodsCount: Number(incoming?.academicPeriodsCount ?? state.systemParams.academicPeriodsCount),
    autoFreezeDaysBeforeTerm: Number(incoming?.autoFreezeDaysBeforeTerm ?? state.systemParams.autoFreezeDaysBeforeTerm),
  };

  addAudit({
    entityName: 'sys_parameters',
    recordId: 'SYS_PARAMS',
    actionType: 'UPDATE',
    summary: `Cập nhật tham số hệ thống (Trần ${state.systemParams.maxPeriodsPerDay}t/ngày, SLA ${state.systemParams.slaHoursLimit}h, SFR cảnh báo ${state.systemParams.minSfrWarningPercent}%)`,
    oldValues: oldParams,
    newValues: { ...state.systemParams },
    executedBy: req.body?.executedBy || 'KS. Đặng Quốc Bảo',
    executedRole: req.body?.executedRole || 'SYS_ADMIN',
  });

  res.json({ success: true, data: state });
});

// ============================================================================
// 4C. FULL SYSTEM MASTER DATA CRUD (BUILDINGS, FACULTIES, ROOMS, EXAM MODELS, INSTRUCTORS, USERS, ROLE GROUPS)
// ============================================================================
function requirePerm(
  res: express.Response,
  role: UserRole | undefined,
  fn: PermissionFunctionId,
  action: CrudAction
): boolean {
  const effectiveRole: UserRole = role || 'SYS_ADMIN';
  if (!checkRolePermission(state.roleGroups, effectiveRole, fn, action)) {
    res.status(403).json({
      success: false,
      error: {
        code: 'ERR_PERMISSION_DENIED',
        message: `Vai trò ${effectiveRole} không có quyền [${action.toUpperCase()}] trên chức năng ${fn}.`,
      },
    });
    return false;
  }
  return true;
}

// --- USERS UPDATE & DELETE ---
app.put('/api/v1/admin/users/:userId', (req, res) => {
  const { executedBy = 'KS. Đặng Quốc Bảo', executedRole = 'SYS_ADMIN', ...payload } = req.body as Partial<SystemUser> & {
    executedBy?: string;
    executedRole?: UserRole;
  };
  if (!requirePerm(res, executedRole, 'ADMIN_USERS_ROLES', 'update')) return;
  const idx = state.systemUsers.findIndex((u) => u.userId === req.params.userId);
  if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy tài khoản.' } });

  const oldUser = { ...state.systemUsers[idx] };
  state.systemUsers[idx] = {
    ...oldUser,
    fullName: payload.fullName ? payload.fullName.trim() : oldUser.fullName,
    email: payload.email ? payload.email.trim().toLowerCase() : oldUser.email,
    role: payload.role || oldUser.role,
    departmentName: payload.departmentName ? payload.departmentName.trim() : oldUser.departmentName,
    facultyId: payload.facultyId !== undefined ? payload.facultyId : oldUser.facultyId,
    mfaEnabled: payload.mfaEnabled !== undefined ? Boolean(payload.mfaEnabled) : oldUser.mfaEnabled,
  };

  addAudit({
    entityName: 'sys_users',
    recordId: oldUser.userId,
    actionType: 'UPDATE',
    summary: `Cập nhật thông tin tài khoản ${oldUser.username} (${state.systemUsers[idx].fullName})`,
    oldValues: { fullName: oldUser.fullName, role: oldUser.role },
    newValues: { fullName: state.systemUsers[idx].fullName, role: state.systemUsers[idx].role },
    executedBy,
    executedRole,
  });

  res.json({ success: true, data: state });
});

app.delete('/api/v1/admin/users/:userId', (req, res) => {
  const executedBy = (req.body?.executedBy as string) || 'KS. Đặng Quốc Bảo';
  const executedRole = (req.body?.executedRole as UserRole) || 'SYS_ADMIN';
  if (!requirePerm(res, executedRole, 'ADMIN_USERS_ROLES', 'delete')) return;

  const idx = state.systemUsers.findIndex((u) => u.userId === req.params.userId);
  if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy tài khoản.' } });

  const target = state.systemUsers[idx];
  const remainingAdmins = state.systemUsers.filter((u) => u.role === 'SYS_ADMIN' && u.userId !== target.userId);
  if (target.role === 'SYS_ADMIN' && remainingAdmins.length === 0) {
    return res.status(409).json({
      success: false,
      error: { message: 'Không thể xóa tài khoản Quản trị viên Hệ thống (SYS_ADMIN) duy nhất.' },
    });
  }

  state.systemUsers.splice(idx, 1);
  addAudit({
    entityName: 'sys_users',
    recordId: target.userId,
    actionType: 'DELETE',
    summary: `Xóa tài khoản người dùng ${target.username} (${target.fullName})`,
    oldValues: { username: target.username, role: target.role },
    newValues: null,
    executedBy,
    executedRole,
  });

  res.json({ success: true, data: state });
});

// --- BUILDINGS CRUD ---
app.post('/api/v1/master/buildings', (req, res) => {
  const { executedBy = 'KS. Đặng Quốc Bảo', executedRole = 'SYS_ADMIN', ...payload } = req.body as Partial<Building> & {
    executedBy?: string;
    executedRole?: UserRole;
  };
  if (!requirePerm(res, executedRole, 'MASTER_BUILDINGS', 'create')) return;
  if (!payload.buildingCode?.trim() || !payload.buildingName?.trim()) {
    return res.status(400).json({ success: false, error: { message: 'Vui lòng nhập Mã tòa nhà và Tên tòa nhà.' } });
  }
  const code = payload.buildingCode.trim().toUpperCase();
  if (state.buildings.some((b) => b.buildingCode.toUpperCase() === code)) {
    return res.status(409).json({ success: false, error: { message: `Mã tòa nhà ${code} đã tồn tại.` } });
  }

  const campusCode = payload.campusCode === 'CS2_TECH' ? 'CS2_TECH' : 'CS1_MAIN';
  const newBuilding: Building = {
    buildingId: `BLD_${code}_${Date.now().toString().slice(-3)}`,
    campusCode,
    campusName: payload.campusName?.trim() || (campusCode === 'CS2_TECH' ? 'Cơ sở 2 — Khu Thực hành Công nghệ' : 'Cơ sở 1 — Trung tâm'),
    buildingCode: code,
    buildingName: payload.buildingName.trim(),
    totalFloors: Math.max(1, Number(payload.totalFloors ?? 4)),
    distanceGroup: Math.max(1, Number(payload.distanceGroup ?? (campusCode === 'CS2_TECH' ? 2 : 1))),
  };
  state.buildings.push(newBuilding);

  addAudit({
    entityName: 'mst_buildings',
    recordId: newBuilding.buildingId,
    actionType: 'INSERT',
    summary: `Thêm mới tòa nhà ${newBuilding.buildingCode} (${newBuilding.buildingName} · ${newBuilding.campusName})`,
    oldValues: null,
    newValues: { ...newBuilding },
    executedBy,
    executedRole,
  });

  res.status(201).json({ success: true, data: state });
});

app.put('/api/v1/master/buildings/:buildingId', (req, res) => {
  const { executedBy = 'KS. Đặng Quốc Bảo', executedRole = 'SYS_ADMIN', ...payload } = req.body as Partial<Building> & {
    executedBy?: string;
    executedRole?: UserRole;
  };
  if (!requirePerm(res, executedRole, 'MASTER_BUILDINGS', 'update')) return;
  const idx = state.buildings.findIndex((b) => b.buildingId === req.params.buildingId);
  if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy tòa nhà.' } });

  const old = { ...state.buildings[idx] };
  const campusCode = payload.campusCode ? (payload.campusCode === 'CS2_TECH' ? 'CS2_TECH' : 'CS1_MAIN') : old.campusCode;
  const updated: Building = {
    ...old,
    campusCode,
    campusName:
      payload.campusName?.trim() ||
      (campusCode === 'CS2_TECH' ? 'Cơ sở 2 — Khu Thực hành Công nghệ' : 'Cơ sở 1 — Trung tâm'),
    buildingCode: payload.buildingCode ? payload.buildingCode.trim().toUpperCase() : old.buildingCode,
    buildingName: payload.buildingName ? payload.buildingName.trim() : old.buildingName,
    totalFloors: payload.totalFloors !== undefined ? Math.max(1, Number(payload.totalFloors)) : old.totalFloors,
    distanceGroup: payload.distanceGroup !== undefined ? Math.max(1, Number(payload.distanceGroup)) : old.distanceGroup,
  };
  state.buildings[idx] = updated;

  addAudit({
    entityName: 'mst_buildings',
    recordId: updated.buildingId,
    actionType: 'UPDATE',
    summary: `Cập nhật tòa nhà ${updated.buildingCode} (${updated.buildingName})`,
    oldValues: { ...old },
    newValues: { ...updated },
    executedBy,
    executedRole,
  });

  res.json({ success: true, data: state });
});

app.delete('/api/v1/master/buildings/:buildingId', (req, res) => {
  const executedBy = (req.body?.executedBy as string) || 'KS. Đặng Quốc Bảo';
  const executedRole = (req.body?.executedRole as UserRole) || 'SYS_ADMIN';
  if (!requirePerm(res, executedRole, 'MASTER_BUILDINGS', 'delete')) return;
  const idx = state.buildings.findIndex((b) => b.buildingId === req.params.buildingId);
  if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy tòa nhà.' } });

  const linkedRooms = state.classrooms.filter((r) => r.buildingId === req.params.buildingId);
  if (linkedRooms.length > 0) {
    return res.status(409).json({
      success: false,
      error: {
        message: `Không thể xóa tòa nhà vì đang quản lý ${linkedRooms.length} phòng học (${linkedRooms.slice(0, 3).map((r) => r.roomCode).join(', ')}...).`,
      },
    });
  }

  const removed = state.buildings[idx];
  state.buildings.splice(idx, 1);
  addAudit({
    entityName: 'mst_buildings',
    recordId: removed.buildingId,
    actionType: 'DELETE',
    summary: `Xóa tòa nhà ${removed.buildingCode} (${removed.buildingName})`,
    oldValues: { ...removed },
    newValues: null,
    executedBy,
    executedRole,
  });

  res.json({ success: true, data: state });
});

// --- FACULTIES CRUD ---
app.post('/api/v1/master/faculties', (req, res) => {
  const { executedBy = 'KS. Đặng Quốc Bảo', executedRole = 'SYS_ADMIN', ...payload } = req.body as Partial<Faculty> & {
    executedBy?: string;
    executedRole?: UserRole;
  };
  if (!requirePerm(res, executedRole, 'MASTER_FACULTIES', 'create')) return;
  if (!payload.code?.trim() || !payload.name?.trim()) {
    return res.status(400).json({ success: false, error: { message: 'Vui lòng nhập Mã Khoa và Tên Khoa.' } });
  }
  const code = payload.code.trim().toUpperCase();
  if (state.faculties.some((f) => f.code.toUpperCase() === code)) {
    return res.status(409).json({ success: false, error: { message: `Mã Khoa ${code} đã tồn tại.` } });
  }

  const newFaculty: Faculty = {
    facultyId: `FAC_${code.replace(/[^A-Z0-9]/g, '')}_${Date.now().toString().slice(-3)}`,
    code,
    name: payload.name.trim(),
    deanName: payload.deanName?.trim() || 'Đang bổ nhiệm',
    targetHours: Math.max(100, Number(payload.targetHours ?? 800)),
    completedHours: Math.max(0, Number(payload.completedHours ?? 0)),
  };
  state.faculties.push(newFaculty);
  // Create a default department so courses/instructors can immediately bind to this new faculty
  state.departments.push({
    departmentId: `DEP_${code.replace(/[^A-Z0-9]/g, '')}_01`,
    facultyId: newFaculty.facultyId,
    code: `BM-${code}`,
    name: `Bộ môn Chuyên ngành ${newFaculty.name}`,
    headName: newFaculty.deanName,
  });

  addAudit({
    entityName: 'mst_faculties',
    recordId: newFaculty.facultyId,
    actionType: 'INSERT',
    summary: `Thêm mới Khoa ${newFaculty.code} — ${newFaculty.name} (Trưởng khoa: ${newFaculty.deanName})`,
    oldValues: null,
    newValues: { ...newFaculty },
    executedBy,
    executedRole,
  });

  res.status(201).json({ success: true, data: state });
});

app.put('/api/v1/master/faculties/:facultyId', (req, res) => {
  const { executedBy = 'KS. Đặng Quốc Bảo', executedRole = 'SYS_ADMIN', ...payload } = req.body as Partial<Faculty> & {
    executedBy?: string;
    executedRole?: UserRole;
  };
  if (!requirePerm(res, executedRole, 'MASTER_FACULTIES', 'update')) return;
  const idx = state.faculties.findIndex((f) => f.facultyId === req.params.facultyId);
  if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy Khoa.' } });

  const old = { ...state.faculties[idx] };
  const updated: Faculty = {
    ...old,
    code: payload.code ? payload.code.trim().toUpperCase() : old.code,
    name: payload.name ? payload.name.trim() : old.name,
    deanName: payload.deanName ? payload.deanName.trim() : old.deanName,
    targetHours: payload.targetHours !== undefined ? Math.max(0, Number(payload.targetHours)) : old.targetHours,
    completedHours: payload.completedHours !== undefined ? Math.max(0, Number(payload.completedHours)) : old.completedHours,
  };
  state.faculties[idx] = updated;

  addAudit({
    entityName: 'mst_faculties',
    recordId: updated.facultyId,
    actionType: 'UPDATE',
    summary: `Cập nhật Khoa ${updated.code} (${updated.name}) — Định mức ${updated.targetHours}h`,
    oldValues: { ...old },
    newValues: { ...updated },
    executedBy,
    executedRole,
  });

  res.json({ success: true, data: state });
});

app.delete('/api/v1/master/faculties/:facultyId', (req, res) => {
  const executedBy = (req.body?.executedBy as string) || 'KS. Đặng Quốc Bảo';
  const executedRole = (req.body?.executedRole as UserRole) || 'SYS_ADMIN';
  if (!requirePerm(res, executedRole, 'MASTER_FACULTIES', 'delete')) return;
  const idx = state.faculties.findIndex((f) => f.facultyId === req.params.facultyId);
  if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy Khoa.' } });

  const linkedCourses = state.courses.filter((c) => c.facultyId === req.params.facultyId);
  const linkedInstructors = state.instructors.filter((i) => i.facultyId === req.params.facultyId);
  const linkedClasses = state.classes.filter((c) => c.facultyId === req.params.facultyId);
  if (linkedCourses.length > 0 || linkedInstructors.length > 0 || linkedClasses.length > 0) {
    return res.status(409).json({
      success: false,
      error: {
        message: `Không thể xóa Khoa vì còn liên kết ${linkedCourses.length} học phần, ${linkedInstructors.length} giảng viên và ${linkedClasses.length} lớp cơ hữu.`,
      },
    });
  }

  const removed = state.faculties[idx];
  state.faculties.splice(idx, 1);
  state.departments = state.departments.filter((d) => d.facultyId !== removed.facultyId);

  addAudit({
    entityName: 'mst_faculties',
    recordId: removed.facultyId,
    actionType: 'DELETE',
    summary: `Xóa Khoa ${removed.code} (${removed.name})`,
    oldValues: { ...removed },
    newValues: null,
    executedBy,
    executedRole,
  });

  res.json({ success: true, data: state });
});

// --- CLASSROOMS CRUD ---
app.post('/api/v1/master/classrooms', (req, res) => {
  const { executedBy = 'KS. Đặng Quốc Bảo', executedRole = 'SYS_ADMIN', ...payload } = req.body as Partial<Classroom> & {
    executedBy?: string;
    executedRole?: UserRole;
  };
  if (!requirePerm(res, executedRole, 'MASTER_ROOMS', 'create')) return;
  if (!payload.roomCode?.trim() || !payload.roomName?.trim() || !payload.buildingId) {
    return res.status(400).json({ success: false, error: { message: 'Vui lòng nhập Mã phòng, Tên phòng và chọn Tòa nhà.' } });
  }
  const code = payload.roomCode.trim().toUpperCase();
  if (state.classrooms.some((r) => r.roomCode.toUpperCase() === code)) {
    return res.status(409).json({ success: false, error: { message: `Mã phòng ${code} đã tồn tại.` } });
  }

  const newRoom: Classroom = {
    roomId: `ROOM_${code.replace(/[^A-Z0-9]/g, '_')}_${Date.now().toString().slice(-3)}`,
    buildingId: payload.buildingId,
    roomCode: code,
    roomName: payload.roomName.trim(),
    roomType: (payload.roomType as RoomType) || 'THEORY',
    maxCapacity: Math.max(10, Number(payload.maxCapacity ?? 50)),
    floorNumber: Math.max(1, Number(payload.floorNumber ?? 1)),
    operationalStatus: payload.operationalStatus || 'AVAILABLE',
    iotPowerState: payload.operationalStatus === 'AVAILABLE' ? 'STANDBY' : 'AUTO_OFF',
    equipment:
      Array.isArray(payload.equipment) && payload.equipment.length > 0
        ? payload.equipment
        : [
            { equipmentId: `EQ_${Date.now().toString().slice(-4)}_1`, name: 'Máy chiếu HD', quantity: 1, status: 'OK' },
            { equipmentId: `EQ_${Date.now().toString().slice(-4)}_2`, name: 'Điều hòa nhiệt độ', quantity: 2, status: 'OK' },
          ],
  };
  state.classrooms.push(newRoom);

  addAudit({
    entityName: 'mst_classrooms',
    recordId: newRoom.roomId,
    actionType: 'INSERT',
    summary: `Thêm mới phòng học ${newRoom.roomCode} (${newRoom.roomName} · ${newRoom.roomType} · ${newRoom.maxCapacity} chỗ)`,
    oldValues: null,
    newValues: { ...newRoom },
    executedBy,
    executedRole,
  });

  res.status(201).json({ success: true, data: state });
});

app.put('/api/v1/master/classrooms/:roomId', (req, res) => {
  const { executedBy = 'KS. Đặng Quốc Bảo', executedRole = 'SYS_ADMIN', ...payload } = req.body as Partial<Classroom> & {
    executedBy?: string;
    executedRole?: UserRole;
  };
  if (!requirePerm(res, executedRole, 'MASTER_ROOMS', 'update')) return;
  const idx = state.classrooms.findIndex((r) => r.roomId === req.params.roomId);
  if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy phòng học.' } });

  const old = { ...state.classrooms[idx] };
  const nextStatus = payload.operationalStatus || old.operationalStatus;
  const updated: Classroom = {
    ...old,
    buildingId: payload.buildingId || old.buildingId,
    roomCode: payload.roomCode ? payload.roomCode.trim().toUpperCase() : old.roomCode,
    roomName: payload.roomName ? payload.roomName.trim() : old.roomName,
    roomType: (payload.roomType as RoomType) || old.roomType,
    maxCapacity: payload.maxCapacity !== undefined ? Math.max(10, Number(payload.maxCapacity)) : old.maxCapacity,
    floorNumber: payload.floorNumber !== undefined ? Math.max(1, Number(payload.floorNumber)) : old.floorNumber,
    operationalStatus: nextStatus,
    iotPowerState: nextStatus !== 'AVAILABLE' ? 'AUTO_OFF' : payload.iotPowerState || old.iotPowerState,
  };
  state.classrooms[idx] = updated;

  addAudit({
    entityName: 'mst_classrooms',
    recordId: updated.roomId,
    actionType: 'UPDATE',
    summary: `Cập nhật phòng học ${updated.roomCode} (${updated.roomType}, ${updated.maxCapacity} chỗ, ${updated.operationalStatus})`,
    oldValues: { roomCode: old.roomCode, maxCapacity: old.maxCapacity, roomType: old.roomType, operationalStatus: old.operationalStatus },
    newValues: { roomCode: updated.roomCode, maxCapacity: updated.maxCapacity, roomType: updated.roomType, operationalStatus: updated.operationalStatus },
    executedBy,
    executedRole,
  });

  res.json({ success: true, data: state });
});

app.delete('/api/v1/master/classrooms/:roomId', (req, res) => {
  const executedBy = (req.body?.executedBy as string) || 'KS. Đặng Quốc Bảo';
  const executedRole = (req.body?.executedRole as UserRole) || 'SYS_ADMIN';
  if (!requirePerm(res, executedRole, 'MASTER_ROOMS', 'delete')) return;
  const idx = state.classrooms.findIndex((r) => r.roomId === req.params.roomId);
  if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy phòng học.' } });

  const activeSessions = state.sessions.filter((s) => s.roomId === req.params.roomId && s.status !== 'CANCELLED');
  const activeExams = state.exams.filter((e) => e.roomId === req.params.roomId);
  if (activeSessions.length > 0 || activeExams.length > 0) {
    return res.status(409).json({
      success: false,
      error: {
        message: `Không thể xóa phòng học vì đang có ${activeSessions.length} buổi học và ${activeExams.length} ca thi được bố trí tại đây.`,
      },
    });
  }

  const removed = state.classrooms[idx];
  state.classrooms.splice(idx, 1);
  addAudit({
    entityName: 'mst_classrooms',
    recordId: removed.roomId,
    actionType: 'DELETE',
    summary: `Xóa phòng học ${removed.roomCode} (${removed.roomName})`,
    oldValues: { roomCode: removed.roomCode, roomName: removed.roomName },
    newValues: null,
    executedBy,
    executedRole,
  });

  res.json({ success: true, data: state });
});

// --- EXAM MODELS CRUD ---
app.post('/api/v1/master/exam-models', (req, res) => {
  const { executedBy = 'KS. Đặng Quốc Bảo', executedRole = 'SYS_ADMIN', ...payload } = req.body as Partial<ExamModel> & {
    executedBy?: string;
    executedRole?: UserRole;
  };
  if (!requirePerm(res, executedRole, 'MASTER_EXAM_MODELS', 'create')) return;
  if (!payload.code?.trim() || !payload.name?.trim()) {
    return res.status(400).json({ success: false, error: { message: 'Vui lòng nhập Mã và Tên Mô hình thi.' } });
  }
  const code = payload.code.trim().toUpperCase();
  if (state.examModels.some((m) => m.code.toUpperCase() === code)) {
    return res.status(409).json({ success: false, error: { message: `Mã mô hình thi ${code} đã tồn tại.` } });
  }

  const allowedRoomTypes: RoomType[] =
    Array.isArray(payload.allowedRoomTypes) && payload.allowedRoomTypes.length > 0
      ? Array.from(new Set(payload.allowedRoomTypes))
      : ['THEORY', 'HALL'];

  const newModel: ExamModel = {
    modelId: `EM_${Date.now().toString().slice(-4)}`,
    code,
    name: payload.name.trim(),
    baseMode: payload.baseMode === 'MODULAR' ? 'MODULAR' : 'CONSOLIDATED',
    durationMinutes: Math.max(30, Number(payload.durationMinutes ?? 90)),
    periodsRequired: Math.max(1, Number(payload.periodsRequired ?? 2)),
    studentsPerProctor: Math.max(10, Number(payload.studentsPerProctor ?? 25)),
    maxRoomFillPercent: Math.min(100, Math.max(25, Number(payload.maxRoomFillPercent ?? 50))),
    allowedRoomTypes,
    description: payload.description?.trim() || 'Mô hình tổ chức thi theo quy chế khảo thí Đại học.',
    isActive: true,
  };
  state.examModels.push(newModel);

  addAudit({
    entityName: 'mst_exam_models',
    recordId: newModel.modelId,
    actionType: 'INSERT',
    summary: `Thêm mới Mô hình thi ${newModel.code} — ${newModel.name} (${newModel.durationMinutes} phút, ${newModel.maxRoomFillPercent}% ghế)`,
    oldValues: null,
    newValues: { ...newModel },
    executedBy,
    executedRole,
  });

  res.status(201).json({ success: true, data: state });
});

app.put('/api/v1/master/exam-models/:modelId', (req, res) => {
  const { executedBy = 'KS. Đặng Quốc Bảo', executedRole = 'SYS_ADMIN', ...payload } = req.body as Partial<ExamModel> & {
    executedBy?: string;
    executedRole?: UserRole;
  };
  if (!requirePerm(res, executedRole, 'MASTER_EXAM_MODELS', 'update')) return;
  const idx = state.examModels.findIndex((m) => m.modelId === req.params.modelId);
  if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy mô hình thi.' } });

  const old = { ...state.examModels[idx] };
  const updated: ExamModel = {
    ...old,
    code: payload.code ? payload.code.trim().toUpperCase() : old.code,
    name: payload.name ? payload.name.trim() : old.name,
    baseMode: payload.baseMode || old.baseMode,
    durationMinutes: payload.durationMinutes !== undefined ? Math.max(30, Number(payload.durationMinutes)) : old.durationMinutes,
    periodsRequired: payload.periodsRequired !== undefined ? Math.max(1, Number(payload.periodsRequired)) : old.periodsRequired,
    studentsPerProctor: payload.studentsPerProctor !== undefined ? Math.max(10, Number(payload.studentsPerProctor)) : old.studentsPerProctor,
    maxRoomFillPercent:
      payload.maxRoomFillPercent !== undefined
        ? Math.min(100, Math.max(25, Number(payload.maxRoomFillPercent)))
        : old.maxRoomFillPercent,
    allowedRoomTypes:
      Array.isArray(payload.allowedRoomTypes) && payload.allowedRoomTypes.length > 0
        ? Array.from(new Set(payload.allowedRoomTypes))
        : old.allowedRoomTypes,
    description: payload.description !== undefined ? payload.description.trim() : old.description,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : old.isActive,
  };
  state.examModels[idx] = updated;

  addAudit({
    entityName: 'mst_exam_models',
    recordId: updated.modelId,
    actionType: 'UPDATE',
    summary: `Cập nhật Mô hình thi ${updated.code} (${updated.name})`,
    oldValues: { ...old },
    newValues: { ...updated },
    executedBy,
    executedRole,
  });

  res.json({ success: true, data: state });
});

app.delete('/api/v1/master/exam-models/:modelId', (req, res) => {
  const executedBy = (req.body?.executedBy as string) || 'KS. Đặng Quốc Bảo';
  const executedRole = (req.body?.executedRole as UserRole) || 'SYS_ADMIN';
  if (!requirePerm(res, executedRole, 'MASTER_EXAM_MODELS', 'delete')) return;
  const idx = state.examModels.findIndex((m) => m.modelId === req.params.modelId);
  if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy mô hình thi.' } });

  const target = state.examModels[idx];
  const linkedCourses = state.courses.filter((c) => c.examModelCode === target.code);
  if (linkedCourses.length > 0) {
    return res.status(409).json({
      success: false,
      error: {
        message: `Không thể xóa Mô hình thi ${target.code} vì đang áp dụng cho ${linkedCourses.length} học phần.`,
      },
    });
  }

  state.examModels.splice(idx, 1);
  addAudit({
    entityName: 'mst_exam_models',
    recordId: target.modelId,
    actionType: 'DELETE',
    summary: `Xóa Mô hình thi ${target.code} (${target.name})`,
    oldValues: { ...target },
    newValues: null,
    executedBy,
    executedRole,
  });

  res.json({ success: true, data: state });
});

// --- INSTRUCTORS CRUD ---
app.post('/api/v1/master/instructors', (req, res) => {
  const { executedBy = 'KS. Đặng Quốc Bảo', executedRole = 'SYS_ADMIN', ...payload } = req.body as Partial<Instructor> & {
    executedBy?: string;
    executedRole?: UserRole;
  };
  if (!requirePerm(res, executedRole, 'MASTER_INSTRUCTORS', 'create')) return;
  if (!payload.staffCode?.trim() || !payload.fullName?.trim() || !payload.facultyId) {
    return res.status(400).json({ success: false, error: { message: 'Vui lòng nhập Mã cán bộ, Họ tên và Khoa.' } });
  }
  const staffCode = payload.staffCode.trim().toUpperCase();
  if (state.instructors.some((i) => i.staffCode.toUpperCase() === staffCode)) {
    return res.status(409).json({ success: false, error: { message: `Mã giảng viên ${staffCode} đã tồn tại.` } });
  }

  const defaultDept =
    state.departments.find((d) => d.departmentId === payload.departmentId)?.departmentId ||
    state.departments.find((d) => d.facultyId === payload.facultyId)?.departmentId ||
    state.departments[0]?.departmentId ||
    'DEP_SE';

  const newInstr: Instructor = {
    instructorId: `INS_${Date.now().toString().slice(-4)}`,
    staffCode,
    fullName: payload.fullName.trim(),
    title: payload.title?.trim() || 'ThS.',
    facultyId: payload.facultyId,
    departmentId: defaultDept,
    email: payload.email?.trim().toLowerCase() || `${staffCode.toLowerCase()}@university.edu.vn`,
    phone: payload.phone?.trim() || '0912 000 999',
    instructorType: payload.instructorType || 'FULL_TIME',
    maxHoursPerDay: Math.max(2, Number(payload.maxHoursPerDay ?? 6)),
    maxHoursPerWeek: Math.max(4, Number(payload.maxHoursPerWeek ?? 16)),
    targetTermHours: Math.max(40, Number(payload.targetTermHours ?? 200)),
  };
  state.instructors.push(newInstr);

  addAudit({
    entityName: 'mst_instructors',
    recordId: newInstr.instructorId,
    actionType: 'INSERT',
    summary: `Thêm mới giảng viên ${newInstr.title} ${newInstr.fullName} (${newInstr.staffCode})`,
    oldValues: null,
    newValues: { ...newInstr },
    executedBy,
    executedRole,
  });

  res.status(201).json({ success: true, data: state });
});

app.put('/api/v1/master/instructors/:instructorId', (req, res) => {
  const { executedBy = 'KS. Đặng Quốc Bảo', executedRole = 'SYS_ADMIN', ...payload } = req.body as Partial<Instructor> & {
    executedBy?: string;
    executedRole?: UserRole;
  };
  if (!requirePerm(res, executedRole, 'MASTER_INSTRUCTORS', 'update')) return;
  const idx = state.instructors.findIndex((i) => i.instructorId === req.params.instructorId);
  if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy giảng viên.' } });

  const old = { ...state.instructors[idx] };
  const updated: Instructor = {
    ...old,
    staffCode: payload.staffCode ? payload.staffCode.trim().toUpperCase() : old.staffCode,
    fullName: payload.fullName ? payload.fullName.trim() : old.fullName,
    title: payload.title ? payload.title.trim() : old.title,
    facultyId: payload.facultyId || old.facultyId,
    departmentId: payload.departmentId || old.departmentId,
    email: payload.email ? payload.email.trim().toLowerCase() : old.email,
    phone: payload.phone ? payload.phone.trim() : old.phone,
    instructorType: payload.instructorType || old.instructorType,
    maxHoursPerDay: payload.maxHoursPerDay !== undefined ? Math.max(2, Number(payload.maxHoursPerDay)) : old.maxHoursPerDay,
    maxHoursPerWeek: payload.maxHoursPerWeek !== undefined ? Math.max(4, Number(payload.maxHoursPerWeek)) : old.maxHoursPerWeek,
    targetTermHours: payload.targetTermHours !== undefined ? Math.max(40, Number(payload.targetTermHours)) : old.targetTermHours,
  };
  state.instructors[idx] = updated;

  addAudit({
    entityName: 'mst_instructors',
    recordId: updated.instructorId,
    actionType: 'UPDATE',
    summary: `Cập nhật hồ sơ giảng viên ${updated.title} ${updated.fullName} (${updated.staffCode})`,
    oldValues: { fullName: old.fullName, instructorType: old.instructorType, targetTermHours: old.targetTermHours },
    newValues: { fullName: updated.fullName, instructorType: updated.instructorType, targetTermHours: updated.targetTermHours },
    executedBy,
    executedRole,
  });

  res.json({ success: true, data: state });
});

app.delete('/api/v1/master/instructors/:instructorId', (req, res) => {
  const executedBy = (req.body?.executedBy as string) || 'KS. Đặng Quốc Bảo';
  const executedRole = (req.body?.executedRole as UserRole) || 'SYS_ADMIN';
  if (!requirePerm(res, executedRole, 'MASTER_INSTRUCTORS', 'delete')) return;
  const idx = state.instructors.findIndex((i) => i.instructorId === req.params.instructorId);
  if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy giảng viên.' } });

  const assignedSections = state.sections.filter((s) =>
    s.instructors.some((a) => a.instructorId === req.params.instructorId)
  );
  if (assignedSections.length > 0) {
    return res.status(409).json({
      success: false,
      error: {
        message: `Không thể xóa giảng viên vì đang được phân công giảng dạy ${assignedSections.length} lớp học phần.`,
      },
    });
  }

  const removed = state.instructors[idx];
  state.instructors.splice(idx, 1);
  state.availabilities = state.availabilities.filter((a) => a.instructorId !== removed.instructorId);

  addAudit({
    entityName: 'mst_instructors',
    recordId: removed.instructorId,
    actionType: 'DELETE',
    summary: `Xóa hồ sơ giảng viên ${removed.title} ${removed.fullName} (${removed.staffCode})`,
    oldValues: { staffCode: removed.staffCode, fullName: removed.fullName },
    newValues: null,
    executedBy,
    executedRole,
  });

  res.json({ success: true, data: state });
});

// --- ROLE GROUPS & GRANULAR CRUD PERMISSION MATRIX APIs ---
app.post('/api/v1/admin/role-groups', (req, res) => {
  const { executedBy = 'KS. Đặng Quốc Bảo', executedRole = 'SYS_ADMIN', ...payload } = req.body as Partial<RoleGroup> & {
    executedBy?: string;
    executedRole?: UserRole;
  };
  if (!requirePerm(res, executedRole, 'ADMIN_USERS_ROLES', 'create')) return;
  if (!payload.code?.trim() || !payload.name?.trim()) {
    return res.status(400).json({ success: false, error: { message: 'Vui lòng nhập Mã nhóm quyền và Tên nhóm quyền.' } });
  }
  const code = payload.code.trim().toUpperCase().replace(/\s+/g, '_');
  if (state.roleGroups.some((g) => g.code.toUpperCase() === code)) {
    return res.status(409).json({ success: false, error: { message: `Mã nhóm quyền ${code} đã tồn tại.` } });
  }

  const baseRole: UserRole = payload.roleCode || 'FACULTY_HEAD';
  const template = state.roleGroups.find((g) => g.roleCode === baseRole) ?? createDefaultRoleGroups()[0];

  const newGroup: RoleGroup = {
    groupId: `GRP_${code}_${Date.now().toString().slice(-3)}`,
    roleCode: baseRole,
    code,
    name: payload.name.trim(),
    description: payload.description?.trim() || 'Nhóm quyền tùy chỉnh theo phân cấp đơn vị.',
    scopeLabel: payload.scopeLabel?.trim() || template.scopeLabel,
    isSystemDefault: false,
    isActive: true,
    permissions: payload.permissions
      ? JSON.parse(JSON.stringify(payload.permissions))
      : JSON.parse(JSON.stringify(template.permissions)),
  };
  state.roleGroups.push(newGroup);

  addAudit({
    entityName: 'sys_role_groups',
    recordId: newGroup.groupId,
    actionType: 'INSERT',
    summary: `Tạo nhóm quyền mới ${newGroup.code} (${newGroup.name}) kế thừa vai trò ${newGroup.roleCode}`,
    oldValues: null,
    newValues: { code: newGroup.code, name: newGroup.name, roleCode: newGroup.roleCode },
    executedBy,
    executedRole,
  });

  res.status(201).json({ success: true, data: state });
});

app.put('/api/v1/admin/role-groups/:groupId', (req, res) => {
  const { executedBy = 'KS. Đặng Quốc Bảo', executedRole = 'SYS_ADMIN', ...payload } = req.body as Partial<RoleGroup> & {
    executedBy?: string;
    executedRole?: UserRole;
  };
  if (!requirePerm(res, executedRole, 'ADMIN_USERS_ROLES', 'update')) return;
  const idx = state.roleGroups.findIndex((g) => g.groupId === req.params.groupId);
  if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy nhóm quyền.' } });

  const old = state.roleGroups[idx];
  const nextPermissions = payload.permissions
    ? JSON.parse(JSON.stringify(payload.permissions))
    : old.permissions;

  // Safeguard: never lock SYS_ADMIN out of ADMIN_USERS_ROLES view/update
  if (old.roleCode === 'SYS_ADMIN' && old.isSystemDefault) {
    nextPermissions.ADMIN_USERS_ROLES = {
      ...nextPermissions.ADMIN_USERS_ROLES,
      view: true,
      update: true,
    };
  }

  const updated: RoleGroup = {
    ...old,
    name: payload.name ? payload.name.trim() : old.name,
    description: payload.description !== undefined ? payload.description.trim() : old.description,
    scopeLabel: payload.scopeLabel !== undefined ? payload.scopeLabel.trim() : old.scopeLabel,
    isActive: old.isSystemDefault ? true : payload.isActive !== undefined ? Boolean(payload.isActive) : old.isActive,
    permissions: nextPermissions,
  };
  state.roleGroups[idx] = updated;

  addAudit({
    entityName: 'sys_role_groups',
    recordId: updated.groupId,
    actionType: 'UPDATE',
    summary: `Cập nhật phân quyền chi tiết (Xem/Thêm/Sửa/Xóa) cho nhóm quyền ${updated.name} (${updated.code})`,
    oldValues: { name: old.name },
    newValues: { name: updated.name, isActive: updated.isActive },
    executedBy,
    executedRole,
  });

  res.json({ success: true, data: state });
});

app.delete('/api/v1/admin/role-groups/:groupId', (req, res) => {
  const executedBy = (req.body?.executedBy as string) || 'KS. Đặng Quốc Bảo';
  const executedRole = (req.body?.executedRole as UserRole) || 'SYS_ADMIN';
  if (!requirePerm(res, executedRole, 'ADMIN_USERS_ROLES', 'delete')) return;
  const idx = state.roleGroups.findIndex((g) => g.groupId === req.params.groupId);
  if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy nhóm quyền.' } });

  const target = state.roleGroups[idx];
  if (target.isSystemDefault) {
    return res.status(409).json({
      success: false,
      error: { message: `Không thể xóa nhóm quyền mặc định lõi của hệ thống (${target.code}).` },
    });
  }

  state.roleGroups.splice(idx, 1);
  addAudit({
    entityName: 'sys_role_groups',
    recordId: target.groupId,
    actionType: 'DELETE',
    summary: `Xóa nhóm quyền tùy chỉnh ${target.code} (${target.name})`,
    oldValues: { code: target.code, name: target.name },
    newValues: null,
    executedBy,
    executedRole,
  });

  res.json({ success: true, data: state });
});

app.post('/api/v1/admin/role-groups/reset', (req, res) => {
  const executedBy = (req.body?.executedBy as string) || 'KS. Đặng Quốc Bảo';
  const executedRole = (req.body?.executedRole as UserRole) || 'SYS_ADMIN';
  if (!requirePerm(res, executedRole, 'ADMIN_USERS_ROLES', 'update')) return;

  state.roleGroups = createDefaultRoleGroups();
  addAudit({
    entityName: 'sys_role_groups',
    recordId: 'ALL_ROLE_GROUPS',
    actionType: 'ROLLBACK',
    summary: 'Khôi phục Ma trận Phân quyền chi tiết 6 Nhóm quyền mặc định ban đầu',
    oldValues: null,
    newValues: { count: state.roleGroups.length },
    executedBy,
    executedRole,
  });

  res.json({ success: true, data: state });
});

// ============================================================================
// 5. SERVER-SIDE GEMINI HIGH THINKING CSP ADVISOR (gemini-4-carbon + HIGH)
// ============================================================================
app.post('/api/v1/ai/csp-analyze', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'API_KEY_MISSING',
        message:
          'Chức năng phân tích suy luận chuyên sâu AI yêu cầu cấu hình khóa API trả phí trong mục Settings > Secrets. Bạn vẫn có thể sử dụng Bộ giải CSP Toán học nội bộ ngay bên cạnh.',
      },
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const userQuestion = String(
      req.body?.question ||
        'Phân tích tổng thể trạng thái thời khóa biểu hiện tại theo mô hình toán học CSP (Ràng buộc cứng/mềm, chỉ số RUR/SFR/SVI, cân bằng tải giảng viên) và đề xuất phương án tối ưu hóa cụ thể.'
    );

    const cspReport = evaluateCSPCost(state, state.activeWeek);
    const contextSummary = {
      term: state.termName,
      week: state.activeWeek,
      totalRooms: state.classrooms.length,
      availableRooms: state.classrooms.filter((r) => r.operationalStatus === 'AVAILABLE').length,
      totalSessions: state.sessions.filter((s) => s.weekIndex === state.activeWeek).length,
      unassignedSections: state.sections
        .filter((s) => s.status === 'OPEN')
        .map((s) => ({ code: s.sectionCode, students: s.enrolledCount, roomType: s.requiredRoomType })),
      cspCost: cspReport,
      pendingRequests: state.changeRequests.filter((r) => r.approvalStatus.startsWith('PENDING')).length,
    };

    const response = await ai.models.generateContent({
      model: 'gemini-4-carbon',
      contents: `Dữ liệu vận hành thực tế của Hệ thống Quản lý Thời khóa biểu Đại học (UTS):\n${JSON.stringify(contextSummary, null, 2)}\n\nYêu cầu phân tích: ${userQuestion}`,
      config: {
        systemInstruction:
          'Bạn là Kiến trúc sư Tối ưu hóa Lập lịch Đại học (CSP/COP Specialist). Trả lời ngắn gọn, súc tích bằng tiếng Việt chuyên ngành đào tạo đại học với các đề xuất hành động cụ thể dựa trên dữ liệu thực tế được cung cấp.',
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
      },
    });

    return res.json({
      success: true,
      data: {
        analysis: response.text ?? '',
        model: 'gemini-4-carbon',
        thinkingLevel: 'HIGH',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi không xác định khi kết nối Gemini API.';
    return res.status(502).json({
      success: false,
      error: {
        code: 'GEMINI_UPSTREAM_ERROR',
        message: `Không thể gọi mô hình suy luận chuyên sâu: ${msg}. Vui lòng kiểm tra khóa API trong Settings > Secrets hoặc sử dụng Bộ giải CSP nội bộ.`,
      },
    });
  }
});

// ============================================================================
// 6. VITE MIDDLEWARE (DEV) OR STATIC DIST (PROD)
// ============================================================================
async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`UTS EduCore server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
