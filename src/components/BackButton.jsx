import React from 'react';
import { ArrowLeft } from 'lucide-react';

/**
 * Reusable in-app Back navigation button for secondary / detail pages.
 * Supports multiple style variants and full keyboard/screen-reader accessibility.
 *
 * @param {Object} props
 * @param {() => void} props.onClick - Click handler to navigate to parent route
 * @param {string} [props.label='Back'] - Contextual label (e.g. 'Back to Dashboard')
 * @param {string} [props.className=''] - Additional Tailwind CSS classes
 * @param {'default' | 'subtle' | 'ghost'} [props.variant='default'] - Visual style variant
 * @param {string} [props.ariaLabel] - Accessible label override
 */
export function BackButton({
  onClick,
  label = 'Back',
  className = '',
  variant = 'default',
  ariaLabel,
}) {
  const baseClasses =
    'group inline-flex items-center space-x-2 text-xs font-semibold rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950 select-none cursor-pointer';

  const variantClasses = {
    default:
      'px-3.5 py-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 hover:border-slate-600 shadow-sm active:scale-[0.98]',
    subtle:
      'px-3 py-1.5 bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-slate-100 border border-transparent hover:border-slate-700/50',
    ghost:
      'p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel || label}
      className={`${baseClasses} ${variantClasses[variant] || variantClasses.default} ${className}`}
    >
      <ArrowLeft className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-brand-400 group-hover:-translate-x-0.5 transition-all duration-200" />
      {label && <span>{label}</span>}
    </button>
  );
}

export default BackButton;
