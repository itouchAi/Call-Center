import React, { useState } from 'react';
import { StaffMember, CallRecord, CallCenterHourlyMetric, StaffKPIData, Language, RenderMode, TimeFilter, AppTheme } from '../types';
import { calculateStaffKPI } from '../data/defaultDatasets';
import { getT } from '../utils/translations';
import { Interactive3DCard } from './Interactive3DCard';
import { RadarChart3D } from './RadarChart3D';
import { Interactive3DBarChart } from './Interactive3DBarChart';
import { 
  Users, Swords, ArrowUpRight, ArrowDownRight, Sparkles, 
  CheckCircle2, AlertCircle, Award, Zap, User
} from 'lucide-react';

interface ComparisonMatrixViewProps {
  staffList: StaffMember[];
  primaryStaffId: string;
  secondaryStaffId: string;
  onSelectPrimary: (id: string) => void;
  onSelectSecondary: (id: string) => void;
  crmRecords: CallRecord[];
  hourlyMetrics: CallCenterHourlyMetric[];
  language: Language;
  renderMode: RenderMode;
  theme: AppTheme;
  timeFilter: TimeFilter;
}

export const ComparisonMatrixView: React.FC<ComparisonMatrixViewProps> = ({
  staffList,
  primaryStaffId,
  secondaryStaffId,
  onSelectPrimary,
  onSelectSecondary,
  crmRecords,
  hourlyMetrics,
  language,
  renderMode,
  theme,
  timeFilter,
}) => {
  const t = getT(language);
  const [viewAll6, setViewAll6] = useState(false);

  if (staffList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-slate-950/70 p-12 text-center backdrop-blur-xl">
        <Users className="h-10 w-10 text-cyan-400 mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">Karşılaştırma İçin Personel Bulunamadı</h3>
        <p className="text-xs text-slate-400 max-w-sm">Veri tabanı boş. Lütfen bir Excel/CSV dosyası yükleyin veya varsayılan verileri geri yükleyin.</p>
      </div>
    );
  }

  const themeIconColor = 
    theme === 'cyberpunk' ? 'text-cyan-400' :
    theme === 'titanium' ? 'text-amber-400' :
    theme === 'enterprise' ? 'text-blue-400' : 'text-sky-400';

  const themeActiveTab =
    theme === 'cyberpunk' ? 'bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white shadow-md shadow-fuchsia-500/30' :
    theme === 'titanium' ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-bold shadow-md shadow-amber-500/30' :
    theme === 'enterprise' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30' :
    'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25';

  const staff1 = staffList.find(s => s.id === primaryStaffId);
  const staff2 = staffList.find(s => s.id === secondaryStaffId);

  // Workflow Handlers:
  // 1. Changing 1st staff: if cleared or set to same as 2nd staff, reset 2nd staff
  const handlePrimaryChange = (newId: string) => {
    onSelectPrimary(newId);
    if (!newId || newId === secondaryStaffId) {
      onSelectSecondary('');
    }
  };

  // 2. Changing 2nd staff: cannot be same as 1st staff
  const handleSecondaryChange = (newId: string) => {
    if (newId !== primaryStaffId) {
      onSelectSecondary(newId);
    }
  };

  const isSecondaryDisabled = !primaryStaffId;
  const secondaryStaffOptions = staffList.filter(s => s.id !== primaryStaffId);

  const kpi1: StaffKPIData | null = staff1 ? calculateStaffKPI(staff1, crmRecords, hourlyMetrics, timeFilter) : null;
  const kpi2: StaffKPIData | null = staff2 ? calculateStaffKPI(staff2, crmRecords, hourlyMetrics, timeFilter) : null;

  const defaultEmptyAxes = [
    { label: 'AHT Hızı', value: 0 },
    { label: 'FCR Çözüm', value: 0 },
    { label: 'Çözüm Oranı', value: 0 },
    { label: 'Çağrı Hacmi', value: 0 },
    { label: 'SL Uyumu', value: 0 },
    { label: 'Memnuniyet', value: 0 },
  ];

  // Radar Axes for Staff 1
  const axes1 = kpi1 ? [
    { label: 'AHT Hızı', value: Math.max(15, Math.min(100, Math.round(100 - Math.max(0, kpi1.ahtAvg - 180) * 0.18))) },
    { label: 'FCR Çözüm', value: kpi1.fcrRate },
    { label: 'Çözüm Oranı', value: kpi1.resolutionRate },
    { label: 'Çağrı Hacmi', value: Math.min(100, kpi1.totalHandled * 3.5) },
    { label: 'SL Uyumu', value: Math.round(kpi1.slAdherenceRate) },
    { label: 'Memnuniyet', value: kpi1.customerSatisfaction },
  ] : defaultEmptyAxes;

  // Radar Axes for Staff 2
  const axes2 = kpi2 ? [
    { label: 'AHT Hızı', value: Math.max(15, Math.min(100, Math.round(100 - Math.max(0, kpi2.ahtAvg - 180) * 0.18))) },
    { label: 'FCR Çözüm', value: kpi2.fcrRate },
    { label: 'Çözüm Oranı', value: kpi2.resolutionRate },
    { label: 'Çağrı Hacmi', value: Math.min(100, kpi2.totalHandled * 3.5) },
    { label: 'SL Uyumu', value: Math.round(kpi2.slAdherenceRate) },
    { label: 'Memnuniyet', value: kpi2.customerSatisfaction },
  ] : defaultEmptyAxes;

  // Metric Comparison Rows
  const comparisonMetrics = [
    {
      label: t.kpiScore,
      val1: kpi1 ? `%${kpi1.overallScore}` : '-',
      val2: kpi2 ? `%${kpi2.overallScore}` : '-',
      num1: kpi1?.overallScore ?? 0,
      num2: kpi2?.overallScore ?? 0,
      higherIsBetter: true,
    },
    {
      label: t.totalCalls,
      val1: kpi1 ? `${kpi1.totalHandled}` : '-',
      val2: kpi2 ? `${kpi2.totalHandled}` : '-',
      num1: kpi1?.totalHandled ?? 0,
      num2: kpi2?.totalHandled ?? 0,
      higherIsBetter: true,
    },
    {
      label: t.aht,
      val1: kpi1 ? `${kpi1.ahtAvg} sn` : '-',
      val2: kpi2 ? `${kpi2.ahtAvg} sn` : '-',
      num1: kpi1?.ahtAvg ?? 0,
      num2: kpi2?.ahtAvg ?? 0,
      higherIsBetter: false,
    },
    {
      label: t.fcr,
      val1: kpi1 ? `%${kpi1.fcrRate}` : '-',
      val2: kpi2 ? `%${kpi2.fcrRate}` : '-',
      num1: kpi1?.fcrRate ?? 0,
      num2: kpi2?.fcrRate ?? 0,
      higherIsBetter: true,
    },
    {
      label: t.resolutionRate,
      val1: kpi1 ? `%${kpi1.resolutionRate}` : '-',
      val2: kpi2 ? `%${kpi2.resolutionRate}` : '-',
      num1: kpi1?.resolutionRate ?? 0,
      num2: kpi2?.resolutionRate ?? 0,
      higherIsBetter: true,
    },
    {
      label: t.serviceLevel,
      val1: kpi1 ? `%${kpi1.slAdherenceRate}` : '-',
      val2: kpi2 ? `%${kpi2.slAdherenceRate}` : '-',
      num1: kpi1?.slAdherenceRate ?? 0,
      num2: kpi2?.slAdherenceRate ?? 0,
      higherIsBetter: true,
    },
    {
      label: 'Müşteri Memnuniyeti (CSAT)',
      val1: kpi1 ? `${kpi1.customerSatisfaction}/100` : '-',
      val2: kpi2 ? `${kpi2.customerSatisfaction}/100` : '-',
      num1: kpi1?.customerSatisfaction ?? 0,
      num2: kpi2?.customerSatisfaction ?? 0,
      higherIsBetter: true,
    },
  ];

  // All 6 Staff Ranking for Leaderboard
  const allStaffKPIs = staffList.map(s => ({
    staff: s,
    kpi: calculateStaffKPI(s, crmRecords, hourlyMetrics, timeFilter),
  })).sort((a, b) => b.kpi.overallScore - a.kpi.overallScore);

  return (
    <div className="space-y-6 pb-12">
      {/* Title & Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Swords className={`h-6 w-6 ${themeIconColor}`} />
            <h2 className="text-xl font-black text-white tracking-tight">{t.compareStaff}</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">Personeller Arası Birebir ve 6 Kişilik Takım Yetkinlik Kıyaslaması</p>
        </div>

        <button
          type="button"
          onClick={() => setViewAll6(!viewAll6)}
          className="flex items-center space-x-2 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md hover:bg-white/10"
        >
          <Users className={`h-4 w-4 ${themeIconColor}`} />
          <span>{viewAll6 ? 'Birebir Karşılaştırmaya Dön' : 'Tüm 6 Personel Lider Tablosu'}</span>
        </button>
      </div>

      {!viewAll6 ? (
        <>
          {/* Head to Head Selection Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Person 1 Selector */}
            <Interactive3DCard
              renderMode={renderMode}
              glowColor={`${staff1?.color || '#06b6d4'}55`}
              className="border border-cyan-500/30 bg-slate-900/60 p-4 backdrop-blur-md"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">{t.selectStaff1}</span>
                <select
                  id="select-staff-1"
                  value={primaryStaffId || ''}
                  onChange={(e) => handlePrimaryChange(e.target.value)}
                  className="rounded-lg border border-white/20 bg-slate-800 px-3 py-1 text-xs font-semibold text-white focus:outline-hidden focus:border-cyan-400 cursor-pointer"
                >
                  <option value="">Personel Seçiniz</option>
                  {staffList.map((s, idx) => (
                    <option key={`opt-staff1-${s.id}-${idx}`} value={s.id}>{s.name} - {s.title || 'Müşteri Temsilcisi'}</option>
                  ))}
                </select>
              </div>

              {staff1 && kpi1 ? (
                <div className="flex items-center space-x-3">
                  <img
                    src={staff1.avatar}
                    alt={staff1.name}
                    referrerPolicy="no-referrer"
                    className="h-14 w-14 rounded-2xl object-cover border-2 shadow-md"
                    style={{ borderColor: staff1.color }}
                  />
                  <div>
                    <h3 className="text-sm font-bold text-white">{staff1.name}</h3>
                    <p className="text-xs text-slate-400">{staff1.title || 'Müşteri Temsilcisi'}</p>
                    <span className="inline-block mt-1 text-[11px] font-mono font-bold text-cyan-300">
                      KPI: %{kpi1.overallScore} | AHT: {kpi1.ahtAvg}sn
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <div className="h-14 w-14 rounded-2xl border-2 border-cyan-500/30 bg-cyan-950/30 flex items-center justify-center text-cyan-400 shadow-md">
                    <User className="h-7 w-7 opacity-60" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-300">Personel Seçiniz</h3>
                    <p className="text-xs text-slate-500">Kıyaslama için 1. personeli belirleyin</p>
                    <span className="inline-block mt-1 text-[11px] font-mono font-semibold text-slate-500">
                      KPI: - | AHT: -
                    </span>
                  </div>
                </div>
              )}
            </Interactive3DCard>

            {/* Person 2 Selector */}
            <Interactive3DCard
              renderMode={renderMode}
              glowColor={`${staff2?.color || '#ec4899'}55`}
              className={`border bg-slate-900/60 p-4 backdrop-blur-md transition-all duration-300 ${
                isSecondaryDisabled ? 'border-white/10 opacity-75' : 'border-pink-500/30'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className={`text-xs font-bold uppercase tracking-wider ${isSecondaryDisabled ? 'text-slate-400' : 'text-pink-400'}`}>
                    {t.selectStaff2}
                  </span>
                  {isSecondaryDisabled && (
                    <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
                      1. Seçilince Aktif Olur
                    </span>
                  )}
                </div>
                <select
                  id="select-staff-2"
                  value={secondaryStaffId || ''}
                  disabled={isSecondaryDisabled}
                  onChange={(e) => handleSecondaryChange(e.target.value)}
                  className={`rounded-lg border px-3 py-1 text-xs font-semibold focus:outline-hidden focus:border-pink-400 transition-all ${
                    isSecondaryDisabled
                      ? 'opacity-40 cursor-not-allowed bg-slate-900 border-white/10 text-slate-500'
                      : 'cursor-pointer bg-slate-800 border-white/20 text-white hover:border-pink-400'
                  }`}
                >
                  <option value="">Personel Seçiniz</option>
                  {secondaryStaffOptions.map((s, idx) => (
                    <option key={`opt-staff2-${s.id}-${idx}`} value={s.id}>{s.name} - {s.title || 'Müşteri Temsilcisi'}</option>
                  ))}
                </select>
              </div>

              {staff2 && kpi2 ? (
                <div className="flex items-center space-x-3">
                  <img
                    src={staff2.avatar}
                    alt={staff2.name}
                    referrerPolicy="no-referrer"
                    className="h-14 w-14 rounded-2xl object-cover border-2 shadow-md"
                    style={{ borderColor: staff2.color }}
                  />
                  <div>
                    <h3 className="text-sm font-bold text-white">{staff2.name}</h3>
                    <p className="text-xs text-slate-400">{staff2.title || 'Müşteri Temsilcisi'}</p>
                    <span className="inline-block mt-1 text-[11px] font-mono font-bold text-pink-300">
                      KPI: %{kpi2.overallScore} | AHT: {kpi2.ahtAvg}sn
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <div className={`h-14 w-14 rounded-2xl border-2 flex items-center justify-center shadow-md ${
                    isSecondaryDisabled ? 'border-white/10 bg-slate-800/40 text-slate-500' : 'border-pink-500/30 bg-pink-950/30 text-pink-400'
                  }`}>
                    <User className="h-7 w-7 opacity-60" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-300">
                      {isSecondaryDisabled ? '2. Personel (Pasif)' : 'Personel Seçiniz'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {isSecondaryDisabled ? 'Önce 1. personeli seçmelisiniz' : 'Kıyaslama için 2. personeli seçin'}
                    </p>
                    <span className="inline-block mt-1 text-[11px] font-mono font-semibold text-slate-500">
                      KPI: - | AHT: -
                    </span>
                  </div>
                </div>
              )}
            </Interactive3DCard>
          </div>

          {/* Dual 3D Radar + Detailed Matrix (Radar stretches to 7-row table height) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* 3D Dual Radar */}
            <Interactive3DCard
              renderMode={renderMode}
              glowColor="rgba(6, 182, 212, 0.3)"
              className="lg:col-span-5 border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md flex flex-col justify-between items-center h-full overflow-visible"
            >
              <RadarChart3D
                axes={axes1}
                title="Birebir 3D Yetkinlik Örümcek Ağı"
                staffName={staff1 ? staff1.name : undefined}
                color={staff1?.color || '#06b6d4'}
                compareStaffName={staff2 ? staff2.name : undefined}
                compareAxes={staff2 ? axes2 : undefined}
                compareColor={staff2?.color || '#ec4899'}
                renderMode={renderMode}
                size="large"
              />
            </Interactive3DCard>

            {/* Comparison Metrics Delta Table */}
            <Interactive3DCard
              renderMode={renderMode}
              glowColor="rgba(139, 92, 246, 0.3)"
              className="lg:col-span-7 border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md flex flex-col justify-between"
            >
              <h3 className="text-base font-bold text-white tracking-wide mb-4">Metrik Kıyaslama & Fark Analizi</h3>

              <div className="space-y-3">
                {comparisonMetrics.map((m, idx) => {
                  const hasBoth = Boolean(kpi1 && kpi2);
                  const is1Winner = hasBoth && (m.higherIsBetter ? m.num1 > m.num2 : m.num1 < m.num2);
                  const is2Winner = hasBoth && (m.higherIsBetter ? m.num2 > m.num1 : m.num2 < m.num1);

                  return (
                    <div
                      key={idx}
                      className="group rounded-xl border p-3 text-xs flex items-center justify-between transition-all duration-300 ease-out cursor-pointer select-none bg-white/5 border-white/5 hover:bg-gradient-to-r hover:from-amber-500/15 hover:via-amber-500/10 hover:to-orange-500/15 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/15 hover:scale-[1.02] hover:-translate-y-0.5"
                    >
                      <div className="w-1/3">
                        <span className="text-slate-300 font-medium block transition-all duration-300 group-hover:text-amber-200 group-hover:font-semibold group-hover:scale-[1.03] origin-left">
                          {m.label}
                        </span>
                      </div>

                      <div className="w-1/4 text-center">
                        <span className={`font-mono font-bold px-2 py-1 rounded-lg transition-all duration-300 group-hover:scale-105 inline-block ${
                          is1Winner
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 group-hover:border-cyan-400 group-hover:shadow-sm'
                            : 'text-slate-300 group-hover:text-amber-100'
                        }`}>
                          {m.val1}
                        </span>
                      </div>

                      <div className="w-12 text-center text-slate-500 font-bold transition-colors duration-300 group-hover:text-amber-400/80">
                        VS
                      </div>

                      <div className="w-1/4 text-center">
                        <span className={`font-mono font-bold px-2 py-1 rounded-lg transition-all duration-300 group-hover:scale-105 inline-block ${
                          is2Winner
                            ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 group-hover:border-pink-400 group-hover:shadow-sm'
                            : 'text-slate-300 group-hover:text-amber-100'
                        }`}>
                          {m.val2}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Interactive3DCard>
          </div>
        </>
      ) : (
        /* All 6 Staff Leaderboard */
        <Interactive3DCard
          renderMode={renderMode}
          glowColor="rgba(6, 182, 212, 0.4)"
          className="border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md"
        >
          <div className="flex items-center space-x-2 mb-4">
            <Award className="h-5 w-5 text-amber-400" />
            <h3 className="text-base font-bold text-white tracking-wide">6 Kişilik Takım Performans Sıralaması</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allStaffKPIs.map((item, rank) => (
              <div
                key={`leaderboard-card-${item.staff.id}-${rank}`}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs font-mono ${
                    rank === 0 ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/40' : rank === 1 ? 'bg-slate-300 text-black' : rank === 2 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-300'
                  }`}>
                    #{rank + 1}
                  </span>
                  <span className="text-sm font-black font-mono px-2 py-0.5 rounded-md" style={{ backgroundColor: `${item.staff.color}25`, color: item.staff.color }}>
                    %{item.kpi.overallScore} KPI
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <img
                    src={item.staff.avatar}
                    alt={item.staff.name}
                    referrerPolicy="no-referrer"
                    className="h-12 w-12 rounded-xl object-cover border-2"
                    style={{ borderColor: item.staff.color }}
                  />
                  <div>
                    <h4 className="text-xs font-bold text-white">{item.staff.name}</h4>
                    <p className="text-[10px] text-slate-400">{item.staff.role}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1 pt-2 border-t border-white/10 text-[10px] text-center font-mono">
                  <div>
                    <span className="block text-slate-400 text-[9px]">AHT</span>
                    <span className="font-bold text-white">{item.kpi.ahtAvg}s</span>
                  </div>
                  <div>
                    <span className="block text-slate-400 text-[9px]">FCR</span>
                    <span className="font-bold text-emerald-400">%{item.kpi.fcrRate}</span>
                  </div>
                  <div>
                    <span className="block text-slate-400 text-[9px]">Hacim</span>
                    <span className="font-bold text-cyan-400">{item.kpi.totalHandled}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Interactive3DCard>
      )}
    </div>
  );
};
