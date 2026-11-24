import { useSyncExternalStore } from 'react';

// A display preference only (sidebar open or collapsed). It carries no
// identity, tenant or permission, and nothing reads it on the server.

const KEY = 'mitiga.sidebar.collapsed';
const EVENT = 'mitiga:sidebar';

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function useSidebarCollapsed(): [boolean, () => void] {
  const collapsed = useSyncExternalStore(subscribe, read, () => false);
  const toggle = () => {
    try {
      window.localStorage.setItem(KEY, collapsed ? '0' : '1');
      window.dispatchEvent(new Event(EVENT));
    } catch {
      /* storage unavailable: the sidebar stays expanded */
    }
  };
  return [collapsed, toggle];
}
