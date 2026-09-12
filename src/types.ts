export type Language = 'tr' | 'en';
export type AppTheme = 'frosted' | 'cyberpunk' | 'titanium' | 'enterprise';
export type RenderMode = 'performance' | 'efficiency';
export type TimeFilter = 'daily' | 'today' | 'weekly' | 'monthly' | 'all' | 'custom' | 'hourly';

export interface StaffMember {
  id: string;
  name: string;
  title: string;
  role: string;
  avatar: string;
  email: string;
  extension: string;
  status: 'available' | 'in-call' | 'acw' | 'break' | 'offline';
  color: string;
  bio?: string;
  joinDate: string;
  skills: string[];
}

export interface CallRecord {
  id: string;
  callStatus: 'ISP' | 'L2' | 'Service' | 'Solved' | 'Webchat' | 'Open' | 'Closed' | 'Served';
  resolution: string;
  productModel: string;
  subCategory: string;
  category: string;
  businessUnit: string;
  brand: string;
  problem: string;
  customer: string;
  score?: number;
  duration?: number;
  agentNote?: string;
  date: string;
  time?: string;
  creator: string;
  email?: string;
  updater?: string;
  assignedUser?: string;
  // Support for Excel summary rows (where a single row contains daily/batch stats with a "Toplam Çağrı" column)
  callCount?: number;
  solvedCount?: number;
  serviceCount?: number;
  openCount?: number;
  fcrRate?: number;
  slRate?: number;
  csatScore?: number;
  excelRow?: number;
  excelCellRef?: string;
  rawColumnE?: any;
  rawRowData?: Record<string, any>;
  // Specific KPI Excel Columns requested by User
  answeredCalls?: number; // Cevaplanan (answered calls)
  totalOfferedCalls?: number; // Toplam Çağrı / Gelen Çağrı (offered/inbound calls, kept distinct from answered)
  totalTalkDuration?: number; // Toplam konuşma süresi (seconds)
  inboundAvgTalkTime?: number; // gelen çağrı ort konuşma süresi (seconds)
  netProductivity?: number; // net verimlilik (%)
  breakDuration?: number; // Mola (seconds)
  lunchDuration?: number; // yemek (seconds)
  meetingDuration?: number; // toplantı (seconds)
  trainingDuration?: number; // eğitim (seconds)
  rawKPIValues?: Record<string, any>; // direct mapping from Excel row 1 headers
  isDetailRecord?: boolean; // indicates call-level record from sheet 2
}

export interface ExcelSheetPreview {
  sheetName: string;
  data: any[][];
  headers: string[];
  headerRowIndex: number;
}

export interface CallCenterHourlyMetric {
  date: string;
  timeSlot: string; // "09-00 - 10-00"
  totalCalls: number;
  answeredCalls: number;
  shortCalls: number;
  missedCalls: number;
  answeredInSL: number;
  serviceLevel1: number; // percentage (e.g. 100.0)
  serviceLevel2: number;
  aht: number; // seconds
  answerRate: number; // percentage
  holdCount: number;
  avgTalkTime: number; // seconds
  totalTalkDuration: number; // seconds
  waitDuration: number;
  avgWaitDuration: number;
  outboundAttempts: number;
  outboundCalls: number;
  outboundAnswerRate: number;
  outboundDuration: number;
  outboundAvgTalkTime: number;
  localHangup: number;
  ringDuration: number;
  holdDuration: number;
  acwDuration: number;
  wrapUpDuration: number;
  dequeue: number;
  speedOfAnswer: number;
  maxWaitTime: number;
  outboundLocalHangup: number;
  // Raw Excel sheet level statistics for 1:1 Excel formula parity
  rawSheetStats?: {
    columnNHeader: string;
    columnSHeader: string;
    columnNSum: number;
    columnNCount: number;
    columnNAvg: number;
    columnSSum: number;
    columnSCount: number;
    totalDataRows: number;
    sheetName: string;
    columnLHeader?: string;
    columnLAvg?: number;
    columnLSum?: number;
    columnLCount?: number;
    first10Rows?: Array<{
      rowNum: number;
      cellAddress: string;
      rawExcelValue: any;
      rawFormattedText: string;
      parsedValue: number;
      columnHeader: string;
    }>;
    first10RowsS?: Array<{
      rowNum: number;
      cellAddress: string;
      rawExcelValue: any;
      rawFormattedText: string;
      parsedValue: number;
      columnHeader: string;
    }>;
  };
}

export interface StaffKPIData {
  staffId: string;
  totalHandled: number;
  workDaysCount?: number;
  solvedCount: number;
  openCount: number;
  serviceCount: number;
  webchatCount: number;
  l2Escalations: number;
  ahtAvg: number; // in seconds
  fcrRate: number; // First Contact Resolution %
  resolutionRate: number; // %
  customerSatisfaction: number; // Score out of 100
  slAdherenceRate: number; // %
  holdTimeAvg: number; // seconds
  acwAvg: number; // seconds
  overallScore: number; // 0 - 100
  hourlyDistribution: { hour: string; count: number; aht: number }[];
  categoryBreakdown: { name: string; count: number; percentage: number }[];
  problemBreakdown: { name: string; count: number }[];
  callStatusBreakdown?: { name: string; count: number; percentage?: number }[];
  brandBreakdown: { name: string; count: number }[];
  positiveDevelopments: string[];
  negativeAlerts: string[];
  smartRecommendations: {
    category: 'speed' | 'quality' | 'resolution' | 'product_knowledge';
    title: string;
    description: string;
    impact?: 'high' | 'medium' | 'low';
  }[];
  // User-requested aggregated KPI fields
  answeredCallsTotal?: number;
  totalOfferedCalls?: number;
  totalTalkDurationSec?: number;
  inboundAvgTalkTimeSec?: number;
  netProductivityAvg?: number;
  breakDurationSec?: number;
  lunchDurationSec?: number;
  meetingDurationSec?: number;
  trainingDurationSec?: number;
  avgBreakDurationSec?: number;
  avgLunchDurationSec?: number;
  avgMeetingDurationSec?: number;
  avgTrainingDurationSec?: number;
}

export interface ExcelImportResult {
  success: boolean;
  data?: CallRecord[];
  sheetNames?: string[];
  totalRows?: number;
  detectedCreators?: string[];
  detectedHeaders?: string[];
  error?: string;
}

export interface CloudBackupData {
  lastSync: string;
  status: 'synced' | 'syncing' | 'offline';
  encryptedHash: string;
  dataVersion: string;
}

export interface CacheTelemetry {
  hitCount: number;
  missCount: number;
  memorySizeKb: number;
  lastOptimized: string;
}
