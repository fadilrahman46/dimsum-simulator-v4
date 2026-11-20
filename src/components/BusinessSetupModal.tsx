import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react';
import {
  CAPITAL_DIFFICULTIES,
  formatRupiah,
  getCapitalDifficultyConfig,
} from '../config/gameBalance';
import { t } from '../i18n/translations';
import { useGameStore } from '../store/useGameStore';
import type { BusinessProfile, CapitalDifficulty } from '../types/game';

export const BusinessSetupModal: React.FC = () => {
  const language = useGameStore((s) => s.language);
  const startNewGame = useGameStore((s) => s.startNewGame);
  const returnToMainMenu = useGameStore((s) => s.returnToMainMenu);

  const [name, setName] = useState('Kukus Sehat Kitchen');
  const [concept, setConcept] = useState<BusinessProfile['concept']>('balanced');
  const [targetMarket, setTargetMarket] = useState<BusinessProfile['targetMarket']>('general');
  const [difficulty, setDifficulty] = useState<CapitalDifficulty>('easy');
  const [enableTutorial, setEnableTutorial] = useState(true);

  const selectedCapital = getCapitalDifficultyConfig(difficulty);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startNewGame({ name, concept, targetMarket, difficulty, enableTutorial });
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-2.5 sm:p-4 bg-[#1C3529]/55">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[#FAF5EA] border border-[#244D3B]/20 shadow-xl p-4 sm:p-6 md:p-8">
        <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
          <div>
            <div className="text-xs font-semibold text-[#6E9B72]">
              {t(language, 'Business Registration', 'Registrasi Usaha Baru')}
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#244D3B]">
              {t(language, 'Establish Your Dimsum Outlet', 'Dirikan Outlet Dimsum Kamu')}
            </h2>
          </div>
          <button
            type="button"
            onClick={returnToMainMenu}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#244D3B]/20 text-xs font-semibold text-[#244D3B] hover:bg-[#D9E8C8] cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t(language, 'Back', 'Kembali')}</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-[#244D3B] mb-1.5">
              {t(language, 'Shop Name', 'Nama Usaha')}
            </label>
            <input
              type="text"
              maxLength={40}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#244D3B]/25 text-sm font-medium text-[#1C3529] focus:outline-none focus:border-[#ED9B53]"
              placeholder={t(language, 'e.g. Kukus Sehat Kitchen', 'cth. Dapur Dimsum Sehat')}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#244D3B] mb-1.5">
                {t(language, 'Culinary Concept', 'Konsep Menu')}
              </label>
              <div className="space-y-2">
                {(
                  [
                    {
                      id: 'balanced',
                      en: 'Balanced Protein & Veggies',
                      idLabel: 'Seimbang Protein & Sayur',
                    },
                    {
                      id: 'vegetarian',
                      en: 'Plant-Forward (Unlocks Rainbow Veggie)',
                      idLabel: 'Nabati Sehat (Buka Sayur Pelangi)',
                    },
                    {
                      id: 'premium',
                      en: 'Artisan Healthy Gourmet',
                      idLabel: 'Gourmet Sehat Artisan',
                    },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setConcept(item.id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                      concept === item.id
                        ? 'bg-[#244D3B] text-white border-[#244D3B]'
                        : 'bg-white text-[#244D3B] border-[#244D3B]/20 hover:bg-[#D9E8C8]/50'
                    }`}
                  >
                    {language === 'id' ? item.idLabel : item.en}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#244D3B] mb-1.5">
                {t(language, 'Primary Target Market', 'Target Pasar Utama')}
              </label>
              <div className="space-y-2">
                {(
                  [
                    { id: 'general', en: 'Neighborhood Mix', idLabel: 'Campuran Sekitar Outlet' },
                    { id: 'students', en: 'Campus & Students', idLabel: 'Pelajar & Mahasiswa' },
                    { id: 'families', en: 'Families & Health Buffs', idLabel: 'Keluarga & Pecinta Sehat' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTargetMarket(item.id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                      targetMarket === item.id
                        ? 'bg-[#6E9B72] text-white border-[#6E9B72]'
                        : 'bg-white text-[#244D3B] border-[#244D3B]/20 hover:bg-[#D9E8C8]/50'
                    }`}
                  >
                    {language === 'id' ? item.idLabel : item.en}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Starting Capital Difficulty Selection */}
          <div>
            <label className="block text-sm font-semibold text-[#244D3B] mb-1.5">
              {t(language, 'Difficulty & Starting Capital (Modal)', 'Tingkat Kesulitan & Modal Awal')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(['easy', 'medium', 'hard'] as const).map((tier) => {
                const cfg = CAPITAL_DIFFICULTIES[tier];
                const isSelected = difficulty === tier;
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setDifficulty(tier)}
                    className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#244D3B] text-white border-[#244D3B]'
                        : 'bg-white text-[#244D3B] border-[#244D3B]/20 hover:bg-[#D9E8C8]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wide">
                        {language === 'id' ? cfg.labelId : cfg.labelEn}
                      </span>
                      <span
                        className={`font-mono tabular-nums text-xs font-bold ${
                          isSelected ? 'text-[#ED9B53]' : 'text-[#244D3B]'
                        }`}
                      >
                        {formatRupiah(cfg.total)}
                      </span>
                    </div>
                    <div
                      className={`text-[11px] mt-1 leading-snug ${
                        isSelected ? 'text-[#D9E8C8]' : 'text-[#587567]'
                      }`}
                    >
                      {language === 'id' ? cfg.subtitleId : cfg.subtitleEn}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Starting Capital Breakdown */}
          <div className="rounded-xl bg-[#F6EBD4] border border-[#244D3B]/15 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#244D3B]">
                {t(
                  language,
                  `Starting Capital Allocation (${selectedCapital.labelEn})`,
                  `Alokasi Modal Awal (${selectedCapital.labelId})`,
                )}
              </span>
              <span className="font-mono tabular-nums text-sm font-bold text-[#244D3B]">
                {formatRupiah(selectedCapital.total)}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-white/80 rounded-lg p-2">
                <div className="text-[#587567]">{t(language, 'Ingredients', 'Bahan Awal')}</div>
                <div className="font-mono tabular-nums font-bold text-[#244D3B]">
                  {formatRupiah(selectedCapital.starterIngredientsValue)}
                </div>
              </div>
              <div className="bg-white/80 rounded-lg p-2">
                <div className="text-[#587567]">{t(language, 'Equipment', 'Peralatan')}</div>
                <div className="font-mono tabular-nums font-bold text-[#244D3B]">
                  {formatRupiah(selectedCapital.starterEquipmentValue)}
                </div>
              </div>
              <div className="bg-white/80 rounded-lg p-2">
                <div className="text-[#587567]">{t(language, 'Packaging', 'Kemasan')}</div>
                <div className="font-mono tabular-nums font-bold text-[#244D3B]">
                  {formatRupiah(selectedCapital.starterPackagingValue)}
                </div>
              </div>
              <div className="bg-white/80 rounded-lg p-2">
                <div className="text-[#587567]">{t(language, 'Liquid Cash', 'Cadangan Kas')}</div>
                <div className="font-mono tabular-nums font-bold text-[#244D3B]">
                  {formatRupiah(selectedCapital.cashReserve)}
                </div>
              </div>
            </div>
          </div>

          {/* Optional Day 1 Tutorial Toggle */}
          <label className="flex items-center justify-between gap-3 rounded-xl bg-white border border-[#244D3B]/15 px-4 py-3 cursor-pointer">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-[#ED9B53] shrink-0" />
              <div>
                <div className="text-sm font-semibold text-[#244D3B]">
                  {t(language, 'Enable Day 1 Guided Tutorial', 'Aktifkan Panduan Terbimbing Hari 1')}
                </div>
                <div className="text-xs text-[#587567]">
                  {t(
                    language,
                    'Shows step-by-step hints from market shopping to your first financial report.',
                    'Menampilkan panduan langkah demi langkah hingga laporan keuangan pertama.',
                  )}
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={enableTutorial}
              onChange={(e) => setEnableTutorial(e.target.checked)}
              className="w-5 h-5 accent-[#244D3B] cursor-pointer"
            />
          </label>

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#ED9B53] hover:bg-[#DF883D] text-[#1C3529] font-bold text-sm shadow-sm transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{t(language, 'Open Kitchen & Begin Day 1', 'Buka Dapur & Mulai Hari 1')}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
