import React, { useState, useRef, useEffect } from 'react';
import { Language, AppTheme, RenderMode, CloudBackupData } from '../types';
import { getT } from '../utils/translations';
import { 
  Headphones, Users, Activity, Swords, FileSpreadsheet, ShieldCheck, 
  Sparkles, Zap, Palette, Globe, Layers, ChevronDown, Check,
  Cpu, RotateCcw
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'dashboard' | 'personnel' | 'callcenter' | 'comparison';
  onTabChange: (tab: 'dashboard' | 'personnel' | 'callcenter' | 'comparison') => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  theme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  renderMode: RenderMode;
  onRenderModeChange: (mode: RenderMode) => void;
  onOpenDataImport: () => void;
  onOpenSecurity: () => void;
  cloudBackup: CloudBackupData;
  onRecalculateData: () => void;
  onResetData: () => void;
  onClearAllData?: () => void;
  isRecalculating: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  language,
  onLanguageChange,
  theme,
  onThemeChange,
  renderMode,
  onRenderModeChange,
  onOpenDataImport,
  onOpenSecurity,
  cloudBackup,
  onRecalculateData,
  onResetData,
  onClearAllData,
  isRecalculating,
}) => {
  const t = getT(language);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setIsThemeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectTheme = (selected: AppTheme) => {
    onThemeChange(selected);
    setIsThemeOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#0b0e14]/80 backdrop-blur-2xl transition-colors duration-500 shadow-[0_4px_24px_0_rgba(0,0,0,0.35)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2">
          {/* Logo & Branding */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onTabChange('personnel')}>
            <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-purple-600 p-0.5 shadow-lg shadow-cyan-500/25">
              <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-950">
                <Headphones className="h-5 w-5 text-cyan-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white font-sans">
                  NEXUS <span className="text-cyan-400">3D KPI</span> ENGINE
                </h1>
                <span className="hidden sm:inline-flex rounded-full bg-cyan-500/10 border border-cyan-400/30 px-2 py-0.5 text-[9px] font-mono font-bold text-cyan-300">
                  v4.3.2
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden md:block">
                TPLink & Sinerji Çağrı Merkezi Performans Skalası
              </p>
            </div>
          </div>

          {/* Quick Engine, Theme, Language & Tools */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Visual Engine Mode Toggle (Performance 3D vs Minimal Efficiency) */}
            <div className="flex items-center rounded-xl border border-white/10 bg-slate-900/80 p-1">
              <button
                type="button"
                id="render-performance-btn"
                onClick={() => onRenderModeChange('performance')}
                className={`flex items-center space-x-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  renderMode === 'performance'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Maksimum Performans: Unreal 5 3D Parçacıklar, Hareketli Işık & Bokeh"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">3D Unreal</span>
              </button>
              <button
                type="button"
                id="render-efficiency-btn"
                onClick={() => onRenderModeChange('efficiency')}
                className={`flex items-center space-x-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  renderMode === 'efficiency'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Maksimum Verim: Minimal, Ultra Hızlı & Sade"
              >
                <Zap className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Maks Verim</span>
              </button>
            </div>

            {/* Themes Switcher */}
            <div ref={themeMenuRef} className="relative">
              <button
                type="button"
                id="theme-selector-btn"
                onClick={() => setIsThemeOpen(!isThemeOpen)}
                className="flex items-center space-x-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-white/30 hover:text-white backdrop-blur-md transition-all active:scale-95"
              >
                <Palette className="h-3.5 w-3.5 text-sky-400" />
                <span className="hidden md:inline">
                  {theme === 'frosted' ? t.themeFrosted : theme === 'cyberpunk' ? t.themeCyberpunk : theme === 'titanium' ? t.themeTitanium : t.themeEnterprise}
                </span>
                <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${isThemeOpen ? 'rotate-180 text-white' : ''}`} />
              </button>

              {isThemeOpen && (
                <div 
                  className="absolute right-0 top-full pt-1.5 w-52 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="rounded-2xl border border-white/15 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-2xl ring-1 ring-black/40">
                    <button
                      type="button"
                      onClick={() => handleSelectTheme('frosted')}
                      className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                        theme === 'frosted' ? 'bg-sky-500/20 text-sky-300 font-bold' : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
                        <span>{t.themeFrosted}</span>
                      </div>
                      {theme === 'frosted' && <Check className="h-3.5 w-3.5 text-sky-400" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectTheme('cyberpunk')}
                      className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                        theme === 'cyberpunk' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]" />
                        <span>{t.themeCyberpunk}</span>
                      </div>
                      {theme === 'cyberpunk' && <Check className="h-3.5 w-3.5 text-cyan-400" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectTheme('titanium')}
                      className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                        theme === 'titanium' ? 'bg-indigo-500/20 text-indigo-300 font-bold' : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="h-2 w-2 rounded-full bg-indigo-400 shadow-[0_0_8px_#818cf8]" />
                        <span>{t.themeTitanium}</span>
                      </div>
                      {theme === 'titanium' && <Check className="h-3.5 w-3.5 text-indigo-400" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectTheme('enterprise')}
                      className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                        theme === 'enterprise' ? 'bg-blue-500/20 text-blue-300 font-bold' : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa]" />
                        <span>{t.themeEnterprise}</span>
                      </div>
                      {theme === 'enterprise' && <Check className="h-3.5 w-3.5 text-blue-400" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Language Switch */}
            <button
              type="button"
              id="lang-switch-btn"
              onClick={() => onLanguageChange(language === 'tr' ? 'en' : 'tr')}
              className="flex items-center space-x-1 rounded-xl border border-white/10 bg-slate-900/80 px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:border-white/30 hover:text-white"
            >
              <Globe className="h-3.5 w-3.5 text-cyan-400" />
              <span>{language.toUpperCase()}</span>
            </button>

            {/* Data Import Button */}
            <button
              type="button"
              id="data-import-btn"
              onClick={onOpenDataImport}
              className="flex items-center space-x-1.5 rounded-xl border border-cyan-500/30 bg-cyan-950/40 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-900/50 hover:border-cyan-400 transition-all"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Excel/CSV</span>
            </button>

            {/* Security / Cloud Status Pill */}
            <button
              type="button"
              id="security-btn"
              onClick={onOpenSecurity}
              className="flex items-center space-x-1.5 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-900/50 transition-all"
              title={t.encryptionActive}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">E2EE Bulut</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs & Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              type="button"
              id="nav-tab-personnel"
              onClick={() => onTabChange('personnel')}
              className={`flex items-center space-x-2 rounded-xl px-4 py-2 text-xs font-bold transition-all shrink-0 ${
                activeTab === 'personnel'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>{t.navPersonnel}</span>
            </button>

            <button
              type="button"
              id="nav-tab-callcenter"
              onClick={() => onTabChange('callcenter')}
              className={`flex items-center space-x-2 rounded-xl px-4 py-2 text-xs font-bold transition-all shrink-0 ${
                activeTab === 'callcenter'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Activity className="h-4 w-4" />
              <span>{t.navCallCenter}</span>
            </button>

            <button
              type="button"
              id="nav-tab-comparison"
              onClick={() => onTabChange('comparison')}
              className={`flex items-center space-x-2 rounded-xl px-4 py-2 text-xs font-bold transition-all shrink-0 ${
                activeTab === 'comparison'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Swords className="h-4 w-4" />
              <span>{t.navComparison}</span>
            </button>
          </nav>

          {/* Recalculate & Reset Primary Action Buttons on Main Screen */}
          <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0">
            {/* 1. Recalculate Data Button */}
            <button
              type="button"
              id="btn-recalculate-data"
              onClick={onRecalculateData}
              disabled={isRecalculating}
              className="flex items-center space-x-2 rounded-xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/80 via-slate-900/90 to-blue-950/80 px-3.5 py-2 text-xs font-bold text-cyan-300 shadow-md shadow-cyan-500/20 hover:border-cyan-400 hover:bg-cyan-900/60 hover:text-white transition-all active:scale-95 disabled:opacity-50"
              title="Tüm personel AHT, SL, Tuşlama ve 3D radar metriklerini anında yeniden hesaplar"
            >
              <Cpu className={`h-4 w-4 text-cyan-400 ${isRecalculating ? 'animate-spin' : ''}`} />
              <span>{isRecalculating ? 'Hesaplanıyor...' : t.recalculateData}</span>
            </button>

            {/* 2. Reset Data Button */}
            <button
              type="button"
              id="btn-reset-data"
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center space-x-1.5 rounded-xl border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-xs font-bold text-rose-300 shadow-md shadow-rose-500/10 hover:border-rose-400 hover:bg-rose-900/60 hover:text-white transition-all active:scale-95"
              title="Tüm verileri varsayılan başlangıç setine sıfırlar"
            >
              <RotateCcw className="h-3.5 w-3.5 text-rose-400" />
              <span>{t.resetData}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl border border-rose-500/40 bg-slate-950 p-6 shadow-2xl shadow-rose-500/20">
            <div className="flex items-center space-x-3 mb-4 text-rose-400">
              <div className="rounded-2xl bg-rose-500/20 border border-rose-500/30 p-2.5">
                <RotateCcw className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">{t.resetConfirmTitle}</h3>
                <p className="text-xs text-slate-400 mt-0.5">İşlem türünü seçin:</p>
              </div>
            </div>
            
            <div className="space-y-3 mb-6">
              {/* Option 1: Reset to Defaults */}
              <div 
                onClick={() => {
                  onResetData();
                  setShowResetConfirm(false);
                }}
                className="cursor-pointer rounded-2xl border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-950/40 p-4 transition-all hover:border-emerald-400 flex items-center justify-between group"
              >
                <div>
                  <h4 className="text-xs font-bold text-emerald-300 group-hover:text-emerald-200">1. Varsayılan Demo Verilerini Geri Yükle</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">6 kişilik demo personel kadrosunu, 149 santral saatini ve hazır CRM kayıtlarını yükler.</p>
                </div>
                <button type="button" className="shrink-0 ml-3 rounded-xl bg-emerald-600/30 border border-emerald-500/40 px-3 py-1.5 text-xs font-bold text-emerald-300 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                  Yükle
                </button>
              </div>

              {/* Option 2: Clear All */}
              <div 
                onClick={() => {
                  if (onClearAllData) onClearAllData();
                  else onResetData();
                  setShowResetConfirm(false);
                }}
                className="cursor-pointer rounded-2xl border border-rose-500/30 bg-rose-950/20 hover:bg-rose-950/40 p-4 transition-all hover:border-rose-400 flex items-center justify-between group"
              >
                <div>
                  <h4 className="text-xs font-bold text-rose-300 group-hover:text-rose-200">2. Tüm Verileri Temizle / Sıfırla (Boşalt)</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Tüm tabloları, CRM kayıtlarını ve personelleri sıfırlar; temiz Excel yüklemesine hazır hale getirir.</p>
                </div>
                <button type="button" className="shrink-0 ml-3 rounded-xl bg-rose-600/30 border border-rose-500/40 px-3 py-1.5 text-xs font-bold text-rose-300 group-hover:bg-rose-600 group-hover:text-white transition-all">
                  Sıfırla
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/10"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
