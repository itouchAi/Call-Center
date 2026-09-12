/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  StaffMember, CallRecord, CallCenterHourlyMetric, AppTheme, RenderMode, Language, TimeFilter, CloudBackupData 
} from './types';
import { 
  loadStaffMembers, saveStaffMembers, 
  loadCRMRecords, saveCRMRecords, 
  loadHourlyMetrics, saveHourlyMetrics, 
  loadAppSettings, saveAppSettings,
  getCloudBackupInfo, triggerCloudAutoBackup
} from './utils/storageAndSecurity';
import { INITIAL_STAFF_MEMBERS, RAW_CRM_RECORDS, RAW_HOURLY_METRICS, extractStaffFromRecords } from './data/defaultDatasets';
import { deriveHourlyMetricsFromCRM } from './utils/excelParser';
import { getT } from './utils/translations';
import { Navbar } from './components/Navbar';
import { PersonnelKPIView } from './components/PersonnelKPIView';
import { CallCenterMetricsView } from './components/CallCenterMetricsView';
import { ComparisonMatrixView } from './components/ComparisonMatrixView';
import { DataImportModal } from './components/DataImportModal';
import { StaffProfileModal } from './components/StaffProfileModal';
import { SecurityAndCloudModal } from './components/SecurityAndCloudModal';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { ThreeCanvas3D } from './components/ThreeCanvas3D';
import { ReactiveCursor } from './components/ReactiveCursor';
import { Cpu, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';

const FALLBACK_STAFF: StaffMember = {
  id: 'staff-fallback',
  name: 'Seçili Personel Yok',
  title: 'Teknik Destek Uzmanı',
  role: 'Destek Danışmanı',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  email: 'destek@callcenter.com',
  extension: '4100',
  status: 'available',
  color: '#06b6d4',
  joinDate: '2023-01-01',
  skills: ['Ağ Teknolojileri', 'Teknik Destek'],
  bio: '',
};

export default function App() {
  const [settings, setSettings] = useState(loadAppSettings);
  const [staffList, setStaffList] = useState<StaffMember[]>(() => {
    const loaded = loadStaffMembers();
    return loaded && loaded.length > 0 ? loaded : INITIAL_STAFF_MEMBERS;
  });
  const [crmRecords, setCrmRecords] = useState<CallRecord[]>(loadCRMRecords);
  const [hourlyMetrics, setHourlyMetrics] = useState<CallCenterHourlyMetric[]>(loadHourlyMetrics);
  const [cloudBackup, setCloudBackup] = useState<CloudBackupData>(getCloudBackupInfo);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalcNotice, setRecalcNotice] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'personnel' | 'callcenter' | 'comparison'>('personnel');

  // Modals state
  const [isDataImportOpen, setIsDataImportOpen] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);

  // Selected Staff for KPI View (with safe fallback)
  const selectedStaff = staffList.find(s => s.id === settings.selectedStaffId) || staffList[0] || FALLBACK_STAFF;

  // Head-to-head comparison IDs (always start empty so 1st shows "Personel Seçiniz" and 2nd is passive until 1st is chosen)
  const [primaryCompareId, setPrimaryCompareId] = useState<string>('');
  const [secondaryCompareId, setSecondaryCompareId] = useState<string>('');

  // Displayed Staff IDs (up to 6)
  const [displayedStaffIds, setDisplayedStaffIds] = useState<string[]>(() => {
    if (settings.displayedStaffIds && settings.displayedStaffIds.length > 0) {
      return settings.displayedStaffIds.slice(0, 6);
    }
    return staffList.slice(0, 6).map(s => s.id);
  });

  const handleUpdateDisplayedStaffIds = (newIds: string[]) => {
    const limited = newIds.slice(0, 6);
    setDisplayedStaffIds(limited);
    setSettings(prev => ({ ...prev, displayedStaffIds: limited }));
  };

  const t = getT(settings.language);

  // Save changes to settings & auto backup
  useEffect(() => {
    saveAppSettings({
      ...settings,
      selectedStaffId: selectedStaff.id,
      compareStaffIds: [primaryCompareId, secondaryCompareId],
      displayedStaffIds,
    });
  }, [settings, selectedStaff.id, primaryCompareId, secondaryCompareId, displayedStaffIds]);

  // Handlers
  const handleSelectStaff = (staff: StaffMember) => {
    setSettings(prev => ({ ...prev, selectedStaffId: staff.id }));
  };

  const handleSaveStaff = (updated: StaffMember) => {
    const nextList = staffList.map(s => s.id === updated.id ? updated : s);
    setStaffList(nextList);
    saveStaffMembers(nextList);
    const backup = triggerCloudAutoBackup();
    setCloudBackup(backup);
  };

  const handleUpdateStaffList = (updatedList: StaffMember[]) => {
    setStaffList(updatedList);
    saveStaffMembers(updatedList);
    const backup = triggerCloudAutoBackup();
    setCloudBackup(backup);
  };

  const handleRecalculateData = () => {
    setIsRecalculating(true);
    setRecalcNotice(t.recalculatingMessage);

    setTimeout(() => {
      // Re-extract dynamic staff and sync completely from active CRM records
      const syncedStaff = extractStaffFromRecords(crmRecords, staffList);
      setStaffList(syncedStaff);
      saveStaffMembers(syncedStaff);
      setCrmRecords([...crmRecords]);
      setHourlyMetrics([...hourlyMetrics]);
      const backup = triggerCloudAutoBackup();
      setCloudBackup(backup);
      setIsRecalculating(false);
      setRecalcNotice(t.recalculateSuccess);

      setTimeout(() => {
        setRecalcNotice(null);
      }, 3500);
    }, 600);
  };

  const handleImportCRM = (newRecords: CallRecord[], headers?: string[]) => {
    setIsRecalculating(true);
    setRecalcNotice(`${newRecords.length} CRM kaydı işleniyor, personel kadrosu ayrıştırılıyor ve KPI skorları hesaplanıyor...`);
    if (headers && headers.length > 0) {
      setDetectedHeaders(headers);
    }

    setTimeout(() => {
      // Extract staff members automatically from the uploaded file!
      const newStaffList = extractStaffFromRecords(newRecords, staffList);
      
      setCrmRecords(newRecords);
      saveCRMRecords(newRecords);
      
      setStaffList(newStaffList);
      saveStaffMembers(newStaffList);

      // Auto-derive hourly metrics from CRM records ONLY if no dedicated hourlyMetrics exist
      setHourlyMetrics(prevHourly => {
        if (!prevHourly || prevHourly.length === 0) {
          const derivedHourly = deriveHourlyMetricsFromCRM(newRecords);
          if (derivedHourly && derivedHourly.length > 0) {
            saveHourlyMetrics(derivedHourly);
            return derivedHourly;
          }
        }
        return prevHourly;
      });

      if (newStaffList.length > 0) {
        const topStaffId = newStaffList[0].id;
        const secondStaffId = newStaffList[1]?.id || newStaffList[0].id;
        const newDisplayed = newStaffList.slice(0, 6).map(s => s.id);
        setDisplayedStaffIds(newDisplayed);
        setSettings(prev => ({
          ...prev,
          selectedStaffId: topStaffId,
          compareStaffIds: ['', ''],
          displayedStaffIds: newDisplayed,
        }));
        setPrimaryCompareId('');
        setSecondaryCompareId('');
      }

      const backup = triggerCloudAutoBackup();
      setCloudBackup(backup);
      setIsRecalculating(false);
      setRecalcNotice(`✓ ${newRecords.length} CRM kaydı ve ${newStaffList.length} temsilci başarıyla sisteme aktarıldı. Tüm grafikler güncellendi.`);

      setTimeout(() => {
        setRecalcNotice(null);
      }, 4000);
    }, 600);
  };

  const handleImportHourlyMetrics = (newMetrics: CallCenterHourlyMetric[]) => {
    setIsRecalculating(true);
    setRecalcNotice(`${newMetrics.length} santral saat slotu analiz ediliyor...`);

    setTimeout(() => {
      setHourlyMetrics(newMetrics);
      saveHourlyMetrics(newMetrics);
      const backup = triggerCloudAutoBackup();
      setCloudBackup(backup);
      setIsRecalculating(false);
      setRecalcNotice(`✓ ${newMetrics.length} saatlik santral metriği başarıyla yüklendi ve kuyruk analizi güncellendi.`);

      setTimeout(() => {
        setRecalcNotice(null);
      }, 4000);
    }, 600);
  };

  const handleResetDefaults = () => {
    setIsRecalculating(true);
    setRecalcNotice('Tüm veriler varsayılan fabrika ayarlarına sıfırlanıyor ve yeniden hesaplanıyor...');

    setTimeout(() => {
      setStaffList(INITIAL_STAFF_MEMBERS);
      saveStaffMembers(INITIAL_STAFF_MEMBERS);
      setCrmRecords(RAW_CRM_RECORDS);
      saveCRMRecords(RAW_CRM_RECORDS);
      setHourlyMetrics(RAW_HOURLY_METRICS);
      saveHourlyMetrics(RAW_HOURLY_METRICS);
      const defaultDisplayed = INITIAL_STAFF_MEMBERS.map(s => s.id);
      setDisplayedStaffIds(defaultDisplayed);
      setSettings(prev => ({
        ...prev,
        selectedStaffId: 'staff-1',
        compareStaffIds: ['', ''],
        displayedStaffIds: defaultDisplayed,
      }));
      setPrimaryCompareId('');
      setSecondaryCompareId('');

      const backup = triggerCloudAutoBackup();
      setCloudBackup(backup);
      setIsRecalculating(false);
      setRecalcNotice(t.resetSuccess);

      setTimeout(() => {
        setRecalcNotice(null);
      }, 3500);
    }, 500);
  };

  const handleClearAllData = () => {
    setIsRecalculating(true);
    setRecalcNotice('Tüm veriler sıfırlanıyor ve temizleniyor...');

    setTimeout(() => {
      setCrmRecords([]);
      saveCRMRecords([]);
      setHourlyMetrics([]);
      saveHourlyMetrics([]);
      setStaffList([]);
      saveStaffMembers([]);
      setSettings(prev => ({
        ...prev,
        selectedStaffId: '',
        compareStaffIds: ['', ''],
      }));
      setPrimaryCompareId('');
      setSecondaryCompareId('');

      const backup = triggerCloudAutoBackup();
      setCloudBackup(backup);
      setIsRecalculating(false);
      setRecalcNotice('Tüm veriler başarıyla sıfırlandı. Yeni bir Excel dosyası yükleyebilirsiniz.');

      setTimeout(() => {
        setRecalcNotice(null);
      }, 3500);
    }, 500);
  };

  const handleCompareWith = (staff: StaffMember) => {
    setPrimaryCompareId(staff.id);
    setSecondaryCompareId('');
    setActiveTab('comparison');
  };

  // Theme Class
  const themeClass = settings.theme === 'frosted'
    ? 'theme-frosted'
    : settings.theme === 'cyberpunk' 
    ? 'theme-cyberpunk' 
    : settings.theme === 'titanium' 
    ? 'theme-titanium' 
    : 'theme-enterprise';

  return (
    <div className={`min-h-screen relative text-slate-100 ${themeClass} transition-colors duration-700`}>
      {/* 3D Three.js Interactive Canvas in Performance Mode */}
      <ThreeCanvas3D theme={settings.theme} renderMode={settings.renderMode} />

      {/* Reactive Laser Cursor Follower */}
      <ReactiveCursor renderMode={settings.renderMode} />

      {/* Navbar Header */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        language={settings.language}
        onLanguageChange={(lang) => setSettings(prev => ({ ...prev, language: lang }))}
        theme={settings.theme}
        onThemeChange={(th) => setSettings(prev => ({ ...prev, theme: th }))}
        renderMode={settings.renderMode}
        onRenderModeChange={(rm) => setSettings(prev => ({ ...prev, renderMode: rm }))}
        onOpenDataImport={() => setIsDataImportOpen(true)}
        onOpenSecurity={() => setIsSecurityOpen(true)}
        cloudBackup={cloudBackup}
        onRecalculateData={handleRecalculateData}
        onResetData={handleResetDefaults}
        onClearAllData={handleClearAllData}
        isRecalculating={isRecalculating}
      />

      {/* System Recalculation Active Toast / Banner */}
      {recalcNotice && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 max-w-md">
          <div className="flex items-center space-x-3 rounded-2xl border border-cyan-400/50 bg-slate-950/95 p-4 shadow-2xl shadow-cyan-500/30 backdrop-blur-2xl ring-1 ring-cyan-400/30">
            {isRecalculating ? (
              <Cpu className="h-6 w-6 text-cyan-400 animate-spin shrink-0" />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
            )}
            <div className="flex-1">
              <p className="text-xs font-bold text-white tracking-wide">
                {isRecalculating ? 'YAPAY ZEKA & KPI MOTORU' : 'HESAPLAMA TAMAMLANDI'}
              </p>
              <p className="text-xs text-slate-300 mt-0.5">{recalcNotice}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <AppErrorBoundary onResetDefaults={handleResetDefaults}>
          {/* Personnel KPI Tab */}
          {(activeTab === 'personnel' || activeTab === 'dashboard') && (
            <PersonnelKPIView
              staffList={staffList}
              selectedStaff={selectedStaff}
              onSelectStaff={handleSelectStaff}
              crmRecords={crmRecords}
              hourlyMetrics={hourlyMetrics}
              language={settings.language}
              renderMode={settings.renderMode}
              theme={settings.theme}
              timeFilter={settings.timeFilter}
              onTimeFilterChange={(filter) => setSettings(prev => ({ ...prev, timeFilter: filter }))}
              onEditStaff={(s) => setEditingStaff(s)}
              onCompareWith={handleCompareWith}
              onOpenDataImport={() => setIsDataImportOpen(true)}
              onResetDefaults={handleResetDefaults}
              detectedHeaders={detectedHeaders}
              displayedStaffIds={displayedStaffIds}
              onUpdateDisplayedStaffIds={handleUpdateDisplayedStaffIds}
              onUpdateStaffList={handleUpdateStaffList}
            />
          )}

          {/* Dedicated Call Center Metrics Tab */}
          {activeTab === 'callcenter' && (
            <CallCenterMetricsView
              hourlyMetrics={hourlyMetrics}
              crmRecords={crmRecords}
              language={settings.language}
              renderMode={settings.renderMode}
              theme={settings.theme}
              timeFilter={settings.timeFilter}
              onTimeFilterChange={(filter) => setSettings(prev => ({ ...prev, timeFilter: filter }))}
            />
          )}

          {/* Personnel Head-to-Head Comparison Tab */}
          {activeTab === 'comparison' && (
            <ComparisonMatrixView
              staffList={staffList}
              primaryStaffId={primaryCompareId}
              secondaryStaffId={secondaryCompareId}
              onSelectPrimary={setPrimaryCompareId}
              onSelectSecondary={setSecondaryCompareId}
              crmRecords={crmRecords}
              hourlyMetrics={hourlyMetrics}
              language={settings.language}
              renderMode={settings.renderMode}
              theme={settings.theme}
              timeFilter={settings.timeFilter}
            />
          )}
        </AppErrorBoundary>
      </main>

      {/* Modals */}
      <DataImportModal
        isOpen={isDataImportOpen}
        onClose={() => setIsDataImportOpen(false)}
        language={settings.language}
        onImportCRM={handleImportCRM}
        onImportHourlyMetrics={handleImportHourlyMetrics}
        onResetDefaults={handleResetDefaults}
        onClearAll={handleClearAllData}
        currentCRMCount={crmRecords.length}
        currentMetricsCount={hourlyMetrics.length}
      />

      <StaffProfileModal
        isOpen={!!editingStaff}
        onClose={() => setEditingStaff(null)}
        staff={editingStaff}
        onSaveStaff={handleSaveStaff}
        language={settings.language}
      />

      <SecurityAndCloudModal
        isOpen={isSecurityOpen}
        onClose={() => setIsSecurityOpen(false)}
        language={settings.language}
        cloudBackup={cloudBackup}
        onBackupUpdated={setCloudBackup}
      />
    </div>
  );
}
