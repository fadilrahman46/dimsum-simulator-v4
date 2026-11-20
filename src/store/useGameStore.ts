import { create } from 'zustand';
import {
  DEFAULT_STAFF_MORALE,
  DINE_IN_EATING_DURATION_SEC,
  DINE_IN_REVENUE_MULTIPLIER,
  ECONOMY_RULES,
  INITIAL_CAPITAL,
  INITIAL_RECIPES,
  MARKET_EVENTS,
  PACKAGING_PACK_PURCHASE_QTY,
  WELLNESS_SHIFT_INSTANT_BOOST,
  advanceRivalShopState,
  applyDailyEventReputationDelta,
  applyDailyEventRevenue,
  computeStaffMoraleAfterBatch,
  computeStaffMoraleOvernight,
  computeTotalFranchiseDailyIncome,
  createDefaultUpgrades,
  createInitialRivalShop,
  createStarterIngredientLots,
  createStarterPackagingStock,
  doesRecipeMatchFestival,
  evaluateBonusObjectives,
  formatRupiah,
  getCapitalDifficultyConfig,
  getEffectiveHelperQualityBonus,
  getFranchiseBranchTemplate,
  getFranchiseBranchUpgradeCost,
  getIngredientDef,
  getKitchenHelperDef,
  getKitchenHelperTrainCost,
  getOutletTierDef,
  getPackagingDef,
  getRecipeResearchDef,
  getRushHourPhase,
  getStaffMorale,
  getTotalDailyStaffWages,
  getWeeklyFestivalForDay,
  isRushHourWindow,
  pickDailyShopEvent,
} from '../config/gameBalance';
import {
  calculateCustomerSatisfaction,
  generateCustomerFeedback,
  generateDailyPreOrders,
  generateOnlineDeliveryOrder,
  getTrafficMultiplier,
  spawnCustomerAgent,
} from '../domain/customerEngine';
import {
  type DailyMissionEvent,
  applyDailyMissionProgress,
  claimDailyMissionReward,
  generateDailyMissions,
} from '../domain/dailyMissionsEngine';
import {
  appendTransactionIdempotent,
  buildDailyReport,
  calculateSales,
  checkBankruptcy,
} from '../domain/financeEngine';
import {
  consumeIngredientsFEFO,
  expireOldLots,
  getLotWeightGrams,
  getRefrigeratorCapacityGrams,
  getTotalStorageWeightGrams,
} from '../domain/inventoryEngine';
import {
  applyClearanceDiscountToBatch,
  checkDelegationEligibility,
  computeDelegatedCookingPlan,
  evaluateQualityControl,
  getPrepHygieneBonus,
  getSteamerMaxBatchPcs,
  packageProductionBatch,
  packageRecipeBatchesFEFO,
} from '../domain/productionEngine';
import {
  ENDLESS_MASTERY_ACTIVATION_COST,
  canUnlockEndlessMastery,
  computeBusinessLevel,
  evaluateAchievements,
  updateReputationFromSatisfaction,
} from '../domain/progressionEngine';
import { checkRecipeAvailability, getAdjustedPackPrice } from '../domain/recipeEngine';
import { canPurchaseUpgrade } from '../domain/upgradeEngine';
import {
  deleteGameSnapshot,
  loadGameSnapshot,
  saveGameSnapshot,
} from '../persistence/indexedDb';
import {
  applySupplierDealToPackPrice,
  clampTrust,
  createInitialSupplierRelationships,
  getSupplierRelationshipTier,
  normalizeSupplierRelationships,
  recoverSupplierTrustOvernight,
} from '../domain/negotiationEngine';
import {
  canTrainSkillNode,
  computeHelperSkillEffects,
  getSkillNodeById,
  unlockStaffSkillNode,
} from '../domain/staffSkillTree';
import type {
  ActiveCookingSession,
  ActiveDelegatedCooking,
  ActiveSkillTraining,
  ActiveSupplierDeal,
  BusinessProfile,
  CapitalDifficulty,
  CookingScores,
  CustomerAgent,
  CustomerFeedbackPopup,
  DailyEventDef,
  DailyMission,
  DailyReport,
  FinancialTransaction,
  FranchiseBranch,
  GameState,
  IngredientLot,
  KitchenHelperRole,
  KitchenHelperState,
  Language,
  MarketEvent,
  OnlineDeliveryOrder,
  PackagingTypeId,
  PreOrderRequest,
  ProductBatch,
  ProductionBatch,
  RecipeDef,
  RivalShopState,
  SalesOrder,
  SaveSnapshot,
  StaffShiftMode,
  StationId,
  SupplierRelationshipState,
  TutorialStep,
  UpgradeId,
  UpgradeLevels,
  WeeklyFestivalDef,
} from '../types/game';
import { soundFx } from '../utils/audio';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  textEn: string;
  textId: string;
}

interface TodayStats {
  purchases: number;
  pcsProduced: number;
  boxesPackaged: number;
  pcsExpired: number;
  inventoryLossValue: number;
  qcWastedCost?: number;
  customersServed: number;
  customersLost: number;
  satisfactionSum: number;
}

interface GameStoreState {
  initialized: boolean;
  hasSavedGame: boolean;
  gameState: GameState;
  previousGameState: GameState | null;
  language: Language;
  muted: boolean;
  bgmVolume: number;
  sfxVolume: number;

  business: BusinessProfile;
  currentDay: number;
  dayStartCash: number;
  cashBalance: number;
  unpaidDebt: number;

  playerPosition: { x: number; z: number };
  isCarryingProduct: boolean;
  celebratingUntil: number;
  nearestStation: StationId | null;
  activeStation: StationId | null;

  ingredientLots: IngredientLot[];
  packagingStock: Record<PackagingTypeId, number>;
  recipes: RecipeDef[];
  productionBatches: ProductionBatch[];
  productBatches: ProductBatch[];
  activeCooking: ActiveCookingSession | null;
  activeDelegation: ActiveDelegatedCooking | null;

  customers: CustomerAgent[];
  preOrders: PreOrderRequest[];
  onlineOrders: OnlineDeliveryOrder[];
  onlineDeliveryEnabled: boolean;
  onlineSpawnCooldownSec: number;
  rushHourActive: boolean;
  zeroWasteStreakDays: number;
  salesOrders: SalesOrder[];
  transactions: FinancialTransaction[];
  dailyReports: DailyReport[];
  upgrades: UpgradeLevels;
  kitchenStaff: KitchenHelperState[];
  activeSkillTraining: ActiveSkillTraining | null;
  researchedRecipeIds: string[];
  unlockedAchievements: string[];
  tutorialStep: TutorialStep;
  activeMarketEvent: MarketEvent | null;
  activeDailyEvent: DailyEventDef | null;
  activeFestival: WeeklyFestivalDef | null;
  rivalShop: RivalShopState;
  franchiseBranches: FranchiseBranch[];
  endlessMasteryUnlocked: boolean;
  prestigeLevel: number;
  dailyMissions: DailyMission[];
  supplierRelationships: Record<string, SupplierRelationshipState>;
  activeSupplierDeals: Record<string, ActiveSupplierDeal>;
  storeTimeRemainingSec: number;
  spawnCooldownSec: number;
  todayStats: TodayStats;
  toasts: ToastMessage[];
  feedbackPopups: CustomerFeedbackPopup[];

  // Lifecycle & Settings
  initApp: () => Promise<void>;
  goToBusinessSetup: () => void;
  startNewGame: (opts: {
    name: string;
    concept: BusinessProfile['concept'];
    targetMarket: BusinessProfile['targetMarket'];
    difficulty?: CapitalDifficulty;
    enableTutorial: boolean;
  }) => Promise<void>;
  continueSavedGame: () => Promise<void>;
  toggleLanguage: () => void;
  toggleMute: () => void;
  setBgmVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  togglePause: () => void;
  returnToMainMenu: () => void;
  resetGame: () => Promise<void>;
  persistNow: () => Promise<void>;

  // World & Navigation
  setPlayerPosition: (x: number, z: number) => void;
  setNearestStation: (station: StationId | null) => void;
  openStation: (station: StationId) => void;
  closeStation: () => void;
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  pushFeedbackPopup: (popup: CustomerFeedbackPopup) => void;
  dismissFeedbackPopup: (id: string) => void;

  // Market & Recipes
  purchaseMarketCart: (
    ingredientPacks: Record<string, number>,
    packagingPacks: Record<PackagingTypeId, number>,
  ) => { ok: boolean; errorEn?: string; errorId?: string };
  recordNegotiationOutcome: (params: {
    supplier: string;
    outcome: 'ACCEPTED' | 'WALKED_OUT' | 'CANCELLED';
    discountRate: number;
    minPacks: number;
    trustDelta: number;
  }) => void;
  unlockRecipe: (recipeId: string) => { ok: boolean };
  researchRecipe: (
    recipeId: string,
  ) => { ok: boolean; errorEn?: string; errorId?: string };
  createCustomRecipe: (recipe: Omit<RecipeDef, 'id' | 'unlocked' | 'isCustom'>) => void;

  // Cooking & QC & Packaging
  startCookingSession: (
    recipeId: string,
    batchCount: number,
  ) => { ok: boolean; errorEn?: string; errorId?: string };
  startDelegatedCooking: (
    recipeId: string,
    batchCount: number,
  ) => { ok: boolean; errorEn?: string; errorId?: string };
  completeDelegatedCooking: () => void;
  completeCookingStage: (
    stage: ActiveCookingSession['stage'],
    scoreValue: number,
  ) => void;
  cancelCookingSession: () => void;
  acknowledgeQcBatch: (batchId: string) => void;
  discardQcBatch: (batchId: string) => void;
  packageBatch: (
    productionBatchId: string,
    packagingTypeId: PackagingTypeId,
    boxCount: number,
    markup: number,
  ) => { ok: boolean; errorEn?: string; errorId?: string };
  packageRecipePool: (
    recipeId: string,
    packagingTypeId: PackagingTypeId,
    boxCount: number,
    markup: number,
  ) => { ok: boolean; errorEn?: string; errorId?: string };
  updateProductPrice: (productBatchId: string, newPrice: number) => void;
  applyClearanceSale: (
    productBatchId: string,
    discountPct: 0 | 25 | 40,
  ) => { ok: boolean; errorEn?: string; errorId?: string };

  // Store & Customers & Sales
  openStore: () => { ok: boolean; errorEn?: string; errorId?: string };
  tickStoreSimulation: (dtSec: number) => void;
  serveCustomer: (
    customerId: string,
    productBatchId: string,
    discount?: number,
  ) => { ok: boolean; errorEn?: string; errorId?: string };
  dismissCustomer: (customerId: string) => void;
  acceptB2BContract: (
    preOrderId: string,
  ) => { ok: boolean; errorEn?: string; errorId?: string };
  fulfillPreOrder: (
    preOrderId: string,
    productBatchId: string,
  ) => { ok: boolean; errorEn?: string; errorId?: string };
  toggleOnlineDelivery: () => void;
  fulfillOnlineOrder: (
    orderId: string,
    productBatchId: string,
  ) => { ok: boolean; errorEn?: string; errorId?: string };
  closeStoreAndGenerateReport: () => void;

  // Upgrades, Staff, Expansion & Next Day
  purchaseUpgrade: (
    upgradeId: UpgradeId,
  ) => { ok: boolean; errorEn?: string; errorId?: string };
  openFranchiseBranch: (
    templateId: string,
  ) => { ok: boolean; errorEn?: string; errorId?: string };
  upgradeFranchiseBranch: (
    branchId: string,
  ) => { ok: boolean; errorEn?: string; errorId?: string };
  activateEndlessMastery: () => { ok: boolean; errorEn?: string; errorId?: string };
  hireKitchenHelper: (
    helperId: KitchenHelperRole,
  ) => { ok: boolean; errorEn?: string; errorId?: string };
  trainKitchenHelper: (
    helperId: KitchenHelperRole,
  ) => { ok: boolean; errorEn?: string; errorId?: string };
  startStaffSkillTraining: (
    helperId: KitchenHelperRole,
    nodeId: string,
  ) => { ok: boolean; errorEn?: string; errorId?: string };
  cancelStaffSkillTraining: () => void;
  completeStaffSkillTraining: () => void;
  setKitchenHelperShift: (helperId: KitchenHelperRole, shift: StaffShiftMode) => void;
  fireKitchenHelper: (helperId: KitchenHelperRole) => void;
  repayDebt: (amount?: number) => { ok: boolean; errorEn?: string; errorId?: string };
  trackDailyMissionProgress: (
    event: DailyMissionEvent,
  ) => { newlyRewarded: DailyMission[]; bonusGranted: number };
  claimDailyMission: (missionId: string) => { ok: boolean; rewardCash?: number };
  claimAllDailyMissions: () => { ok: boolean; totalRewardCash: number; claimedCount: number };
  advanceToNextDay: () => void;
  skipTutorial: () => void;
}

const DEFAULT_BUSINESS: BusinessProfile = {
  id: 'biz-default',
  name: 'Warung Dimsum Sehat',
  concept: 'balanced',
  targetMarket: 'general',
  level: 1,
  reputation: 60,
  createdAt: Date.now(),
};

const EMPTY_TODAY_STATS: TodayStats = {
  purchases: 0,
  pcsProduced: 0,
  boxesPackaged: 0,
  pcsExpired: 0,
  inventoryLossValue: 0,
  qcWastedCost: 0,
  customersServed: 0,
  customersLost: 0,
  satisfactionSum: 0,
};

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function pickDailyMarketEvent(day: number): MarketEvent | null {
  if (day <= 1) return MARKET_EVENTS[0]; // Day 1 friendly veggie promo
  if (Math.random() < 0.65) {
    return MARKET_EVENTS[Math.floor(Math.random() * MARKET_EVENTS.length)];
  }
  return null;
}

function applyBonusObjectiveRewards(params: {
  businessLevel: number;
  currentDay: number;
  todayCustomersServed: number;
  todayPcsProduced: number;
  totalCustomersServed: number;
  transactions: FinancialTransaction[];
}): {
  cashDelta: number;
  updatedTransactions: FinancialTransaction[];
  newlyClaimed: Array<{ titleEn: string; titleId: string; rewardCash: number }>;
} {
  const objectives = evaluateBonusObjectives(params);
  let nextTxs = params.transactions;
  let cashDelta = 0;
  const newlyClaimed: Array<{ titleEn: string; titleId: string; rewardCash: number }> = [];

  for (const obj of objectives) {
    if (!obj.completed) continue;
    const alreadyPaid = nextTxs.some(
      (tx) => tx.category === 'GOAL_BONUS' && tx.referenceId === obj.referenceId,
    );
    if (alreadyPaid) continue;

    nextTxs = appendTransactionIdempotent(nextTxs, {
      id: makeId('tx'),
      type: 'INCOME',
      category: 'GOAL_BONUS',
      amount: obj.rewardCash,
      descriptionEn: `Bonus Objective: ${obj.titleEn}`,
      descriptionId: `Target Bonus: ${obj.titleId}`,
      referenceId: obj.referenceId,
      day: params.currentDay,
      timestamp: Date.now(),
    });
    cashDelta += obj.rewardCash;
    newlyClaimed.push({
      titleEn: obj.titleEn,
      titleId: obj.titleId,
      rewardCash: obj.rewardCash,
    });
  }

  return { cashDelta, updatedTransactions: nextTxs, newlyClaimed };
}

function applyDailyMissionRewards(params: {
  dailyMissions: DailyMission[];
  event?: DailyMissionEvent;
  currentDay: number;
  transactions: FinancialTransaction[];
}): {
  updatedMissions: DailyMission[];
  cashDelta: number;
  updatedTransactions: FinancialTransaction[];
  newlyRewarded: DailyMission[];
} {
  const progressedMissions = params.event
    ? applyDailyMissionProgress(params.dailyMissions, params.event).missions
    : params.dailyMissions;

  let nextTxs = params.transactions;
  let cashDelta = 0;
  const newlyRewarded: DailyMission[] = [];

  const updatedMissions = progressedMissions.map((mission) => {
    if (!mission.completed || mission.claimed) {
      return mission;
    }

    const refId = `daily-mission-day-${params.currentDay}-${mission.id}`;
    const alreadyPaid = nextTxs.some(
      (tx) => tx.category === 'GOAL_BONUS' && tx.referenceId === refId,
    );

    const rewardedMission: DailyMission = {
      ...mission,
      claimed: true,
    };

    if (!alreadyPaid) {
      nextTxs = appendTransactionIdempotent(nextTxs, {
        id: makeId('tx'),
        type: 'INCOME',
        category: 'GOAL_BONUS',
        amount: mission.rewardCash,
        descriptionEn: `Daily Mission Bonus: ${mission.titleEn}`,
        descriptionId: `Bonus Misi Harian: ${mission.titleId}`,
        referenceId: refId,
        day: params.currentDay,
        timestamp: Date.now(),
      });
      cashDelta += mission.rewardCash;
      newlyRewarded.push(rewardedMission);
    }

    return rewardedMission;
  });

  return {
    updatedMissions,
    cashDelta,
    updatedTransactions: nextTxs,
    newlyRewarded,
  };
}

function evaluateStoreAchievements(
  s: GameStoreState,
  overrides: Partial<{
    productionBatches: ProductionBatch[];
    salesOrders: SalesOrder[];
    dailyReports: DailyReport[];
    upgrades: UpgradeLevels;
    recipes: RecipeDef[];
    researchedRecipeIds: string[];
    kitchenStaff: KitchenHelperState[];
    business: BusinessProfile;
    unpaidDebt: number;
    zeroWasteStreakDays: number;
    currentDay: number;
  }> = {},
): string[] {
  return evaluateAchievements({
    unlocked: s.unlockedAchievements,
    productionBatches: overrides.productionBatches ?? s.productionBatches,
    salesOrders: overrides.salesOrders ?? s.salesOrders,
    dailyReports: overrides.dailyReports ?? s.dailyReports,
    upgrades: overrides.upgrades ?? s.upgrades,
    recipes: overrides.recipes ?? s.recipes,
    researchedRecipeIds: overrides.researchedRecipeIds ?? s.researchedRecipeIds,
    kitchenStaff: overrides.kitchenStaff ?? s.kitchenStaff,
    business: overrides.business ?? s.business,
    unpaidDebt: overrides.unpaidDebt ?? s.unpaidDebt,
    zeroWasteStreakDays: overrides.zeroWasteStreakDays ?? s.zeroWasteStreakDays,
    currentDay: overrides.currentDay ?? s.currentDay,
  });
}

function buildSnapshotFromState(state: GameStoreState): SaveSnapshot {
  return {
    version: 1,
    savedAt: Date.now(),
    gameState:
      state.gameState === 'GAME_PAUSED'
        ? state.previousGameState ?? 'MORNING_PREP'
        : state.gameState,
    language: state.language,
    muted: state.muted,
    bgmVolume: state.bgmVolume,
    sfxVolume: state.sfxVolume,
    business: state.business,
    currentDay: state.currentDay,
    dayStartCash: state.dayStartCash,
    cashBalance: state.cashBalance,
    playerPosition: state.playerPosition,
    ingredientLots: state.ingredientLots,
    packagingStock: state.packagingStock,
    recipes: state.recipes,
    productionBatches: state.productionBatches,
    productBatches: state.productBatches,
    preOrders: state.preOrders,
    onlineOrders: state.onlineOrders,
    onlineDeliveryEnabled: state.onlineDeliveryEnabled,
    zeroWasteStreakDays: state.zeroWasteStreakDays,
    salesOrders: state.salesOrders,
    transactions: state.transactions,
    dailyReports: state.dailyReports,
    upgrades: state.upgrades,
    kitchenStaff: state.kitchenStaff,
    activeSkillTraining: state.activeSkillTraining,
    activeDelegation: state.activeDelegation,
    unpaidDebt: state.unpaidDebt,
    researchedRecipeIds: state.researchedRecipeIds,
    unlockedAchievements: state.unlockedAchievements,
    tutorialStep: state.tutorialStep,
    activeMarketEvent: state.activeMarketEvent,
    activeDailyEvent: state.activeDailyEvent,
    activeFestival: state.activeFestival,
    rivalShop: state.rivalShop,
    franchiseBranches: state.franchiseBranches,
    endlessMasteryUnlocked: state.endlessMasteryUnlocked,
    prestigeLevel: state.prestigeLevel,
    dailyMissions: state.dailyMissions,
    supplierRelationships: state.supplierRelationships,
    activeSupplierDeals: state.activeSupplierDeals,
    storeTimeRemainingSec: state.storeTimeRemainingSec,
    todayStats: state.todayStats,
  };
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  initialized: false,
  hasSavedGame: false,
  gameState: 'MAIN_MENU',
  previousGameState: null,
  language: 'en',
  muted: false,
  bgmVolume: 0.45,
  sfxVolume: 0.75,

  business: DEFAULT_BUSINESS,
  currentDay: 1,
  dayStartCash: INITIAL_CAPITAL.cashReserve,
  cashBalance: INITIAL_CAPITAL.cashReserve,
  unpaidDebt: 0,

  playerPosition: { x: 0, z: 1.5 },
  isCarryingProduct: false,
  celebratingUntil: 0,
  nearestStation: null,
  activeStation: null,

  ingredientLots: createStarterIngredientLots(1),
  packagingStock: createStarterPackagingStock(),
  recipes: INITIAL_RECIPES,
  productionBatches: [],
  productBatches: [],
  activeCooking: null,
  activeDelegation: null,

  customers: [],
  preOrders: [],
  onlineOrders: [],
  onlineDeliveryEnabled: true,
  onlineSpawnCooldownSec: 6,
  rushHourActive: false,
  zeroWasteStreakDays: 0,
  salesOrders: [],
  transactions: [],
  dailyReports: [],
  upgrades: createDefaultUpgrades(),
  kitchenStaff: [],
  activeSkillTraining: null,
  researchedRecipeIds: [],
  unlockedAchievements: [],
  tutorialStep: 'NONE',
  activeMarketEvent: null,
  activeDailyEvent: null,
  activeFestival: null,
  rivalShop: createInitialRivalShop(),
  franchiseBranches: [],
  endlessMasteryUnlocked: false,
  prestigeLevel: 0,
  dailyMissions: [],
  supplierRelationships: createInitialSupplierRelationships(),
  activeSupplierDeals: {},
  storeTimeRemainingSec: ECONOMY_RULES.storeOpenDurationSec,
  spawnCooldownSec: 2,
  todayStats: { ...EMPTY_TODAY_STATS },
  toasts: [],
  feedbackPopups: [],

  initApp: async () => {
    const saved = await loadGameSnapshot();
    const bgmVol = saved?.bgmVolume ?? 0.45;
    const sfxVol = saved?.sfxVolume ?? 0.75;
    soundFx.setBgmVolume(bgmVol);
    soundFx.setSfxVolume(sfxVol);
    if (saved) {
      soundFx.setMuted(saved.muted);
    }
    set({
      initialized: true,
      hasSavedGame: Boolean(saved),
      language: saved?.language ?? 'en',
      muted: saved?.muted ?? false,
      bgmVolume: bgmVol,
      sfxVolume: sfxVol,
    });
  },

  goToBusinessSetup: () => {
    soundFx.playClick();
    set({ gameState: 'BUSINESS_SETUP' });
  },

  startNewGame: async ({ name, concept, targetMarket, difficulty = 'easy', enableTutorial }) => {
    soundFx.playSuccess();
    soundFx.startBgm();
    soundFx.setSteamAmbience(false);
    const trimmedName = name.trim() || 'Dimsum Sehat Kitchen';
    const day1Event = pickDailyShopEvent(1);
    const day1Reputation = Math.max(
      10,
      Math.min(100, 60 + day1Event.reputationOnStart),
    );
    const capitalCfg = getCapitalDifficultyConfig(difficulty);
    const business: BusinessProfile = {
      id: makeId('biz'),
      name: trimmedName,
      concept,
      targetMarket,
      difficulty,
      level: 1,
      reputation: day1Reputation,
      createdAt: Date.now(),
    };

    const starterRecipes = INITIAL_RECIPES.map((r) =>
      concept === 'vegetarian' && r.id === 'rainbow_veggie'
        ? { ...r, unlocked: true }
        : { ...r },
    );

    const initialTx: FinancialTransaction = {
      id: makeId('tx'),
      type: 'INCOME',
      category: 'INITIAL_CAPITAL',
      amount: capitalCfg.cashReserve,
      descriptionEn: `Initial liquid cash reserve from ${formatRupiah(capitalCfg.total)} startup capital (${capitalCfg.labelEn})`,
      descriptionId: `Cadangan kas awal dari modal ${formatRupiah(capitalCfg.total)} (${capitalCfg.labelId})`,
      referenceId: `${business.id}-init`,
      day: 1,
      timestamp: Date.now(),
    };

    const nextState: Partial<GameStoreState> = {
      hasSavedGame: true,
      gameState: 'MORNING_PREP',
      previousGameState: null,
      business,
      currentDay: 1,
      dayStartCash: capitalCfg.cashReserve,
      cashBalance: capitalCfg.cashReserve,
      unpaidDebt: 0,
      playerPosition: { x: 0, z: 1.4 },
      isCarryingProduct: false,
      celebratingUntil: 0,
      nearestStation: null,
      activeStation: null,
      ingredientLots: createStarterIngredientLots(1, difficulty),
      packagingStock: createStarterPackagingStock(difficulty),
      recipes: starterRecipes,
      productionBatches: [],
      productBatches: [],
      activeCooking: null,
      activeDelegation: null,
      customers: [],
      preOrders: generateDailyPreOrders(1, starterRecipes, day1Reputation),
      onlineOrders: [],
      onlineDeliveryEnabled: true,
      onlineSpawnCooldownSec: 6,
      rushHourActive: false,
      zeroWasteStreakDays: 0,
      salesOrders: [],
      transactions: [initialTx],
      dailyReports: [],
      upgrades: createDefaultUpgrades(),
      kitchenStaff: [],
      activeSkillTraining: null,
      researchedRecipeIds: [],
      unlockedAchievements: [],
      tutorialStep: enableTutorial ? 'BUY_INGREDIENTS' : 'NONE',
      activeMarketEvent: pickDailyMarketEvent(1),
      activeDailyEvent: day1Event,
      activeFestival: getWeeklyFestivalForDay(1),
      rivalShop: createInitialRivalShop(),
      franchiseBranches: [],
      endlessMasteryUnlocked: false,
      prestigeLevel: 0,
      dailyMissions: generateDailyMissions({
        day: 1,
        businessLevel: 1,
        recipes: starterRecipes,
        upgrades: createDefaultUpgrades(),
      }),
      supplierRelationships: createInitialSupplierRelationships(),
      activeSupplierDeals: {},
      storeTimeRemainingSec: ECONOMY_RULES.storeOpenDurationSec,
      spawnCooldownSec: 2,
      todayStats: { ...EMPTY_TODAY_STATS },
      toasts: [],
      feedbackPopups: [],
    };

    set(nextState);
    await saveGameSnapshot(buildSnapshotFromState(get()));
  },

  continueSavedGame: async () => {
    const saved = await loadGameSnapshot();
    if (!saved) return;
    const bgmVol = saved.bgmVolume ?? 0.45;
    const sfxVol = saved.sfxVolume ?? 0.75;
    soundFx.setBgmVolume(bgmVol);
    soundFx.setSfxVolume(sfxVol);
    soundFx.setMuted(saved.muted);
    soundFx.startBgm();
    soundFx.setSteamAmbience(false);
    soundFx.playClick();

    const restoredGameState: GameState =
      saved.gameState === 'MAIN_MENU' || saved.gameState === 'BUSINESS_SETUP'
        ? 'MORNING_PREP'
        : saved.gameState;

    const hasSellable = saved.productBatches.some(
      (b) => b.status === 'PACKAGED' && b.boxesAvailable > 0,
    );

    const savedRecipeIds = new Set(saved.recipes.map((r) => r.id));
    const mergedRecipes = [
      ...saved.recipes,
      ...INITIAL_RECIPES.filter((r) => !savedRecipeIds.has(r.id)).map((r) => ({ ...r })),
    ];

    const baseDailyMissions =
      Array.isArray(saved.dailyMissions) && saved.dailyMissions.length > 0
        ? saved.dailyMissions
        : generateDailyMissions({
            day: saved.currentDay,
            businessLevel: saved.business.level,
            recipes: mergedRecipes,
            upgrades: { ...createDefaultUpgrades(), ...(saved.upgrades ?? {}) },
          });

    const settledMissions = applyDailyMissionRewards({
      dailyMissions: baseDailyMissions,
      currentDay: saved.currentDay,
      transactions: saved.transactions,
    });

    set({
      hasSavedGame: true,
      gameState: restoredGameState,
      previousGameState: null,
      language: saved.language,
      muted: saved.muted,
      bgmVolume: bgmVol,
      sfxVolume: sfxVol,
      business: saved.business,
      currentDay: saved.currentDay,
      dayStartCash: saved.dayStartCash,
      cashBalance: saved.cashBalance + settledMissions.cashDelta,
      unpaidDebt: saved.unpaidDebt ?? 0,
      playerPosition: saved.playerPosition,
      isCarryingProduct: hasSellable,
      activeStation: null,
      ingredientLots: saved.ingredientLots,
      packagingStock: saved.packagingStock,
      recipes: mergedRecipes,
      productionBatches: saved.productionBatches,
      productBatches: saved.productBatches,
      activeCooking: null,
      activeDelegation: saved.activeDelegation ?? null,
      customers: [],
      preOrders: saved.preOrders,
      onlineOrders: saved.onlineOrders ?? [],
      onlineDeliveryEnabled: saved.onlineDeliveryEnabled ?? true,
      onlineSpawnCooldownSec: 6,
      rushHourActive: isRushHourWindow(saved.storeTimeRemainingSec),
      zeroWasteStreakDays: saved.zeroWasteStreakDays ?? 0,
      salesOrders: saved.salesOrders,
      transactions: settledMissions.updatedTransactions,
      dailyReports: saved.dailyReports,
      upgrades: { ...createDefaultUpgrades(), ...(saved.upgrades ?? {}) },
      kitchenStaff: (saved.kitchenStaff ?? []).map((h) => ({
        ...h,
        morale: getStaffMorale(h),
        shift: h.shift ?? 'kitchen',
        consecutiveWorkBatches: h.consecutiveWorkBatches ?? 0,
        unlockedSkills: h.unlockedSkills ?? [],
        totalTrainingSec: h.totalTrainingSec ?? 0,
      })),
      activeSkillTraining: saved.activeSkillTraining ?? null,
      researchedRecipeIds:
        saved.researchedRecipeIds ??
        mergedRecipes.filter((r) => r.researched).map((r) => r.id),
      unlockedAchievements: saved.unlockedAchievements,
      tutorialStep: saved.tutorialStep,
      activeMarketEvent: saved.activeMarketEvent,
      activeDailyEvent: saved.activeDailyEvent ?? null,
      activeFestival:
        saved.activeFestival !== undefined
          ? saved.activeFestival
          : getWeeklyFestivalForDay(saved.currentDay),
      rivalShop: saved.rivalShop ?? createInitialRivalShop(),
      franchiseBranches: saved.franchiseBranches ?? [],
      endlessMasteryUnlocked: Boolean(saved.endlessMasteryUnlocked),
      prestigeLevel: saved.prestigeLevel ?? 0,
      dailyMissions: settledMissions.updatedMissions,
      supplierRelationships: normalizeSupplierRelationships(saved.supplierRelationships),
      activeSupplierDeals: saved.activeSupplierDeals ?? {},
      storeTimeRemainingSec: saved.storeTimeRemainingSec,
      todayStats: { ...EMPTY_TODAY_STATS, ...saved.todayStats },
      feedbackPopups: [],
    });
  },

  toggleLanguage: () => {
    soundFx.playClick();
    set((s) => ({ language: s.language === 'en' ? 'id' : 'en' }));
    get().persistNow();
  },

  toggleMute: () => {
    const nextMuted = !get().muted;
    soundFx.setMuted(nextMuted);
    if (!nextMuted) {
      soundFx.playClick();
      if (
        get().gameState !== 'MAIN_MENU' &&
        get().gameState !== 'BUSINESS_SETUP'
      ) {
        soundFx.startBgm();
      }
      if (get().activeCooking?.stage === 'STEAM' && get().gameState !== 'GAME_PAUSED') {
        soundFx.setSteamAmbience(true, 0.68);
      }
    } else {
      soundFx.setSteamAmbience(false);
    }
    set({ muted: nextMuted });
    get().persistNow();
  },

  setBgmVolume: (volume) => {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0.45));
    soundFx.setBgmVolume(clamped);
    if (
      clamped > 0 &&
      !get().muted &&
      get().gameState !== 'MAIN_MENU' &&
      get().gameState !== 'BUSINESS_SETUP'
    ) {
      soundFx.startBgm();
    }
    set({ bgmVolume: clamped });
    get().persistNow();
  },

  setSfxVolume: (volume) => {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0.75));
    soundFx.setSfxVolume(clamped);
    set({ sfxVolume: clamped });
    get().persistNow();
  },

  togglePause: () => {
    const s = get();
    if (s.gameState === 'MAIN_MENU' || s.gameState === 'BUSINESS_SETUP' || s.gameState === 'GAME_OVER') {
      return;
    }
    soundFx.playClick();
    if (s.gameState === 'GAME_PAUSED') {
      if (s.activeCooking?.stage === 'STEAM' && !s.muted) {
        soundFx.setSteamAmbience(true, 0.68);
      }
      set({
        gameState: s.previousGameState ?? 'MORNING_PREP',
        previousGameState: null,
      });
    } else {
      soundFx.setSteamAmbience(false);
      set({
        previousGameState: s.gameState,
        gameState: 'GAME_PAUSED',
      });
    }
  },

  returnToMainMenu: () => {
    soundFx.playClick();
    soundFx.stopBgm();
    soundFx.setSteamAmbience(false);
    get().persistNow();
    set({
      gameState: 'MAIN_MENU',
      previousGameState: null,
      activeStation: null,
      activeCooking: null,
      activeDelegation: null,
      customers: [],
    });
  },

  resetGame: async () => {
    await deleteGameSnapshot();
    soundFx.stopBgm();
    soundFx.setSteamAmbience(false);
    soundFx.playClick();
    set({
      hasSavedGame: false,
      gameState: 'MAIN_MENU',
      previousGameState: null,
      activeStation: null,
      activeCooking: null,
      activeDelegation: null,
      customers: [],
      dailyMissions: [],
    });
  },

  persistNow: async () => {
    const s = get();
    if (s.gameState === 'MAIN_MENU' || s.gameState === 'BUSINESS_SETUP') return;
    await saveGameSnapshot(buildSnapshotFromState(s));
  },

  setPlayerPosition: (x, z) => {
    set({ playerPosition: { x, z } });
  },

  setNearestStation: (station) => {
    if (get().nearestStation !== station) {
      set({ nearestStation: station });
    }
  },

  openStation: (station) => {
    const s = get();
    if (s.gameState === 'GAME_PAUSED' || s.gameState === 'GAME_OVER' || s.gameState === 'MAIN_MENU') {
      return;
    }
    soundFx.playClick();

    // If an active cooking session exists and player opens mixing/wrapping/steamer, keep them in PRODUCTION
    let nextState: GameState = s.gameState;
    if (s.gameState !== 'STORE_OPEN' && s.gameState !== 'CUSTOMER_SERVICE') {
      if (station === 'market') nextState = 'SHOPPING';
      else if (station === 'prep' || station === 'mixing' || station === 'wrapping') {
        nextState = 'PRODUCTION';
      } else if (station === 'steamer') {
        nextState = s.activeCooking ? 'PRODUCTION' : 'QUALITY_CONTROL';
      } else if (station === 'packaging') {
        nextState = 'PACKAGING';
      } else if (station === 'board') {
        nextState = 'FINANCIAL_REPORT';
      } else {
        nextState = 'MORNING_PREP';
      }
    }

    set({
      activeStation: station,
      gameState: nextState,
    });
  },

  closeStation: () => {
    const s = get();
    soundFx.playClick();
    const isStoreActive =
      s.gameState === 'STORE_OPEN' ||
      s.gameState === 'CUSTOMER_SERVICE' ||
      s.customers.length > 0;

    set({
      activeStation: null,
      gameState: isStoreActive ? 'STORE_OPEN' : 'MORNING_PREP',
    });
  },

  pushToast: (toast) => {
    const id = makeId('toast');
    set((s) => ({
      toasts: [...s.toasts.slice(-3), { ...toast, id }],
    }));
    setTimeout(() => {
      get().dismissToast(id);
    }, 4200);
  },

  dismissToast: (id) => {
    set((s) => ({
      toasts: s.toasts.filter((t) => t.id !== id),
    }));
  },

  pushFeedbackPopup: (popup) => {
    set((s) => ({
      feedbackPopups: [...s.feedbackPopups.slice(-2), popup],
    }));
    setTimeout(() => {
      get().dismissFeedbackPopup(popup.id);
    }, 6500);
  },

  dismissFeedbackPopup: (id) => {
    set((s) => ({
      feedbackPopups: s.feedbackPopups.filter((f) => f.id !== id),
    }));
  },

  purchaseMarketCart: (ingredientPacks, packagingPacks) => {
    const s = get();
    let totalCost = 0;
    let addedWeightGrams = 0;
    const newLots: IngredientLot[] = [];
    const nextPkg = { ...s.packagingStock };

    // Count packs per supplier so negotiated bulk deals validate against minimum pack count
    const supplierPackCounts: Record<string, number> = {};
    for (const [ingId, packCount] of Object.entries(ingredientPacks)) {
      if (packCount <= 0) continue;
      const def = getIngredientDef(ingId);
      if (!def) continue;
      supplierPackCounts[def.supplier] = (supplierPackCounts[def.supplier] ?? 0) + packCount;
    }

    const usedDealSuppliers = new Set<string>();
    const purchasedSuppliers = new Set<string>();

    for (const [ingId, packCount] of Object.entries(ingredientPacks)) {
      if (packCount <= 0) continue;
      const def = getIngredientDef(ingId);
      if (!def) continue;
      purchasedSuppliers.add(def.supplier);
      const rel = s.supplierRelationships[def.supplier];
      const baseAdjPrice = getAdjustedPackPrice(
        ingId,
        s.activeMarketEvent,
        rel?.trust,
        s.rivalShop.focusIngredientIds,
        s.rivalShop.pricePressureMultiplier,
      );
      const activeDeal = s.activeSupplierDeals[def.supplier];
      const dealValid =
        activeDeal &&
        activeDeal.day === s.currentDay &&
        (supplierPackCounts[def.supplier] ?? 0) >= activeDeal.minPacks;

      const packPrice = dealValid
        ? applySupplierDealToPackPrice(baseAdjPrice, activeDeal.discountRate)
        : baseAdjPrice;

      if (dealValid) {
        usedDealSuppliers.add(def.supplier);
      }

      const lineTotal = packCount * packPrice;
      const totalQty = packCount * def.packSize;
      totalCost += lineTotal;

      const lot: IngredientLot = {
        id: makeId(`lot-${ingId}`),
        ingredientId: ingId,
        quantityRemaining: totalQty,
        initialQuantity: totalQty,
        unitCostPerBaseUnit: lineTotal / totalQty,
        totalLotCost: lineTotal,
        purchasedDay: s.currentDay,
        expiryDay: s.currentDay + def.shelfLifeDays,
        quality: 94,
      };
      addedWeightGrams += getLotWeightGrams(lot);
      newLots.push(lot);
    }

    let packagingSpend = 0;
    for (const [pkgId, packCount] of Object.entries(packagingPacks) as Array<
      [PackagingTypeId, number]
    >) {
      if (packCount <= 0) continue;
      const pkgDef = getPackagingDef(pkgId);
      const boxesAdded = packCount * PACKAGING_PACK_PURCHASE_QTY;
      const lineCost = boxesAdded * pkgDef.costPerBox;
      packagingSpend += lineCost;
      totalCost += lineCost;
      nextPkg[pkgId] = (nextPkg[pkgId] ?? 0) + boxesAdded;
    }

    if (totalCost <= 0) {
      return {
        ok: false,
        errorEn: 'Your cart is empty.',
        errorId: 'Keranjang belanja masih kosong.',
      };
    }

    if (totalCost > s.cashBalance) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: 'Insufficient cash balance for this purchase.',
        errorId: 'Saldo kas tidak mencukupi untuk pembelian ini.',
      };
    }

    const currentWeight = getTotalStorageWeightGrams(s.ingredientLots, s.currentDay);
    const maxCap = getRefrigeratorCapacityGrams(s.upgrades);
    if (currentWeight + addedWeightGrams > maxCap) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: 'Cold storage capacity exceeded. Upgrade your Refrigerator or buy less.',
        errorId: 'Kapasitas kulkas penuh. Upgrade Kulkas atau kurangi belanja.',
      };
    }

    const purchaseRef = makeId('purchase');
    let nextTxs = [...s.transactions];
    const ingSpend = totalCost - packagingSpend;

    if (ingSpend > 0) {
      nextTxs = appendTransactionIdempotent(nextTxs, {
        id: makeId('tx'),
        type: 'EXPENSE',
        category: 'INGREDIENT_PURCHASE',
        amount: ingSpend,
        descriptionEn:
          usedDealSuppliers.size > 0
            ? `Purchased fresh ingredients (Bulk deal applied)`
            : `Purchased fresh ingredient packs`,
        descriptionId:
          usedDealSuppliers.size > 0
            ? `Pembelian bahan segar (Diskon grosir aktif)`
            : `Pembelian paket bahan segar`,
        referenceId: `${purchaseRef}-ing`,
        day: s.currentDay,
        timestamp: Date.now(),
      });
    }

    if (packagingSpend > 0) {
      nextTxs = appendTransactionIdempotent(nextTxs, {
        id: makeId('tx'),
        type: 'EXPENSE',
        category: 'PACKAGING_PURCHASE',
        amount: packagingSpend,
        descriptionEn: `Purchased dimsum packaging boxes`,
        descriptionId: `Pembelian kotak kemasan dimsum`,
        referenceId: `${purchaseRef}-pkg`,
        day: s.currentDay,
        timestamp: Date.now(),
      });
    }

    // Standard purchases build modest supplier goodwill; consume used bulk deals
    const nextRelationships = { ...s.supplierRelationships };
    for (const sup of purchasedSuppliers) {
      const existing = nextRelationships[sup];
      if (!existing) continue;
      if (!usedDealSuppliers.has(sup)) {
        nextRelationships[sup] = {
          ...existing,
          trust: clampTrust(existing.trust + 2),
        };
      }
    }

    const nextDeals = { ...s.activeSupplierDeals };
    for (const sup of usedDealSuppliers) {
      delete nextDeals[sup];
    }

    soundFx.playCashier();
    const nextTutorial: TutorialStep =
      s.tutorialStep === 'BUY_INGREDIENTS' ? 'COOK_BATCH' : s.tutorialStep;

    set({
      cashBalance: s.cashBalance - totalCost,
      ingredientLots: [...s.ingredientLots, ...newLots],
      packagingStock: nextPkg,
      transactions: nextTxs,
      supplierRelationships: nextRelationships,
      activeSupplierDeals: nextDeals,
      tutorialStep: nextTutorial,
      todayStats: {
        ...s.todayStats,
        purchases: s.todayStats.purchases + totalCost,
      },
    });

    get().pushToast({
      type: 'success',
      textEn:
        usedDealSuppliers.size > 0
          ? 'Bulk deal supplies stocked into cold storage!'
          : 'Supplies stocked into cold storage!',
      textId:
        usedDealSuppliers.size > 0
          ? 'Bahan diskon grosir berhasil masuk ke kulkas!'
          : 'Stok bahan & kemasan berhasil ditambahkan!',
    });
    get().persistNow();
    return { ok: true };
  },

  recordNegotiationOutcome: ({
    supplier,
    outcome,
    discountRate,
    minPacks,
    trustDelta,
  }) => {
    const s = get();
    const existing = s.supplierRelationships[supplier] ?? {
      supplier,
      trust: 65,
      negotiatedCount: 0,
      walkoutCount: 0,
    };
    const nextTrust = clampTrust(existing.trust + trustDelta);
    const nextRelationships: Record<string, SupplierRelationshipState> = {
      ...s.supplierRelationships,
      [supplier]: {
        ...existing,
        trust: nextTrust,
        negotiatedCount:
          outcome === 'ACCEPTED' ? existing.negotiatedCount + 1 : existing.negotiatedCount,
        walkoutCount:
          outcome === 'WALKED_OUT' ? existing.walkoutCount + 1 : existing.walkoutCount,
        lastNegotiatedDay: s.currentDay,
      },
    };

    const nextDeals = { ...s.activeSupplierDeals };
    if (outcome === 'ACCEPTED' && discountRate > 0) {
      nextDeals[supplier] = {
        supplier,
        discountRate,
        minPacks,
        day: s.currentDay,
      };
    }

    set({
      supplierRelationships: nextRelationships,
      activeSupplierDeals: nextDeals,
    });

    if (outcome === 'ACCEPTED') {
      const pct = Math.round(discountRate * 100);
      soundFx.playSuccess();
      get().pushToast({
        type: 'success',
        textEn: `${supplier} agreed to ${pct}% bulk discount (${minPacks}+ packs).`,
        textId: `${supplier} menyetujui diskon grosir ${pct}% (${minPacks}+ kemasan).`,
      });
    } else if (outcome === 'WALKED_OUT') {
      soundFx.playError();
      const strained = getSupplierRelationshipTier(nextTrust) === 'strained';
      get().pushToast({
        type: 'warning',
        textEn: strained
          ? `${supplier} walked out! Relationship is Strained (+10% surcharge).`
          : `${supplier} walked out! Relationship trust dropped to ${nextTrust}/100.`,
        textId: strained
          ? `${supplier} membatalkan tawar-menawar! Hubungan Tegang (+10% harga).`
          : `${supplier} membatalkan tawar-menawar! Kepercayaan turun ke ${nextTrust}/100.`,
      });
    }
    get().persistNow();
  },

  unlockRecipe: (recipeId) => {
    const s = get();
    const target = s.recipes.find((r) => r.id === recipeId);
    if (!target || target.unlocked) return { ok: false };
    const cost = target.unlockCost ?? 35_000;
    if (s.cashBalance < cost) {
      soundFx.playError();
      return { ok: false };
    }

    const nextTxs = appendTransactionIdempotent(s.transactions, {
      id: makeId('tx'),
      type: 'EXPENSE',
      category: 'RECIPE_UNLOCK',
      amount: cost,
      descriptionEn: `Unlocked recipe: ${target.nameEn}`,
      descriptionId: `Buka resep: ${target.nameId}`,
      referenceId: `unlock-${recipeId}`,
      day: s.currentDay,
      timestamp: Date.now(),
    });

    const nextRecipes = s.recipes.map((r) =>
      r.id === recipeId ? { ...r, unlocked: true } : r,
    );
    const nextAchievements = evaluateStoreAchievements(s, {
      recipes: nextRecipes,
    });

    soundFx.playSuccess();
    set({
      cashBalance: s.cashBalance - cost,
      recipes: nextRecipes,
      transactions: nextTxs,
      unlockedAchievements: nextAchievements,
    });
    get().persistNow();
    return { ok: true };
  },

  researchRecipe: (recipeId) => {
    const s = get();
    const target = s.recipes.find((r) => r.id === recipeId);
    const researchDef = getRecipeResearchDef(recipeId);
    if (!target || !researchDef) {
      return {
        ok: false,
        errorEn: 'No research upgrade available for this recipe.',
        errorId: 'Riset belum tersedia untuk resep ini.',
      };
    }
    if (!target.unlocked) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: 'Unlock this dish before researching a healthier formula.',
        errorId: 'Buka resep ini terlebih dahulu sebelum meriset formulanya.',
      };
    }
    if (target.researched || s.researchedRecipeIds.includes(recipeId)) {
      return {
        ok: false,
        errorEn: 'This recipe formula has already been researched.',
        errorId: 'Formula resep ini sudah selesai diriset.',
      };
    }
    if (s.cashBalance < researchDef.researchCost) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: 'Insufficient cash balance to fund this research.',
        errorId: 'Saldo kas belum mencukupi untuk mendanai riset ini.',
      };
    }

    const nextTxs = appendTransactionIdempotent(s.transactions, {
      id: makeId('tx'),
      type: 'EXPENSE',
      category: 'RECIPE_RESEARCH',
      amount: researchDef.researchCost,
      descriptionEn: `Recipe R&D: ${researchDef.formulaNameEn} (${target.nameEn})`,
      descriptionId: `Riset Resep: ${researchDef.formulaNameId} (${target.nameId})`,
      referenceId: `research-${recipeId}`,
      day: s.currentDay,
      timestamp: Date.now(),
    });

    const nextResearchedIds = [...s.researchedRecipeIds, recipeId];
    const nextRecipes = s.recipes.map((r) =>
      r.id === recipeId
        ? {
            ...r,
            researched: true,
            baseQuality: researchDef.newBaseQuality,
            productionTimeSec: researchDef.newProductionTimeSec,
            shelfLifeDays: researchDef.newShelfLifeDays,
            ingredients: researchDef.newIngredients,
            descriptionEn: `${researchDef.formulaNameEn} — ${researchDef.healthBenefitEn}`,
            descriptionId: `${researchDef.formulaNameId} — ${researchDef.healthBenefitId}`,
          }
        : r,
    );
    const nextAchievements = evaluateStoreAchievements(s, {
      recipes: nextRecipes,
      researchedRecipeIds: nextResearchedIds,
    });

    soundFx.playSuccess();
    set({
      cashBalance: s.cashBalance - researchDef.researchCost,
      recipes: nextRecipes,
      researchedRecipeIds: nextResearchedIds,
      transactions: nextTxs,
      unlockedAchievements: nextAchievements,
    });
    get().pushToast({
      type: 'success',
      textEn: `Discovered ${researchDef.formulaNameEn}!`,
      textId: `Berhasil meriset ${researchDef.formulaNameId}!`,
    });
    get().persistNow();
    return { ok: true };
  },

  createCustomRecipe: (recipeInput) => {
    soundFx.playSuccess();
    const newRecipe: RecipeDef = {
      ...recipeInput,
      id: makeId('custom-recipe'),
      unlocked: true,
      isCustom: true,
    };
    set((s) => ({
      recipes: [...s.recipes, newRecipe],
    }));
    get().persistNow();
  },

  startCookingSession: (recipeId, batchCount) => {
    const s = get();
    if (s.activeCooking || s.activeDelegation) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: 'Kitchen is already processing a batch.',
        errorId: 'Dapur sedang memproses batch lain.',
      };
    }
    const recipe = s.recipes.find((r) => r.id === recipeId);
    if (!recipe || !recipe.unlocked) {
      return { ok: false, errorEn: 'Recipe is locked.', errorId: 'Resep belum terbuka.' };
    }

    const maxPcs = getSteamerMaxBatchPcs(s.upgrades);
    if (batchCount * recipe.batchSize > maxPcs) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: `Steamer capacity is ${maxPcs} pcs. Upgrade Steamer for larger batches.`,
        errorId: `Kapasitas kukusan ${maxPcs} pcs. Upgrade Kukusan untuk batch lebih besar.`,
      };
    }

    const avail = checkRecipeAvailability(recipe, s.ingredientLots, s.currentDay, batchCount);
    if (!avail.canProduce) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: 'Insufficient ingredients in cold storage.',
        errorId: 'Stok bahan di kulkas belum mencukupi.',
      };
    }

    const consumed = consumeIngredientsFEFO(
      s.ingredientLots,
      recipe.ingredients,
      s.currentDay,
      batchCount,
    );

    const hygieneBase = Math.min(
      100,
      Math.round((consumed.averageIngredientQuality + 88) / 2) +
        getPrepHygieneBonus(s.upgrades) +
        (recipe.researched ? 4 : 0),
    );

    soundFx.playClick();
    set({
      ingredientLots: consumed.updatedLots,
      gameState: 'PRODUCTION',
      activeCooking: {
        batchId: makeId('prod'),
        recipeId,
        batchCount,
        stage: 'PREP',
        ingredientCost: consumed.totalIngredientCost,
        scores: {
          hygieneCompliance: hygieneBase,
        },
      },
    });
    get().persistNow();
    return { ok: true };
  },

  startDelegatedCooking: (recipeId, batchCount) => {
    const s = get();
    const eligibility = checkDelegationEligibility({
      kitchenStaff: s.kitchenStaff,
      activeCooking: s.activeCooking,
      activeDelegation: s.activeDelegation,
    });
    if (!eligibility.eligible) {
      soundFx.playError();
      return eligibility.reason === 'busy'
        ? {
            ok: false,
            errorEn: 'Kitchen is already processing a batch.',
            errorId: 'Dapur sedang memproses batch lain.',
          }
        : {
            ok: false,
            errorEn: 'Assign at least 2 Kitchen Helpers to Kitchen shift to delegate.',
            errorId: 'Atur minimal 2 Asisten Dapur di shift Dapur untuk delegasi.',
          };
    }

    const recipe = s.recipes.find((r) => r.id === recipeId);
    if (!recipe || !recipe.unlocked) {
      return { ok: false, errorEn: 'Recipe is locked.', errorId: 'Resep belum terbuka.' };
    }

    const maxPcs = getSteamerMaxBatchPcs(s.upgrades);
    if (batchCount * recipe.batchSize > maxPcs) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: `Steamer capacity is ${maxPcs} pcs. Upgrade Steamer for larger batches.`,
        errorId: `Kapasitas kukusan ${maxPcs} pcs. Upgrade Kukusan untuk batch lebih besar.`,
      };
    }

    const avail = checkRecipeAvailability(recipe, s.ingredientLots, s.currentDay, batchCount);
    if (!avail.canProduce) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: 'Insufficient ingredients in cold storage.',
        errorId: 'Stok bahan di kulkas belum mencukupi.',
      };
    }

    const consumed = consumeIngredientsFEFO(
      s.ingredientLots,
      recipe.ingredients,
      s.currentDay,
      batchCount,
    );

    const hygieneBase = Math.min(
      100,
      Math.round((consumed.averageIngredientQuality + 88) / 2) +
        getPrepHygieneBonus(s.upgrades) +
        (recipe.researched ? 4 : 0),
    );

    const plan = computeDelegatedCookingPlan({
      recipe,
      batchCount,
      kitchenStaff: s.kitchenStaff,
      hygieneBase,
      activeDailyEvent: s.activeDailyEvent,
    });

    const isStoreActive =
      s.gameState === 'STORE_OPEN' ||
      s.gameState === 'CUSTOMER_SERVICE' ||
      s.customers.length > 0;

    soundFx.playSuccess();
    set({
      ingredientLots: consumed.updatedLots,
      activeStation: null,
      gameState: isStoreActive ? 'STORE_OPEN' : 'MORNING_PREP',
      activeDelegation: {
        batchId: makeId('deleg'),
        recipeId,
        batchCount,
        ingredientCost: consumed.totalIngredientCost,
        scores: plan.scores,
        projectedQualityScore: plan.projectedQualityScore,
        assignedHelpers: plan.assignedHelpers,
        startedAt: Date.now(),
        durationMs: plan.durationMs,
      },
    });
    get().pushToast({
      type: 'info',
      textEn: `Kitchen crew started auto-cooking ${batchCount * recipe.batchSize} pcs (~QC ${plan.projectedQualityScore})!`,
      textId: `Staf dapur mulai memasak otomatis ${batchCount * recipe.batchSize} pcs (~QC ${plan.projectedQualityScore})!`,
    });
    get().persistNow();
    return { ok: true };
  },

  completeDelegatedCooking: () => {
    const s = get();
    const deleg = s.activeDelegation;
    if (!deleg) return;
    const recipe = s.recipes.find((r) => r.id === deleg.recipeId);
    if (!recipe) {
      set({ activeDelegation: null });
      return;
    }

    const qtyProduced = recipe.batchSize * deleg.batchCount;
    const rawBatch: ProductionBatch = {
      id: deleg.batchId,
      recipeId: deleg.recipeId,
      quantity: qtyProduced,
      ingredientCost: deleg.ingredientCost,
      operationalCost: ECONOMY_RULES.operationalCostPerBatch * deleg.batchCount,
      laborCost: ECONOMY_RULES.laborCostPerBatch * deleg.batchCount,
      scores: deleg.scores,
      qualityScore: 0,
      qualityCategory: 'Average',
      status: 'PROCESSING',
      producedDay: s.currentDay,
      expiryDay: s.currentDay + recipe.shelfLifeDays,
    };

    const checkedBatch = evaluateQualityControl(rawBatch);
    const nextProdBatches = [...s.productionBatches, checkedBatch];
    const nextAchievements = evaluateStoreAchievements(s, {
      productionBatches: nextProdBatches,
    });

    const nextPcsProduced = s.todayStats.pcsProduced + qtyProduced;
    const bonusCheck = applyBonusObjectiveRewards({
      businessLevel: s.business.level,
      currentDay: s.currentDay,
      todayCustomersServed: s.todayStats.customersServed,
      todayPcsProduced: nextPcsProduced,
      totalCustomersServed: s.salesOrders.length,
      transactions: s.transactions,
    });

    const updatedStaff = s.kitchenStaff.map(computeStaffMoraleAfterBatch);
    const missionResult = applyDailyMissionRewards({
      dailyMissions: s.dailyMissions,
      event: {
        type: 'COOK_QC',
        pcsProduced: qtyProduced,
        qualityScore: checkedBatch.qualityScore,
        passedQc: checkedBatch.status === 'QC_PASSED',
      },
      currentDay: s.currentDay,
      transactions: bonusCheck.updatedTransactions,
    });

    soundFx.playSteam();
    if (missionResult.cashDelta > 0) {
      soundFx.playCashier();
    }
    set({
      activeDelegation: null,
      cashBalance: s.cashBalance + bonusCheck.cashDelta + missionResult.cashDelta,
      transactions: missionResult.updatedTransactions,
      productionBatches: nextProdBatches,
      dailyMissions: missionResult.updatedMissions,
      kitchenStaff: updatedStaff,
      unlockedAchievements: nextAchievements,
      celebratingUntil:
        checkedBatch.status === 'QC_PASSED' || missionResult.cashDelta > 0
          ? Date.now() + 2000
          : 0,
      tutorialStep:
        s.tutorialStep === 'COOK_BATCH' || s.tutorialStep === 'BUY_INGREDIENTS'
          ? 'CHECK_QC'
          : s.tutorialStep,
      todayStats: {
        ...s.todayStats,
        pcsProduced: nextPcsProduced,
        qcWastedCost:
          (s.todayStats.qcWastedCost ?? 0) +
          (checkedBatch.status === 'QC_FAILED' ? checkedBatch.ingredientCost : 0),
      },
    });

    get().pushToast({
      type: checkedBatch.status === 'QC_PASSED' ? 'success' : 'warning',
      textEn:
        checkedBatch.status === 'QC_PASSED'
          ? `Auto-Batch Ready: ${qtyProduced} pcs ${recipe.nameEn} (QC ${checkedBatch.qualityScore}/100)! Pack at Packaging Bench.`
          : `Auto-Batch QC Failed (${checkedBatch.qualityScore}/100). Inspect at Steamer QC.`,
      textId:
        checkedBatch.status === 'QC_PASSED'
          ? `Batch Staf Selesai: ${qtyProduced} pcs ${recipe.nameId} (QC ${checkedBatch.qualityScore}/100)! Kemas di Meja Pengemasan.`
          : `Batch Staf Gagal QC (${checkedBatch.qualityScore}/100). Periksa di Kukusan QC.`,
    });

    for (const claimed of bonusCheck.newlyClaimed) {
      get().pushToast({
        type: 'success',
        textEn: `Bonus Complete: ${claimed.titleEn} (+${formatRupiah(claimed.rewardCash)})!`,
        textId: `Bonus Tercapai: ${claimed.titleId} (+${formatRupiah(claimed.rewardCash)})!`,
      });
    }
    for (const m of missionResult.newlyRewarded) {
      get().pushToast({
        type: 'success',
        textEn: `Mission Complete: ${m.titleEn} (+${formatRupiah(m.rewardCash)} bonus currency added to wallet!)`,
        textId: `Misi Selesai: ${m.titleId} (+${formatRupiah(m.rewardCash)} bonus saldo masuk dompet!)`,
      });
    }
    const newlyTired = updatedStaff.filter(
      (m) => m.shift !== 'wellness' && getStaffMorale(m) < 35,
    );
    if (newlyTired.length > 0) {
      const firstDef = getKitchenHelperDef(newlyTired[0].id);
      get().pushToast({
        type: 'warning',
        textEn: `${firstDef.name} has low morale (${getStaffMorale(newlyTired[0])}%). Assign a Wellness shift!`,
        textId: `Moral ${firstDef.name} rendah (${getStaffMorale(newlyTired[0])}%). Atur shift Wellness!`,
      });
    }
    get().persistNow();
  },

  completeCookingStage: (stage, scoreValue) => {
    const s = get();
    const session = s.activeCooking;
    if (!session) return;

    const stageHelperId: KitchenHelperRole =
      stage === 'PREP'
        ? 'prep'
        : stage === 'MIX'
          ? 'mix'
          : stage === 'WRAP'
            ? 'wrap'
            : 'steam';
    const helperMember = s.kitchenStaff.find((h) => h.id === stageHelperId);
    const skillEffects = computeHelperSkillEffects(helperMember);
    const helperBonus =
      getEffectiveHelperQualityBonus(helperMember) + skillEffects.stageQualityBonus;
    const eventSteamDelta =
      stage === 'STEAM' ? (s.activeDailyEvent?.steamScoreDelta ?? 0) : 0;
    const clamped = Math.max(
      0,
      Math.min(100, Math.round(scoreValue + helperBonus + eventSteamDelta)),
    );
    const nextScores = { ...session.scores };

    if (stage === 'PREP') {
      nextScores.recipeAccuracy = clamped;
      soundFx.playSuccess();
      set({
        activeCooking: { ...session, stage: 'MIX', scores: nextScores },
      });
      return;
    }

    if (stage === 'MIX') {
      nextScores.mixingQuality = clamped;
      soundFx.playSuccess();
      set({
        activeCooking: { ...session, stage: 'WRAP', scores: nextScores },
      });
      return;
    }

    if (stage === 'WRAP') {
      nextScores.wrappingQuality = clamped;
      soundFx.playSuccess();
      soundFx.setSteamAmbience(true, 0.68);
      set({
        activeCooking: { ...session, stage: 'STEAM', scores: nextScores },
      });
      return;
    }

    if (stage === 'STEAM') {
      nextScores.steamingQuality = clamped;
      const recipe = s.recipes.find((r) => r.id === session.recipeId)!;
      const qtyProduced = recipe.batchSize * session.batchCount;

      const fullScores: CookingScores = {
        recipeAccuracy: nextScores.recipeAccuracy ?? 80,
        mixingQuality: nextScores.mixingQuality ?? 80,
        wrappingQuality: nextScores.wrappingQuality ?? 80,
        steamingQuality: nextScores.steamingQuality ?? 80,
        hygieneCompliance: nextScores.hygieneCompliance ?? 90,
      };

      const rawBatch: ProductionBatch = {
        id: session.batchId,
        recipeId: session.recipeId,
        quantity: qtyProduced,
        ingredientCost: session.ingredientCost,
        operationalCost: ECONOMY_RULES.operationalCostPerBatch * session.batchCount,
        laborCost: ECONOMY_RULES.laborCostPerBatch * session.batchCount,
        scores: fullScores,
        qualityScore: 0,
        qualityCategory: 'Average',
        status: 'PROCESSING',
        producedDay: s.currentDay,
        expiryDay: s.currentDay + recipe.shelfLifeDays,
      };

      const checkedBatch = evaluateQualityControl(rawBatch);
      const nextProdBatches = [...s.productionBatches, checkedBatch];
      const nextAchievements = evaluateStoreAchievements(s, {
        productionBatches: nextProdBatches,
      });

      const nextPcsProduced = s.todayStats.pcsProduced + qtyProduced;
      const bonusCheck = applyBonusObjectiveRewards({
        businessLevel: s.business.level,
        currentDay: s.currentDay,
        todayCustomersServed: s.todayStats.customersServed,
        todayPcsProduced: nextPcsProduced,
        totalCustomersServed: s.salesOrders.length,
        transactions: s.transactions,
      });

      const updatedStaff = s.kitchenStaff.map(computeStaffMoraleAfterBatch);
      const missionResult = applyDailyMissionRewards({
        dailyMissions: s.dailyMissions,
        event: {
          type: 'COOK_QC',
          pcsProduced: qtyProduced,
          qualityScore: checkedBatch.qualityScore,
          passedQc: checkedBatch.status === 'QC_PASSED',
        },
        currentDay: s.currentDay,
        transactions: bonusCheck.updatedTransactions,
      });

      soundFx.setSteamAmbience(false);
      soundFx.playSteam();
      if (missionResult.cashDelta > 0) {
        soundFx.playCashier();
      }
      set({
        activeCooking: null,
        cashBalance: s.cashBalance + bonusCheck.cashDelta + missionResult.cashDelta,
        transactions: missionResult.updatedTransactions,
        productionBatches: nextProdBatches,
        dailyMissions: missionResult.updatedMissions,
        kitchenStaff: updatedStaff,
        unlockedAchievements: nextAchievements,
        gameState: 'QUALITY_CONTROL',
        activeStation: 'steamer',
        celebratingUntil:
          checkedBatch.status === 'QC_PASSED' || missionResult.cashDelta > 0
            ? Date.now() + 2200
            : 0,
        tutorialStep:
          s.tutorialStep === 'COOK_BATCH' || s.tutorialStep === 'BUY_INGREDIENTS'
            ? 'CHECK_QC'
            : s.tutorialStep,
        todayStats: {
          ...s.todayStats,
          pcsProduced: nextPcsProduced,
          qcWastedCost:
            (s.todayStats.qcWastedCost ?? 0) +
            (checkedBatch.status === 'QC_FAILED' ? checkedBatch.ingredientCost : 0),
        },
      });
      for (const claimed of bonusCheck.newlyClaimed) {
        get().pushToast({
          type: 'success',
          textEn: `Bonus Complete: ${claimed.titleEn} (+${formatRupiah(claimed.rewardCash)})!`,
          textId: `Bonus Tercapai: ${claimed.titleId} (+${formatRupiah(claimed.rewardCash)})!`,
        });
      }
      for (const m of missionResult.newlyRewarded) {
        get().pushToast({
          type: 'success',
          textEn: `Mission Complete: ${m.titleEn} (+${formatRupiah(m.rewardCash)} bonus currency added to wallet!)`,
          textId: `Misi Selesai: ${m.titleId} (+${formatRupiah(m.rewardCash)} bonus saldo masuk dompet!)`,
        });
      }
      const newlyTired = updatedStaff.filter(
        (m) => m.shift !== 'wellness' && getStaffMorale(m) < 35,
      );
      if (newlyTired.length > 0) {
        const firstDef = getKitchenHelperDef(newlyTired[0].id);
        get().pushToast({
          type: 'warning',
          textEn: `${firstDef.name} has low morale (${getStaffMorale(newlyTired[0])}%). Assign a Wellness shift!`,
          textId: `Moral ${firstDef.name} rendah (${getStaffMorale(newlyTired[0])}%). Atur shift Wellness!`,
        });
      }
      get().persistNow();
    }
  },

  cancelCookingSession: () => {
    soundFx.setSteamAmbience(false);
    soundFx.playClick();
    set({
      activeCooking: null,
      activeStation: null,
      gameState: 'MORNING_PREP',
    });
  },

  acknowledgeQcBatch: (batchId) => {
    const s = get();
    soundFx.playClick();
    set({
      activeStation: 'packaging',
      gameState: 'PACKAGING',
      tutorialStep:
        s.tutorialStep === 'CHECK_QC' ? 'PACKAGE_DIMSUM' : s.tutorialStep,
    });
    // Ensure batch exists
    void batchId;
  },

  discardQcBatch: (batchId) => {
    soundFx.playError();
    set((s) => {
      const target = s.productionBatches.find((b) => b.id === batchId);
      const addedWaste =
        target && target.status !== 'QC_FAILED' ? target.ingredientCost : 0;
      return {
        productionBatches: s.productionBatches.filter((b) => b.id !== batchId),
        todayStats: {
          ...s.todayStats,
          qcWastedCost: (s.todayStats.qcWastedCost ?? 0) + addedWaste,
        },
      };
    });
    get().persistNow();
  },

  packageBatch: (productionBatchId, packagingTypeId, boxCount, markup) => {
    const s = get();
    const prodBatch = s.productionBatches.find((b) => b.id === productionBatchId);
    if (!prodBatch) {
      return { ok: false, errorEn: 'Batch not found.', errorId: 'Batch tidak ditemukan.' };
    }

    try {
      const pkgDef = getPackagingDef(packagingTypeId);
      const pcsNeeded = boxCount * pkgDef.capacity;

      const missionResult = applyDailyMissionRewards({
        dailyMissions: s.dailyMissions,
        event: {
          type: 'PACKAGE',
          boxesPackaged: boxCount,
        },
        currentDay: s.currentDay,
        transactions: s.transactions,
      });

      if (prodBatch.quantity >= pcsNeeded) {
        const result = packageProductionBatch({
          productionBatch: prodBatch,
          packagingTypeId,
          boxCount,
          markup,
          packagingStock: s.packagingStock,
          upgrades: s.upgrades,
          newProductBatchId: makeId('pkgbatch'),
        });

        soundFx.playSuccess();
        if (missionResult.cashDelta > 0) {
          soundFx.playCashier();
        }
        set({
          cashBalance: s.cashBalance + missionResult.cashDelta,
          transactions: missionResult.updatedTransactions,
          productionBatches: s.productionBatches.map((b) =>
            b.id === productionBatchId ? result.updatedProductionBatch : b,
          ),
          productBatches: [...s.productBatches, result.productBatch],
          packagingStock: result.updatedPackagingStock,
          dailyMissions: missionResult.updatedMissions,
          celebratingUntil: missionResult.cashDelta > 0 ? Date.now() + 1800 : s.celebratingUntil,
          isCarryingProduct: true,
          tutorialStep:
            s.tutorialStep === 'PACKAGE_DIMSUM' || s.tutorialStep === 'CHECK_QC'
              ? 'OPEN_STORE'
              : s.tutorialStep,
          todayStats: {
            ...s.todayStats,
            boxesPackaged: s.todayStats.boxesPackaged + boxCount,
          },
        });
      } else {
        const poolResult = packageRecipeBatchesFEFO({
          productionBatches: s.productionBatches,
          recipeId: prodBatch.recipeId,
          preferredBatchId: productionBatchId,
          currentDay: s.currentDay,
          packagingTypeId,
          boxCount,
          markup,
          packagingStock: s.packagingStock,
          upgrades: s.upgrades,
          newProductBatchId: makeId('pkgbatch'),
        });

        soundFx.playSuccess();
        if (missionResult.cashDelta > 0) {
          soundFx.playCashier();
        }
        set({
          cashBalance: s.cashBalance + missionResult.cashDelta,
          transactions: missionResult.updatedTransactions,
          productionBatches: poolResult.updatedProductionBatches,
          productBatches: [...s.productBatches, poolResult.productBatch],
          packagingStock: poolResult.updatedPackagingStock,
          dailyMissions: missionResult.updatedMissions,
          celebratingUntil: missionResult.cashDelta > 0 ? Date.now() + 1800 : s.celebratingUntil,
          isCarryingProduct: true,
          tutorialStep:
            s.tutorialStep === 'PACKAGE_DIMSUM' || s.tutorialStep === 'CHECK_QC'
              ? 'OPEN_STORE'
              : s.tutorialStep,
          todayStats: {
            ...s.todayStats,
            boxesPackaged: s.todayStats.boxesPackaged + boxCount,
          },
        });
      }

      get().pushToast({
        type: 'success',
        textEn: `Packaged ${boxCount} boxes ready for sale!`,
        textId: `${boxCount} kotak berhasil dikemas & siap dijual!`,
      });
      for (const m of missionResult.newlyRewarded) {
        get().pushToast({
          type: 'success',
          textEn: `Mission Complete: ${m.titleEn} (+${formatRupiah(m.rewardCash)} bonus currency added to wallet!)`,
          textId: `Misi Selesai: ${m.titleId} (+${formatRupiah(m.rewardCash)} bonus saldo masuk dompet!)`,
        });
      }
      get().persistNow();
      return { ok: true };
    } catch (err) {
      soundFx.playError();
      const msg = err instanceof Error ? err.message : 'Packaging failed';
      return { ok: false, errorEn: msg, errorId: msg };
    }
  },

  packageRecipePool: (recipeId, packagingTypeId, boxCount, markup) => {
    const s = get();
    try {
      const poolResult = packageRecipeBatchesFEFO({
        productionBatches: s.productionBatches,
        recipeId,
        currentDay: s.currentDay,
        packagingTypeId,
        boxCount,
        markup,
        packagingStock: s.packagingStock,
        upgrades: s.upgrades,
        newProductBatchId: makeId('pkgbatch'),
      });
      const missionResult = applyDailyMissionRewards({
        dailyMissions: s.dailyMissions,
        event: {
          type: 'PACKAGE',
          boxesPackaged: boxCount,
        },
        currentDay: s.currentDay,
        transactions: s.transactions,
      });

      soundFx.playSuccess();
      if (missionResult.cashDelta > 0) {
        soundFx.playCashier();
      }
      set({
        cashBalance: s.cashBalance + missionResult.cashDelta,
        transactions: missionResult.updatedTransactions,
        productionBatches: poolResult.updatedProductionBatches,
        productBatches: [...s.productBatches, poolResult.productBatch],
        packagingStock: poolResult.updatedPackagingStock,
        dailyMissions: missionResult.updatedMissions,
        celebratingUntil: missionResult.cashDelta > 0 ? Date.now() + 1800 : s.celebratingUntil,
        isCarryingProduct: true,
        tutorialStep:
          s.tutorialStep === 'PACKAGE_DIMSUM' || s.tutorialStep === 'CHECK_QC'
            ? 'OPEN_STORE'
            : s.tutorialStep,
        todayStats: {
          ...s.todayStats,
          boxesPackaged: s.todayStats.boxesPackaged + boxCount,
        },
      });

      get().pushToast({
        type: 'success',
        textEn:
          poolResult.batchesUsedCount > 1
            ? `Combined ${poolResult.batchesUsedCount} batches into ${boxCount} boxes!`
            : `Packaged ${boxCount} boxes ready for sale!`,
        textId:
          poolResult.batchesUsedCount > 1
            ? `Menggabungkan ${poolResult.batchesUsedCount} batch menjadi ${boxCount} kotak!`
            : `${boxCount} kotak berhasil dikemas & siap dijual!`,
      });
      for (const m of missionResult.newlyRewarded) {
        get().pushToast({
          type: 'success',
          textEn: `Mission Complete: ${m.titleEn} (+${formatRupiah(m.rewardCash)} bonus currency added to wallet!)`,
          textId: `Misi Selesai: ${m.titleId} (+${formatRupiah(m.rewardCash)} bonus saldo masuk dompet!)`,
        });
      }
      get().persistNow();
      return { ok: true };
    } catch (err) {
      soundFx.playError();
      const msg = err instanceof Error ? err.message : 'Packaging failed';
      return { ok: false, errorEn: msg, errorId: msg };
    }
  },

  updateProductPrice: (productBatchId, newPrice) => {
    const safePrice = Math.max(500, Math.round(newPrice));
    set((s) => ({
      productBatches: s.productBatches.map((b) =>
        b.id === productBatchId
          ? {
              ...b,
              sellingPricePerBox: safePrice,
              originalSellingPricePerBox: safePrice,
              clearanceDiscountPct: 0,
            }
          : b,
      ),
    }));
    get().persistNow();
  },

  applyClearanceSale: (productBatchId, discountPct) => {
    const s = get();
    const target = s.productBatches.find((b) => b.id === productBatchId);
    if (!target || target.status !== 'PACKAGED' || target.boxesAvailable <= 0) {
      return {
        ok: false,
        errorEn: 'No active packaged stock found for clearance.',
        errorId: 'Stok produk siap jual tidak ditemukan untuk diskon.',
      };
    }
    if (discountPct > 0 && target.expiryDay > s.currentDay) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: 'Clearance Sale applies only to stock expiring today.',
        errorId: 'Diskon Penghabisan hanya untuk stok yang kedaluwarsa hari ini.',
      };
    }

    const updated = applyClearanceDiscountToBatch(target, discountPct);
    soundFx.playClick();
    set({
      productBatches: s.productBatches.map((b) =>
        b.id === productBatchId ? updated : b,
      ),
    });

    if (discountPct > 0) {
      get().pushToast({
        type: 'info',
        textEn: `Clearance Sale -${discountPct}% active (${formatRupiah(updated.sellingPricePerBox)}/box) — bargain hunters alerted!`,
        textId: `Diskon Penghabisan -${discountPct}% aktif (${formatRupiah(updated.sellingPricePerBox)}/kotak) — menarik pemburu promo!`,
      });
    } else {
      get().pushToast({
        type: 'info',
        textEn: `Restored regular price (${formatRupiah(updated.sellingPricePerBox)}/box).`,
        textId: `Harga kembali normal (${formatRupiah(updated.sellingPricePerBox)}/kotak).`,
      });
    }
    get().persistNow();
    return { ok: true };
  },

  openStore: () => {
    const s = get();
    const availableBoxes = s.productBatches.filter(
      (b) =>
        b.status === 'PACKAGED' &&
        b.boxesAvailable > 0 &&
        b.expiryDay >= s.currentDay,
    );

    if (availableBoxes.length === 0) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: 'Package at least 1 QC-passed box before opening the store!',
        errorId: 'Kemas minimal 1 kotak lolos QC sebelum membuka toko!',
      };
    }

    const firstCustomer = spawnCustomerAgent({
      id: makeId('cust'),
      business: s.business,
      availableBatches: availableBoxes,
      recipes: s.recipes,
      upgrades: s.upgrades,
      seatSlot: 0,
      occupiedTableSlots: [],
      activeFestival: s.activeFestival,
      rivalShop: s.rivalShop,
    });

    soundFx.playDoorbell();
    set({
      gameState: 'STORE_OPEN',
      storeTimeRemainingSec: ECONOMY_RULES.storeOpenDurationSec,
      customers: [firstCustomer],
      onlineOrders: [],
      onlineSpawnCooldownSec: 5,
      rushHourActive: false,
      spawnCooldownSec: 5.5,
      tutorialStep:
        s.tutorialStep === 'OPEN_STORE' ? 'SERVE_CUSTOMER' : s.tutorialStep,
    });
    get().pushToast({
      type: 'info',
      textEn: 'Outlet is now OPEN! Welcome your customers.',
      textId: 'Outlet BUKA! Sambut dan layani pelangganmu.',
    });
    get().persistNow();
    return { ok: true };
  },

  tickStoreSimulation: (dtSec) => {
    const s = get();
    if (s.gameState !== 'STORE_OPEN' && s.gameState !== 'CUSTOMER_SERVICE') {
      return;
    }

    const nextTime = Math.max(0, s.storeTimeRemainingSec - dtSec);
    const rushPhase = getRushHourPhase(nextTime);
    const nextRushActive = rushPhase.active;

    let nextCustomers = s.customers
      .map((c) => {
        if (c.lifecycle === 'ENTERING') {
          return { ...c, lifecycle: 'BROWSING' as const };
        }
        if (c.lifecycle === 'BROWSING') {
          return { ...c, lifecycle: 'WAITING_ORDER' as const };
        }
        if (c.lifecycle === 'WAITING_ORDER') {
          const rem = Math.max(0, c.patienceRemaining - dtSec);
          if (rem <= 0) {
            return { ...c, patienceRemaining: 0, lifecycle: 'LEFT_ANGRY' as const };
          }
          return { ...c, patienceRemaining: rem };
        }
        if (c.lifecycle === 'EATING') {
          const rem = Math.max(0, (c.eatingRemainingSec ?? 0) - dtSec);
          if (rem <= 0) {
            return { ...c, eatingRemainingSec: 0, lifecycle: 'EXITING' as const };
          }
          return { ...c, eatingRemainingSec: rem };
        }
        return c;
      })
      .filter((c) => c.lifecycle !== 'EXITING');

    // Handle newly angry customers
    const newlyAngry = nextCustomers.filter((c) => c.lifecycle === 'LEFT_ANGRY');
    let lostDelta = 0;
    let repDelta = 0;
    if (newlyAngry.length > 0) {
      lostDelta = newlyAngry.length;
      repDelta = -2 * newlyAngry.length;
      nextCustomers = nextCustomers.filter((c) => c.lifecycle !== 'LEFT_ANGRY');
      soundFx.playError();
    }

    // Spawn new customer if waiting queue room (< 4 waiting) and time remains
    const waitingCustomers = nextCustomers.filter(
      (c) => c.lifecycle !== 'EATING' && c.lifecycle !== 'EXITING',
    );
    let nextSpawn = s.spawnCooldownSec - dtSec;
    if (nextTime > 6 && nextSpawn <= 0 && waitingCustomers.length < 4) {
      const availableBoxes = s.productBatches.filter(
        (b) =>
          b.status === 'PACKAGED' &&
          b.boxesAvailable > 0 &&
          b.expiryDay >= s.currentDay,
      );
      const usedSlots = new Set(waitingCustomers.map((c) => c.seatSlot));
      const freeSlot = [0, 1, 2, 3].find((slot) => !usedSlots.has(slot)) ?? 0;
      const occupiedTableSlots = nextCustomers
        .filter((c) => c.tableSlot !== undefined)
        .map((c) => c.tableSlot as number);

      const spawned = spawnCustomerAgent({
        id: makeId('cust'),
        business: s.business,
        availableBatches: availableBoxes,
        recipes: s.recipes,
        upgrades: s.upgrades,
        seatSlot: freeSlot,
        occupiedTableSlots,
        activeFestival: s.activeFestival,
        rivalShop: s.rivalShop,
      });
      nextCustomers.push(spawned);
      soundFx.playDoorbell();

      const rushBoost = nextRushActive ? 1.45 : 1;
      const traffic =
        getTrafficMultiplier(
          s.upgrades,
          s.business.reputation,
          s.activeFestival,
          s.rivalShop,
        ) *
        (s.activeDailyEvent?.trafficMultiplier ?? 1) *
        rushBoost;
      nextSpawn = Math.max(
        nextRushActive ? 1.5 : 2.5,
        ECONOMY_RULES.customerSpawnIntervalSec / traffic,
      );
    }

    // Online delivery orders countdown & spawning
    let nextOnlineOrders = s.onlineOrders
      .map((o) => ({
        ...o,
        timeRemainingSec: Math.max(0, o.timeRemainingSec - dtSec),
      }))
      .filter((o) => o.timeRemainingSec > 0);
    let nextOnlineCooldown = s.onlineSpawnCooldownSec - dtSec;
    let spawnedOnlineOrder: OnlineDeliveryOrder | null = null;

    if (s.onlineDeliveryEnabled && nextTime > 8 && nextOnlineOrders.length < 3) {
      if (nextOnlineCooldown <= 0) {
        const availableBoxes = s.productBatches.filter(
          (b) =>
            b.status === 'PACKAGED' &&
            b.boxesAvailable > 0 &&
            b.expiryDay >= s.currentDay,
        );
        spawnedOnlineOrder = generateOnlineDeliveryOrder({
          id: makeId('ojol'),
          availableBatches: availableBoxes,
          recipes: s.recipes,
          reputation: s.business.reputation,
        });
        nextOnlineOrders = [...nextOnlineOrders, spawnedOnlineOrder];
        nextOnlineCooldown = nextRushActive ? 8 : 13;
      }
    }

    const nextRepAfterAngry =
      repDelta !== 0
        ? Math.max(10, Math.min(100, s.business.reputation + repDelta))
        : s.business.reputation;

    set({
      storeTimeRemainingSec: nextTime,
      spawnCooldownSec: nextSpawn,
      rushHourActive: nextRushActive,
      customers: nextCustomers,
      onlineOrders: nextOnlineOrders,
      onlineSpawnCooldownSec: nextOnlineCooldown,
      business:
        repDelta !== 0
          ? {
              ...s.business,
              reputation: nextRepAfterAngry,
            }
          : s.business,
      todayStats:
        lostDelta > 0
          ? {
              ...s.todayStats,
              customersLost: s.todayStats.customersLost + lostDelta,
            }
          : s.todayStats,
    });

    if (!s.rushHourActive && nextRushActive) {
      get().pushToast({
        type: 'info',
        textEn: `${rushPhase.labelEn}! Higher customer & delivery volume incoming!`,
        textId: `${rushPhase.labelId}! Arus tamu & pesan-antar online meningkat!`,
      });
    }

    if (spawnedOnlineOrder) {
      get().pushToast({
        type: 'info',
        textEn: `New ${spawnedOnlineOrder.platform} order from ${spawnedOnlineOrder.courierName}!`,
        textId: `Pesanan ${spawnedOnlineOrder.platform} baru dari ${spawnedOnlineOrder.courierName}!`,
      });
    }

    if (newlyAngry.length > 0) {
      for (const angryCust of newlyAngry) {
        const rec = s.recipes.find((r) => r.id === angryCust.requestedRecipeId);
        get().pushFeedbackPopup(
          generateCustomerFeedback({
            id: makeId('fb'),
            customerName: angryCust.name,
            archetypeId: angryCust.archetypeId,
            recipeNameEn: rec?.nameEn ?? 'Dimsum',
            recipeNameId: rec?.nameId ?? 'Dimsum',
            satisfaction: 10,
            productQuality: 50,
            priceRatioToBudget: 1,
            serviceTimeRatio: 0,
            productMatched: false,
            reputationDelta: -2,
            newReputation: nextRepAfterAngry,
            leftAngry: true,
          }),
        );
      }
    }

    if (nextTime <= 0) {
      get().closeStoreAndGenerateReport();
    }
  },

  serveCustomer: (customerId, productBatchId, discount = 0) => {
    const s = get();
    const customer = s.customers.find((c) => c.id === customerId);
    const batch = s.productBatches.find((b) => b.id === productBatchId);

    if (!customer || !batch) {
      return { ok: false, errorEn: 'Invalid order.', errorId: 'Pesanan tidak valid.' };
    }
    if (batch.status !== 'PACKAGED' || batch.boxesAvailable < customer.quantityBoxes) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: 'Not enough packaged stock for this selection.',
        errorId: 'Stok kemasan tidak cukup untuk pilihan ini.',
      };
    }

    let salesCalc;
    try {
      salesCalc = calculateSales({
        quantity: customer.quantityBoxes,
        unitPrice: batch.sellingPricePerBox,
        discount,
      });
    } catch {
      soundFx.playError();
      return { ok: false, errorEn: 'Invalid discount.', errorId: 'Diskon tidak valid.' };
    }

    const servedRecipeForFest = s.recipes.find((r) => r.id === batch.recipeId);
    const festivalBoost =
      s.activeFestival &&
      servedRecipeForFest &&
      doesRecipeMatchFestival(servedRecipeForFest, s.activeFestival)
        ? s.activeFestival.revenueMultiplier
        : 1;

    const isDineIn = customer.diningMode === 'DINE_IN';
    const eventAdjusted = applyDailyEventRevenue(salesCalc.total, s.activeDailyEvent);
    const withFestival =
      festivalBoost !== 1
        ? Math.round((eventAdjusted * festivalBoost) / 100) * 100
        : eventAdjusted;
    const adjustedTotal = isDineIn
      ? Math.round((withFestival * DINE_IN_REVENUE_MULTIPLIER) / 100) * 100
      : withFestival;

    const satisfaction = calculateCustomerSatisfaction({
      productQuality: batch.qualityScore,
      priceRatioToBudget: adjustedTotal / Math.max(1, customer.maxBudget),
      serviceTimeRatio: customer.patienceRemaining / Math.max(1, customer.patienceMax),
      productAvailable: batch.recipeId === customer.requestedRecipeId,
      archetypeId: customer.archetypeId,
    });

    const orderId = makeId('order');
    const totalCogs = batch.unitCostPerBox * customer.quantityBoxes;
    const newOrder: SalesOrder = {
      id: orderId,
      customerId: customer.id,
      customerName: customer.name,
      archetypeId: customer.archetypeId,
      orderType: 'DIRECT',
      diningMode: customer.diningMode ?? 'TAKEAWAY',
      productBatchId: batch.id,
      recipeId: batch.recipeId,
      boxType: batch.packagingTypeId,
      quantityBoxes: customer.quantityBoxes,
      unitPrice: batch.sellingPricePerBox,
      discount: salesCalc.discount,
      totalAmount: adjustedTotal,
      totalCogs,
      satisfaction,
      isClearance: (batch.clearanceDiscountPct ?? 0) > 0,
      day: s.currentDay,
      timestamp: Date.now(),
    };

    const nextBatches = s.productBatches.map((b) => {
      if (b.id !== batch.id) return b;
      const rem = b.boxesAvailable - customer.quantityBoxes;
      return {
        ...b,
        boxesAvailable: rem,
        status: rem === 0 ? ('SOLD' as const) : ('PACKAGED' as const),
      };
    });

    const nextSalesOrders = [...s.salesOrders, newOrder];
    const nextTxs = appendTransactionIdempotent(s.transactions, {
      id: makeId('tx'),
      type: 'INCOME',
      category: 'SALES_REVENUE',
      amount: adjustedTotal,
      descriptionEn: isDineIn
        ? `Dine-In sale (${customer.quantityBoxes} box) to ${customer.name}`
        : `Sold ${customer.quantityBoxes} box(es) to ${customer.name}`,
      descriptionId: isDineIn
        ? `Penjualan Dine-In (${customer.quantityBoxes} kotak) ke ${customer.name}`
        : `Terjual ${customer.quantityBoxes} kotak ke ${customer.name}`,
      referenceId: orderId,
      day: s.currentDay,
      timestamp: Date.now(),
    });

    const baseNextRep = updateReputationFromSatisfaction(s.business.reputation, satisfaction);
    const baseRepDelta = baseNextRep - s.business.reputation;
    const dineInBonusRep = isDineIn && satisfaction >= 75 ? 1 : 0;
    const adjustedRepDelta =
      applyDailyEventReputationDelta(baseRepDelta, satisfaction, s.activeDailyEvent) +
      dineInBonusRep;
    const nextRep = Math.max(10, Math.min(100, s.business.reputation + adjustedRepDelta));
    const actualRepDelta = nextRep - s.business.reputation;
    const totalLifetimeRev = nextSalesOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    const nextLevel = computeBusinessLevel(
      totalLifetimeRev,
      nextRep,
      s.upgrades,
      s.franchiseBranches.length,
    );
    const nextBusiness: BusinessProfile = {
      ...s.business,
      reputation: nextRep,
      level: nextLevel,
    };
    const nextAchievements = evaluateStoreAchievements(s, {
      salesOrders: nextSalesOrders,
      business: nextBusiness,
    });

    const stillHasStock = nextBatches.some(
      (b) => b.status === 'PACKAGED' && b.boxesAvailable > 0,
    );

    const nextTodayCustomers = s.todayStats.customersServed + 1;
    const bonusCheck = applyBonusObjectiveRewards({
      businessLevel: nextLevel,
      currentDay: s.currentDay,
      todayCustomersServed: nextTodayCustomers,
      todayPcsProduced: s.todayStats.pcsProduced,
      totalCustomersServed: nextSalesOrders.length,
      transactions: nextTxs,
    });

    const servedRecipe = s.recipes.find((r) => r.id === batch.recipeId);
    const priceRatio = adjustedTotal / Math.max(1, customer.maxBudget);
    const timeRatio = customer.patienceRemaining / Math.max(1, customer.patienceMax);
    const feedback = generateCustomerFeedback({
      id: makeId('fb'),
      customerName: customer.name,
      archetypeId: customer.archetypeId,
      recipeNameEn: servedRecipe?.nameEn ?? 'Healthy Dimsum',
      recipeNameId: servedRecipe?.nameId ?? 'Dimsum Sehat',
      satisfaction,
      productQuality: batch.qualityScore,
      priceRatioToBudget: priceRatio,
      serviceTimeRatio: timeRatio,
      productMatched: batch.recipeId === customer.requestedRecipeId,
      reputationDelta: actualRepDelta,
      newReputation: nextRep,
    });

    const updatedCustomers = isDineIn
      ? s.customers.map((c) =>
          c.id === customerId
            ? {
                ...c,
                lifecycle: 'EATING' as const,
                eatingMaxSec: DINE_IN_EATING_DURATION_SEC,
                eatingRemainingSec: DINE_IN_EATING_DURATION_SEC,
                satisfaction,
              }
            : c,
        )
      : s.customers.filter((c) => c.id !== customerId);

    const missionResult = applyDailyMissionRewards({
      dailyMissions: s.dailyMissions,
      event: {
        type: 'SALE',
        recipeId: batch.recipeId,
        pcsSold: customer.quantityBoxes * batch.pcsPerBox,
        boxesSold: customer.quantityBoxes,
        revenueAmount: adjustedTotal,
        orderType: 'DIRECT',
      },
      currentDay: s.currentDay,
      transactions: bonusCheck.updatedTransactions,
    });

    soundFx.playCashier();
    set({
      cashBalance:
        s.cashBalance + adjustedTotal + bonusCheck.cashDelta + missionResult.cashDelta,
      productBatches: nextBatches,
      isCarryingProduct: stillHasStock,
      customers: updatedCustomers,
      salesOrders: nextSalesOrders,
      transactions: missionResult.updatedTransactions,
      dailyMissions: missionResult.updatedMissions,
      unlockedAchievements: nextAchievements,
      celebratingUntil: Date.now() + 1800,
      business: nextBusiness,
      tutorialStep:
        s.tutorialStep === 'SERVE_CUSTOMER' ? 'VIEW_REPORT' : s.tutorialStep,
      todayStats: {
        ...s.todayStats,
        customersServed: nextTodayCustomers,
        satisfactionSum: s.todayStats.satisfactionSum + satisfaction,
      },
    });
    get().pushFeedbackPopup(feedback);
    for (const claimed of bonusCheck.newlyClaimed) {
      get().pushToast({
        type: 'success',
        textEn: `Bonus Complete: ${claimed.titleEn} (+${formatRupiah(claimed.rewardCash)})!`,
        textId: `Bonus Tercapai: ${claimed.titleId} (+${formatRupiah(claimed.rewardCash)})!`,
      });
    }
    for (const m of missionResult.newlyRewarded) {
      get().pushToast({
        type: 'success',
        textEn: `Mission Complete: ${m.titleEn} (+${formatRupiah(m.rewardCash)} bonus currency added to wallet!)`,
        textId: `Misi Selesai: ${m.titleId} (+${formatRupiah(m.rewardCash)} bonus saldo masuk dompet!)`,
      });
    }
    get().persistNow();
    return { ok: true };
  },

  dismissCustomer: (customerId) => {
    set((s) => ({
      customers: s.customers.filter((c) => c.id !== customerId),
      todayStats: {
        ...s.todayStats,
        customersLost: s.todayStats.customersLost + 1,
      },
    }));
  },

  acceptB2BContract: (preOrderId) => {
    const s = get();
    const po = s.preOrders.find((p) => p.id === preOrderId && !p.fulfilled);
    if (!po) {
      return {
        ok: false,
        errorEn: 'B2B contract not found.',
        errorId: 'Kontrak B2B tidak ditemukan.',
      };
    }
    if ((po.minReputation ?? 0) > s.business.reputation) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: `Requires Reputation ${po.minReputation}+ to accept this contract.`,
        errorId: `Butuh Reputasi ${po.minReputation}+ untuk menerima kontrak ini.`,
      };
    }
    soundFx.playSuccess();
    set({
      preOrders: s.preOrders.map((p) =>
        p.id === preOrderId ? { ...p, accepted: true } : p,
      ),
    });
    get().pushToast({
      type: 'success',
      textEn: `Accepted B2B contract for ${po.customerName} (Due Day ${po.dueDay}).`,
      textId: `Kontrak B2B ${po.customerName} diterima (Jatuh tempo Hari ${po.dueDay}).`,
    });
    get().persistNow();
    return { ok: true };
  },

  fulfillPreOrder: (preOrderId, productBatchId) => {
    const s = get();
    const po = s.preOrders.find((p) => p.id === preOrderId && !p.fulfilled);
    const batch = s.productBatches.find((b) => b.id === productBatchId);
    if (!po || !batch) {
      return { ok: false, errorEn: 'Pre-order not found.', errorId: 'Pre-order tidak ditemukan.' };
    }
    if ((po.minReputation ?? 0) > s.business.reputation) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: `Requires Reputation ${po.minReputation}+ to fulfill this tier.`,
        errorId: `Butuh Reputasi ${po.minReputation}+ untuk memenuhi kontrak tier ini.`,
      };
    }
    if (
      batch.recipeId !== po.recipeId ||
      batch.packagingTypeId !== po.boxType ||
      batch.boxesAvailable < po.quantityBoxes
    ) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: 'Requires exact matching recipe, box type, and box quantity.',
        errorId: 'Membutuhkan resep, jenis kotak, dan jumlah yang sesuai.',
      };
    }

    const baseTotalAmount = po.quantityBoxes * po.offeredPricePerBox;
    const totalAmount = applyDailyEventRevenue(baseTotalAmount, s.activeDailyEvent);
    const totalCogs = po.quantityBoxes * batch.unitCostPerBox;
    const orderId = makeId('po-order');

    const newOrder: SalesOrder = {
      id: orderId,
      customerId: po.id,
      customerName: po.customerName,
      archetypeId: po.archetypeId,
      orderType: 'PRE_ORDER',
      productBatchId: batch.id,
      recipeId: batch.recipeId,
      boxType: batch.packagingTypeId,
      quantityBoxes: po.quantityBoxes,
      unitPrice: po.offeredPricePerBox,
      discount: 0,
      totalAmount,
      totalCogs,
      satisfaction: 95,
      day: s.currentDay,
      timestamp: Date.now(),
    };

    const nextBatches = s.productBatches.map((b) => {
      if (b.id !== batch.id) return b;
      const rem = b.boxesAvailable - po.quantityBoxes;
      return {
        ...b,
        boxesAvailable: rem,
        status: rem === 0 ? ('SOLD' as const) : ('PACKAGED' as const),
      };
    });

    const nextTxs = appendTransactionIdempotent(s.transactions, {
      id: makeId('tx'),
      type: 'INCOME',
      category: 'SALES_REVENUE',
      amount: totalAmount,
      descriptionEn: `Fulfilled B2B contract for ${po.customerName}`,
      descriptionId: `Penuhi kontrak B2B untuk ${po.customerName}`,
      referenceId: orderId,
      day: s.currentDay,
      timestamp: Date.now(),
    });

    const nextSalesOrders = [...s.salesOrders, newOrder];
    const nextTodayCustomers = s.todayStats.customersServed + 1;
    const bonusCheck = applyBonusObjectiveRewards({
      businessLevel: s.business.level,
      currentDay: s.currentDay,
      todayCustomersServed: nextTodayCustomers,
      todayPcsProduced: s.todayStats.pcsProduced,
      totalCustomersServed: nextSalesOrders.length,
      transactions: nextTxs,
    });

    const baseNextRep = updateReputationFromSatisfaction(s.business.reputation, 95);
    const baseRepDelta = baseNextRep - s.business.reputation;
    const adjustedRepDelta = applyDailyEventReputationDelta(
      baseRepDelta,
      95,
      s.activeDailyEvent,
    );
    const nextRep = Math.max(10, Math.min(100, s.business.reputation + adjustedRepDelta));
    const actualRepDelta = nextRep - s.business.reputation;
    const totalLifetimeRev = nextSalesOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    const nextLevel = computeBusinessLevel(
      totalLifetimeRev,
      nextRep,
      s.upgrades,
      s.franchiseBranches.length,
    );
    const nextBusiness: BusinessProfile = {
      ...s.business,
      reputation: nextRep,
      level: nextLevel,
    };
    const nextAchievements = evaluateStoreAchievements(s, {
      salesOrders: nextSalesOrders,
      business: nextBusiness,
    });

    const preOrderRecipe = s.recipes.find((r) => r.id === batch.recipeId);
    const feedback = generateCustomerFeedback({
      id: makeId('fb'),
      customerName: po.customerName,
      archetypeId: po.archetypeId,
      recipeNameEn: preOrderRecipe?.nameEn ?? 'Healthy Dimsum',
      recipeNameId: preOrderRecipe?.nameId ?? 'Dimsum Sehat',
      satisfaction: 95,
      productQuality: batch.qualityScore,
      priceRatioToBudget: 0.7,
      serviceTimeRatio: 1,
      productMatched: true,
      reputationDelta: actualRepDelta,
      newReputation: nextRep,
    });

    const missionResult = applyDailyMissionRewards({
      dailyMissions: s.dailyMissions,
      event: {
        type: 'SALE',
        recipeId: batch.recipeId,
        pcsSold: po.quantityBoxes * batch.pcsPerBox,
        boxesSold: po.quantityBoxes,
        revenueAmount: totalAmount,
        orderType: 'PRE_ORDER',
      },
      currentDay: s.currentDay,
      transactions: bonusCheck.updatedTransactions,
    });

    soundFx.playCashier();
    set({
      cashBalance:
        s.cashBalance + totalAmount + bonusCheck.cashDelta + missionResult.cashDelta,
      productBatches: nextBatches,
      preOrders: s.preOrders.map((p) =>
        p.id === preOrderId ? { ...p, fulfilled: true, accepted: true } : p,
      ),
      salesOrders: nextSalesOrders,
      transactions: missionResult.updatedTransactions,
      dailyMissions: missionResult.updatedMissions,
      unlockedAchievements: nextAchievements,
      celebratingUntil: missionResult.cashDelta > 0 ? Date.now() + 1800 : s.celebratingUntil,
      business: nextBusiness,
      todayStats: {
        ...s.todayStats,
        customersServed: nextTodayCustomers,
        satisfactionSum: s.todayStats.satisfactionSum + 95,
      },
    });
    get().pushFeedbackPopup(feedback);
    for (const claimed of bonusCheck.newlyClaimed) {
      get().pushToast({
        type: 'success',
        textEn: `Bonus Complete: ${claimed.titleEn} (+${formatRupiah(claimed.rewardCash)})!`,
        textId: `Bonus Tercapai: ${claimed.titleId} (+${formatRupiah(claimed.rewardCash)})!`,
      });
    }
    for (const m of missionResult.newlyRewarded) {
      get().pushToast({
        type: 'success',
        textEn: `Mission Complete: ${m.titleEn} (+${formatRupiah(m.rewardCash)} bonus currency added to wallet!)`,
        textId: `Misi Selesai: ${m.titleId} (+${formatRupiah(m.rewardCash)} bonus saldo masuk dompet!)`,
      });
    }
    get().persistNow();
    return { ok: true };
  },

  toggleOnlineDelivery: () => {
    soundFx.playClick();
    set((s) => ({ onlineDeliveryEnabled: !s.onlineDeliveryEnabled }));
    get().persistNow();
  },

  fulfillOnlineOrder: (orderId, productBatchId) => {
    const s = get();
    const order = s.onlineOrders.find((o) => o.id === orderId);
    const batch = s.productBatches.find((b) => b.id === productBatchId);
    if (!order || !batch) {
      return {
        ok: false,
        errorEn: 'Online delivery order or batch not found.',
        errorId: 'Pesanan online atau batch produk tidak ditemukan.',
      };
    }
    if (
      batch.status !== 'PACKAGED' ||
      batch.recipeId !== order.recipeId ||
      batch.packagingTypeId !== order.boxType ||
      batch.boxesAvailable < order.quantityBoxes
    ) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: 'Requires matching recipe, box size, and sufficient stock.',
        errorId: 'Membutuhkan resep, ukuran kotak, dan stok yang sesuai.',
      };
    }

    const grossTotal = order.grossPricePerBox * order.quantityBoxes;
    const adjustedGross = applyDailyEventRevenue(grossTotal, s.activeDailyEvent);
    const commissionTotal = Math.round(adjustedGross * order.commissionRate);
    const netTotal = Math.max(0, adjustedGross - commissionTotal);
    const totalCogs = batch.unitCostPerBox * order.quantityBoxes;
    const salesOrderId = makeId('ojol-sale');

    const newOrder: SalesOrder = {
      id: salesOrderId,
      customerId: order.id,
      customerName: `${order.platform} · ${order.courierName}`,
      archetypeId: 'worker',
      orderType: 'ONLINE_DELIVERY',
      platformName: order.platform,
      platformCommission: commissionTotal,
      productBatchId: batch.id,
      recipeId: batch.recipeId,
      boxType: batch.packagingTypeId,
      quantityBoxes: order.quantityBoxes,
      unitPrice: order.grossPricePerBox,
      discount: commissionTotal,
      totalAmount: netTotal,
      totalCogs,
      satisfaction: 88,
      day: s.currentDay,
      timestamp: Date.now(),
    };

    const nextBatches = s.productBatches.map((b) => {
      if (b.id !== batch.id) return b;
      const rem = b.boxesAvailable - order.quantityBoxes;
      return {
        ...b,
        boxesAvailable: rem,
        status: rem === 0 ? ('SOLD' as const) : ('PACKAGED' as const),
      };
    });

    const nextTxs = appendTransactionIdempotent(s.transactions, {
      id: makeId('tx'),
      type: 'INCOME',
      category: 'SALES_REVENUE',
      amount: netTotal,
      descriptionEn: `${order.platform} net payout (${formatRupiah(adjustedGross)} gross - ${formatRupiah(commissionTotal)} fee)`,
      descriptionId: `Pendapatan bersih ${order.platform} (${formatRupiah(adjustedGross)} kotor - komisi ${formatRupiah(commissionTotal)})`,
      referenceId: salesOrderId,
      day: s.currentDay,
      timestamp: Date.now(),
    });

    const nextSalesOrders = [...s.salesOrders, newOrder];
    const nextTodayCustomers = s.todayStats.customersServed + 1;
    const bonusCheck = applyBonusObjectiveRewards({
      businessLevel: s.business.level,
      currentDay: s.currentDay,
      todayCustomersServed: nextTodayCustomers,
      todayPcsProduced: s.todayStats.pcsProduced,
      totalCustomersServed: nextSalesOrders.length,
      transactions: nextTxs,
    });

    const baseNextRep = updateReputationFromSatisfaction(s.business.reputation, 88);
    const baseRepDelta = baseNextRep - s.business.reputation;
    const adjustedRepDelta = applyDailyEventReputationDelta(
      baseRepDelta,
      88,
      s.activeDailyEvent,
    );
    const nextRep = Math.max(10, Math.min(100, s.business.reputation + adjustedRepDelta));
    const totalLifetimeRev = nextSalesOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    const nextLevel = computeBusinessLevel(
      totalLifetimeRev,
      nextRep,
      s.upgrades,
      s.franchiseBranches.length,
    );
    const nextBusiness: BusinessProfile = {
      ...s.business,
      reputation: nextRep,
      level: nextLevel,
    };
    const nextAchievements = evaluateStoreAchievements(s, {
      salesOrders: nextSalesOrders,
      business: nextBusiness,
    });
    const stillHasStock = nextBatches.some(
      (b) => b.status === 'PACKAGED' && b.boxesAvailable > 0,
    );

    const missionResult = applyDailyMissionRewards({
      dailyMissions: s.dailyMissions,
      event: {
        type: 'SALE',
        recipeId: batch.recipeId,
        pcsSold: order.quantityBoxes * batch.pcsPerBox,
        boxesSold: order.quantityBoxes,
        revenueAmount: netTotal,
        orderType: 'ONLINE_DELIVERY',
      },
      currentDay: s.currentDay,
      transactions: bonusCheck.updatedTransactions,
    });

    soundFx.playCashier();
    set({
      cashBalance:
        s.cashBalance + netTotal + bonusCheck.cashDelta + missionResult.cashDelta,
      productBatches: nextBatches,
      isCarryingProduct: stillHasStock,
      onlineOrders: s.onlineOrders.filter((o) => o.id !== orderId),
      salesOrders: nextSalesOrders,
      transactions: missionResult.updatedTransactions,
      dailyMissions: missionResult.updatedMissions,
      unlockedAchievements: nextAchievements,
      celebratingUntil: missionResult.cashDelta > 0 ? Date.now() + 1800 : s.celebratingUntil,
      business: nextBusiness,
      todayStats: {
        ...s.todayStats,
        customersServed: nextTodayCustomers,
        satisfactionSum: s.todayStats.satisfactionSum + 88,
      },
    });
    get().pushToast({
      type: 'success',
      textEn: `Dispatched ${order.platform} order (+${formatRupiah(netTotal)} net)!`,
      textId: `Pesanan ${order.platform} diserahkan ke kurir (+${formatRupiah(netTotal)} bersih)!`,
    });
    for (const claimed of bonusCheck.newlyClaimed) {
      get().pushToast({
        type: 'success',
        textEn: `Bonus Complete: ${claimed.titleEn} (+${formatRupiah(claimed.rewardCash)})!`,
        textId: `Bonus Tercapai: ${claimed.titleId} (+${formatRupiah(claimed.rewardCash)})!`,
      });
    }
    for (const m of missionResult.newlyRewarded) {
      get().pushToast({
        type: 'success',
        textEn: `Mission Complete: ${m.titleEn} (+${formatRupiah(m.rewardCash)} bonus currency added to wallet!)`,
        textId: `Misi Selesai: ${m.titleId} (+${formatRupiah(m.rewardCash)} bonus saldo masuk dompet!)`,
      });
    }
    get().persistNow();
    return { ok: true };
  },

  closeStoreAndGenerateReport: () => {
    const s = get();
    soundFx.setSteamAmbience(false);
    // Avoid generating duplicate report for the same day
    if (s.dailyReports.some((r) => r.day === s.currentDay)) {
      set({
        gameState: 'FINANCIAL_REPORT',
        activeStation: 'board',
        customers: [],
      });
      return;
    }

    let workingCash = s.cashBalance;
    let remainingDebt = s.unpaidDebt;
    let nextTxs = s.transactions;

    // 0. Collect passive franchise branch royalties before settling daily OPEX
    const passiveRoyaltyIncome = computeTotalFranchiseDailyIncome(
      s.franchiseBranches,
      s.prestigeLevel,
    );
    if (passiveRoyaltyIncome > 0) {
      workingCash += passiveRoyaltyIncome;
      nextTxs = appendTransactionIdempotent(nextTxs, {
        id: makeId('tx'),
        type: 'INCOME',
        category: 'FRANCHISE_INCOME',
        amount: passiveRoyaltyIncome,
        descriptionEn: `Passive franchise royalty (${s.franchiseBranches.length} branch${s.franchiseBranches.length > 1 ? 'es' : ''})`,
        descriptionId: `Royalti pasif waralaba (${s.franchiseBranches.length} cabang)`,
        referenceId: `franchise-income-day-${s.currentDay}`,
        day: s.currentDay,
        timestamp: Date.now(),
      });
    }

    // 1. Auto-settle any prior unpaid debt first if liquid cash is available
    if (remainingDebt > 0 && workingCash > 0) {
      const autoPaid = Math.min(workingCash, remainingDebt);
      workingCash -= autoPaid;
      remainingDebt -= autoPaid;
      nextTxs = appendTransactionIdempotent(nextTxs, {
        id: makeId('tx'),
        type: 'EXPENSE',
        category: 'DEBT_REPAYMENT',
        amount: autoPaid,
        descriptionEn: `Auto-settled prior unpaid OPEX/payroll debt`,
        descriptionId: `Pelunasan otomatis tunggakan OPEX/gaji`,
        referenceId: `debt-autosettle-day-${s.currentDay}`,
        day: s.currentDay,
        timestamp: Date.now(),
      });
    }

    // 2. Assess full daily shop OPEX & staff wages (unpaid shortfall becomes unpaidDebt)
    const opexDue = ECONOMY_RULES.dailyBaseOpex;
    const wagesDue = getTotalDailyStaffWages(s.kitchenStaff);
    const opexPaid = Math.min(workingCash, opexDue);
    const wagesPaid = Math.min(Math.max(0, workingCash - opexPaid), wagesDue);
    const endingCash = workingCash - opexPaid - wagesPaid;
    const unpaidOpex = opexDue - opexPaid;
    const unpaidWages = wagesDue - wagesPaid;
    const nextUnpaidDebt = remainingDebt + unpaidOpex + unpaidWages;

    // Record full accrued OPEX & wages in P&L so low cash never hides expenses
    nextTxs = appendTransactionIdempotent(nextTxs, {
      id: makeId('tx'),
      type: 'EXPENSE',
      category: 'OPERATING_EXPENSE',
      amount: opexDue,
      descriptionEn:
        unpaidOpex > 0
          ? `Day ${s.currentDay} store utilities & rent (${formatRupiah(unpaidOpex)} unpaid)`
          : `Day ${s.currentDay} store utilities & rent`,
      descriptionId:
        unpaidOpex > 0
          ? `Biaya listrik, air & sewa Hari ${s.currentDay} (${formatRupiah(unpaidOpex)} tertunggak)`
          : `Biaya listrik, air & sewa Hari ${s.currentDay}`,
      referenceId: `opex-day-${s.currentDay}`,
      day: s.currentDay,
      timestamp: Date.now(),
    });

    if (wagesDue > 0) {
      nextTxs = appendTransactionIdempotent(nextTxs, {
        id: makeId('tx'),
        type: 'EXPENSE',
        category: 'OPERATING_EXPENSE',
        amount: wagesDue,
        descriptionEn:
          unpaidWages > 0
            ? `Day ${s.currentDay} kitchen helper wages (${s.kitchenStaff.length} staff · ${formatRupiah(unpaidWages)} unpaid)`
            : `Day ${s.currentDay} kitchen helper wages (${s.kitchenStaff.length} staff)`,
        descriptionId:
          unpaidWages > 0
            ? `Gaji asisten dapur Hari ${s.currentDay} (${s.kitchenStaff.length} staf · ${formatRupiah(unpaidWages)} tertunggak)`
            : `Gaji asisten dapur Hari ${s.currentDay} (${s.kitchenStaff.length} staf)`,
        referenceId: `staff-wages-day-${s.currentDay}`,
        day: s.currentDay,
        timestamp: Date.now(),
      });
    }

    // Apply severe morale drop (-20) if payroll could not be paid in full
    const updatedStaffAfterClosing =
      unpaidWages > 0 && s.kitchenStaff.length > 0
        ? s.kitchenStaff.map((m) => ({
            ...m,
            morale: Math.max(5, getStaffMorale(m) - 20),
          }))
        : s.kitchenStaff;

    const report = buildDailyReport({
      day: s.currentDay,
      startingCash: s.dayStartCash,
      endingCash,
      transactions: nextTxs,
      salesOrders: s.salesOrders,
      productBatches: s.productBatches,
      pcsProduced: s.todayStats.pcsProduced,
      boxesPackaged: s.todayStats.boxesPackaged,
      pcsExpired: s.todayStats.pcsExpired,
      inventoryLossValue:
        s.todayStats.inventoryLossValue + (s.todayStats.qcWastedCost ?? 0),
      customersServed: s.todayStats.customersServed,
      customersLost: s.todayStats.customersLost,
      satisfactionSum: s.todayStats.satisfactionSum,
      reputationEnd: s.business.reputation,
    });

    const nextReports = [...s.dailyReports, report];
    const nextAchievements = evaluateStoreAchievements(s, {
      dailyReports: nextReports,
      unpaidDebt: nextUnpaidDebt,
      kitchenStaff: updatedStaffAfterClosing,
    });

    soundFx.playSuccess();
    set({
      cashBalance: endingCash,
      unpaidDebt: nextUnpaidDebt,
      kitchenStaff: updatedStaffAfterClosing,
      transactions: nextTxs,
      dailyReports: nextReports,
      unlockedAchievements: nextAchievements,
      customers: [],
      onlineOrders: [],
      rushHourActive: false,
      gameState: 'FINANCIAL_REPORT',
      activeStation: 'board',
      tutorialStep:
        s.tutorialStep === 'VIEW_REPORT' || s.tutorialStep === 'SERVE_CUSTOMER'
          ? 'COMPLETED'
          : s.tutorialStep,
    });
    if (unpaidWages > 0) {
      get().pushToast({
        type: 'warning',
        textEn: `Payroll shortfall (${formatRupiah(unpaidWages)}) added to debt; team morale dropped -20%!`,
        textId: `Tunggakan gaji (${formatRupiah(unpaidWages)}) masuk utang usaha; moral tim turun -20%!`,
      });
    } else if (unpaidOpex > 0) {
      get().pushToast({
        type: 'warning',
        textEn: `Unpaid OPEX (${formatRupiah(unpaidOpex)}) carried into business debt (+10% overnight fee).`,
        textId: `Tunggakan OPEX (${formatRupiah(unpaidOpex)}) dicatat sebagai utang usaha (+10% bunga semalam).`,
      });
    }
    get().persistNow();
  },

  purchaseUpgrade: (upgradeId) => {
    const s = get();
    const check = canPurchaseUpgrade(s.upgrades, upgradeId, s.cashBalance);
    if (!check.allowed || !check.nextLevel) {
      soundFx.playError();
      return {
        ok: false,
        errorEn:
          check.reason === 'max_level'
            ? 'Already at maximum level.'
            : 'Insufficient cash for this upgrade.',
        errorId:
          check.reason === 'max_level'
            ? 'Sudah mencapai level maksimal.'
            : 'Saldo kas tidak cukup untuk upgrade ini.',
      };
    }

    const nextUpgrades: UpgradeLevels = {
      ...s.upgrades,
      [upgradeId]: check.nextLevel.level,
    };

    const nextTxs = appendTransactionIdempotent(s.transactions, {
      id: makeId('tx'),
      type: 'EXPENSE',
      category: 'UPGRADE_PURCHASE',
      amount: check.nextLevel.cost,
      descriptionEn: `Upgraded ${upgradeId} to Level ${check.nextLevel.level}`,
      descriptionId: `Upgrade ${upgradeId} ke Level ${check.nextLevel.level}`,
      referenceId: `upg-${upgradeId}-${check.nextLevel.level}`,
      day: s.currentDay,
      timestamp: Date.now(),
    });

    const totalLifetimeRev = s.salesOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    const nextBizLevel = computeBusinessLevel(
      totalLifetimeRev,
      s.business.reputation,
      nextUpgrades,
      s.franchiseBranches.length,
    );
    const nextBusiness: BusinessProfile = {
      ...s.business,
      level: nextBizLevel,
    };

    const nextAchievements = evaluateStoreAchievements(s, {
      upgrades: nextUpgrades,
      business: nextBusiness,
    });

    soundFx.playSuccess();
    set({
      cashBalance: s.cashBalance - check.nextLevel.cost,
      upgrades: nextUpgrades,
      business: nextBusiness,
      transactions: nextTxs,
      unlockedAchievements: nextAchievements,
    });
    get().pushToast({
      type: 'success',
      textEn: `Facility upgraded to Level ${check.nextLevel.level}!`,
      textId: `Fasilitas berhasil di-upgrade ke Level ${check.nextLevel.level}!`,
    });
    get().persistNow();
    return { ok: true };
  },

  openFranchiseBranch: (templateId) => {
    const s = get();
    const tpl = getFranchiseBranchTemplate(templateId);
    if (!tpl) {
      return {
        ok: false,
        errorEn: 'Franchise branch template not found.',
        errorId: 'Lokasi cabang waralaba tidak ditemukan.',
      };
    }
    if (s.franchiseBranches.some((b) => b.id === tpl.id)) {
      return {
        ok: false,
        errorEn: 'You already operate a branch in this district.',
        errorId: 'Kamu sudah membuka cabang di kawasan ini.',
      };
    }
    if (s.business.level < tpl.minBusinessLevel) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: `Requires Outlet Level ${tpl.minBusinessLevel}+ (${getOutletTierDef(tpl.minBusinessLevel).nameEn}).`,
        errorId: `Butuh Level Outlet ${tpl.minBusinessLevel}+ (${getOutletTierDef(tpl.minBusinessLevel).nameId}).`,
      };
    }
    if (s.business.reputation < tpl.minReputation) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: `Requires Shop Reputation ${tpl.minReputation}+ to franchise here.`,
        errorId: `Butuh Reputasi Toko ${tpl.minReputation}+ untuk buka cabang ini.`,
      };
    }
    if (s.cashBalance < tpl.investmentCost) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: `Insufficient cash (${formatRupiah(tpl.investmentCost)} required).`,
        errorId: `Saldo kas tidak cukup (butuh ${formatRupiah(tpl.investmentCost)}).`,
      };
    }

    const newBranch: FranchiseBranch = {
      id: tpl.id,
      districtNameEn: tpl.districtNameEn,
      districtNameId: tpl.districtNameId,
      openedDay: s.currentDay,
      investmentCost: tpl.investmentCost,
      dailyNetIncome: tpl.baseDailyIncome,
      level: 1,
      managerBonusPct: 0,
    };
    const nextBranches = [...s.franchiseBranches, newBranch];
    const totalLifetimeRev = s.salesOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    const nextLevel = computeBusinessLevel(
      totalLifetimeRev,
      s.business.reputation,
      s.upgrades,
      nextBranches.length,
    );
    const nextBusiness: BusinessProfile = {
      ...s.business,
      level: nextLevel,
    };
    const nextTxs = appendTransactionIdempotent(s.transactions, {
      id: makeId('tx'),
      type: 'EXPENSE',
      category: 'BRANCH_EXPANSION',
      amount: tpl.investmentCost,
      descriptionEn: `Opened franchise branch: ${tpl.districtNameEn}`,
      descriptionId: `Buka cabang waralaba: ${tpl.districtNameId}`,
      referenceId: `branch-open-${tpl.id}`,
      day: s.currentDay,
      timestamp: Date.now(),
    });

    soundFx.playSuccess();
    set({
      cashBalance: s.cashBalance - tpl.investmentCost,
      franchiseBranches: nextBranches,
      business: nextBusiness,
      transactions: nextTxs,
    });
    get().pushToast({
      type: 'success',
      textEn: `Opened ${tpl.districtNameEn}! Generates +${formatRupiah(tpl.baseDailyIncome)}/day passive income.`,
      textId: `${tpl.districtNameId} resmi dibuka! Hasilkan +${formatRupiah(tpl.baseDailyIncome)}/hari otomatis.`,
    });
    get().persistNow();
    return { ok: true };
  },

  upgradeFranchiseBranch: (branchId) => {
    const s = get();
    const branch = s.franchiseBranches.find((b) => b.id === branchId);
    if (!branch) {
      return {
        ok: false,
        errorEn: 'Franchise branch not found.',
        errorId: 'Cabang waralaba tidak ditemukan.',
      };
    }
    const cost = getFranchiseBranchUpgradeCost(branch);
    if (cost === null || branch.level >= 3) {
      return {
        ok: false,
        errorEn: 'Branch is already at maximum Level 3.',
        errorId: 'Cabang sudah mencapai Level 3 maksimal.',
      };
    }
    if (s.cashBalance < cost) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: `Need ${formatRupiah(cost)} to expand this branch.`,
        errorId: `Butuh ${formatRupiah(cost)} untuk ekspansi cabang ini.`,
      };
    }

    const nextLevel = (branch.level + 1) as 2 | 3;
    const boostedIncome = Math.round((branch.dailyNetIncome * 1.4) / 500) * 500;
    const nextBranches = s.franchiseBranches.map((b) =>
      b.id === branchId
        ? {
            ...b,
            level: nextLevel,
            dailyNetIncome: boostedIncome,
            managerBonusPct: b.managerBonusPct + 40,
          }
        : b,
    );
    const nextTxs = appendTransactionIdempotent(s.transactions, {
      id: makeId('tx'),
      type: 'EXPENSE',
      category: 'BRANCH_EXPANSION',
      amount: cost,
      descriptionEn: `Expanded ${branch.districtNameEn} to Lv ${nextLevel}`,
      descriptionId: `Ekspansi ${branch.districtNameId} ke Lv ${nextLevel}`,
      referenceId: `branch-upg-${branch.id}-lv${nextLevel}`,
      day: s.currentDay,
      timestamp: Date.now(),
    });

    soundFx.playSuccess();
    set({
      cashBalance: s.cashBalance - cost,
      franchiseBranches: nextBranches,
      transactions: nextTxs,
    });
    get().pushToast({
      type: 'success',
      textEn: `${branch.districtNameEn} expanded to Lv ${nextLevel} (${formatRupiah(boostedIncome)}/day)!`,
      textId: `${branch.districtNameId} naik ke Lv ${nextLevel} (${formatRupiah(boostedIncome)}/hari)!`,
    });
    get().persistNow();
    return { ok: true };
  },

  activateEndlessMastery: () => {
    const s = get();
    const check = canUnlockEndlessMastery({
      businessLevel: s.business.level,
      reputation: s.business.reputation,
      franchiseBranchesCount: s.franchiseBranches.length,
      cashBalance: s.cashBalance,
    });
    if (!check.allowed) {
      soundFx.playError();
      const map: Record<string, { en: string; id: string }> = {
        level: {
          en: 'Reach Outlet Level 5 (Franchise Network) first.',
          id: 'Capai Level Outlet 5 (Jaringan Waralaba) terlebih dahulu.',
        },
        reputation: {
          en: 'Requires Shop Reputation 80+ for Endless Mastery.',
          id: 'Butuh Reputasi Toko 80+ untuk Mode Endless Mastery.',
        },
        branch: {
          en: 'Open at least 1 Franchise Branch before activating Mastery.',
          id: 'Buka minimal 1 Cabang Waralaba sebelum aktivasi Mastery.',
        },
        cash: {
          en: `Need ${formatRupiah(ENDLESS_MASTERY_ACTIVATION_COST)} certification fee.`,
          id: `Butuh biaya sertifikasi ${formatRupiah(ENDLESS_MASTERY_ACTIVATION_COST)}.`,
        },
      };
      const msg = map[check.reason ?? 'level'];
      return { ok: false, errorEn: msg.en, errorId: msg.id };
    }

    const nextPrestige = s.prestigeLevel + 1;
    const nextTxs = appendTransactionIdempotent(s.transactions, {
      id: makeId('tx'),
      type: 'EXPENSE',
      category: 'BRANCH_EXPANSION',
      amount: ENDLESS_MASTERY_ACTIVATION_COST,
      descriptionEn: `Endless Mastery Prestige Certification (Rank ★${nextPrestige})`,
      descriptionId: `Sertifikasi Prestise Endless Mastery (Peringkat ★${nextPrestige})`,
      referenceId: `endless-mastery-rank-${nextPrestige}`,
      day: s.currentDay,
      timestamp: Date.now(),
    });

    soundFx.playSuccess();
    set({
      cashBalance: s.cashBalance - ENDLESS_MASTERY_ACTIVATION_COST,
      endlessMasteryUnlocked: true,
      prestigeLevel: nextPrestige,
      transactions: nextTxs,
    });
    get().pushToast({
      type: 'success',
      textEn: `Endless Mastery Rank ★${nextPrestige} unlocked! All franchise royalties +15%!`,
      textId: `Endless Mastery Peringkat ★${nextPrestige} aktif! Semua royalti cabang +15%!`,
    });
    get().persistNow();
    return { ok: true };
  },

  hireKitchenHelper: (helperId) => {
    const s = get();
    if (s.kitchenStaff.some((h) => h.id === helperId)) {
      return {
        ok: false,
        errorEn: 'This kitchen helper is already on your team.',
        errorId: 'Asisten dapur ini sudah bergabung di timmu.',
      };
    }
    const def = getKitchenHelperDef(helperId);
    if (s.cashBalance < def.hireCost) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: 'Insufficient cash balance to hire this helper.',
        errorId: 'Saldo kas tidak mencukupi untuk merekrut asisten ini.',
      };
    }

    const nextTxs = appendTransactionIdempotent(s.transactions, {
      id: makeId('tx'),
      type: 'EXPENSE',
      category: 'STAFF_EXPENSE',
      amount: def.hireCost,
      descriptionEn: `Hired ${def.name} (${def.roleEn})`,
      descriptionId: `Rekrut ${def.name} (${def.roleId})`,
      referenceId: makeId(`hire-${helperId}`),
      day: s.currentDay,
      timestamp: Date.now(),
    });

    const nextStaff: KitchenHelperState[] = [
      ...s.kitchenStaff,
      {
        id: helperId,
        level: 1,
        hiredDay: s.currentDay,
        morale: DEFAULT_STAFF_MORALE,
        shift: 'kitchen',
        consecutiveWorkBatches: 0,
        unlockedSkills: [],
        totalTrainingSec: 0,
      },
    ];
    const nextAchievements = evaluateStoreAchievements(s, {
      kitchenStaff: nextStaff,
    });

    soundFx.playSuccess();
    set({
      cashBalance: s.cashBalance - def.hireCost,
      kitchenStaff: nextStaff,
      transactions: nextTxs,
      unlockedAchievements: nextAchievements,
    });
    get().pushToast({
      type: 'success',
      textEn: `${def.name} joined your kitchen team!`,
      textId: `${def.name} resmi bergabung di dapur!`,
    });
    get().persistNow();
    return { ok: true };
  },

  trainKitchenHelper: (helperId) => {
    const s = get();
    const member = s.kitchenStaff.find((h) => h.id === helperId);
    if (!member) {
      return {
        ok: false,
        errorEn: 'Helper is not currently hired.',
        errorId: 'Asisten belum direkrut.',
      };
    }
    const def = getKitchenHelperDef(helperId);
    const trainCost = getKitchenHelperTrainCost(def, member.level);
    if (trainCost === null || member.level >= 3) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: 'Helper is already at maximum skill level.',
        errorId: 'Asisten sudah mencapai level keahlian maksimal.',
      };
    }
    if (s.cashBalance < trainCost) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: 'Insufficient cash for staff training.',
        errorId: 'Saldo kas tidak mencukupi untuk pelatihan staf.',
      };
    }

    const nextLevel = (member.level + 1) as 2 | 3;
    const nextTxs = appendTransactionIdempotent(s.transactions, {
      id: makeId('tx'),
      type: 'EXPENSE',
      category: 'STAFF_EXPENSE',
      amount: trainCost,
      descriptionEn: `Trained ${def.name} to Level ${nextLevel}`,
      descriptionId: `Latih ${def.name} ke Level ${nextLevel}`,
      referenceId: makeId(`train-${helperId}-lv${nextLevel}`),
      day: s.currentDay,
      timestamp: Date.now(),
    });

    soundFx.playSuccess();
    set({
      cashBalance: s.cashBalance - trainCost,
      kitchenStaff: s.kitchenStaff.map((h) =>
        h.id === helperId ? { ...h, level: nextLevel } : h,
      ),
      transactions: nextTxs,
    });
    get().pushToast({
      type: 'success',
      textEn: `${def.name} trained to Level ${nextLevel}!`,
      textId: `${def.name} naik ke Level ${nextLevel}!`,
    });
    get().persistNow();
    return { ok: true };
  },

  startStaffSkillTraining: (helperId, nodeId) => {
    const s = get();
    if (s.activeSkillTraining) {
      return {
        ok: false,
        errorEn: 'A training session is already in progress. Finish or cancel it first.',
        errorId: 'Sesi latihan lain sedang berjalan. Selesaikan atau batalkan dahulu.',
      };
    }
    const member = s.kitchenStaff.find((h) => h.id === helperId);
    const check = canTrainSkillNode(member, nodeId, s.currentDay);
    const node = getSkillNodeById(nodeId);
    if (!check.allowed || !node) {
      soundFx.playError();
      const errMap: Record<string, { en: string; id: string }> = {
        not_hired: {
          en: 'Hire this specialist before starting skill training.',
          id: 'Rekrut asisten ini terlebih dahulu sebelum melatih skill.',
        },
        missing_prereq: {
          en: 'Complete the prerequisite skill node first.',
          id: 'Selesaikan node skill prasyarat terlebih dahulu.',
        },
        insufficient_level: {
          en: `Requires helper Level ${node?.tier ?? 2} first (train level in Roster).`,
          id: `Butuh asisten Level ${node?.tier ?? 2} dahulu (latih level di Daftar Staf).`,
        },
        daily_limit: {
          en: 'This helper already completed today’s skill drill (1/day limit).',
          id: 'Asisten ini sudah menyelesaikan latihan skill hari ini (maks 1/hari).',
        },
        low_morale: {
          en: 'Morale is too low (<35%). Assign a Wellness shift before training.',
          id: 'Moral terlalu rendah (<35%). Beri shift Wellness sebelum latihan.',
        },
      };
      const msg = errMap[check.reason ?? ''] ?? {
        en: 'This skill node is already unlocked.',
        id: 'Skill ini sudah terbuka.',
      };
      return { ok: false, errorEn: msg.en, errorId: msg.id };
    }

    if (s.cashBalance < node.trainingCost) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: `Need ${formatRupiah(node.trainingCost)} for skill training materials.`,
        errorId: `Butuh ${formatRupiah(node.trainingCost)} untuk biaya materi latihan skill.`,
      };
    }

    soundFx.playClick();
    set({
      cashBalance: s.cashBalance - node.trainingCost,
      activeSkillTraining: {
        helperId,
        nodeId,
        startedAt: Date.now(),
        durationMs: node.trainingDurationSec * 1000,
      },
    });
    get().persistNow();
    return { ok: true };
  },

  cancelStaffSkillTraining: () => {
    const s = get();
    const active = s.activeSkillTraining;
    if (!active) return;
    const node = getSkillNodeById(active.nodeId);
    const refund = node?.trainingCost ?? 0;
    soundFx.playClick();
    set({
      cashBalance: s.cashBalance + refund,
      activeSkillTraining: null,
    });
    get().persistNow();
  },

  completeStaffSkillTraining: () => {
    const s = get();
    const active = s.activeSkillTraining;
    if (!active) return;
    const node = getSkillNodeById(active.nodeId);
    const def = getKitchenHelperDef(active.helperId);
    if (!node) {
      set({ activeSkillTraining: null });
      return;
    }

    const nextTxs =
      node.trainingCost > 0
        ? appendTransactionIdempotent(s.transactions, {
            id: makeId('tx'),
            type: 'EXPENSE',
            category: 'STAFF_EXPENSE',
            amount: node.trainingCost,
            descriptionEn: `Skill training for ${def.name}: ${node.titleEn}`,
            descriptionId: `Latihan skill ${def.name}: ${node.titleId}`,
            referenceId: makeId(`skill-${active.helperId}-${active.nodeId}`),
            day: s.currentDay,
            timestamp: Date.now(),
          })
        : s.transactions;

    const nextStaff = s.kitchenStaff.map((h) =>
      h.id === active.helperId
        ? unlockStaffSkillNode(h, active.nodeId, node.trainingDurationSec, s.currentDay)
        : h,
    );
    const nextAchievements = evaluateStoreAchievements(s, {
      kitchenStaff: nextStaff,
    });

    soundFx.playSuccess();
    set({
      activeSkillTraining: null,
      transactions: nextTxs,
      kitchenStaff: nextStaff,
      unlockedAchievements: nextAchievements,
    });
    get().pushToast({
      type: 'success',
      textEn: `${def.name} mastered "${node.titleEn}"!`,
      textId: `${def.name} menguasai "${node.titleId}"!`,
    });
    get().persistNow();
  },

  setKitchenHelperShift: (helperId, shift) => {
    const s = get();
    const member = s.kitchenStaff.find((h) => h.id === helperId);
    if (!member || (member.shift ?? 'kitchen') === shift) return;
    const def = getKitchenHelperDef(helperId);
    const currentMorale = getStaffMorale(member);

    let nextMorale = currentMorale;
    let nextWellnessDay = member.lastWellnessDay;
    let gainedInstant = false;

    if (shift === 'wellness' && member.lastWellnessDay !== s.currentDay) {
      nextMorale = Math.min(100, currentMorale + WELLNESS_SHIFT_INSTANT_BOOST);
      nextWellnessDay = s.currentDay;
      gainedInstant = true;
    }

    soundFx.playSuccess();
    set({
      kitchenStaff: s.kitchenStaff.map((h) =>
        h.id === helperId
          ? {
              ...h,
              shift,
              morale: nextMorale,
              consecutiveWorkBatches: 0,
              lastWellnessDay: nextWellnessDay,
            }
          : h,
      ),
    });

    if (shift === 'wellness') {
      get().pushToast({
        type: 'success',
        textEn: gainedInstant
          ? `${def.name} assigned to Wellness shift (+${nextMorale - currentMorale}% morale).`
          : `${def.name} assigned to Wellness shift to rest and recover.`,
        textId: gainedInstant
          ? `${def.name} masuk shift Wellness (+${nextMorale - currentMorale}% moral).`
          : `${def.name} masuk shift Wellness untuk beristirahat.`,
      });
    } else {
      get().pushToast({
        type: 'info',
        textEn: `${def.name} returned to Kitchen shift.`,
        textId: `${def.name} kembali ke shift Dapur.`,
      });
    }
    get().persistNow();
  },

  fireKitchenHelper: (helperId) => {
    const s = get();
    if (!s.kitchenStaff.some((h) => h.id === helperId)) return;
    const def = getKitchenHelperDef(helperId);
    const firingActiveTraining = s.activeSkillTraining?.helperId === helperId;
    const refundedTrainingCost =
      firingActiveTraining && s.activeSkillTraining
        ? getSkillNodeById(s.activeSkillTraining.nodeId)?.trainingCost ?? 0
        : 0;
    soundFx.playClick();
    set({
      cashBalance: s.cashBalance + refundedTrainingCost,
      kitchenStaff: s.kitchenStaff.filter((h) => h.id !== helperId),
      activeSkillTraining: firingActiveTraining ? null : s.activeSkillTraining,
    });
    get().pushToast({
      type: 'info',
      textEn: `${def.name} has been dismissed from the kitchen.`,
      textId: `${def.name} telah diberhentikan dari tim dapur.`,
    });
    get().persistNow();
  },

  repayDebt: (amount) => {
    const s = get();
    if (s.unpaidDebt <= 0) {
      return {
        ok: false,
        errorEn: 'No unpaid business debt.',
        errorId: 'Tidak ada tunggakan utang usaha.',
      };
    }
    if (s.cashBalance <= 0) {
      soundFx.playError();
      return {
        ok: false,
        errorEn: 'Insufficient cash balance to pay debt.',
        errorId: 'Saldo kas tidak mencukupi untuk melunasi tunggakan.',
      };
    }
    const targetPay =
      typeof amount === 'number' && amount > 0
        ? Math.min(Math.round(amount), s.unpaidDebt, s.cashBalance)
        : Math.min(s.unpaidDebt, s.cashBalance);

    if (targetPay <= 0) {
      return {
        ok: false,
        errorEn: 'Invalid repayment amount.',
        errorId: 'Nominal pelunasan tidak valid.',
      };
    }

    const nextTxs = appendTransactionIdempotent(s.transactions, {
      id: makeId('tx'),
      type: 'EXPENSE',
      category: 'DEBT_REPAYMENT',
      amount: targetPay,
      descriptionEn: `Repaid unpaid OPEX/payroll debt`,
      descriptionId: `Pelunasan tunggakan OPEX/gaji`,
      referenceId: makeId('debt-repay'),
      day: s.currentDay,
      timestamp: Date.now(),
    });

    soundFx.playSuccess();
    set({
      cashBalance: s.cashBalance - targetPay,
      unpaidDebt: s.unpaidDebt - targetPay,
      transactions: nextTxs,
    });
    get().pushToast({
      type: 'success',
      textEn: `Paid ${formatRupiah(targetPay)} toward business debt.`,
      textId: `Membayar ${formatRupiah(targetPay)} untuk pelunasan tunggakan.`,
    });
    get().persistNow();
    return { ok: true };
  },

  trackDailyMissionProgress: (event) => {
    const s = get();
    const result = applyDailyMissionRewards({
      dailyMissions: s.dailyMissions,
      event,
      currentDay: s.currentDay,
      transactions: s.transactions,
    });

    const changed =
      result.cashDelta > 0 ||
      result.newlyRewarded.length > 0 ||
      result.updatedMissions.some(
        (m, idx) =>
          m.current !== s.dailyMissions[idx]?.current ||
          m.completed !== s.dailyMissions[idx]?.completed ||
          m.claimed !== s.dailyMissions[idx]?.claimed,
      );

    if (!changed) {
      return { newlyRewarded: [], bonusGranted: 0 };
    }

    if (result.cashDelta > 0) {
      soundFx.playCashier();
    }

    set({
      cashBalance: s.cashBalance + result.cashDelta,
      dailyMissions: result.updatedMissions,
      transactions: result.updatedTransactions,
      celebratingUntil:
        result.cashDelta > 0 ? Date.now() + 1800 : s.celebratingUntil,
    });

    for (const m of result.newlyRewarded) {
      get().pushToast({
        type: 'success',
        textEn: `Mission Complete: ${m.titleEn} (+${formatRupiah(m.rewardCash)} bonus currency added to wallet!)`,
        textId: `Misi Selesai: ${m.titleId} (+${formatRupiah(m.rewardCash)} bonus saldo masuk dompet!)`,
      });
    }

    get().persistNow();
    return { newlyRewarded: result.newlyRewarded, bonusGranted: result.cashDelta };
  },

  claimDailyMission: (missionId) => {
    const s = get();
    const res = claimDailyMissionReward(s.dailyMissions, missionId);
    if (!res.ok || !res.claimedMission) {
      return { ok: false };
    }

    const refId = `daily-mission-day-${s.currentDay}-${res.claimedMission.id}`;
    const alreadyPaid = s.transactions.some(
      (tx) => tx.category === 'GOAL_BONUS' && tx.referenceId === refId,
    );
    const nextTxs = alreadyPaid
      ? s.transactions
      : appendTransactionIdempotent(s.transactions, {
          id: makeId('tx'),
          type: 'INCOME',
          category: 'GOAL_BONUS',
          amount: res.rewardCash,
          descriptionEn: `Daily Mission Reward: ${res.claimedMission.titleEn}`,
          descriptionId: `Hadiah Misi Harian: ${res.claimedMission.titleId}`,
          referenceId: refId,
          day: s.currentDay,
          timestamp: Date.now(),
        });

    const cashDelta = alreadyPaid ? 0 : res.rewardCash;
    soundFx.playCashier();
    set({
      cashBalance: s.cashBalance + cashDelta,
      dailyMissions: res.missions,
      transactions: nextTxs,
      celebratingUntil: Date.now() + 1400,
    });
    get().pushToast({
      type: 'success',
      textEn: `Mission Reward Claimed: ${res.claimedMission.titleEn} (+${formatRupiah(res.rewardCash)})!`,
      textId: `Hadiah Misi Diklaim: ${res.claimedMission.titleId} (+${formatRupiah(res.rewardCash)})!`,
    });
    get().persistNow();
    return { ok: true, rewardCash: res.rewardCash };
  },

  claimAllDailyMissions: () => {
    const s = get();
    const claimable = s.dailyMissions.filter((m) => m.completed && !m.claimed);
    if (claimable.length === 0) {
      return { ok: false, totalRewardCash: 0, claimedCount: 0 };
    }

    let nextMissions = s.dailyMissions;
    let nextTxs = s.transactions;
    let totalCashDelta = 0;
    let claimedCount = 0;

    for (const item of claimable) {
      const res = claimDailyMissionReward(nextMissions, item.id);
      if (!res.ok || !res.claimedMission) continue;
      nextMissions = res.missions;
      const refId = `daily-mission-day-${s.currentDay}-${res.claimedMission.id}`;
      const alreadyPaid = nextTxs.some(
        (tx) => tx.category === 'GOAL_BONUS' && tx.referenceId === refId,
      );
      if (!alreadyPaid) {
        nextTxs = appendTransactionIdempotent(nextTxs, {
          id: makeId('tx'),
          type: 'INCOME',
          category: 'GOAL_BONUS',
          amount: res.rewardCash,
          descriptionEn: `Daily Mission Reward: ${res.claimedMission.titleEn}`,
          descriptionId: `Hadiah Misi Harian: ${res.claimedMission.titleId}`,
          referenceId: refId,
          day: s.currentDay,
          timestamp: Date.now(),
        });
        totalCashDelta += res.rewardCash;
      }
      claimedCount += 1;
    }

    soundFx.playCashier();
    set({
      cashBalance: s.cashBalance + totalCashDelta,
      dailyMissions: nextMissions,
      transactions: nextTxs,
      celebratingUntil: Date.now() + 1600,
    });
    get().pushToast({
      type: 'success',
      textEn: `Claimed ${claimedCount} Daily Mission reward(s) (+${formatRupiah(totalCashDelta)})!`,
      textId: `Berhasil mengklaim ${claimedCount} hadiah Misi Harian (+${formatRupiah(totalCashDelta)})!`,
    });
    get().persistNow();
    return { ok: true, totalRewardCash: totalCashDelta, claimedCount };
  },

  advanceToNextDay: () => {
    const s = get();
    const nextDay = s.currentDay + 1;

    // 0. Overnight 10% late interest on carried-over unpaid debt
    const overnightInterest =
      s.unpaidDebt > 0 ? Math.max(1_000, Math.round(s.unpaidDebt * 0.1)) : 0;
    const nextUnpaidDebt = s.unpaidDebt + overnightInterest;

    // 1. Expire old ingredient lots
    const ingExpiry = expireOldLots(s.ingredientLots, nextDay);

    // 2. Expire old packaged products & QC batches
    let expiredPcs = 0;
    let expiredProductLoss = 0;
    const updatedProductBatches = s.productBatches.map((b) => {
      if (b.status === 'PACKAGED' && b.boxesAvailable > 0 && b.expiryDay < nextDay) {
        expiredPcs += b.boxesAvailable * b.pcsPerBox;
        expiredProductLoss += b.boxesAvailable * b.unitCostPerBox;
        return { ...b, status: 'EXPIRED' as const };
      }
      return b;
    });

    const updatedProductionBatches = s.productionBatches.map((b) => {
      if (b.status === 'QC_PASSED' && b.quantity > 0 && b.expiryDay < nextDay) {
        expiredPcs += b.quantity;
        expiredProductLoss +=
          b.ingredientCost + b.operationalCost + b.laborCost;
        return { ...b, status: 'EXPIRED' as const };
      }
      return b;
    });

    const bankrupt = checkBankruptcy(
      s.cashBalance,
      updatedProductBatches,
      updatedProductionBatches,
      ingExpiry.remainingLots,
      s.recipes,
      nextDay,
      nextUnpaidDebt,
    );

    if (bankrupt) {
      soundFx.stopBgm();
      soundFx.setSteamAmbience(false);
      soundFx.playError();
      set({
        currentDay: nextDay,
        unpaidDebt: nextUnpaidDebt,
        ingredientLots: ingExpiry.remainingLots,
        productBatches: updatedProductBatches,
        productionBatches: updatedProductionBatches,
        activeSkillTraining: null,
        activeDelegation: null,
        gameState: 'GAME_OVER',
        activeStation: null,
      });
      get().persistNow();
      return;
    }

    const totalExpiryLoss = ingExpiry.expiredLossValue + expiredProductLoss;
    if (totalExpiryLoss > 0) {
      get().pushToast({
        type: 'warning',
        textEn: `Morning audit: ${expiredPcs} pcs / ${ingExpiry.expiredLotsCount} ingredient lots expired.`,
        textId: `Audit pagi: ${expiredPcs} pcs / ${ingExpiry.expiredLotsCount} lot bahan kedaluwarsa.`,
      });
    }

    const nextDailyEvent = pickDailyShopEvent(nextDay, s.activeDailyEvent?.id);

    // Check overdue vs active multi-day B2B contracts
    const missedContracts = s.preOrders.filter(
      (po) => po.accepted && !po.fulfilled && po.dueDay < nextDay,
    );
    const carriedContracts = s.preOrders.filter(
      (po) => po.accepted && !po.fulfilled && po.dueDay >= nextDay,
    );
    const contractRepPenalty = missedContracts.reduce(
      (sum, po) => sum + (po.penaltyReputation ?? 2),
      0,
    );

    const nextDayRep = Math.max(
      10,
      Math.min(
        100,
        s.business.reputation + nextDailyEvent.reputationOnStart - contractRepPenalty,
      ),
    );

    const freshPreOrders = generateDailyPreOrders(nextDay, s.recipes, nextDayRep);
    const nextPreOrders = [...carriedContracts, ...freshPreOrders];

    // Track zero-waste streak across completed business days
    const prevWasteCost =
      (s.todayStats.qcWastedCost ?? 0) + s.todayStats.inventoryLossValue + totalExpiryLoss;
    const nextZeroWasteStreak =
      prevWasteCost === 0 ? s.zeroWasteStreakDays + 1 : 0;

    const nextBusiness: BusinessProfile = {
      ...s.business,
      reputation: nextDayRep,
    };
    const nextAchievements = evaluateStoreAchievements(s, {
      currentDay: nextDay,
      business: nextBusiness,
      unpaidDebt: nextUnpaidDebt,
      zeroWasteStreakDays: nextZeroWasteStreak,
    });

    const recoveredSuppliers: Record<string, SupplierRelationshipState> = {};
    for (const [supName, rel] of Object.entries(s.supplierRelationships)) {
      recoveredSuppliers[supName] = recoverSupplierTrustOvernight(rel);
    }

    const nextFestival = getWeeklyFestivalForDay(nextDay);
    const nextRival = advanceRivalShopState(
      s.rivalShop,
      nextDay,
      s.researchedRecipeIds.length,
      nextDayRep,
    );

    soundFx.playClick();
    set({
      currentDay: nextDay,
      dayStartCash: s.cashBalance,
      unpaidDebt: nextUnpaidDebt,
      gameState: 'MORNING_PREP',
      activeStation: null,
      activeDelegation: null,
      customers: [],
      onlineOrders: [],
      rushHourActive: false,
      zeroWasteStreakDays: nextZeroWasteStreak,
      ingredientLots: ingExpiry.remainingLots,
      productBatches: updatedProductBatches,
      productionBatches: updatedProductionBatches,
      kitchenStaff: s.kitchenStaff.map(computeStaffMoraleOvernight),
      supplierRelationships: recoveredSuppliers,
      activeSupplierDeals: {},
      business: nextBusiness,
      preOrders: nextPreOrders,
      unlockedAchievements: nextAchievements,
      prestigeLevel: s.prestigeLevel,
      dailyMissions: generateDailyMissions({
        day: nextDay,
        businessLevel: nextBusiness.level,
        recipes: s.recipes,
        upgrades: s.upgrades,
      }),
      activeMarketEvent: pickDailyMarketEvent(nextDay),
      activeDailyEvent: nextDailyEvent,
      activeFestival: nextFestival,
      rivalShop: nextRival,
      storeTimeRemainingSec: ECONOMY_RULES.storeOpenDurationSec,
      tutorialStep: s.tutorialStep === 'COMPLETED' ? 'NONE' : s.tutorialStep,
      todayStats: {
        ...EMPTY_TODAY_STATS,
        pcsExpired: expiredPcs,
        inventoryLossValue: totalExpiryLoss,
      },
    });
    if (missedContracts.length > 0) {
      get().pushToast({
        type: 'warning',
        textEn: `Missed ${missedContracts.length} B2B contract deadline (-${contractRepPenalty} Rep).`,
        textId: `Melewati tenggat ${missedContracts.length} kontrak B2B (-${contractRepPenalty} Rep).`,
      });
    }
    if (nextFestival) {
      get().pushToast({
        type: 'success',
        textEn: `Weekly Festival Today: ${nextFestival.titleEn} (2x Traffic)!`,
        textId: `Festival Mingguan Hari Ini: ${nextFestival.titleId} (Trafik 2x)!`,
      });
    }
    get().pushToast({
      type: nextDailyEvent.kind === 'positive' ? 'success' : 'warning',
      textEn: `${nextDailyEvent.titleEn} (${nextDailyEvent.impactTagEn})`,
      textId: `${nextDailyEvent.titleId} (${nextDailyEvent.impactTagId})`,
    });
    get().persistNow();
  },

  skipTutorial: () => {
    soundFx.playClick();
    set({ tutorialStep: 'NONE' });
    get().persistNow();
  },
}));
