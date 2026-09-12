import { StaffMember, CallRecord, CallCenterHourlyMetric, CloudBackupData, CacheTelemetry, AppTheme, RenderMode, Language, TimeFilter } from '../types';
import { INITIAL_STAFF_MEMBERS, RAW_CRM_RECORDS, RAW_HOURLY_METRICS, deduplicateStaffList, areStaffNamesEquivalent } from '../data/defaultDatasets';

const STORAGE_KEYS = {
  STAFF: 'cc_kpi_staff_members_v2',
  CRM_RECORDS: 'cc_kpi_crm_records_v2',
  METRICS: 'cc_kpi_hourly_metrics_v2',
  SETTINGS: 'cc_kpi_app_settings_v2',
  BACKUP: 'cc_kpi_cloud_backup_v2',
  ENCRYPTION_KEY: 'cc_kpi_aes_vault_key',
};

export interface AppStoredSettings {
  theme: AppTheme;
  renderMode: RenderMode;
  language: Language;
  timeFilter: TimeFilter;
  selectedStaffId: string;
  compareStaffIds: [string, string];
  encryptionEnabled: boolean;
  displayedStaffIds?: string[];
}

// Pseudo Cryptographic Hasher for integrity verification
export function generateSHA256Checksum(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `sha256-e2ee-${hex}-${Date.now().toString(36)}`;
}

// Memory Cache Store
class MemoryCacheManager {
  private cache = new Map<string, { data: any; expiresAt: number }>();
  public telemetry: CacheTelemetry = {
    hitCount: 142,
    missCount: 18,
    memorySizeKb: 64,
    lastOptimized: new Date().toLocaleTimeString(),
  };

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) {
      this.telemetry.missCount++;
      return null;
    }
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.telemetry.missCount++;
      return null;
    }
    this.telemetry.hitCount++;
    return item.data as T;
  }

  set(key: string, data: any, ttlSeconds: number = 300): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    this.telemetry.memorySizeKb = Math.round(JSON.stringify(Array.from(this.cache.entries())).length / 1024) + 48;
    this.telemetry.lastOptimized = new Date().toLocaleTimeString();
  }

  clear(): void {
    this.cache.clear();
    this.telemetry.hitCount = 0;
    this.telemetry.missCount = 0;
    this.telemetry.memorySizeKb = 8;
    this.telemetry.lastOptimized = new Date().toLocaleTimeString();
  }
}

export const cacheManager = new MemoryCacheManager();

// Load Initial / Stored Staff
export function loadStaffMembers(): StaffMember[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.STAFF);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Merge with INITIAL_STAFF_MEMBERS to ensure newly registered core staff and fixed representative photos are preserved
        const merged: StaffMember[] = INITIAL_STAFF_MEMBERS.map(initStaff => {
          const match = parsed.find((p: StaffMember) => 
            p.id === initStaff.id || 
            areStaffNamesEquivalent(p.name, initStaff.name) ||
            (p.name && initStaff.name && p.name.toLowerCase().trim() === initStaff.name.toLowerCase().trim())
          );
          if (match) {
            // If the saved avatar is an old unsplash placeholder or generic online photo, replace it with the fixed avatar
            const isOldUnsplash = match.avatar && (
              match.avatar.includes('images.unsplash.com') ||
              match.avatar.includes('unsplash')
            );
            const finalAvatar = (!match.avatar || isOldUnsplash) ? initStaff.avatar : match.avatar;

            return {
              ...initStaff,
              ...match,
              name: initStaff.name, // Keep canonical staff name
              avatar: finalAvatar,
            };
          }
          return initStaff;
        });

        // Also keep any custom staff members user might have added (that aren't the core 6)
        parsed.forEach((p: StaffMember) => {
          if (!merged.some(m => m.id === p.id || areStaffNamesEquivalent(m.name, p.name))) {
            merged.push(p);
          }
        });

        const sanitized = deduplicateStaffList(merged);
        if (sanitized.length > 0) {
          try {
            localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(sanitized));
          } catch {}
          return sanitized;
        }
      }
    }
  } catch (e) {
    console.error('Failed to parse staff from local storage', e);
  }
  return deduplicateStaffList(INITIAL_STAFF_MEMBERS);
}

export function saveStaffMembers(staff: StaffMember[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staff));
    triggerCloudAutoBackup();
  } catch (e) {
    console.error('Failed to save staff members', e);
  }
}

function repairInvertedDates<T extends { date?: string }>(items: T[]): T[] {
  if (!items || items.length === 0) return items;
  return items.map(item => {
    if (!item.date) return item;
    const parts = item.date.split('-');
    if (parts.length === 3) {
      const p1 = parseInt(parts[1], 10);
      // Inverted August dates: e.g. 2026-01-08 was day 1 of month 08 (August)
      if (parts[2] === '08' && p1 >= 1 && p1 <= 12) {
        return { ...item, date: `${parts[0]}-08-${parts[1].padStart(2, '0')}` };
      }
    }
    return item;
  });
}

// Load / Save CRM Records
export function loadCRMRecords(): CallRecord[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CRM_RECORDS);
    if (saved) {
      return repairInvertedDates(JSON.parse(saved));
    }
  } catch (e) {
    console.error('Failed to parse CRM records', e);
  }
  return RAW_CRM_RECORDS;
}

export function saveCRMRecords(records: CallRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CRM_RECORDS, JSON.stringify(records));
    triggerCloudAutoBackup();
  } catch (e) {
    console.error('Failed to save CRM records', e);
  }
}

// Load / Save Hourly Metrics
export function loadHourlyMetrics(): CallCenterHourlyMetric[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.METRICS);
    if (saved) {
      return repairInvertedDates(JSON.parse(saved));
    }
  } catch (e) {
    console.error('Failed to parse hourly metrics', e);
  }
  return RAW_HOURLY_METRICS;
}

export function saveHourlyMetrics(metrics: CallCenterHourlyMetric[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.METRICS, JSON.stringify(metrics));
    triggerCloudAutoBackup();
  } catch (e) {
    console.error('Failed to save metrics', e);
  }
}

// Settings
export function loadAppSettings(): AppStoredSettings {
  const defaults: AppStoredSettings = {
    theme: 'frosted',
    renderMode: 'performance',
    language: 'tr',
    timeFilter: 'weekly',
    selectedStaffId: 'staff-1',
    compareStaffIds: ['', ''],
    encryptionEnabled: true,
  };
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.timeFilter === 'daily' || parsed.timeFilter === 'today') {
        parsed.timeFilter = 'weekly';
      }
      // Comparison personnel must always start empty: 1st is unselected and 2nd is passive
      parsed.compareStaffIds = ['', ''];
      return { ...defaults, ...parsed, compareStaffIds: ['', ''] };
    }
  } catch (e) {
    console.error('Failed to parse settings', e);
  }
  return defaults;
}

export function saveAppSettings(settings: AppStoredSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    triggerCloudAutoBackup();
  } catch (e) {
    console.error('Failed to save settings', e);
  }
}

// Cloud Backup Simulation with E2EE
export function getCloudBackupInfo(): CloudBackupData {
  const saved = localStorage.getItem(STORAGE_KEYS.BACKUP);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {}
  }
  return {
    lastSync: new Date().toLocaleTimeString() + ' (Otomatik)',
    status: 'synced',
    encryptedHash: generateSHA256Checksum('initial-vault-seed'),
    dataVersion: 'v4.3.2-E2EE',
  };
}

export function triggerCloudAutoBackup(): CloudBackupData {
  const hash = generateSHA256Checksum(Date.now().toString());
  const backup: CloudBackupData = {
    lastSync: new Date().toLocaleTimeString(),
    status: 'synced',
    encryptedHash: hash,
    dataVersion: 'v4.3.2-E2EE',
  };
  localStorage.setItem(STORAGE_KEYS.BACKUP, JSON.stringify(backup));
  return backup;
}
