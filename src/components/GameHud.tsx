import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  ChevronUp,
  Globe,
  Leaf,
  Maximize2,
  Minimize2,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Refrigerator,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Target,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  evaluateBonusObjectives,
  formatRupiah,
  getDailyRevenueGoal,
  getDailyWastageLimit,
  getDineInCapacity,
  getNextUpcomingFestival,
  getOutletTierDef,
  getRushHourPhase,
} from '../config/gameBalance';
import { getReputationTrafficBonusPct } from '../domain/customerEngine';
import type { JoystickInputRef } from '../game/DimsumWorldCanvas';
import { STATION_META, TUTORIAL_LABELS, t } from '../i18n/translations';
import { useGameStore } from '../store/useGameStore';
import type { StationId } from '../types/game';
import { useViewportMode } from '../utils/useViewportMode';
import { DailyMissionsDashboard, DailyMissionsModal } from './DailyMissionsDashboard';

interface GameHudProps {
  joystickRef: React.MutableRefObject<JoystickInputRef>;
}

/** Boolean UI preference kept in localStorage when available (sandboxed frames may block storage). */
function usePersistedFlag(key: string, fallback: boolean) {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : raw === '1';
    } catch {
      return fallback;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, value ? '1' : '0');
    } catch {
      // storage unavailable: preference lasts for this session only
    }
  }, [key, value]);
  return [value, setValue] as const;
}

export const GameHud: React.FC<GameHudProps> = ({ joystickRef }) => {
  const language = useGameStore((s) => s.language);
  const muted = useGameStore((s) => s.muted);
  const gameState = useGameStore((s) => s.gameState);
  const business = useGameStore((s) => s.business);
  const currentDay = useGameStore((s) => s.currentDay);
  const cashBalance = useGameStore((s) => s.cashBalance);
  const unpaidDebt = useGameStore((s) => s.unpaidDebt);
  const nearestStation = useGameStore((s) => s.nearestStation);
  const activeStation = useGameStore((s) => s.activeStation);
  const tutorialStep = useGameStore((s) => s.tutorialStep);
  const storeTimeRemainingSec = useGameStore((s) => s.storeTimeRemainingSec);
  const customers = useGameStore((s) => s.customers);
  const onlineOrders = useGameStore((s) => s.onlineOrders);
  const rushHourActive = useGameStore((s) => s.rushHourActive);
  const upgrades = useGameStore((s) => s.upgrades);
  const productBatches = useGameStore((s) => s.productBatches);
  const salesOrders = useGameStore((s) => s.salesOrders);
  const todayStats = useGameStore((s) => s.todayStats);
  const activeDailyEvent = useGameStore((s) => s.activeDailyEvent);
  const activeFestival = useGameStore((s) => s.activeFestival);
  const rivalShop = useGameStore((s) => s.rivalShop);
  const franchiseBranches = useGameStore((s) => s.franchiseBranches);
  const prestigeLevel = useGameStore((s) => s.prestigeLevel);
  const activeDelegation = useGameStore((s) => s.activeDelegation);
  const recipes = useGameStore((s) => s.recipes);
  const toasts = useGameStore((s) => s.toasts);

  const openStation = useGameStore((s) => s.openStation);
  const toggleLanguage = useGameStore((s) => s.toggleLanguage);
  const toggleMute = useGameStore((s) => s.toggleMute);
  const togglePause = useGameStore((s) => s.togglePause);
  const skipTutorial = useGameStore((s) => s.skipTutorial);
  const dismissToast = useGameStore((s) => s.dismissToast);
  const completeDelegatedCooking = useGameStore((s) => s.completeDelegatedCooking);

  const [delegationNowMs, setDelegationNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!activeDelegation || gameState === 'GAME_PAUSED') return;
    setDelegationNowMs(Date.now());
    const id = window.setInterval(() => {
      const now = Date.now();
      setDelegationNowMs(now);
      if (now >= activeDelegation.startedAt + activeDelegation.durationMs) {
        completeDelegatedCooking();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [activeDelegation, gameState, completeDelegatedCooking]);

  const {
    width: viewportWidth,
    isTouchDevice,
    isMobilePortrait,
    isShortLandscape,
    isCompactViewport,
  } = useViewportMode();

  const [compactHud, setCompactHud] = useState(isCompactViewport);
  // Left side is split into 3 independent panels; their on/off & minimize states persist per browser
  const [showInfoPanel, setShowInfoPanel] = usePersistedFlag('dimsum.hud.infoPanel', true);
  const [showQuickBar, setShowQuickBar] = useState(true);
  const [showMissionsWidget, setShowMissionsWidget] = usePersistedFlag('dimsum.hud.missionsExpanded', !isCompactViewport);
  const [showMissionsModal, setShowMissionsModal] = useState(false);
  const [showGoalsWidget, setShowGoalsWidget] = usePersistedFlag('dimsum.hud.goalsExpanded', !isCompactViewport);
  const [showEventDetails, setShowEventDetails] = useState(!isCompactViewport);
  const joyOriginRef = useRef<{ x: number; y: number } | null>(null);
  const [joyKnob, setJoyKnob] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setCompactHud(isCompactViewport);
    setShowMissionsWidget(!isCompactViewport);
    setShowGoalsWidget(!isCompactViewport);
    setShowEventDetails(!isCompactViewport);
  }, [isCompactViewport]);

  const showJoystick =
    isTouchDevice || isMobilePortrait || isShortLandscape || viewportWidth < 768;

  const toggleCompactHud = () => {
    const nextCompact = !compactHud;
    setCompactHud(nextCompact);
    if (!nextCompact) {
      setShowInfoPanel(true);
    }
    setShowMissionsWidget(!nextCompact);
    setShowGoalsWidget(!nextCompact);
    setShowEventDetails(!nextCompact);
    setShowQuickBar(!nextCompact);
  };

  const isStoreOpen = gameState === 'STORE_OPEN' || gameState === 'CUSTOMER_SERVICE';
  const waitingCustomersCount = customers.filter(
    (c) => c.lifecycle !== 'EATING' && c.lifecycle !== 'EXITING',
  ).length;
  const eatingCustomersCount = customers.filter((c) => c.lifecycle === 'EATING').length;
  const tableCapacity = getDineInCapacity(upgrades);
  const rushPhase = getRushHourPhase(storeTimeRemainingSec);
  const isRushActive = isStoreOpen && (rushHourActive || rushPhase.active);
  const cashierAlertCount = waitingCustomersCount + onlineOrders.length;

  const totalBoxesReady = productBatches
    .filter((b) => b.status === 'PACKAGED' && b.boxesAvailable > 0 && b.expiryDay >= currentDay)
    .reduce((sum, b) => sum + b.boxesAvailable, 0);

  const { todayRevenue, todaySalesCount } = useMemo(() => {
    let rev = 0;
    let count = 0;
    for (const order of salesOrders) {
      if (order.day === currentDay) {
        rev += order.totalAmount;
        count += 1;
      }
    }
    return { todayRevenue: rev, todaySalesCount: count };
  }, [salesOrders, currentDay]);

  const revenueGoal = getDailyRevenueGoal(business.level);
  const revenuePct = Math.min(
    100,
    Math.round((todayRevenue / Math.max(1, revenueGoal)) * 100),
  );
  const revenueGoalMet = todayRevenue >= revenueGoal;

  const todayWastage =
    (todayStats.inventoryLossValue ?? 0) + (todayStats.qcWastedCost ?? 0);
  const wastageLimit = getDailyWastageLimit(business.level);
  const wastagePct = Math.min(
    100,
    Math.round((todayWastage / Math.max(1, wastageLimit)) * 100),
  );
  const isZeroWaste = todayWastage === 0;
  const isWasteOverCap = todayWastage > wastageLimit;

  const bonusObjectives = useMemo(
    () =>
      evaluateBonusObjectives({
        businessLevel: business.level,
        currentDay,
        todayCustomersServed: Math.max(todayStats.customersServed, todaySalesCount),
        todayPcsProduced: todayStats.pcsProduced,
        totalCustomersServed: salesOrders.length,
      }),
    [
      business.level,
      currentDay,
      todayStats.customersServed,
      todayStats.pcsProduced,
      todaySalesCount,
      salesOrders.length,
    ],
  );
  const completedBonusCount = bonusObjectives.filter((o) => o.completed).length;

  const nearestMeta = nearestStation ? STATION_META[nearestStation] : null;
  const tutorialText =
    tutorialStep !== 'NONE' ? TUTORIAL_LABELS[tutorialStep][language] : '';

  const handleJoystickStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    joyOriginRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  };

  const handleJoystickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!joyOriginRef.current) return;
    const maxR = isShortLandscape ? 24 : 32;
    const dxRaw = e.clientX - joyOriginRef.current.x;
    const dyRaw = e.clientY - joyOriginRef.current.y;
    const dist = Math.hypot(dxRaw, dyRaw);
    const clampedDist = Math.min(maxR, dist);
    const angle = Math.atan2(dyRaw, dxRaw);
    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;
    setJoyKnob({ x: kx, y: ky });
    joystickRef.current.dx = kx / maxR;
    joystickRef.current.dy = ky / maxR;
  };

  const handleJoystickEnd = () => {
    joyOriginRef.current = null;
    setJoyKnob({ x: 0, y: 0 });
    joystickRef.current.dx = 0;
    joystickRef.current.dy = 0;
  };

  const quickStations: Array<{
    id: StationId;
    labelEn: string;
    labelId: string;
    icon: React.ReactNode;
  }> = [
    { id: 'market', labelEn: 'Market', labelId: 'Pasar', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'storage', labelEn: 'Storage', labelId: 'Kulkas', icon: <Refrigerator className="w-4 h-4" /> },
    { id: 'prep', labelEn: 'Cook', labelId: 'Masak', icon: <ChefHat className="w-4 h-4" /> },
    { id: 'packaging', labelEn: 'Pack', labelId: 'Kemas', icon: <Package className="w-4 h-4" /> },
    { id: 'cashier', labelEn: 'Cashier', labelId: 'Kasir', icon: <Store className="w-4 h-4" /> },
    { id: 'board', labelEn: 'Finance', labelId: 'Laporan', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-10 flex flex-col justify-between overflow-hidden ${
        isShortLandscape ? 'gap-1 p-2' : 'gap-2 p-3 md:p-5'
      }`}
    >
      {/* TOP PERIMETER HUD */}
      <div className="flex-1 min-h-0 flex items-start justify-between gap-2">
        <div className="flex flex-col items-start gap-1.5 min-w-0 max-h-full">
          {/* Top-Left Toggle Button + Business Metrics Strip */}
          <div className="flex flex-wrap items-start gap-1.5 sm:gap-2 shrink-0">
            {/* Panel 1 (Info: level, festival/event, challenge) on/off switch */}
            <button
              type="button"
              data-testid="info-panel-toggle"
              onClick={() => setShowInfoPanel((v) => !v)}
              aria-pressed={showInfoPanel}
              aria-label={t(
                language,
                showInfoPanel ? 'Info Panel: On (tap to hide)' : 'Info Panel: Off (tap to show)',
                showInfoPanel ? 'Panel Info: Aktif (ketuk untuk sembunyikan)' : 'Panel Info: Nonaktif (ketuk untuk tampilkan)',
              )}
              className={`pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-semibold shadow-sm cursor-pointer whitespace-nowrap transition-colors ${
                showInfoPanel
                  ? 'bg-[#FAF5EA] border-[#244D3B]/20 text-[#244D3B] hover:bg-[#D9E8C8]'
                  : 'bg-[#244D3B] border-[#244D3B] text-[#FAF5EA] hover:bg-[#1B3A2C]'
              }`}
            >
              {showInfoPanel ? (
                <PanelLeftClose className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <PanelLeftOpen className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{t(language, 'Info', 'Info')}</span>
              <span
                className={`px-1 rounded text-[10px] font-bold ${
                  showInfoPanel ? 'bg-[#D9E8C8] text-[#244D3B]' : 'bg-[#FAF5EA] text-[#244D3B]'
                }`}
              >
                {showInfoPanel ? t(language, 'ON', 'AKTIF') : t(language, 'OFF', 'MATI')}
              </span>
            </button>

            {/* Panel 1 · Info: business level strip */}
            {showInfoPanel && (
              <div
                data-testid="info-panel-level"
                className={`pointer-events-auto flex flex-wrap items-center rounded-xl bg-[#FAF5EA] border border-[#244D3B]/20 shadow-sm ${
                  isShortLandscape
                    ? 'gap-2 px-2.5 py-1.5 text-[11px]'
                    : 'gap-3 md:gap-5 px-3 sm:px-4 py-2 sm:py-2.5 text-xs md:text-sm'
                }`}
              >
                <div>
                  <span className="text-[#587567] font-medium">{business.name}</span>
                  <span className="mx-1.5 sm:mx-2 text-[#244D3B]/30">·</span>
                  <span className="font-bold text-[#244D3B] tabular-nums">
                    {t(language, `Day ${currentDay}`, `Hari ${currentDay}`)}
                  </span>
                </div>

                <div className="h-4 w-px bg-[#244D3B]/15 hidden sm:block" />

                <div className="font-mono tabular-nums font-bold text-[#244D3B] inline-flex items-center gap-2">
                  <span>{formatRupiah(cashBalance)}</span>
                  {unpaidDebt > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-[#FEE2E2] text-[#991B1B] text-[11px] font-bold">
                      {t(language, `Debt ${formatRupiah(unpaidDebt)}`, `Utang ${formatRupiah(unpaidDebt)}`)}
                    </span>
                  )}
                </div>

                <div className="inline-flex items-center gap-1.5 text-xs text-[#244D3B] font-semibold tabular-nums">
                  <Star className="w-3.5 h-3.5 fill-[#ED9B53] text-[#D97706] shrink-0" />
                  <span>
                    {t(
                      language,
                      `Shop Rep ${business.reputation}/100`,
                      `Reputasi ${business.reputation}/100`,
                    )}
                  </span>
                  <span className="text-[11px] font-mono text-[#587567]">
                    ({getReputationTrafficBonusPct(business.reputation) >= 0 ? '+' : ''}
                    {getReputationTrafficBonusPct(business.reputation)}%{' '}
                    {t(language, 'traffic', 'tamu')})
                  </span>
                </div>

                <div className="text-xs text-[#355446] tabular-nums hidden md:block">
                  <span className="font-semibold text-[#244D3B]">
                    Lv {business.level} ·{' '}
                    {language === 'id'
                      ? getOutletTierDef(business.level).nameId
                      : getOutletTierDef(business.level).nameEn}
                    {prestigeLevel > 0 ? ` ★${prestigeLevel}` : ''}
                    {franchiseBranches.length > 0
                      ? ` · ${franchiseBranches.length} ${t(language, 'Branches', 'Cabang')}`
                      : ''}
                  </span>{' '}
                  · {t(language, `${totalBoxesReady} boxes ready`, `${totalBoxesReady} kotak siap`)}
                </div>

                <div
                  className={`flex flex-wrap items-center gap-2 text-xs font-semibold tabular-nums ${
                    isStoreOpen ? 'text-[#244D3B]' : 'text-[#ED9B53]'
                  }`}
                >
                  <span>
                    {isStoreOpen
                      ? t(
                          language,
                          `OPEN (${Math.ceil(storeTimeRemainingSec)}s · ${waitingCustomersCount} waiting · Dine-In ${eatingCustomersCount}/${tableCapacity})`,
                          `BUKA (${Math.ceil(storeTimeRemainingSec)}d · ${waitingCustomersCount} antre · Dine-In ${eatingCustomersCount}/${tableCapacity})`,
                        )
                      : t(
                          language,
                          `PREP PHASE · ${tableCapacity} Dine-In Tables`,
                          `PERSIAPAN · ${tableCapacity} Meja Dine-In`,
                        )}
                  </span>
                  {isRushActive && (
                    <span className="px-2 py-0.5 rounded-md bg-[#FEF3C7] border border-[#F59E0B]/40 text-[#92400E] text-[11px] font-bold">
                      {rushPhase.active
                        ? language === 'id'
                          ? rushPhase.labelId
                          : rushPhase.labelEn
                        : t(language, 'Rush Hour', 'Jam Sibuk')}
                    </span>
                  )}
                  {isStoreOpen && onlineOrders.length > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-[#E6F4EA] border border-[#6E9B72]/50 text-[#1E4620] text-[11px] font-bold">
                      {t(language, `Ojol: ${onlineOrders.length}`, `Ojol: ${onlineOrders.length}`)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Left panel stack: Info (events) · Daily Missions · Daily Goals, each independently controlled */}
          <div
              data-testid="left-panel-stack"
              className={`flex flex-col items-start gap-2 flex-1 min-h-0 overflow-y-auto pr-1 ${
                isShortLandscape
                  ? 'max-h-[calc(100vh-140px)]'
                  : isMobilePortrait
                    ? 'max-h-[38vh]'
                    : 'max-h-[45vh] md:max-h-none'
              }`}
            >
              {/* Panel 1 · Info: festival/rival telemetry + daily event or challenge */}
              {showInfoPanel && (
              <div data-testid="info-panel-events" className="flex flex-col items-start gap-2">
              {/* Weekly Festival / Rival Telemetry Card */}
              {(() => {
                const nextFest = getNextUpcomingFestival(currentDay);
                const playerSharePct = Math.max(0, 100 - rivalShop.marketSharePct);
                return (
                  <div
                    className={`pointer-events-auto rounded-xl border shadow-sm px-3.5 py-2 text-xs space-y-1 ${
                      isShortLandscape ? 'w-60 sm:w-68' : 'w-68 sm:w-80'
                    } ${
                      activeFestival
                        ? 'bg-[#FFF3DC] border-[#ED9B53]'
                        : 'bg-[#FAF5EA] border-[#244D3B]/15'
                    }`}
                  >
                    {activeFestival ? (
                      <div className="flex items-center justify-between gap-2 text-[#1C3529] font-bold">
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                          <Sparkles className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                          <span className="truncate">
                            {t(language, 'Festival:', 'Festival:')}{' '}
                            {language === 'id' ? activeFestival.titleId : activeFestival.titleEn}
                          </span>
                        </span>
                        <span className="font-mono tabular-nums text-[11px] text-[#92400E] shrink-0">
                          2x · +15%
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 text-[#355446] tabular-nums">
                        <span className="truncate font-semibold">
                          {t(
                            language,
                            `Next Fest (${nextFest.daysUntil}d): ${nextFest.festival.titleEn}`,
                            `Festival (${nextFest.daysUntil}h lagi): ${nextFest.festival.titleId}`,
                          )}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#587567] tabular-nums">
                      <span className="truncate">
                        {t(language, 'Rival', 'Rival')} {rivalShop.name}:{' '}
                        <strong className="text-[#991B1B]">{rivalShop.marketSharePct}%</strong>
                      </span>
                      <span className="font-mono text-[#244D3B] font-semibold shrink-0">
                        {t(language, `You ${playerSharePct}%`, `Toko ${playerSharePct}%`)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Daily Event Banner */}
              {activeDailyEvent && (
            <div
              className={`pointer-events-auto rounded-xl border shadow-sm px-3.5 py-2 text-xs ${
                isShortLandscape ? 'w-60 sm:w-68' : 'w-68 sm:w-80'
              } ${
                activeDailyEvent.kind === 'positive'
                  ? 'bg-[#EEF5E6] border-[#6E9B72]'
                  : 'bg-[#FEF3EC] border-[#DC2626]/40'
              }`}
            >
              <button
                type="button"
                onClick={() => setShowEventDetails((v) => !v)}
                className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
                aria-expanded={showEventDetails}
              >
                <span className="inline-flex items-center gap-1.5 font-bold text-[#244D3B] min-w-0">
                  {activeDailyEvent.kind === 'positive' ? (
                    <Sparkles className="w-3.5 h-3.5 text-[#244D3B] shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-[#B91C1C] shrink-0" />
                  )}
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                      activeDailyEvent.kind === 'positive'
                        ? 'bg-[#D9E8C8] text-[#244D3B]'
                        : 'bg-[#FEE2E2] text-[#991B1B]'
                    }`}
                  >
                    {activeDailyEvent.kind === 'positive'
                      ? t(language, 'Event', 'Kabar')
                      : t(language, 'Challenge', 'Tantangan')}
                  </span>
                  <span className="truncate">
                    {language === 'id'
                      ? activeDailyEvent.titleId
                      : activeDailyEvent.titleEn}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 text-[#587567] shrink-0">
                  {showEventDetails ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </span>
              </button>

              {showEventDetails && (
                <div className="mt-1.5 space-y-1">
                  <div
                    className={`font-mono tabular-nums text-[11px] font-bold ${
                      activeDailyEvent.kind === 'positive'
                        ? 'text-[#244D3B]'
                        : 'text-[#991B1B]'
                    }`}
                  >
                    {language === 'id'
                      ? activeDailyEvent.impactTagId
                      : activeDailyEvent.impactTagEn}
                  </div>
                  <p className="text-[11px] text-[#355446] leading-snug">
                    {language === 'id'
                      ? activeDailyEvent.descriptionId
                      : activeDailyEvent.descriptionEn}
                  </p>
                </div>
              )}
            </div>
          )}

              </div>
              )}

          {/* Panel 2 · Daily Missions (3 random goals each day), minimizable */}
          <DailyMissionsDashboard
            variant="compact"
            expanded={showMissionsWidget}
            onToggleExpanded={() => setShowMissionsWidget((v) => !v)}
            onOpenDashboard={() => setShowMissionsModal(true)}
          />

          {/* Panel 3 · Daily Goals & highlighted bonus objectives, minimizable */}
          <div
            data-testid="daily-goals-card"
            className={`pointer-events-auto rounded-xl bg-[#FAF5EA] border border-[#244D3B]/20 shadow-sm px-3.5 py-2.5 text-xs ${
              isShortLandscape ? 'w-60 sm:w-68' : 'w-68 sm:w-80'
            }`}
          >
            <button
              type="button"
              onClick={() => setShowGoalsWidget((v) => !v)}
              className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
              aria-expanded={showGoalsWidget}
              title={
                showGoalsWidget
                  ? t(language, 'Minimize Daily Goals', 'Perkecil Target Harian')
                  : t(language, 'Expand Daily Goals', 'Perluas Target Harian')
              }
            >
              <span className="inline-flex items-center gap-1.5 font-bold text-[#244D3B]">
                <Target className="w-3.5 h-3.5 text-[#ED9B53]" />
                <span>{t(language, 'Daily Goals', 'Target Harian')}</span>
                <span className="px-1.5 py-0.5 rounded bg-[#E9DEC8] text-[10px] font-semibold text-[#355446] tabular-nums">
                  {t(language, `Day ${currentDay}`, `Hari ${currentDay}`)}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-[#587567]">
                <span>{revenuePct}%</span>
                {showGoalsWidget ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </span>
            </button>

            {showGoalsWidget && (
              <div className="mt-2.5 space-y-2.5">
                {/* Current Day Revenue Target */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-[#355446]">
                      {t(
                        language,
                        `Day ${currentDay} Revenue Target`,
                        `Target Omzet Hari ${currentDay}`,
                      )}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums ${
                        revenueGoalMet ? 'text-[#244D3B]' : 'text-[#587567]'
                      }`}
                    >
                      {revenueGoalMet && <CheckCircle2 className="w-3 h-3" />}
                      <span>
                        {revenueGoalMet
                          ? t(language, 'Target Met', 'Tercapai')
                          : `${revenuePct}%`}
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-sm bg-[#E9DEC8] overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        revenueGoalMet ? 'bg-[#244D3B]' : 'bg-[#6E9B72]'
                      }`}
                      style={{ width: `${revenuePct}%` }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] font-mono tabular-nums text-[#355446]">
                    <span className="font-bold text-[#244D3B]">
                      {formatRupiah(todayRevenue)}
                    </span>
                    <span className="text-[#587567]">
                      / {formatRupiah(revenueGoal)}
                    </span>
                  </div>
                </div>

                {/* Ingredient Wastage Goal */}
                <div className="pt-2 border-t border-[#244D3B]/10">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-[#355446]">
                      {t(language, 'Ingredient Wastage', 'Limbah Bahan')}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                        isZeroWaste
                          ? 'text-[#244D3B]'
                          : isWasteOverCap
                            ? 'text-[#991B1B]'
                            : 'text-[#B45309]'
                      }`}
                    >
                      {isZeroWaste ? (
                        <>
                          <Leaf className="w-3 h-3" />
                          <span>{t(language, 'Zero Waste', 'Nol Limbah')}</span>
                        </>
                      ) : isWasteOverCap ? (
                        <>
                          <AlertTriangle className="w-3 h-3" />
                          <span>{t(language, 'Over Cap', 'Lewat Batas')}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{t(language, 'Within Cap', 'Batas Aman')}</span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-sm bg-[#E9DEC8] overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isWasteOverCap ? 'bg-[#DC2626]' : 'bg-[#ED9B53]'
                      }`}
                      style={{ width: `${wastagePct}%` }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] font-mono tabular-nums text-[#355446]">
                    <span
                      className={`font-bold ${
                        isWasteOverCap ? 'text-[#991B1B]' : 'text-[#244D3B]'
                      }`}
                    >
                      {formatRupiah(todayWastage)}
                    </span>
                    <span className="text-[#587567]">
                      {t(language, 'cap', 'batas')} {formatRupiah(wastageLimit)}
                    </span>
                  </div>
                </div>

                {/* Highlighted Bonus Objectives */}
                <div className="rounded-lg bg-[#F6EBD4]/90 border border-[#ED9B53]/55 p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-bold text-[#244D3B]">
                      <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
                      <span>{t(language, 'Bonus Objectives', 'Target Bonus')}</span>
                    </span>
                    <span className="text-[11px] font-mono tabular-nums font-semibold text-[#92400E]">
                      {completedBonusCount}/{bonusObjectives.length}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {bonusObjectives.map((obj) => {
                      const pct = Math.min(
                        100,
                        Math.round((obj.current / Math.max(1, obj.target)) * 100),
                      );
                      const isFeatured = obj.id === 'serve_50_customers';
                      return (
                        <div
                          key={obj.id}
                          className={`rounded-md px-2 py-1.5 border ${
                            obj.completed
                              ? 'bg-[#D9E8C8]/75 border-[#6E9B72]/50'
                              : isFeatured
                                ? 'bg-[#FFFBF2] border-[#ED9B53]/65'
                                : 'bg-[#FAF5EA]/85 border-[#244D3B]/10'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="inline-flex items-center gap-1 font-semibold text-[#244D3B] min-w-0">
                              {obj.completed ? (
                                <CheckCircle2 className="w-3 h-3 text-[#244D3B] shrink-0" />
                              ) : isFeatured ? (
                                <Award className="w-3 h-3 text-[#D97706] shrink-0" />
                              ) : null}
                              <span className="truncate">
                                {language === 'id' ? obj.titleId : obj.titleEn}
                              </span>
                            </span>
                            <span
                              className={`shrink-0 text-[10px] font-mono tabular-nums font-bold ${
                                obj.completed ? 'text-[#244D3B]' : 'text-[#B45309]'
                              }`}
                            >
                              {obj.completed
                                ? t(language, 'Claimed', 'Tercapai')
                                : `+${formatRupiah(obj.rewardCash)}`}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="h-1 flex-1 rounded-sm bg-[#E9DEC8] overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  obj.completed
                                    ? 'bg-[#244D3B]'
                                    : isFeatured
                                      ? 'bg-[#ED9B53]'
                                      : 'bg-[#6E9B72]'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono tabular-nums text-[#587567]">
                              {obj.current}/{obj.target}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Utility Buttons */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={toggleCompactHud}
            aria-pressed={compactHud}
            aria-label={t(language, 'Toggle Compact HUD', 'Mode HUD Ringkas')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-semibold cursor-pointer whitespace-nowrap ${
              compactHud
                ? 'bg-[#ED9B53] border-[#ED9B53] text-[#1C3529]'
                : 'bg-[#FAF5EA] border-[#244D3B]/20 text-[#244D3B] hover:bg-[#D9E8C8]'
            }`}
          >
            {compactHud ? (
              <Maximize2 className="w-3.5 h-3.5" />
            ) : (
              <Minimize2 className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {compactHud
                ? t(language, 'Expand HUD', 'HUD Penuh')
                : t(language, 'Compact HUD', 'HUD Ringkas')}
            </span>
          </button>
          <button
            onClick={toggleLanguage}
            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-[#FAF5EA] border border-[#244D3B]/20 text-xs font-semibold text-[#244D3B] hover:bg-[#D9E8C8] cursor-pointer whitespace-nowrap"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{language.toUpperCase()}</span>
          </button>
          <button
            onClick={toggleMute}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#FAF5EA] border border-[#244D3B]/20 text-[#244D3B] hover:bg-[#D9E8C8] cursor-pointer"
            aria-label="Toggle Sound"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            onClick={togglePause}
            aria-label={t(language, 'Menu', 'Jeda')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#244D3B] text-white text-xs font-semibold hover:bg-[#1B3A2C] cursor-pointer whitespace-nowrap"
          >
            <Pause className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t(language, 'Menu', 'Jeda')}</span>
          </button>
        </div>
      </div>

      {/* TUTORIAL, AUTO-BATCH PROGRESS & TOAST STACK */}
      <div className="shrink-0 flex flex-col items-end gap-2 pointer-events-none">
        {activeDelegation && (() => {
          const rec = recipes.find((r) => r.id === activeDelegation.recipeId);
          const elapsed = Math.max(0, delegationNowMs - activeDelegation.startedAt);
          const pct = Math.min(
            100,
            Math.round((elapsed / Math.max(1, activeDelegation.durationMs)) * 100),
          );
          const remSec = Math.max(
            0,
            (activeDelegation.durationMs - elapsed) / 1000,
          );
          const qty = (rec?.batchSize ?? 10) * activeDelegation.batchCount;
          return (
            <div className="pointer-events-auto w-68 rounded-xl bg-[#FAF5EA] border border-[#244D3B]/25 shadow-md px-3.5 py-2.5 text-xs">
              <div className="flex items-center justify-between gap-2 text-[#244D3B] font-bold">
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <Users className="w-3.5 h-3.5 text-[#ED9B53] shrink-0" />
                  <span className="truncate">
                    {t(language, 'Staff Auto-Batch', 'Masak Otomatis Staf')}
                  </span>
                </span>
                <span className="font-mono tabular-nums text-[11px] text-[#B45309] shrink-0">
                  {remSec.toFixed(1)}{t(language, 's', 'd')}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[#355446]">
                <span className="truncate font-semibold">
                  {qty} pcs {rec ? (language === 'id' ? rec.nameId : rec.nameEn) : ''}
                </span>
                <span className="font-mono tabular-nums font-bold text-[#244D3B] shrink-0">
                  ~QC {activeDelegation.projectedQualityScore}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-sm bg-[#E9DEC8] overflow-hidden">
                <div
                  className="h-full bg-[#244D3B] transition-all duration-100"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })()}

        {tutorialText && !activeStation && (
          <div className="pointer-events-auto self-start max-w-md rounded-xl bg-[#244D3B] text-[#FAF5EA] px-4 py-3 shadow-md border border-[#6E9B72]">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs md:text-sm font-medium leading-snug">{tutorialText}</p>
              <button
                onClick={skipTutorial}
                className="text-[11px] underline text-[#D9E8C8] hover:text-white shrink-0 cursor-pointer"
              >
                {t(language, 'Skip', 'Lewati')}
              </button>
            </div>
          </div>
        )}

        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-md border ${
              toast.type === 'error'
                ? 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]'
                : toast.type === 'warning'
                  ? 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]'
                  : 'bg-[#FAF5EA] text-[#244D3B] border-[#6E9B72]'
            }`}
          >
            <span>{language === 'id' ? toast.textId : toast.textEn}</span>
            <button
              onClick={() => dismissToast(toast.id)}
              className="opacity-70 hover:opacity-100 cursor-pointer"
              aria-label="Close notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* BOTTOM CONTROLS: Mobile Floating Joystick + Contextual Interact + Quick Station Dock */}
      <div className="relative flex flex-col items-center gap-2 shrink-0">
        {/* Virtual Joystick for touch / mobile portrait & short-landscape viewports */}
        {showJoystick && (
          <div
            data-testid="virtual-joystick"
            onPointerDown={handleJoystickStart}
            onPointerMove={handleJoystickMove}
            onPointerUp={handleJoystickEnd}
            onPointerCancel={handleJoystickEnd}
            className={`pointer-events-auto fixed z-20 rounded-full bg-[#FAF5EA]/90 border-2 border-[#244D3B]/30 touch-none flex items-center justify-center shadow-sm ${
              isShortLandscape
                ? 'bottom-2 left-2 w-16 h-16'
                : 'bottom-32 left-3 w-20 h-20'
            }`}
            aria-label="Movement Joystick"
          >
            <div
              className={`rounded-full bg-[#244D3B] shadow ${
                isShortLandscape ? 'w-7 h-7' : 'w-9 h-9'
              }`}
              style={{ transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)` }}
            />
          </div>
        )}

        {/* Center Contextual Interaction + Collapsible Quick Station Dock */}
        <div
          className={`w-full flex flex-col items-center ${
            isShortLandscape ? 'gap-1 pl-[72px] pr-[174px]' : 'gap-2'
          }`}
        >
          {nearestMeta && nearestStation && !activeStation && (
            <button
              onClick={() => openStation(nearestStation)}
              className={`pointer-events-auto inline-flex items-center gap-2 rounded-xl bg-[#ED9B53] hover:bg-[#DF883D] text-[#1C3529] font-bold shadow-md transition-transform active:scale-95 cursor-pointer max-w-full truncate ${
                isShortLandscape
                  ? 'px-3 py-1 text-[11px]'
                  : 'px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm'
              }`}
            >
              <span className="truncate">
                [E] {language === 'id' ? nearestMeta.nameId : nearestMeta.nameEn} —{' '}
                {language === 'id' ? nearestMeta.actionId : nearestMeta.actionEn}
              </span>
            </button>
          )}

          <div className="pointer-events-auto flex flex-col items-center max-w-full">
            <button
              onClick={() => setShowQuickBar((v) => !v)}
              className={`px-3 rounded-t-lg bg-[#244D3B] text-[#FAF5EA] font-semibold cursor-pointer whitespace-nowrap ${
                isShortLandscape
                  ? 'mb-0.5 py-0.5 text-[10px]'
                  : 'mb-1 py-0.5 text-[11px]'
              }`}
            >
              {showQuickBar
                ? t(language, 'Hide Quick Dock', 'Sembunyikan Pintasan')
                : t(language, 'Show Quick Dock', 'Tampilkan Pintasan')}
            </button>

            {showQuickBar && (
              <div
                data-testid="quick-station-dock"
                className={`flex flex-wrap items-center justify-center rounded-xl bg-[#FAF5EA] border border-[#244D3B]/20 shadow-md max-w-full ${
                  isShortLandscape
                    ? 'gap-1 px-1.5 py-1'
                    : 'gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-2'
                }`}
              >
                {quickStations.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => openStation(st.id)}
                    className={`inline-flex items-center rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      isShortLandscape
                        ? 'gap-1 px-1.5 py-1 text-[10px]'
                        : 'gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs'
                    } ${
                      activeStation === st.id
                        ? 'bg-[#244D3B] text-white'
                        : st.id === 'cashier' && cashierAlertCount > 0
                          ? 'bg-[#ED9B53] text-[#1C3529]'
                          : 'bg-[#F6EBD4] text-[#244D3B] hover:bg-[#D9E8C8]'
                    }`}
                  >
                    {st.icon}
                    <span>{language === 'id' ? st.labelId : st.labelEn}</span>
                    {st.id === 'cashier' && cashierAlertCount > 0 && (
                      <span className="font-mono tabular-nums font-bold">
                        ({cashierAlertCount})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <DailyMissionsModal
        open={showMissionsModal}
        onClose={() => setShowMissionsModal(false)}
      />
    </div>
  );
};
