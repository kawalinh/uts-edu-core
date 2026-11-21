import type {
  CrudAction,
  CrudPermission,
  PermissionFunctionId,
  RoleGroup,
  UserRole,
} from '../types/uts';

export type NavSectionId =
  | 'dashboard'
  | 'admin'
  | 'builder'
  | 'master'
  | 'workflow'
  | 'planning'
  | 'reports'
  | 'mobile'
  | 'rbac';

export interface PermissionFunctionMeta {
  id: PermissionFunctionId;
  moduleGroup: 'Điều hành' | 'Master Data' | 'Nghiệp vụ Lập lịch' | 'Quản trị Hệ thống';
  label: string;
  description: string;
  navId: NavSectionId;
  actionHints: Record<CrudAction, string>;
}

export const PERMISSION_FUNCTIONS: PermissionFunctionMeta[] = [
  {
    id: 'DASHBOARD_KPI',
    moduleGroup: 'Điều hành',
    label: 'Dashboard KPI & Heatmap',
    description: 'Giám sát chỉ số RUR/SFR/SVI, SLA 24h & Drill-Down',
    navId: 'dashboard',
    actionHints: {
      view: 'Xem biểu đồ KPI, Heatmap',
      create: 'Tạo cấu hình báo cáo nhanh',
      update: 'Chạy tổng hợp/lọc KPI',
      delete: 'Xóa bộ lọc lưu sẵn',
    },
  },
  {
    id: 'MASTER_FACULTIES',
    moduleGroup: 'Master Data',
    label: 'Quản lý Khoa & Bộ môn',
    description: 'Danh mục Khoa, Trưởng Khoa, định mức giờ chuẩn',
    navId: 'master',
    actionHints: {
      view: 'Xem danh sách Khoa/Bộ môn',
      create: 'Thêm mới Khoa đào tạo',
      update: 'Sửa thông tin & định mức Khoa',
      delete: 'Xóa Khoa không còn dữ liệu',
    },
  },
  {
    id: 'MASTER_BUILDINGS',
    moduleGroup: 'Master Data',
    label: 'Quản lý Tòa nhà & Cơ sở',
    description: 'Tòa nhà, cơ sở đào tạo, số tầng, nhóm khoảng cách (>500m)',
    navId: 'master',
    actionHints: {
      view: 'Xem danh mục Tòa nhà',
      create: 'Thêm mới Tòa nhà / Cơ sở',
      update: 'Cập nhật thông tin Tòa nhà',
      delete: 'Xóa Tòa nhà chưa có phòng',
    },
  },
  {
    id: 'MASTER_ROOMS',
    moduleGroup: 'Master Data',
    label: 'Quản lý Phòng học & BMS/IoT',
    description: 'Phòng học, loại phòng, sức chứa, thiết bị, trạng thái bảo trì',
    navId: 'master',
    actionHints: {
      view: 'Xem danh sách phòng & RUR',
      create: 'Thêm mới Phòng học / Lab',
      update: 'Sửa sức chứa, loại phòng, trạng thái',
      delete: 'Xóa Phòng chưa có lịch học',
    },
  },
  {
    id: 'MASTER_COURSES',
    moduleGroup: 'Master Data',
    label: 'Quản lý Học phần & Tiên quyết',
    description: 'Cấu trúc LT/BT/TL/TH, đa loại phòng bắt buộc, mô hình thi, tiên quyết',
    navId: 'master',
    actionHints: {
      view: 'Xem danh mục Học phần',
      create: 'Thêm mới Học phần & tiên quyết',
      update: 'Sửa định mức tiết & loại phòng',
      delete: 'Xóa Học phần chưa mở lớp',
    },
  },
  {
    id: 'MASTER_INSTRUCTORS',
    moduleGroup: 'Master Data',
    label: 'Quản lý Giảng viên & Phân công',
    description: 'Hồ sơ Giảng viên, lịch bận Hard/Soft & phân công đa GV',
    navId: 'master',
    actionHints: {
      view: 'Xem hồ sơ & tải Giảng viên',
      create: 'Thêm mới hồ sơ Giảng viên',
      update: 'Sửa GV, phân công & lịch bận',
      delete: 'Xóa GV chưa được phân công',
    },
  },
  {
    id: 'MASTER_EXAM_MODELS',
    moduleGroup: 'Master Data',
    label: 'Quản lý Mô hình thi',
    description: 'Chuẩn thi cuốn chiếu, tập trung, thực hành máy, đồ án, tỷ lệ giám thị',
    navId: 'planning',
    actionHints: {
      view: 'Xem danh mục Mô hình thi',
      create: 'Thêm mới Mô hình thi',
      update: 'Sửa thời lượng, tỷ lệ lấp đầy',
      delete: 'Xóa Mô hình thi không dùng',
    },
  },
  {
    id: 'TIMETABLE_BUILDER',
    moduleGroup: 'Nghiệp vụ Lập lịch',
    label: 'Lập lịch Trực quan & CSP Solver',
    description: 'Lưới xếp lịch 4 góc nhìn, kéo thả, CSP tự động, tách/ghép, đóng băng',
    navId: 'builder',
    actionHints: {
      view: 'Xem lưới TKB & xuất .ics',
      create: 'Xếp buổi mới / Chạy CSP Solver',
      update: 'Kéo thả, Tách/Ghép, Đóng băng',
      delete: 'Hủy/Xóa phiên xếp lịch nháp',
    },
  },
  {
    id: 'APPROVAL_WORKFLOW',
    moduleGroup: 'Nghiệp vụ Lập lịch',
    label: 'Phê duyệt Biến động & Audit Log',
    description: 'Đơn báo nghỉ/dạy bù, Duyệt Cấp 1/Cấp 2, Nhật ký Kiểm toán & Rollback',
    navId: 'workflow',
    actionHints: {
      view: 'Xem đơn biến động & Audit Log',
      create: 'Khởi tạo đơn báo nghỉ/đổi lịch',
      update: 'Phê duyệt / Từ chối đơn biến động',
      delete: 'Thực hiện Rollback nhật ký',
    },
  },
  {
    id: 'PLANNING_EXAMS',
    moduleGroup: 'Nghiệp vụ Lập lịch',
    label: 'Kế hoạch 15 Tuần & Lịch thi',
    description: 'Tiến độ T-12→T-1, phân bổ tuần học, xếp lịch thi & phân công giám thị',
    navId: 'planning',
    actionHints: {
      view: 'Xem kế hoạch tuần & lịch thi',
      create: 'Tạo mới ca thi học kỳ',
      update: 'Chỉnh sửa ca thi / giám thị',
      delete: 'Hủy / Xóa ca thi nháp',
    },
  },
  {
    id: 'REPORTS_INTEGRATIONS',
    moduleGroup: 'Điều hành',
    label: 'Báo cáo SFR, Xuất dữ liệu & SIS/LMS',
    description: 'Phân tích SFR, xuất CSV/JSON/In ấn, đồng bộ SIS/LMS & xử lý sự cố',
    navId: 'reports',
    actionHints: {
      view: 'Xem báo cáo & Xuất CSV/In ấn',
      create: 'Gửi báo cáo sự cố thiết bị',
      update: 'Chạy đồng bộ SIS/LMS & xử lý sự cố',
      delete: 'Xóa log đồng bộ cũ',
    },
  },
  {
    id: 'ADMIN_USERS_ROLES',
    moduleGroup: 'Quản trị Hệ thống',
    label: 'Quản trị Người dùng, Nhóm quyền & Jobs',
    description: 'Tài khoản SSO, Nhóm quyền CRUD, Kênh Thông báo, Cron Jobs & Tham số',
    navId: 'admin',
    actionHints: {
      view: 'Truy cập phân hệ Quản trị HT',
      create: 'Tạo tài khoản & Nhóm quyền mới',
      update: 'Sửa quyền, bật/tắt Thông báo & Job',
      delete: 'Xóa tài khoản / Nhóm quyền tùy chỉnh',
    },
  },
];

const ALL_TRUE: CrudPermission = { view: true, create: true, update: true, delete: true };
const READ_ONLY: CrudPermission = { view: true, create: false, update: false, delete: false };
const NO_ACCESS: CrudPermission = { view: false, create: false, update: false, delete: false };

export function createDefaultRoleGroups(): RoleGroup[] {
  return [
    {
      groupId: 'GRP_SYS_ADMIN',
      roleCode: 'SYS_ADMIN',
      code: 'SYS_ADMIN',
      name: 'Quản trị viên Hệ thống',
      description: 'Toàn quyền CRUD danh mục Master Data hệ thống, tài khoản, nhóm quyền, kênh thông báo, Cron Jobs và tham số.',
      scopeLabel: 'Toàn hệ thống (Full CRUD)',
      isSystemDefault: true,
      isActive: true,
      permissions: {
        DASHBOARD_KPI: { ...ALL_TRUE },
        MASTER_FACULTIES: { ...ALL_TRUE },
        MASTER_BUILDINGS: { ...ALL_TRUE },
        MASTER_ROOMS: { ...ALL_TRUE },
        MASTER_COURSES: { ...ALL_TRUE },
        MASTER_INSTRUCTORS: { ...ALL_TRUE },
        MASTER_EXAM_MODELS: { ...ALL_TRUE },
        TIMETABLE_BUILDER: { ...ALL_TRUE },
        APPROVAL_WORKFLOW: { ...ALL_TRUE },
        PLANNING_EXAMS: { ...ALL_TRUE },
        REPORTS_INTEGRATIONS: { ...ALL_TRUE },
        ADMIN_USERS_ROLES: { ...ALL_TRUE },
      },
    },
    {
      groupId: 'GRP_EXECUTIVE',
      roleCode: 'EXECUTIVE',
      code: 'EXECUTIVE',
      name: 'Ban Giám hiệu / Trưởng phòng ĐT',
      description: 'Giám sát KPI toàn trường, ban hành & đóng băng TKB (T-1), phê duyệt ngoại lệ Cấp 2, Rollback & xuất báo cáo.',
      scopeLabel: 'Toàn trường (Giám sát & Phê chuẩn)',
      isSystemDefault: true,
      isActive: true,
      permissions: {
        DASHBOARD_KPI: { view: true, create: false, update: true, delete: false },
        MASTER_FACULTIES: { ...READ_ONLY },
        MASTER_BUILDINGS: { ...READ_ONLY },
        MASTER_ROOMS: { ...READ_ONLY },
        MASTER_COURSES: { ...READ_ONLY },
        MASTER_INSTRUCTORS: { ...READ_ONLY },
        MASTER_EXAM_MODELS: { ...READ_ONLY },
        TIMETABLE_BUILDER: { view: true, create: false, update: false, delete: false },
        APPROVAL_WORKFLOW: { view: true, create: false, update: true, delete: true },
        PLANNING_EXAMS: { view: true, create: false, update: true, delete: false },
        REPORTS_INTEGRATIONS: { view: true, create: false, update: true, delete: false },
        ADMIN_USERS_ROLES: { ...NO_ACCESS },
      },
    },
    {
      groupId: 'GRP_SCHEDULER',
      roleCode: 'SCHEDULER',
      code: 'SCHEDULER',
      name: 'Chuyên viên Phòng Đào tạo',
      description: 'Điều phối lịch học toàn trường, CRUD học phần/phòng học/mô hình thi/ca thi, chạy CSP Solver và duyệt Cấp 2.',
      scopeLabel: 'Toàn trường (Điều phối & Master học vụ)',
      isSystemDefault: true,
      isActive: true,
      permissions: {
        DASHBOARD_KPI: { view: true, create: false, update: true, delete: false },
        MASTER_FACULTIES: { view: true, create: true, update: true, delete: false },
        MASTER_BUILDINGS: { view: true, create: true, update: true, delete: false },
        MASTER_ROOMS: { ...ALL_TRUE },
        MASTER_COURSES: { ...ALL_TRUE },
        MASTER_INSTRUCTORS: { view: true, create: true, update: true, delete: false },
        MASTER_EXAM_MODELS: { ...ALL_TRUE },
        TIMETABLE_BUILDER: { ...ALL_TRUE },
        APPROVAL_WORKFLOW: { view: true, create: false, update: true, delete: true },
        PLANNING_EXAMS: { ...ALL_TRUE },
        REPORTS_INTEGRATIONS: { view: true, create: true, update: true, delete: false },
        ADMIN_USERS_ROLES: { ...NO_ACCESS },
      },
    },
    {
      groupId: 'GRP_FACULTY_HEAD',
      roleCode: 'FACULTY_HEAD',
      code: 'FACULTY_HEAD',
      name: 'Trưởng Khoa / Trưởng Bộ môn',
      description: 'Quản trị phạm vi Khoa CNTT: Phân công đa giảng viên, cập nhật lịch bận, đề xuất học phần và duyệt Cấp 1.',
      scopeLabel: 'Phạm vi Khoa CNTT (Duyệt Cấp 1 & Nhân sự Khoa)',
      isSystemDefault: true,
      isActive: true,
      permissions: {
        DASHBOARD_KPI: { ...READ_ONLY },
        MASTER_FACULTIES: { view: true, create: false, update: true, delete: false },
        MASTER_BUILDINGS: { ...READ_ONLY },
        MASTER_ROOMS: { ...READ_ONLY },
        MASTER_COURSES: { view: true, create: true, update: true, delete: false },
        MASTER_INSTRUCTORS: { view: true, create: true, update: true, delete: false },
        MASTER_EXAM_MODELS: { ...READ_ONLY },
        TIMETABLE_BUILDER: { ...READ_ONLY },
        APPROVAL_WORKFLOW: { view: true, create: true, update: true, delete: false },
        PLANNING_EXAMS: { ...READ_ONLY },
        REPORTS_INTEGRATIONS: { view: true, create: true, update: false, delete: false },
        ADMIN_USERS_ROLES: { ...NO_ACCESS },
      },
    },
    {
      groupId: 'GRP_INSTRUCTOR',
      roleCode: 'INSTRUCTOR',
      code: 'INSTRUCTOR',
      name: 'Giảng viên (Cơ hữu / Thỉnh giảng)',
      description: 'Tra cứu lịch dạy cá nhân, tự đăng ký lịch bận, gửi đơn báo nghỉ/dạy bù, điểm danh QR và báo sự cố phòng học.',
      scopeLabel: 'Phạm vi Cá nhân (Lịch dạy & Đơn biến động)',
      isSystemDefault: true,
      isActive: true,
      permissions: {
        DASHBOARD_KPI: { ...READ_ONLY },
        MASTER_FACULTIES: { ...READ_ONLY },
        MASTER_BUILDINGS: { ...READ_ONLY },
        MASTER_ROOMS: { ...READ_ONLY },
        MASTER_COURSES: { ...READ_ONLY },
        MASTER_INSTRUCTORS: { view: true, create: false, update: true, delete: false },
        MASTER_EXAM_MODELS: { ...READ_ONLY },
        TIMETABLE_BUILDER: { ...READ_ONLY },
        APPROVAL_WORKFLOW: { view: true, create: true, update: false, delete: false },
        PLANNING_EXAMS: { ...READ_ONLY },
        REPORTS_INTEGRATIONS: { view: true, create: true, update: false, delete: false },
        ADMIN_USERS_ROLES: { ...NO_ACCESS },
      },
    },
    {
      groupId: 'GRP_STUDENT',
      roleCode: 'STUDENT',
      code: 'STUDENT',
      name: 'Sinh viên / Học viên',
      description: 'Tra cứu TKB lớp cơ hữu, lịch thi, thông tin học phần, dùng chế độ Offline Mobile & phản ánh sự cố thiết bị phòng.',
      scopeLabel: 'Phạm vi Cá nhân (Lớp cơ hữu — Chỉ đọc)',
      isSystemDefault: true,
      isActive: true,
      permissions: {
        DASHBOARD_KPI: { ...READ_ONLY },
        MASTER_FACULTIES: { ...READ_ONLY },
        MASTER_BUILDINGS: { ...READ_ONLY },
        MASTER_ROOMS: { ...READ_ONLY },
        MASTER_COURSES: { ...READ_ONLY },
        MASTER_INSTRUCTORS: { ...READ_ONLY },
        MASTER_EXAM_MODELS: { ...READ_ONLY },
        TIMETABLE_BUILDER: { ...READ_ONLY },
        APPROVAL_WORKFLOW: { ...NO_ACCESS },
        PLANNING_EXAMS: { ...READ_ONLY },
        REPORTS_INTEGRATIONS: { view: true, create: true, update: false, delete: false },
        ADMIN_USERS_ROLES: { ...NO_ACCESS },
      },
    },
  ];
}

export interface RoleQuickAction {
  label: string;
  description: string;
  targetNav: NavSectionId;
}

export interface RoleCapabilitySpec {
  role: UserRole;
  allowedNavs: NavSectionId[];
  scopeSummary: string;
  permissions: {
    canManageAdmin: boolean;          // Users, Role Groups, Notification Config, Cron Jobs, System Params
    canEditMasterData: boolean;       // Create/Edit Course, Building, Faculty, Room, ExamModel
    canDeleteMasterData: boolean;     // Delete Master Data records
    canEditSchedule: boolean;         // Drag-Drop Grid, Split, Merge, Auto-Solve CSP
    canFreezeTimetable: boolean;      // Freeze / Publish T-1
    canApproveLevel1: boolean;        // Faculty / Dept Approval
    canApproveLevel2: boolean;        // Academic Office Room Allocation Approval
    canRollbackAudit: boolean;        // Audit Log Rollback
    canAssignInstructors: boolean;    // Assign Multi-Instructor to Sections
    canEditOwnAvailability: boolean;  // Instructor self-service availability matrix
    canEditAllAvailability: boolean;  // Edit any instructor availability
    canSubmitChangeRequest: boolean;  // Submit leave / makeup / change room request
    canReportIncident: boolean;       // Report classroom equipment incident
    canResolveIncident: boolean;      // Update incident resolution status
    canRunIntegrations: boolean;      // Trigger SIS / LMS sync
    canExportData: boolean;           // Export CSV / JSON / ICS / Print / Excel
  };
  featureHighlights: string[];
  quickActions: RoleQuickAction[];
}

export const ROLE_CAPABILITIES: Record<UserRole, RoleCapabilitySpec> = {
  SYS_ADMIN: {
    role: 'SYS_ADMIN',
    allowedNavs: ['dashboard', 'admin', 'master', 'builder', 'workflow', 'planning', 'reports', 'mobile', 'rbac'],
    scopeSummary: 'Toàn hệ thống — Full CRUD Master Data (Tòa nhà, Khoa, Phòng, Mô hình thi, Học phần), Nhóm quyền, Thông báo & Jobs',
    permissions: {
      canManageAdmin: true,
      canEditMasterData: true,
      canDeleteMasterData: true,
      canEditSchedule: true,
      canFreezeTimetable: true,
      canApproveLevel1: true,
      canApproveLevel2: true,
      canRollbackAudit: true,
      canAssignInstructors: true,
      canEditOwnAvailability: true,
      canEditAllAvailability: true,
      canSubmitChangeRequest: true,
      canReportIncident: true,
      canResolveIncident: true,
      canRunIntegrations: true,
      canExportData: true,
    },
    featureHighlights: [
      'Quản trị Master Data hệ thống đầy đủ CRUD: Tòa nhà, Khoa, Phòng học, Mô hình thi, Học phần & Giảng viên',
      'Quản lý Nhóm quyền & Phân quyền chi tiết 12 Chức năng × 4 Thao tác (Xem / Thêm / Sửa / Xóa) đồng bộ tức thời',
      'Quản trị Người dùng SSO/RBAC (Thêm, Sửa, Đổi vai trò, Khóa/Mở khóa, Xóa tài khoản)',
      'Cấu hình 4 Kênh Thông báo (FCM, SMTP, SMS, Webhook) & Điều hành 5 Cron Jobs tự động tổng hợp dữ liệu',
      'Cấu hình Tham số Hệ thống & Chạy bộ Kiểm thử Unit Test xuất Excel (.xlsx)',
    ],
    quickActions: [
      { label: 'Quản lý Master Data Hệ thống', description: 'CRUD Tòa nhà, Khoa, Phòng học & Mô hình thi', targetNav: 'admin' },
      { label: 'Nhóm quyền & Phân quyền CRUD', description: 'Phân quyền chi tiết Xem/Thêm/Sửa/Xóa từng chức năng', targetNav: 'admin' },
      { label: 'Học phần & Phòng học', description: 'Quản trị 4 cấu phần LT/BT/TL/TH & đa loại phòng', targetNav: 'master' },
      { label: 'Unit Test & Xuất Excel', description: 'Chạy kiểm thử toàn bộ vai trò & màn hình', targetNav: 'rbac' },
    ],
  },

  EXECUTIVE: {
    role: 'EXECUTIVE',
    allowedNavs: ['dashboard', 'builder', 'workflow', 'planning', 'reports', 'master', 'rbac'],
    scopeSummary: 'Toàn trường — Giám sát KPI RUR/SFR/SVI, Ban hành & Đóng băng TKB (T-1), Phê duyệt cấp Trường',
    permissions: {
      canManageAdmin: false,
      canEditMasterData: false,
      canDeleteMasterData: false,
      canEditSchedule: false,
      canFreezeTimetable: true,
      canApproveLevel1: false,
      canApproveLevel2: true,
      canRollbackAudit: true,
      canAssignInstructors: false,
      canEditOwnAvailability: false,
      canEditAllAvailability: false,
      canSubmitChangeRequest: false,
      canReportIncident: false,
      canResolveIncident: false,
      canRunIntegrations: true,
      canExportData: true,
    },
    featureHighlights: [
      'Theo dõi KPI điều hành thời gian thực (RUR, SFR, SVI, SLA 24h) & Drill-down mọi chỉ số',
      'Ban hành & Đóng băng Thời khóa biểu chính thức (Mốc T-1) hoặc mở khóa điều chỉnh',
      'Phê duyệt cuối cùng các đơn đổi lịch/dạy bù đặc biệt và giám sát Nhật ký Kiểm toán',
      'Xuất bộ Báo cáo Tổng hợp Trường (CSV, JSON, In ấn PDF) phục vụ giao ban BGH',
    ],
    quickActions: [
      { label: 'Phê duyệt & Đóng băng TKB', description: 'Chốt mốc T-1 & kiểm tra tiến độ toàn trường', targetNav: 'planning' },
      { label: 'Giám sát Luồng Duyệt & Audit', description: 'Kiểm soát SLA 24h & Rollback khi cần', targetNav: 'workflow' },
      { label: 'Báo cáo SFR & Tải phòng', description: 'Kết xuất báo cáo điều hành Ban Giám hiệu', targetNav: 'reports' },
      { label: 'Tra cứu Lưới TKB Toàn trường', description: 'Xem đa chiều Phòng / Lớp / GV / Khoa', targetNav: 'builder' },
    ],
  },

  SCHEDULER: {
    role: 'SCHEDULER',
    allowedNavs: ['dashboard', 'builder', 'master', 'workflow', 'planning', 'reports', 'mobile', 'rbac'],
    scopeSummary: 'Toàn trường — Điều phối Lưới Xếp lịch CSP, CRUD Học phần/Phòng/Mô hình thi, Duyệt Cấp 2 & Cấp phòng dạy bù',
    permissions: {
      canManageAdmin: false,
      canEditMasterData: true,
      canDeleteMasterData: true,
      canEditSchedule: true,
      canFreezeTimetable: true,
      canApproveLevel1: false,
      canApproveLevel2: true,
      canRollbackAudit: true,
      canAssignInstructors: true,
      canEditOwnAvailability: false,
      canEditAllAvailability: true,
      canSubmitChangeRequest: false,
      canReportIncident: true,
      canResolveIncident: true,
      canRunIntegrations: true,
      canExportData: true,
    },
    featureHighlights: [
      'Lập lịch trực quan Kéo-Thả 4 góc nhìn với Conflict Engine 5 bước & gợi ý Top 3 phòng trống',
      'Chạy Bộ giải CSP Tự động, Ghép lớp Lý thuyết vào Hội trường & Tách tốp Lab so le',
      'CRUD Học phần (LT/BT/TL/TH + chọn nhiều Loại phòng), Phòng học, Tòa nhà & Mô hình thi',
      'Phê duyệt Cấp 2 (Cấp phòng dạy bù), Thực hiện Rollback Audit Log & Đồng bộ SIS/LMS',
    ],
    quickActions: [
      { label: 'Lưới Xếp lịch & CSP Solver', description: 'Kéo thả, giải xung đột, tách/ghép lớp', targetNav: 'builder' },
      { label: 'Duyệt Cấp 2 (Cấp phòng)', description: 'Xử lý hồ sơ chờ Phòng Đào tạo trong 12h', targetNav: 'workflow' },
      { label: 'Quản trị Học phần & Phòng', description: 'Thêm/Sửa/Xóa học phần, phòng & tòa nhà', targetNav: 'master' },
      { label: 'Kế hoạch Tuần & Mô hình thi', description: 'Lịch thi cuốn chiếu/tập trung & phân công coi thi', targetNav: 'planning' },
    ],
  },

  FACULTY_HEAD: {
    role: 'FACULTY_HEAD',
    allowedNavs: ['dashboard', 'builder', 'master', 'workflow', 'planning', 'reports', 'mobile', 'rbac'],
    scopeSummary: 'Phạm vi Khoa CNTT — Duyệt chuyên môn Cấp 1, Phân công Đa Giảng viên, Sửa Học phần Khoa & Quản lý lịch bận',
    permissions: {
      canManageAdmin: false,
      canEditMasterData: true,
      canDeleteMasterData: false,
      canEditSchedule: false,
      canFreezeTimetable: false,
      canApproveLevel1: true,
      canApproveLevel2: false,
      canRollbackAudit: false,
      canAssignInstructors: true,
      canEditOwnAvailability: true,
      canEditAllAvailability: true,
      canSubmitChangeRequest: true,
      canReportIncident: true,
      canResolveIncident: false,
      canRunIntegrations: false,
      canExportData: true,
    },
    featureHighlights: [
      'Phê duyệt Cấp 1 (Chuyên môn) cho đơn báo nghỉ/dạy bù của Giảng viên thuộc Khoa CNTT',
      'Phân công Đa Giảng viên (GV chính, Đồng giảng dạy, Trợ giảng, Cán bộ Lab) & Thêm/Sửa GV Khoa',
      'Cập nhật thông tin Học phần Khoa, Lịch bận cố định/ưu tiên và theo dõi tải giảng dạy',
      'Giám sát tiến độ đào tạo Khoa CNTT, lịch thi bộ môn và xuất báo cáo giảng dạy',
    ],
    quickActions: [
      { label: 'Duyệt Cấp 1 (Khoa / BM)', description: 'Xác nhận chuyên môn đơn báo nghỉ trong 12h', targetNav: 'workflow' },
      { label: 'Phân công Đa Giảng viên', description: 'Gán GV chính, Trợ giảng, Lab Tech cho lớp HP', targetNav: 'master' },
      { label: 'Lưới Lịch Khoa CNTT', description: 'Xem toàn bộ buổi học thuộc Khoa CNTT', targetNav: 'builder' },
      { label: 'Báo cáo Tải Giảng viên', description: 'Kiểm soát trần 6 tiết/ngày & xuất CSV/In ấn', targetNav: 'reports' },
    ],
  },

  INSTRUCTOR: {
    role: 'INSTRUCTOR',
    allowedNavs: ['dashboard', 'builder', 'master', 'workflow', 'planning', 'reports', 'mobile', 'rbac'],
    scopeSummary: 'Phạm vi Cá nhân (ThS. Nguyễn Văn A) — Lịch dạy cá nhân, Lịch bận, Đơn báo nghỉ/dạy bù & QR điểm danh',
    permissions: {
      canManageAdmin: false,
      canEditMasterData: false,
      canDeleteMasterData: false,
      canEditSchedule: false,
      canFreezeTimetable: false,
      canApproveLevel1: false,
      canApproveLevel2: false,
      canRollbackAudit: false,
      canAssignInstructors: false,
      canEditOwnAvailability: true,
      canEditAllAvailability: false,
      canSubmitChangeRequest: true,
      canReportIncident: true,
      canResolveIncident: false,
      canRunIntegrations: false,
      canExportData: true,
    },
    featureHighlights: [
      'Tra cứu Lịch giảng dạy cá nhân & Lịch coi thi phân công; Xuất tệp iCalendar (.ics) 1 chạm',
      'Tự đăng ký Lịch bận cá nhân (Bận cố định Hard / Hạn chế Soft) đồng bộ trực tiếp Conflict Engine',
      'Khởi tạo Đơn Báo nghỉ & Dạy bù trực tuyến (Web & Mobile) kèm kiểm tra phòng trống tự động',
      'Chiếu mã QR Điểm danh nhanh tại lớp và Báo hỏng thiết bị phòng học tức thời',
    ],
    quickActions: [
      { label: 'Mobile App: Gửi đơn & QR', description: 'Báo nghỉ 3 chạm, chiếu QR & báo hỏng thiết bị', targetNav: 'mobile' },
      { label: 'Đăng ký Lịch bận Cá nhân', description: 'Cập nhật khung giờ bận cố định / hạn chế', targetNav: 'master' },
      { label: 'Lịch giảng dạy Tuần này', description: 'Xem lịch dạy của ThS. Nguyễn Văn A & xuất .ics', targetNav: 'builder' },
      { label: 'Theo dõi Trạng thái Đơn', description: 'Kiểm tra tiến độ duyệt Cấp 1 → Cấp 2', targetNav: 'workflow' },
    ],
  },

  STUDENT: {
    role: 'STUDENT',
    allowedNavs: ['dashboard', 'builder', 'master', 'planning', 'reports', 'mobile', 'rbac'],
    scopeSummary: 'Phạm vi Cá nhân (Lớp K24-CNTT01) — Tra cứu TKB, Lịch thi, Chế độ Offline, Thông báo Before/After & Báo sự cố',
    permissions: {
      canManageAdmin: false,
      canEditMasterData: false,
      canDeleteMasterData: false,
      canEditSchedule: false,
      canFreezeTimetable: false,
      canApproveLevel1: false,
      canApproveLevel2: false,
      canRollbackAudit: false,
      canAssignInstructors: false,
      canEditOwnAvailability: false,
      canEditAllAvailability: false,
      canSubmitChangeRequest: false,
      canReportIncident: true,
      canResolveIncident: false,
      canRunIntegrations: false,
      canExportData: true,
    },
    featureHighlights: [
      'Tra cứu Thời khóa biểu lớp K24-CNTT01 & Lịch thi học kỳ (cuốn chiếu & tập trung)',
      'Sử dụng Mobile App ở Chế độ Ngoại tuyến (Offline Cache) và nhận Push Before/After khi đổi phòng',
      'Tra cứu thông tin Học phần (LT/BT/TL/TH, tiên quyết) và danh mục Giảng đường toàn trường',
      'Phản ánh sự cố thiết bị phòng học hiện trường (Máy chiếu, Điều hòa, PC Lab) & Xuất lịch .ics',
    ],
    quickActions: [
      { label: 'Mobile App Sinh viên & Offline', description: 'Xem lịch cá nhân, thông báo đổi phòng & báo sự cố', targetNav: 'mobile' },
      { label: 'Lịch học Lớp K24-CNTT01', description: 'Xem lưới tuần & xuất file iCalendar (.ics)', targetNav: 'builder' },
      { label: 'Tra cứu Lịch thi Học kỳ', description: 'Xem ngày thi, ca thi, phòng thi của lớp', targetNav: 'planning' },
      { label: 'Tra cứu Học phần & Phòng học', description: 'Xem số tín chỉ, LT/BT/TL/TH và môn tiên quyết', targetNav: 'master' },
    ],
  },
};

export function getRoleGroupForRole(roleGroups: RoleGroup[] | undefined, role: UserRole): RoleGroup {
  const list = roleGroups && roleGroups.length > 0 ? roleGroups : createDefaultRoleGroups();
  const active = list.find((g) => g.roleCode === role && g.isActive);
  if (active) return active;
  return createDefaultRoleGroups().find((g) => g.roleCode === role) ?? createDefaultRoleGroups()[0];
}

export function checkRolePermission(
  roleGroups: RoleGroup[] | undefined,
  role: UserRole,
  fn: PermissionFunctionId,
  action: CrudAction
): boolean {
  const group = getRoleGroupForRole(roleGroups, role);
  return Boolean(group.permissions[fn]?.[action]);
}

export function deriveRoleCapabilitiesFromGroups(
  roleGroups: RoleGroup[] | undefined,
  role: UserRole
): RoleCapabilitySpec {
  const base = ROLE_CAPABILITIES[role];
  const group = getRoleGroupForRole(roleGroups, role);
  const p = group.permissions;

  const allowedNavs: NavSectionId[] = [];
  if (p.DASHBOARD_KPI?.view) allowedNavs.push('dashboard');
  if (p.ADMIN_USERS_ROLES?.view) allowedNavs.push('admin');
  if (
    p.MASTER_FACULTIES?.view ||
    p.MASTER_BUILDINGS?.view ||
    p.MASTER_ROOMS?.view ||
    p.MASTER_COURSES?.view ||
    p.MASTER_INSTRUCTORS?.view
  ) {
    allowedNavs.push('master');
  }
  if (p.TIMETABLE_BUILDER?.view) allowedNavs.push('builder');
  if (p.APPROVAL_WORKFLOW?.view) allowedNavs.push('workflow');
  if (p.PLANNING_EXAMS?.view || p.MASTER_EXAM_MODELS?.view) allowedNavs.push('planning');
  if (p.REPORTS_INTEGRATIONS?.view) allowedNavs.push('reports');
  if (base.allowedNavs.includes('mobile')) allowedNavs.push('mobile');
  allowedNavs.push('rbac');

  const canEditAnyMaster = Boolean(
    p.MASTER_FACULTIES?.create ||
      p.MASTER_FACULTIES?.update ||
      p.MASTER_BUILDINGS?.create ||
      p.MASTER_BUILDINGS?.update ||
      p.MASTER_ROOMS?.create ||
      p.MASTER_ROOMS?.update ||
      p.MASTER_COURSES?.create ||
      p.MASTER_COURSES?.update ||
      p.MASTER_EXAM_MODELS?.create ||
      p.MASTER_EXAM_MODELS?.update
  );

  const canDeleteAnyMaster = Boolean(
    p.MASTER_FACULTIES?.delete ||
      p.MASTER_BUILDINGS?.delete ||
      p.MASTER_ROOMS?.delete ||
      p.MASTER_COURSES?.delete ||
      p.MASTER_INSTRUCTORS?.delete ||
      p.MASTER_EXAM_MODELS?.delete
  );

  return {
    ...base,
    allowedNavs,
    scopeSummary: group.description || base.scopeSummary,
    permissions: {
      ...base.permissions,
      canManageAdmin: Boolean(p.ADMIN_USERS_ROLES?.view && (p.ADMIN_USERS_ROLES?.update || p.ADMIN_USERS_ROLES?.create)),
      canEditMasterData: canEditAnyMaster,
      canDeleteMasterData: canDeleteAnyMaster,
      canEditSchedule: Boolean(p.TIMETABLE_BUILDER?.create || p.TIMETABLE_BUILDER?.update),
      canFreezeTimetable: base.permissions.canFreezeTimetable && Boolean(p.TIMETABLE_BUILDER?.view),
      canApproveLevel1: base.permissions.canApproveLevel1 && Boolean(p.APPROVAL_WORKFLOW?.update),
      canApproveLevel2: base.permissions.canApproveLevel2 && Boolean(p.APPROVAL_WORKFLOW?.update),
      canRollbackAudit: Boolean(p.APPROVAL_WORKFLOW?.delete),
      canAssignInstructors:
        (role === 'SYS_ADMIN' || role === 'SCHEDULER' || role === 'FACULTY_HEAD') &&
        Boolean(p.MASTER_INSTRUCTORS?.update),
      canEditOwnAvailability: Boolean(p.MASTER_INSTRUCTORS?.update),
      canEditAllAvailability:
        role !== 'INSTRUCTOR' && role !== 'STUDENT' && Boolean(p.MASTER_INSTRUCTORS?.update),
      canSubmitChangeRequest: Boolean(p.APPROVAL_WORKFLOW?.create),
      canReportIncident: Boolean(p.REPORTS_INTEGRATIONS?.create),
      canResolveIncident: Boolean(p.REPORTS_INTEGRATIONS?.update),
      canRunIntegrations: Boolean(p.REPORTS_INTEGRATIONS?.update),
      canExportData: Boolean(p.REPORTS_INTEGRATIONS?.view || p.DASHBOARD_KPI?.view),
    },
  };
}

export function isNavAllowedForRole(
  role: UserRole,
  nav: NavSectionId,
  roleGroups?: RoleGroup[]
): boolean {
  if (roleGroups && roleGroups.length > 0) {
    return deriveRoleCapabilitiesFromGroups(roleGroups, role).allowedNavs.includes(nav);
  }
  return ROLE_CAPABILITIES[role].allowedNavs.includes(nav);
}
