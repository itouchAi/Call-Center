import React, { useState, useMemo } from 'react';
import { ExcelSheetPreview, AppTheme } from '../types';
import { 
  FileSpreadsheet, Check, CheckSquare, Square, X, 
  ArrowRight, Search, Sparkles, Filter, Eye, Layers,
  PhoneCall, Clock, Coffee, Utensils, Users, GraduationCap, Zap, Calendar, User
} from 'lucide-react';

interface ExcelPreviewColumnSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetsPreview: ExcelSheetPreview[];
  activeHeaders: string[];
  onApplySelectedHeaders: (selectedHeaders: string[]) => void;
  theme?: AppTheme;
}

export const ExcelPreviewColumnSelectorModal: React.FC<ExcelPreviewColumnSelectorModalProps> = ({
  isOpen,
  onClose,
  sheetsPreview,
  activeHeaders,
  onApplySelectedHeaders,
  theme = 'frosted',
}) => {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [selectedCols, setSelectedCols] = useState<Set<string>>(() => new Set(activeHeaders));
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'selected' | 'kpi'>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState<number | 'all'>('all');

  // Sync selected headers when modal opens or activeHeaders changes
  React.useEffect(() => {
    if (isOpen) {
      setSelectedCols(new Set(activeHeaders));
    }
  }, [isOpen, activeHeaders]);

  const currentSheet = sheetsPreview[activeSheetIndex] || sheetsPreview[0] || {
    sheetName: 'Excel Sayfası',
    data: [],
    headers: [],
    headerRowIndex: 0,
  };

  const rawData = currentSheet.data || [];
  const headerRowIdx = currentSheet.headerRowIndex || 0;
  const headerRow = rawData[headerRowIdx] || currentSheet.headers || [];

  // Determine columns list with index and names
  const columns = useMemo(() => {
    const list: { index: number; letter: string; name: string; isDetectedKPI: boolean }[] = [];
    const colCount = Math.max(headerRow.length, rawData[0]?.length || 0, 1);

    for (let i = 0; i < colCount; i++) {
      const rawName = headerRow[i] !== undefined && headerRow[i] !== null ? String(headerRow[i]).trim() : '';
      const name = rawName || `Sütun ${i + 1}`;
      
      // Calculate Excel column letters (A, B, ... Z, AA, AB...)
      let letter = '';
      let temp = i;
      while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
      }

      const norm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isDetectedKPI = norm.includes('cevaplanan') || norm.includes('karsilanan') || norm.includes('mola') || 
                            norm.includes('yemek') || norm.includes('toplanti') || norm.includes('egitim') || 
                            norm.includes('toplamkonusma') || norm.includes('verimlilik') || norm.includes('aht') ||
                            norm.includes('tarih') || norm.includes('temsilci') || norm.includes('cagri');

      list.push({ index: i, letter, name, isDetectedKPI });
    }
    return list;
  }, [headerRow, rawData]);

  // Toggle single column checkbox
  const toggleColumn = (colName: string) => {
    setSelectedCols(prev => {
      const next = new Set(prev);
      if (next.has(colName)) {
        next.delete(colName);
      } else {
        next.add(colName);
      }
      return next;
    });
  };

  // Select all columns
  const handleSelectAll = () => {
    setSelectedCols(new Set(columns.map(c => c.name)));
  };

  // Clear all
  const handleClearAll = () => {
    setSelectedCols(new Set());
  };

  // Select Recommended KPI columns
  const handleSelectRecommendedKPI = () => {
    const rec = new Set<string>();
    columns.forEach(c => {
      const norm = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (
        norm.includes('cevaplanan') || norm.includes('karsilanan') || 
        norm.includes('mola') || norm.includes('yemek') || 
        norm.includes('toplanti') || norm.includes('egitim') || 
        norm.includes('toplamkonusma') || norm.includes('verimlilik') || 
        norm.includes('aht') || norm.includes('tarih') || norm.includes('temsilci')
      ) {
        rec.add(c.name);
      }
    });

    // If none matched, select first 8
    if (rec.size === 0) {
      columns.slice(0, 8).forEach(c => rec.add(c.name));
    }
    setSelectedCols(rec);
  };

  // Filter columns based on user search and mode
  const filteredColumns = useMemo(() => {
    let list = columns;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.letter.toLowerCase().includes(q));
    }
    if (filterMode === 'selected') {
      list = list.filter(c => selectedCols.has(c.name));
    } else if (filterMode === 'kpi') {
      list = list.filter(c => c.isDetectedKPI);
    }
    return list;
  }, [columns, searchQuery, filterMode, selectedCols]);

  // Visible rows (skip header row)
  const dataRows = useMemo(() => {
    const start = headerRowIdx + 1;
    return rawData.slice(start);
  }, [rawData, headerRowIdx]);

  const paginatedRows = useMemo(() => {
    if (rowsPerPage === 'all') {
      return dataRows;
    }
    return dataRows.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  }, [dataRows, page, rowsPerPage]);

  // Handle final "Analize Ekle" button click
  const handleApply = () => {
    const selectedArray = Array.from(selectedCols);
    onApplySelectedHeaders(selectedArray);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-7xl h-[92vh] rounded-3xl border border-cyan-500/40 bg-slate-950 shadow-2xl shadow-cyan-500/20 overflow-hidden ring-1 ring-cyan-500/20">
        
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 sm:p-6 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <div className="rounded-2xl bg-cyan-500/20 border border-cyan-500/40 p-2.5 text-cyan-400 shrink-0">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  Excel Önizlemesi & KPI Başlık Seçimi
                </h2>
                <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                  {selectedCols.size} Sütun İşaretlendi
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Excel tablonuzdaki tüm satır ve sütunlar aşağıdadır. Analize dahil etmek istediğiniz sütunların yanındaki kutucukları (tik) işaretleyin ve "Analize Ekle" butonuna basın.
              </p>
            </div>
          </div>

          {/* Top Action Buttons */}
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 px-5 py-2.5 text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-500/30 transition-all hover:scale-[1.02] active:scale-95"
            >
              <Check className="h-4 w-4 stroke-[3]" />
              <span>Analize Ekle ({selectedCols.size} Sütun)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              title="Kapat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Sheets Selector & Filter Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-slate-800/80 bg-slate-900/60">
          {/* Sheet Tabs */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1 shrink-0 mr-1">
              <Layers className="h-3.5 w-3.5 text-cyan-400" />
              <span>Sayfalar:</span>
            </span>
            {sheetsPreview.map((sheet, sIdx) => {
              const isActive = sIdx === activeSheetIndex;
              return (
                <button
                  key={`sheet-tab-${sheet.sheetName}-${sIdx}`}
                  type="button"
                  onClick={() => {
                    setActiveSheetIndex(sIdx);
                    setPage(0);
                  }}
                  className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all shrink-0 border ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/60 shadow-md shadow-cyan-500/20'
                      : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-700/80'
                  }`}
                >
                  <FileSpreadsheet className="h-3 w-3" />
                  <span>{sheet.sheetName}</span>
                  <span className="text-[10px] opacity-60">({sheet.data?.length || 0} satır)</span>
                </button>
              );
            })}
          </div>

          {/* Quick Selection Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Sütun adı ara..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleSelectRecommendedKPI}
              className="flex items-center space-x-1 rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-2.5 py-1 text-xs font-bold text-cyan-300 hover:bg-cyan-900/50 transition-colors"
            >
              <Sparkles className="h-3 w-3" />
              <span>Önerilen KPI'lar</span>
            </button>

            <button
              type="button"
              onClick={handleSelectAll}
              className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              Tümünü Seç
            </button>

            <button
              type="button"
              onClick={handleClearAll}
              className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
            >
              Temizle
            </button>
          </div>
        </div>

        {/* Selected Columns Quick Ticker Summary Bar */}
        <div className="flex items-center px-4 sm:px-6 py-2 bg-slate-950 border-b border-slate-800 text-xs overflow-x-auto whitespace-nowrap gap-2 scrollbar-none">
          <span className="font-bold text-slate-400 shrink-0 flex items-center space-x-1">
            <CheckSquare className="h-3.5 w-3.5 text-emerald-400" />
            <span>İşaretlenen Başlıklar:</span>
          </span>
          {columns.filter(c => selectedCols.has(c.name)).map(c => (
            <span
              key={`pill-${c.name}`}
              className="inline-flex items-center space-x-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold text-emerald-300"
            >
              <span className="text-[9px] text-emerald-400/70 font-mono">[{c.letter}]</span>
              <span>{c.name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleColumn(c.name);
                }}
                className="hover:text-rose-400 ml-1"
              >
                ×
              </button>
            </span>
          ))}
          {selectedCols.size === 0 && (
            <span className="text-slate-500 italic text-[11px]">Henüz sütun seçilmedi. Tablodaki kutucukları işaretleyin.</span>
          )}
        </div>

        {/* The Spreadsheet Preview Table Area */}
        <div className="flex-1 overflow-auto bg-slate-950 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          <table className="w-full border-collapse text-left text-xs font-sans">
            {/* Table Header: Column Letters & Header Row with Checkboxes */}
            <thead className="sticky top-0 z-20 bg-slate-900 shadow-md">
              {/* Row 1: Column Letters (A, B, C, ...) */}
              <tr className="border-b border-slate-800 bg-slate-900/95 text-[10px] text-slate-500 font-mono">
                <th className="w-12 p-1.5 text-center border-r border-slate-800 bg-slate-950 sticky left-0 z-30">
                  #
                </th>
                {filteredColumns.map(col => {
                  const isChecked = selectedCols.has(col.name);
                  return (
                    <th 
                      key={`letter-${col.index}`} 
                      className={`p-1.5 text-center border-r border-slate-800 ${
                        isChecked ? 'bg-emerald-950/40 text-emerald-300 font-bold' : ''
                      }`}
                    >
                      {col.letter}
                    </th>
                  );
                })}
              </tr>

              {/* Row 2: Actual Column Header Name + Large Interactive Checkbox (Tik İşareti) */}
              <tr className="border-b-2 border-slate-700 bg-slate-900 text-slate-200">
                <th className="p-2 text-center border-r border-slate-800 bg-slate-950 text-slate-400 text-[10px] font-mono sticky left-0 z-30">
                  Başlık
                </th>
                {filteredColumns.map(col => {
                  const isChecked = selectedCols.has(col.name);
                  return (
                    <th
                      key={`header-col-${col.index}`}
                      onClick={() => toggleColumn(col.name)}
                      className={`min-w-[180px] max-w-[280px] p-2.5 border-r border-slate-800 cursor-pointer select-none transition-all group ${
                        isChecked
                          ? 'bg-gradient-to-b from-emerald-950/60 to-slate-900/90 border-b-2 border-b-emerald-400 text-white'
                          : 'bg-slate-900/90 hover:bg-slate-800/80 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        {/* The Checkbox (Tik İşareti) */}
                        <div 
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${
                            isChecked
                              ? 'border-emerald-400 bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/50'
                              : 'border-slate-600 bg-slate-800 group-hover:border-cyan-400'
                          }`}
                        >
                          {isChecked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </div>

                        {/* Column Name */}
                        <div className="flex-1 truncate">
                          <span className={`text-xs font-black truncate block ${isChecked ? 'text-emerald-300' : 'group-hover:text-white'}`}>
                            {col.name}
                          </span>
                          {col.isDetectedKPI && (
                            <span className="text-[9px] font-mono text-cyan-400/80 uppercase">
                              Tespit Edilen KPI
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body: Real Data Rows */}
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={filteredColumns.length + 1} className="p-8 text-center text-slate-500">
                    Görüntülenecek veri satırı bulunamadı.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((rowArr, rIdx) => {
                  const actualRowNum = (typeof rowsPerPage === 'number' ? page * rowsPerPage : 0) + rIdx + 1;
                  return (
                    <tr 
                      key={`data-row-${actualRowNum}`}
                      className="hover:bg-slate-800/50 transition-colors group font-mono text-[11px]"
                    >
                      {/* Row Index Number */}
                      <td className="p-2 text-center text-slate-500 border-r border-slate-800 bg-slate-950/80 sticky left-0 z-10 group-hover:bg-slate-900">
                        {actualRowNum}
                      </td>

                      {/* Cells for each filtered column */}
                      {filteredColumns.map(col => {
                        const cellVal = Array.isArray(rowArr) ? rowArr[col.index] : undefined;
                        const isChecked = selectedCols.has(col.name);
                        const displayVal = cellVal !== undefined && cellVal !== null ? String(cellVal) : '';

                        return (
                          <td
                            key={`cell-${actualRowNum}-${col.index}`}
                            className={`p-2 border-r border-slate-800/60 truncate max-w-[280px] ${
                              isChecked ? 'bg-emerald-950/10 text-emerald-100 font-medium' : ''
                            }`}
                            title={displayVal}
                          >
                            {displayVal === '' ? (
                              <span className="text-slate-600 italic">-</span>
                            ) : (
                              displayVal
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Bar with Pagination & Final "Analize Ekle" Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-slate-800 bg-slate-900/90 backdrop-blur-md">
          <div className="flex items-center space-x-3 text-xs text-slate-400">
            <span>
              Toplam <strong>{dataRows.length}</strong> veri satırı, <strong>{columns.length}</strong> sütun
            </span>
            <span>•</span>
            <span className="text-emerald-400 font-bold">
              {selectedCols.size} sütun analize seçildi
            </span>
          </div>

          {/* Pagination, Row View Limit controls and Action */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-1 text-xs text-slate-400 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 mr-1">Gösterim:</span>
              {[50, 100, 200, 'all'].map(size => (
                <button
                  key={`limit-${size}`}
                  type="button"
                  onClick={() => {
                    setRowsPerPage(size as any);
                    setPage(0);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                    rowsPerPage === size
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {size === 'all' ? 'Tümü (Sınırsız)' : size}
                </button>
              ))}
            </div>

            {typeof rowsPerPage === 'number' && dataRows.length > rowsPerPage && (
              <div className="flex items-center space-x-1.5 text-xs">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-slate-300 disabled:opacity-40 cursor-pointer"
                >
                  Önceki
                </button>
                <span className="px-2 text-slate-400">
                  {page + 1} / {Math.ceil(dataRows.length / rowsPerPage)}
                </span>
                <button
                  type="button"
                  disabled={(page + 1) * rowsPerPage >= dataRows.length}
                  onClick={() => setPage(p => p + 1)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-slate-300 disabled:opacity-40 cursor-pointer"
                >
                  Sonraki
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleApply}
              className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 px-6 py-2.5 text-sm font-extrabold text-slate-950 shadow-xl shadow-emerald-500/30 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              <Check className="h-4 w-4 stroke-[3]" />
              <span>Analize Ekle ({selectedCols.size} Sütun)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
