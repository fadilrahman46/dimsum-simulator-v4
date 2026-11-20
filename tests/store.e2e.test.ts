import { beforeEach, describe, expect, it } from 'vitest';
import {
  DAILY_EVENTS,
  DINE_IN_EATING_DURATION_SEC,
  DINE_IN_REVENUE_MULTIPLIER,
  ECONOMY_RULES,
  RECIPE_RESEARCH_DEFS,
  getStaffMorale,
  getWeeklyFestivalForDay,
} from '../src/config/gameBalance';
import { ENDLESS_MASTERY_ACTIVATION_COST } from '../src/domain/progressionEngine';
import { useGameStore } from '../src/store/useGameStore';
import type { CustomerAgent } from '../src/types/game';

async function resetStoreToEasy(opts?: {
  concept?: 'balanced' | 'vegetarian' | 'premium';
  difficulty?: 'easy' | 'medium' | 'hard';
}) {
  await useGameStore.getState().resetGame();
  await useGameStore.getState().startNewGame({
    name: 'Test Dimsum Outlet',
    concept: opts?.concept ?? 'balanced',
    targetMarket: 'general',
    difficulty: opts?.difficulty ?? 'easy',
    enableTutorial: false,
  });
}

describe('Dimsumpreneur Store Integration & Full E2E Lifecycle', () => {
  beforeEach(async () => {
    await resetStoreToEasy();
  });

  it('initializes Easy (500k), Medium (300k), and Hard (150k) difficulties and Vegetarian starter unlock', async () => {
    expect(useGameStore.getState().cashBalance).toBe(100_000);
    expect(useGameStore.getState().gameState).toBe('MORNING_PREP');
    expect(useGameStore.getState().activeDailyEvent).not.toBeNull();
    expect(useGameStore.getState().preOrders.length).toBeGreaterThan(0);

    await resetStoreToEasy({ difficulty: 'medium', concept: 'vegetarian' });
    expect(useGameStore.getState().cashBalance).toBe(60_000);
    expect(
      useGameStore.getState().recipes.find((r) => r.id === 'rainbow_veggie')?.unlocked,
    ).toBe(true);

    await resetStoreToEasy({ difficulty: 'hard' });
    expect(useGameStore.getState().cashBalance).toBe(30_000);
  });

  it('applies negotiated bulk supplier discounts on purchase and enforces strained pricing on walkout', () => {
    const store = useGameStore.getState();

    // 1. Successful bulk negotiation with Segar Poultry Farm (10% off 3+ packs)
    store.recordNegotiationOutcome({
      supplier: 'Segar Poultry Farm',
      outcome: 'ACCEPTED',
      discountRate: 0.1,
      minPacks: 3,
      trustDelta: 3,
    });

    let state = useGameStore.getState();
    expect(state.activeSupplierDeals['Segar Poultry Farm']?.discountRate).toBe(0.1);
    expect(state.supplierRelationships['Segar Poultry Farm'].trust).toBe(68);

    const cashBeforeBuy = state.cashBalance;
    const chickenBase = 22_500;
    const expectedPackPrice = Math.round((chickenBase * 0.9) / 50) * 50; // 20_250
    const buyRes = state.purchaseMarketCart({ chicken: 3 }, { paper_box: 0, standard_box: 0, family_box: 0 });
    expect(buyRes.ok).toBe(true);

    state = useGameStore.getState();
    expect(cashBeforeBuy - state.cashBalance).toBe(expectedPackPrice * 3);
    // Deal consumed after checkout
    expect(state.activeSupplierDeals['Segar Poultry Farm']).toBeUndefined();

    // 2. Walkout damages trust into strained tier (<35) & triggers +10% surcharge
    state.recordNegotiationOutcome({
      supplier: 'Nusantara Seafood',
      outcome: 'WALKED_OUT',
      discountRate: 0,
      minPacks: 3,
      trustDelta: -35,
    });

    state = useGameStore.getState();
    expect(state.supplierRelationships['Nusantara Seafood'].trust).toBe(30);

    const cashBeforeShrimp = state.cashBalance;
    const shrimpRes = state.purchaseMarketCart(
      { shrimp: 1 },
      { paper_box: 0, standard_box: 0, family_box: 0 },
    );
    expect(shrimpRes.ok).toBe(true);

    // Shrimp base 17_500 * 1.10 = 19_250
    const spentOnShrimp = cashBeforeShrimp - useGameStore.getState().cashBalance;
    expect(spentOnShrimp).toBeGreaterThan(17_500);
  });

  it('unlocks recipes, creates custom recipes, and researches healthier R&D formulas', () => {
    const store = useGameStore.getState();

    // Cannot research locked rainbow_veggie yet
    const lockedResearch = store.researchRecipe('rainbow_veggie');
    expect(lockedResearch.ok).toBe(false);

    // Unlock rainbow_veggie (Rp35.000)
    const unlockRes = store.unlockRecipe('rainbow_veggie');
    expect(unlockRes.ok).toBe(true);
    expect(useGameStore.getState().cashBalance).toBe(65_000);

    // Research chicken_carrot (Rp30.000)
    const researchDef = RECIPE_RESEARCH_DEFS.find((r) => r.recipeId === 'chicken_carrot')!;
    const rdRes = useGameStore.getState().researchRecipe('chicken_carrot');
    expect(rdRes.ok).toBe(true);

    const afterRd = useGameStore.getState();
    expect(afterRd.cashBalance).toBe(65_000 - researchDef.researchCost);
    expect(afterRd.researchedRecipeIds).toContain('chicken_carrot');
    const upgradedChicken = afterRd.recipes.find((r) => r.id === 'chicken_carrot')!;
    expect(upgradedChicken.researched).toBe(true);
    expect(upgradedChicken.baseQuality).toBe(researchDef.newBaseQuality);

    // Duplicate research rejected
    expect(afterRd.researchRecipe('chicken_carrot').ok).toBe(false);

    // Custom recipe creation
    afterRd.createCustomRecipe({
      nameEn: 'Herb Tofu Bite',
      nameId: 'Dimsum Tahu Herbal',
      descriptionEn: 'Custom plant recipe',
      descriptionId: 'Resep nabati kustom',
      batchSize: 10,
      productionTimeSec: 45,
      difficulty: 'easy',
      baseQuality: 78,
      shelfLifeDays: 2,
      isVegetarian: true,
      accentColor: '#6E9B72',
      ingredients: [
        { ingredientId: 'tofu', quantity: 90 },
        { ingredientId: 'wrapper', quantity: 10 },
      ],
    });
    expect(
      useGameStore.getState().recipes.some((r) => r.isCustom && r.nameEn === 'Herb Tofu Bite'),
    ).toBe(true);
  });

  it('executes Staff Hiring, Skill Tree Training, Wellness Shifts, 4-Stage Cooking, QC, Packaging, Cashier Service, Events, Popups, Daily Goals, and Day 2 Transition', () => {
    // Give comfortable operating cash for hiring & upgrades test
    useGameStore.setState({
      cashBalance: 350_000,
      activeDailyEvent: DAILY_EVENTS.find((e) => e.id === 'food_critic')!,
      business: { ...useGameStore.getState().business, reputation: 60 },
    });

    // 1. Hire Prep & Steam helpers, train Prep Lv2, and train Skill Tree nodes
    expect(useGameStore.getState().hireKitchenHelper('prep').ok).toBe(true);
    expect(useGameStore.getState().hireKitchenHelper('steam').ok).toBe(true);
    expect(useGameStore.getState().trainKitchenHelper('prep').ok).toBe(true);

    const cashBeforeSkill = useGameStore.getState().cashBalance;
    expect(useGameStore.getState().startStaffSkillTraining('prep', 'prep_mise_en_place').ok).toBe(true);
    expect(useGameStore.getState().cashBalance).toBe(cashBeforeSkill - 8_000);
    useGameStore.getState().completeStaffSkillTraining();
    expect(
      useGameStore.getState().kitchenStaff.find((h) => h.id === 'prep')?.unlockedSkills,
    ).toContain('prep_mise_en_place');

    // Daily 1-drill limit per helper blocks second drill for Prep on Day 1
    expect(useGameStore.getState().startStaffSkillTraining('prep', 'prep_knife_speed').ok).toBe(false);

    // Cancel + refund flow check on Steam helper
    const cashBeforeSteamDrill = useGameStore.getState().cashBalance;
    expect(useGameStore.getState().startStaffSkillTraining('steam', 'steam_valve_tuning').ok).toBe(true);
    expect(useGameStore.getState().cashBalance).toBe(cashBeforeSteamDrill - 8_000);
    useGameStore.getState().cancelStaffSkillTraining();
    expect(useGameStore.getState().activeSkillTraining).toBeNull();
    expect(useGameStore.getState().cashBalance).toBe(cashBeforeSteamDrill);

    // 2. Run 2x 1-batch cooking sessions (20 pcs total -> hits daily_production goal of 20 pcs!)
    for (let i = 0; i < 2; i++) {
      const startRes = useGameStore.getState().startCookingSession('chicken_carrot', 1);
      expect(startRes.ok).toBe(true);
      useGameStore.getState().completeCookingStage('PREP', 92);
      useGameStore.getState().completeCookingStage('MIX', 90);
      useGameStore.getState().completeCookingStage('WRAP', 91);
      useGameStore.getState().completeCookingStage('STEAM', 93);
    }

    let state = useGameStore.getState();
    expect(state.productionBatches).toHaveLength(2);
    expect(state.productionBatches[0].status).toBe('QC_PASSED');
    expect(state.todayStats.pcsProduced).toBe(20);
    // Daily Production Bonus Objective (+Rp8.000) paid automatically
    expect(
      state.transactions.some(
        (tx) => tx.category === 'GOAL_BONUS' && tx.referenceId === 'bonus-daily-cook-day-1',
      ),
    ).toBe(true);

    // Employee morale dropped after 2 consecutive batches (85 -> 79 -> 69)
    const prepAfter2Batches = state.kitchenStaff.find((h) => h.id === 'prep')!;
    expect(getStaffMorale(prepAfter2Batches)).toBe(69);
    expect(prepAfter2Batches.consecutiveWorkBatches).toBe(2);

    // Assigning Wellness shift grants +15% instant boost (69 -> 84) & resets streak
    state.setKitchenHelperShift('prep', 'wellness');
    const prepWellness = useGameStore.getState().kitchenStaff.find((h) => h.id === 'prep')!;
    expect(prepWellness.shift).toBe('wellness');
    expect(getStaffMorale(prepWellness)).toBe(84);
    expect(prepWellness.consecutiveWorkBatches).toBe(0);

    // 3. Test Failed QC batch discard
    expect(useGameStore.getState().startCookingSession('tofu_mushroom', 1).ok).toBe(true);
    useGameStore.getState().completeCookingStage('PREP', 20);
    useGameStore.getState().completeCookingStage('MIX', 25);
    useGameStore.getState().completeCookingStage('WRAP', 20);
    useGameStore.getState().completeCookingStage('STEAM', 20);
    const failedBatch = useGameStore
      .getState()
      .productionBatches.find((b) => b.status === 'QC_FAILED');
    expect(failedBatch).toBeDefined();
    useGameStore.getState().discardQcBatch(failedBatch!.id);
    expect(
      useGameStore.getState().productionBatches.some((b) => b.id === failedBatch!.id),
    ).toBe(false);

    // 4. Package both QC_PASSED batches into paper_box (4 pcs each) -> 4 boxes + pool remaining 2+2 = 5 boxes total (0 leftover!)
    const passedBatches = useGameStore
      .getState()
      .productionBatches.filter((b) => b.status === 'QC_PASSED');
    for (const pb of passedBatches) {
      useGameStore.getState().acknowledgeQcBatch(pb.id);
      const packRes = useGameStore.getState().packageBatch(pb.id, 'paper_box', 2, 0.5);
      expect(packRes.ok).toBe(true);
    }
    expect(useGameStore.getState().packageRecipePool('chicken_carrot', 'paper_box', 1, 0.5).ok).toBe(true);

    state = useGameStore.getState();
    expect(state.productBatches.length).toBeGreaterThanOrEqual(3);
    expect(state.todayStats.boxesPackaged).toBe(5);
    expect(
      state.productionBatches.filter((b) => b.recipeId === 'chicken_carrot' && b.quantity > 0),
    ).toHaveLength(0);

    // 5. Open store & simulate customer ticks + serve 4 customers to hit Daily Customers Bonus
    const openRes = state.openStore();
    expect(openRes.ok).toBe(true);
    expect(useGameStore.getState().customers).toHaveLength(1);

    // Advance simulation so first customer moves to WAITING_ORDER and spawn more
    useGameStore.getState().tickStoreSimulation(1);
    useGameStore.getState().tickStoreSimulation(1);

    // Inject deterministic customers to test serving 4 customers cleanly
    const targetProductBatch = useGameStore.getState().productBatches[0];
    const secondProductBatch = useGameStore.getState().productBatches[1];
    const mockCustomers: CustomerAgent[] = [0, 1, 2, 3].map((idx) => ({
      id: `e2e-cust-${idx}`,
      archetypeId: 'student',
      name: `Pelanggan ${idx + 1}`,
      requestedRecipeId: 'chicken_carrot',
      requestedBoxType: 'paper_box',
      quantityBoxes: 1,
      maxBudget: 35_000,
      patienceMax: 30,
      patienceRemaining: 28,
      lifecycle: 'WAITING_ORDER',
      spawnTimeSec: 0,
      dialogueEn: 'One healthy dimsum box please!',
      dialogueId: 'Satu kotak dimsum sehat ya!',
      seatSlot: idx,
    }));

    useGameStore.setState({ customers: mockCustomers });
    const repBeforeSales = useGameStore.getState().business.reputation;
    const cashBeforeSales = useGameStore.getState().cashBalance;

    expect(
      useGameStore.getState().serveCustomer(mockCustomers[0].id, targetProductBatch.id).ok,
    ).toBe(true);
    expect(
      useGameStore.getState().serveCustomer(mockCustomers[1].id, targetProductBatch.id).ok,
    ).toBe(true);
    expect(
      useGameStore.getState().serveCustomer(mockCustomers[2].id, secondProductBatch.id).ok,
    ).toBe(true);
    expect(
      useGameStore.getState().serveCustomer(mockCustomers[3].id, secondProductBatch.id).ok,
    ).toBe(true);

    state = useGameStore.getState();
    expect(state.salesOrders).toHaveLength(4);
    expect(state.todayStats.customersServed).toBe(4);
    // Food Critic (+20%) applied to revenue & Customer Feedback Popups emitted & Reputation climbed
    expect(state.business.reputation).toBeGreaterThan(repBeforeSales);
    expect(state.feedbackPopups.length).toBeGreaterThan(0);
    // Daily Customer Bonus (+Rp10.000) paid automatically
    expect(
      state.transactions.some(
        (tx) =>
          tx.category === 'GOAL_BONUS' && tx.referenceId === 'bonus-daily-customers-day-1',
      ),
    ).toBe(true);
    expect(state.cashBalance).toBeGreaterThan(cashBeforeSales);

    // Dismiss popup check
    const firstPopupId = state.feedbackPopups[0].id;
    state.dismissFeedbackPopup(firstPopupId);
    expect(
      useGameStore.getState().feedbackPopups.some((f) => f.id === firstPopupId),
    ).toBe(false);

    // 6. Upgrade Steamer to Lv 2
    expect(useGameStore.getState().purchaseUpgrade('steamer').ok).toBe(true);
    expect(useGameStore.getState().upgrades.steamer).toBe(2);

    // 7. Close store & generate Daily Report (deducts base OPEX Rp12.000 + daily payroll Rp15.000)
    const cashBeforeClose = useGameStore.getState().cashBalance;
    useGameStore.getState().closeStoreAndGenerateReport();
    state = useGameStore.getState();
    expect(state.gameState).toBe('FINANCIAL_REPORT');
    expect(state.dailyReports).toHaveLength(1);
    const report = state.dailyReports[0];
    expect(report.customersServed).toBe(4);
    expect(report.operatingExpenses).toBe(ECONOMY_RULES.dailyBaseOpex + 15_000);
    expect(cashBeforeClose - state.cashBalance).toBe(ECONOMY_RULES.dailyBaseOpex + 15_000);

    // 8. Advance to Day 2 -> overnight wellness recovery + new Daily Event
    useGameStore.getState().advanceToNextDay();
    state = useGameStore.getState();
    expect(state.currentDay).toBe(2);
    expect(state.gameState).toBe('MORNING_PREP');
    expect(state.activeDailyEvent).not.toBeNull();
    expect(state.activeDailyEvent?.id).not.toBe('food_critic');
    // Prep helper on wellness recovers +28 overnight (84 -> 100 capped)
    const prepDay2 = state.kitchenStaff.find((h) => h.id === 'prep')!;
    expect(getStaffMorale(prepDay2)).toBe(100);
  });

  it('triggers Serve 50 Customers milestone payout and detects Bankruptcy accurately', () => {
    // Verify Serve 50 Customers milestone bonus triggers on the 50th sale
    useGameStore.setState({
      salesOrders: Array.from({ length: 49 }, (_, i) => ({
        id: `prev-order-${i}`,
        customerId: `pc-${i}`,
        customerName: 'Guest',
        archetypeId: 'student',
        orderType: 'DIRECT',
        productBatchId: 'pb-dummy',
        recipeId: 'chicken_carrot',
        boxType: 'paper_box',
        quantityBoxes: 1,
        unitPrice: 12_000,
        discount: 0,
        totalAmount: 12_000,
        totalCogs: 7_000,
        satisfaction: 90,
        day: 1,
        timestamp: Date.now(),
      })),
      productBatches: [
        {
          id: 'pb-milestone',
          productionBatchId: 'prod-m',
          recipeId: 'chicken_carrot',
          packagingTypeId: 'paper_box',
          boxesProduced: 2,
          boxesAvailable: 2,
          pcsPerBox: 4,
          unitCostPerBox: 6_000,
          sellingPricePerBox: 12_000,
          qualityScore: 90,
          status: 'PACKAGED',
          producedDay: 1,
          expiryDay: 3,
        },
      ],
      customers: [
        {
          id: 'cust-50',
          archetypeId: 'student',
          name: 'Tamu Ke-50',
          requestedRecipeId: 'chicken_carrot',
          requestedBoxType: 'paper_box',
          quantityBoxes: 1,
          maxBudget: 25_000,
          patienceMax: 30,
          patienceRemaining: 28,
          lifecycle: 'WAITING_ORDER',
          spawnTimeSec: 0,
          dialogueEn: 'Hi!',
          dialogueId: 'Halo!',
          seatSlot: 0,
        },
      ],
    });

    expect(useGameStore.getState().serveCustomer('cust-50', 'pb-milestone').ok).toBe(true);
    expect(
      useGameStore
        .getState()
        .transactions.some(
          (tx) => tx.category === 'GOAL_BONUS' && tx.referenceId === 'bonus-milestone-serve-50',
        ),
    ).toBe(true);

    // Bankruptcy check when advancing day with zero cash, zero ingredients, zero product
    useGameStore.setState({
      cashBalance: 1_000,
      ingredientLots: [],
      productionBatches: [],
      productBatches: [],
    });
    useGameStore.getState().advanceToNextDay();
    expect(useGameStore.getState().gameState).toBe('GAME_OVER');
  });

  it('prevents Rp0 cash OPEX/payroll dodge via unpaidDebt, applies morale penalty, and persists activeSkillTraining & debt', async () => {
    useGameStore.setState({ cashBalance: 150_000 });
    expect(useGameStore.getState().hireKitchenHelper('prep').ok).toBe(true);

    // Start skill training & persist to SaveSnapshot, then reload via continueSavedGame
    expect(useGameStore.getState().startStaffSkillTraining('prep', 'prep_mise_en_place').ok).toBe(true);
    await useGameStore.getState().persistNow();
    useGameStore.setState({ activeSkillTraining: null });
    await useGameStore.getState().continueSavedGame();
    expect(useGameStore.getState().activeSkillTraining?.nodeId).toBe('prep_mise_en_place');
    useGameStore.getState().cancelStaffSkillTraining();

    // Drain cash to Rp0 before closing -> OPEX (Rp12.000) + Prep Wage (Rp6.000) = Rp18.000 debt & -20 morale
    useGameStore.setState({ cashBalance: 0 });
    useGameStore.getState().closeStoreAndGenerateReport();
    let state = useGameStore.getState();
    expect(state.cashBalance).toBe(0);
    expect(state.unpaidDebt).toBe(ECONOMY_RULES.dailyBaseOpex + 6_000);
    expect(state.dailyReports[0].operatingExpenses).toBe(ECONOMY_RULES.dailyBaseOpex + 6_000);
    expect(getStaffMorale(state.kitchenStaff[0])).toBe(65); // 85 - 20 unpaid wage penalty

    // Advancing to Day 2 adds 10% overnight late interest (18.000 -> 19.800)
    useGameStore.getState().advanceToNextDay();
    state = useGameStore.getState();
    expect(state.unpaidDebt).toBe(19_800);

    // Repay debt manually
    useGameStore.setState({ cashBalance: 25_000 });
    expect(useGameStore.getState().repayDebt().ok).toBe(true);
    expect(useGameStore.getState().unpaidDebt).toBe(0);
    expect(useGameStore.getState().cashBalance).toBe(5_200);
  });

  it('persists independent bgmVolume and sfxVolume settings across save/load roundtrip', async () => {
    useGameStore.getState().setBgmVolume(0.2);
    useGameStore.getState().setSfxVolume(0.9);
    expect(useGameStore.getState().bgmVolume).toBe(0.2);
    expect(useGameStore.getState().sfxVolume).toBe(0.9);

    await useGameStore.getState().persistNow();
    useGameStore.setState({ bgmVolume: 0.45, sfxVolume: 0.75 });
    await useGameStore.getState().continueSavedGame();

    expect(useGameStore.getState().bgmVolume).toBe(0.2);
    expect(useGameStore.getState().sfxVolume).toBe(0.9);
  });

  it('runs Auto-Batch Delegation lifecycle with 2+ kitchen helpers, FEFO deduction, morale wear, and SaveSnapshot roundtrip', async () => {
    useGameStore.setState({ cashBalance: 200_000 });

    // Blocked when fewer than 2 active kitchen helpers are hired
    expect(useGameStore.getState().startDelegatedCooking('chicken_carrot', 1).ok).toBe(false);

    expect(useGameStore.getState().hireKitchenHelper('prep').ok).toBe(true);
    expect(useGameStore.getState().startDelegatedCooking('chicken_carrot', 1).ok).toBe(false);

    expect(useGameStore.getState().hireKitchenHelper('mix').ok).toBe(true);
    const delRes = useGameStore.getState().startDelegatedCooking('chicken_carrot', 1);
    expect(delRes.ok).toBe(true);

    let state = useGameStore.getState();
    expect(state.activeDelegation).not.toBeNull();
    expect(state.activeDelegation?.recipeId).toBe('chicken_carrot');
    expect(state.activeDelegation?.assignedHelpers).toEqual(['prep', 'mix']);

    // Cannot start manual or duplicate delegated batch while kitchen is busy
    expect(state.startCookingSession('chicken_carrot', 1).ok).toBe(false);
    expect(state.startDelegatedCooking('chicken_carrot', 1).ok).toBe(false);

    // Persists activeDelegation cleanly across SaveSnapshot reload
    await state.persistNow();
    useGameStore.setState({ activeDelegation: null });
    await useGameStore.getState().continueSavedGame();
    expect(useGameStore.getState().activeDelegation?.recipeId).toBe('chicken_carrot');

    // Complete delegation -> produces QC_PASSED batch, increments pcsProduced, updates helper morale
    useGameStore.getState().completeDelegatedCooking();
    state = useGameStore.getState();
    expect(state.activeDelegation).toBeNull();
    expect(state.productionBatches).toHaveLength(1);
    expect(state.productionBatches[0].status).toBe('QC_PASSED');
    expect(state.todayStats.pcsProduced).toBe(10);
    expect(getStaffMorale(state.kitchenStaff.find((h) => h.id === 'prep'))).toBe(79);
    expect(getStaffMorale(state.kitchenStaff.find((h) => h.id === 'mix'))).toBe(79);

    // Safe no-op if called again when idle
    useGameStore.getState().completeDelegatedCooking();
    expect(useGameStore.getState().productionBatches).toHaveLength(1);
  });

  it('enforces Clearance Sale on batches expiring today, toggles discounts, and flags clearance receipts', () => {
    useGameStore.setState({
      productBatches: [
        {
          id: 'pb-future',
          productionBatchId: 'prod-f',
          recipeId: 'chicken_carrot',
          packagingTypeId: 'paper_box',
          boxesProduced: 1,
          boxesAvailable: 1,
          pcsPerBox: 4,
          unitCostPerBox: 6_000,
          sellingPricePerBox: 12_000,
          qualityScore: 88,
          status: 'PACKAGED',
          producedDay: 1,
          expiryDay: 3,
        },
        {
          id: 'pb-today',
          productionBatchId: 'prod-t',
          recipeId: 'chicken_carrot',
          packagingTypeId: 'paper_box',
          boxesProduced: 2,
          boxesAvailable: 2,
          pcsPerBox: 4,
          unitCostPerBox: 6_000,
          sellingPricePerBox: 12_000,
          qualityScore: 88,
          status: 'PACKAGED',
          producedDay: 1,
          expiryDay: 1,
        },
      ],
      customers: [
        {
          id: 'cust-clear',
          archetypeId: 'student',
          name: 'Dina',
          requestedRecipeId: 'chicken_carrot',
          requestedBoxType: 'paper_box',
          quantityBoxes: 1,
          maxBudget: 15_000,
          patienceMax: 30,
          patienceRemaining: 28,
          lifecycle: 'WAITING_ORDER',
          spawnTimeSec: 0,
          dialogueEn: 'Any discount boxes?',
          dialogueId: 'Ada diskon hari ini?',
          seatSlot: 0,
        },
      ],
    });

    // Rejects clearance on stock not expiring today
    expect(useGameStore.getState().applyClearanceSale('pb-future', 25).ok).toBe(false);

    // Applies -25% (12.000 -> 9.000), restores 0% (12.000), then applies -40% (7.200)
    expect(useGameStore.getState().applyClearanceSale('pb-today', 25).ok).toBe(true);
    let todayBatch = useGameStore
      .getState()
      .productBatches.find((b) => b.id === 'pb-today')!;
    expect(todayBatch.sellingPricePerBox).toBe(9_000);
    expect(todayBatch.originalSellingPricePerBox).toBe(12_000);
    expect(todayBatch.clearanceDiscountPct).toBe(25);

    expect(useGameStore.getState().applyClearanceSale('pb-today', 0).ok).toBe(true);
    todayBatch = useGameStore
      .getState()
      .productBatches.find((b) => b.id === 'pb-today')!;
    expect(todayBatch.sellingPricePerBox).toBe(12_000);
    expect(todayBatch.clearanceDiscountPct).toBe(0);

    expect(useGameStore.getState().applyClearanceSale('pb-today', 40).ok).toBe(true);
    todayBatch = useGameStore
      .getState()
      .productBatches.find((b) => b.id === 'pb-today')!;
    expect(todayBatch.sellingPricePerBox).toBe(7_200);

    // Serve customer & confirm SalesOrder receipt is tagged isClearance: true
    expect(useGameStore.getState().serveCustomer('cust-clear', 'pb-today').ok).toBe(true);
    const order = useGameStore.getState().salesOrders[0];
    expect(order.isClearance).toBe(true);
    expect(order.unitPrice).toBe(7_200);
  });

  it('serves Dine-In guests with +18% revenue & EATING lifecycle, activates Rush Hour waves, and handles Online Delivery courier orders', () => {
    useGameStore.setState({
      activeDailyEvent: null,
      cashBalance: 100_000,
      business: { ...useGameStore.getState().business, reputation: 70 },
      productBatches: [
        {
          id: 'pb-p1',
          productionBatchId: 'prod-p1',
          recipeId: 'chicken_carrot',
          packagingTypeId: 'paper_box',
          boxesProduced: 6,
          boxesAvailable: 6,
          pcsPerBox: 4,
          unitCostPerBox: 6_000,
          sellingPricePerBox: 10_000,
          qualityScore: 92,
          status: 'PACKAGED',
          producedDay: 1,
          expiryDay: 3,
        },
      ],
      customers: [
        {
          id: 'cust-dine',
          archetypeId: 'family',
          name: 'Keluarga Budi',
          requestedRecipeId: 'chicken_carrot',
          requestedBoxType: 'paper_box',
          quantityBoxes: 1,
          maxBudget: 20_000,
          patienceMax: 30,
          patienceRemaining: 28,
          lifecycle: 'WAITING_ORDER',
          diningMode: 'DINE_IN',
          tableSlot: 0,
          spawnTimeSec: 0,
          dialogueEn: 'Dining in please!',
          dialogueId: 'Makan di tempat ya!',
          seatSlot: 0,
        },
      ],
      onlineOrders: [
        {
          id: 'ojol-1',
          platform: 'GoFood',
          courierName: 'Mas Budi (Ojol)',
          recipeId: 'chicken_carrot',
          boxType: 'paper_box',
          quantityBoxes: 2,
          grossPricePerBox: 12_000,
          commissionRate: 0.18,
          netPayoutPerBox: 9_800,
          timeRemainingSec: 25,
          timeMaxSec: 25,
        },
      ],
      gameState: 'STORE_OPEN',
      storeTimeRemainingSec: 71,
      spawnCooldownSec: 0.5,
    });

    // Serve Dine-In guest -> +18% (10.000 -> 11.800) & moves to EATING at tableSlot 0
    const serveRes = useGameStore.getState().serveCustomer('cust-dine', 'pb-p1');
    expect(serveRes.ok).toBe(true);
    let state = useGameStore.getState();
    const expectedDineRev = Math.round((10_000 * DINE_IN_REVENUE_MULTIPLIER) / 100) * 100;
    expect(state.salesOrders[0].totalAmount).toBe(expectedDineRev);
    expect(state.salesOrders[0].diningMode).toBe('DINE_IN');
    const seated = state.customers.find((c) => c.id === 'cust-dine');
    expect(seated?.lifecycle).toBe('EATING');
    expect(seated?.eatingRemainingSec).toBe(DINE_IN_EATING_DURATION_SEC);

    // Tick into Lunch Rush Hour window (72..50s) -> activates rushHourActive & clears EATING guest after 10s
    useGameStore.getState().tickStoreSimulation(1);
    expect(useGameStore.getState().rushHourActive).toBe(true);
    useGameStore.getState().tickStoreSimulation(DINE_IN_EATING_DURATION_SEC);
    expect(useGameStore.getState().customers.some((c) => c.id === 'cust-dine')).toBe(false);

    // Dispatch Online Delivery courier -> deducts 18% GoFood commission from 24.000 gross = 19.680 net
    const cashBeforeOjol = useGameStore.getState().cashBalance;
    const ojolRes = useGameStore.getState().fulfillOnlineOrder('ojol-1', 'pb-p1');
    expect(ojolRes.ok).toBe(true);
    state = useGameStore.getState();
    expect(state.onlineOrders.some((o) => o.id === 'ojol-1')).toBe(false);
    const ojolSale = state.salesOrders.find((o) => o.orderType === 'ONLINE_DELIVERY')!;
    expect(ojolSale.platformName).toBe('GoFood');
    expect(ojolSale.platformCommission).toBe(Math.round(24_000 * 0.18));
    expect(ojolSale.totalAmount).toBe(24_000 - Math.round(24_000 * 0.18));
    expect(state.cashBalance - cashBeforeOjol).toBeGreaterThanOrEqual(ojolSale.totalAmount);

    // Toggle online delivery channel
    expect(state.onlineDeliveryEnabled).toBe(true);
    useGameStore.getState().toggleOnlineDelivery();
    expect(useGameStore.getState().onlineDeliveryEnabled).toBe(false);
  });

  it('enforces B2B Contract acceptance, reputation gating, overdue penalty, and zeroWasteStreakDays + Flagship upgrades', () => {
    useGameStore.setState({
      cashBalance: 600_000,
      activeDailyEvent: null,
      business: { ...useGameStore.getState().business, reputation: 50 },
      preOrders: [
        {
          id: 'b2b-high-rep',
          customerName: 'PT Harmoni Wellness Office',
          archetypeId: 'worker',
          tier: 'corporate',
          minReputation: 70,
          accepted: false,
          penaltyReputation: 4,
          contractStartDay: 1,
          recipeId: 'chicken_carrot',
          boxType: 'standard_box',
          quantityBoxes: 2,
          offeredPricePerBox: 28_000,
          dueDay: 1,
          fulfilled: false,
        },
        {
          id: 'b2b-accepted-overdue',
          customerName: 'Komunitas Yoga',
          archetypeId: 'healthy',
          tier: 'community',
          minReputation: 0,
          accepted: true,
          penaltyReputation: 3,
          contractStartDay: 1,
          recipeId: 'chicken_carrot',
          boxType: 'standard_box',
          quantityBoxes: 1,
          offeredPricePerBox: 22_000,
          dueDay: 1,
          fulfilled: false,
        },
        {
          id: 'b2b-multiday',
          customerName: 'BEM Kampus',
          archetypeId: 'student',
          tier: 'campus',
          minReputation: 50,
          accepted: false,
          penaltyReputation: 2,
          contractStartDay: 1,
          recipeId: 'chicken_carrot',
          boxType: 'standard_box',
          quantityBoxes: 1,
          offeredPricePerBox: 24_000,
          dueDay: 2,
          fulfilled: false,
        },
      ],
    });

    // Low rep (50 < 70) blocked from high-tier contract
    expect(useGameStore.getState().acceptB2BContract('b2b-high-rep').ok).toBe(false);
    // Eligible contract accepted
    expect(useGameStore.getState().acceptB2BContract('b2b-multiday').ok).toBe(true);
    expect(
      useGameStore.getState().preOrders.find((p) => p.id === 'b2b-multiday')?.accepted,
    ).toBe(true);

    // Upgrade all 6 facilities (including dining_seating) to Lv 2 -> unlocks flagship_bistro
    for (const upgId of [
      'steamer',
      'refrigerator',
      'prep_table',
      'packaging_station',
      'decoration',
      'dining_seating',
    ] as const) {
      expect(useGameStore.getState().purchaseUpgrade(upgId).ok).toBe(true);
    }
    expect(useGameStore.getState().unlockedAchievements).toContain('flagship_bistro');

    // Close day with 0 waste & advance to Day 2 -> zeroWasteStreakDays increments, overdue accepted contract applies -3 rep, multi-day carries over
    const repBeforeClose = useGameStore.getState().business.reputation;
    useGameStore.getState().closeStoreAndGenerateReport();
    useGameStore.getState().advanceToNextDay();
    const day2 = useGameStore.getState();
    expect(day2.currentDay).toBe(2);
    expect(day2.zeroWasteStreakDays).toBe(1);
    expect(day2.business.reputation).toBe(
      repBeforeClose + (day2.activeDailyEvent?.reputationOnStart ?? 0) - 3,
    );
    expect(day2.preOrders.some((p) => p.id === 'b2b-multiday')).toBe(true);
    expect(day2.preOrders.some((p) => p.id === 'b2b-accepted-overdue')).toBe(false);
  });

  it('runs Weekly Festival (+15% revenue), Rival price surge, Franchise opening/upgrading + royalties, and Endless Mastery Rank ★1', async () => {
    // 1. Rival price surge applies +15% on shrimp (Day 1 rival focus: shrimp & broccoli)
    useGameStore.setState({
      cashBalance: 100_000,
      activeMarketEvent: null,
    });
    const cashBeforeShrimp = useGameStore.getState().cashBalance;
    expect(
      useGameStore
        .getState()
        .purchaseMarketCart({ shrimp: 1 }, { paper_box: 0, standard_box: 0, family_box: 0 }).ok,
    ).toBe(true);
    const shrimpSpent = cashBeforeShrimp - useGameStore.getState().cashBalance;
    // Shrimp base Rp17.500 * 1.15 = Rp20.125 -> rounded to Rp20.150
    expect(shrimpSpent).toBe(20_150);

    // 2. Advancing from Day 6 -> Day 7 activates Weekly Culinary Festival (shrimp_fest)
    useGameStore.setState({
      currentDay: 6,
      cashBalance: 900_000,
      activeDailyEvent: null,
      upgrades: {
        ...useGameStore.getState().upgrades,
        steamer: 3,
        refrigerator: 2,
        prep_table: 2,
      },
      business: {
        ...useGameStore.getState().business,
        level: 4,
        reputation: 84,
      },
      researchedRecipeIds: ['chicken_carrot', 'shrimp_veg', 'tofu_mushroom'],
    });
    useGameStore.getState().advanceToNextDay();
    let state = useGameStore.getState();
    expect(state.currentDay).toBe(7);
    expect(state.activeFestival?.id).toBe(getWeeklyFestivalForDay(7)?.id);
    // 3 R&D formulas + 84 Rep eroded Rival share from 35% down to 32%
    expect(state.rivalShop.marketSharePct).toBe(32);

    // 3. Selling festival-matching recipe (shrimp_veg) earns +15% bonus revenue
    useGameStore.setState({
      activeDailyEvent: null,
      productBatches: [
        {
          id: 'pb-fest-shrimp',
          productionBatchId: 'prod-fest-1',
          recipeId: 'shrimp_veg',
          packagingTypeId: 'paper_box',
          boxesProduced: 2,
          boxesAvailable: 2,
          pcsPerBox: 4,
          unitCostPerBox: 8_000,
          sellingPricePerBox: 20_000,
          qualityScore: 90,
          status: 'PACKAGED',
          producedDay: 7,
          expiryDay: 9,
        },
      ],
      customers: [
        {
          id: 'cust-fest',
          archetypeId: 'explorer',
          name: 'Festival Guest',
          requestedRecipeId: 'shrimp_veg',
          requestedBoxType: 'paper_box',
          quantityBoxes: 1,
          maxBudget: 30_000,
          patienceMax: 30,
          patienceRemaining: 28,
          lifecycle: 'WAITING_ORDER',
          diningMode: 'TAKEAWAY',
          spawnTimeSec: 0,
          dialogueEn: 'Festival shrimp dimsum!',
          dialogueId: 'Dimsum udang festival!',
          seatSlot: 0,
        },
      ],
    });
    expect(useGameStore.getState().serveCustomer('cust-fest', 'pb-fest-shrimp').ok).toBe(true);
    expect(useGameStore.getState().salesOrders[0].totalAmount).toBe(23_000); // 20.000 * 1.15

    // 4. Open BSD Wellness Kiosk branch (Rp220.000), upgrade to Lv 2 (Rp99.000), reach Lv 5 & unlock Endless Mastery ★1
    expect(useGameStore.getState().openFranchiseBranch('bsd_kiosk').ok).toBe(true);
    state = useGameStore.getState();
    expect(state.franchiseBranches).toHaveLength(1);
    expect(state.business.level).toBe(5);
    expect(useGameStore.getState().upgradeFranchiseBranch('bsd_kiosk').ok).toBe(true);
    const branchLv2Income = useGameStore.getState().franchiseBranches[0].dailyNetIncome;
    expect(branchLv2Income).toBe(Math.round((24_000 * 1.4) / 500) * 500);

    expect(useGameStore.getState().activateEndlessMastery().ok).toBe(true);
    state = useGameStore.getState();
    expect(state.endlessMasteryUnlocked).toBe(true);
    expect(state.prestigeLevel).toBe(1);

    // 5. Closing store deposits boosted passive royalties (+15% for Rank ★1) minus daily OPEX into cash & DailyReport
    const cashBeforeClose = state.cashBalance;
    useGameStore.getState().closeStoreAndGenerateReport();
    state = useGameStore.getState();
    const expectedRoyalty = Math.round(branchLv2Income * 1.15);
    const latestReport = state.dailyReports[state.dailyReports.length - 1];
    expect(latestReport.franchiseIncome).toBe(expectedRoyalty);
    expect(state.cashBalance).toBe(cashBeforeClose + expectedRoyalty - ECONOMY_RULES.dailyBaseOpex);

    // 6. Save/load roundtrip preserves branches, prestigeLevel, rivalShop, and activeFestival
    await state.persistNow();
    useGameStore.setState({
      franchiseBranches: [],
      endlessMasteryUnlocked: false,
      prestigeLevel: 0,
      activeFestival: null,
    });
    await useGameStore.getState().continueSavedGame();
    const reloaded = useGameStore.getState();
    expect(reloaded.franchiseBranches).toHaveLength(1);
    expect(reloaded.endlessMasteryUnlocked).toBe(true);
    expect(reloaded.prestigeLevel).toBe(1);
    expect(reloaded.activeFestival?.id).toBe('shrimp_fest');
    expect(ENDLESS_MASTERY_ACTIVATION_COST).toBe(150_000);
  });

  it('generates 3 Daily Missions on Day 1, progresses them via gameplay & trackDailyMissionProgress, auto-grants idempotent bonus currency, and rolls 3 new missions on Day 2', async () => {
    // 1. Starter game gets 3 randomized Day 1 Daily Missions
    const day1Missions = useGameStore.getState().dailyMissions;
    expect(day1Missions).toHaveLength(3);
    expect(new Set(day1Missions.map((m) => m.type)).size).toBe(3);

    // 2. Pin concrete missions (including 'Sell 50 Shrimp Vegetable Dimsum') and sell matching stock
    useGameStore.setState({
      cashBalance: 100_000,
      activeDailyEvent: null,
      dailyMissions: [
        {
          id: 'dm-d1-sell-shrimp',
          day: 1,
          type: 'SELL_RECIPE_PCS',
          recipeId: 'shrimp_veg',
          titleEn: 'Sell 50 Shrimp Vegetable Dimsum',
          titleId: 'Jual 50 Dimsum Udang Sayur',
          descriptionEn: 'Sell 50 pcs.',
          descriptionId: 'Jual 50 pcs.',
          target: 50,
          current: 40,
          completed: false,
          claimed: false,
          rewardCash: 34_500,
          unitLabelEn: 'pcs',
          unitLabelId: 'pcs',
        },
        {
          id: 'dm-d1-serve-cust',
          day: 1,
          type: 'SERVE_CUSTOMERS',
          titleEn: 'Serve 3 Orders Today',
          titleId: 'Layani 3 Pesanan Hari Ini',
          descriptionEn: 'Serve 3 orders.',
          descriptionId: 'Layani 3 pesanan.',
          target: 3,
          current: 2,
          completed: false,
          claimed: false,
          rewardCash: 17_500,
          unitLabelEn: 'orders',
          unitLabelId: 'pesanan',
        },
        {
          id: 'dm-d1-pkg',
          day: 1,
          type: 'PACKAGE_BOXES',
          titleEn: 'Pack 4 Fresh Boxes',
          titleId: 'Kemas 4 Kotak Siap Jual',
          descriptionEn: 'Pack 4 boxes.',
          descriptionId: 'Kemas 4 kotak.',
          target: 4,
          current: 0,
          completed: false,
          claimed: false,
          rewardCash: 16_000,
          unitLabelEn: 'boxes',
          unitLabelId: 'kotak',
        },
      ],
      productBatches: [
        {
          id: 'pb-shrimp-50',
          productionBatchId: 'prod-sh-50',
          recipeId: 'shrimp_veg',
          packagingTypeId: 'family_box',
          boxesProduced: 2,
          boxesAvailable: 2,
          pcsPerBox: 10,
          unitCostPerBox: 15_000,
          sellingPricePerBox: 25_000,
          qualityScore: 90,
          status: 'PACKAGED',
          producedDay: 1,
          expiryDay: 3,
        },
      ],
      customers: [
        {
          id: 'cust-shrimp',
          archetypeId: 'family',
          name: 'Ibu Sari',
          requestedRecipeId: 'shrimp_veg',
          requestedBoxType: 'family_box',
          quantityBoxes: 1,
          maxBudget: 35_000,
          patienceMax: 30,
          patienceRemaining: 28,
          lifecycle: 'WAITING_ORDER',
          diningMode: 'TAKEAWAY',
          spawnTimeSec: 0,
          dialogueEn: '10 pcs shrimp dumplings please!',
          dialogueId: '10 pcs dimsum udang ya!',
          seatSlot: 0,
        },
      ],
    });

    // Serving 1 box (10 pcs) finishes both Shrimp (40 -> 50) & Serve Customers (2 -> 3)
    // and automatically grants Rp34.500 + Rp17.500 bonus currency to the player's wallet!
    expect(useGameStore.getState().serveCustomer('cust-shrimp', 'pb-shrimp-50').ok).toBe(true);
    let state = useGameStore.getState();
    const shrimpMission = state.dailyMissions.find((m) => m.id === 'dm-d1-sell-shrimp')!;
    const serveMission = state.dailyMissions.find((m) => m.id === 'dm-d1-serve-cust')!;
    const pkgMission = state.dailyMissions.find((m) => m.id === 'dm-d1-pkg')!;
    expect(shrimpMission.current).toBe(50);
    expect(shrimpMission.completed).toBe(true);
    expect(shrimpMission.claimed).toBe(true);
    expect(serveMission.completed).toBe(true);
    expect(serveMission.claimed).toBe(true);
    expect(pkgMission.completed).toBe(false);
    expect(pkgMission.claimed).toBe(false);

    // 100_000 start + 25_000 sale + 34_500 shrimp mission bonus + 17_500 serve mission bonus = 177_000
    expect(state.cashBalance).toBe(177_000);

    // Manual claim fallback cannot double-pay an already auto-granted mission
    expect(useGameStore.getState().claimDailyMission('dm-d1-sell-shrimp').ok).toBe(false);
    expect(useGameStore.getState().claimAllDailyMissions().ok).toBe(false);
    expect(useGameStore.getState().cashBalance).toBe(177_000);

    // Direct trackDailyMissionProgress action progresses & auto-grants remaining packaging mission
    const trackPartial = useGameStore.getState().trackDailyMissionProgress({
      type: 'PACKAGE',
      boxesPackaged: 2,
    });
    expect(trackPartial.bonusGranted).toBe(0);
    expect(trackPartial.newlyRewarded).toHaveLength(0);
    expect(
      useGameStore.getState().dailyMissions.find((m) => m.id === 'dm-d1-pkg')?.current,
    ).toBe(2);

    const trackComplete = useGameStore.getState().trackDailyMissionProgress({
      type: 'PACKAGE',
      boxesPackaged: 2,
    });
    expect(trackComplete.bonusGranted).toBe(16_000);
    expect(trackComplete.newlyRewarded.map((m) => m.id)).toEqual(['dm-d1-pkg']);
    state = useGameStore.getState();
    expect(state.cashBalance).toBe(193_000);
    expect(state.dailyMissions.find((m) => m.id === 'dm-d1-pkg')?.claimed).toBe(true);

    // Repeating event after completion is idempotent (no duplicate bonus)
    const trackRepeat = useGameStore.getState().trackDailyMissionProgress({
      type: 'PACKAGE',
      boxesPackaged: 4,
    });
    expect(trackRepeat.bonusGranted).toBe(0);
    expect(useGameStore.getState().cashBalance).toBe(193_000);

    const missionBonusTxs = state.transactions.filter(
      (tx) => tx.category === 'GOAL_BONUS' && tx.referenceId.startsWith('daily-mission-day-1-'),
    );
    expect(missionBonusTxs).toHaveLength(3);

    // Advancing to Day 2 generates 3 fresh Day 2 missions
    useGameStore.getState().closeStoreAndGenerateReport();
    useGameStore.getState().advanceToNextDay();
    const day2State = useGameStore.getState();
    expect(day2State.currentDay).toBe(2);
    expect(day2State.dailyMissions).toHaveLength(3);
    expect(day2State.dailyMissions.every((m) => m.day === 2 && m.current === 0 && !m.claimed)).toBe(true);
  });
});
