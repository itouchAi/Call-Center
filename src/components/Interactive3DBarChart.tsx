import React, { useState } from 'react';
import { RenderMode } from '../types';
import { Eye, Layers } from 'lucide-react';

interface BarDataPoint {
  label: string;
  value: number;
  secondaryValue?: number;
  color?: string;
  tooltipText?: string;
  tag?: string;
  rawKey?: string;
}

interface Interactive3DBarChartProps {
  title?: string;
  subtitle?: string;
  data: BarDataPoint[];
  unit?: string;
  maxValue?: number;
  renderMode?: RenderMode;
  height?: number;
  onBarClick?: (item: BarDataPoint, index: number) => void;
}

export const Interactive3DBarChart: React.FC<Interactive3DBarChartProps> = ({
  title,
  subtitle,
  data,
  unit = '',
  maxValue,
  renderMode = 'performance',
  height = 240,
  onBarClick,
}) => {
  // Default to 3D isometric cuboid mode
  const [is3DMode, setIs3DMode] = useState<boolean>(true);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const calculatedMax = maxValue || Math.max(...data.map(d => d.value), 10);

  return (
    <div className="flex flex-col space-y-4 relative z-20">
      {/* Header with 3D/2D Toggle (rendered only if title/subtitle present, or right-aligned toggle) */}
      {title || subtitle ? (
        <div className="flex items-center justify-between">
          <div>
            {title && <h4 className="text-base font-bold text-white tracking-wide">{title}</h4>}
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={() => setIs3DMode(!is3DMode)}
            className="flex items-center space-x-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            {is3DMode ? <Layers className="h-3.5 w-3.5 text-cyan-400" /> : <Eye className="h-3.5 w-3.5 text-amber-400" />}
            <span>{is3DMode ? '3D Görünüm' : '2D Düzlem'}</span>
          </button>
        </div>
      ) : (
        <div className="flex justify-end -mt-1 mb-1">
          <button
            type="button"
            onClick={() => setIs3DMode(!is3DMode)}
            className="flex items-center space-x-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            {is3DMode ? <Layers className="h-3.5 w-3.5 text-cyan-400" /> : <Eye className="h-3.5 w-3.5 text-amber-400" />}
            <span>{is3DMode ? '3D Görünüm' : '2D Düzlem'}</span>
          </button>
        </div>
      )}

      {/* Chart Canvas Area */}
      <div
        className="relative flex items-end justify-between gap-1.5 pt-8 pb-4 px-2 select-none"
        style={{
          height: `${height}px`,
        }}
      >
        {/* Background Grid Lines */}
        <div className="absolute inset-x-0 bottom-6 top-4 flex flex-col justify-between pointer-events-none opacity-20 z-0">
          <div className="border-b border-dashed border-slate-400 w-full" />
          <div className="border-b border-dashed border-slate-400 w-full" />
          <div className="border-b border-dashed border-slate-400 w-full" />
        </div>

        {data.map((item, idx) => {
          const hasValue = item.value > 0;
          const heightPercent = hasValue 
            ? Math.min(100, Math.max(12, (item.value / calculatedMax) * 100))
            : 4;
          const isHovered = hoveredIdx === idx;
          const barColor = item.color || '#06b6d4';

          return (
            <div
              key={idx}
              className={`group relative flex-1 flex flex-col items-center justify-end h-full z-10 ${onBarClick ? 'cursor-pointer hover:brightness-110' : 'cursor-pointer'}`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => onBarClick && onBarClick(item, idx)}
            >
              {/* Tooltip on Hover */}
              {isHovered && (
                <div className="absolute -top-12 z-50 flex flex-col items-center pointer-events-none animate-in fade-in zoom-in-90 duration-150">
                  <div className="rounded-lg bg-slate-900/98 border border-cyan-400 px-3 py-1.5 text-xs font-semibold text-white shadow-2xl shadow-cyan-500/30 whitespace-nowrap">
                    <span className="text-cyan-400 font-bold">{item.label}: </span>
                    <span className="text-white font-mono font-bold">{item.value} {unit}</span>
                    {item.secondaryValue !== undefined && item.secondaryValue > 0 && (
                      <span className="text-emerald-300 ml-2 font-mono text-[11px] border-l border-white/20 pl-2">
                        Karşılanan: {item.secondaryValue}
                      </span>
                    )}
                  </div>
                  <div className="w-2 h-2 bg-slate-900 border-r border-b border-cyan-400 transform rotate-45 -mt-1" />
                </div>
              )}

              {/* Bar Pillar - Real 3-Surface Isometric Cuboid Column */}
              <div
                className="relative w-full max-w-[42px] transition-all duration-200"
                style={{
                  height: `${heightPercent}%`,
                  opacity: hasValue ? 1 : 0.4,
                  transform: isHovered ? 'scaleY(1.03) translateY(-3px)' : 'none',
                  transformOrigin: 'bottom',
                  filter: isHovered ? 'brightness(1.12)' : 'none',
                }}
              >
                {/* 1. FRONT FACE (Ön Yüz) */}
                <div
                  className={`absolute bottom-0 left-0 transition-all ${
                    is3DMode ? 'rounded-none' : 'rounded-t-md inset-0'
                  }`}
                  style={{
                    width: is3DMode ? 'calc(100% - 7px)' : '100%',
                    height: '100%',
                    backgroundColor: barColor,
                    boxShadow: isHovered && hasValue
                      ? `0 0 20px ${barColor}90`
                      : hasValue
                      ? `0 4px 14px ${barColor}30`
                      : 'none',
                    backgroundImage: is3DMode
                      ? 'linear-gradient(to top, rgba(0, 0, 0, 0.38) 0%, rgba(0, 0, 0, 0.08) 45%, rgba(255, 255, 255, 0.1) 80%, rgba(255, 255, 255, 0.25) 100%)'
                      : 'linear-gradient(to top, rgba(0, 0, 0, 0.3), transparent 70%, rgba(255, 255, 255, 0.25))',
                    borderTop: is3DMode ? '1px solid rgba(255, 255, 255, 0.35)' : undefined,
                    borderLeft: is3DMode ? '1px solid rgba(255, 255, 255, 0.18)' : undefined,
                  }}
                />

                {/* 3D Isometric Faces: Top Cap (Üst Kapak) & Extruded Side (Sağ Yan Yüz) */}
                {is3DMode && (
                  <>
                    {/* 2. ÜST KAPAK (Top Cap): 45° açılı ışık alan, derinlikli poligon tavan kapağı */}
                    <div
                      className="absolute pointer-events-none transition-all"
                      style={{
                        left: 0,
                        right: 0,
                        top: '-7px',
                        height: '7.5px',
                        clipPath: 'polygon(0% 100%, calc(100% - 7px) 100%, 100% 0%, 7px 0%)',
                        backgroundColor: barColor,
                        filter: 'brightness(1.45) saturate(1.1)',
                        backgroundImage:
                          'linear-gradient(135deg, rgba(255, 255, 255, 0.75) 0%, rgba(255, 255, 255, 0.25) 60%, rgba(0, 0, 0, 0.1) 100%)',
                        boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.95)',
                      }}
                    />

                    {/* 3. SAĞ YAN YÜZ (Extruded Side): Arkaya doğru uzanan, %35 gölgeli derinlik duvarı */}
                    <div
                      className="absolute pointer-events-none transition-all"
                      style={{
                        right: 0,
                        width: '7.5px',
                        top: '-7px',
                        bottom: 0,
                        clipPath: 'polygon(0% 7px, 100% 0%, 100% 100%, 0% 100%)',
                        backgroundColor: barColor,
                        filter: 'brightness(0.65)',
                        backgroundImage:
                          'linear-gradient(to bottom, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0.55) 100%)',
                        boxShadow: 'inset 1px 0 2px rgba(0, 0, 0, 0.5)',
                        borderRight: '1px solid rgba(0, 0, 0, 0.3)',
                      }}
                    />
                  </>
                )}

                {/* Value Label above bar - floating clearly above 3D top cap */}
                <div
                  className="absolute text-center text-[10px] font-mono font-bold text-white transition-all pointer-events-none select-none"
                  style={{
                    left: 0,
                    width: is3DMode ? 'calc(100% - 7px)' : '100%',
                    top: is3DMode ? '-24px' : '-18px',
                    textShadow: '0 1px 3px rgba(0, 0, 0, 0.95), 0 0 6px rgba(0, 0, 0, 0.8)',
                  }}
                >
                  {hasValue ? item.value : ''}
                </div>
              </div>

              {/* Bottom Label */}
              <span className="mt-2 text-[11px] font-medium text-slate-300 truncate max-w-[55px] text-center">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
