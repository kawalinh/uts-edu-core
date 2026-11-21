import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ROLE_PROFILES, createInitialUTSState } from '../data/seedData';
import type {
  Building,
  Classroom,
  CourseSubject,
  CrudAction,
  ExamModel,
  Faculty,
  Instructor,
  InstructorRole,
  LifecycleStage,
  PermissionFunctionId,
  RoleGroup,
  RoleProfile,
  SystemParameters,
  SystemUser,
  UTSState,
  UserRole,
} from '../types/uts';
import {
  type NavSectionId,
  type RoleCapabilitySpec,
  checkRolePermission,
  deriveRoleCapabilitiesFromGroups,
  isNavAllowedForRole,
} from '../utils/rbacConfig';

export type { NavSectionId };

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  detail?: string;
}

export interface DrillDownContext {
  sourceLabel: string;
  description?: string;
  // Builder drill-down parameters
  builderViewMode?: 'ROOM' | 'CLASS' | 'INSTRUCTOR' | 'FACULTY';
  builderEntityId?: string;
  builderDay?: number;
  builderShift?: 'MORNING' | 'AFTERNOON' | 'EVENING';
  builderFocus?: 'UNASSIGNED' | 'CSP_AUDIT' | 'SLOT_DETAIL';
  // Master Data drill-down parameters
  masterTab?: 'TREE' | 'COURSES' | 'ROOMS' | 'INSTRUCTORS' | 'CATALOGS';
  facultyId?: string;
  buildingId?: string;
  campusCode?: string;
  instructorId?: string;
  roomMetricFocus?: 'RUR' | 'INCIDENTS';
  // Workflow & Audit drill-down parameters
  workflowFilter?: 'ALL' | 'PENDING' | 'DECIDED' | 'SLA_TRACKING' | 'SVI_CHANGES';
  highlightAuditLogId?: string;
  // Reports drill-down parameters
  reportFocus?: 'SFR_DETAIL' | 'MATRIX' | 'CLASS_PRINT' | 'INTEGRATIONS';
  sfrFilter?: 'ALL' | 'UNDERUTILIZED' | 'OPTIMAL';
  // Planning drill-down parameters
  planningFocus?: 'ALLOCATION' | 'EXAMS';
}

interface UTSContextValue {
  state: UTSState;
  loading: boolean;
  activeNav: NavSectionId;
  setActiveNav: (nav: NavSectionId) => void;
  drillDown: DrillDownContext | null;
  navigateWithDrillDown: (nav: NavSectionId, context: DrillDownContext) => void;
  clearDrillDown: () => void;
  highlightedSessionId: string | null;
  setHighlightedSessionId: (id: string | null) => void;
  currentRole: RoleProfile;
  roleCapabilities: RoleCapabilitySpec;
  hasPermission: (fn: PermissionFunctionId, action: CrudAction) => boolean;
  switchRole: (role: UserRole) => void;
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  refreshState: () => Promise<void>;
  assignSession: (payload: {
    session_id?: string;
    section_id: string;
    room_id: string;
    day_of_week: number;
    start_period: number;
    total_periods: number;
  }) => Promise<{ ok: boolean; error?: any; warnings?: any[] }>;
  splitSection: (sectionId: string, numGroups?: number) => Promise<boolean>;
  mergeSections: (sectionIds: string[]) => Promise<boolean>;
  autoSolveCSP: () => Promise<{ placed: number; unplaced: number }>;
  toggleFreeze: (isFrozen: boolean, lifecycleStage?: LifecycleStage) => Promise<void>;
  submitChangeRequest: (payload: {
    original_session_id: string;
    requester_id: string;
    request_type: 'LEAVE_AND_MAKEUP' | 'RESCHEDULE_TIME' | 'CHANGE_ROOM';
    reason_code: 'SICKNESS' | 'BUSINESS_TRIP' | 'FACILITY_ISSUE' | 'PERSONAL';
    reason_detail: string;
    proposed_makeup: {
      day_of_week: number;
      start_period: number;
      total_periods: number;
      preferred_room_id: string;
      date?: string;
    };
  }) => Promise<{ ok: boolean; requestId?: string; error?: string }>;
  processRequestAction: (
    requestId: string,
    action: 'APPROVE' | 'REJECT',
    note?: string,
    overrideRoomId?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  rollbackAudit: (logId: string) => Promise<boolean>;
  createCourse: (
    payload: Omit<CourseSubject, 'courseId' | 'isActive'> & {
      prerequisiteCourseId?: string;
      prerequisiteRuleType?: 'MANDATORY' | 'PRIOR' | 'COREQUISITE';
    }
  ) => Promise<{ ok: boolean; warning?: string; error?: string }>;
  updateCourse: (courseId: string, payload: Partial<CourseSubject>) => Promise<{ ok: boolean; error?: string }>;
  deleteCourse: (courseId: string) => Promise<{ ok: boolean; error?: string }>;
  addPrerequisite: (
    courseId: string,
    prerequisiteCourseId: string,
    ruleType: 'MANDATORY' | 'PRIOR' | 'COREQUISITE'
  ) => Promise<{ ok: boolean; error?: string }>;
  updateRoomStatus: (roomId: string, status: 'AVAILABLE' | 'MAINTENANCE' | 'LOCKED') => Promise<void>;
  toggleInstructorAvailability: (
    instructorId: string,
    dayOfWeek: number,
    shift: 'MORNING' | 'AFTERNOON' | 'EVENING',
    constraintType: 'HARD_BUSY' | 'SOFT_AVOID' | null,
    reason?: string
  ) => Promise<void>;
  reportIncident: (payload: {
    roomId: string;
    category: 'PROJECTOR' | 'AC' | 'AUDIO' | 'COMPUTER' | 'FURNITURE';
    description: string;
    sessionTimeLabel: string;
  }) => Promise<boolean>;
  updateIncidentStatus: (incidentId: string, status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED') => Promise<void>;
  syncIntegration: (target: 'SIS' | 'LMS') => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  resetDemoData: () => Promise<void>;
  assignInstructorToSection: (payload: {
    sectionId: string;
    instructorId: string;
    role: InstructorRole;
    assignedPeriods: number;
  }) => Promise<boolean>;
  createSystemUser: (payload: {
    username: string;
    fullName: string;
    email: string;
    role: UserRole;
    facultyId?: string;
    departmentName: string;
    mfaEnabled?: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  updateSystemUser: (userId: string, payload: Partial<SystemUser>) => Promise<{ ok: boolean; error?: string }>;
  deleteSystemUser: (userId: string) => Promise<{ ok: boolean; error?: string }>;
  toggleUserStatus: (userId: string) => Promise<void>;
  updateUserRole: (userId: string, role: UserRole) => Promise<void>;
  toggleNotificationChannel: (channelId: string) => Promise<void>;
  testNotificationChannel: (channelId: string) => Promise<void>;
  runScheduledJob: (jobId: string) => Promise<{ ok: boolean; summary?: string }>;
  toggleScheduledJob: (jobId: string) => Promise<void>;
  updateSystemParams: (params: Partial<SystemParameters>) => Promise<boolean>;
  // Full System Master Data CRUD
  createBuilding: (payload: Partial<Building>) => Promise<{ ok: boolean; error?: string }>;
  updateBuilding: (buildingId: string, payload: Partial<Building>) => Promise<{ ok: boolean; error?: string }>;
  deleteBuilding: (buildingId: string) => Promise<{ ok: boolean; error?: string }>;
  createFaculty: (payload: Partial<Faculty>) => Promise<{ ok: boolean; error?: string }>;
  updateFaculty: (facultyId: string, payload: Partial<Faculty>) => Promise<{ ok: boolean; error?: string }>;
  deleteFaculty: (facultyId: string) => Promise<{ ok: boolean; error?: string }>;
  createClassroom: (payload: Partial<Classroom>) => Promise<{ ok: boolean; error?: string }>;
  updateClassroom: (roomId: string, payload: Partial<Classroom>) => Promise<{ ok: boolean; error?: string }>;
  deleteClassroom: (roomId: string) => Promise<{ ok: boolean; error?: string }>;
  createExamModel: (payload: Partial<ExamModel>) => Promise<{ ok: boolean; error?: string }>;
  updateExamModel: (modelId: string, payload: Partial<ExamModel>) => Promise<{ ok: boolean; error?: string }>;
  deleteExamModel: (modelId: string) => Promise<{ ok: boolean; error?: string }>;
  createInstructor: (payload: Partial<Instructor>) => Promise<{ ok: boolean; error?: string }>;
  updateInstructor: (instructorId: string, payload: Partial<Instructor>) => Promise<{ ok: boolean; error?: string }>;
  deleteInstructor: (instructorId: string) => Promise<{ ok: boolean; error?: string }>;
  // Granular Role Groups CRUD
  createRoleGroup: (payload: Partial<RoleGroup>) => Promise<{ ok: boolean; error?: string }>;
  updateRoleGroup: (groupId: string, payload: Partial<RoleGroup>) => Promise<{ ok: boolean; error?: string }>;
  deleteRoleGroup: (groupId: string) => Promise<{ ok: boolean; error?: string }>;
  resetRoleGroups: () => Promise<boolean>;
}

const UTSContext = createContext<UTSContextValue | null>(null);

export const UTSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<UTSState>(() => createInitialUTSState());
  const [loading, setLoading] = useState<boolean>(true);
  const [activeNav, setActiveNavState] = useState<NavSectionId>('dashboard');
  const [drillDown, setDrillDown] = useState<DrillDownContext | null>(null);
  const [highlightedSessionId, setHighlightedSessionId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<RoleProfile>(ROLE_PROFILES[0]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const setActiveNav = useCallback((nav: NavSectionId) => {
    setActiveNavState(nav);
    setDrillDown(null);
  }, []);

  const navigateWithDrillDown = useCallback((nav: NavSectionId, context: DrillDownContext) => {
    setDrillDown(context);
    setActiveNavState(nav);
  }, []);

  const clearDrillDown = useCallback(() => {
    setDrillDown(null);
  }, []);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [{ ...toast, id }, ...prev].slice(0, 4));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshState = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/state');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setState(json.data);
          // Cache locally for Mobile App Offline Mode (SRS-MOB-01)
          try {
            localStorage.setItem('uts_offline_cache_v1', JSON.stringify(json.data));
            localStorage.setItem('uts_offline_cache_ts', new Date().toISOString());
          } catch {
            // ignore quota error
          }
        }
      }
    } catch {
      // keep initial/cached state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  const roleCapabilities = deriveRoleCapabilitiesFromGroups(state.roleGroups, currentRole.role);

  const hasPermission = useCallback(
    (fn: PermissionFunctionId, action: CrudAction) =>
      checkRolePermission(state.roleGroups, currentRole.role, fn, action),
    [state.roleGroups, currentRole.role]
  );

  const switchRole = useCallback(
    (role: UserRole) => {
      const profile = ROLE_PROFILES.find((r) => r.role === role) ?? ROLE_PROFILES[0];
      const nextCaps = deriveRoleCapabilitiesFromGroups(state.roleGroups, role);
      setCurrentRole(profile);
      setActiveNavState((prevNav) => (isNavAllowedForRole(role, prevNav, state.roleGroups) ? prevNav : 'dashboard'));
      setDrillDown(null);
      addToast({
        type: 'info',
        title: `Đã chuyển vai trò: ${profile.label}`,
        detail: `${nextCaps.scopeSummary}`,
      });
    },
    [state.roleGroups, addToast]
  );

  const assignSession: UTSContextValue['assignSession'] = useCallback(
    async (payload) => {
      const res = await fetch('/api/v1/scheduling/sessions/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          week_index: state.activeWeek,
          executedBy: currentRole.userName,
          executedRole: currentRole.role,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { ok: false, error: json.error };
      }
      setState(json.data.state);
      localStorage.setItem('uts_offline_cache_v1', JSON.stringify(json.data.state));
      addToast({
        type: json.data.warnings?.length ? 'warning' : 'success',
        title: 'Đã cập nhật lịch thành công',
        detail:
          json.data.warnings?.length > 0
            ? `Lưu ý mềm: ${json.data.warnings[0].message}`
            : `Kiểm tra ràng buộc 0 xung đột (${json.meta?.execution_time_ms ?? 5}ms).`,
      });
      return { ok: true, warnings: json.data.warnings };
    },
    [state.activeWeek, currentRole, addToast]
  );

  const splitSection = useCallback(
    async (sectionId: string, numGroups = 2) => {
      const res = await fetch('/api/v1/scheduling/sessions/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId,
          numGroups,
          executedBy: currentRole.userName,
          executedRole: currentRole.role,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setState(json.data);
        addToast({
          type: 'success',
          title: `Đã tách thành ${numGroups} tốp thực hành Lab`,
          detail: 'Các tốp nhỏ đã sẵn sàng trong hàng đợi để xếp ca so le vào phòng Lab.',
        });
        return true;
      }
      return false;
    },
    [currentRole, addToast]
  );

  const mergeSections = useCallback(
    async (sectionIds: string[]) => {
      const res = await fetch('/api/v1/scheduling/sessions/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionIds,
          executedBy: currentRole.userName,
          executedRole: currentRole.role,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setState(json.data);
        addToast({
          type: 'success',
          title: `Đã ghép ${sectionIds.length} lớp lý thuyết thành công`,
          detail: 'Lớp ghép mới đã chuyển vào hàng đợi để bố trí vào Hội trường lớn.',
        });
        return true;
      }
      addToast({ type: 'error', title: 'Không thể ghép lớp', detail: json.error?.message });
      return false;
    },
    [currentRole, addToast]
  );

  const autoSolveCSP = useCallback(async () => {
    const res = await fetch('/api/v1/scheduling/auto-solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        executedBy: currentRole.userName,
        executedRole: currentRole.role,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      addToast({ type: 'error', title: 'Chưa thể chạy bộ giải CSP', detail: json.error?.message });
      return { placed: 0, unplaced: 0 };
    }
    setState(json.data.state);
    const placed = json.data.placedSectionIds.length;
    const unplaced = json.data.unplacedSectionIds.length;
    addToast({
      type: placed > 0 ? 'success' : 'warning',
      title: `Bộ giải CSP hoàn tất: Xếp ${placed} lớp thành công`,
      detail:
        unplaced > 0
          ? `Còn ${unplaced} lớp cần tách tốp Lab (sĩ số vượt sức chứa phòng Lab hiện có).`
          : 'Toàn bộ lớp trong hàng đợi đã được phân bổ tối ưu với 0 xung đột cứng.',
    });
    return { placed, unplaced };
  }, [currentRole, addToast]);

  const toggleFreeze = useCallback(
    async (isFrozen: boolean, lifecycleStage?: LifecycleStage) => {
      const res = await fetch('/api/v1/scheduling/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isFrozen,
          lifecycleStage,
          executedBy: currentRole.userName,
          executedRole: currentRole.role,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setState(json.data);
        addToast({
          type: isFrozen ? 'info' : 'warning',
          title: isFrozen ? 'Đã Đóng băng Thời khóa biểu (Mốc T-1)' : 'Đã mở khóa chỉnh sửa dự thảo',
          detail: isFrozen
            ? 'Mọi thay đổi phát sinh từ lúc này bắt buộc đi qua quy trình Phê duyệt Đa cấp.'
            : 'Chuyên viên đào tạo có thể kéo thả và điều chỉnh trực tiếp trên lưới.',
        });
      }
    },
    [currentRole, addToast]
  );

  const submitChangeRequest: UTSContextValue['submitChangeRequest'] = useCallback(
    async (payload) => {
      const res = await fetch('/api/v1/mobile/instructor/reschedule-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        addToast({ type: 'error', title: 'Yêu cầu đổi lịch bị chặn do xung đột', detail: json.error?.message });
        return { ok: false, error: json.error?.message };
      }
      setState(json.data.state);
      addToast({
        type: 'success',
        title: `Đã gửi đơn thành công (${json.data.request.requestId})`,
        detail: 'Hồ sơ đã chuyển tự động tới Trưởng Bộ môn (Hạn SLA 12h).',
      });
      return { ok: true, requestId: json.data.request.requestId };
    },
    [addToast]
  );

  const processRequestAction: UTSContextValue['processRequestAction'] = useCallback(
    async (requestId, action, note, overrideRoomId) => {
      const res = await fetch(`/api/v1/requests/${requestId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          note,
          overrideRoomId,
          executedBy: currentRole.userName,
          executedRole: currentRole.role,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        addToast({ type: 'error', title: 'Lỗi xử lý phê duyệt', detail: json.error?.message });
        return { ok: false, error: json.error?.message };
      }
      setState(json.data);
      addToast({
        type: action === 'APPROVE' ? 'success' : 'warning',
        title: action === 'APPROVE' ? `Đã phê duyệt hồ sơ ${requestId}` : `Đã từ chối hồ sơ ${requestId}`,
        detail: 'Thời khóa biểu, Nhật ký Kiểm toán và Push Notification đã đồng bộ tức thời.',
      });
      return { ok: true };
    },
    [currentRole, addToast]
  );

  const rollbackAudit = useCallback(
    async (logId: string) => {
      const res = await fetch(`/api/v1/audit/${logId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executedBy: currentRole.userName, executedRole: currentRole.role }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setState(json.data);
        addToast({
          type: 'warning',
          title: `Đã quay lui trạng thái (Rollback) cho ${logId}`,
          detail: 'Buổi học đã khôi phục về trạng thái gốc và phát thông báo đính chính.',
        });
        return true;
      }
      return false;
    },
    [currentRole, addToast]
  );

  const createCourse: UTSContextValue['createCourse'] = useCallback(
    async (payload) => {
      const res = await fetch('/api/v1/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          executedBy: currentRole.userName,
          executedRole: currentRole.role,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        addToast({ type: 'error', title: json.error?.code ?? 'Lỗi thêm học phần', detail: json.error?.message });
        return { ok: false, error: json.error?.message };
      }
      setState(json.data.state);
      const warn = json.data.warning?.message;
      addToast({
        type: warn ? 'warning' : 'success',
        title: `Đã tạo học phần ${json.data.course.courseCode}`,
        detail: warn || 'Định mức tiết LT/BT/TL/TH hợp lệ với số tín chỉ.',
      });
      return { ok: true, warning: warn };
    },
    [currentRole, addToast]
  );

  const updateCourse: UTSContextValue['updateCourse'] = useCallback(
    async (courseId, payload) => {
      const res = await fetch(`/api/v1/courses/${courseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, executedBy: currentRole.userName, executedRole: currentRole.role }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        addToast({ type: 'error', title: 'Lỗi cập nhật học phần', detail: json.error?.message });
        return { ok: false, error: json.error?.message };
      }
      setState(json.data);
      addToast({ type: 'success', title: 'Đã cập nhật thông tin học phần' });
      return { ok: true };
    },
    [currentRole, addToast]
  );

  const deleteCourse: UTSContextValue['deleteCourse'] = useCallback(
    async (courseId) => {
      const res = await fetch(`/api/v1/courses/${courseId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executedBy: currentRole.userName, executedRole: currentRole.role }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        addToast({ type: 'error', title: 'Không thể xóa học phần', detail: json.error?.message });
        return { ok: false, error: json.error?.message };
      }
      setState(json.data);
      addToast({ type: 'success', title: 'Đã xóa học phần khỏi danh mục' });
      return { ok: true };
    },
    [currentRole, addToast]
  );

  const addPrerequisite: UTSContextValue['addPrerequisite'] = useCallback(
    async (courseId, prerequisiteCourseId, ruleType) => {
      const res = await fetch('/api/v1/prerequisites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, prerequisiteCourseId, ruleType }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        addToast({
          type: 'error',
          title: json.error?.code ?? 'ERR_CYCLIC_PREREQUISITE',
          detail: json.error?.message,
        });
        return { ok: false, error: json.error?.message };
      }
      setState(json.data);
      addToast({ type: 'success', title: 'Đã thiết lập ràng buộc môn tiên quyết' });
      return { ok: true };
    },
    [addToast]
  );

  const updateRoomStatus = useCallback(
    async (roomId: string, operationalStatus: 'AVAILABLE' | 'MAINTENANCE' | 'LOCKED') => {
      const res = await fetch(`/api/v1/classrooms/${roomId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationalStatus }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setState(json.data);
        addToast({ type: 'info', title: 'Đã cập nhật trạng thái phòng học & BMS/IoT' });
      }
    },
    [addToast]
  );

  const toggleInstructorAvailability = useCallback(
    async (
      instructorId: string,
      dayOfWeek: number,
      shift: 'MORNING' | 'AFTERNOON' | 'EVENING',
      constraintType: 'HARD_BUSY' | 'SOFT_AVOID' | null,
      reason?: string
    ) => {
      const res = await fetch(`/api/v1/instructors/${instructorId}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayOfWeek, shift, constraintType, reason }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setState(json.data);
      }
    },
    []
  );

  const reportIncident: UTSContextValue['reportIncident'] = useCallback(
    async (payload) => {
      const res = await fetch('/api/v1/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          reportedBy: currentRole.userName,
          reporterRole: currentRole.role,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setState(json.data);
        addToast({
          type: 'success',
          title: 'Đã gửi báo cáo sự cố thiết bị hiện trường',
          detail: 'Bộ phận Quản trị Giảng đường đã tiếp nhận thông tin.',
        });
        return true;
      }
      return false;
    },
    [currentRole, addToast]
  );

  const updateIncidentStatus = useCallback(
    async (incidentId: string, status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED') => {
      const res = await fetch(`/api/v1/incidents/${incidentId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setState(json.data);
        addToast({ type: 'success', title: `Đã cập nhật trạng thái sự cố ${incidentId}` });
      }
    },
    [addToast]
  );

  const syncIntegration = useCallback(
    async (target: 'SIS' | 'LMS') => {
      const res = await fetch('/api/v1/integrations/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setState(json.data);
        addToast({
          type: 'success',
          title:
            target === 'SIS'
              ? 'Đồng bộ 2 chiều SIS thành công'
              : 'Khởi tạo Course Shell & đồng bộ LMS thành công',
          detail:
            target === 'SIS'
              ? 'Đã cập nhật danh sách sinh viên, lớp cơ hữu và trạng thái học vụ.'
              : 'Đã tạo lớp học trực tuyến và phân quyền Giảng viên/Sinh viên trên Moodle/Canvas.',
        });
      }
    },
    [addToast]
  );

  const markAllNotificationsRead = useCallback(async () => {
    const res = await fetch('/api/v1/notifications/read-all', { method: 'POST' });
    const json = await res.json();
    if (res.ok && json.success) {
      setState(json.data);
    }
  }, []);

  const resetDemoData = useCallback(async () => {
    const res = await fetch('/api/v1/reset', { method: 'POST' });
    const json = await res.json();
    if (res.ok && json.success) {
      setState(json.data);
      addToast({ type: 'info', title: 'Đã khôi phục dữ liệu mẫu chuẩn ban đầu' });
    }
  }, [addToast]);

  const assignInstructorToSection: UTSContextValue['assignInstructorToSection'] = useCallback(
    async ({ sectionId, instructorId, role, assignedPeriods }) => {
      const res = await fetch(`/api/v1/sections/${sectionId}/assign-instructor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorId,
          role,
          assignedPeriods,
          executedBy: currentRole.userName,
          executedRole: currentRole.role,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setState(json.data);
        addToast({ type: 'success', title: 'Đã cập nhật phân công giảng viên vào lớp học phần' });
        return true;
      }
      addToast({ type: 'error', title: 'Không thể phân công giảng viên', detail: json.error?.message });
      return false;
    },
    [currentRole, addToast]
  );

  const createSystemUser: UTSContextValue['createSystemUser'] = useCallback(
    async (payload) => {
      const res = await fetch('/api/v1/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          executedBy: currentRole.userName,
          executedRole: currentRole.role,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        addToast({ type: 'error', title: 'Lỗi tạo tài khoản người dùng', detail: json.error?.message });
        return { ok: false, error: json.error?.message };
      }
      setState(json.data);
      addToast({ type: 'success', title: `Đã tạo tài khoản ${payload.username}` });
      return { ok: true };
    },
    [currentRole, addToast]
  );

  const toggleUserStatus = useCallback(
    async (userId: string) => {
      const res = await fetch(`/api/v1/admin/users/${userId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executedBy: currentRole.userName, executedRole: currentRole.role }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setState(json.data);
        addToast({ type: 'info', title: 'Đã thay đổi trạng thái hoạt động tài khoản' });
      }
    },
    [currentRole, addToast]
  );

  const updateUserRole = useCallback(
    async (userId: string, role: UserRole) => {
      const res = await fetch(`/api/v1/admin/users/${userId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, executedBy: currentRole.userName, executedRole: currentRole.role }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setState(json.data);
        addToast({ type: 'success', title: `Đã cập nhật vai trò RBAC sang ${role}` });
      }
    },
    [currentRole, addToast]
  );

  const toggleNotificationChannel = useCallback(
    async (channelId: string) => {
      const res = await fetch(`/api/v1/admin/notifications/${channelId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executedBy: currentRole.userName, executedRole: currentRole.role }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setState(json.data);
        addToast({ type: 'info', title: 'Đã cập nhật cấu hình kênh thông báo' });
      }
    },
    [currentRole, addToast]
  );

  const testNotificationChannel = useCallback(
    async (channelId: string) => {
      const res = await fetch(`/api/v1/admin/notifications/${channelId}/test`, { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success) {
        setState(json.data);
        addToast({
          type: 'success',
          title: 'Đã phát thông báo kiểm thử thành công',
          detail: 'Kiểm tra ngay ở biểu tượng chuông Thông báo trên thanh Topbar.',
        });
      }
    },
    [addToast]
  );

  const runScheduledJob = useCallback(
    async (jobId: string) => {
      const res = await fetch(`/api/v1/admin/jobs/${jobId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executedBy: currentRole.userName, executedRole: currentRole.role }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setState(json.data.state);
        addToast({
          type: 'success',
          title: `Hoàn tất Job ${json.data.job.jobCode} (${json.data.job.lastDurationMs}ms)`,
          detail: json.data.job.lastSummary,
        });
        return { ok: true, summary: json.data.job.lastSummary };
      }
      return { ok: false };
    },
    [currentRole, addToast]
  );

  const toggleScheduledJob = useCallback(
    async (jobId: string) => {
      const res = await fetch(`/api/v1/admin/jobs/${jobId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executedBy: currentRole.userName, executedRole: currentRole.role }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setState(json.data);
        addToast({ type: 'info', title: 'Đã cập nhật trạng thái lịch chạy Job tự động' });
      }
    },
    [currentRole, addToast]
  );

  const updateSystemParams = useCallback(
    async (params: Partial<SystemParameters>) => {
      const res = await fetch('/api/v1/admin/params', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params, executedBy: currentRole.userName, executedRole: currentRole.role }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setState(json.data);
        addToast({ type: 'success', title: 'Đã lưu Tham số vận hành Hệ thống' });
        return true;
      }
      return false;
    },
    [currentRole, addToast]
  );

  // Generic helper for full Master Data & Admin CRUD endpoints
  const runCrudRequest = useCallback(
    async (
      url: string,
      method: 'POST' | 'PUT' | 'DELETE',
      payload: Record<string, unknown>,
      successTitle: string,
      errorTitle: string
    ): Promise<{ ok: boolean; error?: string }> => {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          executedBy: currentRole.userName,
          executedRole: currentRole.role,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        addToast({ type: 'error', title: errorTitle, detail: json.error?.message });
        return { ok: false, error: json.error?.message };
      }
      setState(json.data);
      addToast({ type: 'success', title: successTitle });
      return { ok: true };
    },
    [currentRole, addToast]
  );

  const updateSystemUser: UTSContextValue['updateSystemUser'] = useCallback(
    (userId, payload) =>
      runCrudRequest(`/api/v1/admin/users/${userId}`, 'PUT', payload as Record<string, unknown>, 'Đã cập nhật tài khoản người dùng', 'Lỗi cập nhật tài khoản'),
    [runCrudRequest]
  );

  const deleteSystemUser: UTSContextValue['deleteSystemUser'] = useCallback(
    (userId) =>
      runCrudRequest(`/api/v1/admin/users/${userId}`, 'DELETE', {}, 'Đã xóa tài khoản người dùng', 'Không thể xóa tài khoản'),
    [runCrudRequest]
  );

  const createBuilding: UTSContextValue['createBuilding'] = useCallback(
    (payload) =>
      runCrudRequest('/api/v1/master/buildings', 'POST', payload as Record<string, unknown>, 'Đã thêm mới Tòa nhà', 'Lỗi thêm Tòa nhà'),
    [runCrudRequest]
  );

  const updateBuilding: UTSContextValue['updateBuilding'] = useCallback(
    (buildingId, payload) =>
      runCrudRequest(`/api/v1/master/buildings/${buildingId}`, 'PUT', payload as Record<string, unknown>, 'Đã cập nhật thông tin Tòa nhà', 'Lỗi cập nhật Tòa nhà'),
    [runCrudRequest]
  );

  const deleteBuilding: UTSContextValue['deleteBuilding'] = useCallback(
    (buildingId) =>
      runCrudRequest(`/api/v1/master/buildings/${buildingId}`, 'DELETE', {}, 'Đã xóa Tòa nhà khỏi danh mục', 'Không thể xóa Tòa nhà'),
    [runCrudRequest]
  );

  const createFaculty: UTSContextValue['createFaculty'] = useCallback(
    (payload) =>
      runCrudRequest('/api/v1/master/faculties', 'POST', payload as Record<string, unknown>, 'Đã thêm mới Khoa đào tạo', 'Lỗi thêm Khoa'),
    [runCrudRequest]
  );

  const updateFaculty: UTSContextValue['updateFaculty'] = useCallback(
    (facultyId, payload) =>
      runCrudRequest(`/api/v1/master/faculties/${facultyId}`, 'PUT', payload as Record<string, unknown>, 'Đã cập nhật thông tin Khoa', 'Lỗi cập nhật Khoa'),
    [runCrudRequest]
  );

  const deleteFaculty: UTSContextValue['deleteFaculty'] = useCallback(
    (facultyId) =>
      runCrudRequest(`/api/v1/master/faculties/${facultyId}`, 'DELETE', {}, 'Đã xóa Khoa đào tạo', 'Không thể xóa Khoa'),
    [runCrudRequest]
  );

  const createClassroom: UTSContextValue['createClassroom'] = useCallback(
    (payload) =>
      runCrudRequest('/api/v1/master/classrooms', 'POST', payload as Record<string, unknown>, 'Đã thêm mới Phòng học', 'Lỗi thêm Phòng học'),
    [runCrudRequest]
  );

  const updateClassroom: UTSContextValue['updateClassroom'] = useCallback(
    (roomId, payload) =>
      runCrudRequest(`/api/v1/master/classrooms/${roomId}`, 'PUT', payload as Record<string, unknown>, 'Đã cập nhật thông tin Phòng học', 'Lỗi cập nhật Phòng học'),
    [runCrudRequest]
  );

  const deleteClassroom: UTSContextValue['deleteClassroom'] = useCallback(
    (roomId) =>
      runCrudRequest(`/api/v1/master/classrooms/${roomId}`, 'DELETE', {}, 'Đã xóa Phòng học', 'Không thể xóa Phòng học'),
    [runCrudRequest]
  );

  const createExamModel: UTSContextValue['createExamModel'] = useCallback(
    (payload) =>
      runCrudRequest('/api/v1/master/exam-models', 'POST', payload as Record<string, unknown>, 'Đã thêm mới Mô hình thi', 'Lỗi thêm Mô hình thi'),
    [runCrudRequest]
  );

  const updateExamModel: UTSContextValue['updateExamModel'] = useCallback(
    (modelId, payload) =>
      runCrudRequest(`/api/v1/master/exam-models/${modelId}`, 'PUT', payload as Record<string, unknown>, 'Đã cập nhật Mô hình thi', 'Lỗi cập nhật Mô hình thi'),
    [runCrudRequest]
  );

  const deleteExamModel: UTSContextValue['deleteExamModel'] = useCallback(
    (modelId) =>
      runCrudRequest(`/api/v1/master/exam-models/${modelId}`, 'DELETE', {}, 'Đã xóa Mô hình thi', 'Không thể xóa Mô hình thi'),
    [runCrudRequest]
  );

  const createInstructor: UTSContextValue['createInstructor'] = useCallback(
    (payload) =>
      runCrudRequest('/api/v1/master/instructors', 'POST', payload as Record<string, unknown>, 'Đã thêm mới Giảng viên', 'Lỗi thêm Giảng viên'),
    [runCrudRequest]
  );

  const updateInstructor: UTSContextValue['updateInstructor'] = useCallback(
    (instructorId, payload) =>
      runCrudRequest(`/api/v1/master/instructors/${instructorId}`, 'PUT', payload as Record<string, unknown>, 'Đã cập nhật hồ sơ Giảng viên', 'Lỗi cập nhật Giảng viên'),
    [runCrudRequest]
  );

  const deleteInstructor: UTSContextValue['deleteInstructor'] = useCallback(
    (instructorId) =>
      runCrudRequest(`/api/v1/master/instructors/${instructorId}`, 'DELETE', {}, 'Đã xóa hồ sơ Giảng viên', 'Không thể xóa Giảng viên'),
    [runCrudRequest]
  );

  const createRoleGroup: UTSContextValue['createRoleGroup'] = useCallback(
    (payload) =>
      runCrudRequest('/api/v1/admin/role-groups', 'POST', payload as Record<string, unknown>, 'Đã tạo Nhóm quyền mới', 'Lỗi tạo Nhóm quyền'),
    [runCrudRequest]
  );

  const updateRoleGroup: UTSContextValue['updateRoleGroup'] = useCallback(
    (groupId, payload) =>
      runCrudRequest(`/api/v1/admin/role-groups/${groupId}`, 'PUT', payload as Record<string, unknown>, 'Đã đồng bộ Ma trận Phân quyền chi tiết toàn hệ thống', 'Lỗi cập nhật Nhóm quyền'),
    [runCrudRequest]
  );

  const deleteRoleGroup: UTSContextValue['deleteRoleGroup'] = useCallback(
    (groupId) =>
      runCrudRequest(`/api/v1/admin/role-groups/${groupId}`, 'DELETE', {}, 'Đã xóa Nhóm quyền tùy chỉnh', 'Không thể xóa Nhóm quyền'),
    [runCrudRequest]
  );

  const resetRoleGroups = useCallback(async () => {
    const res = await runCrudRequest(
      '/api/v1/admin/role-groups/reset',
      'POST',
      {},
      'Đã khôi phục Ma trận Phân quyền mặc định',
      'Lỗi khôi phục Nhóm quyền'
    );
    return res.ok;
  }, [runCrudRequest]);

  return (
    <UTSContext.Provider
      value={{
        state,
        loading,
        activeNav,
        setActiveNav,
        drillDown,
        navigateWithDrillDown,
        clearDrillDown,
        highlightedSessionId,
        setHighlightedSessionId,
        currentRole,
        roleCapabilities,
        hasPermission,
        switchRole,
        toasts,
        addToast,
        dismissToast,
        refreshState,
        assignSession,
        splitSection,
        mergeSections,
        autoSolveCSP,
        toggleFreeze,
        submitChangeRequest,
        processRequestAction,
        rollbackAudit,
        createCourse,
        updateCourse,
        deleteCourse,
        addPrerequisite,
        updateRoomStatus,
        toggleInstructorAvailability,
        reportIncident,
        updateIncidentStatus,
        syncIntegration,
        markAllNotificationsRead,
        resetDemoData,
        assignInstructorToSection,
        createSystemUser,
        updateSystemUser,
        deleteSystemUser,
        toggleUserStatus,
        updateUserRole,
        toggleNotificationChannel,
        testNotificationChannel,
        runScheduledJob,
        toggleScheduledJob,
        updateSystemParams,
        createBuilding,
        updateBuilding,
        deleteBuilding,
        createFaculty,
        updateFaculty,
        deleteFaculty,
        createClassroom,
        updateClassroom,
        deleteClassroom,
        createExamModel,
        updateExamModel,
        deleteExamModel,
        createInstructor,
        updateInstructor,
        deleteInstructor,
        createRoleGroup,
        updateRoleGroup,
        deleteRoleGroup,
        resetRoleGroups,
      }}
    >
      {children}
    </UTSContext.Provider>
  );
};

export function useUTS(): UTSContextValue {
  const ctx = useContext(UTSContext);
  if (!ctx) throw new Error('useUTS must be used inside UTSProvider');
  return ctx;
}
