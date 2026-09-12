import React, { useState } from 'react';
import { RenderMode } from '../types';

interface RadarAxis {
  label: string;
  value: number; // 0 - 100
  benchmark?: number;
}

interface RadarChart3DProps {
  axes: RadarAxis[];
  title?: string;
  staffName?: string;
  color?: string;
  renderMode?: RenderMode;
  compareStaffName?: string;
  compareAxes?: RadarAxis[];
  compareColor?: string;
  size?: 'compact' | 'large';
}

export const RadarChart3D: React.FC<RadarChart3DProps> = ({
  axes,
  title = 'Yetkinlik & KPI Radarı',
  staffName,
  color = '#06b6d4',
  renderMode = 'performance',
  compareStaffName,
  compareAxes,
  compareColor = '#ec4899',
  size = 'compact',
}) => {
  const [hoveredAxis, setHoveredAxis] = useState<number | null>(null);

  const isLarge = size === 'large';

  // SVG Canvas dimensions:
  // 'compact' for PersonnelKPIView (preserved completely without affecting KPI view)
  // 'large' for ComparisonMatrixView: perfectly fills card height with tight viewBox margins (800x560), eliminating bottom blank space
  const width = isLarge ? 800 : 560;
  const height = isLarge ? 560 : 370;
  const centerX = width / 2; // 400 or 280
  const centerY = isLarge ? 280 : 180;
  const radius = isLarge ? 200 : 112; 
  const totalAxes = Math.max(1, axes.length);
  const labelDist = isLarge ? radius + 52 : radius + 22;

  // Helper to safely clamp values between 0 and 100 to prevent inverted polygons & negative labels
  const clamp = (val: number) => Math.max(0, Math.min(100, isNaN(val) ? 0 : val));

  const getCoordinates = (index: number, val: number) => {
    const angle = (Math.PI * 2 / totalAxes) * index - Math.PI / 2;
    const safeVal = clamp(val);
    const r = (safeVal / 100) * radius;
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    };
  };

  // Generate Polygon Path Points for Primary Staff
  const primaryPoints = axes.map((a, i) => {
    const { x, y } = getCoordinates(i, a.value);
    return `${x},${y}`;
  }).join(' ');

  // Generate Polygon Path Points for Compare Staff
  const comparePoints = compareAxes ? compareAxes.map((a, i) => {
    const { x, y } = getCoordinates(i, a.value);
    return `${x},${y}`;
  }).join(' ') : null;

  // Grid Rings
  const rings = [0.25, 0.5, 0.75, 1.0];

  const is3D = renderMode === 'performance';
  const hasPrimaryStaff = Boolean(staffName);

  return (
    <div className={`flex flex-col items-center w-full overflow-visible ${isLarge ? 'h-full justify-between' : ''}`}>
      {title && (
        <div className="w-full text-left mb-1 px-1 shrink-0">
          <h4 className={`${isLarge ? 'text-base font-black' : 'text-sm font-bold'} text-white tracking-wide uppercase`}>{title}</h4>
          <div className={`flex items-center ${isLarge ? 'space-x-4 text-sm mt-1 min-h-[22px]' : 'space-x-3 text-xs mt-0.5 min-h-[18px]'} text-slate-300`}>
            {hasPrimaryStaff ? (
              <>
                <span className="flex items-center space-x-1.5">
                  <span className={`${isLarge ? 'w-3 h-3' : 'w-2.5 h-2.5'} rounded-full shadow-sm`} style={{ backgroundColor: color }} />
                  <span className="font-semibold text-slate-100">{staffName}</span>
                </span>
                {compareStaffName && (
                  <span className="flex items-center space-x-1.5">
                    <span className={`${isLarge ? 'w-3 h-3' : 'w-2.5 h-2.5'} rounded-full shadow-sm`} style={{ backgroundColor: compareColor }} />
                    <span className="font-semibold text-slate-100">{compareStaffName}</span>
                  </span>
                )}
              </>
            ) : (
              <p className={`${isLarge ? 'text-sm' : 'text-xs'} text-slate-400`}>Kıyaslama başlatmak için yukarıdan 1. personeli seçiniz</p>
            )}
          </div>
        </div>
      )}

      <div
        className={`relative transition-transform duration-500 select-none w-full flex items-center justify-center mx-auto overflow-visible ${
          isLarge ? 'flex-1 w-full my-auto' : 'max-w-[480px]'
        }`}
        style={
          is3D
            ? {
                perspective: '1000px',
                transform: 'rotateX(15deg) rotateZ(0deg)',
                filter: isLarge ? 'drop-shadow(0 20px 36px rgba(0,0,0,0.55))' : 'drop-shadow(0 14px 24px rgba(0,0,0,0.5))',
              }
            : undefined
        }
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={`w-full h-auto object-contain overflow-visible ${
            isLarge ? 'max-h-[500px]' : 'max-h-[300px]'
          }`}
        >
          <defs>
            <radialGradient id="radarCenterGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </radialGradient>
            <filter id="amberGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Central subtle ambient glow */}
          <circle cx={centerX} cy={centerY} r={radius * 1.06} fill="url(#radarCenterGlow)" pointerEvents="none" />

          {/* Background Concentric Polygon Rings */}
          {rings.map((ringScale, rIdx) => {
            const ringPoints = axes.map((_, i) => {
              const angle = (Math.PI * 2 / totalAxes) * i - Math.PI / 2;
              const r = radius * ringScale;
              return `${centerX + r * Math.cos(angle)},${centerY + r * Math.sin(angle)}`;
            }).join(' ');

            return (
              <polygon
                key={rIdx}
                points={ringPoints}
                fill="none"
                stroke="rgba(255, 255, 255, 0.14)"
                strokeWidth={rIdx === rings.length - 1 ? (isLarge ? '3.2' : '2.4') : (isLarge ? '2.0' : '1.4')}
                strokeDasharray={rIdx < rings.length - 1 ? '4 4' : 'none'}
              />
            );
          })}

          {/* Radial Spokes with Hover Reaction */}
          {axes.map((_, i) => {
            const angle = (Math.PI * 2 / totalAxes) * i - Math.PI / 2;
            const x2 = centerX + radius * Math.cos(angle);
            const y2 = centerY + radius * Math.sin(angle);
            const isHovered = hoveredAxis === i;

            return (
              <line
                key={i}
                x1={centerX}
                y1={centerY}
                x2={x2}
                y2={y2}
                stroke={isHovered ? 'rgba(251, 191, 36, 0.9)' : 'rgba(255, 255, 255, 0.18)'}
                strokeWidth={isHovered ? (isLarge ? '4.5' : '3.5') : (isLarge ? '2.2' : '1.6')}
                className="transition-all duration-300"
              />
            );
          })}

          {/* Compare Staff Polygon */}
          {hasPrimaryStaff && comparePoints && (
            <g className="transition-all duration-300">
              <polygon
                points={comparePoints}
                fill={`${compareColor}33`}
                stroke={compareColor}
                strokeWidth={isLarge ? '4.5' : '3.5'}
                className="filter drop-shadow-sm"
              />
              {compareAxes?.map((a, i) => {
                const { x, y } = getCoordinates(i, a.value);
                const isHovered = hoveredAxis === i;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={isHovered ? (isLarge ? 14 : 11) : (isLarge ? 9 : 6.5)}
                    fill={compareColor}
                    stroke="#ffffff"
                    strokeWidth={isHovered ? 3.5 : 2.2}
                    className="transition-all duration-300"
                    style={isHovered ? { filter: 'drop-shadow(0 0 10px rgba(236,72,153,0.95))' } : undefined}
                  />
                );
              })}
            </g>
          )}

          {/* Primary Staff Polygon */}
          {hasPrimaryStaff && (
            <polygon
              points={primaryPoints}
              fill={`${color}44`}
              stroke={color}
              strokeWidth={isLarge ? '4.5' : '3.5'}
              className="filter drop-shadow-md transition-all duration-300"
            />
          )}

          {/* Vertex Points with Hover Bulge Effect */}
          {hasPrimaryStaff && axes.map((a, i) => {
            const { x, y } = getCoordinates(i, a.value);
            const isHovered = hoveredAxis === i;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={isHovered ? (isLarge ? 15 : 12) : (isLarge ? 10 : 7)}
                fill={isHovered ? '#fbbf24' : color}
                stroke="#ffffff"
                strokeWidth={isHovered ? 3.5 : 2.5}
                className="transition-all duration-300 cursor-pointer"
                style={isHovered ? { filter: 'drop-shadow(0 0 12px rgba(251, 191, 36, 1))' } : undefined}
                onMouseEnter={() => setHoveredAxis(i)}
                onMouseLeave={() => setHoveredAxis(null)}
              />
            );
          })}

          {/* Empty state guideline dots when no staff selected */}
          {!hasPrimaryStaff && axes.map((_, i) => {
            const angle = (Math.PI * 2 / totalAxes) * i - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={isLarge ? 7 : 5}
                fill="rgba(255, 255, 255, 0.3)"
                stroke="rgba(255, 255, 255, 0.6)"
                strokeWidth={2}
              />
            );
          })}

          {/* Outer Axis Labels with Interactive 3D Bulge & Scale Effect (3x Font Size in Comparison view) */}
          {axes.map((a, i) => {
            const angle = (Math.PI * 2 / totalAxes) * i - Math.PI / 2;
            const lx = centerX + labelDist * Math.cos(angle);
            const ly = centerY + labelDist * Math.sin(angle);
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            // Anchor text according to angle
            let anchor: 'start' | 'middle' | 'end' = 'middle';
            if (cos > 0.25) anchor = 'start';
            else if (cos < -0.25) anchor = 'end';

            // Vertical offset adjustment
            let dy = 0;
            if (sin > 0.3) dy = isLarge ? 26 : 16;
            else if (sin < -0.3) dy = isLarge ? -20 : -10;

            const safeVal = clamp(a.value);
            const isHovered = hoveredAxis === i;

            return (
              <g
                key={i}
                className="cursor-pointer select-none"
                onMouseEnter={() => setHoveredAxis(i)}
                onMouseLeave={() => setHoveredAxis(null)}
                style={{
                  transformOrigin: `${lx}px ${ly}px`,
                  transform: isHovered ? 'scale(1.15)' : 'scale(1)',
                  transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.25s ease',
                  filter: isHovered ? 'drop-shadow(0 6px 16px rgba(251, 191, 36, 0.55))' : undefined,
                }}
              >
                {/* Generous invisible hit zone for smooth cursor tracking */}
                <circle
                  cx={lx + (anchor === 'start' ? 32 : anchor === 'end' ? -32 : 0)}
                  cy={ly + dy + (isLarge ? 18 : 10)}
                  r={isLarge ? 80 : 56}
                  fill="transparent"
                />

                {/* Subtle illuminated highlight pill when hovered */}
                {isHovered && (
                  <rect
                    x={lx + (anchor === 'start' ? (isLarge ? -16 : -10) : anchor === 'end' ? (isLarge ? -210 : -130) : (isLarge ? -110 : -70))}
                    y={ly + dy - (isLarge ? 34 : 22)}
                    width={isLarge ? '220' : '140'}
                    height={isLarge ? '84' : '58'}
                    rx={isLarge ? '16' : '12'}
                    fill="rgba(15, 23, 42, 0.92)"
                    stroke="rgba(251, 191, 36, 0.75)"
                    strokeWidth={isLarge ? 2.5 : 1.8}
                  />
                )}

                {/* Metric Label (e.g. AHT Hızı, Memnuniyet) - 3X FONT SIZE in comparison (34px vs 20px) */}
                <text
                  x={lx}
                  y={ly + dy}
                  textAnchor={anchor}
                  className={`font-bold tracking-tight transition-colors duration-200 ${
                    isLarge ? 'text-[34px]' : 'text-[20px]'
                  } ${
                    isHovered ? 'fill-amber-300 font-black' : 'fill-slate-100'
                  }`}
                >
                  {a.label}
                </text>

                {/* Percentage Badge - 3X FONT SIZE in comparison (30px vs 18px) */}
                {hasPrimaryStaff ? (
                  <text
                    x={lx}
                    y={ly + dy + (isLarge ? 34 : 22)}
                    textAnchor={anchor}
                    className={`font-mono font-bold transition-colors duration-200 ${
                      isLarge ? 'text-[30px]' : 'text-[18px]'
                    } ${
                      isHovered ? 'fill-amber-400 font-black' : 'fill-cyan-400'
                    }`}
                  >
                    %{safeVal}
                  </text>
                ) : (
                  <text
                    x={lx}
                    y={ly + dy + (isLarge ? 34 : 22)}
                    textAnchor={anchor}
                    className={`font-mono font-medium fill-slate-500 ${
                      isLarge ? 'text-[26px]' : 'text-[16px]'
                    }`}
                  >
                    -%
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
