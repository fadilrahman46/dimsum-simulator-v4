import { getIngredientDef, getUpgradeDef } from '../config/gameBalance';
import type {
  IngredientLot,
  ProductBatch,
  RecipeIngredientReq,
  UpgradeLevels,
} from '../types/game';

export function getRefrigeratorCapacityGrams(upgrades: UpgradeLevels): number {
  const def = getUpgradeDef('refrigerator');
  const lvl = def.levels.find((l) => l.level === upgrades.refrigerator);
  return lvl ? lvl.capacityValue : 50_000;
}

export function getLotWeightGrams(lot: IngredientLot): number {
  const def = getIngredientDef(lot.ingredientId);
  if (!def) return lot.quantityRemaining;
  // Wrappers count as ~10g each in cold storage weight accounting
  return def.unit === 'pcs' ? lot.quantityRemaining * 10 : lot.quantityRemaining;
}

export function getTotalStorageWeightGrams(lots: IngredientLot[], currentDay: number): number {
  return lots
    .filter((l) => l.quantityRemaining > 0 && l.expiryDay >= currentDay)
    .reduce((sum, lot) => sum + getLotWeightGrams(lot), 0);
}

export function getAvailableStockByIngredient(
  lots: IngredientLot[],
  currentDay: number,
): Record<string, number> {
  const stock: Record<string, number> = {};
  for (const lot of lots) {
    if (lot.quantityRemaining > 0 && lot.expiryDay >= currentDay) {
      stock[lot.ingredientId] = (stock[lot.ingredientId] ?? 0) + lot.quantityRemaining;
    }
  }
  return stock;
}

export function getExpiringSoonCount(lots: IngredientLot[], currentDay: number): number {
  return lots.filter(
    (l) => l.quantityRemaining > 0 && l.expiryDay >= currentDay && l.expiryDay <= currentDay + 1,
  ).length;
}

export interface FefoConsumeResult {
  updatedLots: IngredientLot[];
  totalIngredientCost: number; // integer Rupiah using FIFO/lot cost valuation
  averageIngredientQuality: number;
}

/**
 * Consumes ingredients following FEFO (First Expired, First Out)
 * and calculates exact material cost based on the consumed lots (FIFO lot cost).
 */
export function consumeIngredientsFEFO(
  lots: IngredientLot[],
  requirements: RecipeIngredientReq[],
  currentDay: number,
  batchMultiplier = 1,
): FefoConsumeResult {
  if (batchMultiplier <= 0) {
    throw new Error('Batch multiplier must be positive');
  }

  // Deep copy mutable quantities
  const clonedLots: IngredientLot[] = lots.map((l) => ({ ...l }));
  let totalCostAccumulator = 0;
  let weightedQualitySum = 0;
  let totalUnitsWeight = 0;

  for (const req of requirements) {
    let needed = req.quantity * batchMultiplier;
    if (needed <= 0) continue;

    // FEFO: earliest expiryDay first, then earliest purchasedDay (FIFO tie-break)
    const eligible = clonedLots
      .filter(
        (l) =>
          l.ingredientId === req.ingredientId &&
          l.quantityRemaining > 0 &&
          l.expiryDay >= currentDay,
      )
      .sort((a, b) => {
        if (a.expiryDay !== b.expiryDay) return a.expiryDay - b.expiryDay;
        return a.purchasedDay - b.purchasedDay;
      });

    const available = eligible.reduce((s, l) => s + l.quantityRemaining, 0);
    if (available < needed) {
      throw new Error(
        `Insufficient stock for ${req.ingredientId}: need ${needed}, have ${available}`,
      );
    }

    for (const lot of eligible) {
      if (needed <= 0) break;
      const take = Math.min(lot.quantityRemaining, needed);
      const lotUnitCost =
        lot.initialQuantity > 0
          ? lot.totalLotCost / lot.initialQuantity
          : lot.unitCostPerBaseUnit;

      totalCostAccumulator += take * lotUnitCost;
      weightedQualitySum += take * lot.quality;
      totalUnitsWeight += take;

      lot.quantityRemaining -= take;
      needed -= take;
    }
  }

  return {
    updatedLots: clonedLots.filter((l) => l.quantityRemaining > 0),
    totalIngredientCost: Math.round(totalCostAccumulator),
    averageIngredientQuality:
      totalUnitsWeight > 0 ? Math.round(weightedQualitySum / totalUnitsWeight) : 85,
  };
}

export interface ExpiryCleanupResult {
  remainingLots: IngredientLot[];
  expiredLotsCount: number;
  expiredLossValue: number;
}

export function expireOldLots(
  lots: IngredientLot[],
  currentDay: number,
): ExpiryCleanupResult {
  const remainingLots: IngredientLot[] = [];
  let expiredLotsCount = 0;
  let expiredLossValue = 0;

  for (const lot of lots) {
    if (lot.quantityRemaining <= 0) continue;
    if (lot.expiryDay < currentDay) {
      expiredLotsCount += 1;
      const unitCost =
        lot.initialQuantity > 0
          ? lot.totalLotCost / lot.initialQuantity
          : lot.unitCostPerBaseUnit;
      expiredLossValue += Math.round(lot.quantityRemaining * unitCost);
    } else {
      remainingLots.push(lot);
    }
  }

  return { remainingLots, expiredLotsCount, expiredLossValue };
}

export function getIngredientInventoryValuation(
  lots: IngredientLot[],
  currentDay: number,
): number {
  return lots
    .filter((l) => l.quantityRemaining > 0 && l.expiryDay >= currentDay)
    .reduce((sum, lot) => {
      const unitCost =
        lot.initialQuantity > 0
          ? lot.totalLotCost / lot.initialQuantity
          : lot.unitCostPerBaseUnit;
      return sum + Math.round(lot.quantityRemaining * unitCost);
    }, 0);
}

export function getProductInventoryValuation(
  productBatches: ProductBatch[],
  currentDay: number,
): number {
  return productBatches
    .filter(
      (b) =>
        b.status === 'PACKAGED' && b.boxesAvailable > 0 && b.expiryDay >= currentDay,
    )
    .reduce((sum, b) => sum + b.boxesAvailable * b.unitCostPerBox, 0);
}
