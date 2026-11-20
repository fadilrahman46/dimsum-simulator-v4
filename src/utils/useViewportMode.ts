import { useEffect, useState } from 'react';

export interface ViewportMode {
  width: number;
  height: number;
  isTouchDevice: boolean;
  isMobilePortrait: boolean;
  isShortLandscape: boolean;
  isCompactViewport: boolean;
  /** Touch device whose physical screen short side is below 600 CSS px (phones; excludes tablets & desktops). */
  isSmartphone: boolean;
  /** Smartphone currently held upright: the trigger for the rotate-to-landscape flow. */
  isSmartphonePortrait: boolean;
}

/** Short side of a phone screen in CSS px stays below this; tablets (iPad mini = 744) and laptops exceed it. */
export const SMARTPHONE_MAX_SHORT_SIDE = 600;

function readViewportMode(): ViewportMode {
  if (typeof window === 'undefined') {
    return {
      width: 1280,
      height: 720,
      isTouchDevice: false,
      isMobilePortrait: false,
      isShortLandscape: false,
      isCompactViewport: false,
      isSmartphone: false,
      isSmartphonePortrait: false,
    };
  }

  const width = window.innerWidth || 1280;
  const height = window.innerHeight || 720;
  const isTouchDevice =
    'ontouchstart' in window ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
    Boolean(window.matchMedia?.('(pointer: coarse)')?.matches);

  const isMobilePortrait = width < 640 && height > width;
  const isShortLandscape = width >= 560 && width > height && height <= 520;
  const isCompactViewport = isMobilePortrait || isShortLandscape || width < 640;

  // Device class is judged from the physical screen, not the window, so a narrowed desktop window is never a phone
  const screenW = window.screen?.width || width;
  const screenH = window.screen?.height || height;
  const isSmartphone = isTouchDevice && Math.min(screenW, screenH) < SMARTPHONE_MAX_SHORT_SIDE;
  const orientationType = window.screen?.orientation?.type;
  const isPortrait = orientationType ? orientationType.startsWith('portrait') : height > width;
  const isSmartphonePortrait = isSmartphone && isPortrait && height > width;

  return {
    width,
    height,
    isTouchDevice,
    isMobilePortrait,
    isShortLandscape,
    isCompactViewport,
    isSmartphone,
    isSmartphonePortrait,
  };
}

let keepPortrait = false;
/** The player chose "Continue in Portrait": stop forcing fullscreen/landscape for this session. */
export function setKeepPortrait(value: boolean): void {
  keepPortrait = value;
}

/**
 * Smartphone immersive mode: the first tap anywhere asks for fullscreen and locks landscape, so the phone
 * switches to the landscape fullscreen view immediately. Browsers only allow both from a user gesture, which
 * is why this listens for the first touch instead of running on load. Elements marked `data-keep-portrait`
 * (the "Continue in Portrait" button) opt out. Gives up after 3 refused attempts (e.g. iOS Safari).
 */
export function useSmartphoneImmersive(): void {
  const { isSmartphone } = useViewportMode();
  useEffect(() => {
    if (!isSmartphone) return;
    let attempts = 0;
    const onGesture = (event: Event) => {
      if (keepPortrait || attempts >= 3) return;
      const target = event.target as Element | null;
      if (target?.closest?.('[data-keep-portrait], [data-immersive-control]')) return;
      const landscape = window.screen?.orientation?.type?.startsWith('landscape') ?? window.innerWidth > window.innerHeight;
      if (document.fullscreenElement && landscape) return;
      attempts += 1;
      void enableRotateScreen(true);
    };
    // pointerup is an activation-triggering event for touch, so requestFullscreen is allowed inside it
    window.addEventListener('pointerup', onGesture, true);
    return () => window.removeEventListener('pointerup', onGesture, true);
  }, [isSmartphone]);
}

type LockableOrientation = ScreenOrientation & { lock?: (mode: 'landscape') => Promise<void> };

/**
 * Tries to switch the screen to landscape. Browsers only allow `screen.orientation.lock` in fullscreen
 * or an installed PWA, so fullscreen is requested first when `allowFullscreen` is true (needs a user gesture).
 * Resolves true when the lock succeeded; false means the player must rotate the phone by hand.
 */
export async function enableRotateScreen(allowFullscreen: boolean): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    if (
      allowFullscreen &&
      !document.fullscreenElement &&
      typeof document.documentElement.requestFullscreen === 'function'
    ) {
      await document.documentElement.requestFullscreen().catch(() => undefined);
    }
    const orientation = window.screen?.orientation as LockableOrientation | undefined;
    if (orientation && typeof orientation.lock === 'function') {
      await orientation.lock('landscape');
      return true;
    }
  } catch {
    // Not allowed outside fullscreen/PWA (or unsupported, e.g. iOS Safari)
  }
  return false;
}

/** The browser exposes at least one way to go landscape (fullscreen or orientation lock). False on iPhone Safari. */
export function canTryLandscapeLock(): boolean {
  if (typeof document === 'undefined') return false;
  const orientation = window.screen?.orientation as LockableOrientation | undefined;
  return typeof document.documentElement.requestFullscreen === 'function' || typeof orientation?.lock === 'function';
}

/** True while the screen is already landscape and fullscreen (the state the lock produces). */
export function isLandscapeFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const type = window.screen?.orientation?.type;
  const landscape = type ? type.startsWith('landscape') : window.innerWidth > window.innerHeight;
  return Boolean(document.fullscreenElement) && landscape;
}

/** Re-renders when fullscreen or orientation changes, so UI can follow the landscape lock state. */
export function useLandscapeFullscreen(): boolean {
  const [state, setState] = useState(isLandscapeFullscreen);
  useEffect(() => {
    const update = () => setState(isLandscapeFullscreen());
    document.addEventListener('fullscreenchange', update);
    window.addEventListener('resize', update);
    window.screen?.orientation?.addEventListener?.('change', update);
    update();
    return () => {
      document.removeEventListener('fullscreenchange', update);
      window.removeEventListener('resize', update);
      window.screen?.orientation?.removeEventListener?.('change', update);
    };
  }, []);
  return state;
}

export function useViewportMode(): ViewportMode {
  const [mode, setMode] = useState<ViewportMode>(readViewportMode);

  useEffect(() => {
    const update = () => {
      setMode(readViewportMode());
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.screen?.orientation?.addEventListener?.('change', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.screen?.orientation?.removeEventListener?.('change', update);
    };
  }, []);

  return mode;
}
