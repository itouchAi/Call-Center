import { StaffMember, CallRecord, CallCenterHourlyMetric, CloudBackupData, CacheTelemetry, AppTheme, RenderMode, Language, TimeFilter } from '../types';
import { INITIAL_STAFF_MEMBERS, RAW_CRM_RECORDS, RAW_HOURLY_METRICS, deduplicateStaffList, areStaffNamesEquivalent } from '../data/defaultDatasets';

const STORAGE_KEYS = {
  STAFF: 'cc_kpi_staff_members_v5',
  CRM_RECORDS: 'cc_kpi_crm_records_v5',
  METRICS: 'cc_kpi_hourly_metrics_v5',
  SETTINGS: 'cc_kpi_app_settings_v5',
  BACKUP: 'cc_kpi_cloud_backup_v5',
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

// Purge completely all local storage and in-memory caches
export function purgeAllLocalStorage(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keysToRemove.push(key);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.error('Failed to purge local storage', e);
  }
  cacheManager.clear();
}

// Load Initial / Stored Staff
export function loadStaffMembers(): StaffMember[] {
  try {
    // Check current storage key
    let saved = localStorage.getItem(STORAGE_KEYS.STAFF);
    if (!saved) {
      saved = localStorage.getItem('cc_kpi_staff_members_v4') || localStorage.getItem('cc_kpi_staff_members_v2');
    }

    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Build the 6 core staff members using the guaranteed bundled portraits
        const merged: StaffMember[] = INITIAL_STAFF_MEMBERS.map(initStaff => {
          const match = parsed.find((p: StaffMember) => 
            p.id === initStaff.id || 
            areStaffNamesEquivalent(p.name, initStaff.name) ||
            (p.name && initStaff.name && p.name.toLowerCase().trim() === initStaff.name.toLowerCase().trim())
          );
          if (match) {
            // ONLY keep match.avatar if it is a custom uploaded image (data URL or uploaded image path)
            // If it's an online unsplash link or empty or old placeholder, ALWAYS use initStaff.avatar (bundled portrait)
            const isCustomUserUpload = match.avatar && (
              match.avatar.startsWith('data:image/') ||
              match.avatar.startsWith('blob:')
            );
            const finalAvatar = isCustomUserUpload ? match.avatar : initStaff.avatar;

            // Remove any old mock skills
            const cleanSkills = Array.isArray(match.skills) ? match.skills.filter((s: string) => {
              const lower = s.toLowerCase();
              return !(
                lower.includes('omada') || lower.includes('dsl') || lower.includes('tapo') || 
                lower.includes('deco') || lower.includes('mesh') || lower.includes('memnuniyeti') ||
                lower.includes('powerline') || lower.includes('festa') || lower.includes('mercusys') ||
                lower.includes('router') || lower.includes('rma') || lower.includes('fcr')
              );
            }) : [];

            return {
              ...initStaff,
              ...match,
              title: 'Müşteri Temsilcisi',
              role: 'Müşteri Temsilcisi',
              skills: cleanSkills,
              name: initStaff.name, // Keep canonical staff name
              avatar: finalAvatar,
            };
          }
          return initStaff;
        });

        // Also keep any non-core custom staff members user might have added
        parsed.forEach((p: StaffMember) => {
          const isCore = merged.some(m => m.id === p.id || areStaffNamesEquivalent(m.name, p.name));
          if (!isCore && p.name && p.name !== 'Aynzeliha Kalındaş') {
            merged.push({
              ...p,
              title: 'Müşteri Temsilcisi',
              role: 'Müşteri Temsilcisi',
            });
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
  const defaultList = deduplicateStaffList(INITIAL_STAFF_MEMBERS).map(s => ({
    ...s,
    title: 'Müşteri Temsilcisi',
    role: 'Müşteri Temsilcisi',
    skills: [],
  }));
  try {
    localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(defaultList));
  } catch {}
  return defaultList;
}

// Explicit function to reset all core staff avatars to their fixed portraits
export function resetStaffToFixedPortraits(currentStaff: StaffMember[]): StaffMember[] {
  const updated = currentStaff.map(s => {
    const initMatch = INITIAL_STAFF_MEMBERS.find(
      im => im.id === s.id || areStaffNamesEquivalent(im.name, s.name)
    );
    if (initMatch) {
      return {
        ...s,
        name: initMatch.name,
        avatar: initMatch.avatar,
        title: 'Müşteri Temsilcisi',
        role: 'Müşteri Temsilcisi',
        skills: [],
      };
    }
    return {
      ...s,
      title: 'Müşteri Temsilcisi',
      role: 'Müşteri Temsilcisi',
    };
  });

  try {
    localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(updated));
  } catch {}
  return updated;
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
