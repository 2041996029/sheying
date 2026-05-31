import React from 'react';

export function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || !query.trim()) return text;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  if (parts.length === 1) return text;

  return React.createElement(
    React.Fragment,
    null,
    ...parts.map((part, i) =>
      regex.test(part)
        ? React.createElement('mark', { key: i, className: 'bg-primary/30 text-foreground rounded px-0.5' }, part)
        : part
    )
  );
}
