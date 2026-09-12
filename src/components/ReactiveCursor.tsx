import React, { useEffect, useState } from 'react';
import { RenderMode } from '../types';

interface ReactiveCursorProps {
  renderMode: RenderMode;
}

export const ReactiveCursor: React.FC<ReactiveCursorProps> = ({ renderMode }) => {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [isHovered, setIsHovered] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (renderMode === 'efficiency') return;

    const handleMouseMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
      if (!isVisible) setIsVisible(true);

      const target = e.target as HTMLElement | null;
      if (target) {
        const interactive = target.closest('button, a, input, select, [role="button"], .cursor-pointer');
        setIsHovered(!!interactive);
      }
    };

    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);
    const handleMouseLeave = () => setIsVisible(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [renderMode, isVisible]);

  if (renderMode === 'efficiency' || !isVisible) return null;

  return (
    <>
      {/* Outer Glow Halo */}
      <div
        className="pointer-events-none fixed z-50 rounded-full transition-transform duration-100 ease-out hidden md:block"
        style={{
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          width: isHovered ? '48px' : '28px',
          height: isHovered ? '48px' : '28px',
          transform: `translate(-50%, -50%) scale(${isClicking ? 0.75 : 1})`,
          border: '1.5px solid rgba(6, 182, 212, 0.65)',
          backgroundColor: isHovered ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
          boxShadow: isHovered ? '0 0 20px rgba(6, 182, 212, 0.5), inset 0 0 10px rgba(6, 182, 212, 0.3)' : '0 0 10px rgba(6, 182, 212, 0.25)',
        }}
      />
      {/* Center Laser Dot */}
      <div
        className="pointer-events-none fixed z-50 h-1.5 w-1.5 rounded-full bg-cyan-300 transition-transform duration-75 ease-out hidden md:block"
        style={{
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 0 6px #22d3ee',
        }}
      />
    </>
  );
};
