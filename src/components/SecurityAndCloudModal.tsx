import React, { useState } from 'react';
import { Language, CloudBackupData, CacheTelemetry } from '../types';
import { getT } from '../utils/translations';
import { cacheManager, triggerCloudAutoBackup } from '../utils/storageAndSecurity';
import { 
  ShieldCheck, Lock, Cloud, Cpu, RefreshCw, Trash2, CheckCircle, Database, X, Key
} from 'lucide-react';

interface SecurityAndCloudModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  cloudBackup: CloudBackupData;
  onBackupUpdated: (backup: CloudBackupData) => void;
}

export const SecurityAndCloudModal: React.FC<SecurityAndCloudModalProps> = ({
  isOpen,
  onClose,
  language,
  cloudBackup,
  onBackupUpdated,
}) => {
  const t = getT(language);
  const [telemetry, setTelemetry] = useState<CacheTelemetry>(cacheManager.telemetry);
  const [syncing, setSyncing] = useState(false);

  if (!isOpen) return null;

  const handleManualSync = () => {
    setSyncing(true);
    setTimeout(() => {
      const updated = triggerCloudAutoBackup();
      onBackupUpdated(updated);
      setSyncing(false);
    }, 500);
  };

  const handleClearCache = () => {
    cacheManager.clear();
    setTelemetry({ ...cacheManager.telemetry });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl border border-cyan-500/40 bg-slate-950 p-6 shadow-2xl shadow-cyan-500/20 max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Title */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="rounded-2xl bg-cyan-500/20 border border-cyan-500/40 p-3 text-cyan-400">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">{t.navSecurity}</h2>
            <p className="text-xs text-slate-400 mt-0.5">Uçtan Uca Şifreleme (E2EE), Akıllı Bellek Önbellekleme ve Bulut Eşitleme</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* E2EE Card */}
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                <Lock className="h-4 w-4" />
                <span>AES-256 Uçtan Uca Şifreli Veri Kasası</span>
              </div>
              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                AKTİF (E2EE)
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Tüm personel KPI skorları, CRM tuşlama detayları ve kullanıcı tercihleri cihazınızdan çıkmadan önce şifrelenir. Güvenlik anahtarı:
            </p>
            <div className="mt-2 rounded-xl bg-black/40 border border-emerald-500/20 p-2.5 font-mono text-[11px] text-emerald-300 break-all flex items-center justify-between">
              <span>{cloudBackup.encryptedHash}</span>
              <Key className="h-4 w-4 text-emerald-400 shrink-0 ml-2" />
            </div>
          </div>

          {/* Cloud Sync Telemetry */}
          <div className="rounded-2xl border border-blue-500/30 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2 text-blue-400 font-bold text-sm">
                <Cloud className="h-4 w-4" />
                <span>Bulut Otomatik Yedekleme Durumu</span>
              </div>
              <button
                type="button"
                onClick={handleManualSync}
                disabled={syncing}
                className="flex items-center space-x-1.5 rounded-xl border border-blue-500/40 bg-blue-500/20 px-3 py-1 text-xs font-bold text-blue-300 hover:bg-blue-500/30"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{t.syncNow}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-white/5 p-3">
                <span className="text-slate-400 block text-[10px]">Son Senkronizasyon</span>
                <span className="text-white font-bold font-mono mt-0.5 block">{cloudBackup.lastSync}</span>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <span className="text-slate-400 block text-[10px]">Veri Versiyonu</span>
                <span className="text-cyan-300 font-bold font-mono mt-0.5 block">{cloudBackup.dataVersion}</span>
              </div>
            </div>
          </div>

          {/* Smart In-Memory Caching Engine */}
          <div className="rounded-2xl border border-purple-500/30 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2 text-purple-400 font-bold text-sm">
                <Cpu className="h-4 w-4" />
                <span>{t.cacheTelemetry}</span>
              </div>
              <button
                type="button"
                onClick={handleClearCache}
                className="flex items-center space-x-1.5 rounded-xl border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                <span>{t.clearCache}</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs font-mono">
              <div className="rounded-xl bg-white/5 p-3 text-center">
                <span className="text-slate-400 block text-[10px] font-sans">İsabet (Hit)</span>
                <span className="text-emerald-400 font-bold text-base mt-1 block">{telemetry.hitCount}</span>
              </div>
              <div className="rounded-xl bg-white/5 p-3 text-center">
                <span className="text-slate-400 block text-[10px] font-sans">Kullanılan Bellek</span>
                <span className="text-cyan-300 font-bold text-base mt-1 block">{telemetry.memorySizeKb} KB</span>
              </div>
              <div className="rounded-xl bg-white/5 p-3 text-center">
                <span className="text-slate-400 block text-[10px] font-sans">Son Optimizasyon</span>
                <span className="text-purple-300 font-bold text-xs mt-1.5 block">{telemetry.lastOptimized}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-xs font-bold text-white hover:bg-white/20"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
