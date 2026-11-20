import React, { useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { t } from '../i18n/translations';
import { useGameStore } from '../store/useGameStore';
import { isRunningAsInstalledApp } from '../utils/usePwaInstall';
import {
  canTryLandscapeLock,
  enableRotateScreen,
  setKeepPortrait,
  useLandscapeFullscreen,
  useViewportMode,
} from '../utils/useViewportMode';

/**
 * Small always-available button for smartphones in a browser tab: one tap switches to fullscreen and locks
 * the screen to landscape. It disappears once the lock is active, inside an installed app (the manifest
 * already forces landscape there) and on browsers that cannot lock at all (iPhone Safari).
 */
export const LandscapeLockButton: React.FC = () => {
  const language = useGameStore((s) => s.language);
  // Full-screen modals put their Close button in the same top-right corner as this floating button
  const overlayOpen = useGameStore(
    (s) =>
      !!s.activeStation ||
      !!s.activeCooking ||
      s.gameState === 'GAME_PAUSED' ||
      s.gameState === 'GAME_OVER' ||
      s.gameState === 'FINANCIAL_REPORT',
  );
  const { isSmartphone } = useViewportMode();
  const locked = useLandscapeFullscreen();
  const [failed, setFailed] = useState(false);

  // After a refused lock, show the reason briefly, then stop offering a button that cannot work here
  useEffect(() => {
    if (!failed) return;
    const id = window.setTimeout(() => setFailed(false), 6000);
    return () => window.clearTimeout(id);
  }, [failed]);

  if (overlayOpen || !isSmartphone || locked || isRunningAsInstalledApp() || !canTryLandscapeLock()) return null;

  const handleClick = async () => {
    setKeepPortrait(false); // an earlier "Continue in Portrait" no longer applies
    const ok = await enableRotateScreen(true);
    if (!ok) setFailed(true);
  };

  return (
    <div className="fixed z-40 top-14 right-2 flex flex-col items-end gap-1.5 pointer-events-none [padding-top:env(safe-area-inset-top)] [padding-right:env(safe-area-inset-right)]">
      <button
        type="button"
        data-testid="landscape-lock-btn"
        data-immersive-control
        aria-label={t(language, 'Switch to landscape', 'Ubah ke layar horizontal')}
        onClick={handleClick}
        className="pointer-events-auto inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-[#ED9B53] hover:bg-[#DF883D] active:scale-95 text-[#1C3529] text-xs font-bold shadow-md border border-[#244D3B]/25 cursor-pointer transition-transform"
      >
        <RotateCw className="w-4 h-4" />
        <span>{t(language, 'Landscape', 'Horizontal')}</span>
      </button>
      {failed && (
        <p
          data-testid="landscape-lock-hint"
          className="pointer-events-auto max-w-[15rem] rounded-xl bg-[#FFF3DC] border border-[#ED9B53]/70 px-3 py-2 text-[11px] font-medium text-[#92400E] leading-snug shadow-md"
        >
          {t(
            language,
            'This browser refused the lock. Turn off rotation lock and tilt the phone sideways.',
            'Browser menolak kunci layar. Matikan kunci rotasi lalu miringkan ponsel ke samping.',
          )}
        </p>
      )}
    </div>
  );
};
