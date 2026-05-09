import React, { useEffect, useMemo, useState } from 'react';
import { resolveMediaUrl } from '../../api';

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-sm',
  xl: 'w-16 h-16 text-xl',
};

const initials = (value = '') => {
  const clean = String(value || '').trim();
  if (!clean) return 'C';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const isBadMediaValue = (value = '') => {
  const clean = String(value || '').trim().toLowerCase();
  return !clean || clean === 'null' || clean === 'undefined' || clean === 'nan';
};

export default function Avatar({
  src,
  user,
  name,
  username,
  className = '',
  size = 'md',
  alt = '',
  ring = false,
}) {
  const [failed, setFailed] = useState(false);
  const rawSrc = src ?? user?.profilePicture ?? user?.avatarUrl ?? user?.photoUrl ?? '';
  const resolved = useMemo(() => isBadMediaValue(rawSrc) ? '' : resolveMediaUrl(rawSrc), [rawSrc]);
  const label = name || user?.fullName || username || user?.username || alt || 'ConnectSphere';
  const computedClassName = className || sizeClasses[size] || sizeClasses.md;

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  const node = (
    <div className={`avatar ${computedClassName}`} title={label}>
      {resolved && !failed ? (
        <img
          src={resolved}
          alt={alt || label}
          className="w-full h-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{initials(label)}</span>
      )}
    </div>
  );

  return ring ? <div className="story-ring inline-flex">{node}</div> : node;
}
