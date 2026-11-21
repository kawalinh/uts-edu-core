// Core 3NF Data Model matching SRS Section 7 & Technical Proposal Section 6

export type UserRole =
  | 'SYS_ADMIN'
  | 'EXECUTIVE'
  | 'SCHEDULER'
  | 'FACULTY_HEAD'
  | 'INSTRUCTOR'
  | 'STUDENT';

export interface RoleProfile {
  role: UserRole;
  label: string;
  shortLabel: string;
  userName: string;
  userTitle: string;
  scopeLabel: string;
  facultyId?: string;
  instructorId?: string;
  classId?: string;
}

export type RoomType = 'HALL' | 'THEORY' | 'LAB_COMP' | 'LAB_LANG' | 'LAB_PHYSICS';
export type RoomStatus = 'AVAILABLE' | 'MAINTENANCE' | 'LOCKED';
export type SessionType = 'THEORY' | 'PRACTICE' | 'DISCUSSION' | 'EXAM';
export type SessionStatus = 'CONFIRMED' | 'CANCELLED' | 'RESCHEDULED' | 'MAKEUP' | 'ROOM_CHANGED' | 'PENDING_CHANGE';
export type PrerequisiteRuleType = 'MANDATORY' | 'PRIOR' | 'COREQUISITE';
export type InstructorType = 'FULL_TIME' | 'VISITING' | 'ADVISOR' | 'TA';
export type InstructorRole = 'LEAD' | 'CO_TEACHER' | 'TA' | 'LAB_TECH';
export type LifecycleStage = 'T12_COHORTS' | 'T10_CURRICULUM' | 'T8_SEMESTER_PLAN' | 'T4_MACRO_SCHEDULE' | 'T1_FROZEN';

export interface Faculty {
  facultyId: string;
  code: string;
  name: string;
  deanName: string;
  targetHours: number;
  completedHours: number;
}

export interface Department {
  departmentId: string;
  facultyId: string;
  code: string;
  name: string;
  headName: string;
}

export interface AcademicMajor {
  majorId: string;
  majorCode: string;
  majorName: string;
  facultyId: string;
  degreeLevel: 'Đại học Chính quy' | 'Liên thông' | 'Vừa học vừa làm' | 'Sau đại học (ThS/TS)';
  educationSystem: string;
  totalCreditsRequired: number;
}

export interface AcademicClass {
  classId: string;
  classCode: string;
  className: string;
  majorId: string;
  facultyId: string;
  academicYear: string; // e.g., "Khóa 2024 - 2028"
  studentCount: number;
  advisorId: string;
}

export interface CoursePrerequisite {
  prerequisiteId: string;
  courseId: string;
  prerequisiteCourseId: string;
  ruleType: PrerequisiteRuleType;
}

export interface CourseSubject {
  courseId: string;
  courseCode: string;
  courseName: string;
  courseNameEn: string;
  departmentId: string;
  facultyId: string;
  credits: number;
  theoryPeriods: number;      // LT
  exercisePeriods: number;    // BT
  discussionPeriods: number;  // TL
  practicalPeriods: number;   // TH
  requiredRoomType: RoomType; // Primary room type (for backward compatibility)
  requiredRoomTypes: RoomType[]; // Multi-select room types (e.g., THEORY + LAB_COMP)
  examMode: 'MODULAR' | 'CONSOLIDATED';
  examModelCode?: string; // Links to ExamModel master catalog
  isActive: boolean;
}

export interface Building {
  buildingId: string;
  campusCode: 'CS1_MAIN' | 'CS2_TECH';
  campusName: string;
  buildingCode: string;
  buildingName: string;
  totalFloors: number;
  distanceGroup: number; // used for BR_RULE_09 (>500m check)
}

export interface RoomEquipment {
  equipmentId: string;
  name: string;
  quantity: number;
  status: 'OK' | 'FAULTY';
}

export interface Classroom {
  roomId: string;
  buildingId: string;
  roomCode: string;
  roomName: string;
  roomType: RoomType;
  maxCapacity: number;
  floorNumber: number;
  operationalStatus: RoomStatus;
  equipment: RoomEquipment[];
  iotPowerState?: 'AUTO_ON' | 'AUTO_OFF' | 'STANDBY';
}

export interface InstructorAvailability {
  availabilityId: string;
  instructorId: string;
  dayOfWeek: number; // 2..7
  shift: 'MORNING' | 'AFTERNOON' | 'EVENING';
  constraintType: 'HARD_BUSY' | 'SOFT_AVOID';
  reason: string;
}

export interface Instructor {
  instructorId: string;
  staffCode: string;
  fullName: string;
  title: string; // PGS.TS., TS., ThS.
  departmentId: string;
  facultyId: string;
  email: string;
  phone: string;
  instructorType: InstructorType;
  maxHoursPerDay: number;  // default 6 (BR_RULE_08)
  maxHoursPerWeek: number;
  targetTermHours: number;
}

export interface SectionInstructorAssignment {
  assignmentId: string;
  sectionId: string;
  instructorId: string;
  role: InstructorRole;
  assignedPeriods: number;
}

export interface CourseSection {
  sectionId: string;
  sectionCode: string;
  courseId: string;
  termId: string;
  cohortClassIds: string[]; // supports merged classes (BR-TT-04)
  enrolledCount: number;
  capacityMax: number;
  requiredRoomType: RoomType;
  allowedRoomTypes?: RoomType[];
  sessionType: SessionType;
  periodsPerSession: number; // 2 or 4 (BR_RULE_07)
  status: 'OPEN' | 'SCHEDULED' | 'CLOSED';
  groupLabel?: string; // e.g., "Tốp 1 Lab", "Ghép 2 lớp"
  instructors: SectionInstructorAssignment[];
}

export interface ClassSession {
  sessionId: string;
  sectionId: string;
  roomId: string;
  sessionDate: string; // YYYY-MM-DD
  weekIndex: number;   // e.g., 12
  dayOfWeek: number;   // 2 = Thứ Hai ... 7 = Thứ Bảy
  startPeriod: number; // 1..13
  totalPeriods: number; // 2 or 4
  sessionType: SessionType;
  status: SessionStatus;
  previousRoomId?: string;
  previousDate?: string;
  previousStartPeriod?: number;
  note?: string;
  lmsMeetingLink?: string;
}

export type ChangeRequestType = 'LEAVE_AND_MAKEUP' | 'RESCHEDULE_TIME' | 'CHANGE_ROOM';
export type ApprovalStatus =
  | 'PENDING_FACULTY_APPROVAL'
  | 'PENDING_ACADEMIC_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'ROLLED_BACK';

export interface ScheduleChangeRequest {
  requestId: string;
  originalSessionId: string;
  requesterId: string;
  requestType: ChangeRequestType;
  reasonCode: 'SICKNESS' | 'BUSINESS_TRIP' | 'FACILITY_ISSUE' | 'PERSONAL';
  reasonDetail: string;
  proposedDate: string;
  proposedDayOfWeek: number;
  proposedStartPeriod: number;
  proposedTotalPeriods: number;
  proposedRoomId: string;
  approvalStatus: ApprovalStatus;
  createdAt: string;
  slaDeadline: string;
  facultyApprovedBy?: string;
  facultyApprovedAt?: string;
  facultyNote?: string;
  academicApprovedBy?: string;
  academicApprovedAt?: string;
  academicNote?: string;
  generatedMakeupSessionId?: string;
}

export interface AuditLog {
  logId: string;
  entityName:
    | 'trn_class_sessions'
    | 'schedule_change_requests'
    | 'mst_courses'
    | 'mst_classrooms'
    | 'mst_buildings'
    | 'mst_faculties'
    | 'mst_instructors'
    | 'mst_exam_models'
    | 'timetable_lifecycle'
    | 'sys_users'
    | 'sys_role_groups'
    | 'sys_notifications'
    | 'sys_jobs'
    | 'sys_parameters'
    | 'trn_course_sections';
  recordId: string;
  actionType: 'INSERT' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'ROLLBACK' | 'FREEZE' | 'MERGE' | 'SPLIT' | 'RUN_JOB';
  summary: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  executedBy: string;
  executedRole: UserRole;
  timestamp: string;
  canRollback?: boolean;
  rolledBack?: boolean;
  relatedRequestId?: string;
}

export interface PushNotification {
  notificationId: string;
  type: 'SCHEDULE_CHANGE' | 'APPROVAL_NEEDED' | 'MAKEUP_CONFIRMED' | 'ROOM_CHANGE' | 'INCIDENT_UPDATE';
  sessionId?: string;
  title: string;
  body: string;
  beforeSummary?: string;
  afterSummary?: string;
  deepLink?: string;
  targetRoles: UserRole[];
  createdAt: string;
  read: boolean;
}

export interface FacilityIncident {
  incidentId: string;
  roomId: string;
  reportedBy: string;
  reporterRole: UserRole;
  category: 'PROJECTOR' | 'AC' | 'AUDIO' | 'COMPUTER' | 'FURNITURE';
  description: string;
  sessionTimeLabel: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  createdAt: string;
}

export interface ExamScheduleItem {
  examId: string;
  courseId: string;
  sectionId: string;
  examMode: 'MODULAR' | 'CONSOLIDATED';
  examWeek: number;
  examDate: string;
  dayOfWeek: number;
  startPeriod: number;
  totalPeriods: number;
  roomId: string;
  proctorIds: string[];
  candidateCount: number;
  status: 'SCHEDULED' | 'PUBLISHED';
}

export interface SemesterWeekAllocation {
  courseId: string;
  startWeek: number;
  endWeek: number;
  periodsPerWeek: number;
  examWeek: number;
}

export interface ConflictViolation {
  severity: 'HARD' | 'SOFT';
  code:
    | 'HARD_ERR_OVER_CAPACITY'
    | 'HARD_ERR_INVALID_ROOM_TYPE'
    | 'HARD_ERR_ROOM_UNAVAILABLE'
    | 'HARD_ERR_ROOM_DOUBLE_BOOKED'
    | 'HARD_ERR_INSTRUCTOR_OVERLAP'
    | 'HARD_ERR_INSTRUCTOR_UNAVAILABLE'
    | 'HARD_ERR_COHORT_OVERLAP'
    | 'WARN_MAX_WORKLOAD_EXCEEDED'
    | 'WARN_ODD_PERIODS'
    | 'WARN_ROOM_UNDERUTILIZED'
    | 'WARN_TRAVEL_GAP'
    | 'WARN_INSTRUCTOR_SOFT_AVOID';
  message: string;
  conflictingSessionId?: string;
  conflictingEntityName?: string;
}

export interface AlternativeSlotSuggestion {
  rank: number;
  roomId: string;
  roomCode: string;
  roomName: string;
  roomCapacity: number;
  dayOfWeek: number;
  sessionDate: string;
  startPeriod: number;
  totalPeriods: number;
  seatFillRatio: number;
  reason: string;
  softPenalty: number;
}

export interface ConflictCheckResult {
  isValid: boolean;
  hasWarnings: boolean;
  violations: ConflictViolation[];
  suggestions: AlternativeSlotSuggestion[];
  executionTimeMs: number;
}

export interface CSPCostReport {
  hardViolationCount: number;
  totalSoftCost: number;
  breakdown: {
    ruleCode: string;
    label: string;
    weight: number;
    violations: number;
    cost: number;
  }[];
}

export interface SystemUser {
  userId: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  facultyId?: string;
  departmentName: string;
  status: 'ACTIVE' | 'LOCKED';
  lastLoginAt: string;
  mfaEnabled: boolean;
}

export interface NotificationChannelConfig {
  channelId: string;
  channelType: 'FCM_PUSH' | 'EMAIL_SMTP' | 'SMS_GATEWAY' | 'LMS_WEBHOOK';
  name: string;
  description: string;
  enabled: boolean;
  targetEvents: string[];
  retryCount: number;
  lastTriggeredAt: string;
}

export interface ScheduledJob {
  jobId: string;
  jobCode: string;
  name: string;
  description: string;
  scheduleCron: string;
  category: 'KPI_AGGREGATION' | 'SLA_MONITOR' | 'SIS_LMS_SYNC' | 'BMS_IOT' | 'BACKUP';
  enabled: boolean;
  lastRunAt: string;
  lastStatus: 'SUCCESS' | 'RUNNING' | 'WARNING';
  lastDurationMs: number;
  lastSummary: string;
}

export interface SystemParameters {
  maxPeriodsPerDay: number;
  slaHoursLimit: number;
  minSfrWarningPercent: number;
  bmsPreHeatMinutes: number;
  academicPeriodsCount: number;
  autoFreezeDaysBeforeTerm: number;
}

export interface ExamModel {
  modelId: string;
  code: string;
  name: string;
  baseMode: 'MODULAR' | 'CONSOLIDATED';
  durationMinutes: number;
  periodsRequired: number;
  studentsPerProctor: number;
  maxRoomFillPercent: number;
  allowedRoomTypes: RoomType[];
  description: string;
  isActive: boolean;
}

export type PermissionFunctionId =
  | 'DASHBOARD_KPI'
  | 'MASTER_FACULTIES'
  | 'MASTER_BUILDINGS'
  | 'MASTER_ROOMS'
  | 'MASTER_COURSES'
  | 'MASTER_INSTRUCTORS'
  | 'MASTER_EXAM_MODELS'
  | 'TIMETABLE_BUILDER'
  | 'APPROVAL_WORKFLOW'
  | 'PLANNING_EXAMS'
  | 'REPORTS_INTEGRATIONS'
  | 'ADMIN_USERS_ROLES';

export type CrudAction = 'view' | 'create' | 'update' | 'delete';

export interface CrudPermission {
  view: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}

export interface RoleGroup {
  groupId: string;
  roleCode: UserRole;
  code: string;
  name: string;
  description: string;
  scopeLabel: string;
  isSystemDefault: boolean;
  isActive: boolean;
  permissions: Record<PermissionFunctionId, CrudPermission>;
}

export interface UTSState {
  termId: string;
  termName: string;
  activeWeek: number;
  lifecycleStage: LifecycleStage;
  isFrozen: boolean;
  sisLastSyncAt: string;
  lmsLastSyncAt: string;
  faculties: Faculty[];
  departments: Department[];
  majors: AcademicMajor[];
  classes: AcademicClass[];
  courses: CourseSubject[];
  prerequisites: CoursePrerequisite[];
  buildings: Building[];
  classrooms: Classroom[];
  instructors: Instructor[];
  availabilities: InstructorAvailability[];
  sections: CourseSection[];
  sessions: ClassSession[];
  changeRequests: ScheduleChangeRequest[];
  auditLogs: AuditLog[];
  notifications: PushNotification[];
  incidents: FacilityIncident[];
  exams: ExamScheduleItem[];
  examModels: ExamModel[];
  weekAllocations: SemesterWeekAllocation[];
  systemUsers: SystemUser[];
  roleGroups: RoleGroup[];
  notificationChannels: NotificationChannelConfig[];
  scheduledJobs: ScheduledJob[];
  systemParams: SystemParameters;
}
