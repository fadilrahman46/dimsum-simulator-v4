import React, { useMemo, useState } from 'react';
import {
  Bike,
  Briefcase,
  Check,
  Clock,
  DoorClosed,
  DoorOpen,
  Flame,
  Lock,
  Receipt,
  Sparkles,
  Star,
  Tag,
  Utensils,
  X,
} from 'lucide-react';
import {
  CUSTOMER_ARCHETYPES,
  DINE_IN_REVENUE_MULTIPLIER,
  ONLINE_DELIVERY_PLATFORMS,
  applyDailyEventRevenue,
  doesRecipeMatchFestival,
  formatRupiah,
  getDineInCapacity,
  getPackagingDef,
  getRushHourPhase,
} from '../config/gameBalance';
import { getReputationTrafficBonusPct } from '../domain/customerEngine';
import { t } from '../i18n/translations';
import { useGameStore } from '../store/useGameStore';
import type { B2BContractTier } from '../types/game';

const TIER_LABELS: Record<B2BContractTier, { en: string; id: string; cls: string }> = {
  community: { en: 'Community', id: 'Komunitas', cls: 'bg-[#EEF5E6] text-[#244D3B]' },
  campus: { en: 'Campus Event', id: 'Acara Kampus', cls: 'bg-[#E0F2FE] text-[#075985]' },
  corporate: { en: 'Corporate', id: 'Korporasi', cls: 'bg-[#FEF3C7] text-[#92400E]' },
  partner_cafe: { en: 'Partner Cafe', id: 'Kafe Mitra', cls: 'bg-[#FCE7F3] text-[#9D174D]' },
};

export const CashierModal: React.FC = () => {
  const language = useGameStore((s) => s.language);
  const gameState = useGameStore((s) => s.gameState);
  const business = useGameStore((s) => s.business);
  const activeDailyEvent = useGameStore((s) => s.activeDailyEvent);
  const activeFestival = useGameStore((s) => s.activeFestival);
  const currentDay = useGameStore((s) => s.currentDay);
  const productBatches = useGameStore((s) => s.productBatches);
  const recipes = useGameStore((s) => s.recipes);
  const customers = useGameStore((s) => s.customers);
  const onlineOrders = useGameStore((s) => s.onlineOrders);
  const onlineDeliveryEnabled = useGameStore((s) => s.onlineDeliveryEnabled);
  const upgrades = useGameStore((s) => s.upgrades);
  const rushHourActive = useGameStore((s) => s.rushHourActive);
  const preOrders = useGameStore((s) => s.preOrders);
  const salesOrders = useGameStore((s) => s.salesOrders);
  const storeTimeRemainingSec = useGameStore((s) => s.storeTimeRemainingSec);

  const openStore = useGameStore((s) => s.openStore);
  const serveCustomer = useGameStore((s) => s.serveCustomer);
  const fulfillPreOrder = useGameStore((s) => s.fulfillPreOrder);
  const acceptB2BContract = useGameStore((s) => s.acceptB2BContract);
  const toggleOnlineDelivery = useGameStore((s) => s.toggleOnlineDelivery);
  const fulfillOnlineOrder = useGameStore((s) => s.fulfillOnlineOrder);
  const applyClearanceSale = useGameStore((s) => s.applyClearanceSale);
  const closeStoreAndGenerateReport = useGameStore(
    (s) => s.closeStoreAndGenerateReport,
  );
  const closeStation = useGameStore((s) => s.closeStation);

  const [tab, setTab] = useState<'direct' | 'online' | 'preorder' | 'receipts'>('direct');
  const [selectedBatchMap, setSelectedBatchMap] = useState<Record<string, string>>({});
  const [selectedOnlineBatchMap, setSelectedOnlineBatchMap] = useState<Record<string, string>>({});
  const [discountMap, setDiscountMap] = useState<Record<string, number>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isStoreOpen = gameState === 'STORE_OPEN' || gameState === 'CUSTOMER_SERVICE';
  const waitingCustomers = useMemo(
    () => customers.filter((c) => c.lifecycle !== 'EATING' && c.lifecycle !== 'EXITING'),
    [customers],
  );
  const eatingCustomers = useMemo(
    () => customers.filter((c) => c.lifecycle === 'EATING'),
    [customers],
  );
  const tableCapacity = getDineInCapacity(upgrades);
  const rushPhase = getRushHourPhase(storeTimeRemainingSec);
  const isRushActive = isStoreOpen && (rushHourActive || rushPhase.active);

  const sellableBatches = useMemo(
    () =>
      productBatches.filter(
        (b) =>
          b.status === 'PACKAGED' &&
          b.boxesAvailable > 0 &&
          b.expiryDay >= currentDay,
      ),
    [productBatches, currentDay],
  );

  const expiringTodayBatches = useMemo(
    () => sellableBatches.filter((b) => b.expiryDay === currentDay),
    [sellableBatches, currentDay],
  );

  const todayReceipts = useMemo(
    () => salesOrders.filter((o) => o.day === currentDay).slice().reverse(),
    [salesOrders, currentDay],
  );

  const handleOpenStore = () => {
    const res = openStore();
    if (!res.ok) {
      setErrorMsg(language === 'id' ? res.errorId ?? null : res.errorEn ?? null);
    } else {
      setErrorMsg(null);
    }
  };

  const handleServe = (custId: string, defaultBatchId: string) => {
    const batchId = selectedBatchMap[custId] || defaultBatchId;
    const discount = discountMap[custId] ?? 0;
    const res = serveCustomer(custId, batchId, discount);
    if (!res.ok) {
      setErrorMsg(language === 'id' ? res.errorId ?? null : res.errorEn ?? null);
    } else {
      setErrorMsg(null);
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-[#1C3529]/55">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#FAF5EA] border border-[#244D3B]/20 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 px-4 py-2.5 sm:px-6 sm:py-4 bg-[#244D3B] text-[#FAF5EA] shrink-0">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold">
              {t(language, 'Cashier & Customer Service', 'Kasir & Pelayanan Pelanggan')}
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#D9E8C8] tabular-nums mt-0.5">
              <span>
                {isStoreOpen
                  ? t(
                      language,
                      `Outlet OPEN · ${Math.ceil(storeTimeRemainingSec)}s left · ${sellableBatches.reduce((s, b) => s + b.boxesAvailable, 0)} boxes in showcase`,
                      `Outlet BUKA · sisa ${Math.ceil(storeTimeRemainingSec)}d · ${sellableBatches.reduce((s, b) => s + b.boxesAvailable, 0)} kotak di etalase`,
                    )
                  : t(
                      language,
                      `Outlet CLOSED · ${sellableBatches.reduce((s, b) => s + b.boxesAvailable, 0)} boxes ready to sell`,
                      `Outlet TUTUP · ${sellableBatches.reduce((s, b) => s + b.boxesAvailable, 0)} kotak siap dijual`,
                    )}
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-[#FAF5EA]">
                <Star className="w-3.5 h-3.5 fill-[#ED9B53] text-[#ED9B53]" />
                <span>
                  {t(
                    language,
                    `Shop Reputation ${business.reputation}/100 (${getReputationTrafficBonusPct(business.reputation) >= 0 ? '+' : ''}${getReputationTrafficBonusPct(business.reputation)}% customers)`,
                    `Reputasi Toko ${business.reputation}/100 (${getReputationTrafficBonusPct(business.reputation) >= 0 ? '+' : ''}${getReputationTrafficBonusPct(business.reputation)}% tamu)`,
                  )}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-[#D9E8C8]">
                <Utensils className="w-3.5 h-3.5 text-[#ED9B53]" />
                <span>
                  Dine-In {eatingCustomers.length}/{tableCapacity}
                </span>
              </span>
              {isRushActive && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#ED9B53] text-[#1C3529] text-[11px] font-bold">
                  <Flame className="w-3 h-3" />
                  <span>
                    {rushPhase.active
                      ? language === 'id'
                        ? rushPhase.labelId
                        : rushPhase.labelEn
                      : t(language, 'Rush Hour', 'Jam Sibuk')}
                  </span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isStoreOpen ? (
              <button
                onClick={handleOpenStore}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ED9B53] hover:bg-[#DF883D] text-[#1C3529] text-xs font-bold cursor-pointer"
              >
                <DoorOpen className="w-4 h-4" />
                <span>{t(language, 'Open Store Now', 'Buka Toko Sekarang')}</span>
              </button>
            ) : (
              <button
                onClick={closeStoreAndGenerateReport}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FAF5EA] text-[#244D3B] text-xs font-bold hover:bg-[#D9E8C8] cursor-pointer"
              >
                <DoorClosed className="w-4 h-4" />
                <span>{t(language, 'Close Store & Report', 'Tutup Toko & Laporan')}</span>
              </button>
            )}
            <button
              onClick={closeStation}
              className="p-2 rounded-lg hover:bg-white/10 cursor-pointer"
              aria-label="Close Cashier"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-3 pb-2 flex flex-wrap gap-1.5 border-b border-[#244D3B]/10 bg-[#F6EBD4]/60">
          <button
            onClick={() => setTab('direct')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer tabular-nums ${
              tab === 'direct' ? 'bg-[#244D3B] text-white' : 'bg-white text-[#244D3B]'
            }`}
          >
            {t(language, `Direct Queue (${waitingCustomers.length})`, `Antrean Langsung (${waitingCustomers.length})`)}
          </button>
          <button
            onClick={() => setTab('online')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer tabular-nums ${
              tab === 'online' ? 'bg-[#244D3B] text-white' : 'bg-white text-[#244D3B]'
            }`}
          >
            <Bike className="w-3.5 h-3.5" />
            <span>
              {t(language, `Online Delivery (${onlineOrders.length})`, `Pesan-Antar Online (${onlineOrders.length})`)}
            </span>
          </button>
          <button
            onClick={() => setTab('preorder')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer tabular-nums ${
              tab === 'preorder' ? 'bg-[#244D3B] text-white' : 'bg-white text-[#244D3B]'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>
              {t(
                language,
                `B2B Contracts (${preOrders.filter((p) => !p.fulfilled).length})`,
                `Kontrak B2B (${preOrders.filter((p) => !p.fulfilled).length})`,
              )}
            </span>
          </button>
          <button
            onClick={() => setTab('receipts')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer tabular-nums ${
              tab === 'receipts' ? 'bg-[#244D3B] text-white' : 'bg-white text-[#244D3B]'
            }`}
          >
            {t(language, `Today's Receipts (${todayReceipts.length})`, `Struk Hari Ini (${todayReceipts.length})`)}
          </button>
        </div>

        {errorMsg && (
          <div className="px-6 py-2 bg-[#FEE2E2] text-[#991B1B] text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {activeDailyEvent && (
          <div
            className={`px-6 py-2 text-xs font-semibold flex flex-wrap items-center justify-between gap-2 border-b ${
              activeDailyEvent.kind === 'positive'
                ? 'bg-[#EEF5E6] text-[#244D3B] border-[#6E9B72]/35'
                : 'bg-[#FEF3EC] text-[#991B1B] border-[#DC2626]/20'
            }`}
          >
            <span>
              {language === 'id' ? activeDailyEvent.titleId : activeDailyEvent.titleEn}
            </span>
            <span className="font-mono tabular-nums">
              {language === 'id'
                ? activeDailyEvent.impactTagId
                : activeDailyEvent.impactTagEn}
            </span>
          </div>
        )}

        {activeFestival && (
          <div className="px-6 py-2 bg-[#FFF3DC] text-[#1C3529] border-b border-[#ED9B53]/40 text-xs font-semibold flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
              <span>
                {language === 'id' ? activeFestival.titleId : activeFestival.titleEn}
              </span>
            </span>
            <span className="font-mono tabular-nums font-bold text-[#92400E]">
              {t(
                language,
                `2x Traffic · +15% Featured (${activeFestival.themeHintEn})`,
                `2x Tamu · +15% Menu Unggulan (${activeFestival.themeHintId})`,
              )}
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {tab === 'direct' && (
            <>
              {expiringTodayBatches.length > 0 && (
                <div className="p-4 rounded-xl bg-[#FEF3EC] border border-[#D97706]/30 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#9A3412]">
                      <Tag className="w-4 h-4 shrink-0" />
                      <span>
                        {t(
                          language,
                          'Expiring Tonight — Clearance Sale',
                          'Stok Kedaluwarsa Malam Ini — Diskon Penghabisan',
                        )}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#9A3412]/80">
                      {t(
                        language,
                        'Markdown expiring boxes to attract bargain hunters & prevent waste',
                        'Turunkan harga stok hari terakhir untuk tarik pembeli hemat & cegah limbah',
                      )}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {expiringTodayBatches.map((b) => {
                      const rec = recipes.find((r) => r.id === b.recipeId);
                      const pkg = getPackagingDef(b.packagingTypeId);
                      const activePct = b.clearanceDiscountPct ?? 0;
                      return (
                        <div
                          key={b.id}
                          className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-white border border-[#D97706]/20 text-xs"
                        >
                          <div>
                            <div className="font-semibold text-[#244D3B]">
                              {rec ? (language === 'id' ? rec.nameId : rec.nameEn) : b.recipeId} ·{' '}
                              {language === 'id' ? pkg.nameId : pkg.nameEn}
                            </div>
                            <div className="text-[11px] text-[#587567] tabular-nums">
                              {b.boxesAvailable} {t(language, 'boxes left', 'kotak tersisa')} ·{' '}
                              {activePct > 0 && b.originalSellingPricePerBox ? (
                                <>
                                  <span className="line-through text-[#587567]/70 mr-1">
                                    {formatRupiah(b.originalSellingPricePerBox)}
                                  </span>
                                  <span className="font-bold text-[#B45309]">
                                    {formatRupiah(b.sellingPricePerBox)} (-{activePct}%)
                                  </span>
                                </>
                              ) : (
                                <span className="font-bold text-[#244D3B]">
                                  {formatRupiah(b.sellingPricePerBox)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {([25, 40, 0] as const).map((pct) => {
                              const isSelected = activePct === pct;
                              return (
                                <button
                                  key={pct}
                                  type="button"
                                  onClick={() => {
                                    const res = applyClearanceSale(b.id, pct);
                                    if (!res.ok) {
                                      setErrorMsg(
                                        language === 'id' ? res.errorId ?? null : res.errorEn ?? null,
                                      );
                                    } else {
                                      setErrorMsg(null);
                                    }
                                  }}
                                  className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold cursor-pointer transition-colors ${
                                    isSelected
                                      ? pct === 0
                                        ? 'bg-[#244D3B] text-white'
                                        : 'bg-[#D97706] text-white'
                                      : 'bg-[#F6EBD4] text-[#244D3B] hover:bg-[#ED9B53]/35'
                                  }`}
                                >
                                  {pct === 0 ? t(language, 'Normal', 'Normal') : `-${pct}%`}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {eatingCustomers.length > 0 && (
                <div className="p-3.5 rounded-xl bg-[#EEF5E6] border border-[#6E9B72]/40 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-[#244D3B]">
                    <span className="inline-flex items-center gap-1.5">
                      <Utensils className="w-3.5 h-3.5" />
                      <span>
                        {t(
                          language,
                          `Seated Dine-In Tables (${eatingCustomers.length}/${tableCapacity})`,
                          `Meja Dine-In Terisi (${eatingCustomers.length}/${tableCapacity})`,
                        )}
                      </span>
                    </span>
                    <span className="text-[11px] font-medium text-[#355446]">
                      {t(language, '+18% Dine-In premium active', 'Tarif Dine-In +18% aktif')}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {eatingCustomers.map((guest) => {
                      const rec = recipes.find((r) => r.id === guest.requestedRecipeId);
                      return (
                        <div
                          key={guest.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white border border-[#6E9B72]/30 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-[#244D3B] truncate">
                              {t(language, `Table #${(guest.tableSlot ?? 0) + 1}`, `Meja #${(guest.tableSlot ?? 0) + 1}`)} · {guest.name}
                            </div>
                            <div className="text-[11px] text-[#587567] truncate">
                              {rec ? (language === 'id' ? rec.nameId : rec.nameEn) : guest.requestedRecipeId}
                            </div>
                          </div>
                          <span className="font-mono tabular-nums text-[11px] font-bold text-[#244D3B] shrink-0">
                            {Math.max(1, Math.ceil(guest.eatingRemainingSec ?? 0))}s
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!isStoreOpen ? (
                <div className="text-center py-10 text-sm text-[#587567]">
                  {t(
                    language,
                    'Open the store once you have packaged boxes to welcome neighborhood customers.',
                    'Buka toko setelah produk dikemas untuk mulai melayani pelanggan.',
                  )}
                </div>
              ) : waitingCustomers.length === 0 ? (
                <div className="text-center py-10 text-sm text-[#587567]">
                  {t(
                    language,
                    'Waiting for the next customer to walk into the shop...',
                    'Menunggu pelanggan berikutnya masuk ke outlet...',
                  )}
                </div>
              ) : (
                waitingCustomers.map((cust) => {
                  const arch = CUSTOMER_ARCHETYPES.find((a) => a.id === cust.archetypeId);
                  const bestMatch =
                    sellableBatches.find(
                      (b) =>
                        b.recipeId === cust.requestedRecipeId &&
                        b.packagingTypeId === cust.requestedBoxType,
                    ) ??
                    sellableBatches.find((b) => b.recipeId === cust.requestedRecipeId) ??
                    sellableBatches[0];

                  const activeBatchId =
                    selectedBatchMap[cust.id] ?? bestMatch?.id ?? '';
                  const chosenBatch = sellableBatches.find((b) => b.id === activeBatchId);
                  const patiencePct = Math.round(
                    (cust.patienceRemaining / Math.max(1, cust.patienceMax)) * 100,
                  );
                  const discount = discountMap[cust.id] ?? 0;
                  const isDineIn = cust.diningMode === 'DINE_IN';
                  const chosenRecipe = chosenBatch
                    ? recipes.find((r) => r.id === chosenBatch.recipeId)
                    : undefined;
                  const matchesFestival = Boolean(
                    activeFestival &&
                      chosenRecipe &&
                      doesRecipeMatchFestival(chosenRecipe, activeFestival),
                  );
                  const baseAfterEvent = chosenBatch
                    ? applyDailyEventRevenue(
                        Math.max(0, chosenBatch.sellingPricePerBox - discount),
                        activeDailyEvent,
                      )
                    : 0;
                  const withFestival = matchesFestival && activeFestival
                    ? Math.round((baseAfterEvent * activeFestival.revenueMultiplier) / 100) * 100
                    : baseAfterEvent;
                  const finalCollectAmount = isDineIn
                    ? Math.round((withFestival * DINE_IN_REVENUE_MULTIPLIER) / 100) * 100
                    : withFestival;

                  return (
                    <div
                      key={cust.id}
                      className="p-4 rounded-xl bg-white border border-[#244D3B]/15 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-bold text-sm text-[#244D3B] flex flex-wrap items-center gap-2">
                            <span>
                              {cust.name}{' '}
                              <span className="font-normal text-xs text-[#587567]">
                                · {arch ? (language === 'id' ? arch.nameId : arch.nameEn) : ''} (
                                {arch ? (language === 'id' ? arch.priorityId : arch.priorityEn) : ''})
                              </span>
                            </span>
                            {isDineIn ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#D9E8C8] text-[#244D3B] text-[10px] font-bold">
                                <Utensils className="w-3 h-3" />
                                <span>
                                  {t(language, 'Dine-In (+18%)', 'Makan di Tempat (+18%)')}
                                </span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-[#F6EBD4] text-[#587567] text-[10px] font-bold">
                                {t(language, 'Takeaway', 'Bawa Pulang')}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#355446] mt-0.5">
                            “{language === 'id' ? cust.dialogueId : cust.dialogueEn}”
                          </div>
                        </div>

                        <div className="text-right text-xs tabular-nums">
                          <div className="inline-flex items-center gap-1 font-semibold text-[#244D3B]">
                            <Clock className="w-3.5 h-3.5 text-[#ED9B53]" />
                            <span>{patiencePct}%</span>
                          </div>
                          <div className="text-[11px] text-[#587567] font-mono">
                            {t(language, 'Budget:', 'Anggaran:')} {formatRupiah(cust.maxBudget)}
                          </div>
                        </div>
                      </div>

                      {sellableBatches.length === 0 ? (
                        <div className="text-xs font-semibold text-[#B91C1C]">
                          {t(
                            language,
                            'Out of packaged stock! Close store or pack more dimsum.',
                            'Stok kemasan habis! Tutup toko atau kemas dimsum lagi.',
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#244D3B]/10">
                          <select
                            value={activeBatchId}
                            onChange={(e) =>
                              setSelectedBatchMap((prev) => ({
                                ...prev,
                                [cust.id]: e.target.value,
                              }))
                            }
                            className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-[#F6EBD4] border border-[#244D3B]/20 text-xs font-semibold text-[#244D3B]"
                          >
                            {sellableBatches.map((b) => {
                              const rec = recipes.find((r) => r.id === b.recipeId);
                              const pkg = getPackagingDef(b.packagingTypeId);
                              const clearanceTag =
                                (b.clearanceDiscountPct ?? 0) > 0
                                  ? ` · [-${b.clearanceDiscountPct}% ${t(language, 'Clearance', 'Obral')}]`
                                  : '';
                              return (
                                <option key={b.id} value={b.id}>
                                  {(rec
                                    ? language === 'id'
                                      ? rec.nameId
                                      : rec.nameEn
                                    : b.recipeId) +
                                    ` · ${language === 'id' ? pkg.nameId : pkg.nameEn} · ${formatRupiah(b.sellingPricePerBox)} (${t(language, `${b.boxesAvailable} left`, `sisa ${b.boxesAvailable}`)})${clearanceTag}`}
                                </option>
                              );
                            })}
                          </select>

                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-[#587567]">
                              {t(language, 'Discount:', 'Diskon:')}
                            </label>
                            <select
                              value={discount}
                              onChange={(e) =>
                                setDiscountMap((prev) => ({
                                  ...prev,
                                  [cust.id]: Number(e.target.value),
                                }))
                              }
                              className="px-2 py-2 rounded-lg bg-[#F6EBD4] border border-[#244D3B]/20 text-xs font-mono"
                            >
                              <option value={0}>Rp0</option>
                              <option value={1000}>Rp1.000</option>
                              <option value={2000}>Rp2.000</option>
                            </select>

                            <button
                              disabled={!chosenBatch}
                              onClick={() => handleServe(cust.id, activeBatchId)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ED9B53] hover:bg-[#DF883D] text-[#1C3529] text-xs font-bold cursor-pointer whitespace-nowrap"
                            >
                              <Check className="w-4 h-4" />
                              <span>
                                {t(language, 'Serve & Collect', 'Layani & Bayar')}{' '}
                                {chosenBatch ? formatRupiah(finalCollectAmount) : ''}
                              </span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {tab === 'online' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-white border border-[#244D3B]/15">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-[#244D3B]">
                    {t(
                      language,
                      'Online Delivery Channel (GoFood / GrabFood / ShopeeFood)',
                      'Saluran Pesan-Antar Online (GoFood / GrabFood / ShopeeFood)',
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11px] text-[#587567]">
                    {ONLINE_DELIVERY_PLATFORMS.map((p) => (
                      <span
                        key={p.id}
                        className="px-2 py-0.5 rounded-md bg-[#F6EBD4] font-mono font-semibold text-[#244D3B]"
                      >
                        {p.label}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleOnlineDelivery}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                    onlineDeliveryEnabled
                      ? 'bg-[#244D3B] text-white hover:bg-[#1B3A2C]'
                      : 'bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FECACA]'
                  }`}
                >
                  {onlineDeliveryEnabled
                    ? t(language, 'Accepting Online Orders', 'Aktif Terima Ojol')
                    : t(language, 'Online Orders Paused', 'Order Ojol Dijeda')}
                </button>
              </div>

              {!isStoreOpen ? (
                <div className="text-center py-10 text-sm text-[#587567]">
                  {t(
                    language,
                    'Open the store to start receiving courier pickup orders from delivery apps.',
                    'Buka toko untuk mulai menerima pesanan jemput kurir dari aplikasi online.',
                  )}
                </div>
              ) : onlineOrders.length === 0 ? (
                <div className="text-center py-10 text-sm text-[#587567]">
                  {onlineDeliveryEnabled
                    ? t(
                        language,
                        'Waiting for incoming online delivery orders...',
                        'Menunggu order pesan-antar online masuk...',
                      )
                    : t(
                        language,
                        'Online delivery channel is currently paused.',
                        'Saluran pesan-antar online sedang dijeda.',
                      )}
                </div>
              ) : (
                onlineOrders.map((ord) => {
                  const rec = recipes.find((r) => r.id === ord.recipeId);
                  const pkg = getPackagingDef(ord.boxType);
                  const matchingBatches = sellableBatches.filter(
                    (b) =>
                      b.recipeId === ord.recipeId &&
                      b.packagingTypeId === ord.boxType &&
                      b.boxesAvailable >= ord.quantityBoxes,
                  );
                  const fallbackBatches = sellableBatches.filter(
                    (b) =>
                      b.recipeId === ord.recipeId && b.boxesAvailable >= ord.quantityBoxes,
                  );
                  const candidateBatches =
                    matchingBatches.length > 0 ? matchingBatches : fallbackBatches;
                  const chosenBatchId =
                    selectedOnlineBatchMap[ord.id] ?? candidateBatches[0]?.id ?? '';
                  const grossTotal = ord.grossPricePerBox * ord.quantityBoxes;
                  const netTotal = ord.netPayoutPerBox * ord.quantityBoxes;
                  const commPct = Math.round(ord.commissionRate * 100);

                  return (
                    <div
                      key={ord.id}
                      className="p-4 rounded-xl bg-white border border-[#244D3B]/15 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-[#244D3B] text-white text-[11px] font-bold">
                              {ord.platform}
                            </span>
                            <span className="font-bold text-sm text-[#244D3B]">
                              {ord.courierName}
                            </span>
                          </div>
                          <div className="text-xs text-[#355446] mt-1 font-medium">
                            {ord.quantityBoxes}x {language === 'id' ? pkg.nameId : pkg.nameEn} ·{' '}
                            {rec ? (language === 'id' ? rec.nameId : rec.nameEn) : ord.recipeId}
                          </div>
                        </div>
                        <div className="text-right font-mono tabular-nums text-xs">
                          <div className="font-bold text-[#244D3B]">
                            {t(language, 'Net', 'Bersih')}: {formatRupiah(netTotal)}
                          </div>
                          <div className="text-[11px] text-[#587567]">
                            {t(language, 'Gross', 'Kotor')} {formatRupiah(grossTotal)} (-{commPct}%) ·{' '}
                            <span className="text-[#B45309] font-bold">
                              {Math.max(1, Math.ceil(ord.timeRemainingSec))}s
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#244D3B]/10">
                        {candidateBatches.length > 0 ? (
                          <>
                            <select
                              value={chosenBatchId}
                              onChange={(e) =>
                                setSelectedOnlineBatchMap((prev) => ({
                                  ...prev,
                                  [ord.id]: e.target.value,
                                }))
                              }
                              className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-[#F6EBD4] border border-[#244D3B]/20 text-xs font-semibold text-[#244D3B]"
                            >
                              {candidateBatches.map((b) => {
                                const bRec = recipes.find((r) => r.id === b.recipeId);
                                const bPkg = getPackagingDef(b.packagingTypeId);
                                return (
                                  <option key={b.id} value={b.id}>
                                    {(bRec ? (language === 'id' ? bRec.nameId : bRec.nameEn) : b.recipeId) +
                                      ` · ${language === 'id' ? bPkg.nameId : bPkg.nameEn} (${t(language, `${b.boxesAvailable} left`, `sisa ${b.boxesAvailable}`)})`}
                                  </option>
                                );
                              })}
                            </select>
                            <button
                              type="button"
                              disabled={!chosenBatchId}
                              onClick={() => {
                                const res = fulfillOnlineOrder(ord.id, chosenBatchId);
                                if (!res.ok) {
                                  setErrorMsg(
                                    language === 'id' ? res.errorId ?? null : res.errorEn ?? null,
                                  );
                                } else {
                                  setErrorMsg(null);
                                }
                              }}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ED9B53] hover:bg-[#DF883D] text-[#1C3529] text-xs font-bold cursor-pointer whitespace-nowrap"
                            >
                              <Bike className="w-4 h-4" />
                              <span>
                                {t(
                                  language,
                                  `Dispatch Courier (+${formatRupiah(netTotal)})`,
                                  `Serahkan ke Kurir (+${formatRupiah(netTotal)})`,
                                )}
                              </span>
                            </button>
                          </>
                        ) : (
                          <div className="text-xs font-semibold text-[#B91C1C]">
                            {t(
                              language,
                              `Need ${ord.quantityBoxes}x matching boxes in showcase to dispatch.`,
                              `Butuh ${ord.quantityBoxes}x kotak sesuai di etalase untuk kirim kurir.`,
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === 'preorder' &&
            preOrders.map((po) => {
              const rec = recipes.find((r) => r.id === po.recipeId);
              const pkg = getPackagingDef(po.boxType);
              const matchingBatch = sellableBatches.find(
                (b) =>
                  b.recipeId === po.recipeId &&
                  b.packagingTypeId === po.boxType &&
                  b.boxesAvailable >= po.quantityBoxes,
              );
              const tierMeta = TIER_LABELS[po.tier ?? 'community'];
              const minRep = po.minReputation ?? 0;
              const lockedByRep = business.reputation < minRep;
              const totalContractVal = po.quantityBoxes * po.offeredPricePerBox;

              return (
                <div
                  key={po.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-white border border-[#244D3B]/15"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${tierMeta.cls}`}>
                        {language === 'id' ? tierMeta.id : tierMeta.en}
                      </span>
                      <span className="font-bold text-sm text-[#244D3B]">{po.customerName}</span>
                      {po.accepted && !po.fulfilled && (
                        <span className="px-2 py-0.5 rounded-md bg-[#D9E8C8] text-[#244D3B] text-[10px] font-bold">
                          {t(language, 'Accepted', 'Diambil')}
                        </span>
                      )}
                      {lockedByRep && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FEE2E2] text-[#991B1B] text-[10px] font-bold">
                          <Lock className="w-3 h-3" />
                          <span>{t(language, `Rep ${minRep}+`, `Rep ${minRep}+`)}</span>
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#587567] tabular-nums">
                      {po.quantityBoxes}x {language === 'id' ? pkg.nameId : pkg.nameEn} ·{' '}
                      {rec ? (language === 'id' ? rec.nameId : rec.nameEn) : po.recipeId} ·{' '}
                      {formatRupiah(po.offeredPricePerBox)}/{t(language, 'box', 'kotak')} ·{' '}
                      <span className="font-semibold text-[#244D3B]">
                        {t(language, `Due Day ${po.dueDay}`, `Jatuh Tempo Hari ${po.dueDay}`)}
                      </span>
                      {po.penaltyReputation ? (
                        <span className="ml-1.5 text-[#B45309]">
                          ({t(language, `Miss: -${po.penaltyReputation} Rep`, `Gagal: -${po.penaltyReputation} Rep`)})
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {po.fulfilled ? (
                    <span className="text-xs font-bold text-[#6E9B72]">
                      {t(language, 'Fulfilled', 'Terpenuhi')}
                    </span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {!po.accepted && (
                        <button
                          type="button"
                          disabled={lockedByRep}
                          onClick={() => {
                            const res = acceptB2BContract(po.id);
                            if (!res.ok) {
                              setErrorMsg(
                                language === 'id' ? res.errorId ?? null : res.errorEn ?? null,
                              );
                            } else {
                              setErrorMsg(null);
                            }
                          }}
                          className="px-3.5 py-2 rounded-xl bg-[#ED9B53] hover:bg-[#DF883D] disabled:opacity-40 text-[#1C3529] text-xs font-bold cursor-pointer"
                        >
                          {t(language, 'Accept Contract', 'Terima Kontrak')}
                        </button>
                      )}
                      <button
                        disabled={!matchingBatch || lockedByRep}
                        onClick={() => {
                          if (!matchingBatch) return;
                          const res = fulfillPreOrder(po.id, matchingBatch.id);
                          if (!res.ok) {
                            setErrorMsg(
                              language === 'id' ? res.errorId ?? null : res.errorEn ?? null,
                            );
                          } else {
                            setErrorMsg(null);
                          }
                        }}
                        className="px-4 py-2 rounded-xl bg-[#244D3B] disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
                      >
                        {matchingBatch
                          ? t(
                              language,
                              `Fulfill (${formatRupiah(totalContractVal)})`,
                              `Penuhi (${formatRupiah(totalContractVal)})`,
                            )
                          : t(language, 'Need Exact Stock', 'Stok Sesuai Belum Ada')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

          {tab === 'receipts' &&
            (todayReceipts.length === 0 ? (
              <div className="text-center py-10 text-sm text-[#587567]">
                {t(language, 'No sales recorded today yet.', 'Belum ada transaksi penjualan hari ini.')}
              </div>
            ) : (
              todayReceipts.map((ord) => {
                const rec = recipes.find((r) => r.id === ord.recipeId);
                const channelLabel =
                  ord.orderType === 'PRE_ORDER'
                    ? t(language, 'B2B Contract', 'Kontrak B2B')
                    : ord.orderType === 'ONLINE_DELIVERY'
                      ? ord.platformName ?? t(language, 'Online Delivery', 'Pesan-Antar')
                      : t(language, 'Direct', 'Langsung');
                return (
                  <div
                    key={ord.id}
                    className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-white border border-[#244D3B]/12 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <Receipt className="w-4 h-4 text-[#6E9B72]" />
                      <div>
                        <div className="font-semibold text-[#244D3B] flex flex-wrap items-center gap-1.5">
                          <span>
                            {ord.customerName} ({channelLabel})
                          </span>
                          {ord.diningMode === 'DINE_IN' && (
                            <span className="px-1.5 py-0.5 rounded bg-[#D9E8C8] text-[#244D3B] text-[10px] font-bold">
                              Dine-In
                            </span>
                          )}
                          {ord.isClearance && (
                            <span className="px-1.5 py-0.5 rounded bg-[#FEF3EC] text-[#B45309] text-[10px] font-bold">
                              {t(language, 'Clearance', 'Obral')}
                            </span>
                          )}
                        </div>
                        <div className="text-[#587567]">
                          {ord.quantityBoxes}x{' '}
                          {rec ? (language === 'id' ? rec.nameId : rec.nameEn) : ord.recipeId} ·{' '}
                          {t(language, `CS ${ord.satisfaction}%`, `Kepuasan ${ord.satisfaction}%`)}
                          {ord.platformCommission ? (
                            <span className="ml-1.5 font-mono">
                              · {t(language, 'Fee', 'Komisi')} {formatRupiah(ord.platformCommission)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div className="font-bold text-[#244D3B]">
                        +{formatRupiah(ord.totalAmount)}
                      </div>
                      <div className="text-[11px] text-[#587567]">
                        {t(language, 'COGS', 'HPP')} {formatRupiah(ord.totalCogs)}
                      </div>
                    </div>
                  </div>
                );
              })
            ))}
        </div>
      </div>
    </div>
  );
};
