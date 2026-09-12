import React, { useState } from 'react';
import { Language, CallRecord, CallCenterHourlyMetric, ExcelSheetPreview } from '../types';
import { getT } from '../utils/translations';
import { parseCRMRecordsFile, parseHourlyMetricsFile } from '../utils/excelParser';
import { 
  UploadCloud, FileSpreadsheet, CheckCircle, AlertCircle, RefreshCw, X, Cpu, Check, Activity
} from 'lucide-react';

interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onImportCRM: (records: CallRecord[], detectedHeaders?: string[], sheetsPreview?: ExcelSheetPreview[]) => void;
  onImportHourlyMetrics: (metrics: CallCenterHourlyMetric[]) => void;
  onResetDefaults: () => void;
  onClearAll?: () => void;
  currentCRMCount: number;
  currentMetricsCount: number;
}

export const DataImportModal: React.FC<DataImportModalProps> = ({
  isOpen,
  onClose,
  language,
  onImportCRM,
  onImportHourlyMetrics,
  onResetDefaults,
  onClearAll,
  currentCRMCount,
  currentMetricsCount,
}) => {
  const t = getT(language);
  const [file1Status, setFile1Status] = useState<string | null>(null);
  const [file2Status, setFile2Status] = useState<string | null>(null);
  const [file3Status, setFile3Status] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [calcStage, setCalcStage] = useState<string | null>(null);
  const [calcProgress, setCalcProgress] = useState(0);

  if (!isOpen) return null;

  const runRecalculationFlow = (totalRows: number, typeStr: string, onFinish: () => void) => {
    setLoading(true);
    setCalcStage('1/3: Excel Veri Satırları Taranıyor & Ayrıştırılıyor...');
    setCalcProgress(30);

    setTimeout(() => {
      setCalcStage('2/3: Personel AHT, SL ve Tuşlama Dağılımları Yeniden Hesaplanıyor...');
      setCalcProgress(70);

      setTimeout(() => {
        setCalcStage('3/3: 3D Radar Matrisi & Telemetri Güncelleniyor...');
        setCalcProgress(100);

        setTimeout(() => {
          onFinish();
          setLoading(false);
          setCalcStage(null);
        }, 500);
      }, 600);
    }, 500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, slot: 1 | 2 | 3) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (evt) => {
      const buffer = evt.target?.result;
      if (!buffer) return;

      if (slot === 1 || slot === 3) {
        // Also check if the uploaded file contains hourly santral queue data
        const hourlyCheck = parseHourlyMetricsFile(buffer as ArrayBuffer);
        if (hourlyCheck.success && hourlyCheck.data && hourlyCheck.data.length > 0) {
          onImportHourlyMetrics(hourlyCheck.data);
        }

        const result = parseCRMRecordsFile(buffer as ArrayBuffer);
        if (result.success && result.data) {
          const detectedStaffCount = result.detectedCreators?.length || 0;
          const detectedNames = (result.detectedCreators || []).slice(0, 4).join(', ');
          runRecalculationFlow(result.totalRows || 0, 'CRM & Santral', () => {
            onImportCRM(result.data!, result.detectedHeaders, result.sheetsPreview);
            const staffMsg = detectedStaffCount > 0 
              ? ` (${detectedStaffCount} temsilci tespit edildi: ${detectedNames}${detectedStaffCount > 4 ? '...' : ''})`
              : '';
            const hourlyMsg = hourlyCheck.success && hourlyCheck.data ? ` ve ${hourlyCheck.data.length} saatlik santral metriği` : '';
            if (slot === 1) setFile1Status(`✓ Başarılı: ${result.totalRows} kayıt${hourlyMsg} yüklendi${staffMsg}.`);
            if (slot === 3) setFile3Status(`✓ Başarılı: ${result.totalRows} IVR işlem kaydı işlendi.`);
          });
        } else if (hourlyCheck.success && hourlyCheck.data && hourlyCheck.data.length > 0) {
          runRecalculationFlow(hourlyCheck.totalRows || 0, 'Saatlik Santral', () => {
            onImportHourlyMetrics(hourlyCheck.data!);
            setFile1Status(`✓ Başarılı: ${hourlyCheck.totalRows} saatlik santral verisi yüklendi ve kuyruk grafikleri güncellendi.`);
          });
        } else {
          if (slot === 1) setFile1Status(`Hata: ${result.error}`);
          if (slot === 3) setFile3Status(`Hata: ${result.error}`);
        }
      } else if (slot === 2) {
        const result = parseHourlyMetricsFile(buffer as ArrayBuffer);
        if (result.success && result.data) {
          runRecalculationFlow(result.totalRows || 0, 'Saatlik Santral', () => {
            onImportHourlyMetrics(result.data!);
            setFile2Status(`✓ Başarılı: ${result.totalRows} saatlik santral aralığı yüklendi ve kuyruk analizi güncellendi.`);
          });
        } else {
          setFile2Status(`Hata: ${result.error}`);
        }
      }
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-3xl border border-cyan-500/40 bg-slate-950 p-6 shadow-2xl shadow-cyan-500/20 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="rounded-2xl bg-cyan-500/20 border border-cyan-500/40 p-3 text-cyan-400">
            <FileSpreadsheet className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">{t.uploadFilesTitle}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{t.uploadFilesDesc}</p>
          </div>
        </div>

        {/* Dynamic Calculation Progress Banner */}
        {loading && (
          <div className="mb-6 rounded-2xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/80 to-blue-950/80 p-4 shadow-lg shadow-cyan-500/20 animate-pulse">
            <div className="flex items-center space-x-3 mb-2">
              <Cpu className="h-5 w-5 text-cyan-400 animate-spin" />
              <div className="flex-1">
                <span className="text-xs font-bold text-cyan-300">YAPAY ZEKA & KPI HESAPLAMA MOTORU ÇALIŞIYOR</span>
                <p className="text-[11px] text-slate-300 mt-0.5">{calcStage}</p>
              </div>
              <span className="text-xs font-mono font-bold text-cyan-400">{calcProgress}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-white/10">
              <div 
                className="bg-gradient-to-r from-cyan-400 to-blue-500 h-2 rounded-full transition-all duration-300 shadow-[0_0_12px_#38bdf8]"
                style={{ width: `${calcProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Current Active Data Badge */}
        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3 text-xs text-slate-200">
            <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-emerald-400">{currentCRMCount > 0 ? t.sampleDataLoaded : 'Veri Tabanı Temiz / Sıfır'}</span>
              <p className="text-slate-400 mt-0.5 font-mono">Mevcut: {currentCRMCount} CRM / Tuşlama Kaydı + {currentMetricsCount} Santral Saat Slotu</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                runRecalculationFlow(149, 'Varsayılan', () => {
                  onResetDefaults();
                  setFile1Status('✓ Varsayılan fabrika verileri ve KPI skalası başarıyla geri yüklendi.');
                  setFile2Status('✓ Varsayılan saatlik santral verileri geri yüklendi.');
                });
              }}
              className="flex items-center space-x-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{t.resetDefaults}</span>
            </button>

            {onClearAll && (
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  onClearAll();
                  setFile1Status('Tüm veriler temizlendi.');
                  setFile2Status('Santral verileri temizlendi.');
                  setFile3Status(null);
                }}
                className="flex items-center space-x-1.5 rounded-xl border border-rose-500/40 bg-rose-500/20 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/30 disabled:opacity-50"
              >
                <span>Verileri Boşalt</span>
              </button>
            )}
          </div>
        </div>

        {/* 3 Upload Slots */}
        <div className="space-y-4">
          {/* File 1 */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-white flex items-center space-x-2">
                <span className="h-5 w-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-mono text-[10px]">1</span>
                <span>{t.file1Label}</span>
              </label>
              <span className="text-[10px] text-slate-400">{t.supportedFormats}</span>
            </div>

            <label className={`flex flex-col items-center justify-center border-2 border-dashed border-white/20 hover:border-cyan-400/60 rounded-xl p-4 cursor-pointer bg-white/5 hover:bg-cyan-950/20 transition-all ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
              <UploadCloud className="h-6 w-6 text-cyan-400 mb-1" />
              <span className="text-xs text-slate-300 font-medium">{t.dragAndDrop}</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                disabled={loading}
                onChange={(e) => handleFileUpload(e, 1)}
                className="hidden"
              />
            </label>

            {file1Status && (
              <p className={`mt-2 text-xs font-medium ${file1Status.startsWith('✓') ? 'text-emerald-400' : 'text-amber-400'}`}>
                {file1Status}
              </p>
            )}
          </div>

          {/* File 2 */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-white flex items-center space-x-2">
                <span className="h-5 w-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-mono text-[10px]">2</span>
                <span>{t.file2Label}</span>
              </label>
              <span className="text-[10px] text-slate-400">{t.supportedFormats}</span>
            </div>

            <label className={`flex flex-col items-center justify-center border-2 border-dashed border-white/20 hover:border-blue-400/60 rounded-xl p-4 cursor-pointer bg-white/5 hover:bg-blue-950/20 transition-all ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
              <UploadCloud className="h-6 w-6 text-blue-400 mb-1" />
              <span className="text-xs text-slate-300 font-medium">{t.dragAndDrop}</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                disabled={loading}
                onChange={(e) => handleFileUpload(e, 2)}
                className="hidden"
              />
            </label>

            {file2Status && (
              <p className={`mt-2 text-xs font-medium ${file2Status.startsWith('✓') ? 'text-emerald-400' : 'text-amber-400'}`}>
                {file2Status}
              </p>
            )}
          </div>

          {/* File 3 */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-white flex items-center space-x-2">
                <span className="h-5 w-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-mono text-[10px]">3</span>
                <span>{t.file3Label}</span>
              </label>
              <span className="text-[10px] text-slate-400">{t.supportedFormats}</span>
            </div>

            <label className={`flex flex-col items-center justify-center border-2 border-dashed border-white/20 hover:border-purple-400/60 rounded-xl p-4 cursor-pointer bg-white/5 hover:bg-purple-950/20 transition-all ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
              <UploadCloud className="h-6 w-6 text-purple-400 mb-1" />
              <span className="text-xs text-slate-300 font-medium">{t.dragAndDrop}</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                disabled={loading}
                onChange={(e) => handleFileUpload(e, 3)}
                className="hidden"
              />
            </label>

            {file3Status && (
              <p className={`mt-2 text-xs font-medium ${file3Status.startsWith('✓') ? 'text-emerald-400' : 'text-amber-400'}`}>
                {file3Status}
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-50"
          >
            Tamamla & Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
