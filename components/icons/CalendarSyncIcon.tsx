import React from 'react';

// Un ícono que combina un calendario y una flecha de sincronización
export const CalendarSyncIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <path d="M21 15a.5.5 0 0 0-1 0v3a.5.5 0 0 0 1 0v-3z" />
    <path d="M22 19a3 3 0 0 1-5.65 1.42l-1.07-1.92" />
    <path d="M17 22a3 3 0 0 1 5.65-1.42l1.07 1.92" />
  </svg>
);
export default CalendarSyncIcon;