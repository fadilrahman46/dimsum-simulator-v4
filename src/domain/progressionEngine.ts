import type {
  BusinessProfile,
  DailyReport,
  FranchiseBranch,
  KitchenHelperState,
  ProductionBatch,
  RecipeDef,
  SalesOrder,
  UpgradeLevels,
} from '../types/game';

export function evaluateAchievements(params: {
  unlocked: string[];
  productionBatches: ProductionBatch[];
  salesOrders: SalesOrder[];
  dailyReports: DailyReport[];
  upgrades: UpgradeLevels;
  recipes?: RecipeDef[];
  researchedRecipeIds?: string[];
  kitchenStaff?: KitchenHelperState[];
  business?: BusinessProfile;
  unpaidDebt?: number;
  zeroWasteStreakDays?: number;
  currentDay?: number;
}): string[] {
  const next = new Set(params.unlocked);

  // Production
  if (params.productionBatches.length > 0) {
    next.add('first_batch');
  }
  if (params.productionBatches.some((b) => b.qualityScore >= 90)) {
    next.add('qc_master');
  }
  if (params.productionBatches.some((b) => b.qualityScore >= 96)) {
    next.add('qc_perfectionist');
  }
  const totalProducedPcs = params.productionBatches.reduce((s, b) => s + b.quantity, 0);
  if (totalProducedPcs >= 100) {
    next.add('batch_veteran');
  }
  if ((params.recipes ?? []).filter((r) => r.unlocked).length >= 6) {
    next.add('recipe_collector');
  }
  if ((params.researchedRecipeIds ?? []).length >= 3) {
    next.add('culinary_rd_master');
  }

  // Sales & Channels
  if (params.salesOrders.length > 0) {
    next.add('first_sale');
  }
  if (params.salesOrders.length >= 25) {
    next.add('regular_crowd');
  }
  if (params.salesOrders.length >= 60) {
    next.add('dimsum_legend');
  }
  if (params.salesOrders.filter((o) => o.diningMode === 'DINE_IN').length >= 5) {
    next.add('dine_in_host');
  }
  if (params.salesOrders.filter((o) => o.orderType === 'PRE_ORDER').length >= 3) {
    next.add('b2b_contractor');
  }
  if (params.salesOrders.filter((o) => o.orderType === 'ONLINE_DELIVERY').length >= 5) {
    next.add('omnichannel_pro');
  }

  // Service & Operations
  if ((params.zeroWasteStreakDays ?? 0) >= 3) {
    next.add('zero_waste_hero');
  }
  if ((params.business?.reputation ?? 0) >= 80) {
    next.add('reputation_80');
  }
  if ((params.business?.reputation ?? 0) >= 95) {
    next.add('reputation_95');
  }

  // Finance
  if (params.dailyReports.some((r) => r.netProfit > 0)) {
    next.add('profitable_day');
  }
  if (params.dailyReports.some((r) => r.netProfit >= 150_000)) {
    next.add('profit_mogul');
  }
  const totalRevenue = params.salesOrders.reduce((s, o) => s + o.totalAmount, 0);
  if (totalRevenue >= 500_000) {
    next.add('revenue_half_million');
  }
  if (totalRevenue >= 1_000_000) {
    next.add('revenue_millionaire');
  }
  const effectiveDay = params.currentDay ?? params.dailyReports.length + 1;
  if (effectiveDay >= 5 && (params.unpaidDebt ?? 0) === 0) {
    next.add('debt_free_discipline');
  }
  if (
    params.business?.difficulty === 'hard' &&
    params.dailyReports.some((r) => r.netProfit > 0)
  ) {
    next.add('hard_mode_survivor');
  }

  // Progression & Team
  const upgradeValues = Object.values(params.upgrades);
  if (upgradeValues.some((lvl) => lvl >= 2)) {
    next.add('shop_upgrader');
  }
  if (upgradeValues.some((lvl) => lvl >= 3)) {
    next.add('maxed_station');
  }
  if (upgradeValues.length >= 6 && upgradeValues.every((lvl) => lvl >= 2)) {
    next.add('flagship_bistro');
  }
  const staff = params.kitchenStaff ?? [];
  if (staff.length >= 4) {
    next.add('full_crew');
  }
  const unlockedSkillsCount = staff.reduce(
    (sum, m) => sum + (m.unlockedSkills?.length ?? 0),
    0,
  );
  if (unlockedSkillsCount >= 4) {
    next.add('skill_mentor');
  }

  return Array.from(next);
}

export function computeBusinessLevel(
  totalRevenue: number,
  reputation: number,
  upgrades: UpgradeLevels,
  franchiseBranchCount = 0,
): number {
  const upgradePoints = Object.values(upgrades).reduce((s, v) => s + (v - 1), 0);
  const revPoints = Math.floor(totalRevenue / 150_000);
  const repPoints = reputation >= 80 ? 2 : reputation >= 65 ? 1 : 0;
  const branchPoints = franchiseBranchCount * 2;
  return Math.max(
    1,
    1 + Math.floor((upgradePoints + revPoints + repPoints + branchPoints) / 2),
  );
}

export function computeNetWorth(params: {
  cashBalance: number;
  ingredientValuation: number;
  productValuation: number;
  franchiseBranches?: FranchiseBranch[];
  unpaidDebt?: number;
}): number {
  const branchValuation = (params.franchiseBranches ?? []).reduce(
    (sum, b) => sum + b.investmentCost + (b.level - 1) * Math.round(b.investmentCost * 0.4),
    0,
  );
  return Math.round(
    params.cashBalance +
      params.ingredientValuation +
      params.productValuation +
      branchValuation -
      (params.unpaidDebt ?? 0),
  );
}

export const ENDLESS_MASTERY_MIN_LEVEL = 5;
export const ENDLESS_MASTERY_MIN_REPUTATION = 80;
export const ENDLESS_MASTERY_ACTIVATION_COST = 150_000;

export function canUnlockEndlessMastery(params: {
  businessLevel: number;
  reputation: number;
  franchiseBranchesCount: number;
  cashBalance: number;
}): { allowed: boolean; reason?: 'level' | 'reputation' | 'branch' | 'cash' } {
  if (params.businessLevel < ENDLESS_MASTERY_MIN_LEVEL) {
    return { allowed: false, reason: 'level' };
  }
  if (params.reputation < ENDLESS_MASTERY_MIN_REPUTATION) {
    return { allowed: false, reason: 'reputation' };
  }
  if (params.franchiseBranchesCount < 1) {
    return { allowed: false, reason: 'branch' };
  }
  if (params.cashBalance < ENDLESS_MASTERY_ACTIVATION_COST) {
    return { allowed: false, reason: 'cash' };
  }
  return { allowed: true };
}

export function updateReputationFromSatisfaction(
  currentRep: number,
  satisfaction: number,
): number {
  const delta = satisfaction >= 85 ? 2 : satisfaction >= 70 ? 1 : satisfaction < 50 ? -3 : -1;
  return Math.max(10, Math.min(100, currentRep + delta));
}
