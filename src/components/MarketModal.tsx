import React, { useMemo, useState } from 'react';
import {
  Handshake,
  Minus,
  Plus,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  X,
} from 'lucide-react';
import {
  INGREDIENTS,
  PACKAGING_PACK_PURCHASE_QTY,
  PACKAGING_TYPES,
  formatRupiah,
} from '../config/gameBalance';
import {
  getAvailableStockByIngredient,
  getRefrigeratorCapacityGrams,
  getTotalStorageWeightGrams,
} from '../domain/inventoryEngine';
import {
  BULK_NEGOTIATION_MIN_PACKS,
  applySupplierDealToPackPrice,
  getSupplierRelationshipTier,
} from '../domain/negotiationEngine';
import { getAdjustedPackPrice } from '../domain/recipeEngine';
import { t } from '../i18n/translations';
import { useGameStore } from '../store/useGameStore';
import type { IngredientCategory, PackagingTypeId } from '../types/game';
import {
  SupplierNegotiationModal,
  type NegotiableLineItem,
} from './SupplierNegotiationModal';

export const MarketModal: React.FC = () => {
  const language = useGameStore((s) => s.language);
  const cashBalance = useGameStore((s) => s.cashBalance);
  const currentDay = useGameStore((s) => s.currentDay);
  const ingredientLots = useGameStore((s) => s.ingredientLots);
  const packagingStock = useGameStore((s) => s.packagingStock);
  const upgrades = useGameStore((s) => s.upgrades);
  const activeMarketEvent = useGameStore((s) => s.activeMarketEvent);
  const rivalShop = useGameStore((s) => s.rivalShop);
  const supplierRelationships = useGameStore((s) => s.supplierRelationships);
  const activeSupplierDeals = useGameStore((s) => s.activeSupplierDeals);
  const purchaseMarketCart = useGameStore((s) => s.purchaseMarketCart);
  const recordNegotiationOutcome = useGameStore((s) => s.recordNegotiationOutcome);
  const closeStation = useGameStore((s) => s.closeStation);

  const [tab, setTab] = useState<'all' | IngredientCategory | 'packaging'>('all');
  const [ingCart, setIngCart] = useState<Record<string, number>>({});
  const [pkgCart, setPkgCart] = useState<Record<PackagingTypeId, number>>({
    paper_box: 0,
    standard_box: 0,
    family_box: 0,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [negotiatingSupplier, setNegotiatingSupplier] = useState<string | null>(null);

  const stockMap = useMemo(
    () => getAvailableStockByIngredient(ingredientLots, currentDay),
    [ingredientLots, currentDay],
  );
  const usedGrams = useMemo(
    () => getTotalStorageWeightGrams(ingredientLots, currentDay),
    [ingredientLots, currentDay],
  );
  const maxGrams = getRefrigeratorCapacityGrams(upgrades);

  const filteredIngredients = useMemo(() => {
    if (tab === 'packaging') return [];
    if (tab === 'all') return INGREDIENTS;
    return INGREDIENTS.filter((i) => i.category === tab);
  }, [tab]);

  // Group cart items by supplier for bulk negotiation eligibility & live discount calculation
  const supplierCartGroups = useMemo(() => {
    const groups: Record<
      string,
      {
        supplier: string;
        totalPacks: number;
        items: NegotiableLineItem[];
        baseSubtotal: number;
      }
    > = {};

    for (const [id, qty] of Object.entries(ingCart)) {
      if (qty <= 0) continue;
      const def = INGREDIENTS.find((i) => i.id === id);
      if (!def) continue;
      const trust = supplierRelationships[def.supplier]?.trust;
      const unitPackPrice = getAdjustedPackPrice(
        id,
        activeMarketEvent,
        trust,
        rivalShop.focusIngredientIds,
        rivalShop.pricePressureMultiplier,
      );
      if (!groups[def.supplier]) {
        groups[def.supplier] = {
          supplier: def.supplier,
          totalPacks: 0,
          items: [],
          baseSubtotal: 0,
        };
      }
      groups[def.supplier].totalPacks += qty;
      groups[def.supplier].baseSubtotal += qty * unitPackPrice;
      groups[def.supplier].items.push({
        ingredientId: id,
        nameEn: def.nameEn,
        nameId: def.nameId,
        packs: qty,
        unitPackPrice,
      });
    }
    return groups;
  }, [ingCart, activeMarketEvent, supplierRelationships, rivalShop]);

  const cartSummary = useMemo(() => {
    let total = 0;
    let baseIngTotal = 0;
    let savings = 0;
    let count = 0;

    for (const group of Object.values(supplierCartGroups)) {
      const activeDeal = activeSupplierDeals[group.supplier];
      const dealValid =
        activeDeal &&
        activeDeal.day === currentDay &&
        group.totalPacks >= activeDeal.minPacks;

      for (const item of group.items) {
        const lineBase = item.packs * item.unitPackPrice;
        const finalPackPrice = dealValid
          ? applySupplierDealToPackPrice(item.unitPackPrice, activeDeal.discountRate)
          : item.unitPackPrice;
        const lineFinal = item.packs * finalPackPrice;
        baseIngTotal += lineBase;
        total += lineFinal;
        savings += Math.max(0, lineBase - lineFinal);
        count += item.packs;
      }
    }

    for (const pkg of PACKAGING_TYPES) {
      const q = pkgCart[pkg.id] ?? 0;
      if (q > 0) {
        total += q * PACKAGING_PACK_PURCHASE_QTY * pkg.costPerBox;
        count += q;
      }
    }
    return { total, baseIngTotal, savings, count };
  }, [supplierCartGroups, activeSupplierDeals, currentDay, pkgCart]);

  const bulkEligibleGroups = useMemo(
    () =>
      Object.values(supplierCartGroups).filter(
        (g) => g.totalPacks >= BULK_NEGOTIATION_MIN_PACKS,
      ),
    [supplierCartGroups],
  );

  const adjustIng = (id: string, delta: number) => {
    setErrorMsg(null);
    setIngCart((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] ?? 0) + delta),
    }));
  };

  const adjustPkg = (id: PackagingTypeId, delta: number) => {
    setErrorMsg(null);
    setPkgCart((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] ?? 0) + delta),
    }));
  };

  const handleCheckout = () => {
    const res = purchaseMarketCart(ingCart, pkgCart);
    if (!res.ok) {
      setErrorMsg(language === 'id' ? res.errorId ?? null : res.errorEn ?? null);
      return;
    }
    setIngCart({});
    setPkgCart({ paper_box: 0, standard_box: 0, family_box: 0 });
    setErrorMsg(null);
  };

  const activeNegotiationGroup = negotiatingSupplier
    ? supplierCartGroups[negotiatingSupplier]
    : undefined;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-[#1C3529]/55">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#FAF5EA] border border-[#244D3B]/20 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-4 bg-[#244D3B] text-[#FAF5EA] shrink-0">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold">
              {t(language, 'Ingredient & Packaging Market', 'Pasar Bahan Baku & Kemasan')}
            </h2>
            <div className="text-xs text-[#D9E8C8] tabular-nums">
              {t(language, 'Cash:', 'Kas:')} {formatRupiah(cashBalance)} ·{' '}
              {t(language, 'Cold Storage:', 'Kapasitas Kulkas:')}{' '}
              {(usedGrams / 1000).toFixed(1)} / {(maxGrams / 1000).toFixed(0)} kg
            </div>
          </div>
          <button
            onClick={closeStation}
            className="p-2 rounded-lg hover:bg-white/10 cursor-pointer"
            aria-label="Close Market"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Daily Market Event Banner */}
        {activeMarketEvent && (
          <div className="px-6 py-2.5 bg-[#D9E8C8] border-b border-[#244D3B]/10 flex items-center gap-2 text-xs font-semibold text-[#244D3B]">
            <Sparkles className="w-4 h-4 text-[#ED9B53] shrink-0" />
            <span>
              {language === 'id'
                ? `${activeMarketEvent.titleId}: ${activeMarketEvent.descriptionId}`
                : `${activeMarketEvent.titleEn}: ${activeMarketEvent.descriptionEn}`}
            </span>
          </div>
        )}

        {/* Rival Demand Pressure Banner */}
        {rivalShop.focusIngredientIds.length > 0 && (() => {
          const affectedNames = rivalShop.focusIngredientIds
            .map((fid) => {
              const def = INGREDIENTS.find((i) => i.id === fid);
              return def ? (language === 'id' ? def.nameId : def.nameEn) : fid;
            })
            .join(', ');
          const surgePct = Math.round((rivalShop.pricePressureMultiplier - 1) * 100);
          return (
            <div className="px-6 py-2 bg-[#FEF3EC] border-b border-[#DC2626]/15 flex flex-wrap items-center justify-between gap-2 text-xs text-[#991B1B]">
              <span className="font-semibold">
                {t(
                  language,
                  `Rival "${rivalShop.name}" Campaign (${rivalShop.specialtyEn}): +${surgePct}% market demand on ${affectedNames}.`,
                  `Kampanye Rival "${rivalShop.name}" (${rivalShop.specialtyId}): lonjakan harga +${surgePct}% pada ${affectedNames}.`,
                )}
              </span>
              <span className="font-mono tabular-nums font-bold">
                {t(language, `Rival Share ${rivalShop.marketSharePct}%`, `Pangsa Rival ${rivalShop.marketSharePct}%`)}
              </span>
            </div>
          );
        })()}

        {/* Category Filter Tabs */}
        <div className="px-6 pt-3 pb-2 flex flex-wrap gap-1.5 border-b border-[#244D3B]/10 bg-[#F6EBD4]/60">
          {(
            [
              { id: 'all', en: 'All Ingredients', idLabel: 'Semua Bahan' },
              { id: 'protein', en: 'Protein', idLabel: 'Protein' },
              { id: 'vegetable', en: 'Vegetables', idLabel: 'Sayuran' },
              { id: 'seasoning', en: 'Seasoning', idLabel: 'Bumbu' },
              { id: 'wrapper', en: 'Wrappers & Flour', idLabel: 'Kulit & Tepung' },
              { id: 'packaging', en: 'Packaging Boxes', idLabel: 'Kotak Kemasan' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                tab === item.id
                  ? 'bg-[#244D3B] text-white'
                  : 'bg-white text-[#244D3B] hover:bg-[#D9E8C8]/60'
              }`}
            >
              {language === 'id' ? item.idLabel : item.en}
            </button>
          ))}
        </div>

        {/* Catalog List */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredIngredients.map((ing) => {
            const rel = supplierRelationships[ing.supplier];
            const trust = rel?.trust ?? 65;
            const tier = getSupplierRelationshipTier(trust);
            const isRivalFocus = rivalShop.focusIngredientIds.includes(ing.id);
            const adjPrice = getAdjustedPackPrice(
              ing.id,
              activeMarketEvent,
              trust,
              rivalShop.focusIngredientIds,
              rivalShop.pricePressureMultiplier,
            );
            const activeDeal = activeSupplierDeals[ing.supplier];
            const groupPacks = supplierCartGroups[ing.supplier]?.totalPacks ?? 0;
            const dealApplied =
              activeDeal &&
              activeDeal.day === currentDay &&
              groupPacks >= activeDeal.minPacks;
            const displayPrice = dealApplied
              ? applySupplierDealToPackPrice(adjPrice, activeDeal.discountRate)
              : adjPrice;

            const isDiscounted = displayPrice < ing.basePackPrice;
            const isHiked = displayPrice > ing.basePackPrice;
            const qtyInCart = ingCart[ing.id] ?? 0;
            const currentStock = stockMap[ing.id] ?? 0;

            return (
              <div
                key={ing.id}
                className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-white border border-[#244D3B]/12"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-sm shrink-0 border border-black/10"
                      style={{ backgroundColor: ing.colorHex }}
                    />
                    <span className="font-semibold text-sm text-[#244D3B] truncate">
                      {language === 'id' ? ing.nameId : ing.nameEn}
                    </span>
                    {isRivalFocus && (
                      <span className="text-[11px] font-bold text-[#991B1B] shrink-0 tabular-nums">
                        {t(language, 'Rival Surge +15%', 'Lonjakan Rival +15%')}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#587567] mt-0.5 truncate">
                    {language === 'id' ? ing.packLabelId : ing.packLabelEn} ·{' '}
                    {t(language, `Shelf ${ing.shelfLifeDays}d`, `Tahan ${ing.shelfLifeDays}h`)} ·{' '}
                    <span className="tabular-nums">
                      {t(language, `Stock: ${currentStock}${ing.unit}`, `Stok: ${currentStock}${ing.unit}`)}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#587567] mt-0.5 flex items-center gap-1.5 truncate">
                    <span>{ing.supplier}</span>
                    <span aria-hidden="true">·</span>
                    {tier === 'trusted' ? (
                      <span className="text-[#15803D] font-semibold inline-flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        {t(language, 'Trusted (-5%)', 'Mitra (-5%)')}
                      </span>
                    ) : tier === 'strained' ? (
                      <span className="text-[#B91C1C] font-semibold inline-flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" />
                        {t(language, 'Strained (+10%)', 'Tegang (+10%)')}
                      </span>
                    ) : (
                      <span className="font-mono tabular-nums">
                        {t(language, `Trust ${trust}`, `Relasi ${trust}`)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 font-mono tabular-nums text-xs font-bold">
                    <span
                      className={
                        isDiscounted
                          ? 'text-[#15803D]'
                          : isHiked
                            ? 'text-[#B91C1C]'
                            : 'text-[#244D3B]'
                      }
                    >
                      {formatRupiah(displayPrice)}
                    </span>
                    {displayPrice !== ing.basePackPrice && (
                      <span className="line-through text-[#8CA396] font-normal">
                        {formatRupiah(ing.basePackPrice)}
                      </span>
                    )}
                    {dealApplied && (
                      <span className="text-[11px] text-[#15803D]">
                        (-{Math.round(activeDeal.discountRate * 100)}% {t(language, 'Bulk', 'Grosir')})
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => adjustIng(ing.id, -1)}
                    disabled={qtyInCart === 0}
                    className="w-7 h-8 rounded-lg bg-[#F6EBD4] text-[#244D3B] flex items-center justify-center disabled:opacity-40 cursor-pointer"
                    aria-label="Remove 1 pack"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 text-center font-mono tabular-nums text-sm font-bold">
                    {qtyInCart}
                  </span>
                  <button
                    onClick={() => adjustIng(ing.id, 1)}
                    className="w-7 h-8 rounded-lg bg-[#244D3B] text-white flex items-center justify-center cursor-pointer"
                    aria-label="Add 1 pack"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => adjustIng(ing.id, 3)}
                    title={t(language, 'Add 3 packs (bulk eligible)', 'Tambah 3 kemasan (grosir)')}
                    className="px-1.5 h-8 rounded-lg bg-[#F6EBD4] hover:bg-[#D9E8C8] text-[#244D3B] font-mono tabular-nums text-[11px] font-bold cursor-pointer whitespace-nowrap"
                  >
                    +3
                  </button>
                </div>
              </div>
            );
          })}

          {(tab === 'all' || tab === 'packaging') &&
            PACKAGING_TYPES.map((pkg) => {
              const packPrice = PACKAGING_PACK_PURCHASE_QTY * pkg.costPerBox;
              const qtyInCart = pkgCart[pkg.id] ?? 0;
              return (
                <div
                  key={pkg.id}
                  className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#F6EBD4]/60 border border-[#244D3B]/15"
                >
                  <div>
                    <div className="font-semibold text-sm text-[#244D3B]">
                      {language === 'id' ? pkg.nameId : pkg.nameEn}
                    </div>
                    <div className="text-xs text-[#587567] mt-0.5 tabular-nums">
                      {t(language, 'Bundle of 10 boxes', 'Paket isi 10 kotak')} ·{' '}
                      {t(language, `In stock: ${packagingStock[pkg.id] ?? 0}`, `Stok: ${packagingStock[pkg.id] ?? 0}`)}
                    </div>
                    <div className="mt-1 font-mono tabular-nums text-xs font-bold text-[#244D3B]">
                      {formatRupiah(packPrice)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => adjustPkg(pkg.id, -1)}
                      disabled={qtyInCart === 0}
                      className="w-8 h-8 rounded-lg bg-white text-[#244D3B] flex items-center justify-center disabled:opacity-40 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-7 text-center font-mono tabular-nums text-sm font-bold">
                      {qtyInCart}
                    </span>
                    <button
                      onClick={() => adjustPkg(pkg.id, 1)}
                      className="w-8 h-8 rounded-lg bg-[#244D3B] text-white flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Bulk Negotiation Strip */}
        <div className="px-6 py-2.5 bg-[#F6EBD4]/80 border-t border-[#244D3B]/10 flex flex-wrap items-center justify-between gap-2">
          {bulkEligibleGroups.length > 0 ? (
            <>
              <div className="flex items-center gap-2 text-xs text-[#244D3B]">
                <Handshake className="w-4 h-4 text-[#ED9B53] shrink-0" />
                <span className="font-semibold">
                  {t(
                    language,
                    'Bulk Wholesale Eligible (3+ packs):',
                    'Memenuhi Syarat Nego Grosir (3+ kemasan):',
                  )}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {bulkEligibleGroups.map((grp) => {
                  const rel = supplierRelationships[grp.supplier];
                  const trust = rel?.trust ?? 65;
                  const strained = getSupplierRelationshipTier(trust) === 'strained';
                  const activeDeal = activeSupplierDeals[grp.supplier];
                  const hasDealToday =
                    activeDeal &&
                    activeDeal.day === currentDay &&
                    grp.totalPacks >= activeDeal.minPacks;

                  if (hasDealToday) {
                    return (
                      <span
                        key={grp.supplier}
                        className="text-xs font-semibold text-[#15803D] font-mono tabular-nums"
                      >
                        {grp.supplier}: -{Math.round(activeDeal.discountRate * 100)}% {t(language, 'Active', 'Aktif')}
                      </span>
                    );
                  }

                  return (
                    <button
                      key={grp.supplier}
                      type="button"
                      onClick={() => setNegotiatingSupplier(grp.supplier)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap transition-colors ${
                        strained
                          ? 'bg-[#FEE2E2] text-[#991B1B] border border-[#B91C1C]/20'
                          : 'bg-[#244D3B] hover:bg-[#1C3529] text-white'
                      }`}
                    >
                      <Handshake className="w-3.5 h-3.5" />
                      <span>
                        {strained
                          ? `${grp.supplier} (${t(language, 'Strained', 'Tegang')})`
                          : t(
                              language,
                              `Negotiate ${grp.supplier} (${grp.totalPacks}p)`,
                              `Nego ${grp.supplier} (${grp.totalPacks}p)`,
                            )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-xs text-[#587567] flex items-center gap-2">
              <Handshake className="w-3.5 h-3.5 text-[#587567] shrink-0" />
              <span>
                {t(
                  language,
                  'Tip: Add 3+ packs from the same supplier to unlock wholesale price negotiation.',
                  'Tips: Pesan 3+ kemasan dari pemasok yang sama untuk membuka negosiasi harga grosir.',
                )}
              </span>
            </div>
          )}
        </div>

        {/* Footer Cart Checkout */}
        <div className="px-4 py-2.5 sm:px-6 sm:py-4 bg-white border-t border-[#244D3B]/15 flex flex-wrap items-center justify-between gap-2 sm:gap-3 shrink-0">
          <div>
            {errorMsg ? (
              <div className="text-xs font-semibold text-[#B91C1C]">{errorMsg}</div>
            ) : (
              <div className="text-xs text-[#587567]">
                {t(
                  language,
                  'Ingredients are consumed by FEFO (earliest expiry first).',
                  'Bahan dikonsumsi dengan urutan FEFO (kedaluwarsa terdekat lebih dulu).',
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[11px] text-[#587567]">
                {t(language, 'Order Total', 'Total Belanja')}
                {cartSummary.savings > 0 && (
                  <span className="ml-1.5 text-[#15803D] font-mono tabular-nums font-semibold">
                    (-{formatRupiah(cartSummary.savings)})
                  </span>
                )}
              </div>
              <div className="font-mono tabular-nums text-base font-bold text-[#244D3B]">
                {formatRupiah(cartSummary.total)}
              </div>
            </div>
            <button
              onClick={handleCheckout}
              disabled={cartSummary.count === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#ED9B53] hover:bg-[#DF883D] disabled:opacity-45 text-[#1C3529] font-bold text-sm cursor-pointer whitespace-nowrap"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>{t(language, 'Confirm Purchase', 'Bayar & Simpan')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Supplier Negotiation Minigame Overlay */}
      {activeNegotiationGroup && (
        <SupplierNegotiationModal
          language={language}
          supplier={activeNegotiationGroup.supplier}
          relationship={
            supplierRelationships[activeNegotiationGroup.supplier] ?? {
              supplier: activeNegotiationGroup.supplier,
              trust: 65,
              negotiatedCount: 0,
              walkoutCount: 0,
            }
          }
          items={activeNegotiationGroup.items}
          onComplete={recordNegotiationOutcome}
          onClose={() => setNegotiatingSupplier(null)}
        />
      )}
    </div>
  );
};

