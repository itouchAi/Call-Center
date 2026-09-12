import React, { useState, useMemo } from 'react';
import { StaffMember, CallRecord, RenderMode, AppTheme, ExcelSheetPreview } from '../types';
import { getStaffRecords } from '../data/defaultDatasets';
import { 
  formatDurationHuman, 
  formatDurationHHMMSS, 
  generateSampleExcelPreview,
  normalizeKey,
  parseNum,
  parseDurationSec
} from '../utils/excelParser';
import { ExcelPreviewColumnSelectorModal } from './ExcelPreviewColumnSelectorModal';
import { Interactive3DCard } from './Interactive3DCard';
import { 
  Calendar, Clock, PhoneCall, Timer, TrendingUp, 
  Coffee, Utensils, Users, GraduationCap, Check, 
  Table, Sparkles, FileSpreadsheet,
  CheckCircle2, ShieldCheck, BarChart2, X
} from 'lucide-react';

export type KPIHeaderKey = 
  | 'kpiScore'
  | 'representative'
  | 'date'
  | 'totalTalk'
  | 'answered'
  | 'inboundAht'
  | 'netProductivity'
  | 'break'
  | 'lunch'
  | 'meeting'
  | 'training'
  | 'fcr'
  | 'sl'
  | 'csat'
  | string;

export interface KPIHeaderDefinition {
  id: KPIHeaderKey;
  label: string;
  excelColumnName: string;
  icon: React.ElementType;
  aggregationRule: 'total' | 'average_nonzero' | 'count_nonzero' | 'entity';
  ruleDescription: string;
  accentColor: string;
  badgeBg: string;
}

export const KPI_HEADER_DEFINITIONS: KPIHeaderDefinition[] = [
  {
    id: 'date',
    label: 'Tarih',
    excelColumnName: 'Tarih',
    icon: Calendar,
    aggregationRule: 'count_nonzero',
    ruleDescription: 'Cevaplanan sütununda "0" lar hariç kaç hücre doluysa o dolu hücre sayısı',
    accentColor: '#06b6d4', // Cyan
    badgeBg: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300',
  },
  {
    id: 'totalTalk',
    label: 'Toplam Konuşma Süresi',
    excelColumnName: 'Toplam Konuşma Süresi',
    icon: Clock,
    aggregationRule: 'total',
    ruleDescription: 'Tüm günlerin görüşme süreleri toplam olarak hesaplanır',
    accentColor: '#818cf8', // Indigo
    badgeBg: 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300',
  },
  {
    id: 'answered',
    label: 'Cevaplanan',
    excelColumnName: 'Cevaplanan',
    icon: PhoneCall,
    aggregationRule: 'total',
    ruleDescription: 'Cevaplanan çağrı adedi toplam olarak yazılır',
    accentColor: '#34d399', // Emerald
    badgeBg: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
  },
  {
    id: 'inboundAht',
    label: 'Gelen Çağrı Ort Konuşma Süresi',
    excelColumnName: 'Gelen Çağrı Ort Konuşma Süresi',
    icon: Timer,
    aggregationRule: 'total',
    ruleDescription: 'Gelen çağrıların ortalama görüşme süresi (AHT)',
    accentColor: '#f59e0b', // Amber
    badgeBg: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
  },
  {
    id: 'netProductivity',
    label: 'Net Verimlilik',
    excelColumnName: 'Net Verimlilik',
    icon: TrendingUp,
    aggregationRule: 'average_nonzero',
    ruleDescription: 'Ortalama olarak hesaplanır, "0" lar ortalamaya katılmaz',
    accentColor: '#ec4899', // Pink
    badgeBg: 'bg-pink-500/15 border-pink-500/40 text-pink-300',
  },
  {
    id: 'break',
    label: 'Mola',
    excelColumnName: 'Mola',
    icon: Coffee,
    aggregationRule: 'total',
    ruleDescription: 'Toplam mola süresi ayrı olarak hesaplanır',
    accentColor: '#fb923c', // Orange
    badgeBg: 'bg-orange-500/15 border-orange-500/40 text-orange-300',
  },
  {
    id: 'lunch',
    label: 'Yemek',
    excelColumnName: 'Yemek',
    icon: Utensils,
    aggregationRule: 'total',
    ruleDescription: 'Toplam yemek süresi ayrı olarak hesaplanır',
    accentColor: '#a78bfa', // Purple
    badgeBg: 'bg-purple-500/15 border-purple-500/40 text-purple-300',
  },
  {
    id: 'meeting',
    label: 'Toplantı',
    excelColumnName: 'Toplantı',
    icon: Users,
    aggregationRule: 'total',
    ruleDescription: 'Toplam toplantı süresi ayrı olarak hesaplanır',
    accentColor: '#60a5fa', // Blue
    badgeBg: 'bg-blue-500/15 border-blue-500/40 text-blue-300',
  },
  {
    id: 'training',
    label: 'Eğitim',
    excelColumnName: 'Eğitim',
    icon: GraduationCap,
    aggregationRule: 'total',
    ruleDescription: 'Toplam eğitim süresi ayrı olarak hesaplanır',
    accentColor: '#2dd4bf', // Teal
    badgeBg: 'bg-teal-500/15 border-teal-500/40 text-teal-300',
  },
];

export interface DayKPIRow {
  date: string;
  formattedDate: string;
  answeredCalls: number;
  totalTalkDuration: number;
  inboundAvgTalkTime: number;
  netProductivity: number;
  breakDuration: number;
  lunchDuration: number;
  meetingDuration: number;
  trainingDuration: number;
  isAnsweredNonZero: boolean;
  isProductivityNonZero: boolean;
  customValues?: Record<string, any>;
}

export interface ComputedStaffKPIOutput {
  staff: StaffMember;
  workDaysCountNonZero: number;
  totalAnsweredCalls: number;
  totalTalkDurationSec: number;
  avgInboundTalkTimeSec: number;
  avgNetProductivityNonZero: number;
  totalBreakDurationSec: number;
  totalLunchDurationSec: number;
  totalMeetingDurationSec: number;
  totalTrainingDurationSec: number;
  dailyRows: DayKPIRow[];
  customSummaries?: Record<string, { value: string; subtext?: string }>;
}

export function matchHeaderKey(name: string): string {
  const norm = normalizeKey(name);
  if (norm === 'date' || norm.includes('tarih') || norm === 'gun' || norm === 'zaman') return 'date';
  if (norm === 'totaltalk' || norm.includes('toplamkonusma') || norm.includes('toplamgorusme') || (norm.includes('toplam') && norm.includes('sure') && !norm.includes('ort'))) return 'totalTalk';
  if (norm === 'answered' || norm.includes('cevaplanan') || norm.includes('karsilanan') || norm.includes('yanitlanan') || norm === 'handled' || norm === 'cvp') return 'answered';
  if (
    norm === 'inboundaht' || 
    norm.includes('gelencagriort') || 
    norm.includes('gelenortalamakonusma') || 
    norm.includes('gelenortalamagorusme') || 
    norm.includes('ortalamakonusma') || 
    norm.includes('ortalamagorusme') || 
    norm.includes('ortkonusma') || 
    norm.includes('ortgorusme') || 
    norm.includes('inboundavg') || 
    (norm.includes('gelen') && norm.includes('ort')) ||
    norm === 'aht'
  ) return 'inboundAht';
  if (norm === 'netproductivity' || norm.includes('netverimlilik') || norm.includes('verimlilik') || norm.includes('productivity')) return 'netProductivity';
  if (norm === 'break' || norm.includes('mola') || norm.includes('istirahat') || norm.includes('aux1')) return 'break';
  if (norm === 'lunch' || norm.includes('yemek') || norm.includes('lunch') || norm.includes('aux2')) return 'lunch';
  if (norm === 'meeting' || norm.includes('toplanti') || norm.includes('kocluk') || norm.includes('aux3')) return 'meeting';
  if (norm === 'training' || norm.includes('egitim') || norm.includes('training') || norm.includes('aux4')) return 'training';
  return name;
}

export function getHeaderItem(keyOrName: string): KPIHeaderDefinition {
  const matchedKey = matchHeaderKey(keyOrName);
  const found = KPI_HEADER_DEFINITIONS.find(h => h.id === matchedKey || h.label.toLowerCase() === keyOrName.toLowerCase());
  if (found) return found;

  const norm = (keyOrName || '').toLowerCase();
  const Icon = norm.includes('cagri') || norm.includes('tel') ? PhoneCall :
               norm.includes('sure') || norm.includes('zaman') || norm.includes('dakika') ? Clock :
               norm.includes('verim') || norm.includes('oran') ? TrendingUp : Table;

  return {
    id: keyOrName,
    label: keyOrName,
    excelColumnName: keyOrName,
    icon: Icon,
    aggregationRule: 'total',
    ruleDescription: `Excel'den eklenen "${keyOrName}" sütun verisi`,
    accentColor: '#38bdf8',
    badgeBg: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300',
  };
}

interface InteractiveKPIHeaderFilterProps {
  staffList: StaffMember[];
  selectedStaff: StaffMember;
  onSelectStaff: (staff: StaffMember) => void;
  crmRecords: CallRecord[];
  renderMode?: RenderMode;
  theme?: AppTheme;
  detectedHeaders?: string[];
  sheetsPreview?: ExcelSheetPreview[];
  activeSelectedHeaders?: string[];
  onUpdateSelectedHeaders?: (headers: string[]) => void;
  onOpenExcelPreview?: () => void;
  kpiData?: any;
}

export const InteractiveKPIHeaderFilter: React.FC<InteractiveKPIHeaderFilterProps> = ({
  selectedStaff,
  crmRecords,
  renderMode = 'performance',
  sheetsPreview,
  activeSelectedHeaders,
  onUpdateSelectedHeaders,
  onOpenExcelPreview,
  kpiData,
}) => {
  // Modal for Excel Preview & Column Checkbox Selector
  const [isExcelPreviewModalOpen, setIsExcelPreviewModalOpen] = useState(false);

  // Track if custom Excel column selection mode is active (default is false => keeps Image 3 cards as default)
  const [isCustomSelection, setIsCustomSelection] = useState(false);

  // Selected Excel headers
  const [selectedHeaders, setSelectedHeaders] = useState<Set<string>>(() => {
    if (activeSelectedHeaders && activeSelectedHeaders.length > 0) {
      return new Set(activeSelectedHeaders);
    }
    return new Set<string>([
      'Tarih', 
      'Toplam Konuşma Süresi', 
      'Cevaplanan', 
      'Gelen Çağrı Ort Konuşma Süresi', 
      'Net Verimlilik', 
      'Mola', 
      'Yemek', 
      'Toplantı'
    ]);
  });

  // Active clicked header for deep inspection / column highlighting in Daily Table
  const [activeDrillHeader, setActiveDrillHeader] = useState<string | null>(null);

  // Show / hide daily table
  const [showDailyTable, setShowDailyTable] = useState(false);

  // Compute staff daily breakdown and KPI totals based on user's exact formulas
  const primaryKPI = useMemo<ComputedStaffKPIOutput | null>(() => {
    if (!selectedStaff || !crmRecords || crmRecords.length === 0) return null;

    const staffRecords = getStaffRecords(selectedStaff, crmRecords);
    if (staffRecords.length === 0) return null;

    // Group by unique date
    const dateMap = new Map<string, CallRecord[]>();
    staffRecords.forEach(r => {
      const d = r.date || '2026-09-01';
      if (!dateMap.has(d)) dateMap.set(d, []);
      dateMap.get(d)!.push(r);
    });

    const dailyRows: DayKPIRow[] = [];

    dateMap.forEach((records, date) => {
      let dayAnswered = 0;
      let dayTotalTalk = 0;
      let dayInboundAhtSum = 0;
      let dayInboundAhtCount = 0;
      let dayNetProdSum = 0;
      let dayNetProdCount = 0;
      let dayBreak = 0;
      let dayLunch = 0;
      let dayMeeting = 0;
      let dayTraining = 0;
      const dayCustomVals: Record<string, any> = {};

      records.forEach(r => {
        const ans = typeof r.answeredCalls === 'number' ? r.answeredCalls : (typeof r.callCount === 'number' ? r.callCount : 1);
        dayAnswered += ans;

        if (typeof r.totalTalkDuration === 'number') {
          dayTotalTalk += r.totalTalkDuration;
        } else if (typeof r.duration === 'number') {
          dayTotalTalk += (r.duration * ans);
        }

        const aht = r.inboundAvgTalkTime !== undefined ? r.inboundAvgTalkTime : r.duration;
        if (typeof aht === 'number' && aht > 0) {
          dayInboundAhtSum += aht * ans;
          dayInboundAhtCount += ans;
        }

        if (typeof r.netProductivity === 'number' && r.netProductivity > 0) {
          let np = r.netProductivity;
          while (np > 100) np = np / 100;
          if (np <= 1 && np > 0) np = np * 100;
          dayNetProdSum += np;
          dayNetProdCount += 1;
        }

        if (typeof r.breakDuration === 'number') dayBreak += r.breakDuration;
        if (typeof r.lunchDuration === 'number') dayLunch += r.lunchDuration;
        if (typeof r.meetingDuration === 'number') dayMeeting += r.meetingDuration;
        if (typeof r.trainingDuration === 'number') dayTraining += r.trainingDuration;

        if (r.rawKPIValues) {
          Object.entries(r.rawKPIValues).forEach(([k, v]) => {
            dayCustomVals[k] = v;
          });
        }
      });

      const dayInboundAht = dayInboundAhtCount > 0 ? Math.round(dayInboundAhtSum / dayInboundAhtCount) : 0;
      const dayNetProductivity = dayNetProdCount > 0 ? Math.round((dayNetProdSum / dayNetProdCount) * 10) / 10 : 0;

      const dateParts = date.split('-');
      const formattedDate = dateParts.length === 3 ? `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}` : date;

      dailyRows.push({
        date,
        formattedDate,
        answeredCalls: dayAnswered,
        totalTalkDuration: dayTotalTalk,
        inboundAvgTalkTime: dayInboundAht,
        netProductivity: dayNetProductivity,
        breakDuration: dayBreak,
        lunchDuration: dayLunch,
        meetingDuration: dayMeeting,
        trainingDuration: dayTraining,
        isAnsweredNonZero: dayAnswered > 0,
        isProductivityNonZero: dayNetProductivity > 0,
        customValues: dayCustomVals,
      });
    });

    dailyRows.sort((a, b) => a.date.localeCompare(b.date));

    // Rule 1: Tarih - Non-zero answered days
    const nonZeroAnsweredDays = dailyRows.filter(d => d.answeredCalls > 0);
    const workDaysCountNonZero = nonZeroAnsweredDays.length > 0 ? nonZeroAnsweredDays.length : dailyRows.length;

    // Rule 2: Toplam konuşma süresi
    const totalTalkDurationSec = dailyRows.reduce((sum, d) => sum + d.totalTalkDuration, 0);

    // Rule 3: Cevaplanan
    const totalAnsweredCalls = dailyRows.reduce((sum, d) => sum + d.answeredCalls, 0);

    // Rule 4: Gelen çağrı ort konuşma süresi
    const daysWithAht = dailyRows.filter(d => d.inboundAvgTalkTime > 0);
    const simpleAvgAht = daysWithAht.length > 0 
      ? Math.round(daysWithAht.reduce((s, d) => s + d.inboundAvgTalkTime, 0) / daysWithAht.length) 
      : 0;

    const weightedAhtSum = nonZeroAnsweredDays.reduce((sum, d) => sum + (d.inboundAvgTalkTime * d.answeredCalls), 0);
    const avgInboundTalkTimeSec = (totalAnsweredCalls > 0 && weightedAhtSum > 0)
      ? Math.round(weightedAhtSum / totalAnsweredCalls) 
      : simpleAvgAht;

    // Rule 5: Net verimlilik (excluding 0)
    const nonZeroProdDays = dailyRows.filter(d => d.netProductivity > 0);
    const avgNetProductivityNonZero = nonZeroProdDays.length > 0
      ? Math.round((nonZeroProdDays.reduce((sum, d) => sum + d.netProductivity, 0) / nonZeroProdDays.length) * 10) / 10
      : 0;

    // Rule 6: Aux times
    const totalBreakDurationSec = dailyRows.reduce((sum, d) => sum + d.breakDuration, 0);
    const totalLunchDurationSec = dailyRows.reduce((sum, d) => sum + d.lunchDuration, 0);
    const totalMeetingDurationSec = dailyRows.reduce((sum, d) => sum + d.meetingDuration, 0);
    const totalTrainingDurationSec = dailyRows.reduce((sum, d) => sum + d.trainingDuration, 0);

    // Custom summaries for all non-standard columns
    const customSummaries: Record<string, { value: string; subtext?: string }> = {};
    const customKeys = new Set<string>();
    staffRecords.forEach(r => {
      if (r.rawKPIValues) {
        Object.keys(r.rawKPIValues).forEach(k => customKeys.add(k));
      }
    });

    customKeys.forEach(colName => {
      const normC = normalizeKey(colName);
      const vals: any[] = [];
      staffRecords.forEach(r => {
        if (r.rawKPIValues && r.rawKPIValues[colName] !== undefined && r.rawKPIValues[colName] !== '') {
          vals.push(r.rawKPIValues[colName]);
        }
      });
      if (vals.length === 0) return;

      const isDuration = normC.includes('sure') || normC.includes('zaman') || normC.includes('aht');
      const isAvg = normC.includes('ort') || normC.includes('avg');

      const secVals: number[] = [];
      const numVals: number[] = [];
      vals.forEach(v => {
        const sec = parseDurationSec(v, true, false);
        if (sec !== undefined) secVals.push(sec);
        const num = parseNum(v);
        if (num !== undefined) numVals.push(num);
      });

      if (isDuration && secVals.length > 0) {
        const sumSec = secVals.reduce((a, b) => a + b, 0);
        const avgSec = Math.round(sumSec / secVals.length);
        if (isAvg) {
          customSummaries[colName] = {
            value: formatDurationHHMMSS(avgSec),
            subtext: `Ortalama: ${formatDurationHuman(avgSec)} (${avgSec} sn)`,
          };
        } else {
          customSummaries[colName] = {
            value: formatDurationHuman(sumSec),
            subtext: `Toplam: ${formatDurationHHMMSS(sumSec)} (${sumSec} sn)`,
          };
        }
      } else if (numVals.length > 0) {
        const sumNum = numVals.reduce((a, b) => a + b, 0);
        const avgNum = Math.round((sumNum / numVals.length) * 10) / 10;
        if (isAvg) {
          customSummaries[colName] = {
            value: `${avgNum}`,
            subtext: `Ortalama (Toplam: ${sumNum})`,
          };
        } else {
          customSummaries[colName] = {
            value: `${sumNum}`,
            subtext: `Toplam (Ort: ${avgNum})`,
          };
        }
      } else {
        customSummaries[colName] = {
          value: String(vals[vals.length - 1]),
          subtext: `${vals.length} Kayıt Mevcut`,
        };
      }
    });

    return {
      staff: selectedStaff,
      workDaysCountNonZero,
      totalAnsweredCalls,
      totalTalkDurationSec,
      avgInboundTalkTimeSec,
      avgNetProductivityNonZero,
      totalBreakDurationSec,
      totalLunchDurationSec,
      totalMeetingDurationSec,
      totalTrainingDurationSec,
      dailyRows,
      customSummaries,
    };
  }, [selectedStaff, crmRecords]);

  // Format header values for selected columns view
  const formatHeaderValue = (headerLabel: string, computed: ComputedStaffKPIOutput | null): { value: string; subtext?: string } => {
    if (!computed) return { value: '-' };
    const stdKey = matchHeaderKey(headerLabel);

    switch (stdKey) {
      case 'date':
        return {
          value: `${computed.workDaysCountNonZero} Gün`,
          subtext: `Cevaplanan > 0 (${computed.workDaysCountNonZero} gün)`,
        };
      case 'totalTalk':
        return {
          value: formatDurationHuman(computed.totalTalkDurationSec),
          subtext: `Toplam: ${formatDurationHHMMSS(computed.totalTalkDurationSec)} (${computed.totalTalkDurationSec.toLocaleString('tr-TR')} sn)`,
        };
      case 'answered':
        return {
          value: `${computed.totalAnsweredCalls.toLocaleString('tr-TR')} Çağrı`,
          subtext: `Toplam (Günlük ort. ${computed.workDaysCountNonZero > 0 ? Math.round(computed.totalAnsweredCalls / computed.workDaysCountNonZero) : 0})`,
        };
      case 'inboundAht':
        return {
          value: computed.avgInboundTalkTimeSec > 0 ? formatDurationHHMMSS(computed.avgInboundTalkTimeSec) : '00:00:00',
          subtext: computed.avgInboundTalkTimeSec > 0 
            ? `Ortalama: ${formatDurationHuman(computed.avgInboundTalkTimeSec)} (${computed.avgInboundTalkTimeSec} sn)` 
            : 'Kayıt bulunamadı',
        };
      case 'netProductivity':
        return {
          value: `%${computed.avgNetProductivityNonZero}`,
          subtext: `Ortalama ('0' hariç)`,
        };
      case 'break': {
        const avgMin = Math.round(computed.totalBreakDurationSec / Math.max(1, computed.workDaysCountNonZero) / 60);
        return {
          value: `${avgMin} dk / gün`,
          subtext: `Ortalama (${computed.workDaysCountNonZero} gün ort. - Toplam: ${formatDurationHHMMSS(computed.totalBreakDurationSec)})`,
        };
      }
      case 'lunch': {
        const avgMin = Math.round(computed.totalLunchDurationSec / Math.max(1, computed.workDaysCountNonZero) / 60);
        return {
          value: `${avgMin} dk / gün`,
          subtext: `Ortalama (${computed.workDaysCountNonZero} gün ort. - Toplam: ${formatDurationHHMMSS(computed.totalLunchDurationSec)})`,
        };
      }
      case 'meeting':
        return {
          value: formatDurationHuman(computed.totalMeetingDurationSec),
          subtext: `Toplam: ${formatDurationHHMMSS(computed.totalMeetingDurationSec)} (${computed.totalMeetingDurationSec} sn)`,
        };
      case 'training':
        return {
          value: formatDurationHuman(computed.totalTrainingDurationSec),
          subtext: `Toplam: ${formatDurationHHMMSS(computed.totalTrainingDurationSec)} (${computed.totalTrainingDurationSec} sn)`,
        };
      default:
        if (computed.customSummaries && computed.customSummaries[headerLabel]) {
          return computed.customSummaries[headerLabel];
        }
        return { value: '-', subtext: `Kural: Toplam/Ortalama` };
    }
  };

  // Convert active headers Set to Header Definitions
  const activeHeaderItems = useMemo(() => {
    const headersArray = Array.from(selectedHeaders) as string[];
    return headersArray.map(name => getHeaderItem(name));
  }, [selectedHeaders]);

  // Handle click on ANY card: opens Daily Breakdown Table and highlights that column
  const handleCardClick = (targetHeaderKey: string) => {
    if (activeDrillHeader === targetHeaderKey && showDailyTable) {
      // If clicking already highlighted card while table is open, toggle table off
      setShowDailyTable(false);
      setActiveDrillHeader(null);
    } else {
      setActiveDrillHeader(targetHeaderKey);
      setShowDailyTable(true);
    }
  };

  // Check if a table column is highlighted
  const isColumnHighlighted = (colKey: string): boolean => {
    if (!activeDrillHeader) return false;
    const stdActive = matchHeaderKey(activeDrillHeader);
    const stdCol = matchHeaderKey(colKey);

    if (stdActive === stdCol) return true;
    if (activeDrillHeader.toLowerCase() === colKey.toLowerCase()) return true;

    // Cross-link default KPI cards to corresponding table columns
    if (activeDrillHeader === 'kpiScore' && colKey === 'netProductivity') return true;
    if (activeDrillHeader === 'fcr' && colKey === 'answered') return true;
    if (activeDrillHeader === 'sl' && colKey === 'answered') return true;
    if (activeDrillHeader === 'csat' && colKey === 'netProductivity') return true;

    return false;
  };

  // Display name for table header highlight badge
  const activeHeaderDisplayName = useMemo(() => {
    if (!activeDrillHeader) return null;
    if (activeDrillHeader === 'kpiScore') return 'KPI Skoru (Net Verimlilik)';
    if (activeDrillHeader === 'answered') return 'Cevaplanan';
    if (activeDrillHeader === 'inboundAht') return 'Gelen Çağrı Ort Konuşma Süresi';
    if (activeDrillHeader === 'totalTalk') return 'Toplam Konuşma Süresi';
    if (activeDrillHeader === 'netProductivity') return 'Net Verimlilik';
    if (activeDrillHeader === 'break') return 'Mola';
    if (activeDrillHeader === 'lunch') return 'Yemek';
    if (activeDrillHeader === 'meeting') return 'Toplantı';
    if (activeDrillHeader === 'training') return 'Eğitim';
    if (activeDrillHeader === 'date') return 'Tarih';
    if (activeDrillHeader === 'fcr') return 'İlk Temasta Çözüm (FCR)';
    if (activeDrillHeader === 'sl') return 'Servis Seviyesi (SL)';
    if (activeDrillHeader === 'csat') return 'CSAT Kalite';

    const found = KPI_HEADER_DEFINITIONS.find(h => h.id === activeDrillHeader);
    return found ? found.label : activeDrillHeader;
  }, [activeDrillHeader]);

  // Handle applying columns from Excel modal: activates custom selection view in Image 3 style
  const handleApplyExcelColumns = (columns: string[]) => {
    setSelectedHeaders(new Set(columns));
    setIsCustomSelection(true);
    if (onUpdateSelectedHeaders) {
      onUpdateSelectedHeaders(columns);
    }
    setIsExcelPreviewModalOpen(false);
  };

  // Reset to default 6 KPI cards (Image 3 default)
  const handleResetToDefaultCards = () => {
    setIsCustomSelection(false);
    setSelectedHeaders(new Set([
      'Tarih', 
      'Toplam Konuşma Süresi', 
      'Cevaplanan', 
      'Gelen Çağrı Ort Konuşma Süresi', 
      'Net Verimlilik', 
      'Mola', 
      'Yemek', 
      'Toplantı'
    ]));
    setActiveDrillHeader(null);
  };

  if (!selectedStaff || !primaryKPI) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center text-slate-400">
        <p className="text-sm">Seçili personel verisi bulunamadı veya henüz veri yüklenmedi.</p>
      </div>
    );
  }

  // Fallback / merged KPI values for default cards
  const scoreVal = kpiData?.overallScore !== undefined ? kpiData.overallScore : 97;
  const answeredVal = kpiData?.answeredCallsTotal !== undefined 
    ? kpiData.answeredCallsTotal 
    : (kpiData?.totalHandled !== undefined ? kpiData.totalHandled : primaryKPI.totalAnsweredCalls);
  const offeredVal = kpiData?.totalOfferedCalls !== undefined ? kpiData.totalOfferedCalls : answeredVal;
  const ahtVal = kpiData?.ahtAvg !== undefined ? kpiData.ahtAvg : primaryKPI.avgInboundTalkTimeSec;
  const fcrVal = kpiData?.fcrRate !== undefined ? kpiData.fcrRate : 100;
  const slVal = kpiData?.slAdherenceRate !== undefined ? kpiData.slAdherenceRate : 93;
  const csatVal = kpiData?.customerSatisfaction !== undefined ? kpiData.customerSatisfaction : 91;

  // Custom selected columns that are not among the standard 9 columns
  const extraCustomColumns: string[] = isCustomSelection 
    ? (Array.from(selectedHeaders) as string[]).filter(h => {
        const std = matchHeaderKey(h);
        return !['date', 'answered', 'totalTalk', 'inboundAht', 'netProductivity', 'break', 'lunch', 'meeting', 'training'].includes(std);
      })
    : [];

  return (
    <div className="space-y-4">
      {/* 1. EXCEL SPREADSHEET COLUMN SELECTOR & QUICK ACTION BAR */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-md shadow-cyan-500/10">
              <FileSpreadsheet className="h-4 w-4" />
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-extrabold text-white tracking-tight">
                  KPI & Operasyonel Metrik Analizi
                </h3>
                <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-300 border border-cyan-500/30">
                  {!isCustomSelection ? 'Varsayılan 6 KPI Aktif' : `Excel'den Seçili: ${selectedHeaders.size} Sütun`}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Kartlara tıklayarak detaylı Günlük Veriler Tablosunu açabilir ve seçilen sütunu anında vurgulayabilirsiniz.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Open Excel Preview & Column Selection Modal */}
            <button
              type="button"
              id="open-excel-spreadsheet-preview-btn"
              onClick={() => {
                if (onOpenExcelPreview) onOpenExcelPreview();
                else setIsExcelPreviewModalOpen(true);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-2 rounded-xl border border-cyan-500/50 bg-gradient-to-r from-cyan-950 via-blue-950 to-slate-900 px-3.5 py-2 text-xs font-extrabold text-cyan-300 hover:from-cyan-900 hover:to-blue-900 shadow-md shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-95 ring-1 ring-cyan-500/30 cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4 text-cyan-400" />
              <span>Excel Önizleme & Sütun Seçimi</span>
              <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.2 text-[10px] font-mono text-cyan-200 border border-cyan-500/40">
                {selectedHeaders.size}
              </span>
            </button>

            {/* Toggle Daily Breakdown Table */}
            <button
              type="button"
              id="toggle-daily-table-view-btn"
              onClick={() => setShowDailyTable(!showDailyTable)}
              className={`flex items-center space-x-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all border cursor-pointer ${
                showDailyTable || activeDrillHeader
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50 shadow-md shadow-cyan-500/20' 
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Table className="h-3.5 w-3.5" />
              <span>{showDailyTable || activeDrillHeader ? 'Tabloyu Kapat' : 'Günlük Tablo Görünümü'}</span>
            </button>

            {/* Switch back to default 6 KPI cards */}
            {isCustomSelection && (
              <button
                type="button"
                onClick={handleResetToDefaultCards}
                className="rounded-xl border border-sky-500/30 bg-sky-950/40 px-3 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-900/50 transition-colors cursor-pointer flex items-center space-x-1"
              >
                <span>Varsayılan KPI'lar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. KPI METRIC SCORECARDS IN IMAGE 3 STYLE */}
      {/* (Interactive cards: clicking any card opens the Daily Breakdown Table with that column highlighted) */}
      {!isCustomSelection ? (
        /* DEFAULT 6 KPI CARDS (Image 3 Style with 'Günlük Görünüm' pills/links removed) */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Composite KPI */}
          <Interactive3DCard
            renderMode={renderMode}
            glowColor="rgba(6, 182, 212, 0.4)"
            onClick={() => handleCardClick('netProductivity')}
            className={`group cursor-pointer border p-4 backdrop-blur-md transition-all hover:scale-[1.02] rounded-2xl ${
              isColumnHighlighted('netProductivity')
                ? 'ring-2 ring-cyan-400 border-cyan-400 bg-slate-800/90 shadow-lg shadow-cyan-500/25'
                : 'border-cyan-500/40 bg-slate-900/60 hover:border-cyan-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 group-hover:text-cyan-300 transition-colors">KPI Skoru</span>
              <Sparkles className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black font-mono text-cyan-300">%{scoreVal}</span>
              <span className="text-[11px] font-bold text-emerald-400">+4.2%</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" 
                style={{ width: `${Math.min(100, Math.max(0, scoreVal))}%` }} 
              />
            </div>
            <p className="mt-2 text-[10px] text-slate-400 font-medium truncate">Genel Performans İndeksi</p>
          </Interactive3DCard>

          {/* Card 2: Handled Calls (Cevaplanan Çağrı - 'Günlük Döküm' and '3 Gün' removed per user request) */}
          <Interactive3DCard
            renderMode={renderMode}
            glowColor="rgba(59, 130, 246, 0.4)"
            onClick={() => handleCardClick('answered')}
            className={`group cursor-pointer border p-4 backdrop-blur-md transition-all hover:scale-[1.02] rounded-2xl ${
              isColumnHighlighted('answered')
                ? 'ring-2 ring-blue-400 border-blue-400 bg-slate-800/90 shadow-lg shadow-blue-500/25'
                : 'border-blue-500/40 bg-slate-900/60 hover:border-blue-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-300 group-hover:text-blue-200 transition-colors">Cevaplanan Çağrı</span>
              <div className="p-1 rounded-lg bg-blue-500/20 text-blue-400 group-hover:bg-blue-500/30">
                <PhoneCall className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black font-mono text-blue-300 group-hover:text-blue-200">
                {answeredVal}
              </span>
              <span className="text-xs text-slate-300 font-medium">Cevaplanan</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-medium">
              <span className="text-blue-400/90 font-semibold truncate">
                Gelen: {offeredVal} Çağrı
              </span>
            </div>
          </Interactive3DCard>

          {/* Card 3: AHT Average ('Günlük Süre' removed per user request) */}
          <Interactive3DCard
            renderMode={renderMode}
            glowColor="rgba(139, 92, 246, 0.4)"
            onClick={() => handleCardClick('inboundAht')}
            className={`group cursor-pointer border p-4 backdrop-blur-md transition-all hover:scale-[1.02] rounded-2xl ${
              isColumnHighlighted('inboundAht')
                ? 'ring-2 ring-purple-400 border-purple-400 bg-slate-800/90 shadow-lg shadow-purple-500/25'
                : 'border-purple-500/40 bg-slate-900/60 hover:border-purple-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 group-hover:text-purple-300 transition-colors">Ortalama Çağrı Süresi (AHT)</span>
              <div className="p-1 rounded-lg bg-purple-500/20 text-purple-400 group-hover:bg-purple-500/30">
                <Clock className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black font-mono text-purple-300 group-hover:text-purple-200">{ahtVal}</span>
              <span className="text-xs text-purple-400">sn</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-purple-400 font-medium">
              <span>Hedef: &lt;240s</span>
            </div>
          </Interactive3DCard>

          {/* Card 4: First Contact Resolution */}
          <Interactive3DCard
            renderMode={renderMode}
            glowColor="rgba(16, 185, 129, 0.4)"
            onClick={() => handleCardClick('fcr')}
            className={`group cursor-pointer border p-4 backdrop-blur-md transition-all hover:scale-[1.02] rounded-2xl ${
              isColumnHighlighted('fcr')
                ? 'ring-2 ring-emerald-400 border-emerald-400 bg-slate-800/90 shadow-lg shadow-emerald-500/25'
                : 'border-emerald-500/30 bg-slate-900/60 hover:border-emerald-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 group-hover:text-emerald-300 transition-colors">İlk Temasta Çözüm (FCR)</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black font-mono text-emerald-300">%{fcrVal}</span>
              <span className="text-[11px] text-emerald-400">Hedef: %80</span>
            </div>
            <p className="mt-2 text-[10px] text-slate-400 truncate">Tekrar arama önleme oranı</p>
          </Interactive3DCard>

          {/* Card 5: Service Level Adherence */}
          <Interactive3DCard
            renderMode={renderMode}
            glowColor="rgba(245, 158, 11, 0.4)"
            onClick={() => handleCardClick('sl')}
            className={`group cursor-pointer border p-4 backdrop-blur-md transition-all hover:scale-[1.02] rounded-2xl ${
              isColumnHighlighted('sl')
                ? 'ring-2 ring-amber-400 border-amber-400 bg-slate-800/90 shadow-lg shadow-amber-500/25'
                : 'border-amber-500/30 bg-slate-900/60 hover:border-amber-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 group-hover:text-amber-300 transition-colors">Servis Seviyesi (SL)</span>
              <ShieldCheck className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black font-mono text-amber-300">%{slVal}</span>
            </div>
            <p className="mt-2 text-[10px] text-slate-400 truncate">20sn içinde karşılama uyumu</p>
          </Interactive3DCard>

          {/* Card 6: Customer Satisfaction (CSAT) */}
          <Interactive3DCard
            renderMode={renderMode}
            glowColor="rgba(236, 72, 153, 0.4)"
            onClick={() => handleCardClick('csat')}
            className={`group cursor-pointer border p-4 backdrop-blur-md transition-all hover:scale-[1.02] rounded-2xl ${
              isColumnHighlighted('csat')
                ? 'ring-2 ring-pink-400 border-pink-400 bg-slate-800/90 shadow-lg shadow-pink-500/25'
                : 'border-pink-500/30 bg-slate-900/60 hover:border-pink-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 group-hover:text-pink-300 transition-colors">CSAT Kalite</span>
              <BarChart2 className="h-4 w-4 text-pink-400" />
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black font-mono text-pink-300">{csatVal}</span>
              <span className="text-xs text-pink-400">/100</span>
            </div>
            <p className="mt-2 text-[10px] text-slate-400 truncate">Anket & kalite denetim puanı</p>
          </Interactive3DCard>
        </div>
      ) : (
        /* CUSTOM EXCEL COLUMN SELECTION: Created in the EXACT SAME Image 3 Style! */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {activeHeaderItems.map(header => {
            const primaryVal = formatHeaderValue(header.label, primaryKPI);
            const Icon = header.icon;
            const stdKey = matchHeaderKey(header.label);
            const isAvgMetric = stdKey === 'inboundAht' || stdKey === 'netProductivity' || header.label.toLowerCase().includes('ort');
            const isSumMetric = stdKey === 'answered' || stdKey === 'totalTalk' || stdKey === 'break' || stdKey === 'lunch' || stdKey === 'meeting' || stdKey === 'training' || header.label.toLowerCase().includes('toplam');
            const isHighlighted = isColumnHighlighted(header.id || header.label);

            return (
              <Interactive3DCard
                key={header.id || header.label}
                renderMode={renderMode}
                glowColor={header.accentColor ? `${header.accentColor}66` : 'rgba(6, 182, 212, 0.4)'}
                onClick={() => handleCardClick(header.id || header.label)}
                className={`group cursor-pointer border p-4 backdrop-blur-md transition-all hover:scale-[1.02] rounded-2xl ${
                  isHighlighted 
                    ? 'ring-2 ring-cyan-400 border-cyan-400 bg-slate-850 shadow-lg shadow-cyan-500/25' 
                    : 'border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-850'
                }`}
              >
                {/* Header Title & Icon */}
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs font-bold text-slate-300 group-hover:text-white truncate">
                    {header.label}
                  </span>
                  <div 
                    className="p-1 rounded-lg shrink-0" 
                    style={{ backgroundColor: `${header.accentColor}20`, color: header.accentColor }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                </div>

                {/* Primary Metric Value */}
                <div className="mt-2 flex items-baseline space-x-1.5">
                  <span className="text-2xl font-black font-mono tracking-tight text-white group-hover:text-cyan-200">
                    {primaryVal.value}
                  </span>
                  {isAvgMetric && (
                    <span className="text-[10px] font-bold text-amber-400 font-sans">
                      (Ort.)
                    </span>
                  )}
                  {isSumMetric && (
                    <span className="text-[10px] font-bold text-sky-400 font-sans">
                      (Top.)
                    </span>
                  )}
                </div>

                {/* Calculation Subtext */}
                <div className="mt-2 text-[10px] text-slate-400 font-medium truncate">
                  {primaryVal.subtext || header.ruleDescription}
                </div>
              </Interactive3DCard>
            );
          })}
        </div>
      )}

      {/* 3. DAILY BREAKDOWN TABLE (IMAGE 4) */}
      {/* Opens when ANY card in Image 3 style is clicked; highlights the clicked column */}
      {(showDailyTable || activeDrillHeader) && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/95 p-5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
            <div>
              <h4 className="text-sm font-extrabold text-white flex items-center gap-2 flex-wrap">
                <Table className="h-4 w-4 text-cyan-400" />
                <span>{selectedStaff.name} – Günlük KPI Verileri Tablosu</span>
                {activeHeaderDisplayName && (
                  <span className="rounded-md bg-cyan-500/20 px-2.5 py-0.5 text-[11px] font-extrabold text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20 flex items-center gap-1 animate-pulse">
                    <Sparkles className="h-3 w-3 text-cyan-400" />
                    <span>Vurgu: {activeHeaderDisplayName}</span>
                  </span>
                )}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Cevaplanan sütunundaki "0" değerleri ve ortalamaya katılan/katılmayan günler işaretlenmiştir.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400 font-mono">
                {primaryKPI.workDaysCountNonZero} Aktif Gün / {primaryKPI.dailyRows.length} Toplam Gün
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveDrillHeader(null);
                  setShowDailyTable(false);
                }}
                className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>Kapat</span>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold">
                  {/* Tarih */}
                  <th 
                    onClick={() => setActiveDrillHeader('date')}
                    className={`py-2.5 px-3 cursor-pointer transition-colors ${
                      isColumnHighlighted('date') 
                        ? 'text-cyan-300 font-extrabold bg-cyan-500/25 ring-1 ring-cyan-400/50 rounded-t-lg' 
                        : 'hover:text-white'
                    }`}
                  >
                    Tarih
                  </th>

                  {/* Cevaplanan */}
                  <th 
                    onClick={() => setActiveDrillHeader('answered')}
                    className={`py-2.5 px-3 cursor-pointer transition-colors ${
                      isColumnHighlighted('answered') 
                        ? 'text-emerald-300 font-extrabold bg-emerald-500/25 ring-1 ring-emerald-400/50 rounded-t-lg' 
                        : 'hover:text-white'
                    }`}
                  >
                    Cevaplanan (Adet)
                  </th>

                  {/* Toplam Konuşma */}
                  <th 
                    onClick={() => setActiveDrillHeader('totalTalk')}
                    className={`py-2.5 px-3 cursor-pointer transition-colors ${
                      isColumnHighlighted('totalTalk') 
                        ? 'text-indigo-300 font-extrabold bg-indigo-500/25 ring-1 ring-indigo-400/50 rounded-t-lg' 
                        : 'hover:text-white'
                    }`}
                  >
                    Toplam Konuşma
                  </th>

                  {/* Gelen Çağrı Ort. Süre */}
                  <th 
                    onClick={() => setActiveDrillHeader('inboundAht')}
                    className={`py-2.5 px-3 cursor-pointer transition-colors ${
                      isColumnHighlighted('inboundAht') 
                        ? 'text-amber-300 font-extrabold bg-amber-500/25 ring-1 ring-amber-400/50 rounded-t-lg' 
                        : 'hover:text-white'
                    }`}
                  >
                    Gelen Çağrı Ort. Süre
                  </th>

                  {/* Net Verimlilik */}
                  <th 
                    onClick={() => setActiveDrillHeader('netProductivity')}
                    className={`py-2.5 px-3 cursor-pointer transition-colors ${
                      isColumnHighlighted('netProductivity') 
                        ? 'text-pink-300 font-extrabold bg-pink-500/25 ring-1 ring-pink-400/50 rounded-t-lg' 
                        : 'hover:text-white'
                    }`}
                  >
                    Net Verimlilik
                  </th>

                  {/* Mola */}
                  <th 
                    onClick={() => setActiveDrillHeader('break')}
                    className={`py-2.5 px-3 cursor-pointer transition-colors ${
                      isColumnHighlighted('break') 
                        ? 'text-orange-300 font-extrabold bg-orange-500/25 ring-1 ring-orange-400/50 rounded-t-lg' 
                        : 'hover:text-white'
                    }`}
                  >
                    Mola
                  </th>

                  {/* Yemek */}
                  <th 
                    onClick={() => setActiveDrillHeader('lunch')}
                    className={`py-2.5 px-3 cursor-pointer transition-colors ${
                      isColumnHighlighted('lunch') 
                        ? 'text-purple-300 font-extrabold bg-purple-500/25 ring-1 ring-purple-400/50 rounded-t-lg' 
                        : 'hover:text-white'
                    }`}
                  >
                    Yemek
                  </th>

                  {/* Toplantı */}
                  <th 
                    onClick={() => setActiveDrillHeader('meeting')}
                    className={`py-2.5 px-3 cursor-pointer transition-colors ${
                      isColumnHighlighted('meeting') 
                        ? 'text-blue-300 font-extrabold bg-blue-500/25 ring-1 ring-blue-400/50 rounded-t-lg' 
                        : 'hover:text-white'
                    }`}
                  >
                    Toplantı
                  </th>

                  {/* Eğitim */}
                  <th 
                    onClick={() => setActiveDrillHeader('training')}
                    className={`py-2.5 px-3 cursor-pointer transition-colors ${
                      isColumnHighlighted('training') 
                        ? 'text-teal-300 font-extrabold bg-teal-500/25 ring-1 ring-teal-400/50 rounded-t-lg' 
                        : 'hover:text-white'
                    }`}
                  >
                    Eğitim
                  </th>

                  {/* Extra custom columns if selected */}
                  {extraCustomColumns.map(col => (
                    <th 
                      key={col}
                      onClick={() => setActiveDrillHeader(col)}
                      className={`py-2.5 px-3 cursor-pointer transition-colors ${
                        isColumnHighlighted(col) 
                          ? 'text-cyan-300 font-extrabold bg-cyan-500/25 ring-1 ring-cyan-400/50 rounded-t-lg' 
                          : 'hover:text-white'
                      }`}
                    >
                      {col}
                    </th>
                  ))}

                  <th className="py-2.5 px-3 text-right">Durum</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/60 font-mono">
                {primaryKPI.dailyRows.map((row, idx) => {
                  const isZero = row.answeredCalls === 0;

                  return (
                    <tr 
                      key={idx} 
                      className={`hover:bg-slate-800/50 transition-colors ${
                        isZero ? 'bg-red-950/20 text-slate-400' : 'text-slate-200'
                      }`}
                    >
                      {/* Tarih Cell */}
                      <td className={`py-2.5 px-3 font-sans font-bold flex items-center gap-1.5 transition-colors ${
                        isColumnHighlighted('date') ? 'bg-cyan-500/15 text-cyan-200 border-x border-cyan-500/30' : ''
                      }`}>
                        <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        <span>{row.formattedDate}</span>
                      </td>

                      {/* Cevaplanan Cell */}
                      <td className={`py-2.5 px-3 font-bold transition-colors ${
                        isColumnHighlighted('answered') 
                          ? 'bg-emerald-500/15 text-emerald-200 border-x border-emerald-500/30 font-black' 
                          : row.answeredCalls > 0 ? 'text-emerald-300' : 'text-red-400'
                      }`}>
                        {row.answeredCalls}
                      </td>

                      {/* Toplam Konuşma Cell */}
                      <td className={`py-2.5 px-3 transition-colors ${
                        isColumnHighlighted('totalTalk') 
                          ? 'bg-indigo-500/15 text-indigo-200 border-x border-indigo-500/30 font-bold' 
                          : ''
                      }`}>
                        {formatDurationHuman(row.totalTalkDuration)}
                      </td>

                      {/* Gelen Çağrı Ort. Süre Cell */}
                      <td className={`py-2.5 px-3 font-mono transition-colors ${
                        isColumnHighlighted('inboundAht') 
                          ? 'bg-amber-500/15 text-amber-200 border-x border-amber-500/30 font-bold' 
                          : 'text-amber-300'
                      }`}>
                        {row.inboundAvgTalkTime > 0 ? `${formatDurationHHMMSS(row.inboundAvgTalkTime)} (${row.inboundAvgTalkTime} sn)` : '-'}
                      </td>

                      {/* Net Verimlilik Cell */}
                      <td className={`py-2.5 px-3 transition-colors ${
                        isColumnHighlighted('netProductivity') 
                          ? 'bg-pink-500/15 text-pink-200 border-x border-pink-500/30 font-bold' 
                          : ''
                      }`}>
                        {row.netProductivity > 0 ? (
                          <span className="text-pink-300 font-bold">%{row.netProductivity}</span>
                        ) : (
                          <span className="text-slate-500 italic">0 (Hariç)</span>
                        )}
                      </td>

                      {/* Mola Cell */}
                      <td className={`py-2.5 px-3 transition-colors ${
                        isColumnHighlighted('break') 
                          ? 'bg-orange-500/15 text-orange-200 border-x border-orange-500/30 font-bold' 
                          : ''
                      }`}>
                        {formatDurationHuman(row.breakDuration)}
                      </td>

                      {/* Yemek Cell */}
                      <td className={`py-2.5 px-3 transition-colors ${
                        isColumnHighlighted('lunch') 
                          ? 'bg-purple-500/15 text-purple-200 border-x border-purple-500/30 font-bold' 
                          : ''
                      }`}>
                        {formatDurationHuman(row.lunchDuration)}
                      </td>

                      {/* Toplantı Cell */}
                      <td className={`py-2.5 px-3 transition-colors ${
                        isColumnHighlighted('meeting') 
                          ? 'bg-blue-500/15 text-blue-200 border-x border-blue-500/30 font-bold' 
                          : ''
                      }`}>
                        {formatDurationHuman(row.meetingDuration)}
                      </td>

                      {/* Eğitim Cell */}
                      <td className={`py-2.5 px-3 transition-colors ${
                        isColumnHighlighted('training') 
                          ? 'bg-teal-500/15 text-teal-200 border-x border-teal-500/30 font-bold' 
                          : ''
                      }`}>
                        {formatDurationHuman(row.trainingDuration)}
                      </td>

                      {/* Extra custom columns cells */}
                      {extraCustomColumns.map(col => (
                        <td 
                          key={col}
                          className={`py-2.5 px-3 transition-colors ${
                            isColumnHighlighted(col) 
                              ? 'bg-cyan-500/15 text-cyan-200 border-x border-cyan-500/30 font-bold' 
                              : ''
                          }`}
                        >
                          {row.customValues && row.customValues[col] !== undefined ? String(row.customValues[col]) : '-'}
                        </td>
                      ))}

                      {/* Durum Cell */}
                      <td className="py-2.5 px-3 text-right font-sans">
                        {isZero ? (
                          <span className="inline-flex rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300 border border-red-500/30">
                            0 Çağrı (Muaf)
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                            Dolu Hücre ✓
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Summary Totals & Averages according to User Rules */}
              <tfoot className="bg-slate-950 font-mono font-bold border-t-2 border-slate-700 text-white">
                <tr>
                  <td className={`py-3 px-3 font-sans font-black ${
                    isColumnHighlighted('date') ? 'bg-cyan-500/25 text-cyan-200 border-x border-cyan-400/50 rounded-b-lg' : 'text-sky-400'
                  }`}>
                    ÖZET TOPLAM & ORT.
                  </td>

                  <td className={`py-3 px-3 transition-colors ${
                    isColumnHighlighted('answered') ? 'bg-emerald-500/25 text-emerald-200 border-x border-emerald-400/50 rounded-b-lg font-black' : 'text-emerald-300'
                  }`}>
                    {primaryKPI.totalAnsweredCalls} (Toplam)
                  </td>

                  <td className={`py-3 px-3 transition-colors ${
                    isColumnHighlighted('totalTalk') ? 'bg-indigo-500/25 text-indigo-200 border-x border-indigo-400/50 rounded-b-lg font-black' : 'text-indigo-300'
                  }`}>
                    {formatDurationHuman(primaryKPI.totalTalkDurationSec)} (Toplam)
                  </td>

                  <td className={`py-3 px-3 transition-colors ${
                    isColumnHighlighted('inboundAht') ? 'bg-amber-500/25 text-amber-200 border-x border-amber-400/50 rounded-b-lg font-black' : 'text-amber-300'
                  }`}>
                    {primaryKPI.avgInboundTalkTimeSec > 0 
                      ? `${formatDurationHHMMSS(primaryKPI.avgInboundTalkTimeSec)} (${primaryKPI.avgInboundTalkTimeSec} sn Ort.)` 
                      : '-'}
                  </td>

                  <td className={`py-3 px-3 transition-colors ${
                    isColumnHighlighted('netProductivity') ? 'bg-pink-500/25 text-pink-200 border-x border-pink-400/50 rounded-b-lg font-black' : 'text-pink-300'
                  }`}>
                    %{primaryKPI.avgNetProductivityNonZero} (Ort. "0" hariç)
                  </td>

                  <td className={`py-3 px-3 transition-colors ${
                    isColumnHighlighted('break') ? 'bg-orange-500/25 text-orange-200 border-x border-orange-400/50 rounded-b-lg font-black' : 'text-orange-300'
                  }`}>
                    {formatDurationHuman(primaryKPI.totalBreakDurationSec)} (Toplam)
                  </td>

                  <td className={`py-3 px-3 transition-colors ${
                    isColumnHighlighted('lunch') ? 'bg-purple-500/25 text-purple-200 border-x border-purple-400/50 rounded-b-lg font-black' : 'text-purple-300'
                  }`}>
                    {formatDurationHuman(primaryKPI.totalLunchDurationSec)} (Toplam)
                  </td>

                  <td className={`py-3 px-3 transition-colors ${
                    isColumnHighlighted('meeting') ? 'bg-blue-500/25 text-blue-200 border-x border-blue-400/50 rounded-b-lg font-black' : 'text-blue-300'
                  }`}>
                    {formatDurationHuman(primaryKPI.totalMeetingDurationSec)} (Toplam)
                  </td>

                  <td className={`py-3 px-3 transition-colors ${
                    isColumnHighlighted('training') ? 'bg-teal-500/25 text-teal-200 border-x border-teal-400/50 rounded-b-lg font-black' : 'text-teal-300'
                  }`}>
                    {formatDurationHuman(primaryKPI.totalTrainingDurationSec)} (Toplam)
                  </td>

                  {/* Extra custom columns in summary */}
                  {extraCustomColumns.map(col => {
                    const summary = primaryKPI.customSummaries?.[col]?.value || '-';
                    return (
                      <td 
                        key={col}
                        className={`py-3 px-3 transition-colors ${
                          isColumnHighlighted(col) ? 'bg-cyan-500/25 text-cyan-200 border-x border-cyan-400/50 rounded-b-lg font-black' : 'text-cyan-300'
                        }`}
                      >
                        {summary}
                      </td>
                    );
                  })}

                  <td className="py-3 px-3 text-right font-sans text-cyan-300">
                    {primaryKPI.workDaysCountNonZero} Dolu Gün
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 4. EXCEL SPREADSHEET PREVIEW & COLUMN SELECTION MODAL */}
      <ExcelPreviewColumnSelectorModal
        isOpen={isExcelPreviewModalOpen}
        onClose={() => setIsExcelPreviewModalOpen(false)}
        sheetsPreview={sheetsPreview && sheetsPreview.length > 0 ? sheetsPreview : generateSampleExcelPreview(crmRecords)}
        activeHeaders={Array.from(selectedHeaders)}
        onApplySelectedHeaders={handleApplyExcelColumns}
      />
    </div>
  );
};
