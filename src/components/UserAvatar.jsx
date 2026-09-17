import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-[10px] rounded-lg',
  sm: 'w-8 h-8 text-xs rounded-xl',
  md: 'w-10 h-10 text-sm rounded-xl',
  lg: 'w-12 h-12 text-base rounded-2xl',
  xl: 'w-16 h-16 text-xl rounded-2xl',
  '2xl': 'w-24 h-24 text-3xl rounded-3xl',
};

const ROUNDED_FULL_CLASSES = {
  xs: 'w-6 h-6 text-[10px] rounded-full',
  sm: 'w-8 h-8 text-xs rounded-full',
  md: 'w-10 h-10 text-sm rounded-full',
  lg: 'w-12 h-12 text-base rounded-full',
  xl: 'w-16 h-16 text-xl rounded-full',
  '2xl': 'w-24 h-24 text-3xl rounded-full',
};

/**
 * Reusable Avatar Component for FocusLens.
 *
 * Renders user's uploaded avatar image when present, with automatic fallback
 * to user initials or default User silhouette.
 */
export function UserAvatar({
  user,
  size = 'md',
  roundedFull = false,
  className = '',
  alt,
}) {
  const [imgError, setImgError] = useState(false);

  // Reset imgError if avatarUrl changes
  useEffect(() => {
    setImgError(false);
  }, [user?.avatarUrl]);

  const sizeClass = (roundedFull ? ROUNDED_FULL_CLASSES : SIZE_CLASSES)[size] || SIZE_CLASSES.md;
  const initial = (user?.name || user?.username || user?.email || 'U')[0]?.toUpperCase() || 'U';

  if (user?.avatarUrl && !imgError) {
    return (
      <div
        className={`relative inline-flex items-center justify-center overflow-hidden shrink-0 shadow-md ${sizeClass} ${className}`}
      >
        <img
          src={user.avatarUrl}
          alt={alt || user?.name || user?.username || 'User avatar'}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center font-bold text-white bg-gradient-to-tr from-brand-600 to-indigo-500 shadow-md shadow-brand-500/20 shrink-0 select-none ${sizeClass} ${className}`}
      title={user?.name || user?.username || user?.email || 'User'}
      aria-label={user?.name || user?.username || 'User'}
    >
      {initial}
    </div>
  );
}
