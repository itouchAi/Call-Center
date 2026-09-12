import React, { useRef, useState } from 'react';
import { RenderMode } from '../types';

interface Interactive3DCardProps {
  children: React.ReactNode;
  className?: string;
  renderMode?: RenderMode;
  glowColor?: string;
  depth?: number;
  onClick?: () => void;
  id?: string;
}

export const Interactive3DCard: React.FC<Interactive3DCardProps> = ({
  children,
  className = '',
  renderMode = 'performance',
  glowColor = 'rgba(6, 182, 212, 0.4)',
  depth = 20,
  onClick,
  id,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (renderMode === 'efficiency') return;
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = -((y - centerY) / centerY) * (depth / 2);
    const rotY = ((x - centerX) / centerX) * (depth / 2);

    setRotateX(rotX);
    setRotateY(rotY);
    setGlowPos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 1,
    });
  };

  const handleMouseLeave = () => {
    if (renderMode === 'efficiency') return;
    setRotateX(0);
    setRotateY(0);
    setGlowPos(prev => ({ ...prev, opacity: 0 }));
  };

  const isPerformance = renderMode === 'performance';

  const hasOverflowClass = className.includes('overflow-');

  return (
    <div
      id={id}
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={
        isPerformance
          ? {
              transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0)`,
              transition: rotateX === 0 ? 'transform 0.5s ease-out' : 'transform 0.08s ease-out',
            }
          : undefined
      }
      className={`relative ${hasOverflowClass ? '' : 'overflow-hidden'} interactive-card-bg transition-all duration-300 ${className}`}
    >
      {/* Specular Radial Glow Highlight */}
      {isPerformance && (
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300 z-0"
          style={{
            opacity: glowPos.opacity,
            background: `radial-gradient(400px circle at ${glowPos.x}% ${glowPos.y}%, ${glowColor}, transparent 70%)`,
          }}
        />
      )}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};
