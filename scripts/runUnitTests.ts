import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { runAllUTSUnitTests } from '../src/tests/utsUnitTestSuite';
import { buildUnitTestWorkbook } from '../src/utils/excelReportExport';

const report = runAllUTSUnitTests();

console.log('====================================================================');
console.log(' UTS EduCore — AUTOMATED UNIT TEST SUITE (6 ROLES × 9 SCREENS)');
console.log('====================================================================');
console.log(`Run At    : ${report.runAt}`);
console.log(`Total TCs : ${report.total}`);
console.log(`Passed    : ${report.passed}`);
console.log(`Failed    : ${report.failed}`);
console.log(`Pass Rate : ${report.passRate}%`);
console.log(`Duration  : ${report.totalDurationMs} ms`);
console.log('--------------------------------------------------------------------');

for (const rm of report.roleMatrix) {
  console.log(`  [${rm.role.padEnd(12)}] ${rm.passed}/${rm.total} PASS (${rm.passRate}%)`);
}
console.log('--------------------------------------------------------------------');

for (const r of report.results) {
  const mark = r.status === 'PASS' ? 'PASS' : 'FAIL';
  console.log(`  [${mark}] ${r.testId.padEnd(10)} | ${r.role.padEnd(12)} | ${r.screenId.padEnd(9)} | ${r.title}`);
  if (r.status === 'FAIL') {
    console.log(`         Expected: ${r.expectedResult}`);
    console.log(`         Actual  : ${r.actualResult}`);
  }
}

const outDir = path.resolve(process.cwd(), 'public', 'exports');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'UTS_UnitTest_Report_AllRoles_AllScreens.xlsx');
const wb = buildUnitTestWorkbook(report);
XLSX.writeFile(wb, outPath);

console.log('====================================================================');
console.log(`Excel Report generated: ${outPath}`);
console.log('====================================================================');

if (report.failed > 0) {
  process.exit(1);
}
