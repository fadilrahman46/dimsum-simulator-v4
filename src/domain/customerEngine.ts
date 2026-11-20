import {
  CUSTOMER_ARCHETYPES,
  DINE_IN_REVENUE_MULTIPLIER,
  ECONOMY_RULES,
  ONLINE_DELIVERY_PLATFORMS,
  doesRecipeMatchFestival,
  getDineInCapacity,
  getIngredientDef,
  getPackagingDef,
} from '../config/gameBalance';
import type {
  B2BContractTier,
  BusinessProfile,
  CustomerAgent,
  CustomerArchetypeDef,
  CustomerFeedbackPopup,
  DiningMode,
  OnlineDeliveryOrder,
  PackagingTypeId,
  PreOrderRequest,
  ProductBatch,
  RecipeDef,
  RivalShopState,
  UpgradeLevels,
  WeeklyFestivalDef,
} from '../types/game';

const COURIER_NAMES = [
  'Mas Budi (Ojol)',
  'Pak Agus (Driver)',
  'Teh Rina (Kurir)',
  'Bang Dani (Ojol)',
  'Kang Ilham (Kurir)',
];

const CUSTOMER_NAMES = [
  'Andi',
  'Siti',
  'Budi',
  'Rina',
  'Dewi',
  'Rizky',
  'Maya',
  'Fajar',
  'Nadia',
  'Hendra',
  'Laras',
  'Kevin',
];

/**
 * Exact GDD §4.7 Customer Satisfaction Formula:
 * CS = 0.35Q + 0.25P + 0.20T + 0.20V
 */
export function calculateCustomerSatisfaction(params: {
  productQuality: number; // 0-100
  priceRatioToBudget: number; // unitPrice / maxBudget
  serviceTimeRatio: number; // patienceRemaining / patienceMax
  productAvailable: boolean;
  archetypeId: CustomerArchetypeDef['id'];
}): number {
  const w = ECONOMY_RULES.satisfactionWeights;
  const Q = Math.max(0, Math.min(100, params.productQuality));

  // Price satisfaction: lower ratio vs budget => higher score
  let P = 100 - Math.max(0, params.priceRatioToBudget - 0.45) * 90;
  if (params.archetypeId === 'student' && params.priceRatioToBudget > 0.85) {
    P -= 12;
  }
  P = Math.max(25, Math.min(100, P));

  // Service time satisfaction
  let T = 30 + Math.max(0, Math.min(1, params.serviceTimeRatio)) * 70;
  if (params.archetypeId === 'worker' && params.serviceTimeRatio < 0.4) {
    T -= 15;
  }
  T = Math.max(15, Math.min(100, T));

  const V = params.productAvailable ? 100 : 10;

  return Math.round(w.quality * Q + w.price * P + w.time * T + w.availability * V);
}

export function getTrafficMultiplier(
  upgrades: UpgradeLevels,
  reputation: number,
  activeFestival?: WeeklyFestivalDef | null,
  rivalShop?: RivalShopState,
): number {
  const decoBonus = upgrades.decoration === 3 ? 1.3 : upgrades.decoration === 2 ? 1.15 : 1.0;
  const repBonus = 0.8 + (reputation / 100) * 0.5;
  const festivalMult = activeFestival ? activeFestival.trafficMultiplier : 1.0;
  const rivalDrag = rivalShop
    ? 1 - Math.max(-0.08, Math.min(0.12, (rivalShop.marketSharePct - 35) * 0.004))
    : 1.0;
  return decoBonus * repBonus * festivalMult * rivalDrag;
}

export function getReputationTrafficBonusPct(reputation: number): number {
  const repMultiplier = 0.8 + (Math.max(0, Math.min(100, reputation)) / 100) * 0.5;
  return Math.round((repMultiplier - 1) * 100);
}

export function spawnCustomerAgent(params: {
  id: string;
  business: BusinessProfile;
  availableBatches: ProductBatch[];
  recipes: RecipeDef[];
  upgrades: UpgradeLevels;
  seatSlot: number;
  occupiedTableSlots?: number[];
  activeFestival?: WeeklyFestivalDef | null;
  rivalShop?: RivalShopState;
}): CustomerAgent {
  const {
    id,
    business,
    availableBatches,
    recipes,
    upgrades,
    seatSlot,
    occupiedTableSlots = [],
    activeFestival,
    rivalShop,
  } = params;

  const clearanceBatches = availableBatches.filter(
    (b) => b.boxesAvailable > 0 && (b.clearanceDiscountPct ?? 0) > 0,
  );
  const hasClearance = clearanceBatches.length > 0;

  // Bias archetype slightly by target market and active Clearance Sale deals
  const pool = [...CUSTOMER_ARCHETYPES];
  if (business.targetMarket === 'students') {
    pool.push(CUSTOMER_ARCHETYPES[0], CUSTOMER_ARCHETYPES[0]);
  } else if (business.targetMarket === 'families') {
    pool.push(CUSTOMER_ARCHETYPES[2], CUSTOMER_ARCHETYPES[2]);
  }
  if (activeFestival?.id === 'plant_based_week') {
    pool.push(CUSTOMER_ARCHETYPES[4], CUSTOMER_ARCHETYPES[4]);
  } else if (activeFestival?.id === 'family_bazaar') {
    pool.push(CUSTOMER_ARCHETYPES[2], CUSTOMER_ARCHETYPES[2]);
  }
  if (hasClearance) {
    // Student & Worker bargain hunters notice clearance shelf deals
    pool.push(CUSTOMER_ARCHETYPES[0], CUSTOMER_ARCHETYPES[1]);
  }

  const archetype = pool[Math.floor(Math.random() * pool.length)];
  const name = CUSTOMER_NAMES[Math.floor(Math.random() * CUSTOMER_NAMES.length)];

  // Choose recipe preference (bias toward Festival theme, clearance deals, or stocked recipes)
  const unlockedRecipes = recipes.filter((r) => r.unlocked);
  const availableRecipeIds = new Set(
    availableBatches.filter((b) => b.boxesAvailable > 0).map((b) => b.recipeId),
  );
  const clearanceRecipeIds = Array.from(
    new Set(clearanceBatches.map((b) => b.recipeId)),
  );
  const festivalMatchingRecipes = activeFestival
    ? recipes.filter((r) => doesRecipeMatchFestival(r, activeFestival))
    : [];
  const stockedFestivalIds = festivalMatchingRecipes
    .filter((r) => availableRecipeIds.has(r.id))
    .map((r) => r.id);
  const unlockedFestivalIds = festivalMatchingRecipes
    .filter((r) => r.unlocked)
    .map((r) => r.id);

  let chosenRecipeId = archetype.preferredRecipeIds[0];
  const matchingPreferred = archetype.preferredRecipeIds.filter((rid) =>
    availableRecipeIds.has(rid),
  );

  const isBargainSeeker =
    archetype.id === 'student' || archetype.id === 'worker';
  const festivalBiasRoll = Math.random();
  if (
    activeFestival &&
    (stockedFestivalIds.length > 0 || unlockedFestivalIds.length > 0) &&
    festivalBiasRoll < 0.78
  ) {
    const festPool = stockedFestivalIds.length > 0 ? stockedFestivalIds : unlockedFestivalIds;
    chosenRecipeId = festPool[Math.floor(Math.random() * festPool.length)];
  } else if (
    hasClearance &&
    (isBargainSeeker ? Math.random() < 0.78 : Math.random() < 0.45)
  ) {
    chosenRecipeId =
      clearanceRecipeIds[Math.floor(Math.random() * clearanceRecipeIds.length)];
  } else if (matchingPreferred.length > 0) {
    chosenRecipeId = matchingPreferred[Math.floor(Math.random() * matchingPreferred.length)];
  } else if (availableRecipeIds.size > 0 && Math.random() < 0.7) {
    const arr = Array.from(availableRecipeIds);
    chosenRecipeId = arr[Math.floor(Math.random() * arr.length)];
  } else if (unlockedRecipes.length > 0) {
    chosenRecipeId = unlockedRecipes[Math.floor(Math.random() * unlockedRecipes.length)].id;
  }

  // Pick preferred box size, respecting available / clearance stock if possible
  const matchingBoxes = availableBatches.filter(
    (b) => b.recipeId === chosenRecipeId && b.boxesAvailable > 0,
  );
  let chosenBoxType: PackagingTypeId = archetype.preferredBoxSize[0];
  if (matchingBoxes.length > 0) {
    const clearanceMatch = matchingBoxes.find(
      (b) => (b.clearanceDiscountPct ?? 0) > 0,
    );
    const prefBoxMatch = matchingBoxes.find((b) =>
      archetype.preferredBoxSize.includes(b.packagingTypeId),
    );
    chosenBoxType =
      clearanceMatch && isBargainSeeker
        ? clearanceMatch.packagingTypeId
        : prefBoxMatch
          ? prefBoxMatch.packagingTypeId
          : matchingBoxes[0].packagingTypeId;
  }

  // Determine Dine-In vs Takeaway based on available dining seating capacity
  const diningCapacity = getDineInCapacity(upgrades);
  const freeTableSlots: number[] = [];
  for (let i = 0; i < diningCapacity; i++) {
    if (!occupiedTableSlots.includes(i)) {
      freeTableSlots.push(i);
    }
  }
  const dineInChance =
    archetype.id === 'family' || archetype.id === 'healthy'
      ? 0.55
      : archetype.id === 'worker'
        ? 0.35
        : 0.45;
  const isDineIn = freeTableSlots.length > 0 && Math.random() < dineInChance;
  const diningMode: DiningMode = isDineIn ? 'DINE_IN' : 'TAKEAWAY';
  const tableSlot = isDineIn ? freeTableSlots[0] : undefined;

  const boxDef = getPackagingDef(chosenBoxType);
  const scaleFactor = boxDef.capacity / 4;
  const baseBudget =
    (archetype.budgetMin +
      Math.random() * (archetype.budgetMax - archetype.budgetMin)) *
    Math.max(1, scaleFactor * 0.85);
  const recipeObj = recipes.find((r) => r.id === chosenRecipeId);
  const isFestivalSpecial =
    recipeObj ? doesRecipeMatchFestival(recipeObj, activeFestival) : false;
  const festivalBudgetMult = isFestivalSpecial ? 1.12 : 1;
  const rdCompetitiveMult =
    rivalShop && recipeObj?.researched ? 1.06 : 1;
  const maxBudget = Math.round(
    (isDineIn ? baseBudget * DINE_IN_REVENUE_MULTIPLIER : baseBudget) *
      festivalBudgetMult *
      rdCompetitiveMult,
  );

  const decoPatienceBonus = upgrades.decoration === 3 ? 8 : upgrades.decoration === 2 ? 4 : 0;
  const patienceMax = archetype.maxPatienceSec + decoPatienceBonus;

  const recipeNameEn = recipeObj?.nameEn ?? 'Healthy Dimsum';
  const recipeNameId = recipeObj?.nameId ?? 'Dimsum Sehat';

  return {
    id,
    archetypeId: archetype.id,
    name,
    requestedRecipeId: chosenRecipeId,
    requestedBoxType: chosenBoxType,
    quantityBoxes: 1,
    maxBudget,
    patienceMax,
    patienceRemaining: patienceMax,
    lifecycle: 'ENTERING',
    diningMode,
    tableSlot,
    spawnTimeSec: Date.now(),
    dialogueEn: isFestivalSpecial && activeFestival
      ? `Here for ${activeFestival.titleEn}! ${isDineIn ? 'Dine-in ' : ''}1 ${boxDef.nameEn} of ${recipeNameEn}, please.`
      : isDineIn
        ? `Hi! Dining in today — I'd love 1 ${boxDef.nameEn} of ${recipeNameEn}.`
        : `Hi! I'd love 1 ${boxDef.nameEn} of ${recipeNameEn}.`,
    dialogueId: isFestivalSpecial && activeFestival
      ? `Mampir untuk ${activeFestival.titleId}! Saya pesan ${isDineIn ? 'makan di sini ' : ''}1 ${boxDef.nameId} ${recipeNameId}.`
      : isDineIn
        ? `Halo! Makan di tempat — saya pesan 1 ${boxDef.nameId} ${recipeNameId}.`
        : `Halo! Saya pesan 1 ${boxDef.nameId} ${recipeNameId}.`,
    seatSlot,
  };
}

function estimateRecipeBoxHpp(recipe: RecipeDef, boxType: PackagingTypeId): number {
  const ingCostPerBatch = recipe.ingredients.reduce((sum, req) => {
    const def = getIngredientDef(req.ingredientId);
    if (!def) return sum;
    return sum + (def.basePackPrice / def.packSize) * req.quantity;
  }, 0);
  const unitPieceCost =
    (ingCostPerBatch +
      ECONOMY_RULES.operationalCostPerBatch +
      ECONOMY_RULES.laborCostPerBatch) /
    Math.max(1, recipe.batchSize);
  const boxDef = getPackagingDef(boxType);
  return Math.round(unitPieceCost * boxDef.capacity + boxDef.costPerBox);
}

export function generateOnlineDeliveryOrder(params: {
  id: string;
  availableBatches: ProductBatch[];
  recipes: RecipeDef[];
  reputation: number;
}): OnlineDeliveryOrder {
  const { id, availableBatches, recipes, reputation } = params;
  const platform =
    ONLINE_DELIVERY_PLATFORMS[
      Math.floor(Math.random() * ONLINE_DELIVERY_PLATFORMS.length)
    ];
  const courierName =
    COURIER_NAMES[Math.floor(Math.random() * COURIER_NAMES.length)];

  const unlocked = recipes.filter((r) => r.unlocked);
  const stocked = availableBatches.filter((b) => b.boxesAvailable > 0);

  let chosenRecipe = unlocked[0] ?? recipes[0];
  let chosenBoxType: PackagingTypeId = 'standard_box';
  let grossPricePerBox = 0;

  if (stocked.length > 0 && Math.random() < 0.8) {
    const pick = stocked[Math.floor(Math.random() * stocked.length)];
    chosenRecipe = recipes.find((r) => r.id === pick.recipeId) ?? chosenRecipe;
    chosenBoxType = pick.packagingTypeId;
    const baseSelling = pick.originalSellingPricePerBox ?? pick.sellingPricePerBox;
    // Ojol menu gross price carries ~18% online markup so net after platform fee stays profitable
    grossPricePerBox = Math.round((baseSelling * 1.18) / 500) * 500;
  } else {
    if (unlocked.length > 0) {
      chosenRecipe = unlocked[Math.floor(Math.random() * unlocked.length)];
    }
    chosenBoxType = Math.random() < 0.45 ? 'paper_box' : 'standard_box';
    const estHpp = estimateRecipeBoxHpp(chosenRecipe, chosenBoxType);
    grossPricePerBox = Math.round((estHpp * 1.75) / 500) * 500;
  }

  const quantityBoxes = reputation >= 75 && Math.random() < 0.35 ? 2 : 1;
  const netPayoutPerBox =
    Math.round((grossPricePerBox * (1 - platform.commissionRate)) / 100) * 100;
  const timeMaxSec = 28 + Math.floor(Math.random() * 9);

  return {
    id,
    platform: platform.id,
    courierName,
    recipeId: chosenRecipe.id,
    boxType: chosenBoxType,
    quantityBoxes,
    grossPricePerBox,
    commissionRate: platform.commissionRate,
    netPayoutPerBox,
    timeRemainingSec: timeMaxSec,
    timeMaxSec,
  };
}

export function generateDailyPreOrders(
  day: number,
  recipes: RecipeDef[],
  reputation: number,
): PreOrderRequest[] {
  const unlocked = recipes.filter((r) => r.unlocked);
  if (unlocked.length === 0) return [];

  const templates: Array<{
    tier: B2BContractTier;
    customerName: string;
    archetypeId: CustomerArchetypeDef['id'];
    boxType: PackagingTypeId;
    qty: number;
    markupMultiplier: number;
    minReputation: number;
    dueOffset: number;
    penaltyReputation: number;
  }> = [
    {
      tier: 'community',
      customerName: 'Komunitas Yoga & Senam Pagi',
      archetypeId: 'healthy',
      boxType: 'standard_box',
      qty: 2,
      markupMultiplier: 1.55,
      minReputation: 0,
      dueOffset: 0,
      penaltyReputation: 2,
    },
    {
      tier: 'campus',
      customerName: 'BEM Kampus Sehat Nusantara',
      archetypeId: 'student',
      boxType: 'standard_box',
      qty: 3,
      markupMultiplier: 1.6,
      minReputation: 50,
      dueOffset: 1,
      penaltyReputation: 3,
    },
    {
      tier: 'corporate',
      customerName: 'PT Harmoni Wellness Office',
      archetypeId: 'worker',
      boxType: 'family_box',
      qty: 2,
      markupMultiplier: 1.7,
      minReputation: 65,
      dueOffset: 1,
      penaltyReputation: 4,
    },
    {
      tier: 'partner_cafe',
      customerName: 'Kafe Kopi & Teh Artisan',
      archetypeId: 'explorer',
      boxType: 'family_box',
      qty: 3,
      markupMultiplier: 1.8,
      minReputation: 78,
      dueOffset: 2,
      penaltyReputation: 5,
    },
  ];

  const orders: PreOrderRequest[] = [];
  // Always include 1 starter community contract + 1 or 2 higher-tier B2B contracts
  const desiredCount = reputation >= 70 ? 3 : 2;
  const selectedTemplates = [
    templates[0],
    templates[1 + (day % 2)],
    ...(desiredCount >= 3 ? [templates[3]] : []),
  ];

  selectedTemplates.forEach((tpl, i) => {
    const recipe = unlocked[(day + i) % unlocked.length];
    const estHpp = estimateRecipeBoxHpp(recipe, tpl.boxType);
    const offeredPricePerBox = Math.max(
      12_000,
      Math.round((estHpp * tpl.markupMultiplier) / 500) * 500,
    );
    orders.push({
      id: `po-d${day}-${i + 1}`,
      customerName: tpl.customerName,
      archetypeId: tpl.archetypeId,
      tier: tpl.tier,
      minReputation: tpl.minReputation,
      accepted: tpl.tier === 'community',
      penaltyReputation: tpl.penaltyReputation,
      contractStartDay: day,
      recipeId: recipe.id,
      boxType: tpl.boxType,
      quantityBoxes: tpl.qty,
      offeredPricePerBox,
      dueDay: day + tpl.dueOffset,
      fulfilled: false,
    });
  });

  return orders;
}

export function generateCustomerFeedback(params: {
  id: string;
  customerName: string;
  archetypeId: CustomerArchetypeDef['id'];
  recipeNameEn: string;
  recipeNameId: string;
  satisfaction: number;
  productQuality: number;
  priceRatioToBudget: number;
  serviceTimeRatio: number;
  productMatched: boolean;
  reputationDelta: number;
  newReputation: number;
  leftAngry?: boolean;
}): CustomerFeedbackPopup {
  const {
    id,
    customerName,
    archetypeId,
    recipeNameEn,
    recipeNameId,
    satisfaction,
    productQuality,
    priceRatioToBudget,
    serviceTimeRatio,
    productMatched,
    reputationDelta,
    newReputation,
    leftAngry = false,
  } = params;

  if (leftAngry) {
    return {
      id,
      customerName,
      archetypeId,
      recipeNameEn,
      recipeNameId,
      satisfaction: 10,
      ratingStars: 1,
      sentiment: 'negative',
      commentEn: `Waited too long for ${recipeNameEn} and left without eating.`,
      commentId: `Antre terlalu lama untuk ${recipeNameId} dan pergi tanpa makan.`,
      reputationDelta,
      newReputation,
      createdAt: Date.now(),
    };
  }

  let ratingStars: 1 | 2 | 3 | 4 | 5 = 3;
  let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
  if (satisfaction >= 85) {
    ratingStars = 5;
    sentiment = 'positive';
  } else if (satisfaction >= 70) {
    ratingStars = 4;
    sentiment = 'positive';
  } else if (satisfaction >= 55) {
    ratingStars = 3;
    sentiment = 'neutral';
  } else if (satisfaction >= 40) {
    ratingStars = 2;
    sentiment = 'negative';
  } else {
    ratingStars = 1;
    sentiment = 'negative';
  }

  let commentEn = '';
  let commentId = '';

  if (ratingStars === 5) {
    if (productQuality >= 88) {
      commentEn = `Amazing texture and fresh flavor on the ${recipeNameEn}! Will tell my friends.`;
      commentId = `Tekstur lembut dan rasa segar di ${recipeNameId}! Pasti rekomendasikan ke teman.`;
    } else if (serviceTimeRatio >= 0.7) {
      commentEn = `Super fast service and tasty ${recipeNameEn}! Best healthy dimsum spot.`;
      commentId = `Pelayanan super cepat dan ${recipeNameId} enak sekali! Favorit baru saya.`;
    } else {
      commentEn = `Great value and delicious ${recipeNameEn}. Loved the dining experience!`;
      commentId = `Harga pas dan ${recipeNameId} sangat lezat. Pengalaman makan yang menyenangkan!`;
    }
  } else if (ratingStars === 4) {
    if (!productMatched) {
      commentEn = `Not my first pick, yet the ${recipeNameEn} was fresh and satisfying!`;
      commentId = `Bukan pilihan awal saya, tapi ${recipeNameId} ternyata segar dan enak!`;
    } else {
      commentEn = `Tasty ${recipeNameEn} and friendly counter service. Coming back soon!`;
      commentId = `${recipeNameId} gurih dan pelayanan kasir ramah. Lain kali mampir lagi!`;
    }
  } else if (ratingStars === 3) {
    if (priceRatioToBudget > 0.85) {
      commentEn = `Nice ${recipeNameEn}, though the price felt a bit steep for my budget.`;
      commentId = `${recipeNameId} cukup enak, hanya harganya terasa agak mahal di kantong.`;
    } else if (serviceTimeRatio < 0.45) {
      commentEn = `Good flavor on ${recipeNameEn}, just wish the wait time was shorter.`;
      commentId = `Rasa ${recipeNameId} lumayan, semoga antrean bisa lebih cepat lagi.`;
    } else {
      commentEn = `Decent ${recipeNameEn}, solid everyday snack.`;
      commentId = `${recipeNameId} cukup oke untuk camilan sehat harian.`;
    }
  } else {
    if (!productMatched) {
      commentEn = `Hoped for my ordered dish, and the substitute didn't quite hit the mark.`;
      commentId = `Ingin menu yang saya pesan, tapi penggantinya kurang sesuai selera.`;
    } else if (serviceTimeRatio < 0.3) {
      commentEn = `The wait took far too long and the ${recipeNameEn} lost its warmth.`;
      commentId = `Menunggu terlalu lama sehingga ${recipeNameId} terasa kurang hangat.`;
    } else {
      commentEn = `Price felt high compared to the quality of ${recipeNameEn} today.`;
      commentId = `Harga terasa kurang sepadan dengan kualitas ${recipeNameId} hari ini.`;
    }
  }

  return {
    id,
    customerName,
    archetypeId,
    recipeNameEn,
    recipeNameId,
    satisfaction,
    ratingStars,
    sentiment,
    commentEn,
    commentId,
    reputationDelta,
    newReputation,
    createdAt: Date.now(),
  };
}

