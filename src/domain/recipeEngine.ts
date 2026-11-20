import { getIngredientDef } from '../config/gameBalance';
import type { IngredientLot, MarketEvent, RecipeDef, RecipeIngredientReq } from '../types/game';
import { getAvailableStockByIngredient } from './inventoryEngine';
import { getSupplierPriceMultiplier } from './negotiationEngine';

export interface MissingIngredientItem {
  ingredientId: string;
  required: number;
  available: number;
  shortfall: number;
}

export interface RecipeAvailability {
  canProduce: boolean;
  missing: MissingIngredientItem[];
}

export function checkRecipeAvailability(
  recipe: RecipeDef,
  lots: IngredientLot[],
  currentDay: number,
  batchCount = 1,
): RecipeAvailability {
  const stock = getAvailableStockByIngredient(lots, currentDay);
  const missing: MissingIngredientItem[] = [];

  for (const req of recipe.ingredients) {
    const required = req.quantity * batchCount;
    const available = stock[req.ingredientId] ?? 0;
    if (available < required) {
      missing.push({
        ingredientId: req.ingredientId,
        required,
        available,
        shortfall: required - available,
      });
    }
  }

  return {
    canProduce: missing.length === 0,
    missing,
  };
}

export function getAdjustedPackPrice(
  ingredientId: string,
  marketEvent: MarketEvent | null,
  supplierTrust?: number,
  rivalFocusIngredientIds?: string[],
  rivalPricePressure = 1.15,
): number {
  const def = getIngredientDef(ingredientId);
  if (!def) return 0;
  let price = def.basePackPrice;
  if (marketEvent && marketEvent.affectedIngredientIds.includes(ingredientId)) {
    price = Math.round(price * marketEvent.priceMultiplier);
  }
  if (rivalFocusIngredientIds && rivalFocusIngredientIds.includes(ingredientId)) {
    price = Math.round((price * rivalPricePressure) / 50) * 50;
  }
  if (typeof supplierTrust === 'number') {
    price = Math.round((price * getSupplierPriceMultiplier(supplierTrust)) / 50) * 50;
  }
  return Math.max(100, price);
}

export function estimateRecipeIngredientCost(
  recipe: RecipeDef,
  lots: IngredientLot[],
  currentDay: number,
  marketEvent: MarketEvent | null,
  rivalFocusIngredientIds?: string[],
): number {
  let total = 0;
  for (const req of recipe.ingredients) {
    // Use lowest expiry valid lot price if available, otherwise market fallback
    const validLot = lots
      .filter(
        (l) =>
          l.ingredientId === req.ingredientId &&
          l.quantityRemaining > 0 &&
          l.expiryDay >= currentDay,
      )
      .sort((a, b) => a.expiryDay - b.expiryDay)[0];

    if (validLot && validLot.initialQuantity > 0) {
      const unitCost = validLot.totalLotCost / validLot.initialQuantity;
      total += req.quantity * unitCost;
    } else {
      const def = getIngredientDef(req.ingredientId);
      if (def) {
        const packPrice = getAdjustedPackPrice(
          req.ingredientId,
          marketEvent,
          undefined,
          rivalFocusIngredientIds,
        );
        total += req.quantity * (packPrice / def.packSize);
      }
    }
  }
  return Math.round(total);
}

export function validateCustomRecipeIngredients(
  ingredients: RecipeIngredientReq[],
): { valid: boolean; errorKey?: string } {
  const nonZero = ingredients.filter((i) => i.quantity > 0);
  if (nonZero.length < 3) {
    return { valid: false, errorKey: 'need_more_ingredients' };
  }
  const wrapper = nonZero.find((i) => i.ingredientId === 'wrapper');
  if (!wrapper || wrapper.quantity < 10) {
    return { valid: false, errorKey: 'need_wrapper_10' };
  }
  const hasProteinOrVeg = nonZero.some((i) => {
    const def = getIngredientDef(i.ingredientId);
    return def && (def.category === 'protein' || def.category === 'vegetable');
  });
  if (!hasProteinOrVeg) {
    return { valid: false, errorKey: 'need_filling' };
  }
  return { valid: true };
}
