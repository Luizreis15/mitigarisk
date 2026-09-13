import { useId } from 'react';

import { messages } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils';

export function MitigaMark({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const gradientId = `mitiga${useId().replaceAll(':', '')}`;
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="size-10 rounded-[10px]"
      >
        <rect width="40" height="40" rx="10" fill={`url(#${gradientId})`} />
        <path
          d="M11 27.5V13.2C11 12.3 12.05 11.8 12.78 12.28L19.2 16.48C19.7 16.81 20.3 16.81 20.8 16.48L27.22 12.28C27.95 11.8 29 12.3 29 13.2V27.5"
          stroke="#F7F9F8"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15.2 24.4C16.7 22.2 18.3 21.1 20 21.1C21.7 21.1 23.3 22.2 24.8 24.4"
          stroke="#DCEBE8"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <circle cx="20" cy="21.2" r="2.1" fill="#DCEBE8" />
        <defs>
          <linearGradient
            id={gradientId}
            x1="4"
            y1="6"
            x2="36"
            y2="34"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#244B5A" />
            <stop offset="0.55" stopColor="#4F7D72" />
            <stop offset="1" stopColor="#6B6F8E" />
          </linearGradient>
        </defs>
      </svg>
      {compact ? (
        <span className="sr-only">{messages.brand}</span>
      ) : (
        <span className="text-[0.95rem] font-semibold tracking-[0.12em] text-inherit uppercase">
          {messages.brand}
        </span>
      )}
    </span>
  );
}
