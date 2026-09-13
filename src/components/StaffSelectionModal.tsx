import React, { useState, useMemo } from 'react';
import { StaffMember, CallRecord, CallCenterHourlyMetric, TimeFilter, AppTheme, Language } from '../types';
import { calculateStaffKPI } from '../data/defaultDatasets';
import { 
  Users, Check, X, Search, AlertCircle, Sparkles, CheckSquare, 
  RotateCcw, ShieldCheck, PhoneCall, Award
} from 'lucide-react';

interface StaffSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  allStaff: StaffMember[];
  selectedIds: string[];
  onSaveSelection: (newSelectedIds: string[]) => void;
  crmRecords: CallRecord[];
  hourlyMetrics: CallCenterHourlyMetric[];
  timeFilter: TimeFilter;
  theme: AppTheme;
  language: Language;
}

export const StaffSelectionModal: React.FC<StaffSelectionModalProps> = ({
  isOpen,
  onClose,
  allStaff,
  selectedIds,
  onSaveSelection,
  crmRecords,
  hourlyMetrics,
  timeFilter,
  theme,
}) => {
  // Temporary selection state during modal view
  const [tempSelected, setTempSelected] = useState<string[]>(() => {
    if (selectedIds && selectedIds.length > 0) {
      return selectedIds.slice(0, 6);
    }
    return allStaff.slice(0, 6).map(s => s.id);
  });

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Sync state whenever modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (selectedIds && selectedIds.length > 0) {
        setTempSelected(selectedIds.slice(0, 6));
      } else {
        setTempSelected(allStaff.slice(0, 6).map(s => s.id));
      }
      setSearchTerm('');
      setWarningMessage(null);
    }
  }, [isOpen, selectedIds, allStaff]);

  // Pre-calculate KPI score for each staff member
  const staffKpiMap = useMemo(() => {
    const map = new Map<string, number>();
    allStaff.forEach(staff => {
      try {
        const kpi = calculateStaffKPI(staff, crmRecords, hourlyMetrics, timeFilter);
        map.set(staff.id, Math.round(kpi.overallScore || 0));
      } catch {
        map.set(staff.id, 85);
      }
    });
    return map;
  }, [allStaff, crmRecords, hourlyMetrics, timeFilter]);

  if (!isOpen) return null;

  // Filter staff by search term
  const filteredStaff = allStaff.filter(staff => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase('tr');
    return (
      staff.name.toLowerCase('tr').includes(term) ||
      (staff.title && staff.title.toLowerCase('tr').includes(term)) ||
      (staff.role && staff.role.toLowerCase('tr').includes(term)) ||
      (staff.extension && staff.extension.includes(term))
    );
  });

  const handleToggleStaff = (staffId: string) => {
    setWarningMessage(null);
    if (tempSelected.includes(staffId)) {
      setTempSelected(prev => prev.filter(id => id !== staffId));
    } else {
      if (tempSelected.length >= 6) {
        setWarningMessage('En fazla 6 personel seçebilirsiniz. Yeni bir personel eklemek için lütfen önce bir personelin seçimini kaldırın.');
        return;
      }
      setTempSelected(prev => [...prev, staffId]);
    }
  };

  const handleSelectFirst6 = () => {
    setWarningMessage(null);
    const first6 = allStaff.slice(0, 6).map(s => s.id);
    setTempSelected(first6);
  };

  const handleClearAll = () => {
    setWarningMessage(null);
    setTempSelected([]);
  };

  const handleConfirm = () => {
    if (tempSelected.length === 0) {
      setWarningMessage('Lütfen ana ekranda görüntülenecek en az 1 personel seçin (en fazla 6).');
      return;
    }
    onSaveSelection(tempSelected.slice(0, 6));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border border-white/15 bg-slate-950/95 shadow-2xl shadow-cyan-950/40 text-slate-100 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  Tüm Personel Kadrosu & Gösterim Seçimi
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border transition-colors ${
                  tempSelected.length === 6 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                    : tempSelected.length > 0 
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' 
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}>
                  {tempSelected.length} / 6 Seçili
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Ana ekranda görüntülenecek en fazla 6 personeli kutularındaki tik alanına tıklayarak seçin.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Warning Banner */}
        {warningMessage && (
          <div className="flex items-center space-x-2 px-6 py-2.5 bg-amber-500/15 border-b border-amber-500/30 text-amber-200 text-xs font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>{warningMessage}</span>
          </div>
        )}

        {/* Controls Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3 border-b border-white/10 bg-slate-900/40">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Personel veya unvan ara..."
              className="w-full rounded-xl border border-white/10 bg-slate-900/80 pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Quick selection actions */}
          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleSelectFirst6}
              className="flex items-center space-x-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 hover:bg-cyan-900/60 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:text-white transition-all"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span>İlk 6'yı Seç</span>
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="flex items-center space-x-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-all"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Temizle</span>
            </button>
          </div>
        </div>

        {/* Staff Grid (Matching Image 3) */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredStaff.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
              <Users className="h-10 w-10 text-slate-600 mb-2" />
              <p className="text-sm font-semibold">Aranan kriterde personel bulunamadı</p>
              <p className="text-xs text-slate-500 mt-1">Farklı bir isim veya filtre deneyin.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
              {filteredStaff.map((staff) => {
                const isSelected = tempSelected.includes(staff.id);
                const kpiScore = staffKpiMap.get(staff.id) || 85;

                return (
                  <div
                    key={staff.id}
                    onClick={() => handleToggleStaff(staff.id)}
                    className={`group relative flex flex-col rounded-xl p-3 border transition-all cursor-pointer select-none text-left ${
                      isSelected
                        ? 'border-cyan-400/80 bg-cyan-950/35 shadow-lg shadow-cyan-950/30 ring-1 ring-cyan-400/50'
                        : 'border-white/10 bg-slate-900/50 hover:border-white/25 hover:bg-slate-900/80'
                    }`}
                  >
                    {/* Top row: Checkbox tick box & Score Badge */}
                    <div className="flex items-center justify-between mb-2.5">
                      {/* Selection Checkbox */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStaff(staff.id);
                        }}
                        className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
                          isSelected
                            ? 'border-cyan-400 bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/50'
                            : 'border-white/20 bg-slate-800/80 text-transparent group-hover:border-white/40'
                        }`}
                        title={isSelected ? 'Seçimi Kaldır' : 'Personeli Seç'}
                      >
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </button>

                      {/* KPI Score Pill */}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                        kpiScore >= 85 
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                          : kpiScore >= 70 
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' 
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}>
                        %{kpiScore} KPI
                      </span>
                    </div>

                    {/* Avatar & Online status */}
                    <div className="relative mx-auto mb-2.5">
                      <div className={`h-14 w-14 rounded-full overflow-hidden p-0.5 border-2 transition-transform group-hover:scale-105 ${
                        isSelected ? 'border-cyan-400' : 'border-white/20'
                      }`}>
                        <img
                          src={staff.avatar}
                          alt={staff.name}
                          className="h-full w-full rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <span 
                        className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-slate-950 ${
                          staff.status === 'available' ? 'bg-emerald-400' :
                          staff.status === 'in-call' ? 'bg-amber-400' :
                          staff.status === 'acw' ? 'bg-blue-400' : 'bg-slate-400'
                        }`} 
                        title={`Durum: ${staff.status}`}
                      />
                    </div>

                    {/* Staff Name & Title */}
                    <div className="text-center flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white line-clamp-1 group-hover:text-cyan-300 transition-colors">
                          {staff.name}
                        </h4>
                        <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                          {staff.title || 'Müşteri Temsilcisi'}
                        </p>
                      </div>

                      {/* Extension / ID footer */}
                      {staff.extension && (
                        <div className="mt-2 text-[10px] font-mono text-slate-400 bg-white/5 py-0.5 px-1 rounded border border-white/5">
                          Dahili: {staff.extension}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-white/10 bg-slate-900/70 backdrop-blur-md">
          <div className="text-xs text-slate-400 text-center sm:text-left">
            <span className="text-cyan-400 font-semibold">{tempSelected.length} / 6</span> personel seçildi. 
            Tamam dediğinizde ana ekrandaki Personel Kadrosu alanında bu 6 personel yer alacaktır.
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-all"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 sm:flex-none rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2 text-xs font-bold text-slate-950 hover:from-cyan-400 hover:to-blue-500 shadow-md shadow-cyan-500/20 active:scale-95 transition-all"
            >
              Tamam ({tempSelected.length} Seçili)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
