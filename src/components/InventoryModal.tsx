import React, { useState } from 'react';
import { AlertTriangle, Tag, X } from 'lucide-react';
import {
  PACKAGING_TYPES,
  formatRupiah,
  getIngredientDef,
  getPackagingDef,
} from '../config/gameBalance';
import {
  getIngredientInventoryValuation,
  getProductInventoryValuation,
  getRefrigeratorCapacityGrams,
  getTotalStorageWeightGrams,
} from '../domain/inventoryEngine';
import { t } from '../i18n/translations';
import { useGameStore } from '../store/useGameStore';

export const InventoryModal: React.FC = () => {
  const language = useGameStore((s) => s.language);
  const currentDay = useGameStore((s) => s.currentDay);
  const ingredientLots = useGameStore((s) => s.ingredientLots);
  const packagingStock = useGameStore((s) => s.packagingStock);
  const productBatches = useGameStore((s) => s.productBatches);
  const recipes = useGameStore((s) => s.recipes);
  const upgrades = useGameStore((s) => s.upgrades);
  const applyClearanceSale = useGameStore((s) => s.applyClearanceSale);
  const closeStation = useGameStore((s) => s.closeStation);
  const openStation = useGameStore((s) => s.openStation);

  const [tab, setTab] = useState<'ingredients' | 'products' | 'packaging'>('ingredients');

  const sortedLots = [...ingredientLots]
    .filter((l) => l.quantityRemaining > 0 && l.expiryDay >= currentDay)
    .sort((a, b) => a.expiryDay - b.expiryDay);

  const usedGrams = getTotalStorageWeightGrams(ingredientLots, currentDay);
  const maxGrams = getRefrigeratorCapacityGrams(upgrades);
  const ingVal = getIngredientInventoryValuation(ingredientLots, currentDay);
  const prodVal = getProductInventoryValuation(productBatches, currentDay);

  const activeProducts = productBatches.filter(
    (b) => b.status === 'PACKAGED' && b.boxesAvailable > 0 && b.expiryDay >= currentDay,
  );

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-[#1C3529]/55">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#FAF5EA] border border-[#244D3B]/20 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-4 bg-[#244D3B] text-[#FAF5EA] shrink-0">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold">
              {t(language, 'Cold Storage & Inventory', 'Kulkas & Persediaan')}
            </h2>
            <div className="text-xs text-[#D9E8C8] tabular-nums">
              {t(language, 'Storage:', 'Kapasitas:')} {(usedGrams / 1000).toFixed(1)} /{' '}
              {(maxGrams / 1000).toFixed(0)} kg · {t(language, 'Asset Value:', 'Nilai Aset:')}{' '}
              {formatRupiah(ingVal + prodVal)}
            </div>
          </div>
          <button
            onClick={closeStation}
            className="p-2 rounded-lg hover:bg-white/10 cursor-pointer"
            aria-label="Close Storage"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 sm:px-6 pt-2.5 pb-2 flex flex-wrap gap-1.5 border-b border-[#244D3B]/10 bg-[#F6EBD4]/60 shrink-0">
          {(
            [
              { id: 'ingredients', en: 'Ingredient Lots (FEFO)', idLabel: 'Bahan Baku (FEFO)' },
              { id: 'products', en: 'Packaged Dimsum', idLabel: 'Dimsum Siap Jual' },
              { id: 'packaging', en: 'Packaging Boxes', idLabel: 'Stok Kemasan' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                tab === item.id
                  ? 'bg-[#244D3B] text-white'
                  : 'bg-white text-[#244D3B] hover:bg-[#D9E8C8]/60'
              }`}
            >
              {language === 'id' ? item.idLabel : item.en}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'ingredients' && (
            <div className="space-y-2.5">
              {sortedLots.length === 0 ? (
                <div className="text-center py-10 text-sm text-[#587567]">
                  {t(
                    language,
                    'Cold storage is empty. Visit the Market Terminal to restock.',
                    'Kulkas kosong. Kunjungi Terminal Pasar untuk belanja.',
                  )}
                </div>
              ) : (
                sortedLots.map((lot) => {
                  const def = getIngredientDef(lot.ingredientId);
                  if (!def) return null;
                  const daysLeft = lot.expiryDay - currentDay;
                  const lotValue =
                    lot.initialQuantity > 0
                      ? Math.round((lot.quantityRemaining / lot.initialQuantity) * lot.totalLotCost)
                      : 0;
                  return (
                    <div
                      key={lot.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-white border border-[#244D3B]/12"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-sm border border-black/10"
                            style={{ backgroundColor: def.colorHex }}
                          />
                          <span className="font-semibold text-sm text-[#244D3B]">
                            {language === 'id' ? def.nameId : def.nameEn}
                          </span>
                          {daysLeft <= 1 && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B45309]">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {daysLeft === 0
                                ? t(language, 'Expires tonight', 'Kedaluwarsa malam ini')
                                : t(language, '1 day left', 'Sisa 1 hari')}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#587567] mt-0.5 tabular-nums">
                          {t(language, `Bought Day ${lot.purchasedDay}`, `Dibeli Hari ${lot.purchasedDay}`)} ·{' '}
                          {t(language, `Expires Day ${lot.expiryDay}`, `Exp Hari ${lot.expiryDay}`)} ·{' '}
                          {t(language, `Quality ${lot.quality}`, `Kualitas ${lot.quality}`)}
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <div className="text-sm font-bold text-[#244D3B]">
                          {lot.quantityRemaining} {def.unit}
                        </div>
                        <div className="text-xs text-[#587567]">
                          {t(language, 'FIFO Value:', 'Nilai FIFO:')} {formatRupiah(lotValue)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === 'products' && (
            <div className="space-y-2.5">
              {activeProducts.length === 0 ? (
                <div className="text-center py-10 text-sm text-[#587567]">
                  {t(
                    language,
                    'No packaged dimsum yet. Cook a batch and pack it first!',
                    'Belum ada dimsum terkemas. Masak dan kemas batch terlebih dahulu!',
                  )}
                </div>
              ) : (
                activeProducts.map((pb) => {
                  const rec = recipes.find((r) => r.id === pb.recipeId);
                  const pkg = getPackagingDef(pb.packagingTypeId);
                  const expiresTonight = pb.expiryDay === currentDay;
                  const activePct = pb.clearanceDiscountPct ?? 0;
                  return (
                    <div
                      key={pb.id}
                      className={`flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border ${
                        expiresTonight
                          ? 'bg-[#FEF3EC] border-[#D97706]/30'
                          : 'bg-white border-[#244D3B]/12'
                      }`}
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2 font-semibold text-sm text-[#244D3B]">
                          <span>
                            {rec ? (language === 'id' ? rec.nameId : rec.nameEn) : pb.recipeId} ·{' '}
                            {language === 'id' ? pkg.nameId : pkg.nameEn}
                          </span>
                          {expiresTonight && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#B45309]">
                              <Tag className="w-3 h-3" />
                              {t(language, 'Expires tonight', 'Kedaluwarsa malam ini')}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#587567] mt-0.5 tabular-nums">
                          QC {pb.qualityScore}/100 · {t(language, 'COGS', 'HPP')}{' '}
                          {formatRupiah(pb.unitCostPerBox)}/{t(language, 'box', 'kotak')} ·{' '}
                          {t(language, `Expires Day ${pb.expiryDay}`, `Exp Hari ${pb.expiryDay}`)}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {expiresTonight && (
                          <div className="flex items-center gap-1">
                            {([25, 40, 0] as const).map((pct) => {
                              const isSelected = activePct === pct;
                              return (
                                <button
                                  key={pct}
                                  type="button"
                                  onClick={() => applyClearanceSale(pb.id, pct)}
                                  className={`px-2 py-1 rounded-lg font-mono text-[11px] font-bold cursor-pointer transition-colors ${
                                    isSelected
                                      ? pct === 0
                                        ? 'bg-[#244D3B] text-white'
                                        : 'bg-[#D97706] text-white'
                                      : 'bg-white text-[#244D3B] border border-[#244D3B]/15 hover:bg-[#F6EBD4]'
                                  }`}
                                >
                                  {pct === 0 ? t(language, 'Normal', 'Normal') : `-${pct}%`}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <div className="text-right font-mono tabular-nums">
                          <div className="text-sm font-bold text-[#244D3B]">
                            {pb.boxesAvailable} / {pb.boxesProduced}{' '}
                            {t(language, 'boxes', 'kotak')}
                          </div>
                          <div className="text-xs text-[#6E9B72] font-semibold">
                            {t(language, 'Price:', 'Harga:')}{' '}
                            {activePct > 0 && pb.originalSellingPricePerBox ? (
                              <>
                                <span className="line-through text-[#587567] mr-1">
                                  {formatRupiah(pb.originalSellingPricePerBox)}
                                </span>
                                <span className="text-[#B45309] font-bold">
                                  {formatRupiah(pb.sellingPricePerBox)} (-{activePct}%)
                                </span>
                              </>
                            ) : (
                              formatRupiah(pb.sellingPricePerBox)
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === 'packaging' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PACKAGING_TYPES.map((pkg) => (
                <div
                  key={pkg.id}
                  className="p-4 rounded-xl bg-white border border-[#244D3B]/15"
                >
                  <div className="font-semibold text-sm text-[#244D3B]">
                    {language === 'id' ? pkg.nameId : pkg.nameEn}
                  </div>
                  <div className="text-xs text-[#587567] mt-1 tabular-nums">
                    {t(language, `Unit Cost: ${formatRupiah(pkg.costPerBox)}`, `Biaya: ${formatRupiah(pkg.costPerBox)}`)}
                  </div>
                  <div className="mt-3 font-mono tabular-nums text-2xl font-bold text-[#244D3B]">
                    {packagingStock[pkg.id] ?? 0}{' '}
                    <span className="text-xs font-sans font-normal text-[#587567]">
                      {t(language, 'boxes', 'kotak')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 bg-white border-t border-[#244D3B]/15 flex justify-end gap-2">
          <button
            onClick={() => openStation('market')}
            className="px-4 py-2 rounded-xl bg-[#ED9B53] hover:bg-[#DF883D] text-[#1C3529] text-xs font-bold cursor-pointer"
          >
            {t(language, 'Go to Market', 'Belanja di Pasar')}
          </button>
          <button
            onClick={closeStation}
            className="px-4 py-2 rounded-xl bg-[#244D3B] text-white text-xs font-semibold cursor-pointer"
          >
            {t(language, 'Close', 'Tutup')}
          </button>
        </div>
      </div>
    </div>
  );
};
