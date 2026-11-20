import { ECONOMY_RULES } from '../config/gameBalance';
import type {
  DailyReport,
  FinancialTransaction,
  IngredientLot,
  ProductBatch,
  ProductionBatch,
  RecipeDef,
  SalesOrder,
} from '../types/game';
import { checkRecipeAvailability } from './recipeEngine';

export interface ProductionCost {
  ingredientCost: number;
  packagingCost: number;
  operationalCost: number;
  laborCost: number;
}

export interface HPPResult {
  totalCost: number;
  quantity: number;
  unitCost: number; // integer Rupiah rounded deterministically
}

export function calculateHPP(cost: ProductionCost, quantity: number): HPPResult {
  if (quantity <= 0) {
    throw new Error('Production quantity must be positive');
  }

  const totalCost = Math.round(
    cost.ingredientCost +
      cost.packagingCost +
      cost.operationalCost +
      cost.laborCost,
  );

  return {
    totalCost,
    quantity,
    unitCost: Math.round(totalCost / quantity),
  };
}

export function calculateRecommendedSellingPrice(
  unitHpp: number,
  markup: number = ECONOMY_RULES.defaultMarkup,
): number {
  if (unitHpp < 0) throw new Error('HPP cannot be negative');
  const clampedMarkup = Math.max(0, markup);
  // Round to nearest Rp100 for clean Rupiah pricing
  const raw = unitHpp * (1 + clampedMarkup);
  return Math.max(500, Math.round(raw / 100) * 100);
}

export interface SalesInput {
  quantity: number;
  unitPrice: number;
  discount: number;
}

export interface SalesCalculation {
  subtotal: number;
  discount: number;
  total: number;
}

export function calculateSales(input: SalesInput): SalesCalculation {
  if (input.quantity <= 0 || input.unitPrice < 0) {
    throw new Error('Invalid sales input');
  }

  const subtotal = Math.round(input.quantity * input.unitPrice);

  if (input.discount < 0 || input.discount > subtotal) {
    throw new Error('Invalid discount');
  }

  const discount = Math.round(input.discount);
  return {
    subtotal,
    discount,
    total: subtotal - discount,
  };
}

/**
 * Prevents duplicate transaction recording for the same referenceId and category.
 */
export function appendTransactionIdempotent(
  transactions: FinancialTransaction[],
  nextTx: FinancialTransaction,
): FinancialTransaction[] {
  const duplicate = transactions.some(
    (tx) =>
      tx.referenceId === nextTx.referenceId && tx.category === nextTx.category,
  );
  if (duplicate) {
    return transactions;
  }
  return [...transactions, nextTx];
}

export interface DailyReportInput {
  day: number;
  startingCash: number;
  endingCash: number;
  transactions: FinancialTransaction[];
  salesOrders: SalesOrder[];
  productBatches: ProductBatch[];
  pcsProduced: number;
  boxesPackaged: number;
  pcsExpired: number;
  inventoryLossValue: number;
  customersServed: number;
  customersLost: number;
  satisfactionSum: number;
  reputationEnd: number;
}

export function buildDailyReport(input: DailyReportInput): DailyReport {
  const dayOrders = input.salesOrders.filter((o) => o.day === input.day);
  const dayTxs = input.transactions.filter((tx) => tx.day === input.day);

  const revenue = dayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const cogs = dayOrders.reduce((sum, o) => sum + o.totalCogs, 0);
  const grossProfit = revenue - cogs;

  const operatingExpenses = dayTxs
    .filter((tx) => tx.category === 'OPERATING_EXPENSE')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const franchiseIncome = dayTxs
    .filter((tx) => tx.category === 'FRANCHISE_INCOME')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalPurchases = dayTxs
    .filter(
      (tx) =>
        tx.category === 'INGREDIENT_PURCHASE' ||
        tx.category === 'PACKAGING_PURCHASE',
    )
    .reduce((sum, tx) => sum + tx.amount, 0);

  const netProfit =
    grossProfit - operatingExpenses - input.inventoryLossValue + franchiseIncome;

  const boxesSold = dayOrders.reduce((sum, o) => sum + o.quantityBoxes, 0);
  const boxesUnsold = input.productBatches
    .filter((b) => b.status === 'PACKAGED' && b.boxesAvailable > 0 && b.expiryDay >= input.day)
    .reduce((sum, b) => sum + b.boxesAvailable, 0);

  const avgCustomerSatisfaction =
    input.customersServed > 0
      ? Math.round(input.satisfactionSum / input.customersServed)
      : 0;

  return {
    day: input.day,
    startingCash: Math.round(input.startingCash),
    endingCash: Math.round(input.endingCash),
    totalPurchases: Math.round(totalPurchases),
    pcsProduced: input.pcsProduced,
    boxesPackaged: input.boxesPackaged,
    boxesSold,
    boxesUnsold,
    pcsExpired: input.pcsExpired,
    inventoryLossValue: Math.round(input.inventoryLossValue),
    revenue: Math.round(revenue),
    cogs: Math.round(cogs),
    grossProfit: Math.round(grossProfit),
    operatingExpenses: Math.round(operatingExpenses),
    franchiseIncome: Math.round(franchiseIncome),
    netProfit: Math.round(netProfit),
    avgCustomerSatisfaction,
    customersServed: input.customersServed,
    customersLost: input.customersLost,
    reputationEnd: Math.round(input.reputationEnd),
  };
}

export const MAX_UNPAID_DEBT_LIMIT = 100_000;

export function checkBankruptcy(
  cashBalance: number,
  productBatches: ProductBatch[],
  productionBatches: ProductionBatch[],
  lots: IngredientLot[],
  recipes: RecipeDef[],
  currentDay: number,
  unpaidDebt = 0,
): boolean {
  if (unpaidDebt >= MAX_UNPAID_DEBT_LIMIT) {
    return true;
  }

  const hasSellableProduct = productBatches.some(
    (b) => b.status === 'PACKAGED' && b.boxesAvailable > 0 && b.expiryDay >= currentDay,
  );
  if (hasSellableProduct) return false;

  const hasQcPassedBatch = productionBatches.some(
    (b) => b.status === 'QC_PASSED' && b.quantity > 0 && b.expiryDay >= currentDay,
  );
  if (hasQcPassedBatch && cashBalance >= 500) return false;

  const canCookAnyRecipe = recipes.some(
    (r) => r.unlocked && checkRecipeAvailability(r, lots, currentDay, 1).canProduce,
  );
  if (canCookAnyRecipe) return false;

  // Cannot produce anything and net liquid capacity is below cheapest ingredient pack (Rp4.000)
  return cashBalance - unpaidDebt < 4_000;
}
