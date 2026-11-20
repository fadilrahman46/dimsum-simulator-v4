import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  CAPITAL_DIFFICULTIES,
  DAILY_EVENTS,
  DEFAULT_STAFF_MORALE,
  DINE_IN_REVENUE_MULTIPLIER,
  INITIAL_RECIPES,
  KITCHEN_HELPER_ROSTER,
  OUTLET_TIERS,
  PACKAGING_TYPES,
  RECIPE_RESEARCH_DEFS,
  UPGRADE_DEFS,
  WEEKLY_FESTIVALS,
  advanceRivalShopState,
  applyDailyEventReputationDelta,
  applyDailyEventRevenue,
  computeAverageTeamMorale,
  computeStaffMoraleAfterBatch,
  computeStaffMoraleOvernight,
  computeTotalFranchiseDailyIncome,
  createDefaultUpgrades,
  createInitialRivalShop,
  createStarterIngredientLots,
  createStarterPackagingStock,
  doesRecipeMatchFestival,
  evaluateBonusObjectives,
  getCapitalDifficultyConfig,
  getDailyCustomerGoal,
  getDailyProductionGoal,
  getDailyRevenueGoal,
  getDailyWastageLimit,
  getDineInCapacity,
  getEffectiveHelperQualityBonus,
  getEffectiveHelperSpeedMultiplier,
  getFranchiseBranchUpgradeCost,
  getKitchenHelperQualityBonus,
  getKitchenHelperTrainCost,
  getNextUpcomingFestival,
  getOutletTierDef,
  getRushHourPhase,
  getStaffMorale,
  getStaffMoraleTier,
  getTotalDailyStaffWages,
  getWeeklyFestivalForDay,
  isFestivalDay,
  isRushHourWindow,
  pickDailyShopEvent,
} from '../src/config/gameBalance';
import {
  calculateCustomerSatisfaction,
  generateCustomerFeedback,
  generateDailyPreOrders,
  generateOnlineDeliveryOrder,
  getReputationTrafficBonusPct,
  getTrafficMultiplier,
  spawnCustomerAgent,
} from '../src/domain/customerEngine';
import {
  applyDailyMissionProgress,
  claimDailyMissionReward,
  generateDailyMissions,
} from '../src/domain/dailyMissionsEngine';
import {
  ENDLESS_MASTERY_ACTIVATION_COST,
  canUnlockEndlessMastery,
  computeBusinessLevel,
  computeNetWorth,
  evaluateAchievements,
  updateReputationFromSatisfaction,
} from '../src/domain/progressionEngine';
import {
  appendTransactionIdempotent,
  buildDailyReport,
  calculateHPP,
  calculateRecommendedSellingPrice,
  calculateSales,
  checkBankruptcy,
} from '../src/domain/financeEngine';
import {
  consumeIngredientsFEFO,
  expireOldLots,
  getAvailableStockByIngredient,
} from '../src/domain/inventoryEngine';
import {
  applyClearanceDiscountToBatch,
  calculateQualityScore,
  checkDelegationEligibility,
  computeDelegatedCookingPlan,
  evaluateQualityControl,
  packageProductionBatch,
  packageRecipeBatchesFEFO,
} from '../src/domain/productionEngine';
import {
  checkRecipeAvailability,
  estimateRecipeIngredientCost,
  getAdjustedPackPrice,
} from '../src/domain/recipeEngine';
import {
  acceptCurrentCounterOffer,
  applySupplierDealToPackPrice,
  evaluateNegotiationRound,
  getSupplierPriceMultiplier,
  getSupplierRelationshipTier,
  recoverSupplierTrustOvernight,
  startNegotiationSession,
} from '../src/domain/negotiationEngine';
import {
  STAFF_SKILL_TREE,
  canTrainSkillNode,
  computeHelperSkillEffects,
  getSkillNodesForRole,
  unlockStaffSkillNode,
} from '../src/domain/staffSkillTree';
import {
  STEAM_CONSTANTS,
  computeMixStartingRatios,
  getMixProfileForRecipe,
  getSteamProfileForRecipe,
  getWrapPatternForRecipe,
  computeNextSteamTemp,
} from '../src/domain/cookingMiniGames';
import { translateQualityCategory, translateStageLabel } from '../src/i18n/translations';
import {
  CAMERA_ORBIT_BOUNDS,
  CAMERA_ZOOM_BOUNDS,
  clampCameraOrbitYaw,
  clampCameraPitchOffset,
  clampCameraZoom,
  computeCameraOffset,
} from '../src/game/isoUtils';
import {
  computeCashierShowcaseLayout,
  computeShopDecorationVisualState,
} from '../src/game/showcaseHelpers';
import { migrateSaveSnapshot } from '../src/persistence/indexedDb';
import { soundFx } from '../src/utils/audio';
import type {
  FinancialTransaction,
  IngredientLot,
  KitchenHelperState,
  ProductBatch,
  ProductionBatch,
  SalesOrder,
} from '../src/types/game';

describe('Dimsumpreneur Domain Engine', () => {
  it('calculates HPP and recommended selling price deterministically', () => {
    const hpp = calculateHPP(
      {
        ingredientCost: 12_000,
        packagingCost: 1_000,
        operationalCost: 1_500,
        laborCost: 2_500,
      },
      2,
    );
    expect(hpp.totalCost).toBe(17_000);
    expect(hpp.unitCost).toBe(8_500);

    const sp = calculateRecommendedSellingPrice(hpp.unitCost, 0.5);
    expect(sp).toBe(12_800); // 8500 * 1.5 = 12750 rounded to nearest Rp100 => 12800
  });

  it('validates sales calculation and rejects invalid discount', () => {
    const sale = calculateSales({ quantity: 2, unitPrice: 12_500, discount: 1_000 });
    expect(sale.subtotal).toBe(25_000);
    expect(sale.total).toBe(24_000);

    expect(() =>
      calculateSales({ quantity: 1, unitPrice: 10_000, discount: 12_000 }),
    ).toThrow();
  });

  it('consumes ingredients using FEFO order and FIFO lot cost', () => {
    const lots: IngredientLot[] = [
      {
        id: 'lot-later-expiry',
        ingredientId: 'chicken',
        quantityRemaining: 200,
        initialQuantity: 200,
        unitCostPerBaseUnit: 50,
        totalLotCost: 10_000,
        purchasedDay: 1,
        expiryDay: 5,
        quality: 95,
      },
      {
        id: 'lot-sooner-expiry',
        ingredientId: 'chicken',
        quantityRemaining: 60,
        initialQuantity: 60,
        unitCostPerBaseUnit: 40,
        totalLotCost: 2_400,
        purchasedDay: 2,
        expiryDay: 3,
        quality: 90,
      },
    ];

    const res = consumeIngredientsFEFO(
      lots,
      [{ ingredientId: 'chicken', quantity: 100 }],
      2,
      1,
    );

    // Takes all 60g from expiryDay=3 (cost 2400) + 40g from expiryDay=5 (cost 2000)
    expect(res.totalIngredientCost).toBe(4_400);
    expect(res.updatedLots).toHaveLength(1);
    expect(res.updatedLots[0].id).toBe('lot-later-expiry');
    expect(res.updatedLots[0].quantityRemaining).toBe(160);
  });

  it('expires old ingredient lots and computes exact inventory loss', () => {
    const lots = createStarterIngredientLots(1);
    const cleaned = expireOldLots(lots, 5); // shrimp (exp 3), chicken (exp 4), wrapper (exp 5)
    expect(cleaned.expiredLotsCount).toBeGreaterThan(0);
    expect(cleaned.expiredLossValue).toBeGreaterThan(0);
    expect(cleaned.remainingLots.every((l) => l.expiryDay >= 5)).toBe(true);
  });

  it('calculates exact GDD weighted QC score and rejects packaging failed batches', () => {
    const q = calculateQualityScore({
      recipeAccuracy: 100,
      mixingQuality: 80,
      wrappingQuality: 90,
      steamingQuality: 85,
      hygieneCompliance: 90,
    });
    // 25 + 16 + 18 + 17 + 13.5 = 89.5 => 90
    expect(q).toBe(90);

    const failedBatch: ProductionBatch = {
      id: 'b-fail',
      recipeId: 'chicken_carrot',
      quantity: 10,
      ingredientCost: 8_000,
      operationalCost: 1_500,
      laborCost: 2_500,
      scores: {
        recipeAccuracy: 40,
        mixingQuality: 45,
        wrappingQuality: 50,
        steamingQuality: 50,
        hygieneCompliance: 60,
      },
      qualityScore: 0,
      qualityCategory: 'Poor',
      status: 'PROCESSING',
      producedDay: 1,
      expiryDay: 3,
    };

    const evaluated = evaluateQualityControl(failedBatch, 60);
    expect(evaluated.status).toBe('QC_FAILED');

    expect(() =>
      packageProductionBatch({
        productionBatch: evaluated,
        packagingTypeId: 'paper_box',
        boxCount: 2,
        markup: 0.5,
        packagingStock: createStarterPackagingStock(),
        upgrades: createDefaultUpgrades(),
        newProductBatchId: 'pb-1',
      }),
    ).toThrow();
  });

  it('runs a full Day 1 business loop cleanly with idempotent ledger and consistent P&L', () => {
    const lots = createStarterIngredientLots(1);
    const recipe = INITIAL_RECIPES[0]; // Chicken Carrot Dimsum
    const avail = checkRecipeAvailability(recipe, lots, 1, 1);
    expect(avail.canProduce).toBe(true);

    const consumed = consumeIngredientsFEFO(lots, recipe.ingredients, 1, 1);
    const batch = evaluateQualityControl({
      id: 'prod-1',
      recipeId: recipe.id,
      quantity: 10,
      ingredientCost: consumed.totalIngredientCost,
      operationalCost: 1_500,
      laborCost: 2_500,
      scores: {
        recipeAccuracy: 95,
        mixingQuality: 90,
        wrappingQuality: 90,
        steamingQuality: 90,
        hygieneCompliance: 92,
      },
      qualityScore: 0,
      qualityCategory: 'Excellent',
      status: 'PROCESSING',
      producedDay: 1,
      expiryDay: 3,
    });
    expect(batch.status).toBe('QC_PASSED');

    const pkgRes = packageProductionBatch({
      productionBatch: batch,
      packagingTypeId: 'paper_box',
      boxCount: 2,
      markup: 0.5,
      packagingStock: createStarterPackagingStock(),
      upgrades: createDefaultUpgrades(),
      newProductBatchId: 'pb-1',
    });
    expect(pkgRes.productBatch.boxesAvailable).toBe(2);
    expect(pkgRes.updatedProductionBatch.quantity).toBe(2); // 10 - 8 = 2 pcs remaining

    const saleOrder: SalesOrder = {
      id: 'ord-1',
      customerId: 'c-1',
      customerName: 'Andi',
      archetypeId: 'student',
      orderType: 'DIRECT',
      productBatchId: pkgRes.productBatch.id,
      recipeId: recipe.id,
      boxType: 'paper_box',
      quantityBoxes: 1,
      unitPrice: pkgRes.productBatch.sellingPricePerBox,
      discount: 0,
      totalAmount: pkgRes.productBatch.sellingPricePerBox,
      totalCogs: pkgRes.productBatch.unitCostPerBox,
      satisfaction: calculateCustomerSatisfaction({
        productQuality: pkgRes.productBatch.qualityScore,
        priceRatioToBudget: 0.6,
        serviceTimeRatio: 0.9,
        productAvailable: true,
        archetypeId: 'student',
      }),
      day: 1,
      timestamp: Date.now(),
    };

    let txs: FinancialTransaction[] = [];
    const saleTx: FinancialTransaction = {
      id: 'tx-1',
      type: 'INCOME',
      category: 'SALES_REVENUE',
      amount: saleOrder.totalAmount,
      descriptionEn: 'Sale',
      descriptionId: 'Penjualan',
      referenceId: saleOrder.id,
      day: 1,
      timestamp: Date.now(),
    };
    txs = appendTransactionIdempotent(txs, saleTx);
    txs = appendTransactionIdempotent(txs, saleTx); // duplicate guard
    expect(txs).toHaveLength(1);

    const report = buildDailyReport({
      day: 1,
      startingCash: 100_000,
      endingCash: 100_000 + saleOrder.totalAmount,
      transactions: txs,
      salesOrders: [saleOrder],
      productBatches: [{ ...pkgRes.productBatch, boxesAvailable: 1 }],
      pcsProduced: 10,
      boxesPackaged: 2,
      pcsExpired: 0,
      inventoryLossValue: 0,
      customersServed: 1,
      customersLost: 0,
      satisfactionSum: saleOrder.satisfaction,
      reputationEnd: 62,
    });

    expect(report.revenue).toBe(saleOrder.totalAmount);
    expect(report.cogs).toBe(pkgRes.productBatch.unitCostPerBox);
    expect(report.grossProfit).toBe(report.revenue - report.cogs);
    expect(report.netProfit).toBe(report.grossProfit);
  });

  it('combines leftover QC_PASSED pieces across batches via FEFO with zero stranded dimsum', () => {
    const batchA: ProductionBatch = {
      id: 'batch-a',
      recipeId: 'chicken_carrot',
      quantity: 2, // 2 leftover pcs from earlier packing
      ingredientCost: 2_000,
      operationalCost: 300,
      laborCost: 500,
      scores: {
        recipeAccuracy: 90,
        mixingQuality: 90,
        wrappingQuality: 90,
        steamingQuality: 90,
        hygieneCompliance: 90,
      },
      qualityScore: 90,
      qualityCategory: 'Excellent',
      status: 'QC_PASSED',
      producedDay: 1,
      expiryDay: 2,
    };
    const batchB: ProductionBatch = {
      ...batchA,
      id: 'batch-b',
      quantity: 10,
      ingredientCost: 10_000,
      operationalCost: 1_500,
      laborCost: 2_500,
      qualityScore: 80,
      qualityCategory: 'Very Good',
      expiryDay: 3,
    };

    const pooled = packageRecipeBatchesFEFO({
      productionBatches: [batchA, batchB],
      recipeId: 'chicken_carrot',
      currentDay: 1,
      packagingTypeId: 'standard_box', // 8 pcs: takes all 2 from batchA + 6 from batchB
      boxCount: 1,
      markup: 0.5,
      packagingStock: createStarterPackagingStock(),
      upgrades: createDefaultUpgrades(),
      newProductBatchId: 'pb-pool-1',
    });

    expect(pooled.batchesUsedCount).toBe(2);
    expect(pooled.productBatch.boxesAvailable).toBe(1);
    expect(pooled.updatedProductionBatches[0].quantity).toBe(0);
    expect(pooled.updatedProductionBatches[0].status).toBe('PACKAGED');
    expect(pooled.updatedProductionBatches[1].quantity).toBe(4);
    expect(pooled.updatedProductionBatches[1].status).toBe('QC_PASSED');
  });

  it('detects bankruptcy only when cash, ingredients, and sellable stock are exhausted or unpaid debt hits limit', () => {
    expect(checkBankruptcy(1_000, [], [], [], INITIAL_RECIPES, 1)).toBe(true);
    expect(
      checkBankruptcy(
        1_000,
        [],
        [],
        createStarterIngredientLots(1),
        INITIAL_RECIPES,
        1,
      ),
    ).toBe(false);
    expect(
      checkBankruptcy(
        50_000,
        [],
        [],
        createStarterIngredientLots(1),
        INITIAL_RECIPES,
        1,
        100_000,
      ),
    ).toBe(true);
    expect(getAvailableStockByIngredient([], 1)).toEqual({});
    expect(migrateSaveSnapshot(null)).toBeNull();
  });

  it('scales daily revenue goal and wastage limit cleanly by business level', () => {
    expect(getDailyRevenueGoal(1)).toBe(60_000);
    expect(getDailyRevenueGoal(2)).toBe(90_000);
    expect(getDailyRevenueGoal(0)).toBe(60_000);

    expect(getDailyWastageLimit(1)).toBe(15_000);
    expect(getDailyWastageLimit(3)).toBe(25_000);
    expect(getDailyWastageLimit(0)).toBe(15_000);
  });

  it('computes kitchen helper training costs, quality bonuses, and daily payroll accurately', () => {
    const prepHelper = KITCHEN_HELPER_ROSTER[0];
    expect(getKitchenHelperTrainCost(prepHelper, 1)).toBe(25_000);
    expect(getKitchenHelperTrainCost(prepHelper, 2)).toBe(50_000);
    expect(getKitchenHelperTrainCost(prepHelper, 3)).toBeNull();

    expect(getKitchenHelperQualityBonus(undefined)).toBe(0);
    expect(getKitchenHelperQualityBonus(1)).toBe(4);
    expect(getKitchenHelperQualityBonus(2)).toBe(7);
    expect(getKitchenHelperQualityBonus(3)).toBe(10);

    expect(
      getTotalDailyStaffWages([
        { id: 'prep', level: 1, hiredDay: 1 },
        { id: 'steam', level: 2, hiredDay: 2 },
      ]),
    ).toBe(15_000);
  });

  it('balances Easy (500k), Medium (300k), and Hard (150k) modal difficulty allocations exactly', () => {
    expect(CAPITAL_DIFFICULTIES.easy.total).toBe(500_000);
    expect(CAPITAL_DIFFICULTIES.medium.total).toBe(300_000);
    expect(CAPITAL_DIFFICULTIES.hard.total).toBe(150_000);

    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const cfg = getCapitalDifficultyConfig(tier);
      expect(
        cfg.starterIngredientsValue +
          cfg.starterEquipmentValue +
          cfg.starterPackagingValue +
          cfg.cashReserve,
      ).toBe(cfg.total);

      const lots = createStarterIngredientLots(1, tier);
      const lotsTotal = lots.reduce((sum, l) => sum + l.totalLotCost, 0);
      expect(lotsTotal).toBe(cfg.starterIngredientsValue);

      const pkgStock = createStarterPackagingStock(tier);
      const pkgTotal = PACKAGING_TYPES.reduce(
        (sum, p) => sum + (pkgStock[p.id] ?? 0) * p.costPerBox,
        0,
      );
      expect(pkgTotal).toBe(cfg.starterPackagingValue);

      // Every difficulty must allow cooking at least 1 starter recipe on Day 1
      expect(checkRecipeAvailability(INITIAL_RECIPES[0], lots, 1, 1).canProduce).toBe(
        true,
      );
    }
  });

  it('makes every recipe research upgrade healthier (higher quality) and more profitable (lower ingredient cost)', () => {
    const starterLots = createStarterIngredientLots(1, 'easy');
    for (const research of RECIPE_RESEARCH_DEFS) {
      const base = INITIAL_RECIPES.find((r) => r.id === research.recipeId)!;
      expect(base).toBeDefined();
      const baseCost = estimateRecipeIngredientCost(base, starterLots, 1, null);
      const upgradedCost = estimateRecipeIngredientCost(
        { ...base, ingredients: research.newIngredients },
        starterLots,
        1,
        null,
      );

      expect(upgradedCost).toBeLessThan(baseCost);
      expect(research.newBaseQuality).toBeGreaterThan(base.baseQuality);
      expect(research.newProductionTimeSec).toBeLessThan(base.productionTimeSec);
      expect(research.researchCost).toBeGreaterThan(0);
    }
  });

  it('tracks Daily Goals bonus objectives including Serve 50 Customers milestone and daily targets', () => {
    expect(getDailyCustomerGoal(1)).toBe(4);
    expect(getDailyCustomerGoal(2)).toBe(6);
    expect(getDailyProductionGoal(1)).toBe(20);
    expect(getDailyProductionGoal(2)).toBe(30);

    const midRun = evaluateBonusObjectives({
      businessLevel: 1,
      currentDay: 3,
      todayCustomersServed: 4,
      todayPcsProduced: 10,
      totalCustomersServed: 27,
    });

    const serve50 = midRun.find((o) => o.id === 'serve_50_customers')!;
    const dailyCust = midRun.find((o) => o.id === 'daily_customers')!;
    const dailyProd = midRun.find((o) => o.id === 'daily_production')!;

    expect(serve50.titleEn).toBe('Serve 50 Customers');
    expect(serve50.current).toBe(27);
    expect(serve50.target).toBe(50);
    expect(serve50.completed).toBe(false);
    expect(dailyCust.completed).toBe(true);
    expect(dailyCust.referenceId).toBe('bonus-daily-customers-day-3');
    expect(dailyProd.completed).toBe(false);

    const milestoneHit = evaluateBonusObjectives({
      businessLevel: 1,
      currentDay: 5,
      todayCustomersServed: 5,
      todayPcsProduced: 20,
      totalCustomersServed: 52,
    });
    const completed50 = milestoneHit.find((o) => o.id === 'serve_50_customers')!;
    expect(completed50.current).toBe(50);
    expect(completed50.completed).toBe(true);
    expect(completed50.rewardCash).toBe(25_000);
  });

  it('generates customer dining feedback and scales customer traffic from Shop Reputation', () => {
    const newRepHigh = updateReputationFromSatisfaction(60, 92);
    expect(newRepHigh).toBe(62);

    const positiveFb = generateCustomerFeedback({
      id: 'fb-1',
      customerName: 'Andi',
      archetypeId: 'student',
      recipeNameEn: 'Chicken Carrot Dimsum',
      recipeNameId: 'Dimsum Ayam Wortel',
      satisfaction: 92,
      productQuality: 90,
      priceRatioToBudget: 0.65,
      serviceTimeRatio: 0.85,
      productMatched: true,
      reputationDelta: newRepHigh - 60,
      newReputation: newRepHigh,
    });
    expect(positiveFb.ratingStars).toBe(5);
    expect(positiveFb.sentiment).toBe('positive');
    expect(positiveFb.reputationDelta).toBe(2);

    const angryFb = generateCustomerFeedback({
      id: 'fb-2',
      customerName: 'Budi',
      archetypeId: 'worker',
      recipeNameEn: 'Shrimp Vegetable Dimsum',
      recipeNameId: 'Dimsum Udang Sayur',
      satisfaction: 10,
      productQuality: 50,
      priceRatioToBudget: 1,
      serviceTimeRatio: 0,
      productMatched: false,
      reputationDelta: -2,
      newReputation: 58,
      leftAngry: true,
    });
    expect(angryFb.ratingStars).toBe(1);
    expect(angryFb.sentiment).toBe('negative');

    const upgrades = createDefaultUpgrades();
    expect(getTrafficMultiplier(upgrades, 90)).toBeGreaterThan(
      getTrafficMultiplier(upgrades, 30),
    );
    expect(getReputationTrafficBonusPct(90)).toBe(25);
    expect(getReputationTrafficBonusPct(20)).toBe(-10);
  });

  it('triggers positive and negative daily events that adjust revenue, reputation, and steam QC', () => {
    const positiveEvents = DAILY_EVENTS.filter((e) => e.kind === 'positive');
    const negativeEvents = DAILY_EVENTS.filter((e) => e.kind === 'negative');
    expect(positiveEvents.length).toBeGreaterThanOrEqual(2);
    expect(negativeEvents.length).toBeGreaterThanOrEqual(2);

    const critic = DAILY_EVENTS.find((e) => e.id === 'food_critic')!;
    const steamerFail = DAILY_EVENTS.find((e) => e.id === 'steamer_malfunction')!;

    expect(applyDailyEventRevenue(10_000, critic)).toBe(12_000);
    expect(applyDailyEventRevenue(10_000, steamerFail)).toBe(9_000);
    expect(applyDailyEventReputationDelta(1, 80, critic)).toBe(2);
    expect(steamerFail.steamScoreDelta).toBe(-8);
    expect(steamerFail.reputationOnStart).toBe(-2);

    // Avoids repeating the previous day's event
    const nextEvent = pickDailyShopEvent(2, critic.id, () => 0);
    expect(nextEvent.id).not.toBe(critic.id);
  });

  it('tracks Employee Morale fatigue, Wellness shift recovery, and cooking speed/quality impacts', () => {
    const baseHelper = {
      id: 'prep' as const,
      level: 1 as const,
      hiredDay: 1,
      morale: DEFAULT_STAFF_MORALE,
      shift: 'kitchen' as const,
      consecutiveWorkBatches: 0,
    };

    // High morale (>=80) grants +3 QC bonus (4 base + 3 = 7) and 1.2x speed
    expect(getStaffMorale(baseHelper)).toBe(85);
    expect(getStaffMoraleTier(85)).toBe('high');
    expect(getEffectiveHelperQualityBonus(baseHelper)).toBe(7);
    expect(getEffectiveHelperSpeedMultiplier(baseHelper)).toBe(1.2);

    // Consecutive batches without breaks cause accelerating morale drops (-6, -10, -15)
    const afterBatch1 = computeStaffMoraleAfterBatch(baseHelper);
    expect(afterBatch1.morale).toBe(79);
    expect(afterBatch1.consecutiveWorkBatches).toBe(1);
    expect(getStaffMoraleTier(getStaffMorale(afterBatch1))).toBe('steady');
    expect(getEffectiveHelperQualityBonus(afterBatch1)).toBe(4);
    expect(getEffectiveHelperSpeedMultiplier(afterBatch1)).toBe(1.0);

    const afterBatch2 = computeStaffMoraleAfterBatch(afterBatch1);
    expect(afterBatch2.morale).toBe(69);
    expect(afterBatch2.consecutiveWorkBatches).toBe(2);

    const afterBatch3 = computeStaffMoraleAfterBatch(afterBatch2);
    expect(afterBatch3.morale).toBe(54);
    expect(afterBatch3.consecutiveWorkBatches).toBe(3);

    // Exhausted helper (<25 morale) suffers -6 QC penalty (4 - 6 = -2) and 0.7x speed
    const exhaustedHelper = { ...baseHelper, morale: 20 };
    expect(getStaffMoraleTier(20)).toBe('exhausted');
    expect(getEffectiveHelperQualityBonus(exhaustedHelper)).toBe(-2);
    expect(getEffectiveHelperSpeedMultiplier(exhaustedHelper)).toBe(0.7);

    // Assigning Wellness shift pauses active kitchen assistance (0 QC, 1.0x speed) and restores morale
    const onWellness = { ...exhaustedHelper, shift: 'wellness' as const };
    expect(getEffectiveHelperQualityBonus(onWellness)).toBe(0);
    expect(getEffectiveHelperSpeedMultiplier(onWellness)).toBe(1);

    const afterWellnessBatch = computeStaffMoraleAfterBatch(onWellness);
    expect(afterWellnessBatch.morale).toBe(38);
    expect(afterWellnessBatch.consecutiveWorkBatches).toBe(0);

    const afterOvernightWellness = computeStaffMoraleOvernight(afterWellnessBatch);
    expect(afterOvernightWellness.morale).toBe(66);

    expect(
      computeAverageTeamMorale([
        { id: 'prep', level: 1, hiredDay: 1, morale: 80 },
        { id: 'mix', level: 1, hiredDay: 1, morale: 60 },
      ]),
    ).toBe(70);
  });

  it('negotiates bulk supplier discounts and damages trust if pushed too hard', () => {
    // Relationship tiers & passive pricing multipliers
    expect(getSupplierRelationshipTier(90)).toBe('trusted');
    expect(getSupplierPriceMultiplier(90)).toBe(0.95);
    expect(getSupplierRelationshipTier(30)).toBe('strained');
    expect(getSupplierPriceMultiplier(30)).toBe(1.1);

    // Requires at least 3 packs for bulk negotiation
    const tooSmall = startNegotiationSession({
      supplier: 'Segar Poultry Farm',
      baseSubtotal: 45_000,
      packCount: 2,
      relationship: { supplier: 'Segar Poultry Farm', trust: 65, negotiatedCount: 0, walkoutCount: 0 },
    });
    expect(tooSmall.ok).toBe(false);

    // Friendly negotiation within tolerance succeeds & boosts trust
    const started = startNegotiationSession({
      supplier: 'Segar Poultry Farm',
      baseSubtotal: 90_000,
      packCount: 4,
      relationship: { supplier: 'Segar Poultry Farm', trust: 65, negotiatedCount: 0, walkoutCount: 0 },
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const accepted = evaluateNegotiationRound(
      started.session,
      { tactic: 'friendly', requestedDiscountRate: 0.1 },
      () => 0.1,
    );
    expect(accepted.status).toBe('ACCEPTED');
    expect(accepted.currentTrust).toBe(68);
    expect(applySupplierDealToPackPrice(22_500, 0.1)).toBe(20_250);

    // Counter-offer can be accepted amicably
    const countered = evaluateNegotiationRound(
      started.session,
      { tactic: 'firm', requestedDiscountRate: 0.16 },
      () => 0.99,
    );
    expect(countered.status).toBe('ACTIVE');
    expect(countered.currentOfferDiscount).toBeGreaterThan(0);
    const settled = acceptCurrentCounterOffer(countered);
    expect(settled.status).toBe('ACCEPTED');

    // Pushing aggressively way past fair ceiling triggers WALKED_OUT & damages trust into strained tier
    const waryStart = startNegotiationSession({
      supplier: 'Nusantara Seafood',
      baseSubtotal: 70_000,
      packCount: 4,
      relationship: { supplier: 'Nusantara Seafood', trust: 45, negotiatedCount: 0, walkoutCount: 0 },
    });
    expect(waryStart.ok).toBe(true);
    if (!waryStart.ok) return;

    const walkout = evaluateNegotiationRound(
      waryStart.session,
      { tactic: 'aggressive', requestedDiscountRate: 0.28 },
      () => 0.99,
    );
    expect(walkout.status).toBe('WALKED_OUT');
    expect(walkout.currentTrust).toBe(23);
    expect(getSupplierRelationshipTier(walkout.currentTrust)).toBe('strained');

    // Strained relationship blocks haggling & applies +10% surcharge to market prices
    expect(getAdjustedPackPrice('shrimp', null, walkout.currentTrust)).toBe(19_250);
    const blocked = startNegotiationSession({
      supplier: 'Nusantara Seafood',
      baseSubtotal: 70_000,
      packCount: 4,
      relationship: { supplier: 'Nusantara Seafood', trust: walkout.currentTrust, negotiatedCount: 0, walkoutCount: 1 },
    });
    expect(blocked.ok).toBe(false);

    // Overnight recovery slowly heals strained relationships (+8 trust)
    const recovered = recoverSupplierTrustOvernight({
      supplier: 'Nusantara Seafood',
      trust: 23,
      negotiatedCount: 0,
      walkoutCount: 1,
    });
    expect(recovered.trust).toBe(31);
  });

  it('enforces staff skill tree prerequisites, level gates, daily cap, morale check, and aggregates cooking efficiencies', () => {
    for (const role of ['prep', 'mix', 'wrap', 'steam'] as const) {
      expect(getSkillNodesForRole(role)).toHaveLength(5);
    }
    expect(STAFF_SKILL_TREE.every((n) => n.trainingCost > 0)).toBe(true);

    // Unhired helper cannot train
    expect(canTrainSkillNode(undefined, 'mix_balanced_scoop').reason).toBe('not_hired');

    let mixHelper: KitchenHelperState = {
      id: 'mix',
      level: 1,
      hiredDay: 1,
      morale: 85,
      shift: 'kitchen',
      unlockedSkills: [],
      totalTrainingSec: 0,
    };

    // Tier 2 blocked by missing prerequisite
    expect(canTrainSkillNode(mixHelper, 'mix_turbo_whisk', 1)).toEqual({
      allowed: false,
      reason: 'missing_prereq',
    });
    expect(canTrainSkillNode(mixHelper, 'mix_balanced_scoop', 1).allowed).toBe(true);

    // Train Tier 1 on Day 1 -> blocks second drill same day (daily_limit), and requires Lv 2 for Tier 2
    mixHelper = unlockStaffSkillNode(mixHelper, 'mix_balanced_scoop', 4, 1);
    expect(canTrainSkillNode(mixHelper, 'mix_turbo_whisk', 1).reason).toBe('insufficient_level');

    mixHelper = { ...mixHelper, level: 2 };
    expect(canTrainSkillNode(mixHelper, 'mix_turbo_whisk', 1).reason).toBe('daily_limit');
    expect(canTrainSkillNode(mixHelper, 'mix_turbo_whisk', 2).allowed).toBe(true);

    // Low morale blocks training until rested
    expect(
      canTrainSkillNode({ ...mixHelper, morale: 25 }, 'mix_turbo_whisk', 2).reason,
    ).toBe('low_morale');

    mixHelper = unlockStaffSkillNode(mixHelper, 'mix_turbo_whisk', 6, 2);
    mixHelper = unlockStaffSkillNode(mixHelper, 'mix_stand_mixer', 8, 3);
    mixHelper = unlockStaffSkillNode(mixHelper, 'mix_emulsion_lock', 6, 4);

    expect(mixHelper.unlockedSkills).toHaveLength(4);
    expect(mixHelper.totalTrainingSec).toBe(24);

    const activeEffects = computeHelperSkillEffects(mixHelper);
    expect(activeEffects.extraStartMixMatch).toBe(6);
    expect(activeEffects.extraWhiskStep).toBe(22);
    expect(activeEffects.startingStirProgress).toBe(35);
    expect(activeEffects.ratioToleranceBonus).toBe(0.25);
    expect(activeEffects.stageQualityBonus).toBe(2);

    // Active mini-game effects pause while on Wellness rest unless inspecting skill tree
    const restingHelper = { ...mixHelper, shift: 'wellness' as const };
    expect(computeHelperSkillEffects(restingHelper).extraWhiskStep).toBe(0);
    expect(computeHelperSkillEffects(restingHelper, true).extraWhiskStep).toBe(22);
  });

  it('provides distinct recipe Mix ratios, Wrap pleat shapes, and dynamic 78C Steam thermodynamics', () => {
    const chicken = INITIAL_RECIPES.find((r) => r.id === 'chicken_carrot')!;
    const shrimp = INITIAL_RECIPES.find((r) => r.id === 'shrimp_veg')!;
    const tofu = INITIAL_RECIPES.find((r) => r.id === 'tofu_mushroom')!;
    const rainbow = INITIAL_RECIPES.find((r) => r.id === 'rainbow_veggie')!;

    expect(getMixProfileForRecipe(chicken)).toMatchObject({ targetMain: 55, targetSecondary: 30 });
    expect(getMixProfileForRecipe(shrimp)).toMatchObject({ targetMain: 60, targetSecondary: 25 });
    expect(getMixProfileForRecipe(tofu)).toMatchObject({ targetMain: 50, targetSecondary: 35 });
    expect(getMixProfileForRecipe(rainbow)).toMatchObject({ targetMain: 35, targetSecondary: 50 });

    const calibratedLv3 = computeMixStartingRatios({
      targetMain: 60,
      targetSecondary: 25,
      helperLevel: 3,
    });
    expect(calibratedLv3).toEqual({ initialMain: 60, initialSecondary: 25 });

    // Wrap styles: crown (5), crescent (6), wave (4), lotus (6)
    expect(getWrapPatternForRecipe(chicken).style).toBe('crown');
    expect(getWrapPatternForRecipe(chicken).points).toHaveLength(5);
    expect(getWrapPatternForRecipe(shrimp).style).toBe('crescent');
    expect(getWrapPatternForRecipe(shrimp).points).toHaveLength(6);
    expect(getWrapPatternForRecipe(tofu).style).toBe('wave');
    expect(getWrapPatternForRecipe(tofu).points).toHaveLength(4);
    expect(getWrapPatternForRecipe(rainbow).style).toBe('lotus');
    expect(getWrapPatternForRecipe(rainbow).points).toHaveLength(6);

    // Steam thermodynamics: starts at 78C, AFK medium heat stays cool (< optimalMin), High Boil warms into zone
    const steamProfile = getSteamProfileForRecipe(chicken);
    expect(steamProfile.startTemp).toBe(STEAM_CONSTANTS.startTemp);
    expect(steamProfile.startTemp).toBe(78);

    let afkTemp = steamProfile.startTemp;
    for (let i = 1; i <= 20; i++) {
      afkTemp = computeNextSteamTemp({
        prevTemp: afkTemp,
        heatLevel: 'medium',
        tickIndex: i,
        profile: steamProfile,
        randomVal: 0.5,
      }).nextTemp;
    }
    expect(afkTemp).toBeLessThan(steamProfile.optimalMin);

    let highTemp = steamProfile.startTemp;
    for (let i = 1; i <= 6; i++) {
      highTemp = computeNextSteamTemp({
        prevTemp: highTemp,
        heatLevel: 'high',
        tickIndex: i,
        profile: steamProfile,
        randomVal: 0.5,
      }).nextTemp;
    }
    expect(highTemp).toBeGreaterThanOrEqual(steamProfile.optimalMin);
    expect(highTemp).toBeLessThanOrEqual(steamProfile.optimalMax);

    const cooledTemp = computeNextSteamTemp({
      prevTemp: 108,
      heatLevel: 'low',
      tickIndex: 1,
      profile: steamProfile,
      randomVal: 0.5,
    }).nextTemp;
    expect(cooledTemp).toBeLessThan(108);
  });

  it('translates quality categories and kitchen stage labels consistently for id/en', () => {
    expect(translateQualityCategory('id', 'Excellent')).toBe('Sempurna');
    expect(translateQualityCategory('id', 'Very Good')).toBe('Sangat Baik');
    expect(translateQualityCategory('en', 'Excellent')).toBe('Excellent');
    expect(translateStageLabel('id', 'PREP')).toBe('Siapkan');
    expect(translateStageLabel('id', 'STEAM')).toBe('Kukus');
    expect(translateStageLabel('en', 'WRAP')).toBe('Wrap');
  });

  it('clamps 3D camera orbit/zoom bounds and preserves default isometric offset', () => {
    expect(clampCameraZoom(0.2)).toBe(CAMERA_ZOOM_BOUNDS.min);
    expect(clampCameraZoom(3.5)).toBe(CAMERA_ZOOM_BOUNDS.max);
    expect(clampCameraZoom(Number.NaN)).toBe(CAMERA_ZOOM_BOUNDS.default);
    expect(clampCameraZoom(1.25)).toBe(1.25);

    expect(clampCameraOrbitYaw(-2)).toBe(CAMERA_ORBIT_BOUNDS.minYawOffset);
    expect(clampCameraOrbitYaw(2)).toBe(CAMERA_ORBIT_BOUNDS.maxYawOffset);
    expect(clampCameraOrbitYaw(0.2)).toBe(0.2);

    expect(clampCameraPitchOffset(-1)).toBe(CAMERA_ORBIT_BOUNDS.minPitchOffset);
    expect(clampCameraPitchOffset(1)).toBe(CAMERA_ORBIT_BOUNDS.maxPitchOffset);

    const defOffset = computeCameraOffset(0, 0);
    expect(defOffset.x).toBeCloseTo(14, 3);
    expect(defOffset.y).toBeCloseTo(13.5, 3);
    expect(defOffset.z).toBeCloseTo(14, 3);

    const orbited = computeCameraOffset(0.3, 0.1);
    expect(orbited.x).not.toBeCloseTo(14, 1);
    expect(orbited.y).toBeGreaterThan(13.5);
  });

  it('handles procedural audio volumes, doorbell, steamer ambience, and SaveSnapshot volume migration safely', () => {
    soundFx.setBgmVolume(1.5);
    expect(soundFx.getBgmVolume()).toBe(1);
    soundFx.setBgmVolume(-0.3);
    expect(soundFx.getBgmVolume()).toBe(0);
    soundFx.setBgmVolume(0.45);
    expect(soundFx.getBgmVolume()).toBe(0.45);

    soundFx.setSfxVolume(2);
    expect(soundFx.getSfxVolume()).toBe(1);
    soundFx.setSfxVolume(0.75);
    expect(soundFx.getSfxVolume()).toBe(0.75);

    expect(() => {
      soundFx.playDoorbell();
      soundFx.setSteamAmbience(true, 0.7);
      soundFx.setSteamAmbience(false);
    }).not.toThrow();

    const migratedLegacy = migrateSaveSnapshot({
      version: 1,
      cashBalance: 100_000,
      business: {
        id: 'b1',
        name: 'Legacy',
        concept: 'balanced',
        targetMarket: 'general',
        level: 1,
        reputation: 60,
        createdAt: 1,
      },
    });
    expect(migratedLegacy?.bgmVolume).toBe(0.45);
    expect(migratedLegacy?.sfxVolume).toBe(0.75);

    const migratedCustom = migrateSaveSnapshot({
      version: 1,
      cashBalance: 100_000,
      bgmVolume: 0.25,
      sfxVolume: 0.9,
      business: {
        id: 'b2',
        name: 'Custom Audio',
        concept: 'balanced',
        targetMarket: 'general',
        level: 1,
        reputation: 60,
        createdAt: 1,
      },
    });
    expect(migratedCustom?.bgmVolume).toBe(0.25);
    expect(migratedCustom?.sfxVolume).toBe(0.9);
  });

  it('validates Auto-Batch Delegation eligibility and scales QC & speed by helper level, morale, and Skill Tree', () => {
    const recipe = INITIAL_RECIPES[0];

    // 1 kitchen + 1 wellness helper is NOT enough (requires 2 active kitchen helpers)
    const insufficient = checkDelegationEligibility({
      kitchenStaff: [
        { id: 'prep', level: 1, hiredDay: 1, morale: 85, shift: 'kitchen' },
        { id: 'mix', level: 1, hiredDay: 1, morale: 85, shift: 'wellness' },
      ],
      activeCooking: null,
      activeDelegation: null,
    });
    expect(insufficient.eligible).toBe(false);
    expect(insufficient.reason).toBe('need_staff');

    const baseCrew: KitchenHelperState[] = [
      { id: 'prep', level: 1, hiredDay: 1, morale: 85, shift: 'kitchen', unlockedSkills: [] },
      { id: 'mix', level: 1, hiredDay: 1, morale: 85, shift: 'kitchen', unlockedSkills: [] },
    ];
    expect(
      checkDelegationEligibility({
        kitchenStaff: baseCrew,
        activeCooking: null,
        activeDelegation: null,
      }).eligible,
    ).toBe(true);

    // Busy kitchen blocks delegation
    expect(
      checkDelegationEligibility({
        kitchenStaff: baseCrew,
        activeCooking: null,
        activeDelegation: {
          batchId: 'del-1',
          recipeId: recipe.id,
          batchCount: 1,
          ingredientCost: 8_000,
          scores: {
            recipeAccuracy: 80,
            mixingQuality: 80,
            wrappingQuality: 70,
            steamingQuality: 70,
            hygieneCompliance: 85,
          },
          projectedQualityScore: 77,
          assignedHelpers: ['prep', 'mix'],
          startedAt: Date.now(),
          durationMs: 3200,
        },
      }),
    ).toMatchObject({ eligible: false, reason: 'busy' });

    const basePlan = computeDelegatedCookingPlan({
      recipe,
      batchCount: 1,
      kitchenStaff: baseCrew,
      hygieneBase: 88,
    });

    const upgradedCrew: KitchenHelperState[] = [
      {
        id: 'prep',
        level: 3,
        hiredDay: 1,
        morale: 95,
        shift: 'kitchen',
        unlockedSkills: ['prep_mise_en_place', 'prep_knife_speed', 'prep_precision_cut'],
      },
      {
        id: 'mix',
        level: 2,
        hiredDay: 1,
        morale: 90,
        shift: 'kitchen',
        unlockedSkills: ['mix_balanced_scoop', 'mix_emulsion_lock'],
      },
      {
        id: 'steam',
        level: 2,
        hiredDay: 1,
        morale: 90,
        shift: 'kitchen',
        unlockedSkills: ['steam_valve_tuning', 'steam_rapid_boil'],
      },
    ];
    const upgradedPlan = computeDelegatedCookingPlan({
      recipe,
      batchCount: 1,
      kitchenStaff: upgradedCrew,
      hygieneBase: 88,
    });
    expect(upgradedPlan.projectedQualityScore).toBeGreaterThan(basePlan.projectedQualityScore);
    expect(upgradedPlan.durationMs).toBeLessThanOrEqual(basePlan.durationMs);

    const steamerEvent = DAILY_EVENTS.find((e) => e.id === 'steamer_malfunction')!;
    const malfunctionPlan = computeDelegatedCookingPlan({
      recipe,
      batchCount: 1,
      kitchenStaff: upgradedCrew,
      hygieneBase: 88,
      activeDailyEvent: steamerEvent,
    });
    expect(malfunctionPlan.scores.steamingQuality).toBeLessThan(
      upgradedPlan.scores.steamingQuality,
    );
  });

  it('applies Clearance Sale markdowns cleanly and attracts bargain-hunting customers', () => {
    const batch = {
      id: 'pb-clear',
      productionBatchId: 'prod-1',
      recipeId: 'chicken_carrot',
      packagingTypeId: 'paper_box' as const,
      boxesProduced: 2,
      boxesAvailable: 2,
      pcsPerBox: 4,
      unitCostPerBox: 6_500,
      sellingPricePerBox: 12_000,
      qualityScore: 86,
      status: 'PACKAGED' as const,
      producedDay: 1,
      expiryDay: 1,
    };

    const off25 = applyClearanceDiscountToBatch(batch, 25);
    expect(off25.originalSellingPricePerBox).toBe(12_000);
    expect(off25.sellingPricePerBox).toBe(9_000);
    expect(off25.clearanceDiscountPct).toBe(25);

    const off40 = applyClearanceDiscountToBatch(off25, 40);
    expect(off40.originalSellingPricePerBox).toBe(12_000);
    expect(off40.sellingPricePerBox).toBe(7_200);
    expect(off40.clearanceDiscountPct).toBe(40);

    const restored = applyClearanceDiscountToBatch(off40, 0);
    expect(restored.sellingPricePerBox).toBe(12_000);
    expect(restored.clearanceDiscountPct).toBe(0);

    // Minimum floor Rp500
    const tinyClear = applyClearanceDiscountToBatch(
      { ...batch, sellingPricePerBox: 600 },
      40,
    );
    expect(tinyClear.sellingPricePerBox).toBe(500);

    // Bargain-hunting customer spawn works cleanly with clearance inventory
    const clearanceOnly = [{ ...off40, recipeId: 'tofu_mushroom' }];
    let pickedClearanceCount = 0;
    for (let i = 0; i < 20; i++) {
      const cust = spawnCustomerAgent({
        id: `c-${i}`,
        business: {
          id: 'b-1',
          name: 'Clearance Shop',
          concept: 'balanced',
          targetMarket: 'students',
          level: 1,
          reputation: 60,
          createdAt: 1,
        },
        availableBatches: clearanceOnly,
        recipes: INITIAL_RECIPES,
        upgrades: createDefaultUpgrades(),
        seatSlot: 0,
      });
      if (cust.requestedRecipeId === 'tofu_mushroom') pickedClearanceCount += 1;
    }
    expect(pickedClearanceCount).toBeGreaterThan(5);
  });

  it('expands recipe catalog to 9 recipes + 9 R&D profiles with valid Mix, Wrap, and Steam configs', () => {
    expect(INITIAL_RECIPES).toHaveLength(9);
    expect(RECIPE_RESEARCH_DEFS).toHaveLength(9);

    const newRecipeIds = [
      'mentai_chicken',
      'kuotie_panggang',
      'lumpia_tahu',
      'hakau_bayam',
      'bakpao_gandum',
    ];
    for (const id of newRecipeIds) {
      const rec = INITIAL_RECIPES.find((r) => r.id === id)!;
      expect(rec).toBeDefined();
      const mix = getMixProfileForRecipe(rec);
      const wrap = getWrapPatternForRecipe(rec);
      const steam = getSteamProfileForRecipe(rec);
      expect(mix.targetMain + mix.targetSecondary).toBeLessThanOrEqual(90);
      expect(wrap.points.length).toBeGreaterThanOrEqual(4);
      expect(steam.optimalMin).toBeLessThan(steam.optimalMax);
    }
  });

  it('supports Dine-In seating capacity upgrades, Rush Hour windows, and +18% Dine-In customer budgets', () => {
    const upg = createDefaultUpgrades();
    expect(UPGRADE_DEFS.some((u) => u.id === 'dining_seating')).toBe(true);
    expect(getDineInCapacity(upg)).toBe(2);
    expect(getDineInCapacity({ ...upg, dining_seating: 2 })).toBe(3);
    expect(getDineInCapacity({ ...upg, dining_seating: 3 })).toBe(4);

    expect(getRushHourPhase(65)).toMatchObject({ active: true, id: 'lunch' });
    expect(getRushHourPhase(24)).toMatchObject({ active: true, id: 'dinner' });
    expect(isRushHourWindow(45)).toBe(false);

    // Spawning with 1 free table reserves non-occupied slot and applies Dine-In premium when chosen
    let sawDineIn = false;
    for (let i = 0; i < 30; i++) {
      const cust = spawnCustomerAgent({
        id: `dine-${i}`,
        business: {
          id: 'b-d',
          name: 'Dine Bistro',
          concept: 'balanced',
          targetMarket: 'families',
          level: 1,
          reputation: 70,
          createdAt: 1,
        },
        availableBatches: [],
        recipes: INITIAL_RECIPES,
        upgrades: upg,
        seatSlot: 0,
        occupiedTableSlots: [0],
      });
      if (cust.diningMode === 'DINE_IN') {
        sawDineIn = true;
        expect(cust.tableSlot).toBe(1);
        expect(cust.maxBudget).toBeGreaterThan(10_000 * DINE_IN_REVENUE_MULTIPLIER * 0.5);
      }
    }
    expect(sawDineIn).toBe(true);
  });

  it('generates Online Delivery orders with platform commission math and tiered B2B Contracts', () => {
    const ojol = generateOnlineDeliveryOrder({
      id: 'ojol-test-1',
      availableBatches: [],
      recipes: INITIAL_RECIPES,
      reputation: 80,
    });
    expect(['GoFood', 'GrabFood', 'ShopeeFood']).toContain(ojol.platform);
    expect(ojol.netPayoutPerBox).toBeLessThan(ojol.grossPricePerBox);
    expect(ojol.commissionRate).toBeGreaterThanOrEqual(0.15);

    const lowRepContracts = generateDailyPreOrders(1, INITIAL_RECIPES, 40);
    expect(lowRepContracts.length).toBe(2);
    expect(lowRepContracts[0].tier).toBe('community');
    expect(lowRepContracts[0].accepted).toBe(true);
    expect(lowRepContracts[0].dueDay).toBe(1);

    const highRepContracts = generateDailyPreOrders(2, INITIAL_RECIPES, 80);
    expect(highRepContracts.length).toBe(3);
    expect(highRepContracts.some((c) => c.tier === 'partner_cafe')).toBe(true);
    expect(highRepContracts.some((c) => c.dueDay > 2)).toBe(true);
  });

  it('evaluates all 26 tiered achievements and migrates legacy snapshots with dining_seating', () => {
    expect(ACHIEVEMENTS).toHaveLength(26);
    expect(ACHIEVEMENTS.every((a) => Boolean(a.tier) && Boolean(a.category))).toBe(true);

    const unlocked = evaluateAchievements({
      unlocked: [],
      productionBatches: [
        {
          id: 'b-1',
          recipeId: 'chicken_carrot',
          quantity: 110,
          ingredientCost: 50_000,
          operationalCost: 5_000,
          laborCost: 8_000,
          scores: {
            recipeAccuracy: 98,
            mixingQuality: 96,
            wrappingQuality: 96,
            steamingQuality: 97,
            hygieneCompliance: 96,
          },
          qualityScore: 97,
          qualityCategory: 'Excellent',
          status: 'QC_PASSED',
          producedDay: 1,
          expiryDay: 4,
        },
      ],
      salesOrders: [
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `di-${i}`,
          customerId: `c-${i}`,
          customerName: 'Dine Guest',
          archetypeId: 'family' as const,
          orderType: 'DIRECT' as const,
          diningMode: 'DINE_IN' as const,
          productBatchId: 'pb-1',
          recipeId: 'chicken_carrot',
          boxType: 'paper_box' as const,
          quantityBoxes: 1,
          unitPrice: 20_000,
          discount: 0,
          totalAmount: 100_000,
          totalCogs: 40_000,
          satisfaction: 92,
          day: 1,
          timestamp: 1,
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          id: `b2b-${i}`,
          customerId: `po-${i}`,
          customerName: 'B2B Partner',
          archetypeId: 'worker' as const,
          orderType: 'PRE_ORDER' as const,
          productBatchId: 'pb-1',
          recipeId: 'chicken_carrot',
          boxType: 'standard_box' as const,
          quantityBoxes: 2,
          unitPrice: 25_000,
          discount: 0,
          totalAmount: 100_000,
          totalCogs: 40_000,
          satisfaction: 95,
          day: 2,
          timestamp: 2,
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `ojol-${i}`,
          customerId: `oj-${i}`,
          customerName: 'GoFood',
          archetypeId: 'worker' as const,
          orderType: 'ONLINE_DELIVERY' as const,
          platformName: 'GoFood' as const,
          platformCommission: 5_000,
          productBatchId: 'pb-1',
          recipeId: 'chicken_carrot',
          boxType: 'paper_box' as const,
          quantityBoxes: 1,
          unitPrice: 20_000,
          discount: 0,
          totalAmount: 40_000,
          totalCogs: 15_000,
          satisfaction: 88,
          day: 3,
          timestamp: 3,
        })),
      ],
      dailyReports: [
        {
          day: 1,
          startingCash: 30_000,
          endingCash: 220_000,
          totalPurchases: 0,
          pcsProduced: 110,
          boxesPackaged: 10,
          boxesSold: 10,
          boxesUnsold: 0,
          pcsExpired: 0,
          inventoryLossValue: 0,
          revenue: 300_000,
          cogs: 100_000,
          grossProfit: 200_000,
          operatingExpenses: 12_000,
          netProfit: 188_000,
          avgCustomerSatisfaction: 92,
          customersServed: 13,
          customersLost: 0,
          reputationEnd: 96,
        },
      ],
      upgrades: {
        steamer: 3,
        refrigerator: 2,
        prep_table: 2,
        packaging_station: 2,
        decoration: 2,
        dining_seating: 2,
      },
      recipes: INITIAL_RECIPES.map((r, idx) => (idx < 6 ? { ...r, unlocked: true } : r)),
      researchedRecipeIds: ['chicken_carrot', 'shrimp_veg', 'tofu_mushroom'],
      kitchenStaff: [
        { id: 'prep', level: 2, hiredDay: 1, unlockedSkills: ['a', 'b'] },
        { id: 'mix', level: 2, hiredDay: 1, unlockedSkills: ['c', 'd'] },
        { id: 'wrap', level: 1, hiredDay: 1, unlockedSkills: [] },
        { id: 'steam', level: 1, hiredDay: 1, unlockedSkills: [] },
      ],
      business: {
        id: 'b-ach',
        name: 'Flagship Outlet',
        concept: 'balanced',
        targetMarket: 'general',
        difficulty: 'hard',
        level: 4,
        reputation: 96,
        createdAt: 1,
      },
      unpaidDebt: 0,
      zeroWasteStreakDays: 3,
      currentDay: 5,
    });

    expect(unlocked).toContain('qc_perfectionist');
    expect(unlocked).toContain('batch_veteran');
    expect(unlocked).toContain('recipe_collector');
    expect(unlocked).toContain('culinary_rd_master');
    expect(unlocked).toContain('dine_in_host');
    expect(unlocked).toContain('b2b_contractor');
    expect(unlocked).toContain('omnichannel_pro');
    expect(unlocked).toContain('zero_waste_hero');
    expect(unlocked).toContain('flagship_bistro');
    expect(unlocked).toContain('hard_mode_survivor');
    expect(unlocked).toContain('debt_free_discipline');
    expect(unlocked).toContain('revenue_millionaire');
    expect(unlocked).toContain('full_crew');
    expect(unlocked).toContain('skill_mentor');
    expect(unlocked).toContain('reputation_95');

    const migrated = migrateSaveSnapshot({
      version: 1,
      cashBalance: 90_000,
      business: {
        id: 'b-mig',
        name: 'Legacy Shop',
        concept: 'balanced',
        targetMarket: 'general',
        level: 1,
        reputation: 60,
        createdAt: 1,
      },
      upgrades: {
        steamer: 2,
        refrigerator: 1,
        prep_table: 1,
        packaging_station: 1,
        decoration: 1,
      },
    });
    expect(migrated?.upgrades.dining_seating).toBe(1);
    expect(migrated?.onlineOrders).toEqual([]);
    expect(migrated?.onlineDeliveryEnabled).toBe(true);
    expect(migrated?.zeroWasteStreakDays).toBe(0);
    expect(migrated?.franchiseBranches).toEqual([]);
    expect(migrated?.endlessMasteryUnlocked).toBe(false);
    expect(migrated?.prestigeLevel).toBe(0);
    expect(migrated?.rivalShop?.name).toBe('Kedai Naga Sehat');
  });

  it('cycles Weekly Culinary Festivals every 7 days, boosts traffic 2x, and biases festival customer orders', () => {
    expect(isFestivalDay(6)).toBe(false);
    expect(isFestivalDay(7)).toBe(true);
    expect(isFestivalDay(14)).toBe(true);
    expect(isFestivalDay(21)).toBe(true);

    const fest7 = getWeeklyFestivalForDay(7)!;
    const fest14 = getWeeklyFestivalForDay(14)!;
    const fest21 = getWeeklyFestivalForDay(21)!;
    expect(fest7.id).toBe('shrimp_fest');
    expect(fest14.id).toBe('plant_based_week');
    expect(fest21.id).toBe('family_bazaar');
    expect(WEEKLY_FESTIVALS).toHaveLength(3);

    const nextFromDay5 = getNextUpcomingFestival(5);
    expect(nextFromDay5.daysUntil).toBe(2);
    expect(nextFromDay5.festivalDay).toBe(7);
    expect(nextFromDay5.festival.id).toBe('shrimp_fest');

    expect(doesRecipeMatchFestival({ id: 'shrimp_veg', isVegetarian: false }, fest7)).toBe(true);
    expect(doesRecipeMatchFestival({ id: 'custom-veg', isVegetarian: true }, fest14)).toBe(true);
    expect(doesRecipeMatchFestival({ id: 'chicken_carrot', isVegetarian: false }, fest14)).toBe(false);

    const baseTraffic = getTrafficMultiplier(createDefaultUpgrades(), 60, null, undefined);
    const festTraffic = getTrafficMultiplier(createDefaultUpgrades(), 60, fest7, undefined);
    expect(festTraffic).toBeCloseTo(baseTraffic * 2, 2);

    let festivalMatchCount = 0;
    for (let i = 0; i < 40; i++) {
      const cust = spawnCustomerAgent({
        id: `fest-c-${i}`,
        business: {
          id: 'b-f',
          name: 'Fest Bistro',
          concept: 'balanced',
          targetMarket: 'general',
          level: 2,
          reputation: 70,
          createdAt: 1,
        },
        availableBatches: [],
        recipes: INITIAL_RECIPES,
        upgrades: createDefaultUpgrades(),
        seatSlot: 0,
        activeFestival: fest7,
      });
      if (fest7.targetRecipeIds.includes(cust.requestedRecipeId)) {
        festivalMatchCount += 1;
      }
    }
    expect(festivalMatchCount).toBeGreaterThanOrEqual(20);
  });

  it('applies Rival Shop ingredient price surge (+15%), rotates focus every 3 days, and erodes share via R&D', () => {
    const initRival = createInitialRivalShop();
    expect(initRival.focusIngredientIds).toEqual(['shrimp', 'broccoli']);
    expect(initRival.marketSharePct).toBe(35);

    const shrimpBase = getAdjustedPackPrice('shrimp', null, undefined);
    const shrimpPressured = getAdjustedPackPrice(
      'shrimp',
      null,
      undefined,
      initRival.focusIngredientIds,
      initRival.pricePressureMultiplier,
    );
    expect(shrimpPressured).toBeGreaterThan(shrimpBase);
    expect(shrimpPressured).toBe(Math.round((shrimpBase * 1.15) / 50) * 50);

    // Non-focus ingredient remains unaffected
    const chickenBase = getAdjustedPackPrice('chicken', null, undefined);
    const chickenChecked = getAdjustedPackPrice(
      'chicken',
      null,
      undefined,
      initRival.focusIngredientIds,
    );
    expect(chickenChecked).toBe(chickenBase);

    // Advancing to Day 4 rotates rival focus and lowers rival market share when player has 3 R&D formulas & Rep 80
    const day4Rival = advanceRivalShopState(initRival, 4, 3, 80);
    expect(day4Rival.focusIngredientIds).toEqual(['chicken', 'carrot']);
    expect(day4Rival.marketSharePct).toBe(32);
  });

  it('computes 5 Outlet Scale Tiers, Net Worth, Franchise royalties in DailyReport, and Endless Mastery gates', () => {
    expect(OUTLET_TIERS).toHaveLength(5);
    expect(getOutletTierDef(1).nameEn).toBe('Starter Street Cart');
    expect(getOutletTierDef(5).nameEn).toBe('Franchise Network');

    const upg = createDefaultUpgrades();
    const lvlWithBranches = computeBusinessLevel(150_000, 80, upg, 2);
    const lvlWithoutBranches = computeBusinessLevel(150_000, 80, upg, 0);
    expect(lvlWithBranches).toBeGreaterThan(lvlWithoutBranches);

    const sampleBranch = {
      id: 'bsd_kiosk',
      districtNameEn: 'BSD Wellness Kiosk',
      districtNameId: 'Kios Sehat BSD',
      openedDay: 5,
      investmentCost: 220_000,
      dailyNetIncome: 24_000,
      level: 2 as const,
      managerBonusPct: 40,
    };
    expect(getFranchiseBranchUpgradeCost(sampleBranch)).toBe(198_000);
    expect(computeTotalFranchiseDailyIncome([sampleBranch], 0)).toBe(24_000);
    expect(computeTotalFranchiseDailyIncome([sampleBranch], 2)).toBe(31_200);

    const netWorth = computeNetWorth({
      cashBalance: 100_000,
      ingredientValuation: 50_000,
      productValuation: 25_000,
      franchiseBranches: [sampleBranch],
      unpaidDebt: 10_000,
    });
    expect(netWorth).toBe(100_000 + 50_000 + 25_000 + 220_000 + 88_000 - 10_000);

    expect(
      canUnlockEndlessMastery({
        businessLevel: 4,
        reputation: 85,
        franchiseBranchesCount: 1,
        cashBalance: ENDLESS_MASTERY_ACTIVATION_COST,
      }),
    ).toEqual({ allowed: false, reason: 'level' });

    expect(
      canUnlockEndlessMastery({
        businessLevel: 5,
        reputation: 85,
        franchiseBranchesCount: 1,
        cashBalance: ENDLESS_MASTERY_ACTIVATION_COST,
      }),
    ).toEqual({ allowed: true });

    const reportWithFranchise = buildDailyReport({
      day: 8,
      startingCash: 100_000,
      endingCash: 112_000,
      transactions: [
        {
          id: 'tx-royalty',
          type: 'INCOME',
          category: 'FRANCHISE_INCOME',
          amount: 24_000,
          descriptionEn: 'Franchise royalties',
          descriptionId: 'Royalti cabang',
          referenceId: 'ref-royalty-day-8',
          day: 8,
          timestamp: 1,
        },
        {
          id: 'tx-opex',
          type: 'EXPENSE',
          category: 'OPERATING_EXPENSE',
          amount: 12_000,
          descriptionEn: 'OPEX',
          descriptionId: 'OPEX',
          referenceId: 'ref-opex-day-8',
          day: 8,
          timestamp: 2,
        },
      ],
      salesOrders: [],
      productBatches: [],
      pcsProduced: 0,
      boxesPackaged: 0,
      pcsExpired: 0,
      inventoryLossValue: 0,
      customersServed: 0,
      customersLost: 0,
      satisfactionSum: 0,
      reputationEnd: 80,
    });
    expect(reportWithFranchise.franchiseIncome).toBe(24_000);
    expect(reportWithFranchise.netProfit).toBe(12_000);
  });

  it('computes 3D cashier showcase box stacks from active packaged stock and scales 3D decor by upgrade & festival state', () => {
    const emptyLayout = computeCashierShowcaseLayout([], INITIAL_RECIPES, 1);
    expect(emptyLayout.totalBoxesReady).toBe(0);
    expect(emptyLayout.visibleBoxesCount).toBe(0);
    expect(emptyLayout.stockTier).toBe('empty');
    expect(emptyLayout.slots).toHaveLength(0);

    const batches: ProductBatch[] = [
      {
        id: 'pb-1',
        productionBatchId: 'prod-1',
        recipeId: 'chicken_carrot',
        packagingTypeId: 'paper_box',
        boxesProduced: 6,
        boxesAvailable: 6,
        pcsPerBox: 4,
        unitCostPerBox: 8_000,
        sellingPricePerBox: 12_000,
        qualityScore: 86,
        status: 'PACKAGED',
        producedDay: 2,
        expiryDay: 4,
      },
      {
        id: 'pb-2',
        productionBatchId: 'prod-2',
        recipeId: 'shrimp_veg',
        packagingTypeId: 'family_box',
        boxesProduced: 9,
        boxesAvailable: 9,
        pcsPerBox: 16,
        unitCostPerBox: 22_000,
        sellingPricePerBox: 33_000,
        clearanceDiscountPct: 25,
        qualityScore: 88,
        status: 'PACKAGED',
        producedDay: 2,
        expiryDay: 3,
      },
      {
        id: 'pb-expired',
        productionBatchId: 'prod-old',
        recipeId: 'tofu_mushroom',
        packagingTypeId: 'standard_box',
        boxesProduced: 5,
        boxesAvailable: 5,
        pcsPerBox: 8,
        unitCostPerBox: 14_000,
        sellingPricePerBox: 21_000,
        qualityScore: 80,
        status: 'PACKAGED',
        producedDay: 1,
        expiryDay: 1,
      },
    ];

    const populated = computeCashierShowcaseLayout(batches, INITIAL_RECIPES, 2);
    expect(populated.totalBoxesReady).toBe(15);
    expect(populated.visibleBoxesCount).toBe(12); // capped to warmer showcase capacity
    expect(populated.stockTier).toBe('full');
    expect(populated.slots[0].packagingTypeId).toBe('paper_box');
    expect(populated.slots[1].packagingTypeId).toBe('family_box');
    expect(populated.slots[1].isClearance).toBe(true);
    // Stacked second layer has higher y than base layer
    expect(populated.slots[4].y).toBeGreaterThan(populated.slots[0].y);

    const baseDeco = computeShopDecorationVisualState(createDefaultUpgrades(), null);
    expect(baseDeco.lanternCount).toBe(1);
    expect(baseDeco.plantPositions).toHaveLength(1);
    expect(baseDeco.hasDiningRug).toBe(false);
    expect(baseDeco.hasFestivalBanner).toBe(false);

    const upgradedDeco = computeShopDecorationVisualState(
      { ...createDefaultUpgrades(), decoration: 3 },
      WEEKLY_FESTIVALS[0],
    );
    expect(upgradedDeco.lanternCount).toBe(6); // 4 base + 2 festival
    expect(upgradedDeco.plantPositions.length).toBeGreaterThanOrEqual(5);
    expect(upgradedDeco.hasMenuBoardLight).toBe(true);
    expect(upgradedDeco.hasDiningRug).toBe(true);
    expect(upgradedDeco.hasFestivalBanner).toBe(true);
  });

  it('generates 3 distinct randomized Daily Missions from unlocked recipes, tracks gameplay events, prevents double-claims, and migrates legacy saves', () => {
    // 1. Fixed RNG sequence guarantees deterministic variety across 3 unique types
    let seed = 0.12;
    const seqRng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const missions = generateDailyMissions({
      day: 3,
      businessLevel: 2,
      recipes: INITIAL_RECIPES,
      upgrades: { ...createDefaultUpgrades(), steamer: 2 },
      rng: seqRng,
    });
    expect(missions).toHaveLength(3);
    const uniqueTypes = new Set(missions.map((m) => m.type));
    expect(uniqueTypes.size).toBe(3);

    const unlockedIds = new Set(INITIAL_RECIPES.filter((r) => r.unlocked).map((r) => r.id));
    for (const m of missions) {
      expect(m.day).toBe(3);
      expect(m.completed).toBe(false);
      expect(m.claimed).toBe(false);
      expect(m.rewardCash).toBeGreaterThanOrEqual(10_000);
      if (m.recipeId) {
        expect(unlockedIds.has(m.recipeId)).toBe(true);
      }
    }

    // 2. Progress tracking across COOK_QC, PACKAGE, and SALE (e.g. Sell 50 Shrimp Dumplings)
    const sampleMissions = [
      {
        id: 'm-shrimp',
        day: 1,
        type: 'SELL_RECIPE_PCS' as const,
        recipeId: 'shrimp_veg',
        titleEn: 'Sell 50 Shrimp Vegetable Dimsum',
        titleId: 'Jual 50 Dimsum Udang Sayur',
        descriptionEn: 'Sell 50 pcs.',
        descriptionId: 'Jual 50 pcs.',
        target: 50,
        current: 0,
        completed: false,
        claimed: false,
        rewardCash: 34_500,
        unitLabelEn: 'pcs',
        unitLabelId: 'pcs',
      },
      {
        id: 'm-qc',
        day: 1,
        type: 'HIGH_QC_BATCH' as const,
        minQualityScore: 85,
        titleEn: 'Chef Craft: 1 Batch QC >= 85',
        titleId: 'Kualitas Prima: 1 Batch QC >= 85',
        descriptionEn: 'High QC',
        descriptionId: 'QC Tinggi',
        target: 1,
        current: 0,
        completed: false,
        claimed: false,
        rewardCash: 15_000,
        unitLabelEn: 'batch',
        unitLabelId: 'batch',
      },
      {
        id: 'm-pkg',
        day: 1,
        type: 'PACKAGE_BOXES' as const,
        titleEn: 'Pack 4 Fresh Boxes',
        titleId: 'Kemas 4 Kotak Siap Jual',
        descriptionEn: 'Pack 4 boxes',
        descriptionId: 'Kemas 4 kotak',
        target: 4,
        current: 0,
        completed: false,
        claimed: false,
        rewardCash: 16_000,
        unitLabelEn: 'boxes',
        unitLabelId: 'kotak',
      },
    ];

    // Cannot claim incomplete mission
    expect(claimDailyMissionReward(sampleMissions, 'm-shrimp').ok).toBe(false);

    const afterCook = applyDailyMissionProgress(sampleMissions, {
      type: 'COOK_QC',
      pcsProduced: 50,
      qualityScore: 91,
      passedQc: true,
    });
    expect(afterCook.newlyCompleted.map((m) => m.id)).toEqual(['m-qc']);

    const afterPkg = applyDailyMissionProgress(afterCook.missions, {
      type: 'PACKAGE',
      boxesPackaged: 4,
    });
    expect(afterPkg.newlyCompleted.map((m) => m.id)).toEqual(['m-pkg']);

    // Selling unrelated recipe does not progress Shrimp mission
    const afterChickenSale = applyDailyMissionProgress(afterPkg.missions, {
      type: 'SALE',
      recipeId: 'chicken_carrot',
      pcsSold: 16,
      boxesSold: 2,
      revenueAmount: 30_000,
      orderType: 'DIRECT',
    });
    expect(afterChickenSale.missions.find((m) => m.id === 'm-shrimp')?.current).toBe(0);

    // Selling 50 Shrimp pcs completes Shrimp mission
    const afterShrimpSale = applyDailyMissionProgress(afterChickenSale.missions, {
      type: 'SALE',
      recipeId: 'shrimp_veg',
      pcsSold: 50,
      boxesSold: 5,
      revenueAmount: 100_000,
      orderType: 'DIRECT',
    });
    expect(afterShrimpSale.newlyCompleted.map((m) => m.id)).toEqual(['m-shrimp']);
    expect(afterShrimpSale.missions.find((m) => m.id === 'm-shrimp')?.completed).toBe(true);

    // Claim works once & blocks duplicate claims
    const firstClaim = claimDailyMissionReward(afterShrimpSale.missions, 'm-shrimp');
    expect(firstClaim.ok).toBe(true);
    expect(firstClaim.rewardCash).toBe(34_500);
    expect(claimDailyMissionReward(firstClaim.missions, 'm-shrimp').ok).toBe(false);

    // 3. Legacy save migration backfills 3 Daily Missions automatically
    const migrated = migrateSaveSnapshot({
      version: 1,
      currentDay: 4,
      cashBalance: 120_000,
      business: {
        id: 'b-dm-mig',
        name: 'Migrated Outlet',
        concept: 'balanced',
        targetMarket: 'general',
        level: 2,
        reputation: 65,
        createdAt: 1,
      },
    });
    expect(migrated?.dailyMissions).toHaveLength(3);
  });
});


