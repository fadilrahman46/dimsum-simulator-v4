import { getPackagingDef } from '../config/gameBalance';
import type {
  PackagingTypeId,
  ProductBatch,
  RecipeDef,
  UpgradeLevels,
  WeeklyFestivalDef,
} from '../types/game';

export interface ShowcaseBoxSlot {
  index: number;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  packagingTypeId: PackagingTypeId;
  boxColorHex: string;
  accentColorHex: string;
  isClearance: boolean;
}

export interface CashierShowcaseLayout {
  totalBoxesReady: number;
  visibleBoxesCount: number;
  stockTier: 'empty' | 'low' | 'medium' | 'full';
  slots: ShowcaseBoxSlot[];
}

export interface ShopDecorationVisualState {
  decorationLevel: 1 | 2 | 3;
  lanternCount: number;
  lanternEmissiveIntensity: number;
  lanternPositions: Array<{ x: number; y: number; z: number; isFestival: boolean }>;
  plantPositions: Array<{ x: number; z: number; hasBlossoms: boolean; scale: number }>;
  hasMenuBoardLight: boolean;
  hasDiningRug: boolean;
  hasFestivalBanner: boolean;
  festivalAccentHex: string | null;
}

const BOX_DIMENSIONS: Record<PackagingTypeId, { w: number; h: number; d: number }> = {
  paper_box: { w: 0.14, h: 0.065, d: 0.12 },
  standard_box: { w: 0.17, h: 0.075, d: 0.14 },
  family_box: { w: 0.21, h: 0.088, d: 0.16 },
};

const MAX_SHOWCASE_SLOTS = 12; // 2 cols x 2 rows x 3 layers inside glass warmer

/**
 * Computes the 3D stacked box positions inside the Cashier glass display warmer
 * from active, non-expired packaged product batches.
 */
export function computeCashierShowcaseLayout(
  productBatches: ProductBatch[],
  recipes: RecipeDef[],
  currentDay: number,
): CashierShowcaseLayout {
  const readyBatches = productBatches.filter(
    (b) => b.status === 'PACKAGED' && b.boxesAvailable > 0 && b.expiryDay >= currentDay,
  );

  const totalBoxesReady = readyBatches.reduce((sum, b) => sum + b.boxesAvailable, 0);

  if (totalBoxesReady <= 0) {
    return {
      totalBoxesReady: 0,
      visibleBoxesCount: 0,
      stockTier: 'empty',
      slots: [],
    };
  }

  const recipeColorMap = new Map<string, string>();
  for (const r of recipes) {
    recipeColorMap.set(r.id, r.accentColor);
  }

  // Round-robin sample across available batches so multi-flavor shops look colorful
  const remainingByBatch = readyBatches.map((b) => ({
    batch: b,
    rem: b.boxesAvailable,
  }));
  const pickedBatches: ProductBatch[] = [];
  let guard = 0;
  while (pickedBatches.length < MAX_SHOWCASE_SLOTS && guard < 64) {
    guard += 1;
    let addedAny = false;
    for (const entry of remainingByBatch) {
      if (entry.rem > 0 && pickedBatches.length < MAX_SHOWCASE_SLOTS) {
        pickedBatches.push(entry.batch);
        entry.rem -= 1;
        addedAny = true;
      }
    }
    if (!addedAny) break;
  }

  const colXs = [-0.15, 0.15];
  const rowZs = [-0.09, 0.09];
  const stackHeights = [0, 0, 0, 0]; // height accumulator per (col, row)

  const slots: ShowcaseBoxSlot[] = pickedBatches.map((batch, index) => {
    const cellIdx = index % 4;
    const col = cellIdx % 2;
    const row = Math.floor(cellIdx / 2);
    const layer = Math.floor(index / 4);

    const dims = BOX_DIMENSIONS[batch.packagingTypeId] ?? BOX_DIMENSIONS.standard_box;
    const pkgDef = getPackagingDef(batch.packagingTypeId);
    const baseY = stackHeights[cellIdx];
    stackHeights[cellIdx] += dims.h + 0.006;

    // Tiny playful rotation offset per layer (deterministic)
    const xJitter = layer === 0 ? 0 : layer % 2 === 1 ? 0.01 : -0.01;

    return {
      index,
      x: colXs[col] + xJitter,
      y: baseY,
      z: rowZs[row],
      width: dims.w,
      height: dims.h,
      depth: dims.d,
      packagingTypeId: batch.packagingTypeId,
      boxColorHex: pkgDef.colorHex,
      accentColorHex: recipeColorMap.get(batch.recipeId) ?? '#6E9B72',
      isClearance: (batch.clearanceDiscountPct ?? 0) > 0,
    };
  });

  const stockTier: CashierShowcaseLayout['stockTier'] =
    totalBoxesReady >= 8 ? 'full' : totalBoxesReady >= 4 ? 'medium' : 'low';

  return {
    totalBoxesReady,
    visibleBoxesCount: slots.length,
    stockTier,
    slots,
  };
}

/**
 * Derives 3D shop decoration props (lanterns, herbal planters, menu chalkboard,
 * dining rug, and festival bunting) from `upgrades.decoration` and `activeFestival`.
 */
export function computeShopDecorationVisualState(
  upgrades: UpgradeLevels,
  activeFestival: WeeklyFestivalDef | null = null,
): ShopDecorationVisualState {
  const decoLevel = upgrades.decoration;
  const baseLanterns = decoLevel === 3 ? 4 : decoLevel === 2 ? 2 : 1;

  const baseCoords =
    decoLevel === 1
      ? [-1.2]
      : decoLevel === 2
        ? [-2.6, 2.2]
        : [-3.8, -1.3, 1.3, 3.8];

  const lanternPositions: ShopDecorationVisualState['lanternPositions'] = baseCoords.map(
    (lx) => ({
      x: lx,
      y: 2.34,
      z: -5.02,
      isFestival: false,
    }),
  );

  if (activeFestival) {
    lanternPositions.push(
      { x: -0.25, y: 2.48, z: 5.15, isFestival: true },
      { x: 2.65, y: 2.48, z: 5.15, isFestival: true },
    );
  }

  const plantPositions: ShopDecorationVisualState['plantPositions'] = [
    { x: -5.6, z: 4.6, hasBlossoms: decoLevel >= 3, scale: decoLevel >= 2 ? 1.08 : 1.0 },
  ];

  if (decoLevel >= 2) {
    plantPositions.push(
      { x: 5.5, z: -4.6, hasBlossoms: decoLevel >= 3, scale: 1.05 },
      { x: 5.5, z: 4.4, hasBlossoms: decoLevel >= 3, scale: 1.05 },
    );
  }
  if (decoLevel >= 3) {
    plantPositions.push(
      { x: -5.6, z: -4.6, hasBlossoms: true, scale: 0.95 },
      { x: 2.45, z: 1.25, hasBlossoms: true, scale: 0.62 }, // Counter-side herbal planter
    );
  }

  const festivalAccentHex = activeFestival
    ? activeFestival.id === 'shrimp_fest'
      ? '#E56B45'
      : activeFestival.id === 'plant_based_week'
        ? '#4E9A68'
        : '#ED9B53'
    : null;

  return {
    decorationLevel: decoLevel,
    lanternCount: baseLanterns + (activeFestival ? 2 : 0),
    lanternEmissiveIntensity:
      (decoLevel === 3 ? 0.92 : decoLevel === 2 ? 0.68 : 0.38) +
      (activeFestival ? 0.15 : 0),
    lanternPositions,
    plantPositions,
    hasMenuBoardLight: decoLevel >= 2,
    hasDiningRug: decoLevel >= 3,
    hasFestivalBanner: Boolean(activeFestival),
    festivalAccentHex,
  };
}
