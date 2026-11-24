'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Thin top progress bar: starts on an internal link click or a form
 * submit, ends when the path changes. Gives every slow
 * navigation an immediate response.
 */
export function NavProgress() {
  const pathname = usePathname();
  // The route the navigation started from; the bar shows while we are still on it.
  const routeKey = pathname;
  const [startedOn, setStartedOn] = useState<string | null>(null);
  const active = startedOn === routeKey;
  const setActive = (value: boolean) => setStartedOn(value ? window.location.pathname : null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href') ?? '';
      if (!href.startsWith('/') || anchor.getAttribute('target') === '_blank' || anchor.hasAttribute('download')) return;
      const url = new URL(href, window.location.href);
      if (url.pathname === window.location.pathname) return;
      setActive(true);
    };
    const onSubmit = () => setActive(true);
    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('submit', onSubmit);
    };
  }, []);

  // Safety net: never leave the bar running forever (e.g. a validation error re-render).
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setActive(false), 12000);
    return () => window.clearTimeout(timer);
  }, [active]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden">
      {active ? <div className="nav-progress-bar h-full w-full bg-[image:var(--gradient-brand)]" /> : null}
    </div>
  );
}
