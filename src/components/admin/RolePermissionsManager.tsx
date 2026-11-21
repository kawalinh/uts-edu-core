import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { useUTS } from '../../context/UTSContext';
import type { CrudAction, CrudPermission, PermissionFunctionId, RoleGroup, UserRole } from '../../types/uts';
import { PERMISSION_FUNCTIONS } from '../../utils/rbacConfig';
import { ExportToolbar } from '../common/ExportToolbar';

const ACTIONS: { key: CrudAction; label: string }[] = [
  { key: 'view', label: 'Xem' },
  { key: 'create', label: 'Thêm mới' },
  { key: 'update', label: 'Sửa / Duyệt' },
  { key: 'delete', label: 'Xóa / Rollback' },
];

const ROLE_OPTIONS: { role: UserRole; label: string }[] = [
  { role: 'SYS_ADMIN', label: 'SYS_ADMIN — Quản trị HT' },
  { role: 'EXECUTIVE', label: 'EXECUTIVE — Ban Giám hiệu' },
  { role: 'SCHEDULER', label: 'SCHEDULER — Chuyên viên ĐT' },
  { role: 'FACULTY_HEAD', label: 'FACULTY_HEAD — Trưởng Khoa/BM' },
  { role: 'INSTRUCTOR', label: 'INSTRUCTOR — Giảng viên' },
  { role: 'STUDENT', label: 'STUDENT — Sinh viên' },
];

export const RolePermissionsManager: React.FC = () => {
  const {
    state,
    hasPermission,
    switchRole,
    createRoleGroup,
    updateRoleGroup,
    deleteRoleGroup,
    resetRoleGroups,
  } = useUTS();

  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    state.roleGroups[0]?.groupId ?? 'GRP_SYS_ADMIN'
  );
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftScope, setDraftScope] = useState('');
  const [draftPerms, setDraftPerms] = useState<Record<PermissionFunctionId, CrudPermission> | null>(null);
  const [dirty, setDirty] = useState(false);

  // Create Custom Role Group inline panel
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newBaseRole, setNewBaseRole] = useState<UserRole>('FACULTY_HEAD');
  const [newDesc, setNewDesc] = useState('');
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);

  const canCreate = hasPermission('ADMIN_USERS_ROLES', 'create');
  const canUpdate = hasPermission('ADMIN_USERS_ROLES', 'update');
  const canDelete = hasPermission('ADMIN_USERS_ROLES', 'delete');

  const selectedGroup: RoleGroup | undefined = useMemo(
    () => state.roleGroups.find((g) => g.groupId === selectedGroupId) ?? state.roleGroups[0],
    [state.roleGroups, selectedGroupId]
  );

  useEffect(() => {
    if (!selectedGroup) return;
    setDraftName(selectedGroup.name);
    setDraftDesc(selectedGroup.description);
    setDraftScope(selectedGroup.scopeLabel);
    setDraftPerms(JSON.parse(JSON.stringify(selectedGroup.permissions)));
    setDirty(false);
  }, [selectedGroup]);

  const countGranted = (perms: Record<PermissionFunctionId, CrudPermission>) => {
    let total = 0;
    for (const fn of PERMISSION_FUNCTIONS) {
      const p = perms[fn.id];
      if (!p) continue;
      if (p.view) total++;
      if (p.create) total++;
      if (p.update) total++;
      if (p.delete) total++;
    }
    return total;
  };

  const toggleCell = (fnId: PermissionFunctionId, action: CrudAction) => {
    if (!draftPerms || !canUpdate) return;
    // Safeguard SYS_ADMIN core admin access
    if (
      selectedGroup?.roleCode === 'SYS_ADMIN' &&
      selectedGroup.isSystemDefault &&
      fnId === 'ADMIN_USERS_ROLES' &&
      (action === 'view' || action === 'update')
    ) {
      return;
    }

    const current = draftPerms[fnId];
    const nextVal = !current[action];
    const updatedRow: CrudPermission = { ...current, [action]: nextVal };

    // Logical consistency: cannot Create/Update/Delete without View
    if (action === 'view' && !nextVal) {
      updatedRow.create = false;
      updatedRow.update = false;
      updatedRow.delete = false;
    } else if (action !== 'view' && nextVal) {
      updatedRow.view = true;
    }

    setDraftPerms({ ...draftPerms, [fnId]: updatedRow });
    setDirty(true);
  };

  const applyRowPreset = (fnId: PermissionFunctionId, mode: 'FULL' | 'READ' | 'NONE') => {
    if (!draftPerms || !canUpdate) return;
    if (
      selectedGroup?.roleCode === 'SYS_ADMIN' &&
      selectedGroup.isSystemDefault &&
      fnId === 'ADMIN_USERS_ROLES' &&
      mode !== 'FULL'
    ) {
      return;
    }
    const nextRow: CrudPermission =
      mode === 'FULL'
        ? { view: true, create: true, update: true, delete: true }
        : mode === 'READ'
        ? { view: true, create: false, update: false, delete: false }
        : { view: false, create: false, update: false, delete: false };
    setDraftPerms({ ...draftPerms, [fnId]: nextRow });
    setDirty(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedGroup || !draftPerms) return;
    const res = await updateRoleGroup(selectedGroup.groupId, {
      name: draftName,
      description: draftDesc,
      scopeLabel: draftScope,
      permissions: draftPerms,
    });
    if (res.ok) setDirty(false);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createRoleGroup({
      code: newCode,
      name: newName,
      roleCode: newBaseRole,
      description: newDesc,
    });
    if (res.ok) {
      setNewCode('');
      setNewName('');
      setNewDesc('');
      setShowCreateForm(false);
    }
  };

  const exportRows = useMemo(() => {
    if (!selectedGroup || !draftPerms) return [];
    return PERMISSION_FUNCTIONS.map((fn) => {
      const p = draftPerms[fn.id];
      return {
        groupCode: selectedGroup.code,
        groupName: selectedGroup.name,
        moduleGroup: fn.moduleGroup,
        functionId: fn.id,
        functionLabel: fn.label,
        view: p?.view ? 'Có' : 'Không',
        create: p?.create ? 'Có' : 'Không',
        update: p?.update ? 'Có' : 'Không',
        delete: p?.delete ? 'Có' : 'Không',
      };
    });
  }, [selectedGroup, draftPerms]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
      {/* LEFT: ROLE GROUPS LIST & CREATE */}
      <section className="x_panel xl:col-span-4">
        <div className="x_title flex items-center justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-bold text-[#2A3F54] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#1ABB9C]" />
              Nhóm quyền Hệ thống ({state.roleGroups.length})
            </h2>
            <p className="text-[11px] text-[#73879C] mt-0.5">
              Chọn nhóm quyền để thiết lập chi tiết Xem / Thêm / Sửa / Xóa
            </p>
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={() => setShowCreateForm((v) => !v)}
              className="px-2.5 py-1.5 rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" /> Tạo nhóm
            </button>
          )}
        </div>

        {showCreateForm && canCreate && (
          <form onSubmit={handleCreateGroup} className="p-3 bg-[#F8FAFC] border-b border-[#E6E9ED] space-y-2.5 text-xs">
            <div className="font-bold text-[#2A3F54]">Thêm Nhóm quyền Tùy chỉnh mới</div>
            <div className="grid grid-cols-2 gap-2">
              <input
                required
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="Mã nhóm (VD: KHAO_THI)"
                className="border border-[#D9DEE4] rounded px-2 py-1.5 font-mono uppercase bg-white"
              />
              <select
                value={newBaseRole}
                onChange={(e) => setNewBaseRole(e.target.value as UserRole)}
                className="border border-[#D9DEE4] rounded px-2 py-1.5 bg-white"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.role} value={r.role}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <input
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tên nhóm quyền (VD: Chuyên viên Khảo thí & Đảm bảo CL)"
              className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 bg-white"
            />
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Mô tả phạm vi nhiệm vụ của nhóm quyền..."
              className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 bg-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-2.5 py-1 rounded border border-[#D9DEE4] text-[#5A738E]"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-3 py-1 rounded bg-[#2A3F54] text-white font-semibold"
              >
                Lưu nhóm quyền
              </button>
            </div>
          </form>
        )}

        <div className="x_content divide-y divide-[#E6E9ED]">
          {state.roleGroups.map((g) => {
            const active = selectedGroup?.groupId === g.groupId;
            const granted = countGranted(g.permissions);
            const maxActions = PERMISSION_FUNCTIONS.length * 4;
            return (
              <div
                key={g.groupId}
                onClick={() => setSelectedGroupId(g.groupId)}
                className={`p-3 cursor-pointer transition-colors rounded ${
                  active ? 'bg-[#2A3F54] text-white' : 'hover:bg-[#F7F7F7] text-[#2A3F54]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`font-mono text-[11px] font-bold ${active ? 'text-[#1ABB9C]' : 'text-[#169F85]'}`}>
                        {g.code}
                      </span>
                      {g.isSystemDefault && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            active ? 'bg-white/15 text-white' : 'bg-[#F2F5F7] text-[#5A738E]'
                          }`}
                        >
                          Mặc định lõi
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-xs mt-0.5">{g.name}</div>
                    <div className={`text-[11px] mt-0.5 line-clamp-2 ${active ? 'text-[#CBD5E1]' : 'text-[#73879C]'}`}>
                      {g.scopeLabel}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-mono font-bold text-xs ${active ? 'text-[#1ABB9C]' : 'text-[#2A3F54]'}`}>
                      {granted}/{maxActions}
                    </div>
                    <div className={`text-[10px] ${active ? 'text-[#CBD5E1]' : 'text-[#73879C]'}`}>thao tác</div>
                  </div>
                </div>

                {!g.isSystemDefault && canDelete && (
                  <div
                    className="mt-2 pt-2 border-t border-current/10 flex justify-end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {confirmDeleteGroupId === g.groupId ? (
                      <div className="inline-flex items-center gap-1.5 text-[11px]">
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteRoleGroup(g.groupId);
                            setConfirmDeleteGroupId(null);
                          }}
                          className="px-2 py-0.5 rounded bg-[#E74C3C] text-white font-semibold"
                        >
                          Xác nhận xóa
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteGroupId(null)}
                          className="p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteGroupId(g.groupId)}
                        className={`text-[11px] font-semibold inline-flex items-center gap-1 ${
                          active ? 'text-[#FCA5A5]' : 'text-[#B91C1C]'
                        }`}
                      >
                        <Trash2 className="w-3 h-3" /> Xóa nhóm tùy chỉnh
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-[#E6E9ED] bg-[#FAFAFA] flex justify-between items-center text-xs">
          <span className="text-[#73879C]">Khôi phục chuẩn RBAC 6 vai trò</span>
          <button
            type="button"
            disabled={!canUpdate}
            onClick={() => resetRoleGroups()}
            className="px-2.5 py-1 rounded border border-[#D9DEE4] bg-white hover:bg-[#F2F5F7] text-[#2A3F54] font-semibold inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Reset mặc định
          </button>
        </div>
      </section>

      {/* RIGHT: GRANULAR 12 FUNCTIONS × 4 CRUD ACTIONS MATRIX */}
      <section className="x_panel xl:col-span-8">
        {selectedGroup && draftPerms && (
          <>
            <div className="x_title flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold text-[#2A3F54] flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-[#1ABB9C]" />
                  Ma trận Phân quyền Chi tiết: {selectedGroup.name} ({selectedGroup.code})
                </h2>
                <p className="text-xs text-[#73879C] mt-0.5">
                  Thay đổi quyền <strong>Xem / Thêm mới / Sửa / Xóa</strong> có hiệu lực tức thời trên toàn bộ màn hình & API của vai trò{' '}
                  <span className="font-mono font-bold text-[#2A3F54]">{selectedGroup.roleCode}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => switchRole(selectedGroup.roleCode)}
                  className="px-3 py-1.5 rounded border border-[#2A3F54] text-[#2A3F54] hover:bg-[#F2F5F7] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <UserCheck className="w-3.5 h-3.5 text-[#1ABB9C]" />
                  Thử vai trò này ngay
                </button>
                <button
                  type="button"
                  disabled={!canUpdate || !dirty}
                  onClick={handleSavePermissions}
                  className="px-3.5 py-1.5 rounded bg-[#1ABB9C] hover:bg-[#169F85] disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  {dirty ? 'Lưu & Đồng bộ Phân quyền' : 'Đã đồng bộ'}
                </button>
                <ExportToolbar
                  compact
                  filenameBase={`UTS_PhanQuyen_${selectedGroup.code}`}
                  reportTitle={`Ma trận Phân quyền Chi tiết — ${selectedGroup.name}`}
                  columns={[
                    { header: 'Mã Nhóm quyền', accessor: (r) => r.groupCode },
                    { header: 'Tên Nhóm quyền', accessor: (r) => r.groupName },
                    { header: 'Phân hệ', accessor: (r) => r.moduleGroup },
                    { header: 'Mã Chức năng', accessor: (r) => r.functionId },
                    { header: 'Tên Chức năng', accessor: (r) => r.functionLabel },
                    { header: 'Xem', accessor: (r) => r.view },
                    { header: 'Thêm mới', accessor: (r) => r.create },
                    { header: 'Sửa / Duyệt', accessor: (r) => r.update },
                    { header: 'Xóa / Rollback', accessor: (r) => r.delete },
                  ]}
                  rows={exportRows}
                />
              </div>
            </div>

            {/* Editable Metadata for Selected Role Group */}
            <div className="px-4 py-3 bg-[#FAFAFA] border-b border-[#E6E9ED] grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[#5A738E] mb-1">Tên Nhóm quyền</label>
                <input
                  value={draftName}
                  onChange={(e) => {
                    setDraftName(e.target.value);
                    setDirty(true);
                  }}
                  className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 bg-white font-semibold text-[#2A3F54]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#5A738E] mb-1">Phạm vi dữ liệu</label>
                <input
                  value={draftScope}
                  onChange={(e) => {
                    setDraftScope(e.target.value);
                    setDirty(true);
                  }}
                  className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 bg-white text-[#2A3F54]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#5A738E] mb-1">Mô tả chi tiết</label>
                <input
                  value={draftDesc}
                  onChange={(e) => {
                    setDraftDesc(e.target.value);
                    setDirty(true);
                  }}
                  className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 bg-white text-[#5A738E]"
                />
              </div>
            </div>

            {/* 12 Functions × 4 CRUD Actions Table */}
            <div className="x_content overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#E6E9ED] text-[#5A738E] text-left">
                    <th className="py-2 pr-2 font-semibold">Phân hệ & Chức năng chi tiết</th>
                    {ACTIONS.map((a) => (
                      <th key={a.key} className="py-2 px-2 text-center font-semibold w-[92px]">
                        {a.label}
                      </th>
                    ))}
                    <th className="py-2 pl-2 text-right font-semibold w-[138px]">Chọn nhanh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E9ED]">
                  {PERMISSION_FUNCTIONS.map((fn) => {
                    const p = draftPerms[fn.id] ?? { view: false, create: false, update: false, delete: false };
                    const isLockedAdminRow =
                      selectedGroup.roleCode === 'SYS_ADMIN' &&
                      selectedGroup.isSystemDefault &&
                      fn.id === 'ADMIN_USERS_ROLES';
                    return (
                      <tr key={fn.id} className="hover:bg-[#F7F7F7]">
                        <td className="py-2.5 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-[#169F85] uppercase">
                              {fn.moduleGroup}
                            </span>
                            <span className="font-bold text-[#2A3F54]">{fn.label}</span>
                          </div>
                          <div className="text-[11px] text-[#73879C] mt-0.5">{fn.description}</div>
                        </td>
                        {ACTIONS.map((a) => {
                          const disabledCell =
                            !canUpdate || (isLockedAdminRow && (a.key === 'view' || a.key === 'update'));
                          return (
                            <td key={a.key} className="py-2.5 px-2 text-center">
                              <label
                                title={fn.actionHints[a.key]}
                                className={`inline-flex flex-col items-center gap-0.5 ${
                                  disabledCell ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  disabled={disabledCell}
                                  checked={Boolean(p[a.key])}
                                  onChange={() => toggleCell(fn.id, a.key)}
                                  className="w-4 h-4 accent-[#1ABB9C]"
                                />
                              </label>
                            </td>
                          );
                        })}
                        <td className="py-2.5 pl-2 text-right">
                          <div className="inline-flex items-center gap-1 text-[10px]">
                            <button
                              type="button"
                              disabled={!canUpdate}
                              onClick={() => applyRowPreset(fn.id, 'FULL')}
                              className="px-1.5 py-0.5 rounded bg-[#E6F7F4] text-[#169F85] hover:bg-[#1ABB9C] hover:text-white font-semibold"
                            >
                              Full
                            </button>
                            <button
                              type="button"
                              disabled={!canUpdate || isLockedAdminRow}
                              onClick={() => applyRowPreset(fn.id, 'READ')}
                              className="px-1.5 py-0.5 rounded bg-[#EFF6FF] text-[#2563EB] hover:bg-[#3498DB] hover:text-white font-semibold disabled:opacity-40"
                            >
                              Xem
                            </button>
                            <button
                              type="button"
                              disabled={!canUpdate || isLockedAdminRow}
                              onClick={() => applyRowPreset(fn.id, 'NONE')}
                              className="px-1.5 py-0.5 rounded bg-[#FEF2F2] text-[#B91C1C] hover:bg-[#E74C3C] hover:text-white font-semibold disabled:opacity-40"
                            >
                              Tắt
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
};
