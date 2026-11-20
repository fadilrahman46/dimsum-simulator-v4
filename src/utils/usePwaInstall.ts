import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Chrome/Edge/Android fire `beforeinstallprompt` once, often before React mounts, so it is captured at import time.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const subscribers = new Set<() => void>();
const notify = () => subscribers.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // keep the event so the in-game button can show the native dialog
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

/** True when launched from the home screen / app window instead of a browser tab. */
export function isRunningAsInstalledApp(): boolean {
  if (typeof window === 'undefined') return false;
  const standaloneIos = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return (
    standaloneIos ||
    ['standalone', 'fullscreen', 'minimal-ui'].some((mode) => window.matchMedia(`(display-mode: ${mode})`).matches)
  );
}

/** iPhone/iPad Safari never fires beforeinstallprompt: installation is manual via Share > Add to Home Screen. */
function isIosBrowser(): boolean {
  const ua = navigator.userAgent;
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(ua) || iPadOs;
}

export interface PwaInstallState {
  /** Native install dialog is available (Chromium browsers). */
  canInstall: boolean;
  /** iOS Safari: show the manual "Add to Home Screen" instructions instead. */
  needsManualIosInstall: boolean;
  installed: boolean;
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export function usePwaInstall(): PwaInstallState {
  const [, force] = useState(0);
  const [installed, setInstalled] = useState(isRunningAsInstalledApp);

  useEffect(() => {
    const rerender = () => force((n) => n + 1);
    subscribers.add(rerender);
    const onInstalled = () => setInstalled(true);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      subscribers.delete(rerender);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    const promptEvent = deferredPrompt;
    if (!promptEvent) return 'unavailable' as const;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    deferredPrompt = null; // a prompt event can be used once
    notify();
    return outcome;
  }, []);

  return {
    canInstall: !installed && deferredPrompt !== null,
    needsManualIosInstall: !installed && isIosBrowser(),
    installed,
    install,
  };
}
