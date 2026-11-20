import React from 'react';
import { CheckCircle2, PackageCheck, Trash2, X, XCircle } from 'lucide-react';
import { ECONOMY_RULES, formatRupiah } from '../config/gameBalance';
import { t, translateQualityCategory } from '../i18n/translations';
import { useGameStore } from '../store/useGameStore';

export const QualityControlModal: React.FC = () => {
  const language = useGameStore((s) => s.language);
  const productionBatches = useGameStore((s) => s.productionBatches);
  const recipes = useGameStore((s) => s.recipes);
  const acknowledgeQcBatch = useGameStore((s) => s.acknowledgeQcBatch);
  const discardQcBatch = useGameStore((s) => s.discardQcBatch);
  const openStation = useGameStore((s) => s.openStation);
  const closeStation = useGameStore((s) => s.closeStation);

  const reviewable = productionBatches
    .filter((b) => (b.status === 'QC_PASSED' && b.quantity > 0) || b.status === 'QC_FAILED')
    .slice()
    .reverse();

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-[#1C3529]/55">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-[#FAF5EA] border border-[#244D3B]/20 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-4 bg-[#244D3B] text-[#FAF5EA] shrink-0">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold">
              {t(language, 'Steamer & Quality Control Inspection', 'Kukusan & Pemeriksaan Kualitas (QC)')}
            </h2>
            <div className="text-xs text-[#D9E8C8] tabular-nums">
              {t(
                language,
                `Passing QC Threshold: ${ECONOMY_RULES.qcPassThreshold}/100 · Formula: Q = 0.25R + 0.20M + 0.20W + 0.20S + 0.15H`,
                `Ambang Lolos QC: ${ECONOMY_RULES.qcPassThreshold}/100 · Rumus: Q = 0.25R + 0.20M + 0.20W + 0.20S + 0.15H`,
              )}
            </div>
          </div>
          <button
            onClick={closeStation}
            className="p-2 rounded-lg hover:bg-white/10 cursor-pointer"
            aria-label="Close QC"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {reviewable.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <p className="text-sm text-[#587567]">
                {t(
                  language,
                  'No steamed batches awaiting Quality Control. Prepare a batch first!',
                  'Belum ada batch kukusan yang menunggu QC. Masak batch terlebih dahulu!',
                )}
              </p>
              <button
                onClick={() => openStation('prep')}
                className="px-5 py-2.5 rounded-xl bg-[#ED9B53] text-[#1C3529] text-xs font-bold cursor-pointer"
              >
                {t(language, 'Go to Preparation Table', 'Ke Meja Persiapan')}
              </button>
            </div>
          ) : (
            reviewable.map((batch) => {
              const recipe = recipes.find((r) => r.id === batch.recipeId);
              const passed = batch.status === 'QC_PASSED';
              const totalCost =
                batch.ingredientCost + batch.operationalCost + batch.laborCost;

              return (
                <div
                  key={batch.id}
                  className="rounded-xl bg-white border border-[#244D3B]/15 p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {passed ? (
                          <CheckCircle2 className="w-5 h-5 text-[#244D3B]" />
                        ) : (
                          <XCircle className="w-5 h-5 text-[#B91C1C]" />
                        )}
                        <h3 className="font-display text-lg font-bold text-[#244D3B]">
                          {recipe
                            ? language === 'id'
                              ? recipe.nameId
                              : recipe.nameEn
                            : batch.recipeId}
                        </h3>
                      </div>
                      <div className="text-xs text-[#587567] mt-0.5 tabular-nums">
                        {batch.quantity} pcs {t(language, 'unpackaged', 'belum dikemas')} ·{' '}
                        {t(language, 'Batch Cost:', 'Biaya Batch:')} {formatRupiah(totalCost)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`font-mono tabular-nums text-2xl font-bold ${
                          passed ? 'text-[#244D3B]' : 'text-[#B91C1C]'
                        }`}
                      >
                        {batch.qualityScore}/100
                      </div>
                      <div className="text-xs font-semibold text-[#587567]">
                        {translateQualityCategory(language, batch.qualityCategory)} ·{' '}
                        {passed
                          ? t(language, 'QC PASSED', 'LOLOS QC')
                          : t(language, 'QC FAILED', 'GAGAL QC')}
                      </div>
                    </div>
                  </div>

                  {/* 5 Sub-scores */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    {[
                      { label: t(language, 'Recipe (R)', 'Resep (R)'), val: batch.scores.recipeAccuracy },
                      { label: t(language, 'Mixing (M)', 'Campur (M)'), val: batch.scores.mixingQuality },
                      { label: t(language, 'Wrapping (W)', 'Bentuk (W)'), val: batch.scores.wrappingQuality },
                      { label: t(language, 'Steaming (S)', 'Kukus (S)'), val: batch.scores.steamingQuality },
                      { label: t(language, 'Hygiene (H)', 'Higienitas (H)'), val: batch.scores.hygieneCompliance },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="p-2.5 rounded-lg bg-[#F6EBD4]/70 border border-[#244D3B]/10"
                      >
                        <div className="text-[11px] text-[#587567]">{s.label}</div>
                        <div className="font-mono tabular-nums font-bold text-[#244D3B] mt-0.5">
                          {s.val}/100
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2">
                    {passed ? (
                      <button
                        onClick={() => acknowledgeQcBatch(batch.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ED9B53] hover:bg-[#DF883D] text-[#1C3529] text-xs font-bold cursor-pointer"
                      >
                        <PackageCheck className="w-4 h-4" />
                        <span>{t(language, 'Send to Packaging', 'Kirim ke Pengemasan')}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => discardQcBatch(batch.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FEE2E2] text-[#991B1B] text-xs font-bold cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>{t(language, 'Discard Failed Batch', 'Buang Batch Gagal')}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
