import React, { useMemo, useState } from 'react';
import { Layers, Package, X } from 'lucide-react';
import {
  ECONOMY_RULES,
  PACKAGING_TYPES,
  formatRupiah,
  getPackagingDef,
} from '../config/gameBalance';
import { calculateHPP, calculateRecommendedSellingPrice } from '../domain/financeEngine';
import { t } from '../i18n/translations';
import { useGameStore } from '../store/useGameStore';
import type { PackagingTypeId, ProductionBatch } from '../types/game';

interface RecipeFreshPool {
  recipeId: string;
  batches: ProductionBatch[];
  totalQuantity: number;
  weightedQuality: number;
  totalIngredientCost: number;
  totalOperationalCost: number;
  totalLaborCost: number;
}

export const PackagingModal: React.FC = () => {
  const language = useGameStore((s) => s.language);
  const currentDay = useGameStore((s) => s.currentDay);
  const productionBatches = useGameStore((s) => s.productionBatches);
  const packagingStock = useGameStore((s) => s.packagingStock);
  const recipes = useGameStore((s) => s.recipes);
  const packageRecipePool = useGameStore((s) => s.packageRecipePool);
  const openStation = useGameStore((s) => s.openStation);
  const closeStation = useGameStore((s) => s.closeStation);

  const recipePools = useMemo<RecipeFreshPool[]>(() => {
    const fresh = productionBatches.filter(
      (b) => b.status === 'QC_PASSED' && b.quantity > 0 && b.expiryDay >= currentDay,
    );
    const byRecipe = new Map<string, ProductionBatch[]>();
    for (const batch of fresh) {
      const list = byRecipe.get(batch.recipeId) ?? [];
      list.push(batch);
      byRecipe.set(batch.recipeId, list);
    }

    const pools: RecipeFreshPool[] = [];
    for (const [recipeId, batches] of byRecipe.entries()) {
      const totalQuantity = batches.reduce((s, b) => s + b.quantity, 0);
      if (totalQuantity < 4) continue;
      const weightedQuality = Math.round(
        batches.reduce((s, b) => s + b.qualityScore * b.quantity, 0) /
          Math.max(1, totalQuantity),
      );
      pools.push({
        recipeId,
        batches,
        totalQuantity,
        weightedQuality,
        totalIngredientCost: batches.reduce((s, b) => s + b.ingredientCost, 0),
        totalOperationalCost: batches.reduce((s, b) => s + b.operationalCost, 0),
        totalLaborCost: batches.reduce((s, b) => s + b.laborCost, 0),
      });
    }
    return pools;
  }, [productionBatches, currentDay]);

  const unpooledLeftovers = useMemo(() => {
    const fresh = productionBatches.filter(
      (b) => b.status === 'QC_PASSED' && b.quantity > 0 && b.expiryDay >= currentDay,
    );
    const totals = new Map<string, number>();
    for (const b of fresh) {
      totals.set(b.recipeId, (totals.get(b.recipeId) ?? 0) + b.quantity);
    }
    return Array.from(totals.entries()).filter(([, qty]) => qty > 0 && qty < 4);
  }, [productionBatches, currentDay]);

  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(
    recipePools[0]?.recipeId ?? '',
  );
  const [pkgType, setPkgType] = useState<PackagingTypeId>('paper_box');
  const [boxCount, setBoxCount] = useState<number>(2);
  const [markupPct, setMarkupPct] = useState<number>(
    Math.round(ECONOMY_RULES.defaultMarkup * 100),
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activePool =
    recipePools.find((p) => p.recipeId === selectedRecipeId) ?? recipePools[0];

  const pkgDef = getPackagingDef(pkgType);
  const maxByPieces = activePool
    ? Math.floor(activePool.totalQuantity / pkgDef.capacity)
    : 0;
  const maxByBoxes = packagingStock[pkgType] ?? 0;
  const maxAllowedBoxes = Math.min(maxByPieces, maxByBoxes);
  const effectiveBoxes = Math.min(Math.max(1, boxCount), Math.max(1, maxAllowedBoxes));

  const previewFinance = useMemo(() => {
    if (!activePool || effectiveBoxes <= 0) return null;
    const pcsUsed = Math.min(activePool.totalQuantity, effectiveBoxes * pkgDef.capacity);
    const ratio = pcsUsed / Math.max(1, activePool.totalQuantity);
    const hpp = calculateHPP(
      {
        ingredientCost: Math.round(activePool.totalIngredientCost * ratio),
        packagingCost: effectiveBoxes * pkgDef.costPerBox,
        operationalCost: Math.round(activePool.totalOperationalCost * ratio),
        laborCost: Math.round(activePool.totalLaborCost * ratio),
      },
      effectiveBoxes,
    );
    const sp = calculateRecommendedSellingPrice(hpp.unitCost, markupPct / 100);
    return {
      hppPerBox: hpp.unitCost,
      sellingPrice: sp,
      marginPerBox: sp - hpp.unitCost,
      leftoverAfterPack: activePool.totalQuantity - pcsUsed,
    };
  }, [activePool, effectiveBoxes, pkgDef, markupPct]);

  const handlePack = () => {
    if (!activePool) return;
    const res = packageRecipePool(
      activePool.recipeId,
      pkgType,
      effectiveBoxes,
      markupPct / 100,
    );
    if (!res.ok) {
      setErrorMsg(language === 'id' ? res.errorId ?? null : res.errorEn ?? null);
      return;
    }
    setErrorMsg(null);
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-[#1C3529]/55">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-[#FAF5EA] border border-[#244D3B]/20 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-4 bg-[#244D3B] text-[#FAF5EA] shrink-0">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold">
              {t(language, 'Packaging & Pricing Bench', 'Meja Pengemasan & Penentuan Harga')}
            </h2>
            <div className="text-xs text-[#D9E8C8]">
              {t(
                language,
                'Fresh QC-passed batches of the same recipe automatically pool together (FEFO) with zero stranded leftovers.',
                'Batch lolos QC dari resep yang sama digabung otomatis (FEFO) agar sisa dimsum tetap bisa dikemas.',
              )}
            </div>
          </div>
          <button
            onClick={closeStation}
            className="p-2 rounded-lg hover:bg-white/10 cursor-pointer"
            aria-label="Close Packaging"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          {unpooledLeftovers.length > 0 && (
            <div className="p-3 rounded-xl bg-[#FFFBF2] border border-[#ED9B53]/60 text-xs text-[#92400E] flex items-center gap-2">
              <Layers className="w-4 h-4 shrink-0 text-[#D97706]" />
              <span>
                {t(
                  language,
                  `Held leftovers (<4 pcs): ${unpooledLeftovers
                    .map(([rid, qty]) => {
                      const rec = recipes.find((r) => r.id === rid);
                      return `${rec ? rec.nameEn : rid} (${qty} pcs)`;
                    })
                    .join(', ')}. Cook another batch of the same recipe to pool and pack them!`,
                  `Sisa menunggu (<4 pcs): ${unpooledLeftovers
                    .map(([rid, qty]) => {
                      const rec = recipes.find((r) => r.id === rid);
                      return `${rec ? rec.nameId : rid} (${qty} pcs)`;
                    })
                    .join(', ')}. Masak 1 batch resep sama untuk menggabungkan & mengemasnya!`,
                )}
              </span>
            </div>
          )}

          {!activePool ? (
            <div className="text-center py-10 space-y-3">
              <p className="text-sm text-[#587567]">
                {t(
                  language,
                  'No QC-passed dimsum ready for packaging (need at least 4 pcs of a recipe). Cook a batch or open the store if boxes are already packed.',
                  'Belum ada dimsum lolos QC siap kemas (minimal 4 pcs per resep). Masak batch baru atau buka toko jika kotak sudah siap.',
                )}
              </p>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => openStation('prep')}
                  className="px-4 py-2 rounded-xl bg-[#244D3B] text-white text-xs font-bold cursor-pointer"
                >
                  {t(language, 'Cook New Batch', 'Masak Batch Baru')}
                </button>
                <button
                  onClick={() => openStation('cashier')}
                  className="px-4 py-2 rounded-xl bg-[#ED9B53] text-[#1C3529] text-xs font-bold cursor-pointer"
                >
                  {t(language, 'Go to Cashier', 'Ke Meja Kasir')}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Select Recipe Pool */}
              <div>
                <label className="block text-xs font-semibold text-[#244D3B] mb-1.5">
                  {t(language, 'Select QC-Passed Recipe Pool', 'Pilih Stok Resep Lolos QC')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {recipePools.map((pool) => {
                    const rec = recipes.find((r) => r.id === pool.recipeId);
                    return (
                      <button
                        key={pool.recipeId}
                        type="button"
                        onClick={() => setSelectedRecipeId(pool.recipeId)}
                        className={`text-left p-3 rounded-xl border text-xs cursor-pointer ${
                          activePool.recipeId === pool.recipeId
                            ? 'bg-[#244D3B] text-white border-[#244D3B]'
                            : 'bg-white text-[#244D3B] border-[#244D3B]/15'
                        }`}
                      >
                        <div className="font-bold">
                          {rec
                            ? language === 'id'
                              ? rec.nameId
                              : rec.nameEn
                            : pool.recipeId}
                        </div>
                        <div className="mt-0.5 tabular-nums opacity-85">
                          {pool.totalQuantity} pcs ·{' '}
                          {pool.batches.length > 1
                            ? t(
                                language,
                                `${pool.batches.length} batches pooled`,
                                `${pool.batches.length} batch digabung`,
                              )
                            : t(language, '1 batch', '1 batch')}{' '}
                          · QC {pool.weightedQuality}/100
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Select Packaging Box */}
              <div>
                <label className="block text-xs font-semibold text-[#244D3B] mb-1.5">
                  {t(language, 'Choose Packaging Type', 'Pilih Jenis Kemasan')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {PACKAGING_TYPES.map((pkg) => {
                    const stock = packagingStock[pkg.id] ?? 0;
                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => {
                          setPkgType(pkg.id);
                          const nextMax = Math.min(
                            Math.floor(activePool.totalQuantity / pkg.capacity),
                            stock,
                          );
                          setBoxCount(Math.max(1, Math.min(boxCount, nextMax || 1)));
                        }}
                        className={`p-3.5 rounded-xl border text-left cursor-pointer ${
                          pkgType === pkg.id
                            ? 'bg-[#6E9B72] text-white border-[#6E9B72]'
                            : 'bg-white text-[#244D3B] border-[#244D3B]/15'
                        }`}
                      >
                        <div className="font-bold text-xs">
                          {language === 'id' ? pkg.nameId : pkg.nameEn}
                        </div>
                        <div className="text-[11px] mt-1 font-mono tabular-nums opacity-90">
                          {formatRupiah(pkg.costPerBox)}/{t(language, 'box', 'kotak')} ·{' '}
                          {t(language, `Stock: ${stock}`, `Stok: ${stock}`)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quantity & Markup */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-[#244D3B]/15">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-[#244D3B] mb-1 tabular-nums">
                    <span>{t(language, 'Boxes to Pack', 'Jumlah Kotak')}</span>
                    <span>
                      {effectiveBoxes} ({effectiveBoxes * pkgDef.capacity} pcs ·{' '}
                      {t(language, 'max', 'maks')} {maxAllowedBoxes})
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={Math.max(1, maxAllowedBoxes)}
                    value={effectiveBoxes}
                    onChange={(e) => setBoxCount(Number(e.target.value))}
                    className="w-full accent-[#244D3B]"
                  />
                  {previewFinance && (
                    <div className="text-[11px] text-[#587567] mt-1 tabular-nums">
                      {previewFinance.leftoverAfterPack === 0
                        ? t(
                            language,
                            'Clean pack: 0 pcs leftover!',
                            'Kemas bersih: 0 pcs sisa!',
                          )
                        : t(
                            language,
                            `${previewFinance.leftoverAfterPack} pcs remaining after pack (poolable with next batch)`,
                            `Sisa ${previewFinance.leftoverAfterPack} pcs (dapat digabung dengan batch berikutnya)`,
                          )}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-[#244D3B] mb-1 tabular-nums">
                    <span>{t(language, 'Target Markup (M)', 'Target Markup (M)')}</span>
                    <span>+{markupPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={15}
                    max={120}
                    step={5}
                    value={markupPct}
                    onChange={(e) => setMarkupPct(Number(e.target.value))}
                    className="w-full accent-[#ED9B53]"
                  />
                </div>
              </div>

              {/* Live HPP & Selling Price Preview */}
              {previewFinance && (
                <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-[#F6EBD4] border border-[#244D3B]/15 text-xs">
                  <div>
                    <div className="text-[#587567]">{t(language, 'Actual COGS / Box', 'HPP Aktual / Kotak')}</div>
                    <div className="font-mono tabular-nums text-base font-bold text-[#244D3B] mt-0.5">
                      {formatRupiah(previewFinance.hppPerBox)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#587567]">{t(language, 'Selling Price', 'Harga Jual')}</div>
                    <div className="font-mono tabular-nums text-base font-bold text-[#244D3B] mt-0.5">
                      {formatRupiah(previewFinance.sellingPrice)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#587567]">{t(language, 'Gross Margin / Box', 'Margin Kotor / Kotak')}</div>
                    <div className="font-mono tabular-nums text-base font-bold text-[#6E9B72] mt-0.5">
                      +{formatRupiah(previewFinance.marginPerBox)}
                    </div>
                  </div>
                </div>
              )}

              {errorMsg && <div className="text-xs font-semibold text-[#B91C1C]">{errorMsg}</div>}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={maxAllowedBoxes < 1}
                  onClick={handlePack}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[#ED9B53] hover:bg-[#DF883D] disabled:opacity-45 text-[#1C3529] font-bold text-sm cursor-pointer"
                >
                  <Package className="w-4 h-4" />
                  <span>{t(language, 'Pack Boxes', 'Kemas Produk')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openStation('cashier')}
                  className="px-5 py-3 rounded-xl bg-[#244D3B] text-white font-bold text-sm cursor-pointer"
                >
                  {t(language, 'Go to Cashier', 'Ke Meja Kasir')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
