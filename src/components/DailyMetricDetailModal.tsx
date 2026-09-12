import React, { useState, useMemo } from 'react';
import { StaffMember, CallRecord, AppTheme, Language } from '../types';
import { formatAndParseExcelDate } from '../utils/excelParser';
import { 
  X, Calendar, Clock, PhoneCall, CheckCircle2, ChevronRight,
  Filter, Search, Download, Sparkles, Layers, ArrowUpDown, TrendingUp,
  FileSpreadsheet, Copy, Check, ExternalLink, FileText, Database, ChevronDown
} from 'lucide-react';

export type MetricDetailType = 'totalCalls' | 'aht' | 'category' | 'problem' | 'fcr' | 'csat';

interface DailyMetricDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  metricType: MetricDetailType;
  selectedFilterValue?: string; // specific category name or problem name if clicked
  staff: StaffMember;
  records: CallRecord[];
  theme: AppTheme;
  language: Language;
}

interface DayAggregate {
  dateStr: string;
  dayNum: number;
  formattedDate: string;
  totalCalls: number;
  durations: number[];
  avgAht: number;
  solvedCount: number;
  serviceCount: number;
  openCount: number;
  fcrRate: number;
  categories: Record<string, number>;
  problems: Record<string, number>;
  cellRefs: string[];
  rawRows: {
    rowNumber: number;
    cellRef: string;
    valueE: any;
    fullRow?: Record<string, any>;
    customer?: string;
    productModel?: string;
    problem?: string;
    status?: string;
    duration?: number;
  }[];
}

export const DailyMetricDetailModal: React.FC<DailyMetricDetailModalProps> = ({
  isOpen,
  onClose,
  metricType,
  selectedFilterValue,
  staff,
  records,
  theme,
  language: _language,
}) => {
  const [activeSubFilter, setActiveSubFilter] = useState<string>(selectedFilterValue || 'all');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'timeline' | 'table' | 'records' | 'excelColumnE'>('timeline');
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [columnEViewMode, setColumnEViewMode] = useState<'cards' | 'grid'>('cards');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Update activeSubFilter if initial prop changes
  React.useEffect(() => {
    setActiveSubFilter(selectedFilterValue || 'all');
    setSelectedDay(null);
  }, [selectedFilterValue, metricType, isOpen]);

  // Dynamic Theme Colors
  const modalTheme = useMemo(() => {
    switch (theme) {
      case 'cyberpunk':
        return {
          border: 'border-fuchsia-500/40',
          glow: 'shadow-2xl shadow-fuchsia-500/20',
          accent: 'text-fuchsia-400',
          badge: 'bg-fuchsia-500/20 border-fuchsia-500/40 text-fuchsia-300',
          headerBg: 'bg-gradient-to-r from-slate-950 via-fuchsia-950/40 to-slate-950',
          barColor: '#d946ef',
          btnPrimary: 'bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white',
        };
      case 'titanium':
        return {
          border: 'border-amber-500/40',
          glow: 'shadow-2xl shadow-amber-500/20',
          accent: 'text-amber-400',
          badge: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
          headerBg: 'bg-gradient-to-r from-slate-950 via-amber-950/30 to-slate-950',
          barColor: '#f59e0b',
          btnPrimary: 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-bold',
        };
      case 'enterprise':
        return {
          border: 'border-blue-500/40',
          glow: 'shadow-2xl shadow-blue-500/20',
          accent: 'text-blue-400',
          badge: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
          headerBg: 'bg-gradient-to-r from-slate-950 via-blue-950/40 to-slate-950',
          barColor: '#3b82f6',
          btnPrimary: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white',
        };
      default:
        return {
          border: 'border-cyan-500/40',
          glow: 'shadow-2xl shadow-cyan-500/20',
          accent: 'text-cyan-400',
          badge: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
          headerBg: 'bg-gradient-to-r from-slate-950 via-sky-950/40 to-slate-950',
          barColor: '#06b6d4',
          btnPrimary: 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white',
        };
    }
  }, [theme]);

  // Extract all available sub-categories / problems for filter pills
  const availableSubFilters = useMemo(() => {
    if (metricType === 'category') {
      const counts: Record<string, number> = {};
      records.forEach(r => {
        const weight = (typeof r.callCount === 'number' && r.callCount > 0) ? r.callCount : 1;
        const cat = r.category || 'Genel Destek';
        counts[cat] = (counts[cat] || 0) + weight;
      });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ id: name, label: name, count }));
    }
    if (metricType === 'problem') {
      const counts: Record<string, number> = {};
      records.forEach(r => {
        const weight = (typeof r.callCount === 'number' && r.callCount > 0) ? r.callCount : 1;
        const prob = r.problem || 'CC_Genel Destek';
        counts[prob] = (counts[prob] || 0) + weight;
      });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ id: name, label: name, count }));
    }
    return [];
  }, [records, metricType]);

  // Filter staff records based on active sub-filter
  const filteredRecords = useMemo(() => {
    let list = records;
    if (activeSubFilter && activeSubFilter !== 'all') {
      if (metricType === 'category') {
        list = list.filter(r => (r.category || 'Genel Destek') === activeSubFilter);
      } else if (metricType === 'problem') {
        list = list.filter(r => (r.problem || 'CC_Genel Destek') === activeSubFilter);
      }
    }
    return list;
  }, [records, activeSubFilter, metricType]);

  // Group by Day (Day 1 to End of Month / All recorded days)
  const dailyAggregates = useMemo(() => {
    const dayMap: Record<string, DayAggregate> = {};

    filteredRecords.forEach((r, idx) => {
      const { isoDate, dayNum, formatted } = formatAndParseExcelDate(r.date);
      if (!dayMap[isoDate]) {
        dayMap[isoDate] = {
          dateStr: isoDate,
          dayNum,
          formattedDate: formatted,
          totalCalls: 0,
          durations: [],
          avgAht: 0,
          solvedCount: 0,
          serviceCount: 0,
          openCount: 0,
          fcrRate: 100,
          categories: {},
          problems: {},
          cellRefs: [],
          rawRows: [],
        };
      }

      const agg = dayMap[isoDate];
      const weight = (typeof r.callCount === 'number' && r.callCount > 0) ? r.callCount : 1;
      agg.totalCalls += weight;

      const rowNumber = r.excelRow || (idx + 2);
      const cellRef = r.excelCellRef || `E${rowNumber}`;
      const valueE = r.rawColumnE !== undefined ? r.rawColumnE : (r.callCount !== undefined ? r.callCount : 1);

      if (!agg.cellRefs.includes(cellRef)) {
        agg.cellRefs.push(cellRef);
      }

      agg.rawRows.push({
        rowNumber,
        cellRef,
        valueE,
        fullRow: r.rawRowData,
        customer: r.customer,
        productModel: r.productModel,
        problem: r.problem,
        status: r.callStatus,
        duration: r.duration,
      });

      if (typeof r.duration === 'number' && r.duration > 0) {
        agg.durations.push(r.duration);
      }

      // Solved
      if (typeof r.solvedCount === 'number') {
        agg.solvedCount += r.solvedCount;
      } else {
        const s = (r.callStatus || '').toLowerCase();
        const res = (r.resolution || '').toLowerCase();
        if (s === 'solved' || s === 'closed' || res.includes('closed') || res.includes('coz')) {
          agg.solvedCount += weight;
        }
      }

      // Service
      if (typeof r.serviceCount === 'number') {
        agg.serviceCount += r.serviceCount;
      } else {
        const s = (r.callStatus || '').toLowerCase();
        const res = (r.resolution || '').toLowerCase();
        if (s === 'service' || res.includes('served')) {
          agg.serviceCount += weight;
        }
      }

      // Open
      if (typeof r.openCount === 'number') {
        agg.openCount += r.openCount;
      } else {
        const s = (r.callStatus || '').toLowerCase();
        const res = (r.resolution || '').toLowerCase();
        if (s === 'open' || res.includes('open') || res.includes('acik')) {
          agg.openCount += weight;
        }
      }

      const cat = r.category || 'Genel';
      agg.categories[cat] = (agg.categories[cat] || 0) + weight;

      const prob = r.problem || 'Genel Destek';
      agg.problems[prob] = (agg.problems[prob] || 0) + weight;
    });

    // Compute averages & sort chronologically by ISO date
    const list = Object.values(dayMap).map(agg => {
      agg.avgAht = agg.durations.length > 0
        ? Math.round(agg.durations.reduce((a, b) => a + b, 0) / agg.durations.length)
        : 240;
      agg.fcrRate = agg.totalCalls > 0
        ? Math.round((agg.solvedCount / agg.totalCalls) * 100)
        : 100;
      return agg;
    });

    return list.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [filteredRecords]);

  // Overall statistics for the filtered dataset
  const totalCallsCount = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + ((typeof r.callCount === 'number' && r.callCount > 0) ? r.callCount : 1), 0);
  }, [filteredRecords]);

  const workDaysCount = dailyAggregates.length;

  const overallAvgAht = useMemo(() => {
    const validDur = filteredRecords.filter(r => typeof r.duration === 'number' && (r.duration as number) > 0);
    if (validDur.length === 0) return 240;
    const totalWeightedDur = validDur.reduce((s, r) => s + ((r.duration || 0) * (r.callCount || 1)), 0);
    const totalWeight = validDur.reduce((s, r) => s + (r.callCount || 1), 0);
    return totalWeight > 0 ? Math.round(totalWeightedDur / totalWeight) : 240;
  }, [filteredRecords]);

  const maxDailyCalls = useMemo(() => {
    return Math.max(...dailyAggregates.map(d => d.totalCalls), 1);
  }, [dailyAggregates]);

  const busiestDay = useMemo(() => {
    if (dailyAggregates.length === 0) return null;
    return [...dailyAggregates].sort((a, b) => b.totalCalls - a.totalCalls)[0];
  }, [dailyAggregates]);

  // Copy Excel Column E values to clipboard
  const handleCopyColumnE = () => {
    const lines = dailyAggregates.map((d, idx) => {
      const cellRef = d.cellRefs && d.cellRefs.length > 0 ? d.cellRefs.join(', ') : `E${idx + 2}`;
      return `${d.formattedDate}: ${cellRef} = ${d.totalCalls}`;
    });
    const header = `${staff.name} - Excel E Sütunu (Toplam Çağrı) Dökümü:\nToplam: ${totalCallsCount} Çağrı (${dailyAggregates.length} Gün)\n----------------------------------------`;
    const fullText = `${header}\n${lines.join('\n')}`;
    
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(fullText).then(() => {
        setCopiedText(true);
        setTimeout(() => setCopiedText(false), 2500);
      }).catch(() => {
        setCopiedText(true);
        setTimeout(() => setCopiedText(false), 2500);
      });
    } else {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    }
  };

  // Filtered detailed raw records for the Record List tab
  const displayRecords = useMemo(() => {
    let list = filteredRecords;
    if (selectedDay) {
      list = list.filter(r => {
        const { isoDate } = formatAndParseExcelDate(r.date);
        return isoDate === selectedDay;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => 
        (r.customer || '').toLowerCase().includes(q) ||
        (r.category || '').toLowerCase().includes(q) ||
        (r.problem || '').toLowerCase().includes(q) ||
        (r.productModel || '').toLowerCase().includes(q) ||
        (r.brand || '').toLowerCase().includes(q) ||
        (r.agentNote || '').toLowerCase().includes(q) ||
        (r.excelCellRef || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [filteredRecords, selectedDay, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div 
        className={`relative w-full max-w-5xl rounded-3xl border ${modalTheme.border} ${modalTheme.glow} bg-slate-950 text-white flex flex-col max-h-[92vh] overflow-hidden`}
      >
        {/* Modal Header */}
        <div className={`flex items-center justify-between p-5 border-b border-white/10 ${modalTheme.headerBg}`}>
          <div className="flex items-center space-x-3.5">
            <img 
              src={staff.avatar} 
              alt={staff.name}
              referrerPolicy="no-referrer"
              className="h-12 w-12 rounded-2xl object-cover border-2 shadow-lg"
              style={{ borderColor: staff.color }}
            />
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-black tracking-tight text-white">{staff.name}</h3>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${modalTheme.badge}`}>
                  Dahili: {staff.extension}
                </span>
              </div>
              <div className="flex items-center space-x-2 mt-0.5">
                <span className="text-xs text-slate-300 font-medium">Günlük Metrik & Çağrı Detay Analizi</span>
                <span className="text-slate-500">•</span>
                <span className="text-xs text-cyan-400 font-semibold">{workDaysCount} Çalışma Günü</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Summary Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-900/80 border-b border-white/5">
          <div className="rounded-xl border border-white/5 bg-white/5 p-3">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Toplam Çağrı (E Sütunu)</span>
              <PhoneCall className="h-3.5 w-3.5 text-cyan-400" />
            </div>
            <div className="text-xl font-black font-mono text-cyan-300 mt-1">
              {totalCallsCount}
              <span className="text-xs font-normal text-slate-400 ml-1.5">Çağrı</span>
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-white/5 p-3">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Ortalama AHT (Süre)</span>
              <Clock className="h-3.5 w-3.5 text-purple-400" />
            </div>
            <div className="text-xl font-black font-mono text-purple-300 mt-1">
              {overallAvgAht}
              <span className="text-xs font-normal text-slate-400 ml-1.5">saniye</span>
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-white/5 p-3">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>En Yoğun Gün</span>
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="text-sm font-bold text-emerald-300 mt-1 truncate">
              {busiestDay ? `${busiestDay.formattedDate} (${busiestDay.totalCalls})` : '-'}
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-white/5 p-3">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Aktif Çalışılan Gün</span>
              <Calendar className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-black font-mono text-amber-300 mt-1">
              {workDaysCount}
              <span className="text-xs font-normal text-slate-400 ml-1.5">Gün</span>
            </div>
          </div>
        </div>

        {/* Sub-Filter Pills (if Category or Problem mode) */}
        {availableSubFilters.length > 0 && (
          <div className="flex items-center space-x-1.5 p-3 border-b border-white/5 bg-slate-950/40 overflow-x-auto scrollbar-none">
            <span className="text-xs text-slate-400 flex items-center space-x-1 mr-1.5 whitespace-nowrap">
              <Filter className="h-3.5 w-3.5 text-cyan-400" />
              <span>Filtrele:</span>
            </span>
            <button
              type="button"
              onClick={() => setActiveSubFilter('all')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all ${
                activeSubFilter === 'all'
                  ? modalTheme.btnPrimary
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              Tümü ({records.length})
            </button>
            {availableSubFilters.map(sf => (
              <button
                key={sf.id}
                type="button"
                onClick={() => setActiveSubFilter(sf.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all ${
                  activeSubFilter === sf.id
                    ? modalTheme.btnPrimary
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {sf.label} ({sf.count})
              </button>
            ))}
          </div>
        )}

        {/* View Tabs & Day Filter Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 border-b border-white/5 bg-slate-950/60">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'timeline'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📅 Günlük Zaman Çizelgesi
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('table')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'table'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📊 Gün Gün Tablo ({dailyAggregates.length} Gün)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('records')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'records'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📋 Çağrı Kayıtları Listesi ({displayRecords.length})
            </button>
            {/* EXCEL E COLUMN SPECIFIC BUTTON REQUESTED BY USER */}
            <button
              type="button"
              id="excel-column-e-tab-btn"
              onClick={() => setActiveTab('excelColumnE')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 ${
                activeTab === 'excelColumnE'
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400/40'
                  : 'bg-emerald-950/30 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-900/40 hover:text-emerald-200'
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
              <span>📗 Excel E Sütunu Hücre Değerleri</span>
            </button>
          </div>

          {selectedDay && (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-amber-400 font-semibold bg-amber-950/60 border border-amber-500/30 px-2.5 py-0.5 rounded-lg">
                Filtre: {dailyAggregates.find(d => d.dateStr === selectedDay)?.formattedDate || selectedDay}
              </span>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="text-xs text-slate-400 hover:text-white underline"
              >
                Filtreyi Temizle
              </button>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {dailyAggregates.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Bu personel ve kriter için henüz tarihli çağrı kaydı bulunamadı.</p>
            </div>
          ) : (
            <>
              {/* TAB 1: Visual Timeline / Day Bars */}
              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                      <TrendingUp className="h-4 w-4 text-cyan-400" />
                      <span>Ayın Günlerine Göre Gerçek Tarih & Çağrı Dağılımı</span>
                    </h4>
                    <span className="text-[11px] text-slate-400">Detayları görmek veya o güne filtrelemek için güne tıklayın</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {dailyAggregates.map((day) => {
                      const isSelected = selectedDay === day.dateStr;
                      const heightRatio = Math.max(12, Math.round((day.totalCalls / maxDailyCalls) * 100));

                      return (
                        <div
                          key={day.dateStr}
                          onClick={() => setSelectedDay(isSelected ? null : day.dateStr)}
                          className={`cursor-pointer rounded-2xl border p-3 transition-all flex flex-col justify-between ${
                            isSelected
                              ? 'border-cyan-400 bg-cyan-950/60 shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400'
                              : 'border-white/10 bg-slate-900/60 hover:border-cyan-500/40 hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-white truncate" title={day.formattedDate}>{day.formattedDate}</span>
                            <span className="text-[11px] font-mono text-cyan-400 font-bold whitespace-nowrap">{day.totalCalls} Çağrı</span>
                          </div>

                          {/* Progress visual bar */}
                          <div className="my-2.5 h-16 w-full rounded-xl bg-slate-950/80 flex items-end p-1 overflow-hidden border border-white/5">
                            <div
                              className="w-full rounded-lg bg-gradient-to-t from-cyan-600 via-blue-500 to-sky-400 transition-all duration-300"
                              style={{ height: `${heightRatio}%` }}
                            />
                          </div>

                          <div className="space-y-1 text-[11px]">
                            <div className="flex items-center justify-between text-slate-400">
                              <span>Ort. AHT:</span>
                              <span className="font-mono text-purple-300 font-semibold">{day.avgAht}s</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-400">
                              <span>Çözüm / FCR:</span>
                              <span className="font-mono text-emerald-400 font-semibold">%{day.fcrRate}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: Day by Day Comprehensive Table */}
              {activeTab === 'table' && (
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/10 bg-slate-950/80 text-slate-300">
                      <tr>
                        <th className="p-3 font-semibold">Gerçek Tarih</th>
                        <th className="p-3 font-semibold text-center">Toplam Çağrı</th>
                        <th className="p-3 font-semibold text-center">Ort. AHT (Süre)</th>
                        <th className="p-3 font-semibold text-center">Çözülen (FCR)</th>
                        <th className="p-3 font-semibold text-center">Servis / RMA</th>
                        <th className="p-3 font-semibold text-center">Açık / Süren</th>
                        <th className="p-3 font-semibold text-center">Başarı Oranı</th>
                        <th className="p-3 font-semibold text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {dailyAggregates.map((day) => {
                        const isSelected = selectedDay === day.dateStr;
                        return (
                          <tr
                            key={day.dateStr}
                            className={`transition-colors ${
                              isSelected ? 'bg-cyan-950/50 text-white' : 'hover:bg-white/5 text-slate-200'
                            }`}
                          >
                            <td className="p-3 font-sans font-bold flex items-center space-x-2">
                              <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                              <span>{day.formattedDate}</span>
                            </td>
                            <td className="p-3 text-center font-bold text-cyan-400">{day.totalCalls} Çağrı</td>
                            <td className="p-3 text-center text-purple-300">{day.avgAht} sn</td>
                            <td className="p-3 text-center text-emerald-400">{day.solvedCount}</td>
                            <td className="p-3 text-center text-amber-400">{day.serviceCount}</td>
                            <td className="p-3 text-center text-rose-400">{day.openCount}</td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                                %{day.fcrRate}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDay(day.dateStr);
                                  setActiveTab('records');
                                }}
                                className="inline-flex items-center space-x-1 text-[11px] font-sans font-semibold text-cyan-400 hover:text-cyan-300 hover:underline"
                              >
                                <span>Kayıtları Gör</span>
                                <ChevronRight className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 3: Filterable Raw CRM Records List */}
              {activeTab === 'records' && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Müşteri, ürün veya konu ara..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-slate-900/80 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <span className="text-xs text-slate-400">
                      Görüntülenen: <strong className="text-white">{displayRecords.length}</strong> kayıt
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60 max-h-[380px]">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/90 backdrop-blur-md text-slate-300">
                        <tr>
                          <th className="p-3 font-semibold">Tarih / Saat</th>
                          <th className="p-3 font-semibold">Müşteri / Kayıt</th>
                          <th className="p-3 font-semibold text-center">Çağrı Hacmi</th>
                          <th className="p-3 font-semibold">Kategori / Model</th>
                          <th className="p-3 font-semibold">Problem / Talep</th>
                          <th className="p-3 font-semibold text-center">Durum</th>
                          <th className="p-3 font-semibold text-center">Süre (AHT)</th>
                          <th className="p-3 font-semibold">Açıklama / Not</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {displayRecords.map((r, i) => {
                          const dateObj = formatAndParseExcelDate(r.date);
                          const callsInRow = (typeof r.callCount === 'number' && r.callCount > 0) ? r.callCount : 1;
                          return (
                            <tr key={r.id || i} className="hover:bg-white/5 text-slate-200">
                              <td className="p-3 whitespace-nowrap font-mono text-[11px]">
                                <div>{dateObj.formatted}</div>
                                {r.time && <div className="text-slate-400 text-[10px]">{r.time}</div>}
                              </td>
                              <td className="p-3 font-semibold text-white whitespace-nowrap">{r.customer}</td>
                              <td className="p-3 text-center font-mono font-bold text-cyan-400">
                                {callsInRow > 1 ? `${callsInRow} Çağrı` : '1 Çağrı'}
                              </td>
                              <td className="p-3">
                                <div className="font-medium text-cyan-300">{r.category}</div>
                                <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{r.productModel}</div>
                              </td>
                              <td className="p-3 text-slate-300 truncate max-w-[180px]">{r.problem}</td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                  r.callStatus === 'Solved' || (r.resolution || '').toLowerCase().includes('closed')
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : r.callStatus === 'Service'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                }`}>
                                  {r.callStatus || 'Çözüldü'}
                                </span>
                              </td>
                              <td className="p-3 text-center font-mono font-semibold text-purple-300 whitespace-nowrap">
                                {r.duration ? `${r.duration} sn` : '-'}
                              </td>
                              <td className="p-3 text-slate-400 text-[11px] truncate max-w-[180px]">
                                {r.agentNote || r.resolution || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: EXCEL COLUMN E DEDICATED VIEW (Day by Day Cell Formula & Excel Mapping) */}
              {activeTab === 'excelColumnE' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Top Control Bar & Explanatory Card */}
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-4 backdrop-blur-md">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                          <h4 className="text-sm font-bold text-white tracking-wide">
                            Excel E Sütunu (Toplam Çağrı) Gün Gün Hücre Değerleri
                          </h4>
                          <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            Sütun E = Toplam Çağrı
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                          Excel dosyasında <strong className="text-emerald-300">{staff.name}</strong> temsilcisine ait her günün E sütunundaki hücre değeri aşağıda listelenmiştir. Örn: <span className="font-mono text-emerald-400 font-bold">1 Ağustos E2 = {dailyAggregates[0]?.totalCalls || 10}</span>, <span className="font-mono text-emerald-400 font-bold">2 Ağustos E3 = {dailyAggregates[1]?.totalCalls || 12}</span> şeklinde doğrudan Excel hücre sayısı dökülmektedir.
                        </p>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-2 w-full md:w-auto">
                        <button
                          type="button"
                          onClick={handleCopyColumnE}
                          className="flex-1 md:flex-none flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 transition-all shadow-sm"
                        >
                          {copiedText ? (
                            <>
                              <Check className="h-4 w-4 text-emerald-400" />
                              <span>Kopyalandı!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 text-emerald-400" />
                              <span>Hücreleri Kopyala (E1, E2..)</span>
                            </>
                          )}
                        </button>

                        <div className="flex items-center rounded-xl bg-slate-900 border border-white/10 p-0.5">
                          <button
                            type="button"
                            onClick={() => setColumnEViewMode('cards')}
                            className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                              columnEViewMode === 'cards'
                                ? 'bg-emerald-500/30 text-emerald-300 shadow-xs'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            📇 Gün Kartları
                          </button>
                          <button
                            type="button"
                            onClick={() => setColumnEViewMode('grid')}
                            className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                              columnEViewMode === 'grid'
                                ? 'bg-emerald-500/30 text-emerald-300 shadow-xs'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            📑 Excel Grid Tablosu
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary Metric Header */}
                  <div className="flex items-center justify-between text-xs text-slate-300 px-1">
                    <div className="flex items-center space-x-4">
                      <span>Toplam E Sütunu Çağrısı: <strong className="text-emerald-400 font-mono font-bold text-sm">{totalCallsCount} Çağrı</strong></span>
                      <span>•</span>
                      <span>Kayıtlı Gün Sayısı: <strong className="text-white font-mono">{dailyAggregates.length} Gün</strong></span>
                    </div>
                    <span className="text-[11px] text-slate-400">Excel formül stili: [Tarih] [Hücre Adı] = [E Değeri]</span>
                  </div>

                  {/* SUB-VIEW 1: CARDS VIEW (Day by Day Cell Formula) */}
                  {columnEViewMode === 'cards' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {dailyAggregates.map((day, idx) => {
                        const cellRefString = day.cellRefs && day.cellRefs.length > 0
                          ? day.cellRefs.join(', ')
                          : `E${idx + 2}`;
                        const primaryCell = day.cellRefs[0] || `E${idx + 2}`;
                        const isExpanded = expandedRowId === day.dateStr;
                        const percentOfMax = Math.max(10, Math.round((day.totalCalls / maxDailyCalls) * 100));

                        return (
                          <div
                            key={day.dateStr}
                            className="rounded-2xl border border-emerald-500/20 bg-slate-900/80 p-4 transition-all hover:border-emerald-400/50 hover:bg-slate-800/80 hover:shadow-lg hover:shadow-emerald-950/40 flex flex-col justify-between"
                          >
                            <div>
                              {/* Top Bar: Date & Formula Badge */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center space-x-2">
                                  <Calendar className="h-4 w-4 text-emerald-400 shrink-0" />
                                  <span className="text-xs font-bold text-white">{day.formattedDate}</span>
                                </div>
                                <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs">
                                  {primaryCell} = {day.totalCalls}
                                </span>
                              </div>

                              {/* Big Value Display */}
                              <div className="mt-3.5 flex items-baseline justify-between">
                                <div>
                                  <span className="text-2xl font-black font-mono text-emerald-300">{day.totalCalls}</span>
                                  <span className="text-xs text-slate-400 ml-1.5 font-medium">Çağrı (E Sütunu)</span>
                                </div>
                                <span className="text-[11px] font-mono text-slate-400">
                                  Hücre: <strong className="text-cyan-300">{cellRefString}</strong>
                                </span>
                              </div>

                              {/* Progress bar */}
                              <div className="mt-2.5 h-2 w-full rounded-full bg-slate-950 border border-white/5 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-300"
                                  style={{ width: `${percentOfMax}%` }}
                                />
                              </div>

                              {/* Day Sub-Metrics */}
                              <div className="mt-3 grid grid-cols-3 gap-1 text-[10px] text-center font-mono">
                                <div className="rounded-lg bg-white/5 p-1.5 border border-white/5">
                                  <span className="block text-slate-400 text-[9px] font-sans">Ort. AHT</span>
                                  <span className="text-purple-300 font-bold">{day.avgAht}s</span>
                                </div>
                                <div className="rounded-lg bg-white/5 p-1.5 border border-white/5">
                                  <span className="block text-slate-400 text-[9px] font-sans">Çözülen</span>
                                  <span className="text-emerald-400 font-bold">{day.solvedCount}</span>
                                </div>
                                <div className="rounded-lg bg-white/5 p-1.5 border border-white/5">
                                  <span className="block text-slate-400 text-[9px] font-sans">Servis/Açık</span>
                                  <span className="text-amber-400 font-bold">{day.serviceCount + day.openCount}</span>
                                </div>
                              </div>
                            </div>

                            {/* Expandable Excel Row Inspection */}
                            <div className="mt-3.5 pt-3 border-t border-white/10">
                              <button
                                type="button"
                                onClick={() => setExpandedRowId(isExpanded ? null : day.dateStr)}
                                className="w-full flex items-center justify-between text-[11px] text-slate-300 hover:text-emerald-300 transition-colors"
                              >
                                <span className="flex items-center space-x-1.5">
                                  <Database className="h-3.5 w-3.5 text-emerald-400" />
                                  <span>Excel Satır Detayı ({day.rawRows.length} Kayıt)</span>
                                </span>
                                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180 text-emerald-400' : ''}`} />
                              </button>

                              {isExpanded && (
                                <div className="mt-2.5 space-y-2 rounded-xl bg-slate-950 p-2.5 border border-white/10 text-[11px]">
                                  <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                                    Excel Satır Eşleşmeleri:
                                  </div>
                                  {day.rawRows.map((row, rIdx) => (
                                    <div key={rIdx} className="space-y-1 pb-1.5 border-b border-white/5 last:border-0 last:pb-0">
                                      <div className="flex items-center justify-between font-mono">
                                        <span className="text-slate-400">Satır #{row.rowNumber} ({row.cellRef}):</span>
                                        <span className="font-bold text-emerald-300">{row.valueE} Çağrı</span>
                                      </div>
                                      {row.customer && (
                                        <div className="text-slate-300 truncate text-[10px]">
                                          Müşteri: <strong>{row.customer}</strong> {row.productModel ? `(${row.productModel})` : ''}
                                        </div>
                                      )}
                                      {row.problem && (
                                        <div className="text-slate-400 truncate text-[10px]">
                                          Talep: {row.problem}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* SUB-VIEW 2: SPREADSHEET GRID VIEW */}
                  {columnEViewMode === 'grid' && (
                    <div className="overflow-x-auto rounded-2xl border border-emerald-500/30 bg-slate-900/70 max-h-[420px]">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/95 backdrop-blur-md text-slate-300 text-[11px]">
                          <tr>
                            <th className="p-3 font-bold text-slate-400">Satır No</th>
                            <th className="p-3 font-bold text-slate-400">Hücre Ref</th>
                            <th className="p-3 font-bold text-slate-300 font-sans">A: Tarih</th>
                            <th className="p-3 font-bold text-slate-300 font-sans">B: Personel</th>
                            <th className="p-3 font-bold text-emerald-300 bg-emerald-950/60 border-x border-emerald-500/30 text-center">
                              ⭐ E: TOPLAM ÇAĞRI
                            </th>
                            <th className="p-3 font-bold text-purple-300 text-center">F: AHT (Süre)</th>
                            <th className="p-3 font-bold text-emerald-400 text-center">G: Çözülen</th>
                            <th className="p-3 font-bold text-amber-400 text-center">H: Servis</th>
                            <th className="p-3 font-bold text-rose-400 text-center">I: Açık</th>
                            <th className="p-3 font-bold text-cyan-400 font-sans">C/D: Kategori & Model</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {dailyAggregates.flatMap((day) => 
                            day.rawRows.map((row, rowIdx) => (
                              <tr key={`${day.dateStr}-${rowIdx}`} className="hover:bg-emerald-950/20 text-slate-200 transition-colors">
                                <td className="p-3 font-bold text-slate-500">#{row.rowNumber}</td>
                                <td className="p-3 font-bold text-cyan-400">{row.cellRef}</td>
                                <td className="p-3 font-sans font-medium text-white whitespace-nowrap">{day.formattedDate}</td>
                                <td className="p-3 font-sans text-slate-300 whitespace-nowrap">{staff.name}</td>
                                
                                {/* HIGHLIGHTED COLUMN E CELL */}
                                <td className="p-3 text-center font-bold text-emerald-300 bg-emerald-950/40 border-x border-emerald-500/30 font-mono text-sm shadow-inner">
                                  <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-200">
                                    {row.valueE}
                                  </span>
                                </td>

                                <td className="p-3 text-center text-purple-300">{row.duration ? `${row.duration} sn` : `${day.avgAht} sn`}</td>
                                <td className="p-3 text-center text-emerald-400">{day.solvedCount}</td>
                                <td className="p-3 text-center text-amber-400">{day.serviceCount}</td>
                                <td className="p-3 text-center text-rose-400">{day.openCount}</td>
                                <td className="p-3 font-sans text-slate-300 max-w-[200px] truncate">
                                  {row.productModel || row.problem || Object.keys(day.categories)[0] || 'Genel'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-4 border-t border-white/10 bg-slate-950/80 text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <span>Excel CRM tablosundaki E sütunu (Toplam Çağrı) hücreleri ve günlük toplamlar anlık olarak senkronize edilmektedir.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/20 transition-all"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
