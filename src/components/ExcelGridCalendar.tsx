import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Check, RotateCcw } from 'lucide-react';
import { AppTheme } from '../types';

interface ExcelGridCalendarProps {
  availableDates: string[]; // ISO YYYY-MM-DD format
  minDate: string;
  maxDate: string;
  selectedStartDate: string;
  selectedEndDate: string;
  onSelectDate: (startDate: string, endDate: string) => void;
  onSelectAll: () => void;
  onClose: () => void;
  theme?: AppTheme;
}

const TURKISH_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const formatDateTR = (dateStr?: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
};

export const ExcelGridCalendar: React.FC<ExcelGridCalendarProps> = ({
  availableDates,
  minDate,
  maxDate,
  selectedStartDate,
  selectedEndDate,
  onSelectDate,
  onSelectAll,
  onClose,
}) => {
  // Determine initial view year/month from selected or min date
  const initialDate = selectedStartDate || minDate || (availableDates[0] ?? new Date().toISOString().split('T')[0]);
  const [initialY, initialM] = initialDate.split('-').map(Number);
  
  const [viewYear, setViewYear] = useState<number>(initialY || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>((initialM ? initialM - 1 : new Date().getMonth()));

  // Internal click tracking for 1-square or 2-square selection
  const [tempStart, setTempStart] = useState<string>(selectedStartDate || '');
  const [tempEnd, setTempEnd] = useState<string>(selectedEndDate || '');
  const [isSecondClick, setIsSecondClick] = useState<boolean>(false);
  const [hoverIso, setHoverIso] = useState<string>('');

  const availableSet = useMemo(() => new Set(availableDates), [availableDates]);

  // Keep view in sync when selected date or date range changes
  React.useEffect(() => {
    const target = selectedStartDate || minDate || availableDates[0];
    if (target) {
      const [y, m] = target.split('-').map(Number);
      if (y && m) {
        setViewYear(y);
        setViewMonth(m - 1);
      }
    }
  }, [selectedStartDate, minDate, availableDates]);

  // Sync internal temp states with parent props
  React.useEffect(() => {
    setTempStart(selectedStartDate || '');
    setTempEnd(selectedEndDate || '');
    setIsSecondClick(false);
  }, [selectedStartDate, selectedEndDate]);

  // Check if date is selectable
  const isDateSelectable = (iso: string) => {
    if (availableSet.has(iso)) return true;
    if (minDate && maxDate && iso >= minDate && iso <= maxDate) return true;
    return false;
  };

  // Navigate months
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(y => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(y => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  // Build the calendar day squares for viewYear & viewMonth
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  // Monday-based offset: Sunday (0) -> 6, Monday (1) -> 0, etc.
  const mondayOffset = (firstDayOfWeek + 6) % 7;

  // Squares array
  const squares = useMemo(() => {
    const list: { day: number; iso: string; isInExcel: boolean }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      list.push({
        day: d,
        iso,
        isInExcel: isDateSelectable(iso),
      });
    }
    return list;
  }, [viewYear, viewMonth, daysInMonth, availableSet, minDate, maxDate]);

  // Handle clicking a day square: 1 square = single day, 2 squares = date range
  const handleSquareClick = (iso: string) => {
    if (!isDateSelectable(iso)) return;

    if (!isSecondClick || (tempStart && tempEnd)) {
      // First click: select single day
      setTempStart(iso);
      setTempEnd('');
      setIsSecondClick(true);
      onSelectDate(iso, iso);
    } else {
      // Second click: select range between tempStart and clicked square
      let start = tempStart;
      let end = iso;
      if (iso < tempStart) {
        start = iso;
        end = tempStart;
      }
      setTempStart(start);
      setTempEnd(end);
      setIsSecondClick(false);
      onSelectDate(start, end);
    }
  };

  // Computed range for visual highlighting (including hover state during second click)
  let activeStart = tempStart || selectedStartDate;
  let activeEnd = tempEnd || selectedEndDate;

  if (isSecondClick && tempStart && hoverIso) {
    activeStart = hoverIso < tempStart ? hoverIso : tempStart;
    activeEnd = hoverIso < tempStart ? tempStart : hoverIso;
  }

  return (
    <div className="rounded-2xl border border-cyan-500/40 bg-slate-950 p-4 shadow-2xl shadow-cyan-950/80 backdrop-blur-2xl ring-1 ring-white/10 w-80 sm:w-88">
      {/* Month & Year Navigation Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Önceki Ay"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="text-center">
          <span className="text-sm font-bold text-white font-sans">
            {TURKISH_MONTHS[viewMonth]} {viewYear}
          </span>
          <div className="text-[10px] text-cyan-400 font-mono font-medium">
            Excel Veri Aralığı: {formatDateTR(minDate)} - {formatDateTR(maxDate)}
          </div>
        </div>

        <button
          type="button"
          onClick={handleNextMonth}
          className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Sonraki Ay"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Weekdays Header: Pazartesi -> Pazar */}
      <div className="grid grid-cols-7 gap-1 text-center py-2 border-b border-white/5">
        {WEEKDAYS.map((wd, i) => (
          <span
            key={wd}
            className={`text-[10px] font-bold uppercase tracking-wider ${
              i >= 5 ? 'text-rose-400/80' : 'text-slate-400'
            }`}
          >
            {wd}
          </span>
        ))}
      </div>

      {/* Calendar Squares Grid */}
      <div className="grid grid-cols-7 gap-1 pt-2">
        {/* Leading empty spaces to align Day 1 with its exact day of the week */}
        {Array.from({ length: mondayOffset }).map((_, idx) => (
          <div key={`empty-${idx}`} className="aspect-square rounded-xl" />
        ))}

        {/* Day Squares */}
        {squares.map(({ day, iso, isInExcel }) => {
          const isSingle = activeStart === iso && (!activeEnd || activeStart === activeEnd);
          const isStart = activeStart === iso;
          const isEnd = activeEnd === iso;
          const isInRange = activeStart && activeEnd && iso >= activeStart && iso <= activeEnd;

          let squareStyle = 'bg-white/[0.03] text-slate-500 border border-transparent';
          if (isInExcel) {
            if (isSingle) {
              squareStyle = 'bg-cyan-500 text-slate-950 font-black border-2 border-cyan-300 shadow-lg shadow-cyan-500/50 scale-105 z-10';
            } else if (isStart || isEnd) {
              squareStyle = 'bg-cyan-500 text-slate-950 font-black border-2 border-cyan-300 shadow-lg shadow-cyan-500/50 scale-105 z-10';
            } else if (isInRange) {
              squareStyle = 'bg-cyan-500/25 text-cyan-200 font-bold border border-cyan-500/40';
            } else {
              squareStyle = 'bg-white/5 text-slate-200 border border-white/10 hover:border-cyan-400 hover:text-white hover:bg-cyan-950/40 cursor-pointer';
            }
          } else {
            squareStyle = 'opacity-20 text-slate-600 cursor-not-allowed';
          }

          return (
            <button
              key={iso}
              type="button"
              disabled={!isInExcel}
              onClick={() => handleSquareClick(iso)}
              onMouseEnter={() => {
                if (isSecondClick) setHoverIso(iso);
              }}
              onMouseLeave={() => {
                if (isSecondClick) setHoverIso('');
              }}
              className={`relative aspect-square rounded-xl flex flex-col items-center justify-center text-xs font-mono transition-all ${squareStyle}`}
              title={isInExcel ? `${formatDateTR(iso)} (Excel verisi mevcut - Tıkla)` : `${formatDateTR(iso)} (Excelde veri yok)`}
            >
              <span>{day}</span>
              {isInExcel && (
                <span
                  className={`absolute bottom-1 h-1 w-1 rounded-full ${
                    isSingle || isStart || isEnd ? 'bg-slate-950' : isInRange ? 'bg-cyan-300' : 'bg-cyan-400'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Info & Action Bar */}
      <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center space-x-1.5 text-cyan-300 font-mono">
            <CalendarIcon className="h-3.5 w-3.5 text-cyan-400" />
            <span className="font-bold">
              {activeStart === activeEnd || !activeEnd
                ? activeStart ? formatDateTR(activeStart) : 'Gün seçin'
                : `${formatDateTR(activeStart)} - ${formatDateTR(activeEnd)}`}
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            {activeStart === activeEnd || !activeEnd
              ? '(Tek Gün)'
              : `(${availableDates.filter(d => d >= activeStart && d <= activeEnd).length} Gün)`}
          </span>
        </div>

        <div className="flex items-center justify-between pt-1 gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            className="flex items-center space-x-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-cyan-300 hover:bg-white/5 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Tüm Veri</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center space-x-1 rounded-lg bg-cyan-500 px-3.5 py-1 text-xs font-bold text-slate-950 hover:bg-cyan-400 shadow-md shadow-cyan-500/30 transition-all"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Tamam</span>
          </button>
        </div>
      </div>
    </div>
  );
};
