import React, { useState, useMemo, useRef, useEffect } from 'react';
import { CallCenterHourlyMetric, CallRecord, Language, RenderMode, AppTheme, TimeFilter } from '../types';
import { getT } from '../utils/translations';
import { Interactive3DCard } from './Interactive3DCard';
import { Interactive3DBarChart } from './Interactive3DBarChart';
import { deriveHourlyMetricsFromCRM } from '../utils/excelParser';
import { 
  PhoneIncoming, PhoneCall, PhoneOutgoing, Clock, AlertOctagon,
  Activity, ShieldAlert, Zap, Calendar,
  BarChart3, Table as TableIcon
} from 'lucide-react';

interface CallCenterMetricsViewProps {
  hourlyMetrics: CallCenterHourlyMetric[];
  crmRecords?: CallRecord[];
  language: Language;
  renderMode: RenderMode;
  theme: AppTheme;
  timeFilter?: TimeFilter;
  onTimeFilterChange?: (filter: TimeFilter) => void;
}

const STANDARD_SLOTS = [
  '09-00 - 10-00', '10-00 - 11-00', '11-00 - 12-00', '12-00 - 13-00',
  '13-00 - 14-00', '14-00 - 15-00', '15-00 - 16-00', '16-00 - 17-00',
  '17-00 - 18-00', '18-00 - 19-00', '19-00 - 20-00', '20-00 - 21-00',
  '21-00 - 22-00', '22-00 - 23-00', '23-00 - 00-00'
];

const ALL_24H_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const start = String(i).padStart(2, '0');
  const end = String((i + 1) % 24).padStart(2, '0');
  return `${start}-00 - ${end}-00`;
});

const normalizeSlot = (s: string): string => {
  if (!s) return '';
  const rangeMatch = s.match(/(\d{1,2})[:.-](\d{2})\s*[\u2010\u2012\u2013\u2014\u2212\-/~]\s*(\d{1,2})(?:[:.-](\d{2}))?/);
  if (rangeMatch) {
    const sH = String(parseInt(rangeMatch[1], 10)).padStart(2, '0');
    let eH = parseInt(rangeMatch[3], 10);
    if (eH === parseInt(rangeMatch[1], 10)) {
      eH = (eH + 1) % 24;
    }
    return `${sH}-00 - ${String(eH).padStart(2, '0')}-00`;
  }
  const simpleRange = s.match(/^(\d{1,2})\s*[\u2010\u2012\u2013\u2014\u2212\-/~]\s*(\d{1,2})$/);
  if (simpleRange) {
    const sH = String(parseInt(simpleRange[1], 10)).padStart(2, '0');
    const eH = String(parseInt(simpleRange[2], 10)).padStart(2, '0');
    return `${sH}-00 - ${eH}-00`;
  }
  const single = s.match(/(\d{1,2})/);
  if (single) {
    const sH = parseInt(single[1], 10);
    const eH = (sH + 1) % 24;
    return `${String(sH).padStart(2, '0')}-00 - ${String(eH).padStart(2, '0')}-00`;
  }
  return s.replace(/[:.]/g, '-').replace(/\s+/g, ' ').trim();
};

const formatDateTR = (dateStr?: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
};

// Formats date into concise DD.MM.YY (e.g. 01.08.26)
const formatDateShortTR = (dateStr?: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const day = parts[2].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const yearShort = parts[0].slice(-2);
    return `${day}.${month}.${yearShort}`;
  }
  return dateStr;
};

// Normalizes dates to prevent month/day inversion bugs (e.g. 2026-01-08 -> 2026-08-01 for August files)
const normalizeDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  const parts = trimmed.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const p1 = parseInt(parts[1], 10);
    // If year is 4 digits, p2 is '08' and p1 is between 1 and 12, then 08 was August!
    if (parts[2] === '08' && p1 >= 1 && p1 <= 12) {
      return `${year}-08-${parts[1].padStart(2, '0')}`;
    }
  }
  return trimmed;
};

export const CallCenterMetricsView: React.FC<CallCenterMetricsViewProps> = ({
  hourlyMetrics: rawHourlyMetrics,
  crmRecords: rawCrmRecords = [],
  language,
  renderMode,
  theme,
  timeFilter = 'daily',
  onTimeFilterChange,
}) => {
  const t = getT(language);
  const hourlyMetrics = useMemo(() => {
    return rawHourlyMetrics.map(m => ({
      ...m,
      date: normalizeDate(m.date),
    }));
  }, [rawHourlyMetrics]);

  const crmRecords = useMemo(() => {
    return rawCrmRecords.map(r => ({
      ...r,
      date: normalizeDate(r.date),
    }));
  }, [rawCrmRecords]);

  const [selectedMetric, setSelectedMetric] = useState<'traffic' | 'serviceLevel' | 'aht' | 'outbound'>('traffic');
  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(hourlyMetrics.map(m => m.date).filter(Boolean)));
    dates.sort();
    return dates;
  }, [hourlyMetrics]);

  const [internalTimeFilter, setInternalTimeFilter] = useState<TimeFilter>(() => {
    if (timeFilter && timeFilter !== 'today' && timeFilter !== 'daily') return timeFilter;
    if (hourlyMetrics.length > 24 || availableDates.length > 1) return 'all';
    return 'all';
  });
  const [selectedDailyDate] = useState<string>('');
  const [customStartDate] = useState<string>('');
  const [customEndDate] = useState<string>('');

  // When multi-date data is present, ensure default view shows the entire file so user sees full totals like 652 immediately
  useEffect(() => {
    if (availableDates.length > 1 && (internalTimeFilter === 'daily' || internalTimeFilter === 'today')) {
      setInternalTimeFilter('all');
    }
  }, [availableDates.length]);

  // Sync internal filter with prop if provided
  useEffect(() => {
    if (timeFilter) {
      setInternalTimeFilter(timeFilter);
    }
  }, [timeFilter]);

  const handleFilterChange = (filter: TimeFilter) => {
    setInternalTimeFilter(filter);
    if (onTimeFilterChange) {
      onTimeFilterChange(filter);
    }
  };

  // Derive all available dates strictly from the Excel dataset (hourlyMetrics + crmRecords)
  const availableExcelDates = useMemo(() => {
    const datesSet = new Set<string>();
    if (hourlyMetrics && hourlyMetrics.length > 0) {
      hourlyMetrics.forEach(m => {
        if (m.date && m.date.trim()) datesSet.add(m.date.trim());
      });
    }
    if (crmRecords && crmRecords.length > 0) {
      crmRecords.forEach(r => {
        if (r.date && r.date.trim()) datesSet.add(r.date.trim());
      });
    }
    const list = Array.from(datesSet).filter(Boolean).sort();
    return list.length > 0 ? list : ['2026-09-01'];
  }, [hourlyMetrics, crmRecords]);

  const minExcelDate = availableExcelDates[0] || '2026-09-01';
  const maxExcelDate = availableExcelDates[availableExcelDates.length - 1] || minExcelDate;

  // Available distinct months in the uploaded file
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    availableExcelDates.forEach(d => {
      if (d && d.length >= 7) monthsSet.add(d.substring(0, 7));
    });
    return Array.from(monthsSet).sort();
  }, [availableExcelDates]);

  // Active single date selection
  const activeDate = useMemo(() => {
    if (selectedDailyDate && availableExcelDates.includes(selectedDailyDate)) {
      return selectedDailyDate;
    }
    // Default to the first date in the uploaded Excel (A2 as requested by user)
    return availableExcelDates[0] || '2026-08-01';
  }, [selectedDailyDate, availableExcelDates]);

  // Determine active matching dates based on internalTimeFilter
  const matchingDates = useMemo(() => {
    const filter = internalTimeFilter;
    if (filter === 'daily' || filter === 'today') {
      return [activeDate];
    }
    if (filter === 'weekly') {
      if (availableExcelDates.length <= 7) {
        return availableExcelDates;
      }
      // Calculate 7-day window starting from activeDate (or ending at activeDate if towards end)
      const activeIdx = availableExcelDates.indexOf(activeDate);
      if (activeIdx >= 0) {
        let startIdx = activeIdx;
        let endIdx = startIdx + 7;
        if (endIdx > availableExcelDates.length) {
          endIdx = availableExcelDates.length;
          startIdx = Math.max(0, endIdx - 7);
        }
        return availableExcelDates.slice(startIdx, endIdx);
      }
      return availableExcelDates.slice(0, 7);
    }
    if (filter === 'monthly') {
      const monthPrefix = activeDate.substring(0, 7);
      const matched = availableExcelDates.filter(d => d.startsWith(monthPrefix));
      if (matched.length > 0) return matched;
      // Fallback to month of first available date
      const firstMonth = (availableExcelDates[0] || '').substring(0, 7);
      const fallbackMatched = availableExcelDates.filter(d => d.startsWith(firstMonth));
      return fallbackMatched.length > 0 ? fallbackMatched : availableExcelDates;
    }
    if (filter === 'custom') {
      if (customStartDate && customEndDate) {
        const matched = availableExcelDates.filter(d => d >= customStartDate && d <= customEndDate);
        return matched.length > 0 ? matched : [activeDate];
      }
      return [activeDate];
    }
    // 'all'
    return availableExcelDates;
  }, [internalTimeFilter, activeDate, availableExcelDates, customStartDate, customEndDate]);

  // All raw rows matching the current filter (for exact column summing/averaging)
  const activeMatchingRows = useMemo(() => {
    if (!hourlyMetrics || hourlyMetrics.length === 0) return [];
    const matchedHourly = hourlyMetrics.filter(m => matchingDates.includes(m.date));
    const existingDates = new Set(matchedHourly.map(m => m.date));
    const missingDates = matchingDates.filter(d => !existingDates.has(d));
    let rows = [...matchedHourly];
    if (matchedHourly.length === 0 && missingDates.length > 0 && crmRecords.length > 0) {
      const missingRecords = crmRecords.filter(r => missingDates.includes(r.date));
      if (missingRecords.length > 0) {
        const derived = deriveHourlyMetricsFromCRM(missingRecords);
        rows = [...rows, ...derived];
      }
    }
    return rows;
  }, [hourlyMetrics, matchingDates, crmRecords]);

  // Compute effective hourly metrics for the matched dates
  const effectiveHourlyMetrics = useMemo(() => {
    if (!hourlyMetrics || hourlyMetrics.length === 0) return [];
    const allMatchingRows = activeMatchingRows;

    // Determine target slots to display (adapting to data range so 24/7 or non-standard hours are never dropped!)
    const presentSlotNorms = Array.from(new Set(allMatchingRows.map(r => normalizeSlot(r.timeSlot)))).filter(Boolean) as string[];
    const parseStartH = (s: string): number => {
      const m = s.match(/(\d{1,2})/);
      return m ? parseInt(m[1], 10) : 0;
    };

    let targetSlots: string[];
    if (presentSlotNorms.length > 0) {
      const hours = presentSlotNorms.map(parseStartH);
      const minH = Math.min(...hours);
      const maxH = Math.max(...hours);
      const rangeStart = Math.min(minH, 8);
      const rangeEnd = Math.max(maxH, 22);
      targetSlots = ALL_24H_SLOTS.filter(slot => {
        const h = parseStartH(slot);
        return (h >= rangeStart && h <= rangeEnd) || presentSlotNorms.includes(slot);
      });
      for (const s of presentSlotNorms) {
        if (!targetSlots.includes(s)) {
          targetSlots.push(s);
        }
      }
      targetSlots.sort((a, b) => parseStartH(a) - parseStartH(b));
    } else {
      targetSlots = STANDARD_SLOTS;
    }

    if (matchingDates.length === 1) {
      // Single day
      const singleDayRows = allMatchingRows.filter(m => m.date === matchingDates[0]);
      // Build map normalized by slot string, merging multi-rows if needed
      const rowMap = new Map<string, CallCenterHourlyMetric>();
      singleDayRows.forEach(r => {
        const norm = normalizeSlot(r.timeSlot);
        if (rowMap.has(norm)) {
          const ex = rowMap.get(norm)!;
          ex.totalCalls += r.totalCalls;
          ex.answeredCalls += r.answeredCalls;
          ex.shortCalls += r.shortCalls;
          ex.missedCalls += r.missedCalls;
          ex.answeredInSL += r.answeredInSL;
          ex.totalTalkDuration += r.totalTalkDuration;
          ex.waitDuration += r.waitDuration;
          ex.holdCount = (ex.holdCount || 0) + (r.holdCount || 0);
          ex.holdDuration = (ex.holdDuration || 0) + (r.holdDuration || 0);
          ex.acwDuration = (ex.acwDuration || 0) + (r.acwDuration || 0);
          ex.wrapUpDuration = (ex.wrapUpDuration || 0) + (r.wrapUpDuration || 0);
          ex.outboundAttempts += r.outboundAttempts;
          ex.outboundCalls += r.outboundCalls;
          ex.outboundDuration += r.outboundDuration;
          ex.serviceLevel1 = ex.answeredCalls > 0 && ex.answeredInSL > 0
            ? Number(((ex.answeredInSL / ex.answeredCalls) * 100).toFixed(1))
            : ex.serviceLevel1;
          ex.serviceLevel2 = ex.totalCalls > 0 && ex.answeredInSL > 0
            ? Number(((ex.answeredInSL / ex.totalCalls) * 100).toFixed(1))
            : ex.serviceLevel1;
          ex.avgTalkTime = ex.answeredCalls > 0 ? Math.round(ex.totalTalkDuration / ex.answeredCalls) : 0;
          if (r.aht > 0) {
            const prevSum = (ex as any)._ahtSum !== undefined ? (ex as any)._ahtSum : ex.aht;
            const prevCount = (ex as any)._ahtCount !== undefined ? (ex as any)._ahtCount : (ex.aht > 0 ? 1 : 0);
            const newSum = prevSum + r.aht;
            const newCount = prevCount + 1;
            (ex as any)._ahtSum = newSum;
            (ex as any)._ahtCount = newCount;
            ex.aht = Number((newSum / newCount).toFixed(1));
          } else if (ex.answeredCalls > 0 && ex.totalTalkDuration > 0) {
            ex.aht = Math.round(ex.totalTalkDuration / ex.answeredCalls);
          }
          ex.answerRate = ex.totalCalls > 0 ? Number(((ex.answeredCalls / ex.totalCalls) * 100).toFixed(1)) : 100;
        } else {
          rowMap.set(norm, { ...r });
        }
      });

      return targetSlots.map(slot => {
        const norm = normalizeSlot(slot);
        if (rowMap.has(norm)) return rowMap.get(norm)!;
        return {
          date: matchingDates[0],
          timeSlot: slot,
          totalCalls: 0,
          answeredCalls: 0,
          shortCalls: 0,
          missedCalls: 0,
          answeredInSL: 0,
          serviceLevel1: 100,
          serviceLevel2: 100,
          aht: 0,
          answerRate: 100,
          holdCount: 0,
          avgTalkTime: 0,
          totalTalkDuration: 0,
          waitDuration: 0,
          avgWaitDuration: 0,
          outboundAttempts: 0,
          outboundCalls: 0,
          outboundAnswerRate: 0,
          outboundDuration: 0,
          outboundAvgTalkTime: 0,
          localHangup: 0,
          ringDuration: 0,
          holdDuration: 0,
          acwDuration: 0,
          wrapUpDuration: 0,
          dequeue: 0,
          speedOfAnswer: 0,
          maxWaitTime: 0,
          outboundLocalHangup: 0,
        };
      });
    }

    // Multi-day aggregate: aggregate across all matching dates per time slot
    return targetSlots.map(slot => {
      const normSlot = normalizeSlot(slot);
      const slotRows = allMatchingRows.filter(r => normalizeSlot(r.timeSlot) === normSlot);
      if (slotRows.length === 0) {
        return {
          date: `${matchingDates[0]} - ${matchingDates[matchingDates.length - 1]}`,
          timeSlot: slot,
          totalCalls: 0,
          answeredCalls: 0,
          shortCalls: 0,
          missedCalls: 0,
          answeredInSL: 0,
          serviceLevel1: 100,
          serviceLevel2: 100,
          aht: 0,
          answerRate: 100,
          holdCount: 0,
          avgTalkTime: 0,
          totalTalkDuration: 0,
          waitDuration: 0,
          avgWaitDuration: 0,
          outboundAttempts: 0,
          outboundCalls: 0,
          outboundAnswerRate: 0,
          outboundDuration: 0,
          outboundAvgTalkTime: 0,
          localHangup: 0,
          ringDuration: 0,
          holdDuration: 0,
          acwDuration: 0,
          wrapUpDuration: 0,
          dequeue: 0,
          speedOfAnswer: 0,
          maxWaitTime: 0,
          outboundLocalHangup: 0,
        };
      }

      const totalCalls = slotRows.reduce((sum, r) => sum + r.totalCalls, 0);
      const answeredCalls = slotRows.reduce((sum, r) => sum + r.answeredCalls, 0);
      const missedCalls = slotRows.reduce((sum, r) => sum + r.missedCalls, 0);
      const answeredInSL = slotRows.reduce((sum, r) => sum + r.answeredInSL, 0);
      const totalTalkDuration = slotRows.reduce((sum, r) => sum + r.totalTalkDuration, 0);
      const waitDuration = slotRows.reduce((sum, r) => sum + r.waitDuration, 0);
      const wrapUpDuration = slotRows.reduce((sum, r) => sum + (r.wrapUpDuration || 0), 0);
      const acwDuration = slotRows.reduce((sum, r) => sum + (r.acwDuration || 0), 0);
      const holdDuration = slotRows.reduce((sum, r) => sum + (r.holdDuration || 0), 0);
      const outboundAttempts = slotRows.reduce((sum, r) => sum + r.outboundAttempts, 0);
      const outboundCalls = slotRows.reduce((sum, r) => sum + r.outboundCalls, 0);
      const outboundDuration = slotRows.reduce((sum, r) => sum + r.outboundDuration, 0);
      const maxWaitTime = Math.max(...slotRows.map(r => r.maxWaitTime || 0));
      const avgSpeed = slotRows.reduce((sum, r) => sum + (r.speedOfAnswer || 0), 0) / (slotRows.length || 1);

      // Weighted & accurate SL
      let sl1 = 0;
      if (answeredCalls > 0 && answeredInSL > 0) {
        sl1 = Number(((answeredInSL / answeredCalls) * 100).toFixed(1));
      } else {
        const weightedSL = slotRows.reduce((sum, r) => sum + (r.serviceLevel1 * (r.answeredCalls || 1)), 0);
        const weightSum = slotRows.reduce((sum, r) => sum + (r.answeredCalls || 1), 0);
        sl1 = weightSum > 0 ? Number((weightedSL / weightSum).toFixed(1)) : 0;
      }

      let sl2 = 0;
      if (totalCalls > 0 && answeredInSL > 0) {
        sl2 = Number(((answeredInSL / totalCalls) * 100).toFixed(1));
      } else {
        sl2 = sl1;
      }

      // Accurate Talk Time
      let avgTalkTime = 0;
      if (answeredCalls > 0 && totalTalkDuration > 0) {
        avgTalkTime = Math.round(totalTalkDuration / answeredCalls);
      } else {
        const weightedTalk = slotRows.reduce((sum, r) => sum + (r.avgTalkTime * (r.answeredCalls || 1)), 0);
        const weightSum = slotRows.reduce((sum, r) => sum + (r.answeredCalls || 1), 0);
        avgTalkTime = weightSum > 0 ? Math.round(weightedTalk / weightSum) : 0;
      }

      // Ortalama Konuşma (N Sütunu): N sütunundaki değerlerin doğrudan aritmetik ortalaması (Kullanıcının talimatı gereği)
      const ahtRows = slotRows.filter(r => r.aht > 0);
      const aht = ahtRows.length > 0
        ? Number((ahtRows.reduce((sum, r) => sum + r.aht, 0) / ahtRows.length).toFixed(1))
        : 0;

      const avgWaitDuration = totalCalls > 0 ? Number((waitDuration / totalCalls).toFixed(1)) : 0;
      const answerRate = totalCalls > 0 ? Number(((answeredCalls / totalCalls) * 100).toFixed(1)) : 100;

      return {
        date: `${matchingDates[0]} - ${matchingDates[matchingDates.length - 1]}`,
        timeSlot: slot,
        totalCalls,
        answeredCalls,
        shortCalls: 0,
        missedCalls,
        answeredInSL,
        serviceLevel1: sl1,
        serviceLevel2: sl2,
        aht,
        answerRate,
        holdCount: slotRows.reduce((sum, r) => sum + (r.holdCount || 0), 0),
        avgTalkTime,
        totalTalkDuration,
        waitDuration,
        avgWaitDuration,
        outboundAttempts,
        outboundCalls,
        outboundAnswerRate: outboundAttempts > 0 ? (outboundCalls / outboundAttempts) * 100 : 0,
        outboundDuration,
        outboundAvgTalkTime: outboundCalls > 0 ? Math.round(outboundDuration / outboundCalls) : 0,
        localHangup: slotRows.reduce((sum, r) => sum + (r.localHangup || 0), 0),
        ringDuration: slotRows.reduce((sum, r) => sum + (r.ringDuration || 0), 0),
        holdDuration,
        acwDuration,
        wrapUpDuration,
        dequeue: 0,
        speedOfAnswer: Math.round(avgSpeed),
        maxWaitTime,
        outboundLocalHangup: 0,
      };
    });
  }, [hourlyMetrics, matchingDates, crmRecords]);

  // Clean, prominent Date Range Display Label
  const activeDateRangeLabel = useMemo(() => {
    let year = 2026;
    let month = 8;

    if (availableExcelDates.length > 0) {
      const monthCounts: Record<string, number> = {};
      availableExcelDates.forEach(d => {
        const p = d.split('-');
        if (p.length === 3) {
          const ym = `${p[0]}-${p[1]}`;
          monthCounts[ym] = (monthCounts[ym] || 0) + 1;
        }
      });
      let maxCount = 0;
      let dominantYM = '2026-08';
      Object.entries(monthCounts).forEach(([ym, count]) => {
        if (count > maxCount) {
          maxCount = count;
          dominantYM = ym;
        }
      });
      const [yStr, mStr] = dominantYM.split('-');
      year = parseInt(yStr, 10) || 2026;
      month = parseInt(mStr, 10) || 8;
    }

    const yearShort = String(year).slice(-2);
    const monthStr = String(month).padStart(2, '0');
    // Calculate last day of this month (e.g. 31 for August, 30 for September, etc.)
    const lastDayNum = new Date(year, month, 0).getDate();
    const lastDayStr = String(lastDayNum).padStart(2, '0');
    const monthlyRangeLabel = `01.${monthStr}.${yearShort} - ${lastDayStr}.${monthStr}.${yearShort}`;

    if (internalTimeFilter === 'all' || internalTimeFilter === 'monthly') {
      return monthlyRangeLabel;
    }

    if (internalTimeFilter === 'weekly') {
      if (matchingDates.length === 0) return monthlyRangeLabel;
      const start = matchingDates[0];
      const end = matchingDates[matchingDates.length - 1];
      return `${formatDateShortTR(start)} - ${formatDateShortTR(end)}`;
    }

    if (internalTimeFilter === 'custom') {
      if (matchingDates.length === 0) return monthlyRangeLabel;
      return `${formatDateShortTR(matchingDates[0])} - ${formatDateShortTR(matchingDates[matchingDates.length - 1])}`;
    }

    if (internalTimeFilter === 'daily') {
      return formatDateShortTR(activeDate);
    }

    return monthlyRangeLabel;
  }, [internalTimeFilter, matchingDates, availableExcelDates, activeDate]);

  if (!hourlyMetrics || hourlyMetrics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-slate-950/70 p-12 text-center backdrop-blur-xl">
        <Activity className="h-10 w-10 text-cyan-400 mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">Santral Metriği Bulunamadı</h3>
        <p className="text-xs text-slate-400 max-w-sm">Veri tabanı boş. Lütfen bir Excel/CSV dosyası yükleyin veya varsayılan demo verilerini geri yükleyin.</p>
      </div>
    );
  }

  const themeActiveTab =
    theme === 'cyberpunk' ? 'bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white shadow-md shadow-fuchsia-500/30' :
    theme === 'titanium' ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-bold shadow-md shadow-amber-500/30' :
    theme === 'enterprise' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30' :
    'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25';

  const themeTimeActive =
    theme === 'cyberpunk' ? 'bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white font-bold shadow-md shadow-cyan-500/30' :
    theme === 'titanium' ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/30' :
    theme === 'enterprise' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-md shadow-blue-500/30' :
    'bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold shadow-md shadow-sky-500/30';

  // Compute Total / Summary Aggregates on effective data
  // Column C: "Çağrılar" -> totalCalls (Gelen Çağrı)
  // Column D: "Cevaplanan" -> answeredCalls (Cevaplanan Çağrı)
  const totalCalls = effectiveHourlyMetrics.reduce((sum, m) => sum + m.totalCalls, 0);
  const answeredCalls = effectiveHourlyMetrics.reduce((sum, m) => sum + m.answeredCalls, 0);
  const missedCalls = effectiveHourlyMetrics.reduce((sum, m) => sum + m.missedCalls, 0);
  const totalInSL = effectiveHourlyMetrics.reduce((sum, m) => sum + m.answeredInSL, 0);
  const overallSL = answeredCalls > 0 ? ((totalInSL / answeredCalls) * 100).toFixed(1) : '0';
  const overallAnswerRate = totalCalls > 0 ? ((answeredCalls / totalCalls) * 100).toFixed(1) : '0';
  const totalTalkSec = effectiveHourlyMetrics.reduce((sum, m) => sum + m.totalTalkDuration, 0);
  const avgTalkTimeSec = answeredCalls > 0 ? Math.round(totalTalkSec / answeredCalls) : 0;

  // Raw Excel Sheet Level Stats (Direct 1:1 Excel Formula Parity from uploaded sheet)
  const rawStats = (hourlyMetrics && hourlyMetrics.length > 0) ? hourlyMetrics[0]?.rawSheetStats : undefined;
  const isViewingAll = internalTimeFilter === 'all' || (matchingDates.length === availableExcelDates.length);

  // Ortalama Konuşma (N Sütunu): N sütununun tamamını topla, dolu hücre sayısına böl
  const filledNRows = activeMatchingRows.filter(m => m.aht > 0);
  const sumN = filledNRows.reduce((sum, m) => sum + m.aht, 0);
  const countN = filledNRows.length;
  const filteredAvgN = countN > 0 ? Number((sumN / countN).toFixed(1)) : 0;
  
  const avgOrtalamaKonusma = (isViewingAll && rawStats && rawStats.columnNAvg > 0)
    ? rawStats.columnNAvg
    : filteredAvgN;
  const effectiveCountN = (isViewingAll && rawStats && rawStats.columnNCount > 0)
    ? rawStats.columnNCount
    : countN;

  // Giden Çağrı (S Sütunu): S sütununun tamamını doğrudan topla, hiçbir bölme/çıkarma yapma
  const filteredOutbound = activeMatchingRows.reduce((sum, m) => sum + m.outboundCalls, 0);
  const totalOutbound = (isViewingAll && rawStats && rawStats.columnSSum > 0)
    ? rawStats.columnSSum
    : filteredOutbound;

  // Dosya Genel Toplamları (Tüm dosya)
  const allFileTotalOutbound = rawStats?.columnSSum || hourlyMetrics.reduce((sum, m) => sum + m.outboundCalls, 0);
  const allFileAvgN = rawStats?.columnNAvg || (hourlyMetrics.filter(m => m.aht > 0).length > 0
    ? Number((hourlyMetrics.filter(m => m.aht > 0).reduce((sum, m) => sum + m.aht, 0) / hourlyMetrics.filter(m => m.aht > 0).length).toFixed(1))
    : 0);

  // Peak Hour Detection on effective data
  const peakSlot = (effectiveHourlyMetrics && effectiveHourlyMetrics.length > 0)
    ? effectiveHourlyMetrics.reduce((max, m) => (m.totalCalls > max.totalCalls ? m : max), effectiveHourlyMetrics[0])
    : null;

  // Chart Datasets
  const hourlyTrafficChartData = effectiveHourlyMetrics.map(m => ({
    label: m.timeSlot.split(' - ')[0],
    value: m.totalCalls,
    secondaryValue: m.answeredCalls,
    color: m.totalCalls >= 15 ? '#f43f5e' : m.totalCalls >= 10 ? '#38bdf8' : '#818cf8',
  }));

  const hourlySLChartData = effectiveHourlyMetrics.map(m => ({
    label: m.timeSlot.split(' - ')[0],
    value: Math.round(m.serviceLevel1),
    color: m.serviceLevel1 < 60 ? '#f43f5e' : m.serviceLevel1 < 85 ? '#fbbf24' : '#34d399',
  }));

  const hourlyAHTChartData = effectiveHourlyMetrics.map(m => ({
    label: m.timeSlot.split(' - ')[0],
    value: Math.round(m.aht),
    color: m.aht > 400 ? '#f43f5e' : m.aht > 300 ? '#fbbf24' : '#38bdf8',
  }));

  return (
    <div className="space-y-6 pb-12 relative">
      {/* Title & Filter Bar with high z-index stacking context */}
      <div className="relative z-50 flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Activity className="h-6 w-6 text-cyan-400" />
            <h2 className="text-xl font-black text-white tracking-tight">{t.navCallCenter}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-xs text-slate-400">
              Santral Kuyruk, SL% Performansı ve 15 Saatlik Trafik Telemetrisi
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-cyan-500/15 border border-cyan-500/40 px-2.5 py-0.5 text-xs font-mono font-bold text-cyan-300 shadow-sm shadow-cyan-500/20">
              <Calendar className="h-3.5 w-3.5 text-cyan-400" />
              Seçili Tarih: {activeDateRangeLabel}
            </span>
          </div>
        </div>

        {/* Filter Controls: Date Range / Calendar Selection + Metric View Tabs */}
        <div className="relative z-50 flex items-center gap-2 sm:gap-3 flex-nowrap shrink-0 overflow-x-auto max-w-full pb-0.5">
          {/* Time Filter Group */}
          <div className="flex items-center space-x-1 rounded-xl border border-white/15 bg-slate-900/90 p-1 backdrop-blur-md shrink-0">
            {/* Haftalık Filter Button */}
            <button
              type="button"
              onClick={() => {
                handleFilterChange('weekly');
              }}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                internalTimeFilter === 'weekly'
                  ? themeTimeActive
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Seçili tarihin haftasına ait kümülatif analiz"
            >
              Haftalık
            </button>

            {/* Aylık Filter Button (covers the entire monthly dataset) */}
            <button
              type="button"
              onClick={() => {
                handleFilterChange('all');
              }}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                internalTimeFilter === 'all' || internalTimeFilter === 'monthly'
                  ? themeTimeActive
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Aylık operasyon analizi"
            >
              Aylık
            </button>
          </div>

          {/* Metric View Tabs: Çağrı Trafiği, SL, AHT, Giden Arama */}
          <div className="flex items-center space-x-1 rounded-xl border border-white/10 bg-slate-900/80 p-1 backdrop-blur-md shrink-0">
            <button
              type="button"
              onClick={() => setSelectedMetric('traffic')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                selectedMetric === 'traffic'
                  ? themeActiveTab
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Çağrı Trafiği
            </button>
            <button
              type="button"
              onClick={() => setSelectedMetric('serviceLevel')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                selectedMetric === 'serviceLevel'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Servis Seviyesi (SL)
            </button>
            <button
              type="button"
              onClick={() => setSelectedMetric('aht')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                selectedMetric === 'aht'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-md shadow-purple-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              AHT Süreleri
            </button>
            <button
              type="button"
              onClick={() => setSelectedMetric('outbound')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                selectedMetric === 'outbound'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Giden Arama
            </button>
          </div>
        </div>
      </div>

      {/* Hero Queue Summary Cards (relative z-10 so calendar popover z-[100] stays comfortably above) */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Gelen Çağrı */}
        <Interactive3DCard
          renderMode={renderMode}
          glowColor="rgba(6, 182, 212, 0.4)"
          className="border border-cyan-500/40 bg-slate-900/70 p-4 backdrop-blur-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Gelen Çağrı</span>
            <PhoneIncoming className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-cyan-300">{totalCalls}</div>
        </Interactive3DCard>

        {/* 2. Cevaplanan Çağrı */}
        <Interactive3DCard
          renderMode={renderMode}
          glowColor="rgba(16, 185, 129, 0.4)"
          className="border border-emerald-500/40 bg-slate-900/70 p-4 backdrop-blur-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Cevaplanan Çağrı</span>
            <PhoneCall className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-emerald-300">{answeredCalls}</div>
        </Interactive3DCard>

        {/* 3. Cevaplama Oranı */}
        <Interactive3DCard
          renderMode={renderMode}
          glowColor="rgba(20, 184, 166, 0.4)"
          className="border border-teal-500/40 bg-slate-900/70 p-4 backdrop-blur-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">{t.answerRate}</span>
            <Zap className="h-4 w-4 text-teal-400" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-teal-300">%{overallAnswerRate}</div>
        </Interactive3DCard>

        {/* 4. Service Level % */}
        <Interactive3DCard
          renderMode={renderMode}
          glowColor="rgba(59, 130, 246, 0.4)"
          className="border border-blue-500/40 bg-slate-900/70 p-4 backdrop-blur-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Genel SL (Servis Seviyesi)</span>
            <ShieldAlert className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-blue-300">%{overallSL}</div>
        </Interactive3DCard>

        {/* 5. Ortalama Konuşma (Column N) */}
        <Interactive3DCard
          renderMode={renderMode}
          glowColor="rgba(139, 92, 246, 0.4)"
          className="border border-purple-500/40 bg-slate-900/70 p-4 backdrop-blur-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Ortalama Konuşma (AHT)</span>
            <Clock className="h-4 w-4 text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-purple-300">
            {typeof avgOrtalamaKonusma === 'number' ? (Number.isInteger(avgOrtalamaKonusma) ? avgOrtalamaKonusma : avgOrtalamaKonusma.toFixed(1)) : avgOrtalamaKonusma} <span className="text-xs">{t.sec}</span>
          </div>
        </Interactive3DCard>

        {/* 6. Outbound Calls (Column S) */}
        <Interactive3DCard
          renderMode={renderMode}
          glowColor="rgba(245, 158, 11, 0.4)"
          className="border border-amber-500/40 bg-slate-900/70 p-4 backdrop-blur-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Giden Arama</span>
            <PhoneOutgoing className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-amber-300">{totalOutbound} <span className="text-xs text-slate-400">çağrı</span></div>
        </Interactive3DCard>
      </div>

      {/* Critical Peak Hour Analysis Banner */}
      {peakSlot && (
        <div className="relative z-10">
          <Interactive3DCard
            renderMode={renderMode}
            glowColor="rgba(244, 63, 94, 0.4)"
            depth={8}
            className="border border-rose-500/40 bg-gradient-to-r from-rose-950/40 via-slate-900/80 to-slate-950/80 p-4 backdrop-blur-xl"
          >
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="rounded-xl bg-rose-500/20 border border-rose-500/40 p-2.5 text-rose-400">
                  <AlertOctagon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <span>Pik Yoğunluk Analizi ({peakSlot.timeSlot})</span>
                    <span className="rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 text-[10px] font-mono">
                      {activeDateRangeLabel}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {peakSlot.totalCalls} çağrı ile seçili dönemin en yüksek kuyruk yükü gerçekleşti. Bekleme süresi {peakSlot.waitDuration} saniyeye ulaştı ({peakSlot.missedCalls} kaçan çağrı). Servis Seviyesi %{peakSlot.serviceLevel1.toFixed(1)} olarak gerçekleşti.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 text-xs">
                <div className="rounded-lg bg-slate-900/80 border border-white/10 px-3 py-1.5 text-center">
                  <span className="block text-slate-400 text-[10px]">Pik Çağrı</span>
                  <span className="font-bold text-white font-mono">{peakSlot.totalCalls}</span>
                </div>
                <div className="rounded-lg bg-slate-900/80 border border-white/10 px-3 py-1.5 text-center">
                  <span className="block text-slate-400 text-[10px]">Pik AHT</span>
                  <span className="font-bold text-rose-400 font-mono">{Math.round(peakSlot.aht)} sn</span>
                </div>
                <div className="rounded-lg bg-slate-900/80 border border-white/10 px-3 py-1.5 text-center">
                  <span className="block text-slate-400 text-[10px]">Maks Bekleme</span>
                  <span className="font-bold text-amber-400 font-mono">{peakSlot.maxWaitTime} sn</span>
                </div>
              </div>
            </div>
          </Interactive3DCard>
        </div>
      )}

      {/* Interactive 3D Chart based on Selected Metric - with explicit selected date header */}
      <div className="relative z-10">
        <Interactive3DCard
          renderMode={renderMode}
          glowColor="rgba(6, 182, 212, 0.3)"
          className="border border-white/10 bg-slate-900/70 p-5 backdrop-blur-md"
        >
          {/* Prominent selected date header above chart */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
            <div className="flex items-center space-x-2.5">
              <div className="rounded-lg bg-cyan-500/20 p-2 text-cyan-400 border border-cyan-500/30">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-wide">
                  {selectedMetric === 'traffic' && '15 Saatlik Çağrı Trafiği & Dağılımı'}
                  {selectedMetric === 'serviceLevel' && 'Saatlik Servis Seviyesi (SL%) Skalası'}
                  {selectedMetric === 'aht' && 'Saatlik Ortalama Çağrı Süresi (AHT)'}
                  {selectedMetric === 'outbound' && 'Saatlik Giden Arama Hacmi'}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedMetric === 'traffic' && 'Saat bazında gelen çağrılar'}
                  {selectedMetric === 'serviceLevel' && '20 saniye içinde karşılanan çağrı yüzdesi trendi (Hedef: >%80)'}
                  {selectedMetric === 'aht' && 'Konuşma + Bekletme + Wrap-Up dahil toplam çağrı süresi trendi'}
                  {selectedMetric === 'outbound' && 'Geri arama ve dış arama denemeleri telemetrisi'}
                </p>
              </div>
            </div>
            <div className="text-xs text-slate-400">
              Seçili Tarih: <span className="font-mono font-bold text-cyan-300">{activeDateRangeLabel}</span>
            </div>
          </div>

          {selectedMetric === 'traffic' && (
            <Interactive3DBarChart
              data={hourlyTrafficChartData}
              unit="Çağrı"
              renderMode={renderMode}
              height={240}
            />
          )}

          {selectedMetric === 'serviceLevel' && (
            <Interactive3DBarChart
              data={hourlySLChartData}
              unit="%"
              maxValue={100}
              renderMode={renderMode}
              height={240}
            />
          )}

          {selectedMetric === 'aht' && (
            <Interactive3DBarChart
              data={hourlyAHTChartData}
              unit="sn"
              renderMode={renderMode}
              height={240}
            />
          )}

          {selectedMetric === 'outbound' && (
            <Interactive3DBarChart
              data={effectiveHourlyMetrics.map(m => ({
                label: m.timeSlot.split(' - ')[0],
                value: m.outboundCalls,
                secondaryValue: m.outboundAttempts,
                color: '#f59e0b',
              }))}
              unit="Arama"
              renderMode={renderMode}
              height={240}
            />
          )}
        </Interactive3DCard>
      </div>

      {/* Hourly Detail Telemetry Table - with explicit selected date header */}
      <div className="relative z-10">
        <Interactive3DCard
          renderMode={renderMode}
          glowColor="rgba(59, 130, 246, 0.3)"
          className="border border-white/10 bg-slate-900/70 p-5 backdrop-blur-md overflow-hidden"
        >
          {/* Prominent selected date header above table */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
            <div className="flex items-center space-x-2.5">
              <div className="rounded-lg bg-cyan-500/20 p-2 text-cyan-400 border border-cyan-500/30">
                <TableIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-wide">Saatlik Santral Telemetri Tablosu</h3>
                <p className="text-xs text-slate-400">
                  15 Zaman Dilimi (09:00 - 00:00) Telemetri ve SL Dökümü
                </p>
              </div>
            </div>
            <div className="text-xs text-slate-400">
              Tabloda Gösterilen Tarih: <span className="font-mono font-bold text-cyan-300">{activeDateRangeLabel}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase font-bold text-[10px] text-slate-400 tracking-wider">
                <tr>
                  <th className="px-3 py-2.5">Saat Aralığı</th>
                  <th className="px-3 py-2.5 text-cyan-300">Gelen</th>
                  <th className="px-3 py-2.5 text-emerald-300">Cevaplanan</th>
                  <th className="px-3 py-2.5">Kaçan</th>
                  <th className="px-3 py-2.5">SL%</th>
                  <th className="px-3 py-2.5 text-purple-300">Ort. Konuşma</th>
                  <th className="px-3 py-2.5">Ort. Bekleme</th>
                  <th className="px-3 py-2.5 text-amber-300">Giden</th>
                  <th className="px-3 py-2.5">Wrap Up</th>
                  <th className="px-3 py-2.5">Maks Bekleme</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {effectiveHourlyMetrics.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="px-3 py-2.5 font-sans font-medium text-white">{row.timeSlot}</td>
                    <td className="px-3 py-2.5 font-bold text-cyan-400">{row.totalCalls}</td>
                    <td className="px-3 py-2.5 font-bold text-emerald-400">{row.answeredCalls}</td>
                    <td className={`px-3 py-2.5 font-bold ${row.missedCalls > 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                      {row.missedCalls}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.serviceLevel1 < 60 ? 'bg-rose-500/20 text-rose-300' : row.serviceLevel1 < 85 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        %{row.serviceLevel1.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-bold text-purple-300">
                      {typeof row.aht === 'number' ? (Number.isInteger(row.aht) ? row.aht : row.aht.toFixed(1)) : row.aht} sn
                    </td>
                    <td className="px-3 py-2.5">{row.avgWaitDuration.toFixed(1)} sn</td>
                    <td className="px-3 py-2.5 font-bold text-amber-300">{row.outboundCalls}</td>
                    <td className="px-3 py-2.5">{row.wrapUpDuration} sn</td>
                    <td className={`px-3 py-2.5 ${row.maxWaitTime > 120 ? 'text-amber-400 font-bold' : ''}`}>{row.maxWaitTime} sn</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Interactive3DCard>
      </div>
    </div>
  );
};
