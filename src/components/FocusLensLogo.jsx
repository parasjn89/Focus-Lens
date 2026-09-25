import React from 'react';

/**
 * FocusLens Official Brand Logo Component
 * 
 * Source of truth: Official FocusLens brand logo asset featuring the
 * blue/purple stylized eye + lens symbol and modern "FocusLens" wordmark.
 *
 * Supported Variants:
 * - 'horizontal' | 'full': Full official horizontal logo (eye/lens symbol + wordmark)
 * - 'icon': Standalone square eye/lens brand symbol
 * - 'compact': Responsive mode (icon on mobile <sm, full horizontal logo on desktop >=sm)
 *
 * Sizing:
 * - 'sm': 24px height
 * - 'md': 32px height (default)
 * - 'lg': 40px height
 * - 'xl': 48px height
 *
 * @param {Object} props
 * @param {'horizontal'|'full'|'icon'|'compact'} [props.variant='horizontal']
 * @param {'sm'|'md'|'lg'|'xl'} [props.size='md']
 * @param {string} [props.className='']
 * @param {string} [props.imgClassName='']
 * @param {string} [props.textClassName='']
 * @param {string} [props.alt]
 * @param {string} [props.ariaLabel='FocusLens home']
 * @param {boolean} [props.isDecorative=false]
 * @param {Function} [props.onClick]
 */
export function FocusLensLogo({
  variant = 'horizontal',
  size = 'md',
  className = '',
  imgClassName = '',
  textClassName = '',
  alt,
  ariaLabel = 'FocusLens home',
  isDecorative = false,
  onClick,
}) {
  const sizeMap = {
    sm: {
      horizontalClass: 'h-6',
      iconClass: 'w-6 h-6',
      height: 24,
      width: 94, // 24 * (411 / 105) ≈ 94
    },
    md: {
      horizontalClass: 'h-8',
      iconClass: 'w-8 h-8',
      height: 32,
      width: 125, // 32 * (411 / 105) ≈ 125
    },
    lg: {
      horizontalClass: 'h-10',
      iconClass: 'w-10 h-10',
      height: 40,
      width: 157, // 40 * (411 / 105) ≈ 157
    },
    xl: {
      horizontalClass: 'h-12',
      iconClass: 'w-12 h-12',
      height: 48,
      width: 188, // 48 * (411 / 105) ≈ 188
    },
  };

  const currentSize = sizeMap[size] || sizeMap.md;
  const imageAlt = isDecorative ? '' : (alt || 'FocusLens');

  const handleKeyDown = (e) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick(e);
    }
  };

  const wrapperProps = {
    className: `inline-flex items-center select-none ${onClick ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-lg' : ''} ${className}`,
    onClick,
    onKeyDown: onClick ? handleKeyDown : undefined,
    role: onClick ? 'button' : undefined,
    tabIndex: onClick ? 0 : undefined,
    'aria-label': isDecorative ? undefined : ariaLabel,
    'aria-hidden': isDecorative ? true : undefined,
  };

  // 1. Standalone Icon Variant
  if (variant === 'icon') {
    return (
      <div {...wrapperProps}>
        <img
          src="/branding/focuslens-icon.png"
          alt={imageAlt}
          width={currentSize.height}
          height={currentSize.height}
          style={{ aspectRatio: '1 / 1' }}
          className={`${currentSize.iconClass} object-contain rounded-lg shrink-0 ${imgClassName}`}
          loading="eager"
          decoding="async"
        />
      </div>
    );
  }

  // 2. Compact Variant (Responsive: Icon on mobile <sm, Full logo on desktop >=sm)
  if (variant === 'compact') {
    return (
      <div {...wrapperProps}>
        {/* Mobile icon mark */}
        <img
          src="/branding/focuslens-icon.png"
          alt={imageAlt}
          width={currentSize.height}
          height={currentSize.height}
          style={{ aspectRatio: '1 / 1' }}
          className={`block sm:hidden ${currentSize.iconClass} object-contain rounded-lg shrink-0 ${imgClassName}`}
          loading="eager"
          decoding="async"
        />
        {/* Desktop horizontal logo */}
        <img
          src="/branding/focuslens-logo.png"
          alt={imageAlt}
          width={currentSize.width}
          height={currentSize.height}
          style={{ aspectRatio: '411 / 105' }}
          className={`hidden sm:block ${currentSize.horizontalClass} w-auto object-contain rounded-lg shrink-0 ${imgClassName}`}
          loading="eager"
          decoding="async"
        />
      </div>
    );
  }

  // 3. Full / Horizontal Variant (Default: Mark + Wordmark)
  return (
    <div {...wrapperProps}>
      <img
        src="/branding/focuslens-logo.png"
        alt={imageAlt}
        width={currentSize.width}
        height={currentSize.height}
        style={{ aspectRatio: '411 / 105' }}
        className={`${currentSize.horizontalClass} w-auto object-contain rounded-lg shrink-0 ${imgClassName}`}
        loading="eager"
        decoding="async"
      />
    </div>
  );
}

export default FocusLensLogo;
