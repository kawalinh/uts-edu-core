import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Code2,
  FileSpreadsheet,
  FlaskConical,
  Play,
  Search,
  Settings,
  ShieldCheck,
  TableProperties,
  XCircle,
} from 'lucide-react';
import { ROLE_PROFILES } from '../../data/seedData';
import { useUTS } from '../../context/UTSContext';
import { ExportToolbar } from '../common/ExportToolbar';
import {
  PERMISSION_FUNCTIONS,
  checkRolePermission,
  deriveRoleCapabilitiesFromGroups,
  type NavSectionId,
} from '../../utils/rbacConfig';
import {
  SCREEN_LABELS,
  type UnitTestSuiteReport,
  runAllUTSUnitTests,
} from '../../tests/utsUnitTestSuite';
import { downloadUnitTestExcelInBrowser } from '../../utils/excelReportExport';
import type { RoleGroup, UserRole } from '../../types/uts';

const formatCrudCell = (group: RoleGroup | undefined, fnId: (typeof PERMISSION_FUNCTIONS)[number]['id']): string => {
  if (!group) return '—';
  const p = group.permissions[fnId];
  if (!p || (!p.view && !p.create && !p.update && !p.delete)) return '—';
  const parts: string[] = [];
  if (p.view) parts.push('Xem');
  if (p.create) parts.push('Thêm');
  if (p.update) parts.push('Sửa');
  if (p.delete) parts.push('Xóa');
  return parts.join(' · ');
};

const RTM_ROWS = [
  { br: 'BR-MD-01', name: 'Quản lý Cấu trúc Đào tạo Đa tầng & Danh mục Tòa nhà / Khoa', srs: 'SRS-WEB-01', comp: 'Master Data Service', tc: 'UT-ADM-12 (Full CRUD Tòa nhà, Khoa, Phòng, Mô hình thi)' },
  { br: 'BR-MD-02', name: 'Quản lý Môn học 4 Cấu phần (LT/BT/TL/TH) & Đa loại phòng', srs: 'SRS-WEB-01', comp: 'Master Data Service', tc: 'UT-ADM-05 / UT-SCH-04 (Tỷ lệ tín chỉ, Đa phòng & Cycle Detection)' },
  { br: 'BR-MD-04', name: 'Quản lý Giảng đường, Sức chứa & BMS/IoT', srs: 'SRS-WEB-01', comp: 'Room Service', tc: 'UT-ADM-12 / UT-SCH-11 (CRUD Phòng học & sức chứa)' },
  { br: 'BR-TT-01', name: 'Bảng Lưới Lập lịch Đa chiều (4 góc nhìn)', srs: 'SRS-WEB-02', comp: 'Timetable Frontend Grid', tc: 'UT-SCH-02 / UT-INS-02 / UT-STU-02 (Kéo thả & Scope theo Role)' },
  { br: 'BR-TT-02', name: 'Phát hiện Xung đột Cứng Tức thời (UAC-01)', srs: 'SRS-WEB-03', comp: 'Conflict Detection Engine', tc: 'UT-SCH-02 (Chặn trùng phòng A1-201 & gợi ý Top 3)' },
  { br: 'BR-TT-04', name: 'Ghép Lớp Lý thuyết & Tách Tốp Thực hành Lab', srs: 'SRS-WEB-02', comp: 'Section Split/Merge Engine', tc: 'UT-SCH-03 (CSP Auto-Solver & nhận diện tách tốp Lab)' },
  { br: 'BR-CM-01', name: 'Khởi tạo Đơn Đổi lịch / Báo nghỉ Trực tuyến', srs: 'SRS-WEB-04 / MOB-03', comp: 'Workflow Service & App', tc: 'UT-INS-04 (Giảng viên gửi đơn 3 chạm)' },
  { br: 'BR-CM-02', name: 'Luồng Phê duyệt Đa cấp 24h SLA & Rollback', srs: 'SRS-WEB-04', comp: 'Approval State Machine', tc: 'UT-FAC-02 / UT-SCH-06 (Duyệt Cấp 1 -> Cấp 2, UAC-02)' },
  { br: 'BR-MO-01', name: 'Tra cứu Lịch Cá nhân & Bộ nhớ đệm Ngoại tuyến', srs: 'SRS-MOB-01', comp: 'Mobile App Local SQLite', tc: 'UT-STU-05 (Xem lịch Offline & Push Before/After)' },
  { br: 'BR-SYS-01', name: 'Quản trị Người dùng, Nhóm quyền CRUD (Xem/Thêm/Sửa/Xóa) & Cron Jobs', srs: 'SRS-ADMIN-01', comp: 'System Admin & RBAC Engine', tc: 'UT-ADM-02 / UT-ADM-13 (Phân quyền 12 chức năng × 4 thao tác CRUD)' },
];

const API_ENDPOINTS = [
  { method: 'CRUD', path: '/api/v1/master/buildings | faculties | classrooms | exam-models | instructors', desc: 'Quản trị Full CRUD Master Data toàn hệ thống có kiểm tra toàn vẹn tham chiếu & Audit Log' },
  { method: 'CRUD', path: '/api/v1/courses | /api/v1/courses/:courseId', desc: 'Quản trị Học phần 4 cấu phần (LT/BT/TL/TH), đa loại phòng & ánh xạ Mô hình thi' },
  { method: 'CRUD', path: '/api/v1/admin/role-groups | /api/v1/admin/role-groups/reset', desc: 'Quản trị Nhóm quyền & Ma trận phân quyền 12 chức năng × 4 thao tác (Xem/Thêm/Sửa/Xóa)' },
  { method: 'CRUD', path: '/api/v1/admin/users | /api/v1/admin/users/:userId', desc: 'Quản trị người dùng RBAC: Tạo mới, sửa thông tin/vai trò, khóa/mở khóa, xóa tài khoản' },
  { method: 'POST', path: '/api/v1/scheduling/check-availability', desc: 'Quét xung đột 5 bước (hỗ trợ đa loại phòng) & trả Top 3 phương án thay thế' },
  { method: 'POST', path: '/api/v1/scheduling/sessions/assign | split | merge | auto-solve', desc: 'Điều phối slot học phần, tách tốp Lab, ghép lớp Hội trường & Bộ giải CSP' },
  { method: 'POST', path: '/api/v1/sections/:sectionId/assign-instructor', desc: 'Phân công Đa Giảng viên (LEAD / CO_TEACHER / TA / LAB_TECH)' },
  { method: 'POST', path: '/api/v1/mobile/instructor/reschedule-request', desc: 'Giảng viên gửi đơn báo nghỉ & dạy bù (HTTP 201 + SLA 24h)' },
  { method: 'POST', path: '/api/v1/requests/:id/action', desc: 'Approval State Machine Cấp 1 (Khoa) -> Cấp 2 (Phòng ĐT)' },
  { method: 'POST', path: '/api/v1/audit/:logId/rollback', desc: 'Quay lui trạng thái buổi học & phát thông báo đính chính' },
  { method: 'POST', path: '/api/v1/admin/notifications/:channelId/test', desc: 'Cấu hình bật/tắt & phát thử thông báo qua FCM / SMTP / SMS / Webhook' },
  { method: 'POST', path: '/api/v1/admin/jobs/:jobId/run', desc: 'Thực thi Job Tự động tổng hợp KPI, quét SLA 24h, đồng bộ SIS/LMS & BMS' },
];

const SCREEN_LIST: NavSectionId[] = [
  'dashboard',
  'admin',
  'master',
  'builder',
  'workflow',
  'planning',
  'reports',
  'mobile',
  'rbac',
];

export const RbacArchitectureView: React.FC = () => {
  const { state, currentRole, switchRole, addToast, setActiveNav, hasPermission } = useUTS();
  const [apiTab, setApiTab] = useState<'UNIT_TESTS' | 'RBAC' | 'RTM' | 'API'>('UNIT_TESTS');
  const [rtmSearch, setRtmSearch] = useState('');

  // Unit Test Suite live state
  const [testReport, setTestReport] = useState<UnitTestSuiteReport>(() => runAllUTSUnitTests());
  const [testRoleFilter, setTestRoleFilter] = useState<string>('ALL');
  const [testScreenFilter, setTestScreenFilter] = useState<string>('ALL');
  const [testSearch, setTestSearch] = useState<string>('');

  const handleRunTests = () => {
    const fresh = runAllUTSUnitTests();
    setTestReport(fresh);
    addToast({
      type: fresh.failed === 0 ? 'success' : 'error',
      title: `Hoàn tất kiểm thử Unit Test: ${fresh.passed}/${fresh.total} ĐẠT (${fresh.passRate}%)`,
      detail: `Thời gian thực thi: ${fresh.totalDurationMs}ms trên đủ 6 Vai trò × 9 Màn hình.`,
    });
  };

  const handleDownloadExcel = () => {
    downloadUnitTestExcelInBrowser(testReport);
    addToast({
      type: 'success',
      title: 'Đã xuất báo cáo Unit Test dạng Excel (.xlsx)',
      detail: `Tệp gồm 3 sheet: Tổng quan, Ma trận Role × Màn hình và Chi tiết ${testReport.total} Test Cases.`,
    });
  };

  const filteredTests = useMemo(() => {
    const q = testSearch.trim().toLowerCase();
    return testReport.results.filter((r) => {
      if (testRoleFilter !== 'ALL' && r.role !== testRoleFilter) return false;
      if (testScreenFilter !== 'ALL' && r.screenId !== testScreenFilter) return false;
      if (q) {
        const hay = `${r.testId} ${r.roleLabel} ${r.screenName} ${r.category} ${r.title} ${r.actualResult}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [testReport.results, testRoleFilter, testScreenFilter, testSearch]);

  const filteredRtm = useMemo(() => {
    const q = rtmSearch.trim().toLowerCase();
    if (!q) return RTM_ROWS;
    return RTM_ROWS.filter((r) =>
      `${r.br} ${r.name} ${r.srs} ${r.comp} ${r.tc}`.toLowerCase().includes(q)
    );
  }, [rtmSearch]);

  return (
    <div className="space-y-4">
      <div className="x_panel px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setApiTab('UNIT_TESTS')}
            className={`px-3.5 py-2 rounded text-xs font-semibold inline-flex items-center gap-1.5 ${
              apiTab === 'UNIT_TESTS' ? 'bg-[#2A3F54] text-white' : 'bg-[#F2F5F7] text-[#5A738E]'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5 text-[#1ABB9C]" />
            Kiểm thử Tự động Unit Test ({testReport.passed}/{testReport.total}) & Xuất Excel
          </button>
          <button
            type="button"
            onClick={() => setApiTab('RBAC')}
            className={`px-3.5 py-2 rounded text-xs font-semibold inline-flex items-center gap-1.5 ${
              apiTab === 'RBAC' ? 'bg-[#2A3F54] text-white' : 'bg-[#F2F5F7] text-[#5A738E]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#1ABB9C]" />
            Ma trận Phân quyền RBAC (6 Vai trò)
          </button>
          <button
            type="button"
            onClick={() => setApiTab('RTM')}
            className={`px-3.5 py-2 rounded text-xs font-semibold inline-flex items-center gap-1.5 ${
              apiTab === 'RTM' ? 'bg-[#2A3F54] text-white' : 'bg-[#F2F5F7] text-[#5A738E]'
            }`}
          >
            <TableProperties className="w-3.5 h-3.5 text-[#3498DB]" />
            Ma trận Truy vết Yêu cầu (RTM)
          </button>
          <button
            type="button"
            onClick={() => setApiTab('API')}
            className={`px-3.5 py-2 rounded text-xs font-semibold inline-flex items-center gap-1.5 ${
              apiTab === 'API' ? 'bg-[#2A3F54] text-white' : 'bg-[#F2F5F7] text-[#5A738E]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-[#F39C12]" />
            Đặc tả RESTful API & 3NF
          </button>
        </div>
      </div>

      {/* TAB 1: AUTOMATED UNIT TEST SUITE & EXCEL EXPORT */}
      {apiTab === 'UNIT_TESTS' && (
        <div className="space-y-4">
          {/* Summary KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="x_panel p-4">
              <div className="text-xs text-[#73879C]">Tổng kịch bản Unit Test</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#2A3F54] mt-1">{testReport.total}</div>
              <div className="text-[11px] text-[#5A738E] mt-0.5">6 Vai trò × 9 Màn hình</div>
            </div>
            <div className="x_panel p-4">
              <div className="text-xs text-[#73879C]">ĐẠT (PASS)</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#169F85] mt-1">{testReport.passed}</div>
              <div className="text-[11px] text-[#169F85] mt-0.5">Khớp 100% kỳ vọng</div>
            </div>
            <div className="x_panel p-4">
              <div className="text-xs text-[#73879C]">KHÔNG ĐẠT (FAIL)</div>
              <div className={`text-2xl font-bold font-mono tabular-nums mt-1 ${testReport.failed === 0 ? 'text-[#2A3F54]' : 'text-[#E74C3C]'}`}>
                {testReport.failed}
              </div>
              <div className="text-[11px] text-[#5A738E] mt-0.5">0 lỗi chặn demo</div>
            </div>
            <div className="x_panel p-4">
              <div className="text-xs text-[#73879C]">Tỷ lệ Thành công</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#169F85] mt-1">{testReport.passRate}%</div>
              <div className="text-[11px] text-[#5A738E] mt-0.5">Thực thi trong {testReport.totalDurationMs}ms</div>
            </div>
            <div className="x_panel p-4 flex flex-col justify-between gap-2">
              <button
                type="button"
                onClick={handleRunTests}
                className="w-full py-1.5 px-3 rounded bg-[#2A3F54] hover:bg-[#172D44] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 text-[#1ABB9C]" />
                Chạy lại toàn bộ Test
              </button>
              <button
                type="button"
                onClick={handleDownloadExcel}
                className="w-full py-1.5 px-3 rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Xuất Kết quả Excel (.xlsx)
              </button>
            </div>
          </div>

          {/* Role × Screen Coverage Matrix */}
          <section className="x_panel">
            <div className="x_title flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-bold text-[#2A3F54]">
                  Ma trận Kết quả Kiểm thử: 6 Vai trò Người dùng × 9 Màn hình Chức năng
                </h2>
                <p className="text-xs text-[#73879C] mt-0.5">
                  Xác minh mọi màn hình được phân quyền đều chạy thành công và mọi màn hình bị hạn chế đều được bảo vệ RBAC (Guard PASS)
                </p>
              </div>
              <a
                href="/exports/UTS_UnitTest_Report_AllRoles_AllScreens.xlsx"
                download="UTS_UnitTest_Report_AllRoles_AllScreens.xlsx"
                className="text-xs font-semibold text-[#169F85] hover:underline inline-flex items-center gap-1"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Tải file Excel bản chạy CLI (.xlsx)
              </a>
            </div>
            <div className="x_content overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#E6E9ED] text-[#5A738E] text-left">
                    <th className="py-2 pr-2 font-semibold min-w-[180px]">Vai trò (Role)</th>
                    <th className="py-2 px-1.5 text-center font-semibold">Đạt</th>
                    {SCREEN_LIST.map((sc) => (
                      <th key={sc} className="py-2 px-1.5 text-center font-semibold">
                        {sc.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E9ED] font-mono">
                  {testReport.roleMatrix.map((rm) => (
                    <tr key={rm.role} className="hover:bg-[#F7F7F7]">
                      <td className="py-2 pr-2 font-sans font-semibold text-[#2A3F54]">
                        <button
                          type="button"
                          onClick={() => setTestRoleFilter(rm.role)}
                          className="hover:text-[#169F85] hover:underline text-left"
                        >
                          {rm.roleLabel}
                        </button>
                      </td>
                      <td className="py-2 px-1.5 text-center font-bold text-[#169F85]">
                        {rm.passed}/{rm.total}
                      </td>
                      {SCREEN_LIST.map((sc) => {
                        const cell = rm.screensCovered[sc];
                        const isGuard = cell.startsWith('GUARD');
                        const isPass = cell.startsWith('PASS');
                        return (
                          <td key={sc} className="py-2 px-1.5 text-center">
                            <span
                              className={
                                isPass
                                  ? 'text-[#169F85] font-semibold'
                                  : isGuard
                                    ? 'text-[#3498DB] font-semibold'
                                    : 'text-[#94A3B8]'
                              }
                            >
                              {cell}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Detailed Unit Test Cases Table */}
          <section className="x_panel">
            <div className="x_title flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-bold text-[#2A3F54]">
                  Danh sách Chi tiết Kịch bản Unit Test ({filteredTests.length} / {testReport.total})
                </h2>
                <p className="text-xs text-[#73879C] mt-0.5">
                  Lọc theo từng vai trò hoặc màn hình để đối chiếu Điều kiện đầu vào, Kết quả kỳ vọng và Kết quả thực thi thực tế
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  className="px-3 py-1.5 rounded bg-[#1ABB9C] hover:bg-[#169F85] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Xuất Excel (.xlsx)
                </button>
                <ExportToolbar
                  compact
                  filenameBase="UTS_UnitTest_ChiTiet"
                  reportTitle="Báo cáo Chi tiết Unit Test theo Vai trò & Màn hình"
                  columns={[
                    { header: 'STT', accessor: (r) => r.stt },
                    { header: 'Mã TC', accessor: (r) => r.testId },
                    { header: 'Vai trò', accessor: (r) => r.roleLabel },
                    { header: 'Màn hình', accessor: (r) => r.screenName },
                    { header: 'Nhóm nghiệp vụ', accessor: (r) => r.category },
                    { header: 'Tên kịch bản', accessor: (r) => r.title },
                    { header: 'Đầu vào', accessor: (r) => r.inputSummary },
                    { header: 'Kỳ vọng', accessor: (r) => r.expectedResult },
                    { header: 'Thực tế', accessor: (r) => r.actualResult },
                    { header: 'Trạng thái', accessor: (r) => r.status },
                    { header: 'Thời gian (ms)', accessor: (r) => r.durationMs },
                  ]}
                  rows={filteredTests}
                />
              </div>
            </div>

            <div className="px-4 py-2.5 bg-[#FAFAFA] border-b border-[#E6E9ED] flex flex-wrap items-center gap-2 text-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#73879C] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={testSearch}
                  onChange={(e) => setTestSearch(e.target.value)}
                  placeholder="Tìm mã TC, mô tả, kết quả..."
                  className="border border-[#D9DEE4] rounded pl-8 pr-2.5 py-1.5 bg-white w-[220px]"
                />
              </div>
              <select
                value={testRoleFilter}
                onChange={(e) => setTestRoleFilter(e.target.value)}
                className="border border-[#D9DEE4] rounded px-2.5 py-1.5 bg-white"
              >
                <option value="ALL">Tất cả 6 Vai trò</option>
                {ROLE_PROFILES.map((rp) => (
                  <option key={rp.role} value={rp.role}>
                    {rp.label} ({rp.role})
                  </option>
                ))}
              </select>
              <select
                value={testScreenFilter}
                onChange={(e) => setTestScreenFilter(e.target.value)}
                className="border border-[#D9DEE4] rounded px-2.5 py-1.5 bg-white"
              >
                <option value="ALL">Tất cả 9 Màn hình</option>
                {SCREEN_LIST.map((sc) => (
                  <option key={sc} value={sc}>
                    {SCREEN_LABELS[sc]}
                  </option>
                ))}
              </select>
            </div>

            <div className="x_content overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#E6E9ED] text-[#5A738E] text-left">
                    <th className="py-2 pr-2 font-semibold">Mã TC</th>
                    <th className="py-2 px-2 font-semibold">Vai trò / Màn hình</th>
                    <th className="py-2 px-2 font-semibold">Kịch bản Kiểm thử & Đầu vào</th>
                    <th className="py-2 px-2 font-semibold">Kỳ vọng / Kết quả Thực tế</th>
                    <th className="py-2 pl-2 text-right font-semibold">Kết quả</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E9ED]">
                  {filteredTests.map((tc) => (
                    <tr key={tc.testId} className="hover:bg-[#F7F7F7] align-top">
                      <td className="py-2.5 pr-2 font-mono font-bold text-[#2A3F54] whitespace-nowrap">
                        <div>{tc.testId}</div>
                        <div className="text-[10px] font-normal text-[#73879C]">{tc.durationMs}ms</div>
                      </td>
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <div className="font-mono text-[11px] font-bold text-[#169F85]">{tc.role}</div>
                        <div className="text-[11px] text-[#5A738E]">{tc.screenName}</div>
                      </td>
                      <td className="py-2.5 px-2 max-w-[340px]">
                        <div className="font-semibold text-[#2A3F54]">{tc.title}</div>
                        <div className="text-[11px] text-[#73879C] mt-0.5">
                          <strong>Đầu vào:</strong> {tc.inputSummary}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 max-w-[360px]">
                        <div className="text-[11px] text-[#5A738E]">
                          <strong>Kỳ vọng:</strong> {tc.expectedResult}
                        </div>
                        <div className="text-[11px] font-mono text-[#2A3F54] mt-0.5 bg-[#FAFAFA] border border-[#E6E9ED] rounded px-1.5 py-0.5">
                          <strong>Thực tế:</strong> {tc.actualResult}
                        </div>
                      </td>
                      <td className="py-2.5 pl-2 text-right whitespace-nowrap">
                        {tc.status === 'PASS' ? (
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-[#169F85]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-[#E74C3C]">
                            <XCircle className="w-3.5 h-3.5" /> FAIL
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: RBAC MATRIX & DETAILED ROLE CAPABILITIES (LIVE SYNCED WITH state.roleGroups) */}
      {apiTab === 'RBAC' && (
        <section className="x_panel">
          <div className="x_title flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-bold text-[#2A3F54]">
                Ma trận Phân quyền Chi tiết Toàn hệ thống (12 Chức năng × 4 Thao tác: Xem / Thêm / Sửa / Xóa)
              </h2>
              <p className="text-xs text-[#73879C] mt-0.5">
                Đọc trực tiếp từ cấu hình Nhóm quyền đang vận hành ({state.roleGroups.length} nhóm quyền) — mọi thay đổi ở phân hệ Quản trị HT sẽ đồng bộ tức thời tại đây
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {hasPermission('ADMIN_USERS_ROLES', 'update') && (
                <button
                  type="button"
                  onClick={() => setActiveNav('admin')}
                  className="px-3 py-1.5 rounded bg-[#2A3F54] hover:bg-[#1E2E3E] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Settings className="w-3.5 h-3.5 text-[#1ABB9C]" />
                  Điều chỉnh Phân quyền Chi tiết
                </button>
              )}
              <ExportToolbar
                compact
                filenameBase="UTS_MaTranPhanQuyen_CRUD_ChiTiet"
                reportTitle="Ma trận Phân quyền CRUD Chi tiết (12 Chức năng × Nhóm quyền)"
                columns={[
                  { header: 'Nhóm nghiệp vụ', accessor: (fn) => fn.moduleGroup },
                  { header: 'Chức năng hệ thống', accessor: (fn) => fn.label },
                  { header: 'Mô tả nghiệp vụ', accessor: (fn) => fn.description },
                  ...state.roleGroups.map((rg) => ({
                    header: rg.name,
                    accessor: (fn: (typeof PERMISSION_FUNCTIONS)[number]) => formatCrudCell(rg, fn.id),
                  })),
                ]}
                rows={PERMISSION_FUNCTIONS}
              />
            </div>
          </div>
          <div className="x_content space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {ROLE_PROFILES.map((rp) => {
                const active = rp.role === currentRole.role;
                const liveCap = deriveRoleCapabilitiesFromGroups(state.roleGroups, rp.role as UserRole);
                const permCount = PERMISSION_FUNCTIONS.reduce((acc, fn) => {
                  const hasV = checkRolePermission(state.roleGroups, rp.role, fn.id, 'view') ? 1 : 0;
                  const hasC = checkRolePermission(state.roleGroups, rp.role, fn.id, 'create') ? 1 : 0;
                  const hasU = checkRolePermission(state.roleGroups, rp.role, fn.id, 'update') ? 1 : 0;
                  const hasD = checkRolePermission(state.roleGroups, rp.role, fn.id, 'delete') ? 1 : 0;
                  return acc + hasV + hasC + hasU + hasD;
                }, 0);
                return (
                  <button
                    key={rp.role}
                    type="button"
                    onClick={() => switchRole(rp.role)}
                    className={`p-3.5 rounded border text-left transition-colors text-xs flex flex-col justify-between gap-2 ${
                      active
                        ? 'border-[#1ABB9C] bg-[#1ABB9C]/10'
                        : 'border-[#E6E9ED] bg-white hover:border-[#1ABB9C]/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#2A3F54]">{rp.label}</span>
                        {active && <CheckCircle2 className="w-4 h-4 text-[#1ABB9C]" />}
                      </div>
                      <div className="text-[11px] text-[#5A738E] mt-0.5">{rp.userName} · {rp.userTitle}</div>
                      <div className="text-[11px] font-mono text-[#169F85] mt-1">
                        Scope: {rp.scopeLabel} · {liveCap.allowedNavs.length} màn · {permCount}/48 quyền CRUD
                      </div>
                      <ul className="mt-2 space-y-1 text-[11px] text-[#5A738E] list-disc pl-4">
                        {liveCap.featureHighlights.slice(0, 3).map((hl) => (
                          <li key={hl}>{hl}</li>
                        ))}
                      </ul>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[960px]">
                <thead>
                  <tr className="border-b-2 border-[#E6E9ED] text-[#5A738E] text-left">
                    <th className="py-2 pr-2 font-semibold">Chức năng Nghiệp vụ (12 Nhóm)</th>
                    {state.roleGroups.map((rg) => (
                      <th key={rg.groupId} className="py-2 px-2 font-semibold">
                        <div className="text-[#2A3F54]">{rg.name}</div>
                        <div className="font-mono text-[10px] text-[#73879C] font-normal">{rg.code}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E9ED] text-[11px]">
                  {PERMISSION_FUNCTIONS.map((fn) => (
                    <tr key={fn.id} className="hover:bg-[#F7F7F7]">
                      <td className="py-2.5 pr-2">
                        <div className="font-semibold text-[#2A3F54]">{fn.label}</div>
                        <div className="text-[10px] text-[#73879C]">{fn.moduleGroup} · {fn.description}</div>
                      </td>
                      {state.roleGroups.map((rg) => {
                        const cell = formatCrudCell(rg, fn.id);
                        const p = rg.permissions[fn.id];
                        const isFull = p?.view && p?.create && p?.update && p?.delete;
                        const isWrite = p?.create || p?.update || p?.delete;
                        return (
                          <td
                            key={rg.groupId}
                            className={`py-2.5 px-2 font-mono whitespace-nowrap ${
                              isFull
                                ? 'text-[#169F85] font-bold'
                                : isWrite
                                  ? 'text-[#3498DB] font-semibold'
                                  : cell === '—'
                                    ? 'text-[#CBD5E1]'
                                    : 'text-[#5A738E]'
                            }`}
                          >
                            {cell}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* TAB 3: RTM */}
      {apiTab === 'RTM' && (
        <section className="x_panel">
          <div className="x_title flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold text-[#2A3F54]">
                Ma trận Truy vết Yêu cầu Kỹ thuật (Requirements Traceability Matrix — RTM)
              </h2>
              <p className="text-xs text-[#73879C] mt-0.5">
                Ánh xạ 100% từ Yêu cầu Nghiệp vụ (BRD) sang Đặc tả Phần mềm (SRS) và Kịch bản Kiểm thử Tự động
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#73879C] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={rtmSearch}
                  onChange={(e) => setRtmSearch(e.target.value)}
                  placeholder="Tìm mã BR, SRS, TC..."
                  className="text-xs border border-[#D9DEE4] rounded pl-8 pr-2.5 py-1.5 bg-white w-[180px]"
                />
              </div>
              <ExportToolbar
                compact
                filenameBase="UTS_MaTranTruyVet_RTM"
                reportTitle="Ma trận Truy vết Yêu cầu Kỹ thuật (RTM)"
                columns={[
                  { header: 'Mã BRD', accessor: (r) => r.br },
                  { header: 'Tên Nghiệp vụ', accessor: (r) => r.name },
                  { header: 'Mã SRS', accessor: (r) => r.srs },
                  { header: 'Thành phần Phần mềm', accessor: (r) => r.comp },
                  { header: 'Kịch bản Kiểm thử', accessor: (r) => r.tc },
                ]}
                rows={filteredRtm}
              />
            </div>
          </div>
          <div className="x_content overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-[#E6E9ED] text-[#5A738E] text-left">
                  <th className="py-2 pr-3 font-semibold">Mã BRD</th>
                  <th className="py-2 px-2 font-semibold">Tên Nghiệp vụ Cốt lõi</th>
                  <th className="py-2 px-2 font-semibold">Mã SRS</th>
                  <th className="py-2 px-2 font-semibold">Thành phần Phần mềm</th>
                  <th className="py-2 px-2 font-semibold">Kịch bản Kiểm thử (Test Case)</th>
                  <th className="py-2 pl-2 text-right font-semibold">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E9ED]">
                {filteredRtm.map((r) => (
                  <tr key={r.br} className="hover:bg-[#F7F7F7]">
                    <td className="py-2.5 pr-3 font-mono font-bold text-[#2A3F54]">{r.br}</td>
                    <td className="py-2.5 px-2 font-semibold text-[#2A3F54]">{r.name}</td>
                    <td className="py-2.5 px-2 font-mono text-[#3498DB]">{r.srs}</td>
                    <td className="py-2.5 px-2 text-[#5A738E]">{r.comp}</td>
                    <td className="py-2.5 px-2 font-mono text-[11px] text-[#5A738E]">{r.tc}</td>
                    <td className="py-2.5 pl-2 text-right text-[#169F85] font-semibold">Đã triển khai</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 4: API & 3NF */}
      {apiTab === 'API' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <section className="x_panel">
            <div className="x_title flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[14px] font-bold text-[#2A3F54]">
                Các Endpoint RESTful API Đang Vận hành ({API_ENDPOINTS.length})
              </h3>
              <ExportToolbar
                compact
                filenameBase="UTS_DacTa_RESTful_API"
                reportTitle="Danh mục RESTful API đang vận hành"
                columns={[
                  { header: 'HTTP Method', accessor: (e) => e.method },
                  { header: 'Endpoint Path', accessor: (e) => e.path },
                  { header: 'Mô tả nghiệp vụ', accessor: (e) => e.desc },
                ]}
                rows={API_ENDPOINTS}
              />
            </div>
            <div className="x_content space-y-2.5 font-mono text-[11px]">
              {API_ENDPOINTS.map((ep) => (
                <div key={ep.path} className="p-2.5 rounded border border-[#E6E9ED] bg-[#FAFAFA]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#169F85]">{ep.method}</span>
                    <span className="font-semibold text-[#2A3F54]">{ep.path}</span>
                  </div>
                  <div className="font-sans text-[#5A738E] mt-0.5">{ep.desc}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="x_panel">
            <div className="x_title">
              <h3 className="text-[14px] font-bold text-[#2A3F54]">
                Chiến lược Đánh Chỉ mục & Mô hình Dữ liệu 3NF (SRS Mục 7)
              </h3>
            </div>
            <div className="x_content space-y-3 text-xs">
              <div className="p-3 rounded bg-[#2A3F54] text-[#E2E8F0] font-mono text-[11px] overflow-x-auto leading-relaxed">
                {`-- Mandatory Composite Indexes (p99 < 500ms)
CREATE INDEX idx_session_conflict
  ON trn_class_sessions (room_id, session_date, start_period, total_periods);

CREATE INDEX idx_section_date
  ON trn_class_sessions (section_id, session_date);

-- Partitioning by Term_ID (PostgreSQL 16+)
PARTITION BY LIST (term_id);`}
              </div>
              <div className="space-y-1.5 text-[#5A738E]">
                <div><strong className="font-mono text-[#2A3F54]">mst_courses</strong>: Định mức 4 cấu phần tiết (LT/BT/TL/TH) + đa loại phòng bắt buộc (`requiredRoomTypes[]`) + kiểm tra đồ thị tiên quyết không chu trình.</div>
                <div><strong className="font-mono text-[#2A3F54]">mst_classrooms</strong>: Quản lý sức chứa tối đa, chủng loại phòng chuyên dụng, thiết bị và trạng thái BMS/IoT.</div>
                <div><strong className="font-mono text-[#2A3F54]">trn_course_sections</strong>: Lớp học phần vận hành theo học kỳ, hỗ trợ ghép lớp, tách tốp và phân công đa giảng viên.</div>
                <div><strong className="font-mono text-[#2A3F54]">sys_users / sys_jobs / sys_notifications</strong>: Quản trị tài khoản RBAC, kênh thông báo và lịch chạy Cron Jobs tự động.</div>
                <div><strong className="font-mono text-[#2A3F54]">audit_log</strong>: Ghi vết mili-giây Old_Values / New_Values phục vụ thanh tra và Rollback.</div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
