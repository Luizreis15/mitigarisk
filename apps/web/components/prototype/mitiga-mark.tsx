import Image from 'next/image';

import { messages } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils';

const symbolSrc = '/mitiga-symbol.png';
const symbolSide = 40;
const compactSide = 32;

export function MitigaMark({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const side = compact ? compactSide : symbolSide;

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Image
        src={symbolSrc}
        alt={compact ? messages.brandMarkAlt : ''}
        width={side}
        height={side}
        className="shrink-0 object-contain"
        unoptimized
        priority
      />
      {compact ? null : (
        <span className="text-[0.95rem] font-semibold tracking-[0.12em] text-inherit uppercase">
          {messages.brand}
        </span>
      )}
    </span>
  );
}
