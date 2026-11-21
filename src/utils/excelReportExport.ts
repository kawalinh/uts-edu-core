import * as XLSX from 'xlsx';
import type { UnitTestSuiteReport } from '../tests/utsUnitTestSuite';
import { SCREEN_LABELS } from '../tests/utsUnitTestSuite';
import type { NavSectionId } from './rbacConfig';

const SCREEN_ORDER: NavSectionId[] = [
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

export function buildUnitTestWorkbook(report: UnitTestSuiteReport): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Tổng quan Kết quả Kiểm thử
  const summaryRows = [
    { 'Hạng mục': 'Hệ thống kiểm thử', 'Giá trị': 'UTS EduCore — Quản lý Thời khóa biểu Đại học Tổng quát' },
    { 'Hạng mục': 'Thời điểm chạy kiểm thử', 'Giá trị': new Date(report.runAt).toLocaleString('vi-VN') },
    { 'Hạng mục': 'Tổng số kịch bản (Test Cases)', 'Giá trị': report.total },
    { 'Hạng mục': 'Số lượng ĐẠT (PASS)', 'Giá trị': report.passed },
    { 'Hạng mục': 'Số lượng KHÔNG ĐẠT (FAIL)', 'Giá trị': report.failed },
    { 'Hạng mục': 'Tỷ lệ thành công (%)', 'Giá trị': `${report.passRate}%` },
    { 'Hạng mục': 'Tổng thời gian thực thi (ms)', 'Giá trị': `${report.totalDurationMs} ms` },
    { 'Hạng mục': 'Số lượng Vai trò RBAC được kiểm thử', 'Giá trị': '6 / 6 (SYS_ADMIN, EXECUTIVE, SCHEDULER, FACULTY_HEAD, INSTRUCTOR, STUDENT)' },
    { 'Hạng mục': 'Số lượng Màn hình được kiểm thử', 'Giá trị': '9 / 9 (Dashboard, Admin, Master Data, Grid Builder, Workflow, Planning, Reports, Mobile, RBAC)' },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 38 }, { wch: 76 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'TongQuan_KetQua');

  // Sheet 2: Ma trận Kiểm thử Role × Màn hình
  const matrixRows = report.roleMatrix.map((rm) => {
    const row: Record<string, string | number> = {
      'Vai trò (Role)': rm.roleLabel,
      'Tổng TC': rm.total,
      'PASS': rm.passed,
      'FAIL': rm.failed,
      'Tỷ lệ (%)': `${rm.passRate}%`,
    };
    for (const sc of SCREEN_ORDER) {
      row[SCREEN_LABELS[sc]] = rm.screensCovered[sc];
    }
    return row;
  });
  const wsMatrix = XLSX.utils.json_to_sheet(matrixRows);
  wsMatrix['!cols'] = [
    { wch: 34 },
    { wch: 10 },
    { wch: 8 },
    { wch: 8 },
    { wch: 12 },
    ...SCREEN_ORDER.map(() => ({ wch: 24 })),
  ];
  XLSX.utils.book_append_sheet(wb, wsMatrix, 'MaTran_Role_ManHinh');

  // Sheet 3: Chi tiết toàn bộ Unit Test Cases
  const detailRows = report.results.map((r) => ({
    'STT': r.stt,
    'Mã Test Case': r.testId,
    'Vai trò (Role)': r.roleLabel,
    'Màn hình': r.screenName,
    'Phân nhóm nghiệp vụ': r.category,
    'Tên kịch bản kiểm thử': r.title,
    'Dữ liệu đầu vào': r.inputSummary,
    'Kết quả kỳ vọng': r.expectedResult,
    'Kết quả thực tế': r.actualResult,
    'Trạng thái': r.status,
    'Thời gian (ms)': r.durationMs,
  }));
  const wsDetail = XLSX.utils.json_to_sheet(detailRows);
  wsDetail['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 32 },
    { wch: 30 },
    { wch: 28 },
    { wch: 48 },
    { wch: 42 },
    { wch: 48 },
    { wch: 46 },
    { wch: 12 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetail, 'ChiTiet_UnitTestCases');

  return wb;
}

export function downloadUnitTestExcelInBrowser(
  report: UnitTestSuiteReport,
  filename = 'UTS_UnitTest_Report_AllRoles_AllScreens.xlsx'
): void {
  const wb = buildUnitTestWorkbook(report);
  XLSX.writeFile(wb, filename);
}
