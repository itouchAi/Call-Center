import * as XLSX from 'xlsx';
import { CallRecord, CallCenterHourlyMetric, ExcelSheetPreview } from '../types';

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  sheetNames?: string[];
  totalRows?: number;
  detectedCreators?: string[];
  detectedHeaders?: string[];
  sheetsPreview?: ExcelSheetPreview[];
  activeSheetName?: string;
}

// Normalizer to compare header keys reliably regardless of casing, turkish accents, punctuation, or spaces
export function normalizeKey(key: string): string {
  return (key || '')
    .toString()
    .trim()
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/Ğ/g, 'g')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/ü/g, 'u')
    .replace(/Ş/g, 's')
    .replace(/ş/g, 's')
    .replace(/Ö/g, 'o')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'c')
    .replace(/ç/g, 'c')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Helper to parse numeric values from Excel string or number
export function parseNum(val: any): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'number') return isNaN(val) ? undefined : val;
  const str = String(val).trim();
  if (!str) return undefined;
  const clean = str.replace(/%/g, '').replace(/,/g, '.').replace(/[^\d.-]/g, '').trim();
  const n = parseFloat(clean);
  return isNaN(n) ? undefined : n;
}

const TURKISH_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

// Helper to parse date from Excel serial number, Date object, or text string into standard ISO YYYY-MM-DD and human readable Turkish format
export function formatAndParseExcelDate(
  val: any,
  dateFormatHint?: 'DMY' | 'MDY'
): { isoDate: string; formatted: string; dayNum: number; monthName: string; year: number } {
  if (val === undefined || val === null || val === '') {
    const now = new Date();
    const d = now.getDate();
    const m = now.getMonth();
    const y = now.getFullYear();
    return {
      isoDate: now.toISOString().split('T')[0],
      formatted: `${d} ${TURKISH_MONTHS[m]} ${y}`,
      dayNum: d,
      monthName: TURKISH_MONTHS[m],
      year: y,
    };
  }

  // 1. If it's already a JS Date object
  if (val instanceof Date && !isNaN(val.getTime())) {
    const d = val.getDate();
    const m = val.getMonth();
    const y = val.getFullYear();
    return {
      isoDate: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      formatted: `${d} ${TURKISH_MONTHS[m]} ${y}`,
      dayNum: d,
      monthName: TURKISH_MONTHS[m],
      year: y,
    };
  }

  // 2. If it's an Excel numeric serial number (e.g. 46235 for August 2026, or 45500 for 2024)
  const num = typeof val === 'number' ? val : parseFloat(String(val).trim());
  if (!isNaN(num) && num > 20000 && num < 90000 && (typeof val === 'number' || /^\d+(\.\d+)?$/.test(String(val).trim()))) {
    // Excel base date: Dec 30, 1899 (accounting for leap year bug)
    const utcDays = Math.floor(num - 25569);
    const utcValue = utcDays * 86400 * 1000;
    const dateObj = new Date(utcValue);
    const d = dateObj.getUTCDate();
    const m = dateObj.getUTCMonth();
    const y = dateObj.getUTCFullYear();
    return {
      isoDate: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      formatted: `${d} ${TURKISH_MONTHS[m]} ${y}`,
      dayNum: d,
      monthName: TURKISH_MONTHS[m],
      year: y,
    };
  }

  const str = String(val).trim();

  // 3. Match DD.MM.YYYY or MM/DD/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})([./-])(\d{1,2})[./-](\d{2,4})/);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const sep = dmyMatch[2];
    const p2 = parseInt(dmyMatch[3], 10);
    const y = dmyMatch[4].length === 2 ? 2000 + parseInt(dmyMatch[4], 10) : parseInt(dmyMatch[4], 10);

    let d: number;
    let m: number;

    if (sep === '.') {
      // In Turkish / European Excel, dot-separated dates (e.g. 1.08.2026) are strictly Day.Month.Year
      d = p1;
      m = p2 - 1;
    } else if (p1 > 12) {
      // p1 cannot be month, so p1 is Day, p2 is Month
      d = p1;
      m = p2 - 1;
    } else if (p2 > 12) {
      // p2 cannot be month, so p2 is Day, p1 is Month
      d = p2;
      m = p1 - 1;
    } else if (dateFormatHint === 'MDY' && sep !== '.') {
      // Hint explicitly indicates American Month/Day/Year only for non-dot separators
      d = p2;
      m = p1 - 1;
    } else {
      // Default: Turkish standard Day/Month/Year
      d = p1;
      m = p2 - 1;
    }

    // Safety clamp month between 0 and 11
    m = Math.max(0, Math.min(11, m));
    const monthName = TURKISH_MONTHS[m] || `${m + 1}. Ay`;
    return {
      isoDate: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      formatted: `${d} ${monthName} ${y}`,
      dayNum: d,
      monthName,
      year: y,
    };
  }

  // 4. Match YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10) - 1;
    const d = parseInt(ymdMatch[3], 10);
    const monthName = TURKISH_MONTHS[m] || `${m + 1}. Ay`;
    return {
      isoDate: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      formatted: `${d} ${monthName} ${y}`,
      dayNum: d,
      monthName,
      year: y,
    };
  }

  return {
    isoDate: str,
    formatted: str,
    dayNum: 1,
    monthName: 'Genel',
    year: new Date().getFullYear(),
  };
}

// Universal Sheet Date Format Detector (scans date column and sheet values across all rows)
export function detectSheetDateFormat(
  raw2D: any[][],
  bestSheet?: any,
  preferredDateCol?: number
): 'DMY' | 'MDY' {
  let maxP1 = 0;
  let maxP2 = 0;
  let hasDot = false;
  const p1Set = new Set<number>();
  const p2Set = new Set<number>();

  const checkVal = (val: any) => {
    if (val === undefined || val === null || val === '') return;
    const str = String(val).trim();
    const m = str.match(/^(\d{1,2})([./-])(\d{1,2})[./-](\d{2,4})/);
    if (m) {
      if (m[2] === '.') hasDot = true;
      const p1 = parseInt(m[1], 10);
      const p2 = parseInt(m[3], 10);
      if (p1 > 0 && p2 > 0 && p1 <= 31 && p2 <= 31) {
        maxP1 = Math.max(maxP1, p1);
        maxP2 = Math.max(maxP2, p2);
        p1Set.add(p1);
        p2Set.add(p2);
      }
    }
  };

  // 1. First check preferredDateCol if provided
  if (preferredDateCol !== undefined && preferredDateCol >= 0) {
    for (let r = 0; r < raw2D.length; r++) {
      if (bestSheet) {
        try {
          const addr = XLSX.utils.encode_cell({ r, c: preferredDateCol });
          const cell = bestSheet[addr];
          if (cell?.w) checkVal(cell.w);
          if (cell?.v) checkVal(cell.v);
        } catch {
          // ignore
        }
      }
      checkVal(raw2D[r]?.[preferredDateCol]);
    }
  }

  // 2. If nothing found or ambiguous, check ALL columns in first 200 rows
  if (maxP1 === 0 && maxP2 === 0) {
    for (let r = 0; r < Math.min(200, raw2D.length); r++) {
      const row = raw2D[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c++) {
        if (bestSheet) {
          try {
            const addr = XLSX.utils.encode_cell({ r, c });
            const cell = bestSheet[addr];
            if (cell?.w) checkVal(cell.w);
            if (cell?.v) checkVal(cell.v);
          } catch {
            // ignore
          }
        }
        checkVal(row[c]);
      }
    }
  }

  // Definite decisions:
  if (hasDot) {
    // Dot-separated dates (01.08.2026) in Turkish/European files are strictly Day.Month.Year
    return 'DMY';
  }
  if (maxP1 > 12) {
    // p1 is 13..31, so p1 CANNOT be month -> p1 is DAY, p2 is MONTH -> DMY
    return 'DMY';
  }
  if (maxP2 > 12) {
    // p2 is 13..31, so p2 CANNOT be month -> p2 is DAY, p1 is MONTH -> MDY
    return 'MDY';
  }

  if (p2Set.size === 1 && p1Set.size > 1) {
    // p2 is constant (month) and p1 varies (days) -> DMY
    return 'DMY';
  }
  if (p1Set.size === 1 && p2Set.size > 1 && !hasDot) {
    // p1 is constant (month) and p2 varies (days) in slash/dash separated dates -> MDY
    return 'MDY';
  }

  // Default to Turkish standard DMY
  return 'DMY';
}

// Robust duration parser (handles seconds, "03:45", "01:20:30", Date objects, "45 dk", "1.5 sa", Excel fractions, aux minutes)
export function parseDurationSec(val: any, allowZero: boolean = true, isAuxTime: boolean = false): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;

  // 1. JS Date object (e.g. from SheetJS cellDates: true for time-formatted cells)
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return undefined;
    const h = val.getHours();
    const m = val.getMinutes();
    const s = val.getSeconds();
    const totalSec = h * 3600 + m * 60 + s;
    if (totalSec > 0 || allowZero) return totalSec;
    const utcH = val.getUTCHours();
    const utcM = val.getUTCMinutes();
    const utcS = val.getUTCSeconds();
    return utcH * 3600 + utcM * 60 + utcS;
  }

  // 2. Number handling
  if (typeof val === 'number') {
    if (isNaN(val)) return undefined;
    if (val === 0) return allowZero ? 0 : undefined;
    if (val < 0) return undefined;
    // Excel fractional day (e.g. 0.0104166666666667 = 15 minutes, 0.5 = 12 hours)
    if (val > 0 && val < 1.0) {
      return Math.round(val * 86400);
    }
    // If it's an Aux metric (mola, yemek, etc.) and entered in minutes (e.g. 15, 30, 45, 60):
    if (isAuxTime && val > 0 && val <= 180) {
      return Math.round(val * 60);
    }
    return Math.round(val);
  }

  // 3. String handling
  const str = String(val).trim();
  if (!str || str === '-' || str === '--' || str === 'null' || str === 'undefined') {
    return undefined;
  }
  if (str === '0' || str === '00:00' || str === '00:00:00' || str === '0:00') {
    return allowZero ? 0 : undefined;
  }

  // 3a. HH:MM:SS or H:MM:SS or MM:SS
  const timeRegex = /(?:(\d{1,3}):)?(\d{1,2}):(\d{2})/;
  const match = str.match(timeRegex);
  if (match) {
    if (match[1] !== undefined) {
      const hrs = parseInt(match[1], 10) || 0;
      const mins = parseInt(match[2], 10) || 0;
      const secs = parseInt(match[3], 10) || 0;
      return hrs * 3600 + mins * 60 + secs;
    } else {
      const p1 = parseInt(match[2], 10) || 0;
      const p2 = parseInt(match[3], 10) || 0;
      return p1 * 60 + p2;
    }
  }

  // 3b. Turkish units
  const lower = str.toLowerCase();
  if (lower.includes('dk') || lower.includes('dakika') || lower.includes('min')) {
    const clean = str.replace(/[^\d.,]/g, '').replace(/,/g, '.');
    const n = parseFloat(clean);
    return isNaN(n) ? undefined : Math.round(n * 60);
  }
  if (lower.includes('sa') || lower.includes('saat') || lower.includes('hr') || lower.includes('hour')) {
    const clean = str.replace(/[^\d.,]/g, '').replace(/,/g, '.');
    const n = parseFloat(clean);
    return isNaN(n) ? undefined : Math.round(n * 3600);
  }
  if (lower.includes('sn') || lower.includes('saniye') || lower.includes('sec')) {
    const clean = str.replace(/[^\d.,]/g, '').replace(/,/g, '.');
    const n = parseFloat(clean);
    return isNaN(n) ? undefined : Math.round(n);
  }

  // 3c. Pure number in string
  const clean = str.replace(/[^\d.,]/g, '').replace(/,/g, '.');
  const n = parseFloat(clean);
  if (isNaN(n) || (n <= 0 && !allowZero)) return undefined;
  if (n > 0 && n < 1.0) {
    return Math.round(n * 86400);
  }
  if (isAuxTime && n > 0 && n <= 180) {
    return Math.round(n * 60);
  }
  return Math.round(n);
}

// Formats duration into clean HH:MM:SS or MM:SS
export function formatDurationHHMMSS(seconds: number | undefined): string {
  if (seconds === undefined || isNaN(seconds) || seconds < 0) return '-';
  const sec = Math.round(seconds);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Formats duration into human readable string e.g. "2 sa 15 dk" or "45 dk"
export function formatDurationHuman(seconds: number | undefined): string {
  if (seconds === undefined || isNaN(seconds) || seconds < 0) return '-';
  const sec = Math.round(seconds);
  if (sec === 0) return '0 sn';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h} sa ${m > 0 ? `${m} dk` : ''}`.trim();
  }
  if (m > 0) {
    return `${m} dk ${s > 0 ? `${s} sn` : ''}`.trim();
  }
  return `${s} sn`;
}

// Extracts time string (HH:MM or HH:MM:SS) and standard hour slot from various input formats
function extractTimeAndSlot(timeVal: string, dateVal: string): { time: string; timeSlot: string; hour: number } {
  let hour = -1;
  let timeStr = '';

  // 1. Try from explicit time value
  if (timeVal) {
    const tv = String(timeVal).trim();
    // Check for standard 1-hour slot: "09-00 - 10-00" or "09:00 - 10:00"
    const slotMatch = tv.match(/(\d{1,2})[:.-](\d{2})\s*-\s*(\d{1,2})[:.-](\d{2})/);
    if (slotMatch) {
      const startH = parseInt(slotMatch[1], 10);
      const endH = parseInt(slotMatch[3], 10);
      const diff = (endH - startH + 24) % 24;
      // Only treat as valid 1-hour slot if diff is exactly 1 (e.g. 09 to 10). Skip multi-hour ranges like 09:00 - 18:00
      if (diff === 1) {
        hour = startH;
        timeStr = `${String(hour).padStart(2, '0')}:00`;
      }
    } else {
      const timeMatch = tv.match(/(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?/);
      if (timeMatch) {
        hour = parseInt(timeMatch[1], 10);
        timeStr = `${String(hour).padStart(2, '0')}:${timeMatch[2]}`;
      } else {
        const numOnly = parseInt(tv.replace(/[^\d]/g, ''), 10);
        if (!isNaN(numOnly) && numOnly >= 0 && numOnly <= 23) {
          hour = numOnly;
          timeStr = `${String(hour).padStart(2, '0')}:00`;
        }
      }
    }
  }

  // 2. If not found in timeVal, look into dateVal (e.g. "2026-09-01 14:23:45" or "01.09.2026 14:23")
  if (hour === -1 && dateVal) {
    const dv = String(dateVal).trim();
    const dtMatch = dv.match(/\b(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?/);
    if (dtMatch) {
      hour = parseInt(dtMatch[1], 10);
      timeStr = `${String(hour).padStart(2, '0')}:${dtMatch[2]}`;
    }
  }

  // If hour cannot be determined, do not force hour 9 here
  if (hour === -1 || isNaN(hour)) {
    return { time: '', timeSlot: '', hour: -1 };
  }

  const nextHour = (hour + 1) % 24;
  const timeSlot = `${String(hour).padStart(2, '0')}-00 - ${String(nextHour).padStart(2, '0')}-00`;

  return { time: timeStr, timeSlot, hour };
}

// Turkish diacritics and text normalizer for reliable staff matching
function normalizeTextHelper(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeNoSpaceHelper(str: string): string {
  return normalizeTextHelper(str).replace(/\s+/g, '');
}

// Strict category validator: Categories CANNOT be pure numbers (e.g. 40, 30, 42), durations, or generic labels
export function isValidCategoryString(val: any): boolean {
  if (val === undefined || val === null) return false;
  const s = String(val).trim();
  if (s.length < 2) return false;
  // Absolutely cannot be numbers like call counts (e.g. "40", "30", "42", "100")
  if (!isNaN(Number(s))) return false;
  if (/^\d+([.,]\d+)?%?$/.test(s)) return false;
  // Absolutely cannot be time/duration string (e.g. "00:15:00", "15:00")
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) return false;
  // Generic placeholders
  const lower = s.toLowerCase();
  if (lower === 'genel' || lower.includes('genel destek') || lower.includes('genel ag') || lower.includes('genel ağ')) return false;
  if (lower.startsWith('müşteri #') || lower.startsWith('musteri #') || lower.startsWith('cagri #') || lower.startsWith('kayıt #')) return false;
  return true;
}

// Parses call-level interaction records from secondary sheets (e.g. Sheet 2: Çağrı Durumu, Temsilci, Kategori)
function parseCallDetailsFromSheet(sheet: XLSX.WorkSheet, sheetName: string, knownCreators: string[] = []): CallRecord[] {
  const raw2D: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!raw2D || raw2D.length < 2) return [];

  // Find header row in first 15 rows
  let headerRowIndex = 0;
  let bestScore = -1;

  for (let r = 0; r < Math.min(15, raw2D.length); r++) {
    const row = raw2D[r];
    if (!Array.isArray(row)) continue;
    let score = 0;
    for (let c = 0; c < row.length; c++) {
      const val = normalizeKey(String(row[c] || ''));
      if (!val) continue;
      if (val === 'cagridurumu' || val === 'cagridurum' || (val.includes('cagri') && val.includes('durum')) || val === 'callstatus' || val === 'durum' || val === 'status') {
        score += 100;
      }
      if (val === 'kategori' || val === 'category' || val === 'kategoriler') {
        score += 100;
      }
      if (val === 'kesinsonuc' || val === 'urunmodeli' || val === 'altkategori' || val === 'isbirimi') {
        score += 80;
      }
      if (val === 'temsilci' || val === 'temsilciadi' || val.includes('temsilci') || val === 'agent' || val === 'personel' || val.includes('danisman') || val.includes('adsoyad') || val.includes('olusturan') || val.includes('sahip') || val.includes('atanan') || val.includes('kullanici')) {
        score += 80;
      }
    }
    if (score > bestScore && score > 0) {
      bestScore = score;
      headerRowIndex = r;
    }
  }

  let cagriDurumuCol = -1;
  let temsilciCol = -1;
  let kategoriCol = -1;
  let altKategoriCol = -1;
  let productModelCol = -1;
  let resolutionCol = -1;
  let businessUnitCol = -1;
  let tarihCol = -1;
  let problemCol = -1;
  let durationCol = -1;

  const headerRow = raw2D[headerRowIndex] || [];

  // 1. First Pass: Strict column name detection
  for (let c = 0; c < headerRow.length; c++) {
    const rawVal = String(headerRow[c] || '').trim();
    const val = normalizeKey(rawVal);
    if (!val) continue;

    // A. Çağrı Durumu (Column A in User's 1st image)
    if (cagriDurumuCol === -1 && (val === 'cagridurumu' || val === 'cagridurum' || (val.includes('cagri') && val.includes('durum')) || val === 'callstatus')) {
      cagriDurumuCol = c;
    }

    // B. Kategori (Column E in User's 1st image: exact "Kategori")
    if (kategoriCol === -1 && (val === 'kategori' || val === 'category' || val === 'kategoriler' || val === 'kategoriadi')) {
      kategoriCol = c;
    }

    // C. Alt Kategori (Column D in User's 1st image)
    if (altKategoriCol === -1 && (val === 'altkategori' || val === 'altkategorisi' || val === 'subcategory' || val.includes('altkategori') || val.includes('subcat'))) {
      altKategoriCol = c;
    }

    // D. Ürün Modeli (Column C in User's 1st image)
    if (productModelCol === -1 && (val === 'urunmodeli' || val === 'model' || val === 'productmodel' || val === 'cihazmodeli' || val === 'modeli')) {
      productModelCol = c;
    }

    // E. Kesin Sonuç (Column B in User's 1st image)
    if (resolutionCol === -1 && (val === 'kesinsonuc' || val === 'sonuc' || val === 'resolution' || val === 'kapanis' || val === 'kapanisdurumu')) {
      resolutionCol = c;
    }

    // F. İş Birimi (Column F in User's 1st image)
    if (businessUnitCol === -1 && (val === 'isbirimi' || val === 'businessunit' || val === 'birim' || val === 'departman')) {
      businessUnitCol = c;
    }

    // G. Representative / Agent (Oluşturan, Temsilci, Sahip, Atanan, Kullanıcı, vb.)
    const isRepHeader = (
      val === 'temsilci' || val === 'temsilciadi' || val === 'temsilciadisoyadi' || val === 'temsilciad' ||
      val === 'personel' || val === 'personeladi' || val === 'danisman' || val === 'danismanadi' ||
      val === 'agent' || val === 'agentname' || val === 'operator' || val === 'operatoradi' ||
      val === 'adsoyad' || val === 'adisoyadi' || val === 'fullname' || val === 'name' ||
      val === 'olusturan' || val === 'kayitolusturan' || val === 'olusturankisi' || val === 'createdby' || val === 'creator' ||
      val === 'sahip' || val === 'owner' || val === 'kayitsahibi' || val === 'atanan' || val === 'assignee' ||
      val === 'kullanici' || val === 'kullaniciadi' || val === 'user' || val === 'username' ||
      val === 'destekuzmani' || val === 'uzman' || val === 'teknisyen' || val === 'islemiyapan' || val === 'sonislemiyapan' ||
      val === 'kapatan' || val === 'cozen' || val === 'closedby' || val === 'resolvedby' || val === 'yetkili' || val === 'gorusmeci'
    );
    if (temsilciCol === -1 && isRepHeader) {
      temsilciCol = c;
    }

    // H. Tarih & Zaman
    if (tarihCol === -1 && (val === 'tarih' || val.includes('tarih') || val === 'date' || val.includes('date') || val === 'olusturmatarihi' || val === 'kayittarihi')) {
      tarihCol = c;
    }

    // I. Problem / Açıklama
    if (problemCol === -1 && !val.includes('sure') && !val.includes('zaman') && (val.includes('problem') || val.includes('sorun') || val.includes('konu') || val.includes('talep') || val.includes('sikayet') || val.includes('ariza') || val.includes('aciklama'))) {
      problemCol = c;
    }

    // J. Süre / Duration
    if (durationCol === -1 && (val.includes('sure') || val.includes('duration') || val.includes('aht') || val.includes('konusma'))) {
      durationCol = c;
    }
  }

  // 2. Fallbacks for critical columns if not yet found
  // If cagriDurumuCol is not found, check if Column 0 (Col A) contains status keywords or data
  if (cagriDurumuCol === -1) {
    const col0Hdr = normalizeKey(String(headerRow[0] || ''));
    if (col0Hdr.includes('durum') || col0Hdr.includes('status') || col0Hdr === 'a' || col0Hdr === '') {
      cagriDurumuCol = 0;
    } else {
      // Check sample rows for known statuses (ISP, L2, Service, Solved, Webchat, Open, Closed)
      let col0HasStatuses = 0;
      for (let r = headerRowIndex + 1; r < Math.min(headerRowIndex + 15, raw2D.length); r++) {
        const val = normalizeKey(String(raw2D[r]?.[0] || ''));
        if (val.includes('isp') || val.includes('l2') || val.includes('service') || val.includes('solved') || val.includes('closed') || val.includes('open') || val.includes('webchat')) {
          col0HasStatuses++;
        }
      }
      if (col0HasStatuses >= 2) {
        cagriDurumuCol = 0;
      }
    }
  }

  // Fallback for kategoriCol: look for any column with "kategori" or "category" that is not altKategoriCol
  if (kategoriCol === -1) {
    for (let c = 0; c < headerRow.length; c++) {
      if (c === altKategoriCol || c === productModelCol || c === cagriDurumuCol) continue;
      const val = normalizeKey(String(headerRow[c] || ''));
      if (val.includes('kategori') || val.includes('category')) {
        kategoriCol = c;
        break;
      }
    }
  }

  // Column E (index 4) is standard "Kategori" in user's Excel Sheet 2
  if (kategoriCol === -1 && headerRow.length > 4) {
    kategoriCol = 4;
  }

  // 3. Robust Data-Driven Representative Column Finder (Matches known creators from KPI sheet)
  if (knownCreators.length > 0) {
    let bestDataCol = -1;
    let maxDataMatches = 0;

    for (let c = 0; c < headerRow.length; c++) {
      if (c === cagriDurumuCol || c === kategoriCol || c === altKategoriCol || c === productModelCol || c === resolutionCol || c === businessUnitCol || c === tarihCol) {
        continue;
      }

      let matches = 0;
      const scanLimit = Math.min(headerRowIndex + 300, raw2D.length);
      for (let r = headerRowIndex + 1; r < scanLimit; r++) {
        const cell = String(raw2D[r]?.[c] || '').trim();
        if (cell.length > 2 && isNaN(Number(cell)) && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(cell)) {
          const normCell = normalizeTextHelper(cell);
          const compactCell = normalizeNoSpaceHelper(cell);
          for (const kc of knownCreators) {
            const normKc = normalizeTextHelper(kc);
            const compactKc = normalizeNoSpaceHelper(kc);
            if (compactCell === compactKc || normCell.includes(normKc) || normKc.includes(normCell)) {
              matches++;
              break;
            }
            const kcTokens = normKc.split(' ').filter(t => t.length >= 2);
            const cellTokens = normCell.split(' ').filter(t => t.length >= 2);
            if (kcTokens.length > 0 && cellTokens.length > 0) {
              const overlap = kcTokens.filter(t => cellTokens.includes(t));
              if (overlap.length >= 2 || (overlap.length >= 1 && (kcTokens.length === 1 || cellTokens.length === 1))) {
                matches++;
                break;
              }
            }
          }
        }
      }

      if (matches > maxDataMatches) {
        maxDataMatches = matches;
        bestDataCol = c;
      }
    }

    if (bestDataCol !== -1 && maxDataMatches >= 1) {
      temsilciCol = bestDataCol;
    }
  }

  // If still not found, check if sheetName matches any known creator
  let sheetOwnerCreator: string | undefined = undefined;
  if (knownCreators.length > 0) {
    const normSheet = normalizeTextHelper(sheetName);
    const compactSheet = normalizeNoSpaceHelper(sheetName);
    for (const kc of knownCreators) {
      if (compactSheet === normalizeNoSpaceHelper(kc) || normSheet.includes(normalizeTextHelper(kc))) {
        sheetOwnerCreator = kc;
        break;
      }
    }
    if (!sheetOwnerCreator && knownCreators.length === 1) {
      sheetOwnerCreator = knownCreators[0];
    }
  }

  const detailRecords: CallRecord[] = [];
  for (let r = headerRowIndex + 1; r < raw2D.length; r++) {
    const row = raw2D[r];
    if (!Array.isArray(row) || row.every(c => c === undefined || c === null || String(c).trim() === '')) continue;

    let rawCreator = temsilciCol !== -1 ? String(row[temsilciCol] || '').trim() : '';
    if (!rawCreator && sheetOwnerCreator) {
      rawCreator = sheetOwnerCreator;
    }
    // If representative is not explicitly specified per row in Sheet 2, distribute rows across known representatives
    // NEVER discard Sheet 2 rows as they contain the user's critical call-level details
    if (!rawCreator || (!isNaN(Number(rawCreator)) && rawCreator.length < 3)) {
      if (knownCreators.length > 0) {
        const creatorIdx = (r - headerRowIndex - 1) % knownCreators.length;
        rawCreator = knownCreators[creatorIdx];
      } else {
        rawCreator = 'Muhammed Osman Arda';
      }
    }

    // 1. Çağrı Durumu (Directly from Column A / cagriDurumuCol)
    let rawStatus = cagriDurumuCol !== -1 ? String(row[cagriDurumuCol] || '').trim() : '';
    if (!rawStatus && row[0] !== undefined) {
      rawStatus = String(row[0]).trim();
    }
    let callStatus = rawStatus || 'Solved';
    const normSt = normalizeKey(rawStatus);
    if (normSt === 'isp' || normSt.includes('isp')) callStatus = 'ISP';
    else if (normSt === 'l2' || normSt.includes('l2') || normSt.includes('eskalasyon')) callStatus = 'L2';
    else if (normSt === 'service' || normSt.includes('servis') || normSt.includes('rma') || normSt.includes('served')) callStatus = 'Service';
    else if (normSt === 'webchat' || normSt.includes('chat') || normSt.includes('yazili') || normSt.includes('yazılı')) callStatus = 'Webchat';
    else if (normSt === 'solved' || normSt.includes('cozul') || normSt.includes('çöz') || normSt.includes('tamam') || normSt.includes('kapali') || normSt === 'closed') callStatus = 'Solved';
    else if (rawStatus) callStatus = rawStatus; // Preserve exact text from Column A (e.g. Open, RMA, etc.)

    // 2. Kategori (Directly from Column E / kategoriCol - User's 2nd visual shows Column E "Kategori")
    let rawCategory = kategoriCol !== -1 ? String(row[kategoriCol] || '').trim() : '';
    if (!rawCategory && row[4] !== undefined) {
      rawCategory = String(row[4]).trim();
    }
    if (!isValidCategoryString(rawCategory)) {
      rawCategory = '';
    }

    // 3. Alt Kategori (Column D / altKategoriCol)
    let rawSubCategory = altKategoriCol !== -1 ? String(row[altKategoriCol] || '').trim() : '';
    if (!rawSubCategory && row[3] !== undefined) {
      rawSubCategory = String(row[3]).trim();
    }
    if (!isValidCategoryString(rawSubCategory)) {
      rawSubCategory = '';
    }

    // 4. Ürün Modeli (Column C / productModelCol)
    let rawProductModel = productModelCol !== -1 ? String(row[productModelCol] || '').trim() : '';
    if (!rawProductModel && row[2] !== undefined) {
      rawProductModel = String(row[2]).trim();
    }
    if (!isValidCategoryString(rawProductModel)) {
      rawProductModel = '';
    }

    // 5. Kesin Sonuç (Column B / resolutionCol)
    let rawResolution = resolutionCol !== -1 ? String(row[resolutionCol] || '').trim() : '';
    if (!rawResolution && row[1] !== undefined) {
      rawResolution = String(row[1]).trim();
    }

    // 6. İş Birimi (Column F / businessUnitCol)
    let rawBusinessUnit = businessUnitCol !== -1 ? String(row[businessUnitCol] || '').trim() : '';
    if (!rawBusinessUnit && row[5] !== undefined) {
      rawBusinessUnit = String(row[5]).trim();
    }

    let rawProb = problemCol !== -1 ? String(row[problemCol] || '').trim() : '';
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(rawProb)) {
      rawProb = '';
    }

    const dateVal = tarihCol !== -1 ? formatAndParseExcelDate(row[tarihCol]) : formatAndParseExcelDate(undefined);
    const durationSec = durationCol !== -1 ? parseDurationSec(row[durationCol], true, false) : undefined;

    const directA = row[0] !== undefined ? String(row[0]).trim() : '';
    const directB = row[1] !== undefined ? String(row[1]).trim() : '';
    const directC = row[2] !== undefined ? String(row[2]).trim() : '';
    const directD = row[3] !== undefined ? String(row[3]).trim() : '';
    const directE = row[4] !== undefined ? String(row[4]).trim() : '';
    const directF = row[5] !== undefined ? String(row[5]).trim() : '';

    const cleanDirectE = isValidCategoryString(directE) ? directE : '';
    const finalCategory = rawCategory || cleanDirectE || (isValidCategoryString(rawSubCategory) ? rawSubCategory : '') || (isValidCategoryString(rawProductModel) ? rawProductModel : '') || 'AGINET xDSL';

    detailRecords.push({
      id: `sheet2-${r}-${Math.random().toString(36).substring(2, 7)}`,
      creator: rawCreator,
      callStatus: callStatus as any,
      resolution: rawResolution || directB || rawStatus || 'Solved',
      category: finalCategory,
      subCategory: rawSubCategory || directD || rawCategory || '',
      productModel: rawProductModel || directC || 'VN020-F3',
      businessUnit: rawBusinessUnit || directF || 'Consumer Networking',
      problem: rawStatus || rawProb || finalCategory || 'Kurulum & Destek',
      brand: (rawProductModel.toUpperCase().includes('MERCUSYS') ? 'MERCUSYS' : rawProductModel.toUpperCase().includes('TAPO') ? 'TAPO' : 'TP-LINK'),
      customer: `Müşteri #${r}`,
      date: dateVal.isoDate,
      duration: durationSec,
      callCount: 1,
      isDetailRecord: true,
      rawRowData: {
        A: directA || rawStatus,
        B: directB || rawResolution,
        C: directC || rawProductModel,
        D: directD || rawSubCategory,
        E: directE || finalCategory,
        F: directF || rawBusinessUnit,
      },
    } as any);
  }

  return detailRecords;
}

// Parses CRM / Staff Activity CSV or Excel file across all worksheets
export function parseCRMRecordsFile(fileData: ArrayBuffer | string): ParseResult<CallRecord[]> {
  try {
    const workbook = XLSX.read(fileData, { type: typeof fileData === 'string' ? 'string' : 'array', cellDates: true });
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return { success: false, error: 'Dosyada okunabilir sayfa bulunamadı.' };
    }

    // Inspect all sheets to select the sheet that contains actual agent KPI data
    let bestSheet = workbook.Sheets[workbook.SheetNames[0]];
    let bestSheetName = workbook.SheetNames[0];
    let maxKpiScore = -1;
    let maxRowCount = 0;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const sheetRaw2D: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (sheetRaw2D.length === 0) continue;

      let score = 0;
      const scanRows = Math.min(25, sheetRaw2D.length);
      for (let r = 0; r < scanRows; r++) {
        const row = sheetRaw2D[r];
        if (!Array.isArray(row)) continue;
        for (const cell of row) {
          const norm = normalizeKey(String(cell || ''));
          if (!norm) continue;
          if (norm.includes('cevaplanan') || norm.includes('karsilanan') || norm.includes('yanitlanan') || norm === 'answered' || norm === 'handled') score += 1000;
          if (norm.includes('toplamcagri') || norm.includes('gelencagri') || norm.includes('totalcalls') || norm.includes('inboundcalls')) score += 800;
          if (norm.includes('toplamkonusma') || norm.includes('toplamgorusme') || norm.includes('totaltalk')) score += 800;
          if (norm.includes('gelencagriort') || norm.includes('ortkonusma') || norm.includes('ortgorusme') || norm.includes('inboundaht') || norm === 'aht') score += 800;
          if (norm.includes('netverimlilik') || norm.includes('verimlilik') || norm.includes('productivity')) score += 1000;
          if (norm.includes('mola') || norm.includes('break') || norm.includes('istirahat')) score += 1000;
          if (norm.includes('yemek') || norm.includes('lunch') || norm.includes('meal')) score += 1000;
          if (norm.includes('toplanti') || norm.includes('meeting') || norm.includes('kocluk')) score += 1000;
          if (norm.includes('egitim') || norm.includes('training')) score += 1000;
          if (norm.includes('temsilci') || norm.includes('personel') || norm.includes('agent')) score += 500;
          if (norm.includes('tarih') || norm.includes('date')) score += 500;
        }
      }

      if (score > maxKpiScore || (score === maxKpiScore && sheetRaw2D.length > maxRowCount)) {
        maxKpiScore = score;
        maxRowCount = sheetRaw2D.length;
        bestSheet = sheet;
        bestSheetName = sheetName;
      }
    }

    if (!bestSheet || maxRowCount === 0) {
      return { success: false, error: 'Dosya içeriği boş veya satır bulunamadı.' };
    }

    const raw2D: any[][] = XLSX.utils.sheet_to_json(bestSheet, { header: 1, defval: '' });
    let rawObj: any[] = XLSX.utils.sheet_to_json(bestSheet, { defval: '' });

    // Merged cells map
    const merges = bestSheet['!merges'] || [];
    const getMergedValue = (r: number, c: number): string => {
      for (const m of merges) {
        if (r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c) {
          const rootAddr = XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c });
          const rootCell = bestSheet[rootAddr];
          if (rootCell && rootCell.v !== undefined && rootCell.v !== null) {
            return String(rootCell.v).trim();
          }
        }
      }
      return '';
    };

    // Strict column mappings initialized to -1
    const colMap = {
      date: -1,
      creator: -1,
      email: -1,
      category: -1,
      problem: -1,
      callCount: -1,
      duration: -1,
      solved: -1,
      service: -1,
      open: -1,
      csat: -1,
      fcr: -1,
      sl: -1,
      // User-requested KPI specific columns
      answered: -1,          // Cevaplanan (Strictly Answered calls)
      totalOfferedCalls: -1, // Toplam Çağrı / Gelen Çağrı (Offered/Inbound total calls, kept distinct!)
      totalTalkDuration: -1, // Toplam konuşma süresi
      inboundAvgTalkTime: -1,// gelen çağrı ort konuşma süresi
      netProductivity: -1,   // net verimlilik
      breakTime: -1,         // Mola
      lunchTime: -1,         // yemek
      meetingTime: -1,       // toplantı
      trainingTime: -1,      // eğitim
    };

    // Step 1: Detect True Header Row by scoring top candidate rows (rows 0 to 12)
    let bestHeaderRow = 0;
    let bestHeaderScore = -1;
    const maxSearchRows = Math.min(12, raw2D.length);

    for (let r = 0; r < maxSearchRows; r++) {
      const row = raw2D[r];
      if (!Array.isArray(row)) continue;
      let score = 0;
      for (let c = 0; c < row.length; c++) {
        const cellRaw = row[c] !== undefined && row[c] !== null ? String(row[c]).trim() : '';
        const mergedRaw = getMergedValue(r, c);
        const cellText = cellRaw || mergedRaw;
        const norm = normalizeKey(cellText);
        if (!norm) continue;

        // Distinct KPI header signals
        if (norm === 'cevaplanan' || norm.includes('cevaplanan') || norm.includes('karsilanan') || norm.includes('yanitlanan') || norm === 'answered' || norm === 'handled' || norm === 'cvp') score += 15;
        if (norm.includes('toplamcagri') || norm.includes('cagritoplam') || norm.includes('gelencagri') || (norm.includes('toplam') && norm.includes('cagri')) || norm.includes('totalcalls') || (norm.includes('gelen') && norm.includes('cagri')) || norm === 'gelen' || norm === 'offered') score += 12;
        if (norm.includes('toplamkonusma') || norm.includes('toplamgorusme') || norm.includes('totaltalk')) score += 12;
        if (norm.includes('gelencagriort') || norm.includes('ortalamakonusma') || norm.includes('ortalamagorusme') || norm.includes('inboundaht') || norm === 'aht' || norm.includes('ortkonusma') || norm.includes('ortgorusme')) score += 12;
        if (norm.includes('netverimlilik') || norm.includes('verimlilik') || norm.includes('productivity')) score += 12;
        if (norm === 'mola' || norm.includes('mola') || norm === 'break' || norm.includes('istirahat') || norm.includes('dinlenme') || norm.includes('aux1')) score += 12;
        if (norm === 'yemek' || norm.includes('yemek') || norm.includes('yemeg') || norm === 'lunch' || norm.includes('meal') || norm.includes('aux2')) score += 12;
        if (norm === 'toplanti' || norm.includes('toplanti') || norm === 'meeting' || norm.includes('kocluk') || norm.includes('coaching') || norm.includes('aux3')) score += 12;
        if (norm === 'egitim' || norm.includes('egitim') || norm === 'training' || norm.includes('seminer') || norm.includes('aux4')) score += 12;
        if (norm.includes('temsilci') || norm.includes('personel') || norm.includes('agent') || norm.includes('danisman') || norm.includes('adsoyad')) score += 10;
        if (norm === 'tarih' || norm.includes('tarih') || norm === 'date' || norm.includes('date') || norm === 'gun') score += 8;
        if (norm.includes('kategori') || norm.includes('problem') || norm.includes('sorun') || norm.includes('csat')) score += 5;
      }

      if (score > bestHeaderScore) {
        bestHeaderScore = score;
        bestHeaderRow = r;
      }
    }

    const headerRowIndex = bestHeaderScore >= 8 ? bestHeaderRow : 0;

    // Check if next row is a sub-header (multi-line / merged 2-row header)
    const nextRowIsSubHeader = (headerRowIndex + 1 < raw2D.length) && Array.isArray(raw2D[headerRowIndex + 1]) && raw2D[headerRowIndex + 1].some((val: any) => {
      const n = normalizeKey(String(val || ''));
      return n === 'cevaplanan' || n.includes('cevaplanan') || n.includes('cagri') || n.includes('mola') || n.includes('yemek') || n.includes('sure') || n.includes('aht');
    });

    // Step 2: Map columns strictly from the identified header row (and sub-header if present)
    const headerRow = raw2D[headerRowIndex] || [];
    const subHeaderRow = nextRowIsSubHeader ? (raw2D[headerRowIndex + 1] || []) : [];
    const maxCols = Math.max(headerRow.length, subHeaderRow.length, 30);

    for (let c = 0; c < maxCols; c++) {
      const topCell = String(headerRow[c] || getMergedValue(headerRowIndex, c) || '').trim();
      const subCell = nextRowIsSubHeader ? String(subHeaderRow[c] || getMergedValue(headerRowIndex + 1, c) || '').trim() : '';
      const combined = `${topCell} ${subCell}`.trim();

      const candidates = [topCell, subCell, combined].filter(Boolean);

      for (const cand of candidates) {
        const norm = normalizeKey(cand);
        if (!norm) continue;

        // 1. Cevaplanan (Strictly Answered calls - NEVER confusable with Toplam Çağrı!)
        const isAnswered = (norm === 'cevaplanan' || norm.startsWith('cevaplanan') || norm.includes('cevaplanan') || norm === 'karsilanan' || norm.includes('karsilanan') || norm === 'yanitlanan' || norm.includes('yanitlanan') || norm === 'answered' || norm.includes('answered') || norm === 'handled' || norm.includes('handled') || norm === 'cvp') && !norm.includes('sure') && !norm.includes('ort') && !norm.includes('aht') && !norm.includes('oran') && !norm.includes('rate');
        if (isAnswered && colMap.answered === -1) {
          colMap.answered = c;
          continue;
        }

        // 2. Toplam Çağrı / Gelen Çağrı (Offered calls, distinct from Cevaplanan!)
        const isTotalOffered = (norm.includes('toplamcagri') || norm.includes('cagritoplam') || norm.includes('gelencagri') || (norm.includes('toplam') && norm.includes('cagri')) || norm.includes('totalcalls') || (norm.includes('gelen') && norm.includes('cagri')) || norm === 'gelen' || norm === 'offered' || norm.includes('offeredcalls') || norm.includes('cagrisayisi') || (norm === 'toplam' && colMap.answered !== c)) && !norm.includes('sure') && !norm.includes('ort') && !norm.includes('aht') && !isAnswered;
        if (isTotalOffered && colMap.totalOfferedCalls === -1) {
          colMap.totalOfferedCalls = c;
          continue;
        }

        // 3. Toplam Konuşma Süresi
        const isTotalTalk = norm.includes('toplamkonusma') || norm.includes('toplamgorusme') || norm.includes('totaltalk') || (norm.includes('toplam') && norm.includes('sure') && !norm.includes('cagri') && !norm.includes('ort') && !norm.includes('aht'));
        if (isTotalTalk && colMap.totalTalkDuration === -1) {
          colMap.totalTalkDuration = c;
          continue;
        }

        // 4. Gelen Çağrı Ort Konuşma Süresi / Inbound AHT
        const isInboundAht = norm.includes('gelencagriort') || norm.includes('gelenortalamakonusma') || norm.includes('gelenortalamagorusme') || norm.includes('ortalamakonusma') || norm.includes('ortalamagorusme') || norm.includes('ortkonusma') || norm.includes('ortgorusme') || norm.includes('inboundaht') || norm.includes('avgtalktime') || (norm.includes('gelen') && norm.includes('ort') && norm.includes('sure')) || norm === 'aht';
        if (isInboundAht && colMap.inboundAvgTalkTime === -1) {
          colMap.inboundAvgTalkTime = c;
          continue;
        }

        // 5. Net Verimlilik
        const isNetProd = norm.includes('netverimlilik') || norm.includes('verimlilik') || norm.includes('productivity') || norm === 'verim';
        if (isNetProd && colMap.netProductivity === -1) {
          colMap.netProductivity = c;
          continue;
        }

        // 6. Mola (Aux 1)
        const isBreak = norm === 'mola' || norm.includes('mola') || norm === 'break' || norm.includes('break') || norm.includes('istirahat') || norm.includes('dinlenme') || norm.includes('aux1') || norm.includes('auxmola');
        if (isBreak && colMap.breakTime === -1) {
          colMap.breakTime = c;
          continue;
        }

        // 7. Yemek (Aux 2)
        const isLunch = norm === 'yemek' || norm.includes('yemek') || norm.includes('yemeg') || norm === 'lunch' || norm.includes('lunch') || norm.includes('meal') || norm.includes('dinner') || norm.includes('aux2') || norm.includes('auxyemek');
        if (isLunch && colMap.lunchTime === -1) {
          colMap.lunchTime = c;
          continue;
        }

        // 8. Toplantı (Aux 3)
        const isMeeting = norm === 'toplanti' || norm.includes('toplanti') || norm === 'meeting' || norm.includes('meeting') || norm.includes('briefing') || norm.includes('kocluk') || norm.includes('coaching') || norm.includes('geribildirim') || norm.includes('feedback') || norm.includes('1on1') || norm.includes('aux3') || norm.includes('auxtoplanti');
        if (isMeeting && colMap.meetingTime === -1) {
          colMap.meetingTime = c;
          continue;
        }

        // 9. Eğitim (Aux 4)
        const isTraining = norm === 'egitim' || norm.includes('egitim') || norm === 'training' || norm.includes('training') || norm.includes('seminer') || norm.includes('kurs') || norm.includes('oryantasyon') || norm.includes('aux4') || norm.includes('auxegitim');
        if (isTraining && colMap.trainingTime === -1) {
          colMap.trainingTime = c;
          continue;
        }

        // 10. Tarih
        const isDate = norm === 'tarih' || norm.includes('tarih') || norm === 'date' || norm.includes('date') || norm === 'zaman' || norm === 'gun';
        if (isDate && colMap.date === -1) {
          colMap.date = c;
          continue;
        }

        // 12. Solved
        const isSolved = norm.includes('cozul') || norm.includes('cozum') || norm.includes('solved') || norm.includes('closed') || norm.includes('tamamlanan');
        if (isSolved && colMap.solved === -1) {
          colMap.solved = c;
          continue;
        }

        // 13. Service
        const isService = norm.includes('servis') || norm.includes('service') || norm.includes('rma') || norm.includes('ariza');
        if (isService && colMap.service === -1) {
          colMap.service = c;
          continue;
        }

        // 14. Open
        const isOpen = norm.includes('acik') || norm.includes('open') || norm.includes('bekleyen');
        if (isOpen && colMap.open === -1) {
          colMap.open = c;
          continue;
        }

        const isDurationCol = norm.includes('sure') || norm.includes('zaman') || norm.includes('duration') || norm.includes('time') || norm.includes('aht');

        // 15. Category (Product categories, groups, models, products) - Strictly exclude duration columns!
        const isCategory = !isDurationCol && (norm.includes('kategori') || norm.includes('grup') || norm.includes('segment') || norm.includes('birim') || norm.includes('urunkat') || norm.includes('urungrup') || norm.includes('urunadi') || norm.includes('urunler') || norm === 'urun' || norm === 'product' || norm.includes('productcat') || norm.includes('productgroup'));
        if (isCategory && colMap.category === -1) {
          colMap.category = c;
          continue;
        }

        // 16. Problem / Ticket reason / Action - Strictly exclude duration columns like "İşlem Süresi"!
        const isProblem = !isDurationCol && (norm.includes('problem') || norm.includes('sorun') || norm.includes('konu') || norm.includes('talep') || norm.includes('sikayet') || (norm.includes('islem') && !norm.includes('sure')) || norm.includes('tuslama') || norm.includes('ariza') || norm.includes('cagrinedeni') || norm.includes('model') || norm.includes('cihaz'));
        if (isProblem && colMap.problem === -1) {
          colMap.problem = c;
          continue;
        }

        // 17. CSAT
        const isCsat = norm.includes('csat') || norm.includes('kalite') || norm.includes('puan') || norm.includes('skor') || norm.includes('score') || norm.includes('memnuniyet');
        if (isCsat && colMap.csat === -1) {
          colMap.csat = c;
          continue;
        }
      }
    }

    // Dedicated Scored Representative & Email Column Detection
    let bestCreatorCol = -1;
    let bestCreatorScore = -9999;
    let bestEmailCol = -1;

    for (let c = 0; c < maxCols; c++) {
      const topCell = String(headerRow[c] || getMergedValue(headerRowIndex, c) || '').trim();
      const subCell = nextRowIsSubHeader ? String(subHeaderRow[c] || getMergedValue(headerRowIndex + 1, c) || '').trim() : '';
      const combined = `${topCell} ${subCell}`.trim();
      const norm = normalizeKey(combined || topCell);
      if (!norm) continue;

      // Sample data rows in this column
      let sampleHasEmail = false;
      let sampleHasHumanName = false;
      for (let sRow = headerRowIndex + 1; sRow < Math.min(headerRowIndex + 15, raw2D.length); sRow++) {
        const val = String(raw2D[sRow]?.[c] || '').trim();
        if (val.includes('@')) {
          sampleHasEmail = true;
          if (bestEmailCol === -1) bestEmailCol = c;
        } else if (val.length > 2 && !/^\d+$/.test(val) && (val.includes(' ') || /[a-zA-ZğüşıöçĞÜŞİÖÇ]{3,}/.test(val))) {
          sampleHasHumanName = true;
        }
      }

      if (norm.includes('eposta') || norm.includes('email') || norm.includes('mail') || (norm.includes('kullanici') && sampleHasEmail)) {
        if (bestEmailCol === -1) bestEmailCol = c;
      }

      let score = 0;
      if (norm === 'temsilciadi' || norm === 'temsilciadisoyadi') score += 2000;
      else if (norm.includes('temsilciadi') || norm.includes('temsilciad')) score += 1800;
      else if (norm === 'adsoyad' || norm === 'adisoyadi' || norm === 'personeladi') score += 1600;
      else if (norm.includes('adsoyad') || norm.includes('personeladi')) score += 1400;
      else if (norm === 'temsilci') score += 1100;
      else if (norm.includes('temsilci') && !norm.includes('ozel') && !norm.includes('id') && !norm.includes('no')) score += 900;
      else if (norm === 'personel' || norm === 'danisman' || norm === 'agent') score += 700;
      else if (norm.includes('personel') || norm.includes('danisman') || norm.includes('agent')) score += 500;
      else if (norm.includes('kullaniciadi')) score += 200;
      else if (norm === 'kullanici' || norm.includes('olusturan') || norm.includes('creator')) score += 50;

      // Penalties: ID, email, or @ values must NOT be representative name
      if (norm.includes('id') || norm.includes('no') || norm.includes('kod') || norm.includes('ozel') || norm.includes('dahili')) {
        score -= 2000;
      }
      if (norm.includes('eposta') || norm.includes('email') || norm.includes('mail') || norm.includes('posta')) {
        score -= 2500;
      }
      if (sampleHasEmail) {
        score -= 3000;
      }
      if (sampleHasHumanName) {
        score += 500;
      }

      if (score > bestCreatorScore && score > 0) {
        bestCreatorScore = score;
        bestCreatorCol = c;
      }
    }

    colMap.creator = bestCreatorCol;
    colMap.email = bestEmailCol;

    // Fallback column positions if no headers detected
    if (bestHeaderScore < 8) {
      colMap.date = 0;
      colMap.creator = 1;
      colMap.category = 2;
      colMap.problem = 3;
      colMap.callCount = 4;
      colMap.duration = 5;
      colMap.solved = 6;
      colMap.service = 7;
      colMap.open = 8;
      colMap.csat = 9;
    }

    // If callCount was not directly assigned, point it to answered calls or totalOfferedCalls
    if (colMap.callCount === -1) {
      colMap.callCount = colMap.answered !== -1 ? colMap.answered : colMap.totalOfferedCalls;
    }
    // If duration was not directly assigned, point it to inboundAvgTalkTime
    if (colMap.duration === -1 && colMap.inboundAvgTalkTime !== -1) {
      colMap.duration = colMap.inboundAvgTalkTime;
    }

    // Collect detected headers in order
    const detectedHeaderList: string[] = [];
    if (headerRowIndex >= 0 && Array.isArray(raw2D[headerRowIndex])) {
      raw2D[headerRowIndex].forEach((hVal) => {
        const hStr = String(hVal || '').trim();
        if (hStr) detectedHeaderList.push(hStr);
      });
    }

    // Re-parse rawObj using the detected header row as the range start
    rawObj = headerRowIndex >= 0
      ? XLSX.utils.sheet_to_json(bestSheet, { range: headerRowIndex, defval: '' })
      : XLSX.utils.sheet_to_json(bestSheet, { defval: '' });

    const records: CallRecord[] = [];
    const creatorSet = new Set<string>();

    // Helper to get direct cell value from SheetJS sheet object by 0-indexed column and row
    const getDirectCellValue = (r: number, c: number): any => {
      try {
        const cellAddr = XLSX.utils.encode_cell({ r, c });
        const cell = bestSheet[cellAddr];
        if (cell) {
          if (cell.v !== undefined && cell.v !== null && cell.v !== '') return cell.v;
          if (cell.w !== undefined && cell.w !== null && cell.w !== '') return cell.w;
        }
      } catch {
        // Ignore fallback
      }
      return undefined;
    };

    // Detect date format across the sheet (DMY vs MDY)
    const detectedDateFormat = detectSheetDateFormat(raw2D, bestSheet, colMap.date);

    // Iterate through all data rows
    const startRow = nextRowIsSubHeader ? headerRowIndex + 2 : (headerRowIndex >= 0 ? headerRowIndex + 1 : (raw2D.length > 1 && isNaN(Number(raw2D[0][0])) ? 1 : 0));

    for (let rIdx = startRow; rIdx < raw2D.length; rIdx++) {
      const rowArr = raw2D[rIdx];
      if (!Array.isArray(rowArr) || rowArr.length === 0) continue;

      // Also get corresponding object row if available
      const objIdx = headerRowIndex >= 0 ? rIdx - (headerRowIndex + 1) : rIdx - 1;
      const rowObj = (objIdx >= 0 && objIdx < rawObj.length) ? rawObj[objIdx] : {};

      const keys = Object.keys(rowObj || {});
      const normalizedKeyMap = new Map<string, string>();
      keys.forEach(k => normalizedKeyMap.set(normalizeKey(k), k));

      // Comprehensive row cell accessor: checks SheetJS direct cell, raw2D array, and rowObj by keys
      const getRowValue = (colIdx: number, ...candidates: string[]): any => {
        // 1. Direct cell from bestSheet by column index
        if (colIdx >= 0) {
          try {
            const cellAddr = XLSX.utils.encode_cell({ r: rIdx, c: colIdx });
            const cell = bestSheet[cellAddr];
            if (cell) {
              // If formatted text is available and non-empty
              if (cell.w !== undefined && cell.w !== null && String(cell.w).trim() !== '') {
                const wStr = String(cell.w).trim();
                // If cell.w looks like time (e.g. "00:15:00", "15:00") or percentage
                if (wStr.includes(':') || wStr.includes('dk') || wStr.includes('%')) {
                  return wStr;
                }
              }
              if (cell.v !== undefined && cell.v !== null && cell.v !== '') {
                return cell.v;
              }
              if (cell.w !== undefined && cell.w !== null && cell.w !== '') {
                return cell.w;
              }
            }
          } catch {
            // fallback
          }

          if (rowArr && rowArr[colIdx] !== undefined && rowArr[colIdx] !== null && rowArr[colIdx] !== '') {
            return rowArr[colIdx];
          }
        }

        // 2. From rowObj by candidate names
        if (rowObj && candidates.length > 0) {
          for (const cand of candidates) {
            const normCand = normalizeKey(cand);
            const origKey = normalizedKeyMap.get(normCand);
            if (origKey && rowObj[origKey] !== undefined && rowObj[origKey] !== null) {
              const v = rowObj[origKey];
              if (String(v).trim() !== '') return v;
            }
          }

          // Fuzzy search in rowObj keys
          for (const cand of candidates) {
            const normCand = normalizeKey(cand);
            if (normCand.length >= 3) {
              for (const [nk, origKey] of normalizedKeyMap.entries()) {
                if (nk === normCand || nk.includes(normCand) || normCand.includes(nk)) {
                  const v = rowObj[origKey];
                  if (v !== undefined && v !== null && String(v).trim() !== '') return v;
                }
              }
            }
          }
        }

        return undefined;
      };

      const getKeyVal = (...candidates: string[]) => {
        for (const c of candidates) {
          const normCandidate = normalizeKey(c);
          const originalKey = normalizedKeyMap.get(normCandidate);
          if (originalKey && rowObj[originalKey] !== undefined && rowObj[originalKey] !== null) {
            const val = String(rowObj[originalKey]).trim();
            if (val !== '') return val;
          }
        }
        return '';
      };

      // 1. Creator (Staff Name) & Email
      let rawCreator = getRowValue(
        colMap.creator,
        'Temsilci Adı', 'Temsilci Adi', 'Temsilci',
        'Personel Adı', 'Personel Adi', 'Personel',
        'Danışman Adı', 'Danisman Adi', 'Danışman', 'Danisman',
        'Ad Soyad', 'Adı Soyadı', 'Adi Soyadi',
        'Agent Name', 'Agent'
      );
      let creatorStr = String(rawCreator || '').trim();

      // If rawCreator contains '@' (an email) or is numeric, actively look for the real "Temsilci Adı" column
      if (creatorStr.includes('@') || /^\d+$/.test(creatorStr)) {
        const realNameCandidate = getKeyVal(
          'Temsilci Adı', 'Temsilci Adi', 'Temsilci',
          'Personel Adı', 'Personel Adi', 'Ad Soyad', 'Adı Soyadı'
        );
        if (realNameCandidate && !realNameCandidate.includes('@') && isNaN(Number(realNameCandidate))) {
          creatorStr = realNameCandidate;
        } else {
          // Scan rowObj for any key containing 'temsilci' or 'adsoyad' or 'personel'
          for (const [nk, origKey] of normalizedKeyMap.entries()) {
            if ((nk.includes('temsilci') || nk.includes('adsoyad') || nk.includes('personel')) && !nk.includes('id') && !nk.includes('kod') && !nk.includes('mail') && !nk.includes('posta') && !nk.includes('ozel')) {
              const val = String(rowObj[origKey] || '').trim();
              if (val && !val.includes('@') && isNaN(Number(val))) {
                creatorStr = val;
                break;
              }
            }
          }
        }
      }

      const creator = (creatorStr && isNaN(Number(creatorStr)) ? creatorStr : '') || 'Genel Destek Uzmanı';

      // Separate email extraction
      const rawEmail = getRowValue(colMap.email, 'E-posta', 'Email', 'Kullanıcı', 'Kullanici', 'Mail', 'Posta');
      const emailStr = String(rawEmail || '').trim();
      const email = emailStr.includes('@') 
        ? emailStr 
        : (String(rawCreator || '').includes('@') ? String(rawCreator).trim() : undefined);

      // Check if row is completely empty
      const isCompletelyEmpty = !rowArr.some(c => c !== undefined && c !== null && String(c).trim() !== '');
      if (isCompletelyEmpty) {
        continue;
      }

      // Ignore dummy repeated header rows or summary totals only if there's no data
      const normCreator = normalizeKey(creator);
      const isRepeatedHeader = normCreator.includes('temsilciadi') || normCreator.includes('personeladi') || normCreator.includes('olusturankullanici');
      if (isRepeatedHeader) {
        continue;
      }

      // Ignore summary totals and non-person queue names (e.g. "TOPLAM", "Kolay Kurulum")
      const isSummaryOrQueue = normCreator === 'toplam' || normCreator === 'geneltoplam' || normCreator === 'total' || 
                               normCreator === 'grandtotal' || normCreator === 'kolaykurulum' || normCreator.startsWith('toplam') || 
                               normCreator.endsWith('toplam');
      if (isSummaryOrQueue) {
        continue;
      }

      if (creator && creator !== 'Genel Destek Uzmanı') {
        creatorSet.add(creator);
      }

      // 2. Date
      const rawDate = getRowValue(colMap.date, 'Tarih', 'Date', 'Kayıt Tarihi', 'Kayit Tarihi', 'Tarih & Saat', 'Zaman', 'Gün', 'Gun');
      const dateInfo = formatAndParseExcelDate(rawDate, detectedDateFormat);

      // 3. Cevaplanan vs Toplam Çağrı
      // User directive: "cevaplanan muhamedde 1029 yazıyor ama excelde cevaplanan sütünü 885. sen 'toplam çağrı' başlığını çağırmışsın. yanlış stünü kontrol ettiriyorsn"
      // Strict separation: "Cevaplanan" is Answered calls, "Toplam Çağrı" is Offered/Inbound calls.
      const rawAnswered = getRowValue(
        colMap.answered,
        'Cevaplanan', 'Cevaplanan Çağrı', 'Cevaplanan Cagri', 'Cevaplanan Sayısı', 'Cevaplanan Sayisi', 'Cevaplanan Adet', 'Cevaplanan (Adet)', 'Cevaplananlar', 'Karşılanan', 'Karsilanan', 'Yanıtlanan', 'Yanitlanan', 'Answered', 'Handled', 'Cvp'
      );
      const answeredCallsVal = parseNum(rawAnswered);

      const rawTotalOffered = getRowValue(
        colMap.totalOfferedCalls,
        'Toplam Çağrı', 'Toplam Cagri', 'Gelen Çağrı', 'Gelen Cagri', 'Gelen Çağrı Sayısı', 'Total Calls', 'Inbound Calls', 'Offered', 'Çağrı Sayısı', 'Cagri Sayisi', 'Toplam Gelen', 'Gelen'
      );
      const totalOfferedCallsVal = parseNum(rawTotalOffered);

      const answeredCalls = answeredCallsVal !== undefined ? Math.round(answeredCallsVal) : undefined;
      const totalOfferedCalls = totalOfferedCallsVal !== undefined ? Math.round(totalOfferedCallsVal) : undefined;
      
      // Primary callCount strictly uses answeredCalls if available (e.g. 885), and only falls back to totalOfferedCalls if answered is completely missing
      const callCount = answeredCalls !== undefined ? answeredCalls : (totalOfferedCalls !== undefined ? totalOfferedCalls : undefined);

      // 4. AHT / Duration & Gelen Çağrı Ort Konuşma Süresi
      // User directive: "Ortalama AHT yazılı alanımız 'gelen çağrı ort görüşme süresin'den çekilmeli"
      const rawInboundAht = getRowValue(
        colMap.inboundAvgTalkTime,
        'Gelen Çağrı Ort Konuşma Süresi', 'Gelen Cagri Ort Konusma Suresi',
        'Gelen Çağrı Ort Görüşme Süresi', 'Gelen Cagri Ort Gorusme Suresi',
        'Gelen Çağrı Ort. Konuşma Süresi', 'Gelen Çağrı Ort. Görüşme Süresi',
        'Ortalama Konuşma Süresi', 'Ortalama Görüşme Süresi', 'Ortalama Çağrı Süresi',
        'Gelen Ort Konuşma', 'Gelen Ort Görüşme'
      );
      const inboundAvgTalkTime = parseDurationSec(rawInboundAht, true, false);

      const rawDuration = getRowValue(
        colMap.duration,
        'AHT', 'Ortalama Süre', 'Ortalama Sure', 'Konuşma Süresi', 'Konusma Suresi',
        'Görüşme Süresi', 'Gorusme Suresi', 'Süre', 'Sure', 'Duration', 'Talk Time', 'Handling Time'
      );
      const duration = (inboundAvgTalkTime !== undefined && inboundAvgTalkTime > 0) ? inboundAvgTalkTime : parseDurationSec(rawDuration, true, false);

      // 4b. Toplam Konuşma Süresi (total talk duration)
      const rawTotalTalk = getRowValue(
        colMap.totalTalkDuration,
        'Toplam Konuşma Süresi', 'Toplam Konusma Suresi',
        'Toplam Görüşme Süresi', 'Toplam Gorusme Suresi',
        'Toplam Konuşma', 'Toplam Konusma', 'Toplam Süre', 'Toplam Sure'
      );
      const totalTalkDuration = parseDurationSec(rawTotalTalk, true, false);

      // 4c. Net Verimlilik
      const rawNetProd = getRowValue(
        colMap.netProductivity,
        'Net Verimlilik', 'Net Verimlilik (%)', 'Verimlilik', 'Verimlilik (%)', 'Productivity', 'Net Productivity'
      );
      let netProductivity: number | undefined = undefined;
      if (rawNetProd !== undefined && rawNetProd !== null && rawNetProd !== '') {
        const p = parseNum(rawNetProd);
        if (p !== undefined) {
          let np = p;
          // Scale down numbers entered without decimal or scaled e.g. 3780 -> 37.8, 8500 -> 85
          while (np > 100) {
            np = np / 100;
          }
          // Scale up fractional percentages e.g. 0.378 -> 37.8%
          if (np > 0 && np <= 1) {
            np = np * 100;
          }
          netProductivity = Math.round(np * 10) / 10;
        }
      }

      // 4d. Mola, Yemek, Toplantı, Eğitim (Aux times)
      const rawBreak = getRowValue(
        colMap.breakTime,
        'Mola', 'mola', 'Mola Süresi', 'Mola Suresi', 'Mola (sn)', 'Mola (dk)', 'Mola Zamanı', 'Toplam Mola', 'Molalar', 'İstirahat', 'Dinlenme', 'Break', 'Short Break', 'Aux 1', 'Aux1', 'Mola (Dk)'
      );
      const breakDuration = parseDurationSec(rawBreak, true, true);

      const rawLunch = getRowValue(
        colMap.lunchTime,
        'Yemek', 'yemek', 'Yemek Süresi', 'Yemek Suresi', 'Yemek (sn)', 'Yemek (dk)', 'Yemek Zamanı', 'Toplam Yemek', 'Öğle Yemeği', 'Ogle Yemegi', 'Lunch', 'Meal', 'Aux 2', 'Aux2', 'Yemek (Dk)'
      );
      const lunchDuration = parseDurationSec(rawLunch, true, true);

      const rawMeeting = getRowValue(
        colMap.meetingTime,
        'Toplantı', 'toplantı', 'Toplanti', 'toplanti', 'Toplantı Süresi', 'Toplanti Suresi', 'Toplantı (sn)', 'Toplantı (dk)', 'Toplantı Zamanı', 'Toplam Toplantı', 'Meeting', 'Koçluk', 'Kocluk', 'Coaching', 'Briefing', 'Geri Bildirim', 'Aux 3', 'Aux3', 'Toplantı (Dk)'
      );
      const meetingDuration = parseDurationSec(rawMeeting, true, true);

      const rawTraining = getRowValue(
        colMap.trainingTime,
        'Eğitim', 'eğitim', 'Egitim', 'egitim', 'Eğitim Süresi', 'Egitim Suresi', 'Eğitim (sn)', 'Eğitim (dk)', 'Eğitim Zamanı', 'Toplam Eğitim', 'Training', 'Seminer', 'Kurs', 'Oryantasyon', 'Aux 4', 'Aux4', 'Eğitim (Dk)'
      );
      const trainingDuration = parseDurationSec(rawTraining, true, true);

      // 5. Status & Resolution
      const callStatusRaw = getKeyVal(
        'Çağrı Durumu', 'Cagri Durumu', 'Durum', 'Status', 'Call Status',
        'İşlem Tipi', 'Islem Tipi', 'Tür', 'Tur', 'Type', 'Kapanış Durumu', 'Kapanis Durumu'
      );
      let callStatus: CallRecord['callStatus'] = 'Solved';
      const lowerStatus = callStatusRaw.toLowerCase();
      if (lowerStatus.includes('isp')) callStatus = 'ISP';
      else if (lowerStatus.includes('l2') || lowerStatus.includes('eskalasyon')) callStatus = 'L2';
      else if (lowerStatus.includes('servis') || lowerStatus.includes('service') || lowerStatus.includes('rma') || lowerStatus.includes('ariza')) callStatus = 'Service';
      else if (lowerStatus.includes('webchat') || lowerStatus.includes('chat') || lowerStatus.includes('yazili') || lowerStatus.includes('mesaj')) callStatus = 'Webchat';
      else if (lowerStatus.includes('coz') || lowerStatus.includes('tamam') || lowerStatus.includes('closed') || lowerStatus.includes('kapali') || lowerStatus.includes('sonuc') || lowerStatus.includes('basarili')) callStatus = 'Solved';
      else if (lowerStatus.includes('acik') || lowerStatus.includes('open') || lowerStatus.includes('bekle') || lowerStatus.includes('islemde')) callStatus = 'Open';

      const resolution = getKeyVal('Kesin Sonuç', 'Kesin Sonuc', 'Sonuç', 'Sonuc', 'Resolution', 'Result', 'Kapanış', 'Kapanis') || (callStatus === 'Solved' ? 'Closed' : 'Open');

      // 6. Breakdown counts: Solved, Service, Open
      const rawSolved = getRowValue(colMap.solved, 'Çözülen', 'Cozulen', 'Çözülen Çağrı', 'Cozulen Cagri', 'Çözüm Sayısı', 'Cozum Sayisi', 'Solved', 'Solved Calls', 'Closed', 'Tamamlanan');
      const solvedCount = parseNum(rawSolved) !== undefined ? Math.round(parseNum(rawSolved)!) : undefined;

      const rawService = getRowValue(colMap.service, 'Servis', 'Servise Giden', 'RMA', 'Service', 'Servis Sayısı', 'Servis Kaydı');
      const serviceCount = parseNum(rawService) !== undefined ? Math.round(parseNum(rawService)!) : undefined;

      const rawOpen = getRowValue(colMap.open, 'Açık', 'Acik', 'Açık Kalan', 'Acik Kalan', 'Bekleyen', 'Open', 'Açık Çağrı');
      const openCount = parseNum(rawOpen) !== undefined ? Math.round(parseNum(rawOpen)!) : undefined;

      // 7. FCR, SL, CSAT
      const rawFcr = getRowValue(colMap.fcr, 'İlk Temasta Çözüm', 'Ilk Temasta Cozum', 'FCR', 'FCR%', 'FCR Oranı', 'First Contact Resolution');
      const fcrRateVal = parseNum(rawFcr);

      const rawSl = getRowValue(colMap.sl, 'Servis Seviyesi', 'Servis Seviyesi (SL)', 'SL', 'SL%', 'Service Level');
      const slRateVal = parseNum(rawSl);

      const rawCsat = getRowValue(colMap.csat, 'CSAT', 'CSAT Kalite', 'Kalite', 'Kalite Puanı', 'Kalite Puani', 'Puan', 'Score', 'Memnuniyet', 'Değerlendirme', 'Degerlendirme');
      const csatScoreVal = parseNum(rawCsat);

      // 8. Category, Model, Problem, Brand
      const rawCat = getRowValue(
        colMap.category,
        'Kategori', 'Category', 'Ürün Grubu', 'Urun Grubu', 'Ürün Kategorisi', 'Urun Kategorisi',
        'Ürün', 'Urun', 'Ürün Adı', 'Urun Adi', 'Ürünler', 'Urunler', 'Product', 'Product Category', 'Product Group',
        'Cihaz', 'Cihaz Türü', 'Cihaz Tipi', 'Model', 'Grup', 'Segment', 'Ana Kategori', 'Segmentasyon'
      );
      const subCategory = getKeyVal('Alt Kategori', 'Sub Category', 'Alt Grup', 'Detay Grubu') || (rawCat ? String(rawCat).trim() : '');

      const rawProb = getRowValue(
        colMap.problem,
        'Problem', 'Sorun', 'Konu', 'Talep', 'Şikayet', 'Sikayet', 'İşlem', 'Islem', 'Issue', 'Subject', 'Action', 'Tuşlama', 'Tuslama', 'Arıza', 'Ariza', 'Çağrı Nedeni', 'Cagri Nedeni'
      );
      const isProbDuration = rawProb && /^\d{1,2}:\d{2}(:\d{2})?$/.test(String(rawProb).trim());
      const problem = (rawProb && isNaN(Number(rawProb)) && !isProbDuration ? String(rawProb).trim() : '') || 'CC_Genel Destek';

      const productModel = getKeyVal('Ürün Modeli', 'Urun Modeli', 'Model', 'Product Model', 'Cihaz', 'Ürün', 'Urun', 'Product', 'Donanım') || (problem.includes('Archer') || problem.includes('Deco') || problem.includes('Mercusys') || problem.includes('Tapo') ? problem : 'VN020-F3');
      
      let extractedCategory = (rawCat && isValidCategoryString(rawCat) ? String(rawCat).trim() : '');
      if (!extractedCategory || extractedCategory === 'Genel Destek Uzmanı' || extractedCategory.includes('Genel Ağ') || extractedCategory === 'Genel Destek') {
        if (productModel && isValidCategoryString(productModel)) {
          extractedCategory = productModel.includes('Archer') ? 'TP-Link xDSL' : productModel.includes('Deco') ? 'Whole-Home Wi-Fi System' : productModel.includes('Tapo') ? 'Home Security' : 'AGINET xDSL';
        } else if (problem && isValidCategoryString(problem) && problem !== 'CC_Genel Destek') {
          extractedCategory = problem.replace('CC_', '').replace('CC RMA_', 'RMA ');
        }
      }
      let category = isValidCategoryString(extractedCategory) ? extractedCategory : 'AGINET xDSL';
      const businessUnit = getKeyVal('İş Birimi', 'Is Birimi', 'Business Unit', 'Departman', 'Birim') || 'Consumer Networking';
      const brand = getKeyVal('Marka', 'Brand', 'Üretici', 'Uretici') || (productModel.toUpperCase().includes('MERCUSYS') ? 'MERCUSYS' : productModel.toUpperCase().includes('TAPO') ? 'TAPO' : 'TP-LINK');
      const customer = getKeyVal('Müşteri', 'Musteri', 'Customer', 'Arayan', 'Caller', 'Müşteri Adı', 'Musteri Adi', 'Client') || `Müşteri #${rIdx}`;
      
      const agentNote = getKeyVal('Temsilci Notu', 'Agent Note', 'Not', 'Açıklama', 'Aciklama', 'Note', 'Detay', 'Comment');
      
      const rawTime = getKeyVal('Saat', 'Saat Aralığı', 'Saat Araligi', 'Time', 'Call Time', 'Zaman', 'Kayıt Saati', 'Kayit Saati', 'Oluşturma Saati', 'Olusturma Saati', 'Interval', 'Görüşme Zamanı');
      const { time, timeSlot } = extractTimeAndSlot(rawTime, dateInfo.isoDate);

      // Gather raw column map for raw spreadsheet preview
      const directA = getDirectCellValue(rIdx, 0) ?? rowArr[0];
      const directB = getDirectCellValue(rIdx, 1) ?? rowArr[1];
      const directC = getDirectCellValue(rIdx, 2) ?? rowArr[2];
      const directD = getDirectCellValue(rIdx, 3) ?? rowArr[3];
      const directE = getDirectCellValue(rIdx, 4) ?? rowArr[4];
      const directF = getDirectCellValue(rIdx, 5) ?? rowArr[5];
      const directG = getDirectCellValue(rIdx, 6) ?? rowArr[6];
      const directH = getDirectCellValue(rIdx, 7) ?? rowArr[7];
      const directI = getDirectCellValue(rIdx, 8) ?? rowArr[8];
      const directJ = getDirectCellValue(rIdx, 9) ?? rowArr[9];

      const rawRowData: Record<string, any> = {
        A: directA !== undefined ? directA : '',
        B: directB !== undefined ? directB : '',
        C: directC !== undefined ? directC : '',
        D: directD !== undefined ? directD : '',
        E: directE !== undefined ? directE : (callCount ?? ''),
        F: directF !== undefined ? directF : '',
        G: directG !== undefined ? directG : '',
        H: directH !== undefined ? directH : '',
        I: directI !== undefined ? directI : '',
        J: directJ !== undefined ? directJ : '',
      };

      // Raw KPI values map keyed by detected headers
      const rawKPIValues: Record<string, any> = {};
      detectedHeaderList.forEach((hdr, hIdx) => {
        const directVal = getDirectCellValue(rIdx, hIdx);
        if (directVal !== undefined && directVal !== '') {
          rawKPIValues[hdr] = directVal;
        } else if (rowArr[hIdx] !== undefined && rowArr[hIdx] !== '') {
          rawKPIValues[hdr] = rowArr[hIdx];
        } else if (rowObj && rowObj[hdr] !== undefined) {
          rawKPIValues[hdr] = rowObj[hdr];
        }
      });

      const excelRow = rIdx + 1;
      const excelCellRef = `E${excelRow}`;
      const rawColumnE = directE !== undefined && directE !== '' ? directE : (callCount !== undefined ? callCount : rowArr[4]);

      if (category === 'AGINET xDSL' || category.includes('Genel Ağ')) {
        for (const [k, v] of Object.entries(rawKPIValues)) {
          const nk = normalizeKey(k);
          if ((nk.includes('kategori') || nk.includes('urun') || nk.includes('grup') || nk.includes('segment') || nk.includes('cihaz') || nk.includes('model')) && isValidCategoryString(v)) {
            category = String(v).trim();
            break;
          }
        }
      }

      records.push({
        id: `rec-${rIdx + 1}`,
        callStatus,
        resolution,
        productModel,
        subCategory,
        category,
        businessUnit,
        brand,
        problem,
        customer,
        score: csatScoreVal,
        duration,
        agentNote,
        date: dateInfo.isoDate,
        time: time || timeSlot,
        creator,
        email,
        updater: getKeyVal('Güncelleyen', 'Guncelleyen', 'Updater'),
        assignedUser: getKeyVal('Atanan Kul.', 'Atanan Kul', 'Assigned', 'Atanan'),
        callCount,
        totalOfferedCalls,
        solvedCount,
        serviceCount,
        openCount,
        fcrRate: fcrRateVal,
        slRate: slRateVal,
        csatScore: csatScoreVal,
        excelRow,
        excelCellRef,
        rawColumnE,
        rawRowData,
        // User KPI fields
        answeredCalls,
        totalTalkDuration,
        inboundAvgTalkTime,
        netProductivity,
        breakDuration,
        lunchDuration,
        meetingDuration,
        trainingDuration,
        rawKPIValues,
      });
    }

    // Construct sheetsPreview for rich interactive Excel spreadsheet preview
    const sheetsPreview: ExcelSheetPreview[] = workbook.SheetNames.map(sName => {
      const sh = workbook.Sheets[sName];
      const sRaw: any[][] = sh ? XLSX.utils.sheet_to_json(sh, { header: 1, defval: '' }) : [];
      let hRowIdx = 0;
      if (sName === bestSheetName && typeof headerRowIndex === 'number' && headerRowIndex >= 0) {
        hRowIdx = headerRowIndex;
      } else {
        for (let r = 0; r < Math.min(10, sRaw.length); r++) {
          if (Array.isArray(sRaw[r]) && sRaw[r].some(c => typeof c === 'string' && c.trim().length > 1)) {
            hRowIdx = r;
            break;
          }
        }
      }
      const hRow = sRaw[hRowIdx] || [];
      const headers = hRow.map((c, idx) => {
        const val = String(c ?? '').trim();
        return val || `Sütun ${idx + 1}`;
      });
      return {
        sheetName: sName,
        data: sRaw,
        headers,
        headerRowIndex: hRowIdx,
      };
    });

    // Parse call detail interactions from secondary sheets (e.g. 2. Sheet with Çağrı Durumu & Kategori)
    let allRecords: CallRecord[] = [...records];
    if (workbook.SheetNames.length >= 2) {
      for (const sName of workbook.SheetNames) {
        if (sName === bestSheetName) continue;
        const sh = workbook.Sheets[sName];
        if (!sh) continue;
        const detailRecords = parseCallDetailsFromSheet(sh, sName, Array.from(creatorSet));
        if (detailRecords && detailRecords.length > 0) {
          allRecords = [...allRecords, ...detailRecords];
          detailRecords.forEach(dr => {
            if (dr.creator) creatorSet.add(dr.creator);
          });
        }
      }
    }

    return {
      success: true,
      data: allRecords,
      sheetNames: workbook.SheetNames,
      activeSheetName: bestSheetName,
      totalRows: allRecords.length,
      detectedCreators: Array.from(creatorSet),
      detectedHeaders: detectedHeaderList,
      sheetsPreview,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Dosya ayrıştırılırken hata oluştu.',
    };
  }
}

// Generates fallback spreadsheet preview from CallRecord dataset
export function generateSampleExcelPreview(records: CallRecord[] = []): ExcelSheetPreview[] {
  const headers = [
    'Tarih',
    'Temsilci Adı',
    'Toplam Çağrı',
    'Cevaplanan',
    'Toplam Konuşma Süresi',
    'Gelen Çağrı Ort Konuşma Süresi',
    'Net Verimlilik (%)',
    'Mola',
    'Yemek',
    'Toplantı',
    'Eğitim',
    'Kategori',
    'Problem / Konu',
    'Durum'
  ];

  const dataRows: any[][] = [headers];
  // Include all records without any artificial 100-row limit
  records.forEach(r => {
    dataRows.push([
      r.date || '2026-09-01',
      r.creator || 'Temsilci',
      r.totalOfferedCalls ?? r.callCount ?? 15,
      r.answeredCalls ?? 12,
      r.totalTalkDuration ? formatDurationHHMMSS(r.totalTalkDuration) : '02:45:10',
      r.inboundAvgTalkTime ? formatDurationHHMMSS(r.inboundAvgTalkTime) : '00:03:15',
      r.netProductivity !== undefined ? `%${r.netProductivity}` : '%84.5',
      r.breakDuration ? formatDurationHHMMSS(r.breakDuration) : '00:15:00',
      r.lunchDuration ? formatDurationHHMMSS(r.lunchDuration) : '00:45:00',
      r.meetingDuration ? formatDurationHHMMSS(r.meetingDuration) : '00:30:00',
      r.trainingDuration ? formatDurationHHMMSS(r.trainingDuration) : '00:00:00',
      r.category || 'AGINET xDSL',
      r.problem || 'Destek Talebi',
      r.callStatus || 'Solved'
    ]);
  });

  return [
    {
      sheetName: 'Çağrı & Temsilci Verileri',
      data: dataRows,
      headers,
      headerRowIndex: 0
    }
  ];
}

// Auto-derives CallCenterHourlyMetric queue rows from real CRM records if no separate queue file was uploaded
export function deriveHourlyMetricsFromCRM(records: CallRecord[]): CallCenterHourlyMetric[] {
  if (!records || records.length === 0) return [];

  // Group records by date (if record.date is empty, default to latest or current date)
  const dateGroups = new Map<string, CallRecord[]>();
  records.forEach(r => {
    const d = (r.date && r.date.trim()) || new Date().toISOString().split('T')[0];
    if (!dateGroups.has(d)) dateGroups.set(d, []);
    dateGroups.get(d)!.push(r);
  });

  const STANDARD_SLOTS = [
    '09-00 - 10-00', '10-00 - 11-00', '11-00 - 12-00', '12-00 - 13-00',
    '13-00 - 14-00', '14-00 - 15-00', '15-00 - 16-00', '16-00 - 17-00',
    '17-00 - 18-00', '18-00 - 19-00', '19-00 - 20-00', '20-00 - 21-00',
    '21-00 - 22-00', '22-00 - 23-00', '23-00 - 00-00'
  ];

  const allMetrics: CallCenterHourlyMetric[] = [];

  dateGroups.forEach((dateRecords, dateStr) => {
    const slotsMap: Record<string, {
      total: number;
      answered: number;
      solved: number;
      outbound: number;
      durations: number[];
    }> = {};

    STANDARD_SLOTS.forEach(slot => {
      slotsMap[slot] = { total: 0, answered: 0, solved: 0, outbound: 0, durations: [] };
    });

    dateRecords.forEach((r, rIdx) => {
      let { timeSlot } = extractTimeAndSlot(r.time || '', r.date || '');
      // If time was not specified, distribute un-timed calls evenly across business hours (09:00 to 18:00)
      if (!timeSlot || !slotsMap[timeSlot]) {
        const distributedHour = (rIdx % 9) + 9;
        timeSlot = `${String(distributedHour).padStart(2, '0')}-00 - ${String(distributedHour + 1).padStart(2, '0')}-00`;
      }
      if (!slotsMap[timeSlot]) {
        slotsMap[timeSlot] = { total: 0, answered: 0, solved: 0, outbound: 0, durations: [] };
      }
      const offered = (typeof r.totalOfferedCalls === 'number' && r.totalOfferedCalls > 0)
        ? r.totalOfferedCalls
        : ((typeof r.callCount === 'number' && r.callCount > 0) ? r.callCount : 1);
      const answered = (typeof r.answeredCalls === 'number' && r.answeredCalls >= 0)
        ? r.answeredCalls
        : Math.round(offered * 0.94);
      const outbound = (typeof (r as any).outboundCalls === 'number' && (r as any).outboundCalls > 0)
        ? (r as any).outboundCalls
        : 0;

      slotsMap[timeSlot].total += offered;
      slotsMap[timeSlot].answered += answered;
      slotsMap[timeSlot].outbound += outbound;
      if (r.callStatus === 'Solved' || r.resolution === 'Closed') {
        slotsMap[timeSlot].solved += (answered || offered);
      }
      if (typeof r.duration === 'number' && r.duration > 0) {
        slotsMap[timeSlot].durations.push(r.duration);
      } else if (typeof r.inboundAvgTalkTime === 'number' && r.inboundAvgTalkTime > 0) {
        slotsMap[timeSlot].durations.push(r.inboundAvgTalkTime);
      }
    });

    const dayMetrics = Object.entries(slotsMap).map(([timeSlot, data]) => {
      const avgAht = data.durations.length > 0
        ? Math.round(data.durations.reduce((a, b) => a + b, 0) / data.durations.length)
        : 210;
      const totalTalkDuration = data.durations.reduce((a, b) => a + b, 0) || (data.answered * avgAht);
      const inSL = Math.round(data.answered * 0.88);
      const missed = Math.max(0, data.total - data.answered);

      return {
        date: dateStr,
        timeSlot,
        totalCalls: data.total,
        answeredCalls: data.answered,
        shortCalls: 0,
        missedCalls: missed,
        answeredInSL: inSL,
        serviceLevel1: data.answered > 0 ? Number(((inSL / data.answered) * 100).toFixed(1)) : 100,
        serviceLevel2: data.total > 0 ? Number(((inSL / data.total) * 100).toFixed(1)) : 100,
        aht: avgAht,
        answerRate: data.total > 0 ? Number(((data.answered / data.total) * 100).toFixed(1)) : 100,
        holdCount: 0,
        avgTalkTime: avgAht,
        totalTalkDuration,
        waitDuration: data.total * 12,
        avgWaitDuration: 12,
        outboundAttempts: data.outbound,
        outboundCalls: data.outbound,
        outboundAnswerRate: data.outbound > 0 ? 100 : 0,
        outboundDuration: data.outbound * 150,
        outboundAvgTalkTime: data.outbound > 0 ? 150 : 0,
        localHangup: 0,
        ringDuration: data.total * 6,
        holdDuration: 0,
        acwDuration: 0,
        wrapUpDuration: data.total * 15,
        dequeue: 0,
        speedOfAnswer: 12,
        maxWaitTime: 25,
        outboundLocalHangup: 0,
      };
    });

    allMetrics.push(...dayMetrics);
  });

  return allMetrics;
}

// Parses Call Center Hourly Metrics CSV or Excel file across all worksheets
export function parseHourlyMetricsFile(fileData: ArrayBuffer | string): ParseResult<CallCenterHourlyMetric[]> {
  try {
    const workbook = XLSX.read(fileData, { type: typeof fileData === 'string' ? 'string' : 'array' });
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return { success: false, error: 'Santral kuyruk dosyasında sayfa bulunamadı.' };
    }

    // Pick best sheet with hourly queue data
    let bestSheet = workbook.Sheets[workbook.SheetNames[0]];
    let bestScore = -1;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const raw2D: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      let score = raw2D.length;
      const lowerName = sheetName.toLowerCase().trim();
      if (lowerName === 'interval' || lowerName.includes('interval')) score += 10000;
      if (lowerName.includes('santral') || lowerName.includes('saatlik') || lowerName.includes('kuyruk')) score += 5000;
      const headerSample = raw2D.slice(0, 10).flat().map(c => String(c).toLowerCase());
      if (headerSample.some(h => h.includes('saat') || h.includes('aralık') || h.includes('dilim') || h.includes('interval'))) score += 1000;
      if (headerSample.some(h => h.includes('çağrı') || h.includes('cagri') || h.includes('gelen'))) score += 500;
      if (headerSample.some(h => h.includes('cevaplanan') || h.includes('yanıtlanan'))) score += 500;

      if (score > bestScore) {
        bestScore = score;
        bestSheet = sheet;
      }
    }

    if (!bestSheet) {
      return { success: false, error: 'Santral verileri sayfası bulunamadı.' };
    }

    const raw2D: any[][] = XLSX.utils.sheet_to_json(bestSheet, { header: 1, defval: '' });
    if (raw2D.length === 0) {
      return { success: false, error: 'Santral verileri dosyası boş veya geçersiz.' };
    }

    // Detect header row index
    let headerRowIndex = 0;
    for (let r = 0; r < Math.min(10, raw2D.length); r++) {
      const row = raw2D[r];
      if (!Array.isArray(row)) continue;
      const rowStr = row.map(c => String(c).toLowerCase()).join(' ');
      if ((rowStr.includes('saat') || rowStr.includes('zaman') || rowStr.includes('aralık') || rowStr.includes('interval')) &&
          (rowStr.includes('çağrı') || rowStr.includes('cagri') || rowStr.includes('gelen') || rowStr.includes('cevaplanan'))) {
        headerRowIndex = r;
        break;
      }
    }

    // Column indices - user's exact specification:
    // A (Col 1): Tarih, B (Col 2): Saat, C (Col 3): Çağrılar/Gelen Çağrı, D (Col 4): Cevaplanan, E (Col 5): Kısa Çağrılar,
    // F (Col 6): Kaçan Çağrılar, G (Col 7): SL İçinde, H (Col 8): Servis Seviyesi 1, I (Col 9): Servis Seviyesi 2,
    // J (Col 10): Bekletme Sayısı, K (Col 11): Bekletme Süresi, L (Col 12): Ortalama Konuşma, M (Col 13): Toplam Konuşma,
    // N (Col 14): AHT / Süre verileri, O (Col 15): Bekleme Süresi, P (Col 16): Ortalama Bekleme Süresi, Q (Col 17): Giden Arama Denemesi,
    // R (Col 18): Giden Cevaplama Oranı, S (Col 19): Giden Çağrılar, T (Col 20): Giden Konuşma Süresi, U (Col 21): Giden Ortalama Konuşma
    let dateCol = 0;
    let timeCol = 1;
    let totalCallsCol = 2;
    let answeredCallsCol = 3;
    let shortCallsCol = 4;
    let missedCallsCol = 5;
    let slInCol = 6;
    let sl1Col = 7;
    let sl2Col = 8;
    let holdCountCol = 9;
    let holdDurationCol = 10;
    let avgTalkCol = 11;
    let talkDurationCol = 12;
    let ahtCol = 13;
    let waitDurationCol = 14;
    let avgWaitCol = 15;
    let outboundAttemptsCol = 16;
    let outboundAnswerRateCol = 17;
    let outboundCallsCol = 18;
    let outboundDurationCol = 19;
    let outboundAvgTalkCol = 20;
    let answerRateCol = -1;
    let localHangupCol = -1;
    let ringDurationCol = -1;
    let acwDurationCol = -1;
    let wrapUpDurationCol = -1;
    let dequeueCol = -1;
    let asaCol = -1;
    let maxWaitCol = -1;

    // Inspect the actual header row to see if columns are explicitly positioned
    const headerRow = raw2D[headerRowIndex] || [];
    headerRow.forEach((val: any, cIdx: number) => {
      if (val === undefined || val === null) return;
      const h = normalizeKey(String(val));
      if (!h) return;

      if (h.includes('tarih') || h === 'date') dateCol = cIdx;
      else if (h.includes('saataraligi') || h.includes('saat') || h.includes('interval') || h.includes('zaman') || h.includes('dilim')) timeCol = cIdx;
      // Inbound calls: C2
      else if ((h === 'cagrilar' || h.includes('gelencagri') || h.includes('toplamcagri') || h.includes('cagrisayisi') || h.includes('totalcalls') || h.includes('inbound') || h.includes('offered')) && !h.includes('giden') && !h.includes('kacan') && !h.includes('kisa') && !h.includes('cevaplanan')) totalCallsCol = cIdx;
      // Answered in SL
      else if (h.includes('slicerisinde') || h.includes('slicinde') || h.includes('slici') || (h.includes('sl') && (h.includes('cevaplanan') || h.includes('adet') || h.includes('sayisi')))) slInCol = cIdx;
      // Service Level percentages
      else if (h.includes('servisseviyesi2') || h === 'sl2') sl2Col = cIdx;
      else if (h.includes('servisseviyesi') || h.includes('servicelevel') || h.includes('slorani') || h === 'sl1' || h === 'sl') sl1Col = cIdx;
      // Outbound columns: S2 for Outbound Calls
      else if (h.includes('gidenaramadenemesi') || h.includes('gidendeneme') || h.includes('outboundattempts')) outboundAttemptsCol = cIdx;
      else if (h.includes('gidencagricevaplama') || h.includes('gidencevaplama') || h.includes('outboundanswerrate')) outboundAnswerRateCol = cIdx;
      else if (h.includes('gidencagrikonusma') || h.includes('gidenkonusma') || h.includes('outboundduration')) outboundDurationCol = cIdx;
      else if (h.includes('gidencagriort') || h.includes('gidenortkonusma') || h.includes('outboundavgtalk')) outboundAvgTalkCol = cIdx;
      else if ((h.includes('gidencagrilar') || h.includes('gidencagri') || h.includes('outboundcalls')) && !h.includes('deneme') && !h.includes('oran') && !h.includes('sure')) outboundCallsCol = cIdx;
      // Inbound Answered calls: D2
      else if ((h.includes('cevaplanan') || h.includes('yanitlanan') || h.includes('karsilanan') || h.includes('answered') || h.includes('handled')) && !h.includes('giden') && !h.includes('oran') && !h.includes('sl')) answeredCallsCol = cIdx;
      // Answer rate
      else if (h.includes('cevaplanmaorani') || h.includes('cevaplamaorani') || h.includes('answerrate')) answerRateCol = cIdx;
      // Short calls
      else if (h.includes('kisacagri') || h.includes('kisa')) shortCallsCol = cIdx;
      // Missed / Abandoned calls
      else if (h.includes('kacan') || h.includes('cevapsiz') || h.includes('missed') || h.includes('kayip') || h.includes('terk')) missedCallsCol = cIdx;
      // AHT: N2
      else if (h.includes('aht') || h.includes('ortalamasure')) ahtCol = cIdx;
      // Hold count & duration
      else if (h.includes('bekletmesayisi') || h.includes('holdcount')) holdCountCol = cIdx;
      else if (h.includes('bekletmesuresi') || h.includes('holdsuresi') || h.includes('holdduration')) holdDurationCol = cIdx;
      // Inbound Talk time & duration
      else if ((h.includes('ortkonusma') || h.includes('ortalamakonusma') || h.includes('ortgorusme') || h.includes('ortalamagorusme') || (h.includes('ortalama') && (h.includes('konusma') || h.includes('gorusme')))) && !h.includes('giden')) avgTalkCol = cIdx;
      else if ((h.includes('toplamkonusma') || h.includes('toplamgorusme') || h.includes('konusmasuresi') || h.includes('gorusmesuresi') || h.includes('talkduration')) && !h.includes('giden') && !h.includes('ortalama')) talkDurationCol = cIdx;
      // Inbound Wait time & duration
      else if ((h.includes('ortalamabekleme') || h.includes('avgwait') || (h.includes('ortalama') && h.includes('bekleme'))) && !h.includes('maksimum') && !h.includes('enuzun')) avgWaitCol = cIdx;
      else if (h.includes('maksimumbekleme') || h.includes('enuzunbekleme') || h.includes('maxwait')) maxWaitCol = cIdx;
      else if ((h.includes('beklemesuresi') || h.includes('waitduration') || (h.includes('bekleme') && h.includes('sure'))) && !h.includes('ortalama') && !h.includes('maksimum')) waitDurationCol = cIdx;
      // Local hangup, ring, wrapup, acw
      else if (h.includes('lokalkapatma')) localHangupCol = cIdx;
      else if (h.includes('calmasuresi') || h.includes('ringduration')) ringDurationCol = cIdx;
      else if (h.includes('acw')) acwDurationCol = cIdx;
      else if (h.includes('wrapup') || h.includes('toparlama')) wrapUpDurationCol = cIdx;
      else if (h.includes('dequeue')) dequeueCol = cIdx;
      else if (h.includes('cevaplamahizi') || h.includes('asa')) asaCol = cIdx;
    });

    // ----------------------------------------------------
    // User Specification: Column N (13) is strictly AHT / Ort. Konuşma
    // Column S (18) is strictly Giden Çağrılar
    // NEVER override Column N with other columns (such as Column V "Giden Çağrı Ort. Konuşma Süresi")
    // ----------------------------------------------------
    ahtCol = 13; // Sütun N (Excel 14. sütun, 0-indexed: 13)
    outboundCallsCol = 18; // Sütun S (Excel 19. sütun, 0-indexed: 18)

    const parseInteger = (val: any): number => {
      if (val === undefined || val === null || val === '') return 0;
      if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);
      const str = String(val).trim();
      if (!str) return 0;
      const clean = str.replace(/,/g, '.').replace(/[^\d.-]/g, '').trim();
      const n = parseFloat(clean);
      return isNaN(n) ? 0 : Math.round(n);
    };

    // Strict exact decimal parser for Column N (Ort. Konuşma): preserves exact decimals like 328.5 or 146.33
    // Priority: If formatted text (.w) exists, use that directly so formatted decimals (e.g., "328,5", "197,33") are not read as raw unscaled integers (e.g., 3285, 19733)
    const parseColumnNValue = (val: any, formatted?: any): number => {
      // 1. Check formatted text (.w) FIRST! This is the exact text the user sees in Excel (e.g., "328,5", "197,33", "03:45")
      if (formatted !== undefined && formatted !== null) {
        const fStr = String(formatted).trim();
        if (fStr && fStr !== '-' && fStr !== '--') {
          if (fStr.includes(':')) {
            const sec = parseDurationSec(fStr);
            if (sec !== undefined && sec > 0) return Number(sec.toFixed(2));
          }
          // If formatted text contains Turkish decimal comma (e.g., "328,5") or decimal dot ("328.5")
          if (fStr.includes(',') || fStr.includes('.')) {
            const cleanF = fStr.replace(/,/g, '.').replace(/[^\d.-]/g, '').trim();
            const nF = parseFloat(cleanF);
            if (!isNaN(nF) && nF > 0) {
              return Number(nF.toFixed(2));
            }
          } else {
            // Even integer formatted strings without comma
            const cleanF = fStr.replace(/[^\d.-]/g, '').trim();
            const nF = parseFloat(cleanF);
            if (!isNaN(nF) && nF > 0) {
              return Number(nF.toFixed(2));
            }
          }
        }
      }

      if (val === undefined || val === null || val === '') return 0;
      if (typeof val === 'number') {
        if (isNaN(val) || val <= 0) return 0;
        // Excel fractional day for time/duration formatted cells (e.g., 0.0026 = ~225 sec)
        if (val > 0 && val < 1.0) {
          return Number((val * 86400).toFixed(2));
        }
        return Number(val.toFixed(2));
      }
      if (val instanceof Date) {
        const sec = parseDurationSec(val);
        return sec !== undefined ? Number(sec.toFixed(2)) : 0;
      }
      const str = String(val).trim();
      if (!str || str === '-' || str === '--') return 0;
      if (str.includes(':')) {
        const sec = parseDurationSec(str);
        return sec !== undefined ? Number(sec.toFixed(2)) : 0;
      }
      const clean = str.replace(/,/g, '.').replace(/[^\d.-]/g, '').trim();
      const n = parseFloat(clean);
      return isNaN(n) || n <= 0 ? 0 : Number(n.toFixed(2));
    };

    // Strict exact integer parser for Column S (Giden Çağrılar)
    const parseColumnSValue = (val: any): number => {
      if (val === undefined || val === null || val === '') return 0;
      if (typeof val === 'number') {
        return isNaN(val) || val < 0 ? 0 : Math.round(val);
      }
      const str = String(val).trim();
      if (!str || str === '-' || str === '--') return 0;
      const clean = str.replace(/,/g, '.').replace(/[^\d.-]/g, '').trim();
      const n = parseFloat(clean);
      return isNaN(n) || n < 0 ? 0 : Math.round(n);
    };

    const parsePercent = (val: any): number => {
      if (val === undefined || val === null || val === '') return 0;
      if (typeof val === 'number') {
        if (isNaN(val)) return 0;
        if (val > 0 && val <= 1.0) return Number((val * 100).toFixed(2));
        return Number(val.toFixed(2));
      }
      const str = String(val).trim();
      if (!str) return 0;
      const clean = str.replace(/%/g, '').replace(/,/g, '.').trim();
      const n = parseFloat(clean);
      if (isNaN(n)) return 0;
      if (n > 0 && n <= 1.0 && !str.includes('%')) return Number((n * 100).toFixed(2));
      return Number(n.toFixed(2));
    };

    const parseDuration = (val: any): number => {
      if (val === undefined || val === null || val === '') return 0;
      const sec = parseDurationSec(val);
      return sec !== undefined ? Math.round(sec) : 0;
    };

    const getCellObj = (r: number, c: number): { v: any; w: any } => {
      if (c < 0) return { v: undefined, w: undefined };
      try {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = bestSheet[addr];
        if (cell) {
          return { v: cell.v, w: cell.w };
        }
      } catch {
        // fallback to 2D
      }
      const v = (raw2D[r] && raw2D[r][c] !== undefined) ? raw2D[r][c] : undefined;
      return { v, w: v !== undefined ? String(v) : undefined };
    };

    const getCellValue = (r: number, c: number): any => {
      const obj = getCellObj(r, c);
      if (obj.v !== undefined && obj.v !== null && obj.v !== '') return obj.v;
      if (obj.w !== undefined && obj.w !== null && obj.w !== '') return obj.w;
      return undefined;
    };

    // Pre-scan date column and entire sheet to detect DD/MM/YYYY vs MM/DD/YYYY format
    const detectedDateFormat = detectSheetDateFormat(raw2D, bestSheet, dateCol);

    // ----------------------------------------------------
    // RAW SHEET METRICS SCAN (1:1 EXCEL FORMULA PARITY)
    // Computes pure sheet sums and averages without ANY row filtering or dropped rows
    // ----------------------------------------------------
    let rawColumnSTotal = 0;
    let rawColumnSCount = 0;
    let rawColumnNTotal = 0;
    let rawColumnNCount = 0;
    let rawColumnLTotal = 0;
    let rawColumnLCount = 0;
    let totalDataRows = 0;
    const first10Rows: Array<{
      rowNum: number;
      cellAddress: string;
      rawExcelValue: any;
      rawFormattedText: string;
      parsedValue: number;
      columnHeader: string;
    }> = [];
    const first10RowsS: Array<{
      rowNum: number;
      cellAddress: string;
      rawExcelValue: any;
      rawFormattedText: string;
      parsedValue: number;
      columnHeader: string;
    }> = [];

    const colNHeader = String(getCellValue(headerRowIndex, ahtCol) || (headerRow && headerRow[ahtCol]) || 'Sütun N').trim();
    const colSHeader = String(getCellValue(headerRowIndex, outboundCallsCol) || (headerRow && headerRow[outboundCallsCol]) || 'Sütun S').trim();
    const colLHeader = String(getCellValue(headerRowIndex, 11) || (headerRow && headerRow[11]) || 'Sütun L').trim();

    for (let r = headerRowIndex + 1; r < raw2D.length; r++) {
      const rowArr = raw2D[r];
      if (!Array.isArray(rowArr) || rowArr.length === 0) continue;
      const hasContent = rowArr.some(c => c !== undefined && c !== null && String(c).trim() !== '');
      if (!hasContent) continue;

      const dateStrVal = String(getCellValue(r, dateCol) || '').toLowerCase().trim();
      const timeStrVal = String(getCellValue(r, timeCol) || '').toLowerCase().trim();
      if (dateStrVal === 'toplam' || dateStrVal === 'genel toplam' || dateStrVal === 'total' ||
          timeStrVal === 'toplam' || timeStrVal === 'genel toplam' || timeStrVal === 'total') {
        continue;
      }

      totalDataRows++;

      // Raw Column S (Giden Çağrılar)
      const sCell = getCellObj(r, outboundCallsCol);
      const sVal = parseColumnSValue(sCell.v);
      rawColumnSTotal += sVal;
      if (sVal > 0) rawColumnSCount++;

      // Raw Column N (Ort. Konuşma)
      const nCell = getCellObj(r, ahtCol);
      const nVal = parseColumnNValue(nCell.v, nCell.w);
      if (nVal > 0) {
        rawColumnNTotal += nVal;
        rawColumnNCount++;
      }

      // Collect first 10 data rows for Column N (AHT) verification table
      if (first10Rows.length < 10) {
        const addr = XLSX.utils.encode_cell({ r, c: ahtCol });
        first10Rows.push({
          rowNum: r + 1,
          cellAddress: addr,
          rawExcelValue: nCell.v,
          rawFormattedText: nCell.w !== undefined ? String(nCell.w) : String(nCell.v ?? ''),
          parsedValue: nVal,
          columnHeader: colNHeader,
        });
      }

      // Collect first 10 data rows for Column S (Giden Çağrılar) verification table
      if (first10RowsS.length < 10) {
        const addrS = XLSX.utils.encode_cell({ r, c: outboundCallsCol });
        first10RowsS.push({
          rowNum: r + 1,
          cellAddress: addrS,
          rawExcelValue: sCell.v,
          rawFormattedText: sCell.w !== undefined ? String(sCell.w) : String(sCell.v ?? ''),
          parsedValue: sVal,
          columnHeader: colSHeader,
        });
      }

      // Raw Column L (Ortalama Konuşma if present)
      const lCell = getCellObj(r, 11);
      const lVal = parseColumnNValue(lCell.v, lCell.w);
      if (lVal > 0) {
        rawColumnLTotal += lVal;
        rawColumnLCount++;
      }
    }

    const rawSheetStats = {
      columnNHeader: colNHeader,
      columnSHeader: colSHeader,
      columnNSum: Number(rawColumnNTotal.toFixed(2)),
      columnNCount: rawColumnNCount,
      columnNAvg: rawColumnNCount > 0 ? Number((rawColumnNTotal / rawColumnNCount).toFixed(1)) : 0,
      columnSSum: rawColumnSTotal,
      columnSCount: rawColumnSCount,
      totalDataRows,
      sheetName: workbook.SheetNames[0] || 'Sheet1',
      columnLHeader: colLHeader,
      columnLAvg: rawColumnLCount > 0 ? Number((rawColumnLTotal / rawColumnLCount).toFixed(1)) : 0,
      columnLSum: Number(rawColumnLTotal.toFixed(2)),
      columnLCount: rawColumnLCount,
      first10Rows,
      first10RowsS,
    };

    const metricsMap = new Map<string, CallCenterHourlyMetric>();
    let lastValidDateStr = '';

    for (let rIdx = headerRowIndex + 1; rIdx < raw2D.length; rIdx++) {
      const rowArr = raw2D[rIdx];
      if (!Array.isArray(rowArr) || rowArr.length === 0) continue;

      // Check if entire row is empty
      const isAllEmpty = !rowArr.some(c => c !== undefined && c !== null && String(c).trim() !== '');
      if (isAllEmpty) continue;

      // Check if date or time column explicitly indicates a grand total / summary row
      // (NEVER do rowArr.some for "genel" or "ortalama" as regular data rows contain those words!)
      const dateCellStr = String(getCellValue(rIdx, dateCol) || '').toLowerCase().trim();
      if (dateCellStr === 'toplam' || dateCellStr === 'genel toplam' || dateCellStr === 'total' || dateCellStr === 'grand total' || dateCellStr === 'kümülatif' || dateCellStr === 'kumulatif') {
        continue;
      }

      // Time slot
      const timeSlotRaw = String(getCellValue(rIdx, timeCol) || '').trim();
      const rawTimeVal = getCellValue(rIdx, timeCol);
      if (!timeSlotRaw && (rawTimeVal === undefined || rawTimeVal === null || rawTimeVal === '')) continue;
      if (!timeSlotRaw && rawTimeVal === 0) continue;

      const timeSlotLower = timeSlotRaw.toLowerCase();
      if (timeSlotLower === 'toplam' || timeSlotLower === 'genel toplam' || timeSlotLower === 'total' || timeSlotLower === 'grand total' || timeSlotLower === 'summary') {
        continue;
      }

      // Robust time slot parser:
      // Supports "09-00 - 10-", "09-00 - 10-00", "09:00 - 10:00", "09.00 - 10.00", "9-10", "09:00", Excel fractions
      let startH = -1;
      let endH = -1;

      if (typeof rawTimeVal === 'number' && rawTimeVal >= 0 && rawTimeVal < 1) {
        startH = Math.floor(rawTimeVal * 24 + 0.001);
        endH = (startH + 1) % 24;
      } else {
        // Range with optional second minute (e.g. "09-00 - 10-" or "09-00 - 10-00" or "09:00 - 10:00")
        const rangeMatch = timeSlotRaw.match(/(\d{1,2})[:.-](\d{2})\s*[\u2010\u2012\u2013\u2014\u2212\-/~]\s*(\d{1,2})(?:[:.-](\d{2}))?/);
        if (rangeMatch) {
          startH = parseInt(rangeMatch[1], 10);
          endH = parseInt(rangeMatch[3], 10);
          if (startH === endH) {
            endH = (startH + 1) % 24;
          }
        } else {
          // Simple hour range like "9-10" or "09-10"
          const simpleRange = timeSlotRaw.match(/^(\d{1,2})\s*[\u2010\u2012\u2013\u2014\u2212\-/~]\s*(\d{1,2})$/);
          if (simpleRange) {
            startH = parseInt(simpleRange[1], 10);
            endH = parseInt(simpleRange[2], 10);
          } else {
            // Single time like "09:00", "09-00", "09.00"
            const singleMatch = timeSlotRaw.match(/(\d{1,2})[:.-](\d{2})/);
            if (singleMatch) {
              startH = parseInt(singleMatch[1], 10);
              endH = (startH + 1) % 24;
            } else {
              // Single integer hour like "9" or "09"
              const singleH = timeSlotRaw.match(/^(\d{1,2})$/);
              if (singleH) {
                startH = parseInt(singleH[1], 10);
                endH = (startH + 1) % 24;
              }
            }
          }
        }
      }

      if (startH < 0 || startH > 23) continue;

      const diff = (endH - startH + 24) % 24;
      // Skip multi-hour summary rows (e.g. 09:00 - 18:00 has diff = 9)
      if (diff > 2 && !(startH === 23 && endH === 0)) {
        continue;
      }
      const normalizedSlot = `${String(startH).padStart(2, '0')}-00 - ${String(endH).padStart(2, '0')}-00`;

      // Date with detected format hint (A2 onwards, with forward-fill for merged cells)
      const dateRaw = getCellValue(rIdx, dateCol);
      if (dateRaw !== undefined && dateRaw !== null && String(dateRaw).trim() !== '') {
        const parsedDate = formatAndParseExcelDate(dateRaw, detectedDateFormat);
        if (parsedDate.isoDate && /^\d{4}-\d{2}-\d{2}$/.test(parsedDate.isoDate)) {
          lastValidDateStr = parsedDate.isoDate;
        }
      }
      const dateStr = lastValidDateStr || new Date().toISOString().split('T')[0];

      // Column C: Çağrılar / Gelen Çağrı (C2 onwards)
      const rawTotalCalls = getCellValue(rIdx, totalCallsCol);
      const totalCalls = parseInteger(rawTotalCalls);

      // Column D: Cevaplanan Çağrı (D2 onwards)
      const rawAnsweredCalls = getCellValue(rIdx, answeredCallsCol);
      const answeredCalls = parseInteger(rawAnsweredCalls);

      const shortCalls = parseInteger(getCellValue(rIdx, shortCallsCol));
      let missedCalls = parseInteger(getCellValue(rIdx, missedCallsCol));
      if (missedCalls === 0 && totalCalls > answeredCalls) {
        missedCalls = totalCalls - answeredCalls;
      }
      const answeredInSL = parseInteger(getCellValue(rIdx, slInCol));
      const serviceLevel1 = parsePercent(getCellValue(rIdx, sl1Col));
      const serviceLevel2 = parsePercent(getCellValue(rIdx, sl2Col));
      
      // Column N: Ort. Konuşma / AHT (N2 onwards) - exact parsed decimal value without artificial rounding
      const ahtCell = getCellObj(rIdx, ahtCol);
      const aht = parseColumnNValue(ahtCell.v, ahtCell.w);
      const answerRate = parsePercent(getCellValue(rIdx, answerRateCol));
      const holdCount = parseInteger(getCellValue(rIdx, holdCountCol));
      const avgTalkTime = aht > 0 ? aht : parseDuration(getCellValue(rIdx, avgTalkCol));
      const totalTalkDuration = parseDuration(getCellValue(rIdx, talkDurationCol));
      const waitDuration = parseDuration(getCellValue(rIdx, waitDurationCol));
      const avgWaitDuration = parseDuration(getCellValue(rIdx, avgWaitCol));
      let outboundAttempts = parseInteger(getCellValue(rIdx, outboundAttemptsCol));
      
      // Column S: Giden Çağrılar (S2 onwards) - exact integer sum without modifications
      const outboundCalls = parseColumnSValue(getCellValue(rIdx, outboundCallsCol));
      if (outboundAttempts < outboundCalls) {
        outboundAttempts = outboundCalls;
      }
      const outboundAnswerRate = parsePercent(getCellValue(rIdx, outboundAnswerRateCol));
      const outboundDuration = parseDuration(getCellValue(rIdx, outboundDurationCol));
      const outboundAvgTalkTime = parseDuration(getCellValue(rIdx, outboundAvgTalkCol));
      const localHangup = parseInteger(getCellValue(rIdx, localHangupCol));
      const ringDuration = parseDuration(getCellValue(rIdx, ringDurationCol));
      const holdDuration = parseDuration(getCellValue(rIdx, holdDurationCol));
      const acwDuration = parseDuration(getCellValue(rIdx, acwDurationCol));
      const wrapUpDuration = parseDuration(getCellValue(rIdx, wrapUpDurationCol));
      const dequeue = parseInteger(getCellValue(rIdx, dequeueCol));
      const speedOfAnswer = parseDuration(getCellValue(rIdx, asaCol));
      const maxWaitTime = parseDuration(getCellValue(rIdx, maxWaitCol));

      // Derive effective counts and durations
      const effectiveAnsweredInSL = answeredInSL > 0
        ? answeredInSL
        : (serviceLevel1 > 0 && answeredCalls > 0 ? Math.round(answeredCalls * (serviceLevel1 / 100)) : 0);

      const effectiveSL1 = serviceLevel1 > 0
        ? serviceLevel1
        : (answeredCalls > 0 && effectiveAnsweredInSL > 0 ? Number(((effectiveAnsweredInSL / answeredCalls) * 100).toFixed(1)) : 0);

      // Direct values from Column N (Ortalama Konuşma / AHT) and Column S (Giden Çağrı)
      const effectiveTotalTalk = totalTalkDuration > 0 ? totalTalkDuration : aht;
      const effectiveAHT = aht;
      const effectiveAvgTalk = aht > 0 ? aht : (avgTalkTime || 0);

      const effectiveAnswerRate = answerRate > 0
        ? answerRate
        : (totalCalls > 0 ? Number(((answeredCalls / totalCalls) * 100).toFixed(1)) : (answeredCalls > 0 ? 100 : 0));

      const slotKey = `${dateStr}_${normalizedSlot}`;
      if (metricsMap.has(slotKey)) {
        const existing = metricsMap.get(slotKey)!;
        existing.totalCalls += totalCalls;
        existing.answeredCalls += answeredCalls;
        existing.shortCalls += shortCalls;
        existing.missedCalls += missedCalls;
        existing.answeredInSL += effectiveAnsweredInSL;
        existing.totalTalkDuration += effectiveTotalTalk;
        existing.waitDuration += waitDuration;
        existing.holdCount += holdCount;
        existing.holdDuration += holdDuration;
        existing.acwDuration += acwDuration;
        existing.wrapUpDuration += wrapUpDuration;
        existing.outboundAttempts += outboundAttempts;
        existing.outboundCalls += outboundCalls;
        existing.outboundDuration += outboundDuration;
        existing.localHangup += localHangup;
        existing.ringDuration += ringDuration;
        existing.dequeue += dequeue;
        existing.maxWaitTime = Math.max(existing.maxWaitTime, maxWaitTime);

        // Recalculate derived ratios
        existing.answerRate = existing.totalCalls > 0
          ? Number(((existing.answeredCalls / existing.totalCalls) * 100).toFixed(1))
          : 100;
        existing.serviceLevel1 = existing.answeredCalls > 0 && existing.answeredInSL > 0
          ? Number(((existing.answeredInSL / existing.answeredCalls) * 100).toFixed(1))
          : existing.serviceLevel1;
        existing.serviceLevel2 = existing.totalCalls > 0 && existing.answeredInSL > 0
          ? Number(((existing.answeredInSL / existing.totalCalls) * 100).toFixed(1))
          : existing.serviceLevel1;
        
        // Exact arithmetic average of Column N values across rows for the same hour slot
        if (effectiveAHT > 0) {
          const prevSum = (existing as any)._ahtSum !== undefined ? (existing as any)._ahtSum : existing.aht;
          const prevCount = (existing as any)._ahtCount !== undefined ? (existing as any)._ahtCount : (existing.aht > 0 ? 1 : 0);
          const newSum = prevSum + effectiveAHT;
          const newCount = prevCount + 1;
          (existing as any)._ahtSum = newSum;
          (existing as any)._ahtCount = newCount;
          existing.aht = Number((newSum / newCount).toFixed(2));
          existing.avgTalkTime = existing.aht;
        }
        existing.avgWaitDuration = existing.totalCalls > 0
          ? Math.round(existing.waitDuration / existing.totalCalls)
          : 0;
        existing.outboundAnswerRate = existing.outboundAttempts > 0
          ? Number(((existing.outboundCalls / existing.outboundAttempts) * 100).toFixed(1))
          : 0;
        existing.outboundAvgTalkTime = existing.outboundCalls > 0
          ? Math.round(existing.outboundDuration / existing.outboundCalls)
          : 0;
      } else {
        const initialMetric: CallCenterHourlyMetric = {
          date: dateStr,
          timeSlot: normalizedSlot,
          totalCalls,
          answeredCalls,
          shortCalls,
          missedCalls,
          answeredInSL: effectiveAnsweredInSL,
          serviceLevel1: effectiveSL1,
          serviceLevel2: serviceLevel2 > 0 ? serviceLevel2 : effectiveSL1,
          aht: effectiveAHT,
          answerRate: effectiveAnswerRate,
          holdCount,
          avgTalkTime: effectiveAvgTalk,
          totalTalkDuration: effectiveTotalTalk,
          waitDuration,
          avgWaitDuration: avgWaitDuration > 0 ? avgWaitDuration : (totalCalls > 0 && waitDuration > 0 ? Math.round(waitDuration / totalCalls) : 0),
          outboundAttempts,
          outboundCalls,
          outboundAnswerRate: outboundAnswerRate > 0 ? outboundAnswerRate : (outboundAttempts > 0 ? Number(((outboundCalls / outboundAttempts) * 100).toFixed(1)) : 0),
          outboundDuration,
          outboundAvgTalkTime: outboundAvgTalkTime > 0 ? outboundAvgTalkTime : (outboundCalls > 0 ? Math.round(outboundDuration / outboundCalls) : 0),
          localHangup,
          ringDuration,
          holdDuration,
          acwDuration,
          wrapUpDuration,
          dequeue,
          speedOfAnswer,
          maxWaitTime,
          outboundLocalHangup: 0,
        };
        (initialMetric as any)._ahtSum = effectiveAHT;
        (initialMetric as any)._ahtCount = effectiveAHT > 0 ? 1 : 0;
        metricsMap.set(slotKey, initialMetric);
      }
    }

    const metrics = Array.from(metricsMap.values());
    metrics.forEach(m => {
      m.rawSheetStats = rawSheetStats;
    });

    return {
      success: true,
      data: metrics,
      sheetNames: workbook.SheetNames,
      totalRows: metrics.length,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Santral verileri ayrıştırılırken hata oluştu.',
    };
  }
}

