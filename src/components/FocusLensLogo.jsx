import React from 'react';

/**
 * FocusLens Official Brand Logo — "F + Lens"
 * Combines the letter "F" from FocusLens with a modern camera lens / aperture concept.
 * 
 * Variants:
 * - 'icon': Just the standalone circular F+Lens mark
 * - 'horizontal': The F+Lens mark with the official "FocusLens" wordmark
 * - 'compact': A compact layout optimized for mobile headers and sidebars
 * 
 * @param {Object} props
 * @param {'horizontal'|'icon'|'compact'} [props.variant='horizontal']
 * @param {'sm'|'md'|'lg'|'xl'} [props.size='md']
 * @param {string} [props.className='']
 * @param {string} [props.textClassName='']
 * @param {string} [props.ariaLabel='FocusLens home']
 * @param {boolean} [props.isDecorative=false]
 * @param {Function} [props.onClick]
 */
export function FocusLensLogo({
  variant = 'horizontal',
  size = 'md',
  className = '',
  textClassName = '',
  ariaLabel = 'FocusLens home',
  isDecorative = false,
  onClick,
}) {
  // Dimension mapping for the SVG icon
  const sizeMap = {
    sm: { icon: 24, font: 'text-base', gap: 'space-x-2' },
    md: { icon: 32, font: 'text-xl', gap: 'space-x-2.5' },
    lg: { icon: 40, font: 'text-2xl', gap: 'space-x-3' },
    xl: { icon: 48, font: 'text-3xl', gap: 'space-x-3.5' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;
  const iconPixel = currentSize.icon;

  // Standalone geometric SVG mark: F + Lens
  const LogoMark = (
    <svg
      width={iconPixel}
      height={iconPixel}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 transition-transform duration-300 group-hover:scale-105"
      aria-hidden="true"
    >
      <defs>
        {/* Electric cyan to vibrant blue gradient */}
        <linearGradient id="fl-brand-grad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="48%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>

        {/* Deep optical chamber background */}
        <linearGradient id="fl-chamber-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0F1F2E" />
          <stop offset="100%" stopColor="#080F16" />
        </linearGradient>

        {/* Subtle optic glow */}
        <filter id="fl-lens-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#06B6D4" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* 1. Outer Lens Barrel / Chamber */}
      <circle
        cx="24"
        cy="24"
        r="21.5"
        fill="url(#fl-chamber-bg)"
        stroke="#1E293B"
        strokeWidth="1"
      />

      {/* 2. Lens Outer Calibrated Ring with aperture break */}
      <circle
        cx="24"
        cy="24"
        r="20"
        stroke="url(#fl-brand-grad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="112 14"
        filter="url(#fl-lens-glow)"
      />

      {/* 3. Subtle aperture tick marks at cardinal positions */}
      <line x1="24" y1="2.5" x2="24" y2="4.5" stroke="#22D3EE" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      <line x1="45.5" y1="24" x2="43.5" y2="24" stroke="#22D3EE" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      <line x1="24" y1="45.5" x2="24" y2="43.5" stroke="#22D3EE" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      <line x1="2.5" y1="24" x2="4.5" y2="24" stroke="#22D3EE" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />

      {/* 4. Abstract Letter "F" integrated into lens optics */}
      {/* F Vertical Spine (anchored along lens left chord) */}
      <rect
        x="11.5"
        y="11"
        width="6"
        height="26"
        rx="3"
        fill="url(#fl-brand-grad)"
      />

      {/* F Top Horizontal Arm (sweeps seamlessly across upper aperture) */}
      <path
        d="M15 11 H34.5 C36 11 37 12 37 13.5 V14 C37 15.5 36 17 34.5 17 H15 V11 Z"
        fill="url(#fl-brand-grad)"
      />

      {/* F Middle Crossbar (points directly toward the central focal core) */}
      <path
        d="M15 22.5 H28.5 C29.8 22.5 30.5 23.2 30.5 24.5 V24.5 C30.5 25.8 29.8 26.5 28.5 26.5 H15 V22.5 Z"
        fill="url(#fl-brand-grad)"
      />

      {/* 5. Central Focal Optic / Aperture Core */}
      <circle cx="34" cy="25.5" r="2.25" fill="#22D3EE" />
      <circle
        cx="34"
        cy="25.5"
        r="5"
        stroke="#22D3EE"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="3 3"
        opacity="0.6"
      />

      {/* 6. Lower-Right Aperture Arc completing the optic circle symmetry */}
      <path
        d="M 21.5 37 A 15 15 0 0 0 36.5 28"
        stroke="url(#fl-brand-grad)"
        strokeWidth="2.25"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );

  // Icon only variant
  if (variant === 'icon') {
    return (
      <div
        className={`inline-flex items-center justify-center ${className}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={isDecorative ? undefined : ariaLabel}
        aria-hidden={isDecorative ? 'true' : undefined}
      >
        {LogoMark}
      </div>
    );
  }

  // Wordmark element
  const Wordmark = (
    <span className={`font-bold tracking-tight select-none ${currentSize.font} ${textClassName}`}>
      <span className="text-white font-bold">Focus</span>
      <span className="text-cyan-400 font-bold">Lens</span>
    </span>
  );

  // Compact variant (smaller footprint, tighter spacing)
  if (variant === 'compact') {
    return (
      <div
        className={`inline-flex items-center space-x-2 ${onClick ? 'cursor-pointer group' : ''} ${className}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={isDecorative ? undefined : ariaLabel}
        aria-hidden={isDecorative ? 'true' : undefined}
      >
        {LogoMark}
        {Wordmark}
      </div>
    );
  }

  // Horizontal variant (default: Mark + Wordmark)
  return (
    <div
      className={`inline-flex items-center ${currentSize.gap} ${onClick ? 'cursor-pointer group' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={isDecorative ? undefined : ariaLabel}
      aria-hidden={isDecorative ? 'true' : undefined}
    >
      {LogoMark}
      {Wordmark}
    </div>
  );
}

export default FocusLensLogo;
