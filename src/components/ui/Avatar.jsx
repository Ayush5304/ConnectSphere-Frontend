import React, { useEffect, useState } from 'react';
import { resolveMediaUrl } from '../../api';

const initials = (value = '') => {
  const clean = String(value || '').trim();
  if (!clean) return 'C';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export default function Avatar({ src, name, username, className = 'w-10 h-10 text-sm', alt = '', ring = false }) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveMediaUrl(src || '');
  const label = name || username || alt || 'ConnectSphere';

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  const node = (
    <div className={`avatar ${className}`} title={label}>
      {resolved && !failed ? (
        <img
          src={resolved}
          alt={alt || label}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{initials(label)}</span>
      )}
    </div>
  );

  return ring ? <div className="story-ring inline-flex">{node}</div> : node;
}
