import React from 'react';
import { Globe, Home, Music, Play, RotateCcw, Save, Volume2, VolumeX } from 'lucide-react';
import { formatRupiah } from '../config/gameBalance';
import { t } from '../i18n/translations';
import { useGameStore } from '../store/useGameStore';

export const PauseModal: React.FC = () => {
  const language = useGameStore((s) => s.language);
  const muted = useGameStore((s) => s.muted);
  const bgmVolume = useGameStore((s) => s.bgmVolume);
  const sfxVolume = useGameStore((s) => s.sfxVolume);
  const togglePause = useGameStore((s) => s.togglePause);
  const toggleLanguage = useGameStore((s) => s.toggleLanguage);
  const toggleMute = useGameStore((s) => s.toggleMute);
  const setBgmVolume = useGameStore((s) => s.setBgmVolume);
  const setSfxVolume = useGameStore((s) => s.setSfxVolume);
  const persistNow = useGameStore((s) => s.persistNow);
  const pushToast = useGameStore((s) => s.pushToast);
  const returnToMainMenu = useGameStore((s) => s.returnToMainMenu);
  const resetGame = useGameStore((s) => s.resetGame);

  const handleSave = async () => {
    await persistNow();
    pushToast({
      type: 'success',
      textEn: 'Game progress saved locally!',
      textId: 'Progres permainan berhasil disimpan!',
    });
    togglePause();
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-[#1C3529]/60">
      <div className="w-full max-w-sm max-h-[92vh] overflow-y-auto rounded-2xl bg-[#FAF5EA] border border-[#244D3B]/20 shadow-xl p-4 sm:p-6 space-y-2.5 sm:space-y-3">
        <h2 className="font-display text-xl sm:text-2xl font-bold text-[#244D3B] text-center mb-1 sm:mb-3">
          {t(language, 'Game Paused', 'Permainan Dijeda')}
        </h2>

        <button
          onClick={togglePause}
          className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[#ED9B53] hover:bg-[#DF883D] text-[#1C3529] font-bold text-sm cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>{t(language, 'Resume Business', 'Lanjutkan Bermain')}</span>
        </button>

        <button
          onClick={handleSave}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#244D3B] text-white font-semibold text-sm cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{t(language, 'Save Progress Now', 'Simpan Progres')}</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={toggleLanguage}
            className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white border border-[#244D3B]/20 text-xs font-semibold text-[#244D3B] cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'English' : 'Indonesia'}</span>
          </button>
          <button
            onClick={toggleMute}
            className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white border border-[#244D3B]/20 text-xs font-semibold text-[#244D3B] cursor-pointer"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{muted ? t(language, 'Muted', 'Bisu') : t(language, 'Sound On', 'Suara Aktif')}</span>
          </button>
        </div>

        {/* Independent BGM & SFX Volume Sliders */}
        <div className="rounded-xl bg-white border border-[#244D3B]/15 p-3 space-y-2.5">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-[#244D3B] mb-1">
              <span className="inline-flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-[#6E9B72]" />
                <span>{t(language, 'Cozy BGM Volume', 'Musik Latar (BGM)')}</span>
              </span>
              <span className="font-mono tabular-nums text-[11px] text-[#587567]">
                {muted ? '0%' : `${Math.round(bgmVolume * 100)}%`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(bgmVolume * 100)}
              onChange={(e) => setBgmVolume(Number(e.target.value) / 100)}
              aria-label={t(language, 'BGM Volume', 'Volume Musik')}
              className="w-full h-1.5 rounded-lg appearance-none bg-[#E9DEC8] accent-[#244D3B] cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-[#244D3B] mb-1">
              <span className="inline-flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-[#ED9B53]" />
                <span>{t(language, 'Kitchen & Shop SFX', 'Efek Suara (SFX)')}</span>
              </span>
              <span className="font-mono tabular-nums text-[11px] text-[#587567]">
                {muted ? '0%' : `${Math.round(sfxVolume * 100)}%`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(sfxVolume * 100)}
              onChange={(e) => setSfxVolume(Number(e.target.value) / 100)}
              aria-label={t(language, 'SFX Volume', 'Volume Efek')}
              className="w-full h-1.5 rounded-lg appearance-none bg-[#E9DEC8] accent-[#ED9B53] cursor-pointer"
            />
          </div>
        </div>

        <button
          onClick={returnToMainMenu}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#F6EBD4] border border-[#244D3B]/15 text-[#244D3B] font-semibold text-xs cursor-pointer"
        >
          <Home className="w-4 h-4" />
          <span>{t(language, 'Main Menu', 'Menu Utama')}</span>
        </button>

        <button
          onClick={resetGame}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-[#B91C1C] hover:bg-[#FEE2E2] font-semibold text-xs cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{t(language, 'Delete Save & Reset', 'Hapus Simpanan & Reset')}</span>
        </button>
      </div>
    </div>
  );
};

export const GameOverModal: React.FC = () => {
  const language = useGameStore((s) => s.language);
  const currentDay = useGameStore((s) => s.currentDay);
  const cashBalance = useGameStore((s) => s.cashBalance);
  const unpaidDebt = useGameStore((s) => s.unpaidDebt);
  const salesOrders = useGameStore((s) => s.salesOrders);
  const resetGame = useGameStore((s) => s.resetGame);

  const totalRevenue = salesOrders.reduce((s, o) => s + o.totalAmount, 0);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-[#1C3529]/75">
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-[#FAF5EA] border border-[#244D3B]/20 shadow-xl p-5 sm:p-7 text-center space-y-3 sm:space-y-4">
        <div className="text-xs font-bold text-[#B91C1C]">
          {t(language, 'BUSINESS INSOLVENCY', 'KEBANGKRUTAN USAHA')}
        </div>
        <h2 className="font-display text-2xl font-bold text-[#244D3B]">
          {t(language, 'Out of Operating Capital', 'Modal Operasional Habis')}
        </h2>
        <p className="text-xs text-[#587567] leading-relaxed">
          {t(
            language,
            'Your shop ran out of liquid cash, ingredients, and sellable dimsum stock (or accumulated overdue debt). Review your pricing and cost control on your next venture!',
            'Outlet kehabisan kas, bahan baku, dan stok dimsum siap jual (atau menumpuk tunggakan utang). Evaluasi harga jual dan pengendalian biaya di percobaan berikutnya!',
          )}
        </p>

        <div className="grid grid-cols-3 gap-2 text-xs bg-white p-3 rounded-xl border border-[#244D3B]/15">
          <div>
            <div className="text-[#587567]">{t(language, 'Days', 'Hari')}</div>
            <div className="font-mono tabular-nums font-bold text-[#244D3B]">{currentDay}</div>
          </div>
          <div>
            <div className="text-[#587567]">{t(language, 'Revenue', 'Omzet')}</div>
            <div className="font-mono tabular-nums font-bold text-[#244D3B]">
              {formatRupiah(totalRevenue)}
            </div>
          </div>
          <div>
            <div className="text-[#587567]">
              {unpaidDebt > 0 ? t(language, 'Unpaid Debt', 'Tunggakan') : t(language, 'Cash', 'Kas')}
            </div>
            <div className="font-mono tabular-nums font-bold text-[#B91C1C]">
              {formatRupiah(unpaidDebt > 0 ? unpaidDebt : cashBalance)}
            </div>
          </div>
        </div>

        <button
          onClick={resetGame}
          className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[#ED9B53] hover:bg-[#DF883D] text-[#1C3529] font-bold text-sm cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>{t(language, 'Start Fresh Business', 'Mulai Bisnis Baru')}</span>
        </button>
      </div>
    </div>
  );
};
