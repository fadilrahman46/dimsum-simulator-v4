import {
  ECONOMY_RULES,
  getEffectiveHelperQualityBonus,
  getEffectiveHelperSpeedMultiplier,
  getPackagingDef,
  getStaffMorale,
  getUpgradeDef,
} from '../config/gameBalance';
import type {
  ActiveCookingSession,
  ActiveDelegatedCooking,
  CookingScores,
  DailyEventDef,
  KitchenHelperRole,
  KitchenHelperState,
  PackagingTypeId,
  ProductBatch,
  ProductionBatch,
  QualityCategory,
  RecipeDef,
  UpgradeLevels,
} from '../types/game';
import { calculateHPP, calculateRecommendedSellingPrice } from './financeEngine';
import { computeHelperSkillEffects } from './staffSkillTree';

/**
 * Exact GDD §4.4 Quality Control Formula:
 * Q = 0.25R + 0.20M + 0.20W + 0.20S + 0.15H
 */
export function calculateQualityScore(scores: CookingScores): number {
  const w = ECONOMY_RULES.qualityWeights;
  const raw =
    w.recipeAccuracy * clampScore(scores.recipeAccuracy) +
    w.mixingQuality * clampScore(scores.mixingQuality) +
    w.wrappingQuality * clampScore(scores.wrappingQuality) +
    w.steamingQuality * clampScore(scores.steamingQuality) +
    w.hygieneCompliance * clampScore(scores.hygieneCompliance);

  return Math.round(Math.max(0, Math.min(100, raw)));
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function getQualityCategory(score: number): QualityCategory {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Very Good';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Average';
  return 'Poor';
}

export function getSteamerMaxBatchPcs(upgrades: UpgradeLevels): number {
  const def = getUpgradeDef('steamer');
  const lvl = def.levels.find((l) => l.level === upgrades.steamer);
  return lvl ? lvl.capacityValue : 10;
}

export function getPrepHygieneBonus(upgrades: UpgradeLevels): number {
  if (upgrades.prep_table === 2) return 5;
  if (upgrades.prep_table === 3) return 10;
  return 0;
}

export function getPackagingQualityBonus(upgrades: UpgradeLevels): number {
  if (upgrades.packaging_station === 2) return 3;
  if (upgrades.packaging_station === 3) return 6;
  return 0;
}

export function evaluateQualityControl(
  batch: ProductionBatch,
  threshold: number = ECONOMY_RULES.qcPassThreshold,
): ProductionBatch {
  const score = calculateQualityScore(batch.scores);
  const category = getQualityCategory(score);
  const status = score >= threshold ? 'QC_PASSED' : 'QC_FAILED';
  return {
    ...batch,
    qualityScore: score,
    qualityCategory: category,
    status,
  };
}

export interface PackageBatchInput {
  productionBatch: ProductionBatch;
  packagingTypeId: PackagingTypeId;
  boxCount: number;
  markup: number;
  packagingStock: Record<PackagingTypeId, number>;
  upgrades: UpgradeLevels;
  newProductBatchId: string;
}

export interface PackageBatchResult {
  updatedProductionBatch: ProductionBatch;
  productBatch: ProductBatch;
  updatedPackagingStock: Record<PackagingTypeId, number>;
  totalPackagingCost: number;
}

export function packageProductionBatch(input: PackageBatchInput): PackageBatchResult {
  const {
    productionBatch,
    packagingTypeId,
    boxCount,
    markup,
    packagingStock,
    upgrades,
    newProductBatchId,
  } = input;

  if (productionBatch.status !== 'QC_PASSED') {
    throw new Error('Only QC_PASSED production batches can be packaged');
  }
  if (boxCount <= 0 || !Number.isInteger(boxCount)) {
    throw new Error('Box count must be a positive integer');
  }
  const pkgDef = getPackagingDef(packagingTypeId);
  const pcsNeeded = boxCount * pkgDef.capacity;

  if (pcsNeeded > productionBatch.quantity) {
    throw new Error(
      `Not enough unpackaged pieces: need ${pcsNeeded}, have ${productionBatch.quantity}`,
    );
  }
  if ((packagingStock[packagingTypeId] ?? 0) < boxCount) {
    throw new Error(
      `Insufficient ${packagingTypeId} stock: need ${boxCount}, have ${packagingStock[packagingTypeId] ?? 0}`,
    );
  }

  // Proportional production cost for the packaged pieces
  const ratio = pcsNeeded / productionBatch.quantity;
  const allocatedIngredientCost = Math.round(productionBatch.ingredientCost * ratio);
  const allocatedOperationalCost = Math.round(productionBatch.operationalCost * ratio);
  const allocatedLaborCost = Math.round(productionBatch.laborCost * ratio);
  const totalPackagingCost = boxCount * pkgDef.costPerBox;

  const hpp = calculateHPP(
    {
      ingredientCost: allocatedIngredientCost,
      packagingCost: totalPackagingCost,
      operationalCost: allocatedOperationalCost,
      laborCost: allocatedLaborCost,
    },
    boxCount,
  );

  const sellingPricePerBox = calculateRecommendedSellingPrice(hpp.unitCost, markup);
  const pkgQualityBonus = getPackagingQualityBonus(upgrades);
  const finalQuality = Math.min(100, productionBatch.qualityScore + pkgQualityBonus);

  const remainingPcs = productionBatch.quantity - pcsNeeded;
  const updatedProductionBatch: ProductionBatch = {
    ...productionBatch,
    quantity: remainingPcs,
    ingredientCost: Math.max(0, productionBatch.ingredientCost - allocatedIngredientCost),
    operationalCost: Math.max(0, productionBatch.operationalCost - allocatedOperationalCost),
    laborCost: Math.max(0, productionBatch.laborCost - allocatedLaborCost),
    status: remainingPcs === 0 ? 'PACKAGED' : 'QC_PASSED',
  };

  const productBatch: ProductBatch = {
    id: newProductBatchId,
    productionBatchId: productionBatch.id,
    recipeId: productionBatch.recipeId,
    packagingTypeId,
    boxesProduced: boxCount,
    boxesAvailable: boxCount,
    pcsPerBox: pkgDef.capacity,
    unitCostPerBox: hpp.unitCost,
    sellingPricePerBox,
    qualityScore: finalQuality,
    status: 'PACKAGED',
    producedDay: productionBatch.producedDay,
    expiryDay: productionBatch.expiryDay,
  };

  const updatedPackagingStock = {
    ...packagingStock,
    [packagingTypeId]: packagingStock[packagingTypeId] - boxCount,
  };

  return {
    updatedProductionBatch,
    productBatch,
    updatedPackagingStock,
    totalPackagingCost,
  };
}

export interface PackageRecipePoolInput {
  productionBatches: ProductionBatch[];
  recipeId: string;
  preferredBatchId?: string;
  currentDay: number;
  packagingTypeId: PackagingTypeId;
  boxCount: number;
  markup: number;
  packagingStock: Record<PackagingTypeId, number>;
  upgrades: UpgradeLevels;
  newProductBatchId: string;
}

export interface PackageRecipePoolResult {
  updatedProductionBatches: ProductionBatch[];
  productBatch: ProductBatch;
  updatedPackagingStock: Record<PackagingTypeId, number>;
  totalPackagingCost: number;
  batchesUsedCount: number;
}

/**
 * Consolidates fresh QC_PASSED pieces of the same recipe in FEFO order
 * (preferring preferredBatchId first if supplied, then earliest expiryDay)
 * so leftover pieces (<4 pcs) from a batch are never stranded.
 */
export function packageRecipeBatchesFEFO(
  input: PackageRecipePoolInput,
): PackageRecipePoolResult {
  const {
    productionBatches,
    recipeId,
    preferredBatchId,
    currentDay,
    packagingTypeId,
    boxCount,
    markup,
    packagingStock,
    upgrades,
    newProductBatchId,
  } = input;

  if (boxCount <= 0 || !Number.isInteger(boxCount)) {
    throw new Error('Box count must be a positive integer');
  }
  const pkgDef = getPackagingDef(packagingTypeId);
  const pcsNeeded = boxCount * pkgDef.capacity;

  if ((packagingStock[packagingTypeId] ?? 0) < boxCount) {
    throw new Error(
      `Insufficient ${packagingTypeId} stock: need ${boxCount}, have ${packagingStock[packagingTypeId] ?? 0}`,
    );
  }

  const eligible = productionBatches
    .filter(
      (b) =>
        b.recipeId === recipeId &&
        b.status === 'QC_PASSED' &&
        b.quantity > 0 &&
        b.expiryDay >= currentDay,
    )
    .sort((a, b) => {
      if (preferredBatchId) {
        if (a.id === preferredBatchId && b.id !== preferredBatchId) return -1;
        if (b.id === preferredBatchId && a.id !== preferredBatchId) return 1;
      }
      if (a.expiryDay !== b.expiryDay) return a.expiryDay - b.expiryDay;
      return a.producedDay - b.producedDay;
    });

  const totalAvailable = eligible.reduce((sum, b) => sum + b.quantity, 0);
  if (pcsNeeded > totalAvailable) {
    throw new Error(
      `Not enough unpackaged pieces: need ${pcsNeeded}, have ${totalAvailable}`,
    );
  }

  let remainingToTake = pcsNeeded;
  let totalIngredientCost = 0;
  let totalOperationalCost = 0;
  let totalLaborCost = 0;
  let weightedQualitySum = 0;
  let minExpiryDay = eligible[0].expiryDay;
  let latestProducedDay = eligible[0].producedDay;
  const primaryBatchId = eligible[0].id;
  const updatesById = new Map<string, ProductionBatch>();

  for (const batch of eligible) {
    if (remainingToTake <= 0) break;
    const take = Math.min(batch.quantity, remainingToTake);
    const takeAll = take === batch.quantity;
    const ratio = take / batch.quantity;

    const allocIng = takeAll
      ? batch.ingredientCost
      : Math.round(batch.ingredientCost * ratio);
    const allocOp = takeAll
      ? batch.operationalCost
      : Math.round(batch.operationalCost * ratio);
    const allocLab = takeAll
      ? batch.laborCost
      : Math.round(batch.laborCost * ratio);

    totalIngredientCost += allocIng;
    totalOperationalCost += allocOp;
    totalLaborCost += allocLab;
    weightedQualitySum += batch.qualityScore * take;
    minExpiryDay = Math.min(minExpiryDay, batch.expiryDay);
    latestProducedDay = Math.max(latestProducedDay, batch.producedDay);

    const remainingQty = batch.quantity - take;
    updatesById.set(batch.id, {
      ...batch,
      quantity: remainingQty,
      ingredientCost: Math.max(0, batch.ingredientCost - allocIng),
      operationalCost: Math.max(0, batch.operationalCost - allocOp),
      laborCost: Math.max(0, batch.laborCost - allocLab),
      status: remainingQty === 0 ? 'PACKAGED' : 'QC_PASSED',
    });

    remainingToTake -= take;
  }

  const totalPackagingCost = boxCount * pkgDef.costPerBox;
  const hpp = calculateHPP(
    {
      ingredientCost: totalIngredientCost,
      packagingCost: totalPackagingCost,
      operationalCost: totalOperationalCost,
      laborCost: totalLaborCost,
    },
    boxCount,
  );

  const sellingPricePerBox = calculateRecommendedSellingPrice(hpp.unitCost, markup);
  const pkgQualityBonus = getPackagingQualityBonus(upgrades);
  const avgQuality = Math.round(weightedQualitySum / pcsNeeded);
  const finalQuality = Math.min(100, avgQuality + pkgQualityBonus);

  const productBatch: ProductBatch = {
    id: newProductBatchId,
    productionBatchId: primaryBatchId,
    recipeId,
    packagingTypeId,
    boxesProduced: boxCount,
    boxesAvailable: boxCount,
    pcsPerBox: pkgDef.capacity,
    unitCostPerBox: hpp.unitCost,
    sellingPricePerBox,
    qualityScore: finalQuality,
    status: 'PACKAGED',
    producedDay: latestProducedDay,
    expiryDay: minExpiryDay,
  };

  return {
    updatedProductionBatches: productionBatches.map(
      (b) => updatesById.get(b.id) ?? b,
    ),
    productBatch,
    updatedPackagingStock: {
      ...packagingStock,
      [packagingTypeId]: packagingStock[packagingTypeId] - boxCount,
    },
    totalPackagingCost,
    batchesUsedCount: updatesById.size,
  };
}

export const MIN_ACTIVE_HELPERS_FOR_DELEGATION = 2;

export function checkDelegationEligibility(params: {
  kitchenStaff: KitchenHelperState[];
  activeCooking: ActiveCookingSession | null;
  activeDelegation: ActiveDelegatedCooking | null;
}): {
  eligible: boolean;
  activeHelpers: KitchenHelperState[];
  reason?: 'busy' | 'need_staff';
} {
  const activeHelpers = params.kitchenStaff.filter(
    (h) => (h.shift ?? 'kitchen') === 'kitchen',
  );
  if (params.activeCooking || params.activeDelegation) {
    return { eligible: false, activeHelpers, reason: 'busy' };
  }
  if (activeHelpers.length < MIN_ACTIVE_HELPERS_FOR_DELEGATION) {
    return { eligible: false, activeHelpers, reason: 'need_staff' };
  }
  return { eligible: true, activeHelpers };
}

export function computeDelegatedCookingPlan(params: {
  recipe: RecipeDef;
  batchCount: number;
  kitchenStaff: KitchenHelperState[];
  hygieneBase: number;
  activeDailyEvent?: DailyEventDef | null;
}): {
  scores: CookingScores;
  projectedQualityScore: number;
  projectedCategory: QualityCategory;
  assignedHelpers: KitchenHelperRole[];
  durationMs: number;
} {
  const activeHelpers = params.kitchenStaff.filter(
    (h) => (h.shift ?? 'kitchen') === 'kitchen',
  );
  const byRole = new Map<KitchenHelperRole, KitchenHelperState>(
    activeHelpers.map((h) => [h.id, h]),
  );

  const avgLevel =
    activeHelpers.length > 0
      ? activeHelpers.reduce((s, h) => s + h.level, 0) / activeHelpers.length
      : 1;
  const avgSpeedMult =
    activeHelpers.length > 0
      ? activeHelpers.reduce((s, h) => s + getEffectiveHelperSpeedMultiplier(h), 0) /
        activeHelpers.length
      : 1;

  const computeStageScore = (role: KitchenHelperRole): number => {
    const helper = byRole.get(role);
    const eventDelta =
      role === 'steam' ? (params.activeDailyEvent?.steamScoreDelta ?? 0) : 0;

    if (!helper) {
      // Uncovered stage is handled via cross-training at a lower baseline
      const fallback = 62 + Math.round((avgLevel - 1) * 4) + eventDelta;
      return Math.max(40, Math.min(100, fallback));
    }

    const morale = getStaffMorale(helper);
    const skillFx = computeHelperSkillEffects(helper);
    const unlockedCount = helper.unlockedSkills?.length ?? 0;
    const moraleOffset = Math.round((morale - 65) * 0.12);
    const raw =
      72 +
      (helper.level - 1) * 5 +
      moraleOffset +
      getEffectiveHelperQualityBonus(helper) +
      skillFx.stageQualityBonus +
      unlockedCount * 2 +
      eventDelta;
    return Math.max(45, Math.min(100, Math.round(raw)));
  };

  const scores: CookingScores = {
    recipeAccuracy: computeStageScore('prep'),
    mixingQuality: computeStageScore('mix'),
    wrappingQuality: computeStageScore('wrap'),
    steamingQuality: computeStageScore('steam'),
    hygieneCompliance: Math.max(50, Math.min(100, Math.round(params.hygieneBase))),
  };

  const projectedQualityScore = calculateQualityScore(scores);
  const projectedCategory = getQualityCategory(projectedQualityScore);

  const steamHelper = byRole.get('steam');
  const steamFx = computeHelperSkillEffects(steamHelper);
  const totalSpeedMult = Math.max(
    0.7,
    avgSpeedMult + (steamFx.steamSpeedBonusPct ?? 0) * 0.5,
  );
  const baseMs = Math.max(
    3200,
    Math.round((params.recipe.productionTimeSec * 1000 * Math.max(1, params.batchCount * 0.65)) / 12),
  );
  const durationMs = Math.max(
    2400,
    Math.min(5500, Math.round(baseMs / totalSpeedMult)),
  );

  return {
    scores,
    projectedQualityScore,
    projectedCategory,
    assignedHelpers: activeHelpers.map((h) => h.id),
    durationMs,
  };
}

export function applyClearanceDiscountToBatch(
  batch: ProductBatch,
  discountPct: 0 | 25 | 40,
): ProductBatch {
  const originalPrice =
    batch.originalSellingPricePerBox ?? batch.sellingPricePerBox;

  if (discountPct === 0) {
    return {
      ...batch,
      sellingPricePerBox: originalPrice,
      originalSellingPricePerBox: originalPrice,
      clearanceDiscountPct: 0,
    };
  }

  const discountedPrice = Math.max(
    500,
    Math.round((originalPrice * (1 - discountPct / 100)) / 100) * 100,
  );

  return {
    ...batch,
    originalSellingPricePerBox: originalPrice,
    sellingPricePerBox: discountedPrice,
    clearanceDiscountPct: discountPct,
  };
}
