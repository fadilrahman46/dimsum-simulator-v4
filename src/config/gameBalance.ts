import type {
  AchievementDef,
  BonusObjectiveDef,
  CapitalDifficulty,
  CustomerArchetypeDef,
  DailyEventDef,
  DeliveryPlatformId,
  FranchiseBranch,
  FranchiseBranchTemplate,
  IngredientDef,
  IngredientLot,
  KitchenHelperDef,
  KitchenHelperRole,
  KitchenHelperState,
  MarketEvent,
  OutletTierDef,
  PackagingTypeDef,
  PackagingTypeId,
  RecipeDef,
  RecipeResearchDef,
  RivalShopState,
  UpgradeDef,
  UpgradeId,
  UpgradeLevels,
  WeeklyFestivalDef,
} from '../types/game';

export const SAVE_SCHEMA_VERSION = 1;

export interface CapitalDifficultyConfig {
  id: CapitalDifficulty;
  labelEn: string;
  labelId: string;
  subtitleEn: string;
  subtitleId: string;
  total: number;
  starterIngredientsValue: number;
  starterEquipmentValue: number;
  starterPackagingValue: number;
  cashReserve: number;
}

export const CAPITAL_DIFFICULTIES: Record<CapitalDifficulty, CapitalDifficultyConfig> = {
  easy: {
    id: 'easy',
    labelEn: 'Easy',
    labelId: 'Mudah',
    subtitleEn: 'Full startup capital & generous pantry',
    subtitleId: 'Modal penuh & stok bahan awal melimpah',
    total: 500_000,
    starterIngredientsValue: 150_000,
    starterEquipmentValue: 200_000,
    starterPackagingValue: 50_000,
    cashReserve: 100_000,
  },
  medium: {
    id: 'medium',
    labelEn: 'Medium',
    labelId: 'Sedang',
    subtitleEn: 'Standard booth capital & tighter cash buffer',
    subtitleId: 'Modal gerobak standar & cadangan kas lebih ketat',
    total: 300_000,
    starterIngredientsValue: 90_000,
    starterEquipmentValue: 120_000,
    starterPackagingValue: 30_000,
    cashReserve: 60_000,
  },
  hard: {
    id: 'hard',
    labelEn: 'Hard',
    labelId: 'Sulit',
    subtitleEn: 'Lean micro-stall capital & slim margins',
    subtitleId: 'Modal usaha mikro ketat & tantangan arus kas',
    total: 150_000,
    starterIngredientsValue: 40_000,
    starterEquipmentValue: 65_000,
    starterPackagingValue: 15_000,
    cashReserve: 30_000,
  },
};

export function getCapitalDifficultyConfig(
  difficulty: CapitalDifficulty = 'easy',
): CapitalDifficultyConfig {
  return CAPITAL_DIFFICULTIES[difficulty] ?? CAPITAL_DIFFICULTIES.easy;
}

export const INITIAL_CAPITAL = CAPITAL_DIFFICULTIES.easy;

export const ECONOMY_RULES = {
  qcPassThreshold: 60,
  defaultMarkup: 0.5, // 50% markup on HPP
  minMarkup: 0.1,
  maxMarkup: 1.5,
  operationalCostPerBatch: 1_500, // steam energy & water per 10-pc batch
  laborCostPerBatch: 2_500, // prep & craft labor allocation per 10-pc batch
  dailyBaseOpex: 12_000, // daily shop rent/utilities
  dailyRevenueGoalBase: 60_000,
  dailyRevenueGoalPerLevel: 30_000,
  dailyWastageLimitBase: 15_000,
  dailyWastageLimitPerLevel: 5_000,
  storeOpenDurationSec: 90, // 90 seconds per business day shift
  customerSpawnIntervalSec: 8,
  qualityWeights: {
    recipeAccuracy: 0.25,
    mixingQuality: 0.2,
    wrappingQuality: 0.2,
    steamingQuality: 0.2,
    hygieneCompliance: 0.15,
  },
  satisfactionWeights: {
    quality: 0.35,
    price: 0.25,
    time: 0.2,
    availability: 0.2,
  },
} as const;

export const DINE_IN_REVENUE_MULTIPLIER = 1.18;
export const DINE_IN_EATING_DURATION_SEC = 10;

export const RUSH_HOUR_WINDOWS = [
  { id: 'lunch', minRemainingSec: 50, maxRemainingSec: 72, labelEn: 'Lunch Rush Hour', labelId: 'Gelombang Makan Siang' },
  { id: 'dinner', minRemainingSec: 14, maxRemainingSec: 34, labelEn: 'Evening Rush Hour', labelId: 'Gelombang Makan Malam' },
] as const;

export function getRushHourPhase(remainingSec: number): {
  active: boolean;
  id: 'lunch' | 'dinner' | null;
  labelEn: string;
  labelId: string;
} {
  for (const w of RUSH_HOUR_WINDOWS) {
    if (remainingSec >= w.minRemainingSec && remainingSec <= w.maxRemainingSec) {
      return {
        active: true,
        id: w.id,
        labelEn: w.labelEn,
        labelId: w.labelId,
      };
    }
  }
  return {
    active: false,
    id: null,
    labelEn: 'Regular Hours',
    labelId: 'Jam Reguler',
  };
}

export function isRushHourWindow(remainingSec: number): boolean {
  return getRushHourPhase(remainingSec).active;
}

export const ONLINE_DELIVERY_PLATFORMS: Array<{
  id: DeliveryPlatformId;
  commissionRate: number;
  label: string;
}> = [
  { id: 'GoFood', commissionRate: 0.18, label: 'GoFood (18%)' },
  { id: 'GrabFood', commissionRate: 0.20, label: 'GrabFood (20%)' },
  { id: 'ShopeeFood', commissionRate: 0.15, label: 'ShopeeFood (15%)' },
];

export const INGREDIENTS: IngredientDef[] = [
  {
    id: 'chicken',
    nameEn: 'Chicken Breast',
    nameId: 'Daging Ayam',
    category: 'protein',
    unit: 'g',
    packSize: 500,
    packLabelEn: '500g pack',
    packLabelId: 'Kemasan 500g',
    basePackPrice: 22_500, // Rp45.000/kg
    shelfLifeDays: 3,
    supplier: 'Segar Poultry Farm',
    colorHex: '#F3C5B6',
  },
  {
    id: 'shrimp',
    nameEn: 'Fresh Shrimp',
    nameId: 'Udang Segar',
    category: 'protein',
    unit: 'g',
    packSize: 250,
    packLabelEn: '250g pack',
    packLabelId: 'Kemasan 250g',
    basePackPrice: 17_500, // Rp70.000/kg
    shelfLifeDays: 2,
    supplier: 'Nusantara Seafood',
    colorHex: '#F29A86',
  },
  {
    id: 'tofu',
    nameEn: 'Organic Silken Tofu',
    nameId: 'Tahu Putih Organik',
    category: 'protein',
    unit: 'g',
    packSize: 400,
    packLabelEn: '400g block',
    packLabelId: 'Blok 400g',
    basePackPrice: 8_000,
    shelfLifeDays: 3,
    supplier: 'Kedelai Sehat Co.',
    colorHex: '#FAF3E3',
  },
  {
    id: 'carrot',
    nameEn: 'Sweet Carrot',
    nameId: 'Wortel Segar',
    category: 'vegetable',
    unit: 'g',
    packSize: 500,
    packLabelEn: '500g bunch',
    packLabelId: 'Ikat 500g',
    basePackPrice: 7_500, // Rp15.000/kg
    shelfLifeDays: 5,
    supplier: 'Lembang Harvest',
    colorHex: '#ED9B53',
  },
  {
    id: 'spinach',
    nameEn: 'Green Spinach',
    nameId: 'Bayam Hijau',
    category: 'vegetable',
    unit: 'g',
    packSize: 300,
    packLabelEn: '300g bunch',
    packLabelId: 'Ikat 300g',
    basePackPrice: 6_000,
    shelfLifeDays: 2,
    supplier: 'Lembang Harvest',
    colorHex: '#6E9B72',
  },
  {
    id: 'broccoli',
    nameEn: 'Crisp Broccoli',
    nameId: 'Brokoli Segar',
    category: 'vegetable',
    unit: 'g',
    packSize: 300,
    packLabelEn: '300g head',
    packLabelId: 'Kuntum 300g',
    basePackPrice: 9_000,
    shelfLifeDays: 4,
    supplier: 'Lembang Harvest',
    colorHex: '#4E7C54',
  },
  {
    id: 'mushroom',
    nameEn: 'Shiitake Mushroom',
    nameId: 'Jamur Shiitake',
    category: 'vegetable',
    unit: 'g',
    packSize: 250,
    packLabelEn: '250g tray',
    packLabelId: 'Nampan 250g',
    basePackPrice: 6_250, // Rp25.000/kg
    shelfLifeDays: 4,
    supplier: 'Highland Fungi',
    colorHex: '#A67C58',
  },
  {
    id: 'garlic',
    nameEn: 'Aromatic Garlic',
    nameId: 'Bawang Putih',
    category: 'seasoning',
    unit: 'g',
    packSize: 100,
    packLabelEn: '100g bulb',
    packLabelId: 'Bungkus 100g',
    basePackPrice: 4_000,
    shelfLifeDays: 10,
    supplier: 'Spice Market',
    colorHex: '#EFE6D5',
  },
  {
    id: 'seasoning',
    nameEn: 'Low-Sodium Seasoning',
    nameId: 'Bumbu Sehat Rendah Garam',
    category: 'seasoning',
    unit: 'g',
    packSize: 100,
    packLabelEn: '100g pouch',
    packLabelId: 'Pouch 100g',
    basePackPrice: 5_000,
    shelfLifeDays: 14,
    supplier: 'Spice Market',
    colorHex: '#D8B47C',
  },
  {
    id: 'wrapper',
    nameEn: 'Dumpling Wrappers',
    nameId: 'Kulit Dimsum',
    category: 'wrapper',
    unit: 'pcs',
    packSize: 50,
    packLabelEn: '50 pcs pack',
    packLabelId: 'Pack 50 lembar',
    basePackPrice: 20_000, // Rp20.000/pack
    shelfLifeDays: 4,
    supplier: 'Artisan Dough Co.',
    colorHex: '#F7E7BD',
  },
  {
    id: 'tapioca',
    nameEn: 'Tapioca Flour',
    nameId: 'Tepung Tapioka',
    category: 'wrapper',
    unit: 'g',
    packSize: 500,
    packLabelEn: '500g bag',
    packLabelId: 'Kantong 500g',
    basePackPrice: 7_500,
    shelfLifeDays: 14,
    supplier: 'Artisan Dough Co.',
    colorHex: '#FAF7F0',
  },
];

export const INITIAL_RECIPES: RecipeDef[] = [
  {
    id: 'chicken_carrot',
    nameEn: 'Chicken Carrot Dimsum',
    nameId: 'Dimsum Ayam Wortel',
    descriptionEn: 'Tender lean chicken breast folded with sweet grated carrot in thin steamed wrappers.',
    descriptionId: 'Daging ayam rendah lemak dipadukan wortel manis parut dalam balutan kulit lembut.',
    batchSize: 10,
    productionTimeSec: 60,
    difficulty: 'easy',
    baseQuality: 75,
    shelfLifeDays: 2,
    isVegetarian: false,
    unlocked: true,
    accentColor: '#ED9B53',
    ingredients: [
      { ingredientId: 'chicken', quantity: 100 },
      { ingredientId: 'carrot', quantity: 50 },
      { ingredientId: 'wrapper', quantity: 10 },
      { ingredientId: 'garlic', quantity: 6 },
      { ingredientId: 'tapioca', quantity: 20 },
      { ingredientId: 'seasoning', quantity: 4 },
    ],
  },
  {
    id: 'shrimp_veg',
    nameEn: 'Shrimp Vegetable Dimsum',
    nameId: 'Dimsum Udang Sayur',
    descriptionEn: 'Juicy ocean shrimp paired with crisp broccoli florets and aromatic garlic.',
    descriptionId: 'Udang segar berpadu brokoli renyah dan bawang putih harum.',
    batchSize: 10,
    productionTimeSec: 70,
    difficulty: 'medium',
    baseQuality: 80,
    shelfLifeDays: 2,
    isVegetarian: false,
    unlocked: true,
    accentColor: '#F28B72',
    ingredients: [
      { ingredientId: 'shrimp', quantity: 90 },
      { ingredientId: 'broccoli', quantity: 40 },
      { ingredientId: 'carrot', quantity: 25 },
      { ingredientId: 'wrapper', quantity: 10 },
      { ingredientId: 'garlic', quantity: 6 },
      { ingredientId: 'tapioca', quantity: 20 },
      { ingredientId: 'seasoning', quantity: 4 },
    ],
  },
  {
    id: 'tofu_mushroom',
    nameEn: 'Tofu Mushroom Dimsum',
    nameId: 'Dimsum Tahu Jamur',
    descriptionEn: 'Plant-powered silken tofu and earthy shiitake mushrooms with gentle umami herbs.',
    descriptionId: 'Tahu putih organik dan jamur shiitake gurih kaya protein nabati.',
    batchSize: 10,
    productionTimeSec: 55,
    difficulty: 'easy',
    baseQuality: 76,
    shelfLifeDays: 3,
    isVegetarian: true,
    unlocked: true,
    accentColor: '#A67C58',
    ingredients: [
      { ingredientId: 'tofu', quantity: 100 },
      { ingredientId: 'mushroom', quantity: 50 },
      { ingredientId: 'wrapper', quantity: 10 },
      { ingredientId: 'garlic', quantity: 5 },
      { ingredientId: 'tapioca', quantity: 20 },
      { ingredientId: 'seasoning', quantity: 4 },
    ],
  },
  {
    id: 'rainbow_veggie',
    nameEn: 'Rainbow Veggie Dimsum',
    nameId: 'Dimsum Sayur Pelangi',
    descriptionEn: 'Vibrant spinach, sweet carrot, broccoli, and shiitake crafted for clean-eating fans.',
    descriptionId: 'Perpaduan bayam hijau, wortel manis, brokoli, dan jamur untuk pecinta makanan sehat.',
    batchSize: 10,
    productionTimeSec: 65,
    difficulty: 'medium',
    baseQuality: 82,
    shelfLifeDays: 2,
    isVegetarian: true,
    unlocked: false,
    unlockCost: 35_000,
    accentColor: '#6E9B72',
    ingredients: [
      { ingredientId: 'spinach', quantity: 50 },
      { ingredientId: 'carrot', quantity: 45 },
      { ingredientId: 'broccoli', quantity: 35 },
      { ingredientId: 'mushroom', quantity: 30 },
      { ingredientId: 'wrapper', quantity: 10 },
      { ingredientId: 'tapioca', quantity: 20 },
      { ingredientId: 'seasoning', quantity: 4 },
    ],
  },
  {
    id: 'mentai_chicken',
    nameEn: 'Low-Fat Mentai Dimsum',
    nameId: 'Dimsum Mentai Rendah Lemak',
    descriptionEn: 'Savory lean chicken & silken tofu glaze finished with light aromatic garlic.',
    descriptionId: 'Ayam tanpa lemak & saus tahu lembut rendah kalori dengan aroma bawang putih harum.',
    batchSize: 10,
    productionTimeSec: 68,
    difficulty: 'medium',
    baseQuality: 83,
    shelfLifeDays: 2,
    isVegetarian: false,
    unlocked: false,
    unlockCost: 40_000,
    accentColor: '#F48C5C',
    ingredients: [
      { ingredientId: 'chicken', quantity: 95 },
      { ingredientId: 'carrot', quantity: 40 },
      { ingredientId: 'tofu', quantity: 30 },
      { ingredientId: 'wrapper', quantity: 10 },
      { ingredientId: 'garlic', quantity: 6 },
      { ingredientId: 'tapioca', quantity: 20 },
      { ingredientId: 'seasoning', quantity: 5 },
    ],
  },
  {
    id: 'kuotie_panggang',
    nameEn: 'Garden Pan-Seared Kuotie',
    nameId: 'Kuotie Sayur Panggang',
    descriptionEn: 'Crisp crescent dumplings packed with lean poultry, green spinach, and roasted garlic.',
    descriptionId: 'Kuotie panggang renyah dengan isian daging ayam sehat, bayam hijau, dan bawang putih.',
    batchSize: 10,
    productionTimeSec: 64,
    difficulty: 'medium',
    baseQuality: 81,
    shelfLifeDays: 2,
    isVegetarian: false,
    unlocked: false,
    unlockCost: 38_000,
    accentColor: '#D97742',
    ingredients: [
      { ingredientId: 'chicken', quantity: 85 },
      { ingredientId: 'spinach', quantity: 55 },
      { ingredientId: 'garlic', quantity: 8 },
      { ingredientId: 'wrapper', quantity: 10 },
      { ingredientId: 'tapioca', quantity: 20 },
      { ingredientId: 'seasoning', quantity: 4 },
    ],
  },
  {
    id: 'lumpia_tahu',
    nameEn: 'Tofu Skin Herbal Roll',
    nameId: 'Lumpia Kulit Tahu',
    descriptionEn: 'Light steamed roll with organic tofu, sweet carrot ribbons, and earthy shiitake.',
    descriptionId: 'Gulungan kukus ringan isi tahu organik, irisan wortel manis, dan jamur shiitake.',
    batchSize: 10,
    productionTimeSec: 54,
    difficulty: 'easy',
    baseQuality: 79,
    shelfLifeDays: 3,
    isVegetarian: true,
    unlocked: false,
    unlockCost: 30_000,
    accentColor: '#C69763',
    ingredients: [
      { ingredientId: 'tofu', quantity: 90 },
      { ingredientId: 'carrot', quantity: 45 },
      { ingredientId: 'mushroom', quantity: 40 },
      { ingredientId: 'garlic', quantity: 6 },
      { ingredientId: 'wrapper', quantity: 10 },
      { ingredientId: 'tapioca', quantity: 20 },
      { ingredientId: 'seasoning', quantity: 4 },
    ],
  },
  {
    id: 'hakau_bayam',
    nameEn: 'Spinach Shrimp Hakau',
    nameId: 'Hakau Bayam Udang',
    descriptionEn: 'Translucent spinach-tinted crescent dumpling filled with crisp ocean shrimp.',
    descriptionId: 'Hakau kulit bayam transparan berisi udang segar utuh dan wortel renyah.',
    batchSize: 10,
    productionTimeSec: 76,
    difficulty: 'hard',
    baseQuality: 86,
    shelfLifeDays: 2,
    isVegetarian: false,
    unlocked: false,
    unlockCost: 48_000,
    accentColor: '#4E9A68',
    ingredients: [
      { ingredientId: 'shrimp', quantity: 100 },
      { ingredientId: 'spinach', quantity: 45 },
      { ingredientId: 'carrot', quantity: 30 },
      { ingredientId: 'wrapper', quantity: 10 },
      { ingredientId: 'tapioca', quantity: 25 },
      { ingredientId: 'seasoning', quantity: 4 },
    ],
  },
  {
    id: 'bakpao_gandum',
    nameEn: 'Whole-Wheat Herb Bun',
    nameId: 'Bakpao Gandum Herbal',
    descriptionEn: 'Fluffy steamed herbal bun stuffed with shiitake, broccoli, spinach, and silken tofu.',
    descriptionId: 'Bakpao kukus serat tinggi isi jamur shiitake, brokoli, bayam, dan tahu putih.',
    batchSize: 10,
    productionTimeSec: 72,
    difficulty: 'hard',
    baseQuality: 85,
    shelfLifeDays: 3,
    isVegetarian: true,
    unlocked: false,
    unlockCost: 45_000,
    accentColor: '#9B7A54',
    ingredients: [
      { ingredientId: 'tofu', quantity: 80 },
      { ingredientId: 'mushroom', quantity: 50 },
      { ingredientId: 'broccoli', quantity: 40 },
      { ingredientId: 'spinach', quantity: 35 },
      { ingredientId: 'wrapper', quantity: 10 },
      { ingredientId: 'tapioca', quantity: 25 },
      { ingredientId: 'seasoning', quantity: 4 },
    ],
  },
];

export const PACKAGING_TYPES: PackagingTypeDef[] = [
  {
    id: 'paper_box',
    nameEn: 'Paper Box (4 pcs)',
    nameId: 'Kotak Kertas (4 pcs)',
    capacity: 4,
    costPerBox: 500,
    colorHex: '#D8B98F',
  },
  {
    id: 'standard_box',
    nameEn: 'Standard Box (8 pcs)',
    nameId: 'Kotak Standar (8 pcs)',
    capacity: 8,
    costPerBox: 800,
    colorHex: '#6E9B72',
  },
  {
    id: 'family_box',
    nameEn: 'Family Box (16 pcs)',
    nameId: 'Kotak Keluarga (16 pcs)',
    capacity: 16,
    costPerBox: 1_500,
    colorHex: '#ED9B53',
  },
];

export const PACKAGING_PACK_PURCHASE_QTY = 10; // buy 10 boxes at a time in market

export const CUSTOMER_ARCHETYPES: CustomerArchetypeDef[] = [
  {
    id: 'student',
    nameEn: 'Student',
    nameId: 'Pelajar / Mahasiswa',
    budgetMin: 10_000,
    budgetMax: 24_000,
    maxPatienceSec: 32,
    preferredRecipeIds: ['chicken_carrot', 'tofu_mushroom'],
    preferredBoxSize: ['paper_box', 'standard_box'],
    priorityEn: 'Affordable value',
    priorityId: 'Harga terjangkau',
    shirtColor: '#4F86C6',
  },
  {
    id: 'worker',
    nameEn: 'Office Worker',
    nameId: 'Pekerja Kantoran',
    budgetMin: 18_000,
    budgetMax: 42_000,
    maxPatienceSec: 22,
    preferredRecipeIds: ['chicken_carrot', 'shrimp_veg'],
    preferredBoxSize: ['paper_box', 'standard_box'],
    priorityEn: 'Fast service',
    priorityId: 'Layanan cepat',
    shirtColor: '#244D3B',
  },
  {
    id: 'family',
    nameEn: 'Family',
    nameId: 'Keluarga',
    budgetMin: 40_000,
    budgetMax: 90_000,
    maxPatienceSec: 36,
    preferredRecipeIds: ['chicken_carrot', 'shrimp_veg', 'rainbow_veggie'],
    preferredBoxSize: ['family_box', 'standard_box'],
    priorityEn: 'Family bundle',
    priorityId: 'Paket keluarga',
    shirtColor: '#ED9B53',
  },
  {
    id: 'explorer',
    nameEn: 'Food Explorer',
    nameId: 'Penjelajah Kuliner',
    budgetMin: 20_000,
    budgetMax: 55_000,
    maxPatienceSec: 30,
    preferredRecipeIds: ['shrimp_veg', 'rainbow_veggie', 'tofu_mushroom'],
    preferredBoxSize: ['standard_box', 'paper_box'],
    priorityEn: 'Menu variety',
    priorityId: 'Variasi menu',
    shirtColor: '#B56576',
  },
  {
    id: 'healthy',
    nameEn: 'Healthy Food Enthusiast',
    nameId: 'Pecinta Makanan Sehat',
    budgetMin: 22_000,
    budgetMax: 60_000,
    maxPatienceSec: 34,
    preferredRecipeIds: ['tofu_mushroom', 'rainbow_veggie', 'chicken_carrot'],
    preferredBoxSize: ['standard_box', 'paper_box'],
    priorityEn: 'High quality & nutrition',
    priorityId: 'Kualitas & nutrisi tinggi',
    shirtColor: '#6E9B72',
  },
];

export const UPGRADE_DEFS: UpgradeDef[] = [
  {
    id: 'steamer',
    nameEn: 'Bamboo Steamer Tower',
    nameId: 'Menara Kukusan Bambu',
    descriptionEn: 'Expands batch production capacity per cooking session.',
    descriptionId: 'Memperbesar kapasitas produksi per sesi memasak.',
    levels: [
      { level: 1, cost: 0, capacityValue: 10, labelEn: '10 pcs / batch', labelId: '10 pcs / batch' },
      { level: 2, cost: 75_000, capacityValue: 20, labelEn: '20 pcs / batch', labelId: '20 pcs / batch' },
      { level: 3, cost: 160_000, capacityValue: 40, labelEn: '40 pcs / batch', labelId: '40 pcs / batch' },
    ],
  },
  {
    id: 'refrigerator',
    nameEn: 'Cold Ingredient Chiller',
    nameId: 'Kulkas Penyimpanan Bahan',
    descriptionEn: 'Increases ingredient cold storage capacity and freshness.',
    descriptionId: 'Menambah kapasitas penyimpanan dingin bahan baku.',
    levels: [
      { level: 1, cost: 0, capacityValue: 50_000, labelEn: '50 kg storage', labelId: 'Kapasitas 50 kg' },
      { level: 2, cost: 65_000, capacityValue: 100_000, labelEn: '100 kg storage', labelId: 'Kapasitas 100 kg' },
      { level: 3, cost: 140_000, capacityValue: 200_000, labelEn: '200 kg storage', labelId: 'Kapasitas 200 kg' },
    ],
  },
  {
    id: 'prep_table',
    nameEn: 'Preparation Workbench',
    nameId: 'Meja Persiapan Bahan',
    descriptionEn: 'Adds prep stations to boost hygiene and prep speed.',
    descriptionId: 'Menambah stasiun persiapan untuk meningkatkan higienitas.',
    levels: [
      { level: 1, cost: 0, capacityValue: 1, labelEn: '1 station (+0% hygiene)', labelId: '1 stasiun (+0% higienitas)' },
      { level: 2, cost: 55_000, capacityValue: 2, labelEn: '2 stations (+5% hygiene)', labelId: '2 stasiun (+5% higienitas)' },
      { level: 3, cost: 120_000, capacityValue: 3, labelEn: '3 stations (+10% hygiene)', labelId: '3 stasiun (+10% higienitas)' },
    ],
  },
  {
    id: 'packaging_station',
    nameEn: 'Packaging & Seal Bench',
    nameId: 'Meja Pengemasan & Segel',
    descriptionEn: 'Streamlines boxing and lowers packaging waste.',
    descriptionId: 'Mempercepat pengemasan dan menjaga kerapatan kemasan.',
    levels: [
      { level: 1, cost: 0, capacityValue: 1, labelEn: '1 station', labelId: '1 stasiun' },
      { level: 2, cost: 50_000, capacityValue: 2, labelEn: '2 stations (+3% quality)', labelId: '2 stasiun (+3% kualitas)' },
      { level: 3, cost: 110_000, capacityValue: 3, labelEn: '3 stations (+6% quality)', labelId: '3 stasiun (+6% kualitas)' },
    ],
  },
  {
    id: 'decoration',
    nameEn: 'Shop Interior & Lanterns',
    nameId: 'Dekorasi Outlet & Lampion',
    descriptionEn: 'Attracts more customers and boosts patience in the dining area.',
    descriptionId: 'Menarik lebih banyak pelanggan dan menambah kesabaran antre.',
    levels: [
      { level: 1, cost: 0, capacityValue: 1, labelEn: 'Basic Cozy', labelId: 'Dasar Nyaman' },
      { level: 2, cost: 80_000, capacityValue: 2, labelEn: 'Standard Bistro (+15% traffic)', labelId: 'Bistro Standar (+15% tamu)' },
      { level: 3, cost: 180_000, capacityValue: 3, labelEn: 'Premium Flagship (+30% traffic)', labelId: 'Outlet Premium (+30% tamu)' },
    ],
  },
  {
    id: 'dining_seating',
    nameEn: 'Dine-In Dining Area',
    nameId: 'Area Makan & Meja Dine-In',
    descriptionEn: 'Expands dine-in tables for higher-margin table service (+18% revenue & bonus rep).',
    descriptionId: 'Menambah meja dine-in untuk layanan makan di tempat (+18% omzet & bonus reputasi).',
    levels: [
      { level: 1, cost: 0, capacityValue: 2, labelEn: '2 Tables (Max 2 Dine-In)', labelId: '2 Meja (Maks 2 Dine-In)' },
      { level: 2, cost: 60_000, capacityValue: 3, labelEn: '3 Tables (Max 3 Dine-In)', labelId: '3 Meja (Maks 3 Dine-In)' },
      { level: 3, cost: 135_000, capacityValue: 4, labelEn: '4 Tables (Max 4 Dine-In)', labelId: '4 Meja (Maks 4 Dine-In)' },
    ],
  },
];

export const MARKET_EVENTS: MarketEvent[] = [
  {
    id: 'harvest_surplus',
    titleEn: 'Highland Vegetable Harvest',
    titleId: 'Panen Raya Sayuran',
    descriptionEn: 'Fresh carrots, spinach, broccoli, and mushrooms are 20% off today!',
    descriptionId: 'Wortel, bayam, brokoli, dan jamur diskon 20% hari ini!',
    affectedIngredientIds: ['carrot', 'spinach', 'broccoli', 'mushroom'],
    priceMultiplier: 0.8,
  },
  {
    id: 'coastal_surge',
    titleEn: 'Coastal Tide Shift',
    titleId: 'Pasang Laut Tinggi',
    descriptionEn: 'Fresh shrimp supply is tighter today (+25% price).',
    descriptionId: 'Pasokan udang segar menipis hari ini (harga +25%).',
    affectedIngredientIds: ['shrimp'],
    priceMultiplier: 1.25,
  },
  {
    id: 'poultry_promo',
    titleEn: 'Morning Poultry Deal',
    titleId: 'Promo Ayam Pagi',
    descriptionEn: 'Supplier discount on Chicken Breast (-15% today).',
    descriptionId: 'Diskon supplier untuk Daging Ayam (-15% hari ini).',
    affectedIngredientIds: ['chicken'],
    priceMultiplier: 0.85,
  },
  {
    id: 'wrapper_demand',
    titleEn: 'Festival Flour Demand',
    titleId: 'Permintaan Tepung Naik',
    descriptionEn: 'Wrappers and tapioca flour cost 15% more today.',
    descriptionId: 'Kulit dimsum dan tapioka naik 15% hari ini.',
    affectedIngredientIds: ['wrapper', 'tapioca'],
    priceMultiplier: 1.15,
  },
];

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_batch',
    category: 'production',
    tier: 'bronze',
    titleEn: 'First Bamboo Steam',
    titleId: 'Kukusan Pertama',
    descriptionEn: 'Complete your first dimsum production batch.',
    descriptionId: 'Selesaikan batch produksi dimsum pertamamu.',
  },
  {
    id: 'qc_master',
    category: 'production',
    tier: 'silver',
    titleEn: 'Master Craftsman (90+ QC)',
    titleId: 'Kualitas Bintang Lima (QC 90+)',
    descriptionEn: 'Achieve an Excellent quality score of 90 or above.',
    descriptionId: 'Raih skor kualitas Sempurna (90 atau lebih).',
  },
  {
    id: 'qc_perfectionist',
    category: 'production',
    tier: 'gold',
    titleEn: 'Grand Dimsum Perfectionist (96+ QC)',
    titleId: 'Perfeksionis Kuliner (QC 96+)',
    descriptionEn: 'Produce a batch scoring 96 or higher in Quality Control.',
    descriptionId: 'Hasilkan batch dengan skor QC 96 atau lebih tinggi.',
  },
  {
    id: 'batch_veteran',
    category: 'production',
    tier: 'silver',
    titleEn: '100 Pieces Steamed',
    titleId: '100 Dimsum Terkukus',
    descriptionEn: 'Produce at least 100 total dimsum pieces across all batches.',
    descriptionId: 'Produksi minimal 100 pcs dimsum secara kumulatif.',
  },
  {
    id: 'recipe_collector',
    category: 'production',
    tier: 'silver',
    titleEn: 'Diverse Healthy Menu',
    titleId: 'Kolektor Menu Sehat',
    descriptionEn: 'Unlock at least 6 different healthy dimsum recipes.',
    descriptionId: 'Buka minimal 6 variasi resep dimsum sehat.',
  },
  {
    id: 'culinary_rd_master',
    category: 'production',
    tier: 'gold',
    titleEn: 'R&D Innovation Lab',
    titleId: 'Master Riset Kuliner',
    descriptionEn: 'Complete Recipe R&D optimization for at least 3 dishes.',
    descriptionId: 'Selesaikan riset formula R&D untuk minimal 3 menu.',
  },
  {
    id: 'first_sale',
    category: 'sales',
    tier: 'bronze',
    titleEn: 'Grand Opening Sale',
    titleId: 'Penjualan Perdana',
    descriptionEn: 'Serve your first customer at the cashier.',
    descriptionId: 'Layani pelanggan pertamamu di kasir.',
  },
  {
    id: 'regular_crowd',
    category: 'sales',
    tier: 'silver',
    titleEn: 'Neighborhood Favorite (25 Sales)',
    titleId: 'Langganan Warga (25 Transaksi)',
    descriptionEn: 'Complete 25 total customer orders across any channel.',
    descriptionId: 'Selesaikan 25 transaksi pesanan di semua saluran penjualan.',
  },
  {
    id: 'dimsum_legend',
    category: 'sales',
    tier: 'gold',
    titleEn: 'Culinary Crowd Legend (60 Sales)',
    titleId: 'Legenda Outlet (60 Transaksi)',
    descriptionEn: 'Complete 60 total sales orders.',
    descriptionId: 'Selesaikan total 60 transaksi penjualan.',
  },
  {
    id: 'dine_in_host',
    category: 'service',
    tier: 'bronze',
    titleEn: 'Cozy Table Host',
    titleId: 'Tuan Rumah Dine-In',
    descriptionEn: 'Serve 5 dine-in guests seated in your dining room.',
    descriptionId: 'Layani 5 pelanggan makan di tempat (Dine-In).',
  },
  {
    id: 'b2b_contractor',
    category: 'sales',
    tier: 'silver',
    titleEn: 'B2B Catering Partner',
    titleId: 'Mitra Kontrak B2B',
    descriptionEn: 'Fulfill 3 B2B pre-order catering contracts.',
    descriptionId: 'Penuhi 3 kontrak katering B2B.',
  },
  {
    id: 'omnichannel_pro',
    category: 'sales',
    tier: 'silver',
    titleEn: 'Omnichannel Delivery Pro',
    titleId: 'Juara Pesan-Antar Online',
    descriptionEn: 'Fulfill 5 Online Delivery (Ojol) courier orders.',
    descriptionId: 'Selesaikan 5 pesanan pesan-antar online (Ojol).',
  },
  {
    id: 'zero_waste_hero',
    category: 'service',
    tier: 'silver',
    titleEn: 'Zero-Waste Guardian (3-Day Streak)',
    titleId: 'Penjaga Nol Limbah (3 Hari Beruntun)',
    descriptionEn: 'Run 3 consecutive business days with zero expired or wasted loss.',
    descriptionId: 'Jalankan 3 hari usaha berturut-turut dengan nol kerugian limbah.',
  },
  {
    id: 'profitable_day',
    category: 'finance',
    tier: 'bronze',
    titleEn: 'Green Ledger Day',
    titleId: 'Hari Laba Bersih',
    descriptionEn: 'Finish a business day with positive Net Profit.',
    descriptionId: 'Tutup hari bisnis dengan Laba Bersih positif.',
  },
  {
    id: 'profit_mogul',
    category: 'finance',
    tier: 'gold',
    titleEn: 'Single-Day Profit Mogul',
    titleId: 'Juragan Laba Harian',
    descriptionEn: 'Achieve Rp150.000 or more Net Profit in a single day.',
    descriptionId: 'Raih Laba Bersih Rp150.000 atau lebih dalam satu hari.',
  },
  {
    id: 'revenue_half_million',
    category: 'finance',
    tier: 'silver',
    titleEn: 'Rp500K Cumulative Turnover',
    titleId: 'Omzet Rp500 Ribu',
    descriptionEn: 'Reach Rp500.000 in lifetime sales revenue.',
    descriptionId: 'Capai total omzet penjualan Rp500.000.',
  },
  {
    id: 'revenue_millionaire',
    category: 'finance',
    tier: 'gold',
    titleEn: 'Dimsum Millionaire (Rp1M)',
    titleId: 'Jutawan Dimsum (Rp1 Juta)',
    descriptionEn: 'Reach Rp1.000.000 in lifetime sales revenue.',
    descriptionId: 'Capai total omzet penjualan Rp1.000.000.',
  },
  {
    id: 'debt_free_discipline',
    category: 'finance',
    tier: 'silver',
    titleEn: 'Debt-Free Discipline',
    titleId: 'Disiplin Bebas Utang',
    descriptionEn: 'Reach Day 5 or higher with Rp0 unpaid OPEX/payroll debt.',
    descriptionId: 'Capai Hari 5 atau lebih dengan Rp0 tunggakan utang usaha.',
  },
  {
    id: 'hard_mode_survivor',
    category: 'finance',
    tier: 'gold',
    titleEn: 'Lean Micro-Stall Survivor',
    titleId: 'Pejuang Modal Mikro',
    descriptionEn: 'Finish a profitable day on Hard capital difficulty.',
    descriptionId: 'Tutup hari dengan laba bersih positif pada tingkat modal Sulit.',
  },
  {
    id: 'shop_upgrader',
    category: 'progression',
    tier: 'bronze',
    titleEn: 'Growing Kitchen',
    titleId: 'Dapur Berkembang',
    descriptionEn: 'Upgrade any outlet facility to Level 2 or higher.',
    descriptionId: 'Tingkatkan fasilitas outlet ke Level 2 atau lebih.',
  },
  {
    id: 'maxed_station',
    category: 'progression',
    tier: 'silver',
    titleEn: 'Artisan Equipment (Lv 3)',
    titleId: 'Peralatan Puncak (Lv 3)',
    descriptionEn: 'Upgrade any kitchen or outlet facility to maximum Level 3.',
    descriptionId: 'Tingkatkan salah satu fasilitas hingga Level maksimal (Lv 3).',
  },
  {
    id: 'flagship_bistro',
    category: 'progression',
    tier: 'gold',
    titleEn: 'Flagship Healthy Bistro',
    titleId: 'Bistro Sehat Unggulan',
    descriptionEn: 'Upgrade all 6 outlet facilities to Level 2 or higher.',
    descriptionId: 'Tingkatkan seluruh 6 fasilitas outlet minimal ke Level 2.',
  },
  {
    id: 'full_crew',
    category: 'progression',
    tier: 'silver',
    titleEn: 'Complete Culinary Crew',
    titleId: 'Tim Dapur Lengkap (4/4)',
    descriptionEn: 'Hire all 4 Kitchen Helper specialists on your team.',
    descriptionId: 'Rekrut keempat spesialis Asisten Dapur sekaligus.',
  },
  {
    id: 'skill_mentor',
    category: 'progression',
    tier: 'silver',
    titleEn: 'Skill Tree Mentor',
    titleId: 'Mentor Pohon Skill',
    descriptionEn: 'Unlock 4 or more specialized Staff Skill Tree nodes.',
    descriptionId: 'Buka 4 atau lebih node pada Pohon Skill Staf.',
  },
  {
    id: 'reputation_80',
    category: 'service',
    tier: 'silver',
    titleEn: 'Trusted Local Gem (80+ Rep)',
    titleId: 'Favorit Terpercaya (Rep 80+)',
    descriptionEn: 'Grow Shop Reputation to 80 or higher.',
    descriptionId: 'Bangun Reputasi Toko hingga mencapai 80 atau lebih.',
  },
  {
    id: 'reputation_95',
    category: 'service',
    tier: 'gold',
    titleEn: 'Five-Star Culinary Landmark (95+ Rep)',
    titleId: 'Ikon Kuliner Bintang Lima (Rep 95+)',
    descriptionEn: 'Grow Shop Reputation to 95 or higher.',
    descriptionId: 'Capai Reputasi Toko puncak 95 atau lebih.',
  },
];

/**
 * Starter inventory matching GDD §2.3 allocation:
 * - Starter ingredients: Rp150.000
 * - Starter packaging: Rp50.000
 * - Equipment: Rp200.000 (Level 1 defaults)
 * - Liquid cash: Rp100.000
 */
export function createStarterIngredientLots(
  day = 1,
  difficulty: CapitalDifficulty = 'easy',
): IngredientLot[] {
  if (difficulty === 'medium') {
    // Totals exact Rp90.000 starter ingredient value
    return [
      {
        id: 'starter-chicken',
        ingredientId: 'chicken',
        quantityRemaining: 600,
        initialQuantity: 600,
        unitCostPerBaseUnit: 45,
        totalLotCost: 27_000,
        purchasedDay: day,
        expiryDay: day + 3,
        quality: 92,
      },
      {
        id: 'starter-shrimp',
        ingredientId: 'shrimp',
        quantityRemaining: 150,
        initialQuantity: 150,
        unitCostPerBaseUnit: 70,
        totalLotCost: 10_500,
        purchasedDay: day,
        expiryDay: day + 2,
        quality: 94,
      },
      {
        id: 'starter-tofu',
        ingredientId: 'tofu',
        quantityRemaining: 250,
        initialQuantity: 250,
        unitCostPerBaseUnit: 20,
        totalLotCost: 5_000,
        purchasedDay: day,
        expiryDay: day + 3,
        quality: 90,
      },
      {
        id: 'starter-carrot',
        ingredientId: 'carrot',
        quantityRemaining: 300,
        initialQuantity: 300,
        unitCostPerBaseUnit: 15,
        totalLotCost: 4_500,
        purchasedDay: day,
        expiryDay: day + 5,
        quality: 93,
      },
      {
        id: 'starter-broccoli',
        ingredientId: 'broccoli',
        quantityRemaining: 200,
        initialQuantity: 200,
        unitCostPerBaseUnit: 30,
        totalLotCost: 6_000,
        purchasedDay: day,
        expiryDay: day + 4,
        quality: 92,
      },
      {
        id: 'starter-mushroom',
        ingredientId: 'mushroom',
        quantityRemaining: 150,
        initialQuantity: 150,
        unitCostPerBaseUnit: 25,
        totalLotCost: 3_750,
        purchasedDay: day,
        expiryDay: day + 4,
        quality: 91,
      },
      {
        id: 'starter-garlic',
        ingredientId: 'garlic',
        quantityRemaining: 60,
        initialQuantity: 60,
        unitCostPerBaseUnit: 40,
        totalLotCost: 2_400,
        purchasedDay: day,
        expiryDay: day + 10,
        quality: 95,
      },
      {
        id: 'starter-seasoning',
        ingredientId: 'seasoning',
        quantityRemaining: 60,
        initialQuantity: 60,
        unitCostPerBaseUnit: 50,
        totalLotCost: 3_000,
        purchasedDay: day,
        expiryDay: day + 14,
        quality: 95,
      },
      {
        id: 'starter-wrapper',
        ingredientId: 'wrapper',
        quantityRemaining: 60,
        initialQuantity: 60,
        unitCostPerBaseUnit: 400,
        totalLotCost: 24_000,
        purchasedDay: day,
        expiryDay: day + 4,
        quality: 94,
      },
      {
        id: 'starter-tapioca',
        ingredientId: 'tapioca',
        quantityRemaining: 250,
        initialQuantity: 250,
        unitCostPerBaseUnit: 15.4,
        totalLotCost: 3_850,
        purchasedDay: day,
        expiryDay: day + 14,
        quality: 95,
      },
    ];
  }

  if (difficulty === 'hard') {
    // Totals exact Rp40.000 starter ingredient value
    return [
      {
        id: 'starter-chicken',
        ingredientId: 'chicken',
        quantityRemaining: 250,
        initialQuantity: 250,
        unitCostPerBaseUnit: 45,
        totalLotCost: 11_250,
        purchasedDay: day,
        expiryDay: day + 3,
        quality: 92,
      },
      {
        id: 'starter-shrimp',
        ingredientId: 'shrimp',
        quantityRemaining: 100,
        initialQuantity: 100,
        unitCostPerBaseUnit: 70,
        totalLotCost: 7_000,
        purchasedDay: day,
        expiryDay: day + 2,
        quality: 94,
      },
      {
        id: 'starter-tofu',
        ingredientId: 'tofu',
        quantityRemaining: 150,
        initialQuantity: 150,
        unitCostPerBaseUnit: 20,
        totalLotCost: 3_000,
        purchasedDay: day,
        expiryDay: day + 3,
        quality: 90,
      },
      {
        id: 'starter-carrot',
        ingredientId: 'carrot',
        quantityRemaining: 150,
        initialQuantity: 150,
        unitCostPerBaseUnit: 15,
        totalLotCost: 2_250,
        purchasedDay: day,
        expiryDay: day + 5,
        quality: 93,
      },
      {
        id: 'starter-broccoli',
        ingredientId: 'broccoli',
        quantityRemaining: 50,
        initialQuantity: 50,
        unitCostPerBaseUnit: 30,
        totalLotCost: 1_500,
        purchasedDay: day,
        expiryDay: day + 4,
        quality: 92,
      },
      {
        id: 'starter-mushroom',
        ingredientId: 'mushroom',
        quantityRemaining: 60,
        initialQuantity: 60,
        unitCostPerBaseUnit: 25,
        totalLotCost: 1_500,
        purchasedDay: day,
        expiryDay: day + 4,
        quality: 91,
      },
      {
        id: 'starter-garlic',
        ingredientId: 'garlic',
        quantityRemaining: 25,
        initialQuantity: 25,
        unitCostPerBaseUnit: 40,
        totalLotCost: 1_000,
        purchasedDay: day,
        expiryDay: day + 10,
        quality: 95,
      },
      {
        id: 'starter-seasoning',
        ingredientId: 'seasoning',
        quantityRemaining: 20,
        initialQuantity: 20,
        unitCostPerBaseUnit: 50,
        totalLotCost: 1_000,
        purchasedDay: day,
        expiryDay: day + 14,
        quality: 95,
      },
      {
        id: 'starter-wrapper',
        ingredientId: 'wrapper',
        quantityRemaining: 25,
        initialQuantity: 25,
        unitCostPerBaseUnit: 400,
        totalLotCost: 10_000,
        purchasedDay: day,
        expiryDay: day + 4,
        quality: 94,
      },
      {
        id: 'starter-tapioca',
        ingredientId: 'tapioca',
        quantityRemaining: 100,
        initialQuantity: 100,
        unitCostPerBaseUnit: 15,
        totalLotCost: 1_500,
        purchasedDay: day,
        expiryDay: day + 14,
        quality: 95,
      },
    ];
  }

  // Easy (Rp150.000 starter ingredient value)
  return [
    {
      id: 'starter-chicken',
      ingredientId: 'chicken',
      quantityRemaining: 1000,
      initialQuantity: 1000,
      unitCostPerBaseUnit: 45,
      totalLotCost: 45_000,
      purchasedDay: day,
      expiryDay: day + 3,
      quality: 92,
    },
    {
      id: 'starter-shrimp',
      ingredientId: 'shrimp',
      quantityRemaining: 250,
      initialQuantity: 250,
      unitCostPerBaseUnit: 70,
      totalLotCost: 17_500,
      purchasedDay: day,
      expiryDay: day + 2,
      quality: 94,
    },
    {
      id: 'starter-tofu',
      ingredientId: 'tofu',
      quantityRemaining: 400,
      initialQuantity: 400,
      unitCostPerBaseUnit: 20,
      totalLotCost: 8_000,
      purchasedDay: day,
      expiryDay: day + 3,
      quality: 90,
    },
    {
      id: 'starter-carrot',
      ingredientId: 'carrot',
      quantityRemaining: 500,
      initialQuantity: 500,
      unitCostPerBaseUnit: 15,
      totalLotCost: 7_500,
      purchasedDay: day,
      expiryDay: day + 5,
      quality: 93,
    },
    {
      id: 'starter-broccoli',
      ingredientId: 'broccoli',
      quantityRemaining: 300,
      initialQuantity: 300,
      unitCostPerBaseUnit: 30,
      totalLotCost: 9_000,
      purchasedDay: day,
      expiryDay: day + 4,
      quality: 92,
    },
    {
      id: 'starter-mushroom',
      ingredientId: 'mushroom',
      quantityRemaining: 250,
      initialQuantity: 250,
      unitCostPerBaseUnit: 25,
      totalLotCost: 6_250,
      purchasedDay: day,
      expiryDay: day + 4,
      quality: 91,
    },
    {
      id: 'starter-garlic',
      ingredientId: 'garlic',
      quantityRemaining: 100,
      initialQuantity: 100,
      unitCostPerBaseUnit: 40,
      totalLotCost: 4_000,
      purchasedDay: day,
      expiryDay: day + 10,
      quality: 95,
    },
    {
      id: 'starter-seasoning',
      ingredientId: 'seasoning',
      quantityRemaining: 100,
      initialQuantity: 100,
      unitCostPerBaseUnit: 50,
      totalLotCost: 5_000,
      purchasedDay: day,
      expiryDay: day + 14,
      quality: 95,
    },
    {
      id: 'starter-wrapper',
      ingredientId: 'wrapper',
      quantityRemaining: 100,
      initialQuantity: 100,
      unitCostPerBaseUnit: 400,
      totalLotCost: 40_000,
      purchasedDay: day,
      expiryDay: day + 4,
      quality: 94,
    },
    {
      id: 'starter-tapioca',
      ingredientId: 'tapioca',
      quantityRemaining: 500,
      initialQuantity: 500,
      unitCostPerBaseUnit: 15,
      totalLotCost: 7_750, // totals exact Rp150.000 starter ingredient value
      purchasedDay: day,
      expiryDay: day + 14,
      quality: 95,
    },
  ];
}

export function createStarterPackagingStock(
  difficulty: CapitalDifficulty = 'easy',
): Record<PackagingTypeId, number> {
  if (difficulty === 'medium') {
    // 24 Paper (12.000) + 15 Standard (12.000) + 4 Family (6.000) = Rp30.000
    return {
      paper_box: 24,
      standard_box: 15,
      family_box: 4,
    };
  }
  if (difficulty === 'hard') {
    // 14 Paper (7.000) + 10 Standard (8.000) = Rp15.000
    return {
      paper_box: 14,
      standard_box: 10,
      family_box: 0,
    };
  }
  // Easy: 42 Paper (21.000) + 25 Standard (20.000) + 6 Family (9.000) => Rp50.000
  return {
    paper_box: 42,
    standard_box: 25,
    family_box: 6,
  };
}

export function createDefaultUpgrades(): UpgradeLevels {
  return {
    steamer: 1,
    refrigerator: 1,
    prep_table: 1,
    packaging_station: 1,
    decoration: 1,
    dining_seating: 1,
  };
}

export function getDineInCapacity(upgrades: UpgradeLevels): number {
  const lvl = upgrades.dining_seating ?? 1;
  return lvl >= 3 ? 4 : lvl === 2 ? 3 : 2;
}

export function getUpgradeDef(id: UpgradeId): UpgradeDef {
  return UPGRADE_DEFS.find((u) => u.id === id)!;
}

export function getIngredientDef(id: string): IngredientDef | undefined {
  return INGREDIENTS.find((i) => i.id === id);
}

export function getPackagingDef(id: PackagingTypeId): PackagingTypeDef {
  return PACKAGING_TYPES.find((p) => p.id === id)!;
}

export const KITCHEN_HELPER_ROSTER: KitchenHelperDef[] = [
  {
    id: 'prep',
    name: 'Rina Sari',
    roleEn: 'Prep Assistant (Stage 1)',
    roleId: 'Asisten Persiapan (Tahap 1)',
    stage: 'PREP',
    hireCost: 35_000,
    dailyWage: 6_000,
    baseTrainCost: 25_000,
    perkSummaryEn: 'Pre-loads 1–3 ingredients into prep bowl & adds +4/+7/+10 Prep accuracy.',
    perkSummaryId: 'Menyiapkan 1–3 bahan otomatis & bonus akurasi Persiapan +4/+7/+10.',
  },
  {
    id: 'mix',
    name: 'Budi Santoso',
    roleEn: 'Mixing Specialist (Stage 2)',
    roleId: 'Spesialis Adonan (Tahap 2)',
    stage: 'MIX',
    hireCost: 40_000,
    dailyWage: 7_000,
    baseTrainCost: 28_000,
    perkSummaryEn: 'Pre-aligns filling ratios, +5/10/15% whisk speed & +4/+7/+10 Mix quality.',
    perkSummaryId: 'Menyelaraskan rasio isian, aduk +5/10/15% lebih cepat & bonus Aduk +4/+7/+10.',
  },
  {
    id: 'wrap',
    name: 'Siti Aminah',
    roleEn: 'Folding Artisan (Stage 3)',
    roleId: 'Pengrajin Lipatan (Tahap 3)',
    stage: 'WRAP',
    hireCost: 45_000,
    dailyWage: 8_000,
    baseTrainCost: 30_000,
    perkSummaryEn: 'Pre-folds 1–3 wrapper pleats per piece & adds +4/+7/+10 Wrap quality.',
    perkSummaryId: 'Melipat 1–3 lipatan awal per dimsum & bonus Bentuk +4/+7/+10.',
  },
  {
    id: 'steam',
    name: 'Hendra Wijaya',
    roleEn: 'Steamer Master (Stage 4)',
    roleId: 'Ahli Kukusan (Tahap 4)',
    stage: 'STEAM',
    hireCost: 50_000,
    dailyWage: 9_000,
    baseTrainCost: 32_000,
    perkSummaryEn: 'Stabilizes steam temperature, speeds up steaming & adds +4/+7/+10 Steam score.',
    perkSummaryId: 'Menstabilkan suhu uap, mempercepat kukus & bonus Kukus +4/+7/+10.',
  },
];

export function getKitchenHelperDef(id: KitchenHelperRole): KitchenHelperDef {
  return KITCHEN_HELPER_ROSTER.find((h) => h.id === id)!;
}

export function getKitchenHelperTrainCost(
  def: KitchenHelperDef,
  currentLevel: 1 | 2 | 3,
): number | null {
  if (currentLevel >= 3) return null;
  return def.baseTrainCost * currentLevel;
}

export function getKitchenHelperQualityBonus(level: 1 | 2 | 3 | undefined): number {
  if (level === 1) return 4;
  if (level === 2) return 7;
  if (level === 3) return 10;
  return 0;
}

export const DEFAULT_STAFF_MORALE = 85;
export const WELLNESS_SHIFT_INSTANT_BOOST = 15;
export const WELLNESS_SHIFT_BATCH_RECOVERY = 18;
export const WELLNESS_SHIFT_OVERNIGHT_RECOVERY = 28;

export type StaffMoraleTier = 'high' | 'steady' | 'tired' | 'exhausted';

export function getStaffMorale(member?: KitchenHelperState): number {
  if (!member) return DEFAULT_STAFF_MORALE;
  return Math.max(0, Math.min(100, Math.round(member.morale ?? DEFAULT_STAFF_MORALE)));
}

export function getStaffMoraleTier(morale: number): StaffMoraleTier {
  if (morale >= 80) return 'high';
  if (morale >= 50) return 'steady';
  if (morale >= 25) return 'tired';
  return 'exhausted';
}

export function getEffectiveHelperQualityBonus(member?: KitchenHelperState): number {
  if (!member || member.shift === 'wellness') return 0;
  const base = getKitchenHelperQualityBonus(member.level);
  const tier = getStaffMoraleTier(getStaffMorale(member));
  const moraleDelta =
    tier === 'high' ? 3 : tier === 'steady' ? 0 : tier === 'tired' ? -3 : -6;
  return base + moraleDelta;
}

export function getEffectiveHelperSpeedMultiplier(member?: KitchenHelperState): number {
  if (!member || member.shift === 'wellness') return 1;
  const tier = getStaffMoraleTier(getStaffMorale(member));
  if (tier === 'high') return 1.2;
  if (tier === 'steady') return 1.0;
  if (tier === 'tired') return 0.85;
  return 0.7;
}

export function computeStaffMoraleAfterBatch(
  member: KitchenHelperState,
): KitchenHelperState {
  const currentMorale = getStaffMorale(member);
  if (member.shift === 'wellness') {
    return {
      ...member,
      morale: Math.min(100, currentMorale + WELLNESS_SHIFT_BATCH_RECOVERY),
      consecutiveWorkBatches: 0,
    };
  }
  const nextStreak = (member.consecutiveWorkBatches ?? 0) + 1;
  const fatigueDrop = nextStreak <= 1 ? 6 : nextStreak === 2 ? 10 : 15;
  return {
    ...member,
    morale: Math.max(5, currentMorale - fatigueDrop),
    shift: 'kitchen',
    consecutiveWorkBatches: nextStreak,
  };
}

export function computeStaffMoraleOvernight(
  member: KitchenHelperState,
): KitchenHelperState {
  const currentMorale = getStaffMorale(member);
  if (member.shift === 'wellness') {
    return {
      ...member,
      morale: Math.min(100, currentMorale + WELLNESS_SHIFT_OVERNIGHT_RECOVERY),
      consecutiveWorkBatches: 0,
    };
  }
  const overworkedPenalty = (member.consecutiveWorkBatches ?? 0) >= 2 ? 6 : 0;
  return {
    ...member,
    morale: Math.max(5, Math.min(100, currentMorale + 5 - overworkedPenalty)),
    shift: 'kitchen',
    consecutiveWorkBatches: 0,
  };
}

export function computeAverageTeamMorale(staff: KitchenHelperState[]): number {
  if (staff.length === 0) return DEFAULT_STAFF_MORALE;
  const total = staff.reduce((sum, member) => sum + getStaffMorale(member), 0);
  return Math.round(total / staff.length);
}

export function getTotalDailyStaffWages(staff: KitchenHelperState[]): number {
  return staff.reduce((sum, member) => {
    const def = KITCHEN_HELPER_ROSTER.find((h) => h.id === member.id);
    return sum + (def ? def.dailyWage : 0);
  }, 0);
}

export function getDailyRevenueGoal(businessLevel: number): number {
  const safeLevel = Math.max(1, Math.floor(businessLevel));
  return (
    ECONOMY_RULES.dailyRevenueGoalBase +
    (safeLevel - 1) * ECONOMY_RULES.dailyRevenueGoalPerLevel
  );
}

export function getDailyWastageLimit(businessLevel: number): number {
  const safeLevel = Math.max(1, Math.floor(businessLevel));
  return (
    ECONOMY_RULES.dailyWastageLimitBase +
    (safeLevel - 1) * ECONOMY_RULES.dailyWastageLimitPerLevel
  );
}

export const SERVE_50_CUSTOMERS_TARGET = 50;

export const GOAL_BONUS_REWARDS = {
  daily_customers: 10_000,
  daily_production: 8_000,
  serve_50_customers: 25_000,
} as const;

export function getDailyCustomerGoal(businessLevel: number): number {
  const safeLevel = Math.max(1, Math.floor(businessLevel));
  return 4 + (safeLevel - 1) * 2;
}

export function getDailyProductionGoal(businessLevel: number): number {
  const safeLevel = Math.max(1, Math.floor(businessLevel));
  return 20 + (safeLevel - 1) * 10;
}

export function evaluateBonusObjectives(params: {
  businessLevel: number;
  currentDay: number;
  todayCustomersServed: number;
  todayPcsProduced: number;
  totalCustomersServed: number;
}): BonusObjectiveDef[] {
  const dailyCustTarget = getDailyCustomerGoal(params.businessLevel);
  const dailyProdTarget = getDailyProductionGoal(params.businessLevel);

  return [
    {
      id: 'serve_50_customers',
      scope: 'milestone',
      titleEn: `Serve ${SERVE_50_CUSTOMERS_TARGET} Customers`,
      titleId: `Layani ${SERVE_50_CUSTOMERS_TARGET} Pelanggan`,
      current: Math.min(SERVE_50_CUSTOMERS_TARGET, Math.max(0, params.totalCustomersServed)),
      target: SERVE_50_CUSTOMERS_TARGET,
      completed: params.totalCustomersServed >= SERVE_50_CUSTOMERS_TARGET,
      rewardCash: GOAL_BONUS_REWARDS.serve_50_customers,
      referenceId: 'bonus-milestone-serve-50',
    },
    {
      id: 'daily_customers',
      scope: 'daily',
      titleEn: `Serve ${dailyCustTarget} Customers Today`,
      titleId: `Layani ${dailyCustTarget} Pelanggan Hari Ini`,
      current: Math.min(dailyCustTarget, Math.max(0, params.todayCustomersServed)),
      target: dailyCustTarget,
      completed: params.todayCustomersServed >= dailyCustTarget,
      rewardCash: GOAL_BONUS_REWARDS.daily_customers,
      referenceId: `bonus-daily-customers-day-${params.currentDay}`,
    },
    {
      id: 'daily_production',
      scope: 'daily',
      titleEn: `Cook ${dailyProdTarget} Pcs Today`,
      titleId: `Masak ${dailyProdTarget} Pcs Hari Ini`,
      current: Math.min(dailyProdTarget, Math.max(0, params.todayPcsProduced)),
      target: dailyProdTarget,
      completed: params.todayPcsProduced >= dailyProdTarget,
      rewardCash: GOAL_BONUS_REWARDS.daily_production,
      referenceId: `bonus-daily-cook-day-${params.currentDay}`,
    },
  ];
}

export const RECIPE_RESEARCH_DEFS: RecipeResearchDef[] = [
  {
    recipeId: 'chicken_carrot',
    researchCost: 30_000,
    formulaNameEn: 'Garden-Light Chicken & Shiitake Blend',
    formulaNameId: 'Racikan Ayam Jamur Rendah Lemak',
    healthBenefitEn: 'Cuts refined tapioca (-40%) & sodium while enriching with fiber-rich carrot and shiitake.',
    healthBenefitId: 'Mengurangi tapioka (-40%) & garam, diperkaya wortel berserat dan jamur shiitake.',
    newBaseQuality: 83,
    newProductionTimeSec: 55,
    newShelfLifeDays: 3,
    newIngredients: [
      { ingredientId: 'chicken', quantity: 75 },
      { ingredientId: 'carrot', quantity: 65 },
      { ingredientId: 'mushroom', quantity: 20 },
      { ingredientId: 'wrapper', quantity: 10 },
      { ingredientId: 'garlic', quantity: 6 },
      { ingredientId: 'tapioca', quantity: 12 },
      { ingredientId: 'seasoning', quantity: 3 },
    ],
  },
  {
    recipeId: 'shrimp_veg',
    researchCost: 40_000,
    formulaNameEn: 'Omega-Green Shrimp & Silken Tofu Balance',
    formulaNameId: 'Racikan Udang Tahu Hijau Seimbang',
    healthBenefitEn: 'Balances seafood with organic silken tofu & broccoli, slashing tapioca starch in half.',
    healthBenefitId: 'Menyeimbangkan udang dengan tahu organik & brokoli, memangkas setengah tepung tapioka.',
    newBaseQuality: 88,
    newProductionTimeSec: 62,
    newShelfLifeDays: 2,
    newIngredients: [
      { ingredientId: 'shrimp', quantity: 65 },
      { ingredientId: 'tofu', quantity: 35 },
      { ingredientId: 'broccoli', quantity: 45 },
      { ingredientId: 'carrot', quantity: 30 },
      { ingredientId: 'wrapper', quantity: 10 },
      { ingredientId: 'garlic', quantity: 6 },
      { ingredientId: 'tapioca', quantity: 10 },
      { ingredientId: 'seasoning', quantity: 3 },
    ],
  },
  {
    recipeId: 'tofu_mushroom',
    researchCost: 28_000,
    formulaNameEn: 'Vitality Carrot-Tofu Clean Formula',
    formulaNameId: 'Racikan Tahu Wortel Rendah Natrium',
    healthBenefitEn: 'Reduces sodium (-50%) & starch while adding beta-carotene crunch for cleaner margins.',
    healthBenefitId: 'Mengurangi natrium (-50%) & tepung sambil menambah wortel segar yang hemat biaya.',
    newBaseQuality: 84,
    newProductionTimeSec: 50,
    newShelfLifeDays: 3,
    newIngredients: [
      { ingredientId: 'tofu', quantity: 80 },
      { ingredientId: 'mushroom', quantity: 35 },
      { ingredientId: 'carrot', quantity: 35 },
      { ingredientId: 'wrapper', quantity: 10 },
      { ingredientId: 'garlic', quantity: 5 },
      { ingredientId: 'tapioca', quantity: 10 },
      { ingredientId: 'seasoning', quantity: 2 },
    ],
  },
  {
    recipeId: 'rainbow_veggie',
    researchCost: 35_000,
    formulaNameEn: 'Clean-Harvest Low-Sodium Rainbow Blend',
    formulaNameId: 'Racikan Pelangi Segar Rendah Natrium',
    healthBenefitEn: 'Optimizes leafy-green ratios, lowers salt & starch, and extends chilled freshness to 3 days.',
    healthBenefitId: 'Mengoptimalkan porsi sayuran hijau, kurangi garam & tepung, serta tahan 3 hari.',
    newBaseQuality: 90,
    newProductionTimeSec: 58,
    newShelfLifeDays: 3,
    newIngredients: [
      { ingredientId: 'spinach', quantity: 45 },
      { ingredientId: 'carrot', quantity: 55 },
      { ingredientId: 'broccoli', quantity: 30 },
      { ingredientId: 'mushroom', quantity: 25 },
      { ingredientId: 'wrapper', quantity: 10 },
      { ingredientId: 'tapioca', quantity: 10 },
      { ingredientId: 'seasoning', quantity: 2 },
    ],
  },
  {
    recipeId: 'mentai_chicken',
    researchCost: 38_000,
    formulaNameEn: 'Light Yogurt-Tofu Mentai Emulsion',
    formulaNameId: 'Racikan Mentai Tahu Rendah Kalori',
    healthBenefitEn: 'Replaces heavy starch with silken tofu & sweet carrot while boosting protein ratio.',
    healthBenefitId: 'Mengganti pati dengan tahu lembut & wortel manis sekaligus memperkaya protein.',
    newBaseQuality: 90,
    newProductionTimeSec: 58,
    newShelfLifeDays: 3,
    newIngredients: [
      { ingredientId: 'chicken', quantity: 70 },
      { ingredientId: 'carrot', quantity: 50 },
      { ingredientId: 'tofu', quantity: 45 },
      { ingredientId: 'wrapper', quantity: 10 },
      { ingredientId: 'garlic', quantity: 6 },
      { ingredientId: 'tapioca', quantity: 10 },
      { ingredientId: 'seasoning', quantity: 3 },
    ],
  },
  {
    recipeId: 'kuotie_panggang',
    researchCost: 34_000,
    formulaNameEn: 'Steam-Crisp Herb Kuotie Blend',
    formulaNameId: 'Racikan Kuotie Panggang Hemat Garam',
    healthBenefitEn: 'Adds beta-carotene carrot & halves sodium/tapioca for lighter pan-seared crispness.',
    healthBenefitId: 'Menambah wortel segar serta memangkas garam & tapioka untuk tekstur lebih ringan.',
    newBaseQuality: 88,
    newProductionTimeSec: 54,
    newShelfLifeDays: 3,
    newIngredients: [
      { ingredientId: 'chicken', quantity: 65 },
      { ingredientId: 'spinach', quantity: 45 },
      { ingredientId: 'carrot', quantity: 35 },
      { ingredientId: 'garlic', quantity: 8 },
      { ingredientId: 'wrapper', quantity: 10 },
      { ingredientId: 'tapioca', quantity: 12 },
      { ingredientId: 'seasoning', quantity: 2 },
    ],
  },
  {
    recipeId: 'lumpia_tahu',
    researchCost: 26_000,
    formulaNameEn: 'Golden Fiber Tofu Skin Wrap',
    formulaNameId: 'Racikan Lumpia Tahu Kaya Serat',
    healthBenefitEn: 'Balances sweet carrot and organic tofu with 50% less starch & longer 4-day freshness.',
    healthBenefitId: 'Menyeimbangkan wortel & tahu organik dengan 50% lebih sedikit tepung & tahan 4 hari.',
    newBaseQuality: 86,
    newProductionTimeSec: 46,
    newShelfLifeDays: 4,
    newIngredients: [
      { ingredientId: 'tofu', quantity: 75 },
      { ingredientId: 'carrot', quantity: 55 },
      { ingredientId: 'mushroom', quantity: 30 },
      { ingredientId: 'garlic', quantity: 6 },
      { ingredientId: 'wrapper', quantity: 10 },
      { ingredientId: 'tapioca', quantity: 10 },
      { ingredientId: 'seasoning', quantity: 2 },
    ],
  },
  {
    recipeId: 'hakau_bayam',
    researchCost: 45_000,
    formulaNameEn: 'Emerald Silken Shrimp Hakau',
    formulaNameId: 'Racikan Hakau Bayam Udang Sutra',
    healthBenefitEn: 'Enriches bouncy seafood filling with silken tofu & carrot while cutting wrapper starch.',
    healthBenefitId: 'Memperkaya isian udang kenyal dengan tahu sutra & wortel serta mengurangi pati.',
    newBaseQuality: 93,
    newProductionTimeSec: 65,
    newShelfLifeDays: 3,
    newIngredients: [
      { ingredientId: 'shrimp', quantity: 75 },
      { ingredientId: 'tofu', quantity: 30 },
      { ingredientId: 'spinach', quantity: 40 },
      { ingredientId: 'carrot', quantity: 35 },
      { ingredientId: 'wrapper', quantity: 10 },
      { ingredientId: 'tapioca', quantity: 14 },
      { ingredientId: 'seasoning', quantity: 2 },
    ],
  },
  {
    recipeId: 'bakpao_gandum',
    researchCost: 42_000,
    formulaNameEn: 'Prebiotic Whole-Grain Herb Bun',
    formulaNameId: 'Racikan Bakpao Gandum Prebiotik',
    healthBenefitEn: 'Replaces refined tapioca with crisp carrot & mushrooms for high prebiotic fiber.',
    healthBenefitId: 'Mengganti tepung tapioka dengan wortel renyah & jamur kaya serat prebiotik.',
    newBaseQuality: 92,
    newProductionTimeSec: 60,
    newShelfLifeDays: 4,
    newIngredients: [
      { ingredientId: 'tofu', quantity: 70 },
      { ingredientId: 'mushroom', quantity: 40 },
      { ingredientId: 'broccoli', quantity: 30 },
      { ingredientId: 'carrot', quantity: 40 },
      { ingredientId: 'wrapper', quantity: 10 },
      { ingredientId: 'tapioca', quantity: 12 },
      { ingredientId: 'seasoning', quantity: 2 },
    ],
  },
];

export function getRecipeResearchDef(recipeId: string): RecipeResearchDef | undefined {
  return RECIPE_RESEARCH_DEFS.find((r) => r.recipeId === recipeId);
}

export const DAILY_EVENTS: DailyEventDef[] = [
  {
    id: 'food_critic',
    kind: 'positive',
    titleEn: 'Food Critic Visiting',
    titleId: 'Kritikus Kuliner Berkunjung',
    descriptionEn: 'A culinary columnist is dining today! Orders pay +20% revenue and happy guests grant +1 extra Shop Reputation.',
    descriptionId: 'Kolumnis kuliner mencicipi menu hari ini! Omzet pesanan +20% dan pelanggan puas beri +1 Reputasi ekstra.',
    impactTagEn: '+20% Rev · +1 Rep/sale',
    impactTagId: '+20% Omzet · +1 Rep/jual',
    revenueMultiplier: 1.2,
    reputationOnStart: 0,
    reputationDeltaPerSale: 1,
    reputationPenaltyLowSat: 0,
    steamScoreDelta: 0,
    trafficMultiplier: 1.1,
  },
  {
    id: 'office_lunch_boom',
    kind: 'positive',
    titleEn: 'Neighborhood Office Rush',
    titleId: 'Ramai Pesanan Kantor',
    descriptionEn: 'Nearby teams ordered healthy dimsum lunches! +15% order revenue and +25% customer traffic today.',
    descriptionId: 'Kantor sekitar memesan makan siang sehat! Omzet pesanan +15% dan arus tamu +25% hari ini.',
    impactTagEn: '+15% Rev · +25% Traffic',
    impactTagId: '+15% Omzet · +25% Tamu',
    revenueMultiplier: 1.15,
    reputationOnStart: 1,
    reputationDeltaPerSale: 0,
    reputationPenaltyLowSat: 0,
    steamScoreDelta: 0,
    trafficMultiplier: 1.25,
  },
  {
    id: 'wellness_spotlight',
    kind: 'positive',
    titleEn: 'Local Wellness Spotlight',
    titleId: 'Liputan Kuliner Sehat',
    descriptionEn: 'Your clean-label dimsum was featured online! +3 Shop Reputation now and +10% revenue per order.',
    descriptionId: 'Dimsum sehatmu diliput media lokal! +3 Reputasi Toko sekarang dan +10% omzet per pesanan.',
    impactTagEn: '+3 Rep · +10% Rev',
    impactTagId: '+3 Rep · +10% Omzet',
    revenueMultiplier: 1.1,
    reputationOnStart: 3,
    reputationDeltaPerSale: 1,
    reputationPenaltyLowSat: 0,
    steamScoreDelta: 0,
    trafficMultiplier: 1.15,
  },
  {
    id: 'steamer_malfunction',
    kind: 'negative',
    titleEn: 'Steamer Malfunction',
    titleId: 'Kukusan Bermasalah',
    descriptionEn: 'Pressure drops in the bamboo steamer valve (-8 Steam QC score, -10% revenue, -2 Shop Reputation).',
    descriptionId: 'Tekanan uap kukusan menurun hari ini (-8 skor QC Kukus, -10% omzet, -2 Reputasi Toko).',
    impactTagEn: '-8 Steam QC · -10% Rev · -2 Rep',
    impactTagId: '-8 Kukus · -10% Omzet · -2 Rep',
    revenueMultiplier: 0.9,
    reputationOnStart: -2,
    reputationDeltaPerSale: 0,
    reputationPenaltyLowSat: 0,
    steamScoreDelta: -8,
    trafficMultiplier: 0.95,
  },
  {
    id: 'monsoon_downpour',
    kind: 'negative',
    titleEn: 'Monsoon Downpour',
    titleId: 'Hujan Deras Sepanjang Hari',
    descriptionEn: 'Heavy rain slows street walk-ins (-15% order revenue and -20% customer traffic today).',
    descriptionId: 'Hujan lebat mengurangi pengunjung langsung (-15% omzet pesanan dan -20% arus tamu hari ini).',
    impactTagEn: '-15% Rev · -20% Traffic',
    impactTagId: '-15% Omzet · -20% Tamu',
    revenueMultiplier: 0.85,
    reputationOnStart: 0,
    reputationDeltaPerSale: 0,
    reputationPenaltyLowSat: 0,
    steamScoreDelta: 0,
    trafficMultiplier: 0.8,
  },
  {
    id: 'strict_hygiene_audit',
    kind: 'negative',
    titleEn: 'Strict Kitchen Audit',
    titleId: 'Inspeksi Dapur Ketat',
    descriptionEn: 'Expectations are extra strict today (-2 Rep start, -1 extra Rep on <75% satisfaction orders, -5% revenue).',
    descriptionId: 'Standar pelanggan ekstra ketat hari ini (-2 Rep awal, -1 Rep tambahan jika kepuasan <75%, -5% omzet).',
    impactTagEn: '-2 Rep · Strict QC · -5% Rev',
    impactTagId: '-2 Rep · Standar Ketat · -5% Omzet',
    revenueMultiplier: 0.95,
    reputationOnStart: -2,
    reputationDeltaPerSale: 0,
    reputationPenaltyLowSat: -1,
    steamScoreDelta: -4,
    trafficMultiplier: 0.9,
  },
];

export function pickDailyShopEvent(
  _day: number,
  previousEventId?: string | null,
  rng: () => number = Math.random,
): DailyEventDef {
  const candidates =
    previousEventId && DAILY_EVENTS.length > 1
      ? DAILY_EVENTS.filter((e) => e.id !== previousEventId)
      : DAILY_EVENTS;
  const idx = Math.min(candidates.length - 1, Math.floor(rng() * candidates.length));
  return candidates[idx];
}

export function applyDailyEventRevenue(
  baseTotal: number,
  event: DailyEventDef | null | undefined,
): number {
  if (!event || event.revenueMultiplier === 1) return Math.round(baseTotal);
  const adjusted = Math.round((baseTotal * event.revenueMultiplier) / 100) * 100;
  return Math.max(0, adjusted);
}

export function applyDailyEventReputationDelta(
  baseDelta: number,
  satisfaction: number,
  event: DailyEventDef | null | undefined,
): number {
  if (!event) return baseDelta;
  let extra = 0;
  if (satisfaction >= 70) {
    extra += event.reputationDeltaPerSale;
  } else if (satisfaction < 75) {
    extra += event.reputationPenaltyLowSat;
  }
  return baseDelta + extra;
}

export function formatRupiah(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  return `${sign}Rp${abs.toLocaleString('id-ID')}`;
}

/* -------------------------------------------------------------------------- */
/* P2: Weekly Culinary Festivals, Rival Shop, Outlet Tiers & Franchise Mode   */
/* -------------------------------------------------------------------------- */

export const WEEKLY_FESTIVALS: WeeklyFestivalDef[] = [
  {
    id: 'shrimp_fest',
    titleEn: 'Fresh Shrimp Culinary Week',
    titleId: 'Pekan Udang Segar Nusantara',
    descriptionEn:
      'Neighborhood seafood lovers flock for bouncy fresh-shrimp dimsum! 2x customer traffic & +15% revenue on featured shrimp dishes.',
    descriptionId:
      'Pecinta kuliner laut menyerbu menu udang segar! Lonjakan trafik tamu 2x & +15% omzet untuk hidangan bertema udang.',
    themeHintEn: 'Shrimp Vegetable Dimsum & Emerald Spinach Hakau',
    themeHintId: 'Dimsum Udang Sayur & Hakau Bayam Udang',
    targetRecipeIds: ['shrimp_veg', 'hakau_bayam'],
    trafficMultiplier: 2.0,
    revenueMultiplier: 1.15,
  },
  {
    id: 'plant_based_week',
    titleEn: 'Green Plant-Based Week',
    titleId: 'Minggu Plant-Based & Serat Sehat',
    descriptionEn:
      'Local wellness communities celebrate plant-forward bowls! 2x traffic & +15% revenue on vegetarian dimsum.',
    descriptionId:
      'Komunitas gaya hidup sehat merayakan menu nabati! Trafik tamu 2x & +15% omzet untuk semua varian vegetarian.',
    themeHintEn: 'All Vegetarian Recipes (Tofu, Rainbow, Lumpia, Whole-Wheat)',
    themeHintId: 'Semua Menu Vegetarian (Tahu, Pelangi, Lumpia, Bakpao Gandum)',
    targetRecipeIds: ['tofu_mushroom', 'rainbow_veggie', 'lumpia_tahu', 'bakpao_gandum'],
    trafficMultiplier: 2.0,
    revenueMultiplier: 1.15,
  },
  {
    id: 'family_bazaar',
    titleEn: 'Neighborhood Family Feast Bazaar',
    titleId: 'Bazar Kuliner Keluarga Sehat',
    descriptionEn:
      'Weekend family street fair brings hungry crowds! 2x traffic & +15% revenue on savory chicken & grilled favorites.',
    descriptionId:
      'Bazar keluarga akhir pekan memicu keramaian! Trafik 2x & +15% omzet untuk menu ayam & panggang favorit keluarga.',
    themeHintEn: 'Chicken Carrot, Low-Fat Mentai & Herb Kuotie',
    themeHintId: 'Dimsum Ayam Wortel, Mentai Rendah Lemak & Kuotie Panggang',
    targetRecipeIds: ['chicken_carrot', 'mentai_chicken', 'kuotie_panggang'],
    trafficMultiplier: 2.0,
    revenueMultiplier: 1.15,
  },
];

export function isFestivalDay(day: number): boolean {
  return day >= 7 && day % 7 === 0;
}

export function getWeeklyFestivalForDay(day: number): WeeklyFestivalDef | null {
  if (!isFestivalDay(day)) return null;
  const cycleIndex = (Math.floor(day / 7) - 1) % WEEKLY_FESTIVALS.length;
  return WEEKLY_FESTIVALS[Math.max(0, cycleIndex)];
}

export function getNextUpcomingFestival(day: number): {
  daysUntil: number;
  festival: WeeklyFestivalDef;
  festivalDay: number;
} {
  const safeDay = Math.max(1, Math.floor(day));
  const rem = safeDay % 7;
  const daysUntil = rem === 0 ? 0 : 7 - rem;
  const festivalDay = safeDay + daysUntil;
  const festival = getWeeklyFestivalForDay(festivalDay) ?? WEEKLY_FESTIVALS[0];
  return { daysUntil, festival, festivalDay };
}

export function doesRecipeMatchFestival(
  recipe: Pick<RecipeDef, 'id' | 'isVegetarian'>,
  festival: WeeklyFestivalDef | null | undefined,
): boolean {
  if (!festival) return false;
  if (festival.targetRecipeIds.includes(recipe.id)) return true;
  if (festival.id === 'plant_based_week' && recipe.isVegetarian) return true;
  return false;
}

export const RIVAL_SHOP_NAME = 'Kedai Naga Sehat';

export const RIVAL_FOCUS_ROTATIONS: Array<{
  specialtyEn: string;
  specialtyId: string;
  focusIngredientIds: string[];
  trendingRecipeIds: string[];
}> = [
  {
    specialtyEn: 'Fresh Shrimp & Crispy Greens Campaign',
    specialtyId: 'Promo Dimsum Udang & Brokoli',
    focusIngredientIds: ['shrimp', 'broccoli'],
    trendingRecipeIds: ['shrimp_veg', 'hakau_bayam'],
  },
  {
    specialtyEn: 'Savory Chicken & Mentai Fusion Push',
    specialtyId: 'Kampanye Ayam & Mentai Populer',
    focusIngredientIds: ['chicken', 'carrot'],
    trendingRecipeIds: ['chicken_carrot', 'mentai_chicken', 'kuotie_panggang'],
  },
  {
    specialtyEn: 'Urban Plant-Based & Shiitake Craze',
    specialtyId: 'Tren Nabati & Jamur Shiitake',
    focusIngredientIds: ['tofu', 'mushroom'],
    trendingRecipeIds: ['tofu_mushroom', 'lumpia_tahu', 'rainbow_veggie'],
  },
];

export function createInitialRivalShop(): RivalShopState {
  const rot = RIVAL_FOCUS_ROTATIONS[0];
  return {
    name: RIVAL_SHOP_NAME,
    specialtyEn: rot.specialtyEn,
    specialtyId: rot.specialtyId,
    focusIngredientIds: [...rot.focusIngredientIds],
    trendingRecipeIds: [...rot.trendingRecipeIds],
    pricePressureMultiplier: 1.15,
    marketSharePct: 35,
    strengthScore: 55,
    lastUpdatedDay: 1,
  };
}

export function advanceRivalShopState(
  prev: RivalShopState | undefined,
  day: number,
  researchedCount: number,
  playerReputation: number,
): RivalShopState {
  const base = prev ?? createInitialRivalShop();
  const rotIdx = Math.floor(Math.max(0, day - 1) / 3) % RIVAL_FOCUS_ROTATIONS.length;
  const rot = RIVAL_FOCUS_ROTATIONS[rotIdx];

  // Player R&D innovation and strong Shop Reputation erode rival share
  const rdEdge = researchedCount * 3;
  const repEdge = Math.round((playerReputation - 60) * 0.2);
  const playerEdge = rdEdge + repEdge;

  let shareDelta = 0;
  if (playerEdge >= 6) shareDelta = -3;
  else if (playerEdge >= 2) shareDelta = -1;
  else if (playerEdge <= -3) shareDelta = 2;

  const nextMarketShare = Math.max(15, Math.min(60, base.marketSharePct + shareDelta));
  const nextStrength = Math.max(
    40,
    Math.min(92, Math.round(52 + Math.min(20, day * 1.5) - researchedCount * 2)),
  );

  return {
    name: base.name || RIVAL_SHOP_NAME,
    specialtyEn: rot.specialtyEn,
    specialtyId: rot.specialtyId,
    focusIngredientIds: [...rot.focusIngredientIds],
    trendingRecipeIds: [...rot.trendingRecipeIds],
    pricePressureMultiplier: 1.15,
    marketSharePct: nextMarketShare,
    strengthScore: nextStrength,
    lastUpdatedDay: day,
  };
}

export const OUTLET_TIERS: OutletTierDef[] = [
  {
    level: 1,
    nameEn: 'Starter Street Cart',
    nameId: 'Gerobak Rintisan',
    minReputation: 0,
    minNetWorth: 0,
    perksEn: 'Neighborhood street cart serving takeaway & 2 cozy tables.',
    perksId: 'Gerobak awal melayani bawa pulang & 2 meja dine-in hangat.',
  },
  {
    level: 2,
    nameEn: 'Corner Shophouse Kiosk',
    nameId: 'Kios Ruko',
    minReputation: 58,
    minNetWorth: 300_000,
    perksEn: 'Established street presence, higher daily targets & Campus B2B readiness.',
    perksId: 'Kehadiran ruko mapan, target harian meningkat & siap kontrak Kampus B2B.',
  },
  {
    level: 3,
    nameEn: 'Healthy Bistro',
    nameId: 'Bistro Sehat',
    minReputation: 68,
    minNetWorth: 650_000,
    perksEn: 'Unlocks first passive Franchise Branch expansion & bistro dining flow.',
    perksId: 'Membuka ekspansi Cabang Waralaba pasif pertama & layanan bistro penuh.',
  },
  {
    level: 4,
    nameEn: 'Flagship Restaurant',
    nameId: 'Restoran Utama',
    minReputation: 78,
    minNetWorth: 1_100_000,
    perksEn: 'Multi-district franchise expansion & strong competitive edge over rivals.',
    perksId: 'Ekspansi waralaba lintas distrik & keunggulan daya saing melawan kedai rival.',
  },
  {
    level: 5,
    nameEn: 'Franchise Network',
    nameId: 'Jaringan Waralaba',
    minReputation: 85,
    minNetWorth: 1_800_000,
    perksEn: 'Unlocks Endless Mastery Mode & +15% prestige royalty multipliers per rank.',
    perksId: 'Membuka Mode Endless Mastery & pengali royalti cabang +15% per peringkat.',
  },
];

export function getOutletTierDef(businessLevel: number): OutletTierDef {
  const safeLevel = Math.max(1, Math.floor(businessLevel));
  const found = [...OUTLET_TIERS].reverse().find((t) => safeLevel >= t.level);
  return found ?? OUTLET_TIERS[0];
}

export const FRANCHISE_BRANCH_TEMPLATES: FranchiseBranchTemplate[] = [
  {
    id: 'bsd_kiosk',
    districtNameEn: 'BSD Wellness Kiosk',
    districtNameId: 'Kios Sehat BSD',
    investmentCost: 220_000,
    baseDailyIncome: 24_000,
    minBusinessLevel: 3,
    minReputation: 65,
    descriptionEn: 'Morning commuter healthy express kiosk generating daily passive royalties.',
    descriptionId: 'Kios sehat komuter pagi yang menyetor royalti pasif harian otomatis.',
  },
  {
    id: 'senopati_express',
    districtNameEn: 'Senopati Express Booth',
    districtNameId: 'Gerai Ekspres Senopati',
    investmentCost: 360_000,
    baseDailyIncome: 42_000,
    minBusinessLevel: 4,
    minReputation: 74,
    descriptionEn: 'High-footfall office district booth with strong Ojol & lunch box volume.',
    descriptionId: 'Gerai kawasan perkantoran ramai dengan volume makan siang & ojol tinggi.',
  },
  {
    id: 'bandung_bistro',
    districtNameEn: 'Bandung Eco Bistro',
    districtNameId: 'Bistro Eco Bandung',
    investmentCost: 540_000,
    baseDailyIncome: 68_000,
    minBusinessLevel: 4,
    minReputation: 80,
    descriptionEn: 'Destination healthy bistro sourcing Highland Greens directly from Lembang.',
    descriptionId: 'Bistro destinasi sehat yang bermitra langsung dengan kebun Lembang.',
  },
  {
    id: 'surabaya_hub',
    districtNameEn: 'Surabaya Artisan Hub',
    districtNameId: 'Pusat Artisan Surabaya',
    investmentCost: 780_000,
    baseDailyIncome: 105_000,
    minBusinessLevel: 5,
    minReputation: 86,
    descriptionEn: 'Regional flagship culinary kitchen powering Eastern Java franchise royalties.',
    descriptionId: 'Dapur utama regional penggerak jaringan waralaba Jawa Timur.',
  },
];

export function getFranchiseBranchTemplate(id: string): FranchiseBranchTemplate | undefined {
  return FRANCHISE_BRANCH_TEMPLATES.find((b) => b.id === id);
}

export function getFranchiseBranchUpgradeCost(branch: FranchiseBranch): number | null {
  if (branch.level >= 3) return null;
  return Math.round((branch.investmentCost * 0.45 * branch.level) / 1000) * 1000;
}

export function computeTotalFranchiseDailyIncome(
  branches: FranchiseBranch[] = [],
  prestigeLevel = 0,
): number {
  const prestigeMult = 1 + Math.max(0, prestigeLevel) * 0.15;
  return branches.reduce(
    (sum, b) => sum + Math.round(b.dailyNetIncome * prestigeMult),
    0,
  );
}

