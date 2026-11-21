import React, { useState } from 'react';
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Database,
  FileSpreadsheet,
  GraduationCap,
  Lock,
  Menu,
  RotateCcw,
  Settings,
  ShieldCheck,
  Smartphone,
  Unlock,
  X,
} from 'lucide-react';
import { ROLE_PROFILES } from '../../data/seedData';
import { type NavSectionId, useUTS } from '../../context/UTSContext';

interface NavItem {
  id: NavSectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const NAV_GROUPS: { groupLabel: string; items: Omit<NavItem, 'badge'>[] }[] = [
  {
    groupLabel: 'Tổng quan & Điều hành',
    items: [
      { id: 'dashboard', label: 'Dashboard KPI & Giảng đường', icon: BarChart3 },
      { id: 'builder', label: 'Lập lịch Trực quan (Grid)', icon: CalendarDays },
      { id: 'workflow', label: 'Duyệt Biến động & Audit Log', icon: ClipboardCheck },
    ],
  },
  {
    groupLabel: 'Nghiệp vụ Đào tạo',
    items: [
      { id: 'master', label: 'Dữ liệu Gốc & Cơ sở Vật chất', icon: Database },
      { id: 'planning', label: 'Kế hoạch Tuần & Lịch Thi', icon: BookOpen },
      { id: 'reports', label: 'Báo cáo, Xuất ICS & Tích hợp', icon: FileSpreadsheet },
    ],
  },
  {
    groupLabel: 'Di động & Quản trị Hệ thống',
    items: [
      { id: 'mobile', label: 'Ứng dụng Di động (SV / GV)', icon: Smartphone },
      { id: 'admin', label: 'Quản trị HT, Master & Phân quyền', icon: Settings },
      { id: 'rbac', label: 'Ma trận RBAC & Unit Test', icon: ShieldCheck },
    ],
  },
];

const NAV_TITLES: Record<NavSectionId, { title: string; breadcrumb: string }> = {
  dashboard: { title: 'Dashboard Điều hành Đào tạo', breadcrumb: 'Tổng quan / Chỉ số Công suất Giảng đường' },
  admin: { title: 'Quản trị Hệ thống, Master Data & Phân quyền CRUD', breadcrumb: 'Quản trị HT / Tòa nhà, Khoa, Phòng, Mô hình thi, Nhóm quyền & Người dùng' },
  builder: { title: 'Bảng Điều khiển Lập lịch Đa chiều', breadcrumb: 'Lập lịch / Timetable Grid Builder & CSP' },
  master: { title: 'Quản trị Dữ liệu Gốc (Master Data)', breadcrumb: 'Đào tạo / Học phần, Giảng viên, Tòa nhà, Khoa, Phòng & Mô hình thi' },
  workflow: { title: 'Cổng Phê duyệt Biến động & Kiểm toán', breadcrumb: 'Vận hành / Đơn Báo nghỉ, Dạy bù & Rollback' },
  planning: { title: 'Kế hoạch Học kỳ & Tổ chức Kỳ thi', breadcrumb: 'Đào tạo / Phân bổ 15 Tuần, Mô hình thi & Lịch thi' },
  reports: { title: 'Trung tâm Báo cáo & Tích hợp Hệ sinh thái', breadcrumb: 'Phân tích / Ma trận Báo cáo, SIS/LMS & QR Điểm danh' },
  mobile: { title: 'Ứng dụng Di động Trợ lý Học thuật', breadcrumb: 'Di động / Mô phỏng Đồng bộ Thời gian thực' },
  rbac: { title: 'Phân quyền RBAC, Unit Test & Xuất Excel', breadcrumb: 'Hệ thống / Ma trận Phân quyền CRUD, RTM & Kiểm thử Tự động' },
};

export const GentelellaShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    state,
    activeNav,
    setActiveNav,
    setHighlightedSessionId,
    currentRole,
    roleCapabilities,
    switchRole,
    toasts,
    dismissToast,
    toggleFreeze,
    markAllNotificationsRead,
    resetDemoData,
  } = useUTS();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const pendingReqCount = state.changeRequests.filter(
    (r) => r.approvalStatus === 'PENDING_FACULTY_APPROVAL' || r.approvalStatus === 'PENDING_ACADEMIC_APPROVAL'
  ).length;
  const unassignedCount = state.sections.filter((s) => s.status === 'OPEN').length;
  const unreadNotifCount = state.notifications.filter((n) => !n.read).length;

  const getBadgeCount = (id: NavSectionId): number | undefined => {
    if (id === 'workflow' && pendingReqCount > 0) return pendingReqCount;
    if (id === 'builder' && unassignedCount > 0 && roleCapabilities.permissions.canEditSchedule) return unassignedCount;
    if (id === 'admin') return state.scheduledJobs.filter((j) => j.enabled).length;
    return undefined;
  };

  const handleNotificationClick = (sessionId?: string, deepLink?: string) => {
    setNotifOpen(false);
    if (deepLink?.includes('/requests/')) {
      setActiveNav('workflow');
      return;
    }
    if (sessionId) {
      setHighlightedSessionId(sessionId);
      setActiveNav('mobile');
    }
  };

  const pageMeta = NAV_TITLES[activeNav];
  const initials = currentRole.userName
    .split(' ')
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen flex bg-[#F7F7F7] text-[#2A3F54]">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar — Signature Gentelella #2A3F54 */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen flex flex-col bg-[#2A3F54] text-[#E7E7E7] transition-[width,transform] duration-200 shrink-0 ${
          collapsed ? 'w-[70px]' : 'w-[248px]'
        } ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="h-[58px] flex items-center px-4 border-b border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => setActiveNav('dashboard')}
            className="flex items-center gap-3 text-left min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ABB9C] rounded"
          >
            <span className="w-9 h-9 rounded-full border border-white/30 flex items-center justify-center shrink-0 bg-[#172D44]">
              <GraduationCap className="w-5 h-5 text-[#1ABB9C]" />
            </span>
            {!collapsed && (
              <span className="text-[19px] font-bold tracking-tight text-white whitespace-nowrap truncate font-[var(--font-display)]">
                UTS EduCore
              </span>
            )}
          </button>
        </div>

        {/* Classic Gentelella Profile Quick Info */}
        {!collapsed && (
          <div className="px-4 py-4 flex items-center gap-3 border-b border-white/10 shrink-0">
            <div className="w-11 h-11 rounded-full bg-[#1ABB9C] text-white font-bold text-sm flex items-center justify-center shrink-0 border-2 border-white/80">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-[#BAB8B8] leading-tight">Xin chào,</div>
              <div className="text-[13px] font-semibold text-white truncate">{currentRole.userName}</div>
              <div className="text-[11px] text-[#1ABB9C] truncate">{currentRole.shortLabel}</div>
            </div>
          </div>
        )}

        {/* Sidebar Navigation Groups — Filtered by active Role's RBAC allowedNavs */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-4">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter((item) =>
              roleCapabilities.allowedNavs.includes(item.id)
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.groupLabel}>
                {!collapsed && (
                  <div className="px-4 mb-1.5 text-[11px] font-semibold tracking-wider text-white/50">
                    {group.groupLabel}
                  </div>
                )}
                <ul className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeNav === item.id;
                    const count = getBadgeCount(item.id);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveNav(item.id);
                            setMobileMenuOpen(false);
                          }}
                          title={collapsed ? item.label : undefined}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors text-left relative ${
                            isActive
                              ? 'bg-[#35495D] text-white shadow-[inset_-4px_0_0_#1ABB9C]'
                              : 'text-[#E7E7E7]/85 hover:bg-[#35495D]/60 hover:text-white'
                          }`}
                        >
                          <Icon className={`w-[17px] h-[17px] shrink-0 ${isActive ? 'text-[#1ABB9C]' : 'text-[#E7E7E7]/75'}`} />
                          {!collapsed && (
                            <>
                              <span className="flex-1 truncate">{item.label}</span>
                              {count !== undefined && (
                                <span className="font-mono tabular-nums text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[#1ABB9C] text-white">
                                  {count}
                                </span>
                              )}
                              {count === undefined && isActive && (
                                <ChevronRight className="w-3.5 h-3.5 text-[#1ABB9C] shrink-0" />
                              )}
                            </>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Classic Gentelella Sidebar Footer Utility Strip (#172D44) */}
        <div className="bg-[#172D44] border-t border-white/10 grid grid-cols-4 shrink-0">
          <button
            type="button"
            disabled={!roleCapabilities.permissions.canFreezeTimetable}
            onClick={() => toggleFreeze(!state.isFrozen)}
            title={
              !roleCapabilities.permissions.canFreezeTimetable
                ? 'Chỉ Ban Giám hiệu / Phòng ĐT / Quản trị HT được đóng băng TKB'
                : state.isFrozen
                  ? 'Mở khóa dự thảo TKB'
                  : 'Đóng băng TKB (Mốc T-1)'
            }
            className="h-10 flex items-center justify-center text-[#5A738E] hover:text-white hover:bg-[#2A3F54] disabled:opacity-35 transition-colors"
          >
            {state.isFrozen ? <Lock className="w-4 h-4 text-[#F39C12]" /> : <Unlock className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => setActiveNav(roleCapabilities.allowedNavs.includes('mobile') ? 'mobile' : 'dashboard')}
            title="Mở Ứng dụng Di động"
            className="h-10 flex items-center justify-center text-[#5A738E] hover:text-white hover:bg-[#2A3F54] transition-colors"
          >
            <Smartphone className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('reports')}
            title="Xuất Báo cáo & iCalendar"
            className="h-10 flex items-center justify-center text-[#5A738E] hover:text-white hover:bg-[#2A3F54] transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={resetDemoData}
            title="Khôi phục dữ liệu mẫu ban đầu"
            className="h-10 flex items-center justify-center text-[#5A738E] hover:text-white hover:bg-[#2A3F54] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation Bar — Classic Gentelella #EDEDED / crisp white */}
        <header className="sticky top-0 z-30 h-[58px] bg-[#EDEDED] border-b border-[#D9DEE4] px-4 lg:px-6 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth < 1024) setMobileMenuOpen((v) => !v);
                else setCollapsed((v) => !v);
              }}
              aria-label="Thu gọn hoặc mở rộng menu"
              className="w-9 h-9 flex items-center justify-center rounded text-[#5A738E] hover:bg-black/5 hover:text-[#2A3F54] transition-colors shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0 hidden sm:block">
              <div className="text-[11px] text-[#73879C] truncate">{pageMeta.breadcrumb}</div>
              <div className="text-[14px] font-semibold text-[#2A3F54] truncate">{pageMeta.title}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Academic Term Info (clean unboxed text) */}
            <div className="hidden xl:flex items-center gap-2 text-xs text-[#5A738E] pr-2 border-r border-[#D9DEE4] whitespace-nowrap">
              <span className="font-semibold text-[#2A3F54]">{state.termName}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">Tuần {state.activeWeek}</span>
              <span aria-hidden="true">·</span>
              <span className={state.isFrozen ? 'text-[#D97706] font-semibold' : 'text-[#169F85] font-semibold'}>
                {state.isFrozen ? 'Đã đóng băng (T-1)' : 'Đang điều phối (T-4)'}
              </span>
            </div>

            {/* Notification Inbox Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  setRoleMenuOpen(false);
                }}
                className="relative w-9 h-9 flex items-center justify-center rounded hover:bg-black/5 text-[#5A738E] hover:text-[#2A3F54] transition-colors"
                aria-label="Hộp thư thông báo"
              >
                <Bell className="w-[18px] h-[18px]" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded bg-[#1ABB9C] text-white font-mono text-[10px] font-bold flex items-center justify-center">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-[360px] max-w-[92vw] bg-white border border-[#D9DEE4] rounded shadow-lg z-50">
                  <div className="px-4 py-2.5 border-b border-[#E6E9ED] flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2A3F54]">
                      Trung tâm Thông báo Thời gian thực ({state.notifications.length})
                    </span>
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      className="text-[11px] font-medium text-[#169F85] hover:underline"
                    >
                      Đánh dấu đã đọc
                    </button>
                  </div>
                  <div className="max-h-[340px] overflow-y-auto divide-y divide-[#E6E9ED]">
                    {state.notifications.slice(0, 8).map((n) => (
                      <button
                        key={n.notificationId}
                        type="button"
                        onClick={() => handleNotificationClick(n.sessionId, n.deepLink)}
                        className={`w-full text-left px-4 py-3 hover:bg-[#F7F7F7] transition-colors ${
                          !n.read ? 'bg-[#1ABB9C]/5' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold text-[#2A3F54]">{n.title}</span>
                          <span className="text-[10px] font-mono text-[#73879C] shrink-0">
                            {new Date(n.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[12px] text-[#5A738E] mt-0.5 leading-snug">{n.body}</p>
                        {n.beforeSummary && n.afterSummary && (
                          <div className="mt-1.5 text-[11px] bg-[#F7F7F7] border border-[#E6E9ED] rounded px-2 py-1.5 space-y-0.5">
                            <div className="text-[#73879C] line-through">{n.beforeSummary}</div>
                            <div className="text-[#169F85] font-medium">→ {n.afterSummary}</div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RBAC 6-Role Switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setRoleMenuOpen((v) => !v);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded bg-white border border-[#D9DEE4] hover:border-[#1ABB9C] transition-colors whitespace-nowrap"
              >
                <span className="w-6 h-6 rounded-full bg-[#2A3F54] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                  {initials}
                </span>
                <span className="text-xs font-semibold text-[#2A3F54] hidden md:inline">
                  {currentRole.shortLabel}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#73879C]" />
              </button>

              {roleMenuOpen && (
                <div className="absolute right-0 mt-2 w-[310px] bg-white border border-[#D9DEE4] rounded shadow-lg z-50 py-1.5">
                  <div className="px-3.5 py-2 border-b border-[#E6E9ED]">
                    <div className="text-[11px] font-bold text-[#2A3F54]">
                      Chuyển đổi Vai trò RBAC (6 Nhóm Tác nhân)
                    </div>
                    <div className="text-[11px] text-[#73879C]">
                      Kiểm thử phạm vi dữ liệu (Data Scope) & luồng phê duyệt
                    </div>
                  </div>
                  {ROLE_PROFILES.map((rp) => {
                    const selected = rp.role === currentRole.role;
                    return (
                      <button
                        key={rp.role}
                        type="button"
                        onClick={() => {
                          switchRole(rp.role);
                          setRoleMenuOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 flex items-start justify-between gap-2 hover:bg-[#F7F7F7] transition-colors ${
                          selected ? 'bg-[#1ABB9C]/10' : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#2A3F54]">{rp.label}</div>
                          <div className="text-[11px] text-[#73879C] truncate">
                            {rp.userName} · {rp.scopeLabel}
                          </div>
                        </div>
                        {selected && <CheckCircle2 className="w-4 h-4 text-[#1ABB9C] shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">{children}</main>

        {/* Quiet Gentelella Footer */}
        <footer className="px-6 py-3 bg-white border-t border-[#E6E9ED] text-[12px] text-[#73879C] flex flex-wrap items-center justify-between gap-2 no-print">
          <span>UTS EduCore — Hệ thống Quản lý Thời khóa biểu Đại học Tổng quát</span>
          <span>Chuẩn nghiệp vụ BRD/SRS · Học kỳ 1 năm học 2026–2027</span>
        </footer>
      </div>

      {/* Live Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-[380px] no-print">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded shadow-lg border text-xs flex items-start justify-between gap-3 bg-white ${
              t.type === 'success'
                ? 'border-[#1ABB9C] text-[#2A3F54]'
                : t.type === 'error'
                  ? 'border-[#E74C3C] text-[#2A3F54]'
                  : t.type === 'warning'
                    ? 'border-[#F39C12] text-[#2A3F54]'
                    : 'border-[#3498DB] text-[#2A3F54]'
            }`}
          >
            <div className="space-y-0.5">
              <div className="font-semibold flex items-center gap-1.5">
                <span
                  className={
                    t.type === 'success'
                      ? 'text-[#169F85]'
                      : t.type === 'error'
                        ? 'text-[#E74C3C]'
                        : t.type === 'warning'
                          ? 'text-[#D97706]'
                          : 'text-[#3498DB]'
                  }
                >
                  {t.title}
                </span>
              </div>
              {t.detail && <p className="text-[#5A738E] leading-snug">{t.detail}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="text-[#73879C] hover:text-[#2A3F54] shrink-0"
              aria-label="Đóng thông báo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
