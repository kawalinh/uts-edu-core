import React from 'react';
import {
  ArrowLeft,
  CalendarCheck,
  Download,
  FileJson,
  Printer,
  X,
} from 'lucide-react';
import { type ExportColumn, exportRowsToCSV, exportRowsToJSON } from '../../utils/exportUtils';
import { useUTS } from '../../context/UTSContext';

interface ExportToolbarProps<T> {
  filenameBase: string;
  reportTitle: string;
  columns: ExportColumn<T>[];
  rows: T[];
  onExportICal?: () => void;
  iCalLabel?: string;
  compact?: boolean;
}

export function ExportToolbar<T>({
  filenameBase,
  reportTitle,
  columns,
  rows,
  onExportICal,
  iCalLabel = 'Xuất .ICS',
  compact = false,
}: ExportToolbarProps<T>) {
  const { addToast } = useUTS();

  const handleCSV = () => {
    exportRowsToCSV(filenameBase, columns, rows);
    addToast({
      type: 'success',
      title: `Đã kết xuất Excel/CSV (${rows.length} bản ghi)`,
      detail: `${reportTitle} — Định dạng UTF-8 tương thích Microsoft Excel.`,
    });
  };

  const handleJSON = () => {
    exportRowsToJSON(filenameBase, {
      reportTitle,
      totalRecords: rows.length,
      records: rows,
    });
    addToast({
      type: 'info',
      title: `Đã kết xuất JSON (${rows.length} bản ghi)`,
      detail: reportTitle,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const btnBase = compact
    ? 'px-2.5 py-1 text-[11px] font-semibold rounded transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0'
    : 'px-3 py-1.5 text-xs font-semibold rounded transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0';

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5 no-print">
      <button
        type="button"
        onClick={handleCSV}
        disabled={rows.length === 0}
        className={`${btnBase} bg-[#1ABB9C] hover:bg-[#169F85] text-white disabled:opacity-45`}
        title="Tải tệp bảng tính CSV/Excel"
      >
        <Download className="w-3.5 h-3.5" />
        Xuất Excel/CSV
      </button>
      <button
        type="button"
        onClick={handleJSON}
        disabled={rows.length === 0}
        className={`${btnBase} border border-[#D9DEE4] bg-white hover:border-[#1ABB9C] text-[#2A3F54] disabled:opacity-45`}
        title="Tải dữ liệu cấu trúc JSON"
      >
        <FileJson className="w-3.5 h-3.5 text-[#3498DB]" />
        JSON
      </button>
      {onExportICal && (
        <button
          type="button"
          onClick={onExportICal}
          className={`${btnBase} bg-[#3498DB] hover:bg-[#2980B9] text-white`}
          title="Xuất lịch chuẩn iCalendar (.ics)"
        >
          <CalendarCheck className="w-3.5 h-3.5" />
          {iCalLabel}
        </button>
      )}
      <button
        type="button"
        onClick={handlePrint}
        className={`${btnBase} border border-[#D9DEE4] bg-white hover:border-[#2A3F54] text-[#2A3F54]`}
        title="In báo cáo hoặc lưu PDF"
      >
        <Printer className="w-3.5 h-3.5 text-[#5A738E]" />
        In / PDF
      </button>
    </div>
  );
}

export const DrillDownBanner: React.FC = () => {
  const { drillDown, clearDrillDown, setActiveNav } = useUTS();

  if (!drillDown) return null;

  return (
    <div className="px-4 py-2.5 bg-[#EFF6FF] border border-[#3498DB]/40 rounded flex flex-wrap items-center justify-between gap-3 text-xs no-print">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={() => {
            clearDrillDown();
            setActiveNav('dashboard');
          }}
          className="px-2.5 py-1 rounded bg-white border border-[#D9DEE4] hover:border-[#2A3F54] text-[#2A3F54] font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Quay lại Dashboard
        </button>
        <span className="text-[#1E3A5F] font-semibold truncate">
          Đang tra cứu chi tiết từ chỉ số: <strong className="text-[#2A3F54]">{drillDown.sourceLabel}</strong>
        </span>
        {drillDown.description && (
          <>
            <span aria-hidden="true" className="text-[#94A3B8]">·</span>
            <span className="text-[#5A738E]">{drillDown.description}</span>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={clearDrillDown}
        className="text-[11px] font-semibold text-[#5A738E] hover:text-[#2A3F54] inline-flex items-center gap-1 whitespace-nowrap shrink-0"
      >
        <X className="w-3.5 h-3.5" />
        Xóa ngữ cảnh lọc
      </button>
    </div>
  );
};
