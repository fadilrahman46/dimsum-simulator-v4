import React, { useEffect, useState } from 'react';
import { Download, Globe, Play, RotateCcw, Share, Volume2, VolumeX } from 'lucide-react';
import { t } from '../i18n/translations';
import { useGameStore } from '../store/useGameStore';
import { usePwaInstall } from '../utils/usePwaInstall';

export const TitleScreen: React.FC = () => {
  const language = useGameStore((s) => s.language);
  const muted = useGameStore((s) => s.muted);
  const hasSavedGame = useGameStore((s) => s.hasSavedGame);
  const goToBusinessSetup = useGameStore((s) => s.goToBusinessSetup);
  const continueSavedGame = useGameStore((s) => s.continueSavedGame);
  const toggleLanguage = useGameStore((s) => s.toggleLanguage);
  const { canInstall, needsManualIosInstall, install } = usePwaInstall();
  const [showIosSteps, setShowIosSteps] = useState(false);
  const toggleMute = useGameStore((s) => s.toggleMute);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        if (hasSavedGame) {
          continueSavedGame();
        } else {
          goToBusinessSetup();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasSavedGame, continueSavedGame, goToBusinessSetup]);

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between gap-3 p-4 sm:p-6 md:p-10 [@media(max-height:520px)]:p-3 overflow-y-auto pointer-events-none">
      {/* Top minimal utility strip */}
      <div className="flex items-center justify-end gap-2 shrink-0 pointer-events-auto">
        <button
          onClick={toggleLanguage}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-lg bg-[#FAF5EA] border border-[#244D3B]/20 text-xs font-semibold text-[#244D3B] hover:bg-[#D9E8C8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          aria-label="Toggle Language"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>{language === 'en' ? 'EN / ID' : 'ID / EN'}</span>
        </button>
        <button
          onClick={toggleMute}
          className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#FAF5EA] border border-[#244D3B]/20 text-[#244D3B] hover:bg-[#D9E8C8] transition-colors cursor-pointer"
          aria-label="Toggle Audio"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Left-aligned Title Lockup leaving right/center 3D diorama visible */}
      <div className="max-w-lg rounded-2xl bg-[#FAF5EA]/95 border border-[#244D3B]/15 p-5 sm:p-7 md:p-9 [@media(max-height:520px)]:p-4 shadow-lg pointer-events-auto">
        {/* Bespoke inline SVG Dimsum Steamer Emblem */}
        <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-5 [@media(max-height:520px)]:mb-2.5">
          <svg
            width="56"
            height="56"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="w-11 h-11 sm:w-14 sm:h-14 [@media(max-height:520px)]:w-10 [@media(max-height:520px)]:h-10 shrink-0"
          >
            <circle cx="32" cy="32" r="30" fill="#D9E8C8" stroke="#244D3B" strokeWidth="2.5" />
            <path
              d="M22 18C22 14 25 13 25 10M32 16C32 12 35 11 35 8M42 18C42 14 45 13 45 10"
              stroke="#6E9B72"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <ellipse cx="32" cy="31" rx="16" ry="7" fill="#FAF5EA" stroke="#244D3B" strokeWidth="2.2" />
            <circle cx="25" cy="29" r="4.5" fill="#F6EBD4" stroke="#244D3B" strokeWidth="1.8" />
            <circle cx="32" cy="27" r="4.8" fill="#ED9B53" stroke="#244D3B" strokeWidth="1.8" />
            <circle cx="39" cy="29" r="4.5" fill="#F6EBD4" stroke="#244D3B" strokeWidth="1.8" />
            <path
              d="M16 32V42C16 46 23.2 49 32 49C40.8 49 48 46 48 42V32"
              fill="#D2A66E"
              stroke="#244D3B"
              strokeWidth="2.2"
            />
            <path d="M16 38C16 41.5 23.2 44 32 44C40.8 44 48 41.5 48 38" stroke="#244D3B" strokeWidth="1.8" />
          </svg>
          <div>
            <div className="text-[11px] sm:text-xs font-semibold text-[#6E9B72] tracking-wide">
              {t(language, 'Healthy Dimsum Business Simulator', 'Simulasi Bisnis Dimsum Sehat')}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl [@media(max-height:520px)]:text-2xl font-bold text-[#244D3B] tracking-tight leading-tight">
              Dimsumpreneur
            </h1>
          </div>
        </div>

        <p className="text-xs sm:text-sm md:text-base [@media(max-height:520px)]:text-xs text-[#355446] leading-relaxed mb-4 sm:mb-6 [@media(max-height:520px)]:mb-3">
          {t(
            language,
            'Source fresh ingredients, master four-stage dimsum crafting, inspect quality, serve neighborhood guests, and grow your culinary ledger from Rp150.000–Rp500.000 starting capital.',
            'Belanja bahan segar, kuasai empat tahap produksi dimsum, jaga kualitas, layani pelanggan, dan kembangkan usahamu mulai modal Rp150.000–Rp500.000.',
          )}
        </p>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {hasSavedGame && (
            <button
              onClick={continueSavedGame}
              className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 [@media(max-height:520px)]:py-2 rounded-xl bg-[#ED9B53] hover:bg-[#DF883D] text-[#1C3529] font-semibold text-xs sm:text-sm shadow-sm transition-transform active:scale-[0.98] whitespace-nowrap cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{t(language, 'Continue Business', 'Lanjutkan Bisnis')}</span>
            </button>
          )}
          <button
            onClick={goToBusinessSetup}
            className={`inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 [@media(max-height:520px)]:py-2 rounded-xl font-semibold text-xs sm:text-sm transition-transform active:scale-[0.98] whitespace-nowrap cursor-pointer ${
              hasSavedGame
                ? 'bg-[#244D3B] hover:bg-[#1B3A2C] text-white'
                : 'bg-[#ED9B53] hover:bg-[#DF883D] text-[#1C3529] shadow-sm'
            }`}
          >
            {hasSavedGame ? <RotateCcw className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{t(language, 'Start New Business', 'Mulai Bisnis Baru')}</span>
          </button>
          {(canInstall || needsManualIosInstall) && (
            <button
              type="button"
              data-testid="install-app-btn"
              onClick={() => (canInstall ? void install() : setShowIosSteps((v) => !v))}
              className="inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 [@media(max-height:520px)]:py-2 rounded-xl bg-white border border-[#244D3B]/25 hover:bg-[#D9E8C8]/60 text-[#244D3B] font-semibold text-xs sm:text-sm transition-transform active:scale-[0.98] whitespace-nowrap cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{t(language, 'Install App', 'Pasang Aplikasi')}</span>
            </button>
          )}
        </div>
        {!canInstall && needsManualIosInstall && showIosSteps && (
          <p
            data-testid="install-ios-steps"
            className="mt-2 max-w-md rounded-xl bg-[#FFF3DC] border border-[#ED9B53]/70 px-3 py-2 text-[11px] sm:text-xs font-medium text-[#92400E] leading-snug"
          >
            <Share className="inline w-3.5 h-3.5 -mt-0.5 mr-1" />
            {t(
              language,
              'On iPhone/iPad: tap Share, then “Add to Home Screen”. The game opens fullscreen from the new icon.',
              'Di iPhone/iPad: ketuk Bagikan, lalu “Tambah ke Layar Utama”. Game terbuka layar penuh dari ikon barunya.',
            )}
          </p>
        )}
      </div>

      {/* Single flat control-hint line */}
      <div className="text-center shrink-0 pointer-events-none">
        <span className="inline-block px-3 py-1 sm:px-4 sm:py-1.5 rounded-lg bg-[#244D3B]/90 text-[#F6EBD4] text-[11px] sm:text-xs font-medium tracking-wide">
          {t(
            language,
            'WASD / Arrows Move · E / Click Interact · Esc Pause · Enter Start',
            'WASD / Panah Gerak · E / Klik Interaksi · Esc Jeda · Enter Mulai',
          )}
        </span>
      </div>
    </div>
  );
};
