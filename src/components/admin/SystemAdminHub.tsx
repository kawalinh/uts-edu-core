import React, { useMemo, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Clock,
  Database,
  Edit3,
  Lock,
  Play,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Trash2,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import { useUTS } from '../../context/UTSContext';
import type { SystemUser, UserRole } from '../../types/uts';
import { ExportToolbar } from '../common/ExportToolbar';
import { MasterCatalogManager } from './MasterCatalogManager';
import { RolePermissionsManager } from './RolePermissionsManager';

type AdminTab = 'MASTER_CATALOG' | 'ROLES' | 'USERS' | 'NOTIFICATIONS' | 'JOBS' | 'PARAMS';

const ROLE_LABELS: Record<UserRole, string> = {
  SYS_ADMIN: 'Quản trị Hệ thống',
  EXECUTIVE: 'Ban Giám hiệu',
  SCHEDULER: 'Chuyên viên Phòng ĐT',
  FACULTY_HEAD: 'Trưởng Khoa / Bộ môn',
  INSTRUCTOR: 'Giảng viên',
  STUDENT: 'Sinh viên',
};

export const SystemAdminHub: React.FC = () => {
  const {
    state,
    currentRole,
    hasPermission,
    switchRole,
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
  } = useUTS();

  const [activeTab, setActiveTab] = useState<AdminTab>('MASTER_CATALOG');
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');

  // Create / Edit User Form
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('INSTRUCTOR');
  const [departmentName, setDepartmentName] = useState('Khoa Công nghệ Thông tin');
  const [mfaEnabled, setMfaEnabled] = useState(true);

  // Running job state
  const [runningJobId, setRunningJobId] = useState<string | null>(null);

  // System Params Form
  const [paramsForm, setParamsForm] = useState({ ...state.systemParams });

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return state.systemUsers.filter((u) => {
      if (userRoleFilter !== 'ALL' && u.role !== userRoleFilter) return false;
      if (q) {
        const hay = `${u.username} ${u.fullName} ${u.email} ${u.departmentName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [state.systemUsers, userSearch, userRoleFilter]);

  const canViewAdmin = hasPermission('ADMIN_USERS_ROLES', 'view');
  const canCreateUser = hasPermission('ADMIN_USERS_ROLES', 'create');
  const canUpdateUser = hasPermission('ADMIN_USERS_ROLES', 'update');
  const canDeleteUser = hasPermission('ADMIN_USERS_ROLES', 'delete');

  if (!canViewAdmin) {
    return (
      <section className="x_panel">
        <div className="x_content py-10 text-center space-y-3">
          <ShieldAlert className="w-10 h-10 text-[#F39C12] mx-auto" />
          <h2 className="text-base font-bold text-[#2A3F54]">
            Phân hệ Quản trị Hệ thống yêu cầu quyền truy cập ADMIN_USERS_ROLES (Xem)
          </h2>
          <p className="text-xs text-[#5A738E] max-w-lg mx-auto">
            Vai trò hiện tại của bạn là <strong>{currentRole.label}</strong> ({currentRole.scopeLabel}).
            Để thao tác quản trị danh mục Master Data, nhóm quyền CRUD, người dùng, thông báo và Cron Jobs, vui lòng chuyển sang vai trò Quản trị viên Hệ thống.
          </p>
          <button
            type="button"
            onClick={() => switchRole('SYS_ADMIN')}
            className="px-4 py-2 rounded bg-[#2A3F54] hover:bg-[#172D44] text-white text-xs font-semibold"
          >
            Chuyển nhanh sang Quản trị viên (SYS_ADMIN)
          </button>
        </div>
      </section>
    );
  }

  const resetUserForm = () => {
    setEditingUserId(null);
    setUsername('');
    setFullName('');
    setEmail('');
    setNewRole('INSTRUCTOR');
    setDepartmentName('Khoa Công nghệ Thông tin');
    setMfaEnabled(true);
  };

  const startEditUser = (u: SystemUser) => {
    setEditingUserId(u.userId);
    setUsername(u.username);
    setFullName(u.fullName);
    setEmail(u.email);
    setNewRole(u.role);
    setDepartmentName(u.departmentName);
    setMfaEnabled(u.mfaEnabled);
  };

  const handleCreateOrUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUserId) {
      const res = await updateSystemUser(editingUserId, {
        fullName,
        email,
        role: newRole,
        departmentName,
        mfaEnabled,
      });
      if (res.ok) resetUserForm();
    } else {
      const res = await createSystemUser({
        username,
        fullName,
        email,
        role: newRole,
        departmentName,
        mfaEnabled,
      });
      if (res.ok) resetUserForm();
    }
  };

  const handleRunJob = async (jobId: string) => {
    setRunningJobId(jobId);
    await runScheduledJob(jobId);
    setRunningJobId(null);
  };

  const handleRunAllJobs = async () => {
    for (const j of state.scheduledJobs.filter((x) => x.enabled)) {
      setRunningJobId(j.jobId);
      await runScheduledJob(j.jobId);
    }
    setRunningJobId(null);
  };

  const handleSaveParams = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSystemParams(paramsForm);
  };

  return (
    <div className="space-y-4">
      {/* Top KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="x_panel p-4">
          <div className="text-xs text-[#73879C]">Master Data Danh mục Hệ thống</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#2A3F54] mt-1">
            {state.buildings.length} TN · {state.faculties.length} Khoa · {state.classrooms.length} Phòng
          </div>
          <div className="text-[11px] text-[#169F85] mt-1">
            {state.examModels.length} Mô hình thi · {state.courses.length} Học phần
          </div>
        </div>
        <div className="x_panel p-4">
          <div className="text-xs text-[#73879C]">Nhóm quyền & Tài khoản RBAC</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#2A3F54] mt-1">
            {state.roleGroups.length} Nhóm · {state.systemUsers.length} TK
          </div>
          <div className="text-[11px] text-[#5A738E] mt-1">
            Phân quyền chi tiết 12 Chức năng × Xem/Thêm/Sửa/Xóa
          </div>
        </div>
        <div className="x_panel p-4">
          <div className="text-xs text-[#73879C]">Kênh Thông báo & Cron Jobs</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#169F85] mt-1">
            {state.notificationChannels.filter((c) => c.enabled).length} Kênh · {state.scheduledJobs.filter((j) => j.enabled).length} Jobs
          </div>
          <div className="text-[11px] text-[#5A738E] mt-1">FCM · SMTP · KPI · SLA · SIS/LMS · BMS</div>
        </div>
        <div className="x_panel p-4">
          <div className="text-xs text-[#73879C]">Nhật ký Kiểm toán (Audit Trail)</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#2A3F54] mt-1">
            {state.auditLogs.length}
          </div>
          <div className="text-[11px] text-[#5A738E] mt-1">
            Ngưỡng SLA {state.systemParams.slaHoursLimit}h · Trần {state.systemParams.maxPeriodsPerDay}t/ngày
          </div>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="x_panel px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'MASTER_CATALOG', label: '1. Master Data (Tòa nhà · Khoa · Phòng · Mô hình thi)', icon: Database },
              { id: 'ROLES', label: '2. Nhóm quyền & Phân quyền CRUD chi tiết', icon: ShieldCheck },
              { id: 'USERS', label: '3. Người dùng (CRUD)', icon: Users },
              { id: 'NOTIFICATIONS', label: '4. Kênh Thông báo', icon: BellRing },
              { id: 'JOBS', label: '5. Cron Jobs', icon: Clock },
              { id: 'PARAMS', label: '6. Tham số & Audit', icon: Sliders },
            ] as { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[]
          ).map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-2 rounded text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  active ? 'bg-[#2A3F54] text-white' : 'bg-[#F2F5F7] text-[#5A738E] hover:text-[#2A3F54]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#1ABB9C]' : ''}`} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: MASTER DATA SYSTEM CATALOGS */}
      {activeTab === 'MASTER_CATALOG' && <MasterCatalogManager />}

      {/* TAB 2: ROLE GROUPS & GRANULAR CRUD PERMISSIONS */}
      {activeTab === 'ROLES' && <RolePermissionsManager />}

      {/* TAB 3: USERS & RBAC */}
      {activeTab === 'USERS' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <section className="x_panel xl:col-span-8">
            <div className="x_title flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-bold text-[#2A3F54]">
                  Danh sách Tài khoản & Phân quyền Truy cập ({filteredUsers.length})
                </h2>
                <p className="text-xs text-[#73879C] mt-0.5">
                  Quản trị toàn bộ tài khoản 6 nhóm vai trò, điều chỉnh quyền RBAC tức thời và khóa/mở khóa bảo mật
                </p>
              </div>
              <ExportToolbar
                compact
                filenameBase="UTS_QuanTriNguoiDung_RBAC"
                reportTitle="Danh sách Tài khoản Người dùng & Phân quyền RBAC"
                columns={[
                  { header: 'Mã TK', accessor: (u) => u.userId },
                  { header: 'Tên đăng nhập', accessor: (u) => u.username },
                  { header: 'Họ và tên', accessor: (u) => u.fullName },
                  { header: 'Email', accessor: (u) => u.email },
                  { header: 'Vai trò RBAC', accessor: (u) => ROLE_LABELS[u.role] },
                  { header: 'Đơn vị / Phạm vi', accessor: (u) => u.departmentName },
                  { header: 'MFA', accessor: (u) => (u.mfaEnabled ? 'Bật' : 'Tắt') },
                  { header: 'Trạng thái', accessor: (u) => u.status },
                ]}
                rows={filteredUsers}
              />
            </div>

            <div className="px-4 py-2.5 bg-[#FAFAFA] border-b border-[#E6E9ED] flex flex-wrap items-center gap-2 text-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#73879C] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Tìm username, họ tên, email..."
                  className="border border-[#D9DEE4] rounded pl-8 pr-2.5 py-1.5 bg-white w-[220px]"
                />
              </div>
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="border border-[#D9DEE4] rounded px-2.5 py-1.5 bg-white"
              >
                <option value="ALL">Tất cả 6 Vai trò</option>
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>

            <div className="x_content overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#E6E9ED] text-[#5A738E] text-left">
                    <th className="py-2 pr-2 font-semibold">Tài khoản</th>
                    <th className="py-2 px-2 font-semibold">Họ tên & Đơn vị</th>
                    <th className="py-2 px-2 font-semibold">Vai trò RBAC</th>
                    <th className="py-2 px-2 font-semibold">Trạng thái</th>
                    <th className="py-2 pl-2 text-right font-semibold">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E9ED]">
                  {filteredUsers.map((u) => (
                    <tr key={u.userId} className="hover:bg-[#F7F7F7]">
                      <td className="py-2.5 pr-2">
                        <div className="font-mono font-bold text-[#2A3F54]">{u.username}</div>
                        <div className="text-[11px] text-[#73879C]">{u.email}</div>
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="font-semibold text-[#2A3F54]">{u.fullName}</div>
                        <div className="text-[11px] text-[#5A738E]">
                          {u.departmentName} · {u.mfaEnabled ? 'MFA: Bật' : 'MFA: Tắt'}
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <select
                          value={u.role}
                          onChange={(e) => updateUserRole(u.userId, e.target.value as UserRole)}
                          className="text-xs border border-[#D9DEE4] rounded px-2 py-1 bg-white font-semibold text-[#2A3F54]"
                        >
                          {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-2">
                        <span
                          className={`text-xs font-semibold ${
                            u.status === 'ACTIVE' ? 'text-[#169F85]' : 'text-[#E74C3C]'
                          }`}
                        >
                          {u.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}
                        </span>
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                          {canUpdateUser && (
                            <button
                              type="button"
                              onClick={() => startEditUser(u)}
                              className="px-2 py-1 rounded text-[11px] font-semibold inline-flex items-center gap-1 border border-[#3498DB] text-[#3498DB] hover:bg-[#EFF6FF]"
                            >
                              <Edit3 className="w-3 h-3" /> Sửa
                            </button>
                          )}
                          {canUpdateUser && (
                            <button
                              type="button"
                              onClick={() => toggleUserStatus(u.userId)}
                              className={`px-2 py-1 rounded text-[11px] font-semibold inline-flex items-center gap-1 border whitespace-nowrap ${
                                u.status === 'ACTIVE'
                                  ? 'border-[#F39C12] text-[#B45309] hover:bg-[#FFFBEB]'
                                  : 'border-[#1ABB9C] text-[#169F85] hover:bg-[#F0FDF4]'
                              }`}
                            >
                              {u.status === 'ACTIVE' ? (
                                <>
                                  <Lock className="w-3 h-3" /> Khóa
                                </>
                              ) : (
                                <>
                                  <Unlock className="w-3 h-3" /> Mở
                                </>
                              )}
                            </button>
                          )}
                          {canDeleteUser &&
                            (confirmDeleteUserId === u.userId ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await deleteSystemUser(u.userId);
                                    setConfirmDeleteUserId(null);
                                  }}
                                  className="px-2 py-1 rounded bg-[#E74C3C] text-white text-[11px] font-semibold"
                                >
                                  Xác nhận
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteUserId(null)}
                                  className="p-0.5 text-[#73879C]"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteUserId(u.userId)}
                                className="px-2 py-1 rounded text-[11px] font-semibold inline-flex items-center gap-1 border border-[#FCA5A5] text-[#B91C1C] hover:bg-[#FEF2F2]"
                              >
                                <Trash2 className="w-3 h-3" /> Xóa
                              </button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Create / Edit User Form */}
          <section className="x_panel xl:col-span-4">
            <div className="x_title flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-[#2A3F54] flex items-center gap-1.5">
                {editingUserId ? <Edit3 className="w-4 h-4 text-[#3498DB]" /> : <Plus className="w-4 h-4 text-[#1ABB9C]" />}
                {editingUserId ? 'Chỉnh sửa Tài khoản Người dùng' : 'Cấp mới Tài khoản Người dùng'}
              </h3>
              {editingUserId && (
                <button type="button" onClick={resetUserForm} className="text-xs text-[#73879C] underline">
                  Hủy sửa
                </button>
              )}
            </div>
            <form onSubmit={handleCreateOrUpdateUser} className="x_content space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#2A3F54] mb-1">Tên đăng nhập (SSO) *</label>
                <input
                  required
                  disabled={Boolean(editingUserId)}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="VD: minhnt.pdt"
                  className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 font-mono disabled:bg-[#F2F5F7]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#2A3F54] mb-1">Họ và tên *</label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="VD: ThS. Nguyễn Thành Minh"
                  className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#2A3F54] mb-1">Email nội bộ *</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="minhnt@university.edu.vn"
                  className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#2A3F54] mb-1">Vai trò RBAC</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 bg-white"
                >
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#2A3F54] mb-1">Đơn vị / Khoa / Lớp</label>
                <input
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5"
                />
              </div>
              <label className="flex items-center gap-2 text-[#2A3F54] cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={mfaEnabled}
                  onChange={(e) => setMfaEnabled(e.target.checked)}
                />
                <span>Yêu cầu xác thực 2 lớp (MFA / SSO Đại học)</span>
              </label>
              <button
                type="submit"
                disabled={editingUserId ? !canUpdateUser : !canCreateUser}
                className="w-full py-2 rounded bg-[#1ABB9C] hover:bg-[#169F85] disabled:opacity-40 text-white font-semibold"
              >
                {editingUserId ? 'Lưu cập nhật Tài khoản' : 'Tạo tài khoản & Cấp quyền'}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* TAB 2: NOTIFICATION CHANNELS */}
      {activeTab === 'NOTIFICATIONS' && (
        <section className="x_panel">
          <div className="x_title flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-bold text-[#2A3F54]">
                Cấu hình Hệ thống Kênh Thông báo & Cảnh báo Tức thời
              </h2>
              <p className="text-xs text-[#73879C] mt-0.5">
                Bật/tắt các cổng phát thông báo (FCM Push, Email SMTP, SMS khẩn cấp, Webhook LMS/BMS) và gửi kiểm thử trực tiếp
              </p>
            </div>
            <ExportToolbar
              compact
              filenameBase="UTS_CauHinhKenhThongBao"
              reportTitle="Cấu hình Kênh Thông báo Hệ thống"
              columns={[
                { header: 'Mã kênh', accessor: (c) => c.channelId },
                { header: 'Loại kênh', accessor: (c) => c.channelType },
                { header: 'Tên kênh', accessor: (c) => c.name },
                { header: 'Sự kiện áp dụng', accessor: (c) => c.targetEvents.join(', ') },
                { header: 'Số lần thử lại', accessor: (c) => c.retryCount },
                { header: 'Trạng thái', accessor: (c) => (c.enabled ? 'Đang bật' : 'Đang tắt') },
              ]}
              rows={state.notificationChannels}
            />
          </div>
          <div className="x_content grid grid-cols-1 md:grid-cols-2 gap-4">
            {state.notificationChannels.map((ch) => (
              <div
                key={ch.channelId}
                className={`p-4 rounded border ${
                  ch.enabled ? 'border-[#1ABB9C]/60 bg-white' : 'border-[#E6E9ED] bg-[#FAFAFA]'
                } space-y-3 text-xs`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-[11px] text-[#169F85] font-bold">{ch.channelType}</div>
                    <h3 className="text-sm font-bold text-[#2A3F54] mt-0.5">{ch.name}</h3>
                    <p className="text-[#5A738E] mt-1 leading-relaxed">{ch.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleNotificationChannel(ch.channelId)}
                    className={`px-3 py-1.5 rounded text-xs font-semibold shrink-0 transition-colors ${
                      ch.enabled
                        ? 'bg-[#1ABB9C] hover:bg-[#169F85] text-white'
                        : 'bg-[#E2E8F0] hover:bg-[#CBD5E1] text-[#2A3F54]'
                    }`}
                  >
                    {ch.enabled ? 'Đang BẬT' : 'Đang TẮT'}
                  </button>
                </div>

                <div className="text-[11px] text-[#5A738E] flex flex-wrap items-center gap-2 pt-2 border-t border-[#E6E9ED]">
                  <span className="font-semibold text-[#2A3F54]">Sự kiện kích hoạt:</span>
                  <span className="font-mono">{ch.targetEvents.join(' · ')}</span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#73879C]">
                  <span>
                    Thử lại tối đa: <strong className="font-mono text-[#2A3F54]">{ch.retryCount}</strong> lần · Phát gần nhất:{' '}
                    <strong className="font-mono text-[#2A3F54]">
                      {new Date(ch.lastTriggeredAt).toLocaleString('vi-VN')}
                    </strong>
                  </span>
                  <button
                    type="button"
                    disabled={!ch.enabled}
                    onClick={() => testNotificationChannel(ch.channelId)}
                    className="px-2.5 py-1 rounded border border-[#3498DB] text-[#3498DB] hover:bg-[#EFF6FF] disabled:opacity-40 font-semibold inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <Send className="w-3 h-3" /> Gửi thử thông báo
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB 3: SCHEDULED JOBS (CRON) */}
      {activeTab === 'JOBS' && (
        <section className="x_panel">
          <div className="x_title flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold text-[#2A3F54]">
                Quản trị Job Tự động Tổng hợp Thông tin & Đồng bộ Định kỳ (Cron Jobs)
              </h2>
              <p className="text-xs text-[#73879C] mt-0.5">
                Thực thi thủ công tức thời hoặc bật/tắt các tiến trình nền tự động tổng hợp KPI, cảnh báo SLA, đồng bộ SIS/LMS và BMS/IoT
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRunAllJobs}
                disabled={runningJobId !== null}
                className="px-3.5 py-1.5 rounded bg-[#1ABB9C] hover:bg-[#169F85] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5" />
                Chạy toàn bộ Jobs đang bật
              </button>
              <ExportToolbar
                compact
                filenameBase="UTS_LichTrinh_CronJobs"
                reportTitle="Danh sách Job Tự động Tổng hợp & Đồng bộ Hệ thống"
                columns={[
                  { header: 'Mã Job', accessor: (j) => j.jobCode },
                  { header: 'Tên tiến trình', accessor: (j) => j.name },
                  { header: 'Lịch chạy (Cron)', accessor: (j) => j.scheduleCron },
                  { header: 'Trạng thái bật', accessor: (j) => (j.enabled ? 'Bật' : 'Tạm dừng') },
                  { header: 'Kết quả gần nhất', accessor: (j) => j.lastStatus },
                  { header: 'Thời gian (ms)', accessor: (j) => j.lastDurationMs },
                  { header: 'Tóm tắt thực thi', accessor: (j) => j.lastSummary },
                ]}
                rows={state.scheduledJobs}
              />
            </div>
          </div>

          <div className="x_content divide-y divide-[#E6E9ED]">
            {state.scheduledJobs.map((job) => {
              const isRunning = runningJobId === job.jobId;
              return (
                <div key={job.jobId} className="py-3.5 first:pt-0 last:pb-0 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-[#169F85]">{job.jobCode}</span>
                      <span className="font-bold text-[#2A3F54] text-[13px]">{job.name}</span>
                      <span className="font-mono text-[11px] text-[#5A738E]">· {job.scheduleCron}</span>
                    </div>
                    <p className="text-[#5A738E]">{job.description}</p>
                    <div className="p-2 rounded bg-[#FAFAFA] border border-[#E6E9ED] text-[11px] flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[#2A3F54]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#1ABB9C] shrink-0" />
                        <span>{job.lastSummary}</span>
                      </span>
                      <span className="font-mono text-[#73879C] shrink-0">
                        {new Date(job.lastRunAt).toLocaleString('vi-VN')} · {job.lastDurationMs}ms
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleScheduledJob(job.jobId)}
                      className={`px-3 py-1.5 rounded text-xs font-semibold border whitespace-nowrap ${
                        job.enabled
                          ? 'border-[#1ABB9C] text-[#169F85] bg-[#F0FDF4]'
                          : 'border-[#CBD5E1] text-[#64748B] bg-[#F8FAFC]'
                      }`}
                    >
                      {job.enabled ? 'Đang kích hoạt' : 'Tạm dừng'}
                    </button>
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => handleRunJob(job.jobId)}
                      className="px-3 py-1.5 rounded bg-[#2A3F54] hover:bg-[#172D44] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Play className="w-3.5 h-3.5 text-[#1ABB9C]" />
                      {isRunning ? 'Đang chạy...' : 'Chạy ngay'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 4: SYSTEM PARAMETERS */}
      {activeTab === 'PARAMS' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <section className="x_panel xl:col-span-6">
            <div className="x_title">
              <h2 className="text-[15px] font-bold text-[#2A3F54] flex items-center gap-1.5">
                <Settings2 className="w-4 h-4 text-[#1ABB9C]" />
                Tham số Vận hành & Ngưỡng Ràng buộc Toàn trường
              </h2>
            </div>
            <form onSubmit={handleSaveParams} className="x_content space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#2A3F54] mb-1">
                    Trần số tiết giảng dạy / ngày (BR_RULE_08)
                  </label>
                  <input
                    type="number"
                    min={4}
                    max={10}
                    value={paramsForm.maxPeriodsPerDay}
                    onChange={(e) => setParamsForm({ ...paramsForm, maxPeriodsPerDay: Number(e.target.value) })}
                    className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#2A3F54] mb-1">
                    Ngưỡng SLA phê duyệt đơn đổi lịch (Giờ)
                  </label>
                  <input
                    type="number"
                    min={6}
                    max={72}
                    value={paramsForm.slaHoursLimit}
                    onChange={(e) => setParamsForm({ ...paramsForm, slaHoursLimit: Number(e.target.value) })}
                    className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#2A3F54] mb-1">
                    Ngưỡng cảnh báo lãng phí phòng SFR (%)
                  </label>
                  <input
                    type="number"
                    min={20}
                    max={80}
                    value={paramsForm.minSfrWarningPercent}
                    onChange={(e) => setParamsForm({ ...paramsForm, minSfrWarningPercent: Number(e.target.value) })}
                    className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#2A3F54] mb-1">
                    BMS/IoT bật điều hòa trước giờ học (Phút)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={45}
                    value={paramsForm.bmsPreHeatMinutes}
                    onChange={(e) => setParamsForm({ ...paramsForm, bmsPreHeatMinutes: Number(e.target.value) })}
                    className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#2A3F54] mb-1">
                    Khung tổng số tiết / ngày học
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={15}
                    value={paramsForm.academicPeriodsCount}
                    onChange={(e) => setParamsForm({ ...paramsForm, academicPeriodsCount: Number(e.target.value) })}
                    className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#2A3F54] mb-1">
                    Mốc tự động đóng băng trước khai giảng (Ngày)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={paramsForm.autoFreezeDaysBeforeTerm}
                    onChange={(e) => setParamsForm({ ...paramsForm, autoFreezeDaysBeforeTerm: Number(e.target.value) })}
                    className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 font-mono"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white font-semibold"
                >
                  Lưu Tham số Hệ thống
                </button>
              </div>
            </form>
          </section>

          <section className="x_panel xl:col-span-6">
            <div className="x_title flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-bold text-[#2A3F54]">
                Nhật ký Thao tác Quản trị gần nhất
              </h3>
              <span className="text-xs font-mono text-[#73879C]">{state.auditLogs.length} bản ghi</span>
            </div>
            <div className="x_content divide-y divide-[#E6E9ED] max-h-[340px] overflow-y-auto text-xs">
              {state.auditLogs.slice(0, 10).map((log) => (
                <div key={log.logId} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-[#2A3F54]">
                      {log.logId} · {log.actionType}
                    </span>
                    <span className="font-mono text-[11px] text-[#73879C]">
                      {new Date(log.timestamp).toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <div className="text-[#5A738E] mt-0.5">{log.summary}</div>
                  <div className="text-[11px] text-[#73879C] mt-0.5">
                    Thực hiện bởi: <strong className="text-[#2A3F54]">{log.executedBy}</strong> ({log.executedRole})
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
