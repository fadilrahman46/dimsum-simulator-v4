export type Language = 'en' | 'id';

export type GameState =
  | 'MAIN_MENU'
  | 'BUSINESS_SETUP'
  | 'TUTORIAL'
  | 'MORNING_PREP'
  | 'SHOPPING'
  | 'PRODUCTION'
  | 'QUALITY_CONTROL'
  | 'PACKAGING'
  | 'STORE_OPEN'
  | 'CUSTOMER_SERVICE'
  | 'STORE_CLOSING'
  | 'FINANCIAL_REPORT'
  | 'GAME_PAUSED'
  | 'GAME_OVER';

export type StationId =
  | 'market'
  | 'storage'
  | 'prep'
  | 'mixing'
  | 'wrapping'
  | 'steamer'
  | 'packaging'
  | 'cashier'
  | 'board';

export type IngredientCategory = 'protein' | 'vegetable' | 'seasoning' | 'wrapper';

export interface IngredientDef {
  id: string;
  nameEn: string;
  nameId: string;
  category: IngredientCategory;
  unit: 'g' | 'pcs';
  packSize: number; // amount bought per 1 unit in market
  packLabelEn: string;
  packLabelId: string;
  basePackPrice: number; // integer Rupiah per pack
  shelfLifeDays: number;
  supplier: string;
  colorHex: string;
}

export interface IngredientLot {
  id: string;
  ingredientId: string;
  quantityRemaining: number; // in base unit (g or pcs)
  unitCostPerBaseUnit: number; // Rupiah per g or pcs (stored as float or exact integer numerator; we store exact totalCost & initialQty for deterministic FIFO!)
  initialQuantity: number;
  totalLotCost: number; // integer Rupiah
  purchasedDay: number;
  expiryDay: number;
  quality: number; // 0-100
}

export interface MarketEvent {
  id: string;
  titleEn: string;
  titleId: string;
  descriptionEn: string;
  descriptionId: string;
  affectedIngredientIds: string[];
  priceMultiplier: number; // e.g., 1.25 or 0.8
}

export type SupplierRelationshipTier = 'trusted' | 'good' | 'wary' | 'strained';

export interface SupplierRelationshipState {
  supplier: string;
  trust: number; // 0-100
  negotiatedCount: number;
  walkoutCount: number;
  lastNegotiatedDay?: number;
}

export interface ActiveSupplierDeal {
  supplier: string;
  discountRate: number; // e.g. 0.12 = 12% off bulk order
  minPacks: number;
  day: number;
}

export type DailyEventKind = 'positive' | 'negative';

export interface DailyEventDef {
  id: string;
  kind: DailyEventKind;
  titleEn: string;
  titleId: string;
  descriptionEn: string;
  descriptionId: string;
  impactTagEn: string;
  impactTagId: string;
  revenueMultiplier: number;
  reputationOnStart: number;
  reputationDeltaPerSale: number;
  reputationPenaltyLowSat: number;
  steamScoreDelta: number;
  trafficMultiplier: number;
}

export interface RecipeIngredientReq {
  ingredientId: string;
  quantity: number; // per batch
}

export interface RecipeDef {
  id: string;
  nameEn: string;
  nameId: string;
  descriptionEn: string;
  descriptionId: string;
  batchSize: number; // e.g. 10 pcs
  productionTimeSec: number;
  difficulty: 'easy' | 'medium' | 'hard';
  baseQuality: number;
  shelfLifeDays: number;
  isVegetarian: boolean;
  isCustom?: boolean;
  unlocked: boolean;
  researched?: boolean;
  unlockCost?: number;
  accentColor: string;
  ingredients: RecipeIngredientReq[];
}

export interface RecipeResearchDef {
  recipeId: string;
  researchCost: number;
  formulaNameEn: string;
  formulaNameId: string;
  healthBenefitEn: string;
  healthBenefitId: string;
  newBaseQuality: number;
  newProductionTimeSec: number;
  newShelfLifeDays: number;
  newIngredients: RecipeIngredientReq[];
}

export type QualityStatus =
  | 'DRAFT'
  | 'PROCESSING'
  | 'QC_PASSED'
  | 'QC_FAILED'
  | 'PACKAGED'
  | 'SOLD'
  | 'EXPIRED';

export type QualityCategory = 'Excellent' | 'Very Good' | 'Good' | 'Average' | 'Poor';

export interface CookingScores {
  recipeAccuracy: number; // R: 0-100
  mixingQuality: number; // M: 0-100
  wrappingQuality: number; // W: 0-100
  steamingQuality: number; // S: 0-100
  hygieneCompliance: number; // H: 0-100
}

export interface ProductionBatch {
  id: string;
  recipeId: string;
  quantity: number;
  ingredientCost: number; // Ci in integer Rupiah
  operationalCost: number; // Co in integer Rupiah
  laborCost: number; // Cl in integer Rupiah
  scores: CookingScores;
  qualityScore: number; // Q: 0-100
  qualityCategory: QualityCategory;
  status: QualityStatus;
  producedDay: number;
  expiryDay: number;
}

export type PackagingTypeId = 'paper_box' | 'standard_box' | 'family_box';

export interface PackagingTypeDef {
  id: PackagingTypeId;
  nameEn: string;
  nameId: string;
  capacity: number; // pcs per box
  costPerBox: number; // integer Rupiah
  colorHex: string;
}

export interface ProductBatch {
  id: string;
  productionBatchId: string;
  recipeId: string;
  packagingTypeId: PackagingTypeId;
  boxesProduced: number;
  boxesAvailable: number;
  pcsPerBox: number;
  unitCostPerBox: number; // integer Rupiah HPP per box
  sellingPricePerBox: number; // integer Rupiah SP per box
  originalSellingPricePerBox?: number;
  clearanceDiscountPct?: 0 | 25 | 40;
  qualityScore: number;
  status: QualityStatus;
  producedDay: number;
  expiryDay: number;
}

export type CustomerArchetypeId =
  | 'student'
  | 'worker'
  | 'family'
  | 'explorer'
  | 'healthy';

export interface CustomerArchetypeDef {
  id: CustomerArchetypeId;
  nameEn: string;
  nameId: string;
  budgetMin: number;
  budgetMax: number;
  maxPatienceSec: number;
  preferredRecipeIds: string[];
  preferredBoxSize: PackagingTypeId[];
  priorityEn: string;
  priorityId: string;
  shirtColor: string;
}

export type CustomerLifecycle =
  | 'ENTERING'
  | 'BROWSING'
  | 'WAITING_ORDER'
  | 'EATING'
  | 'SERVED'
  | 'LEFT_ANGRY'
  | 'EXITING';

export type DiningMode = 'TAKEAWAY' | 'DINE_IN';

export interface CustomerAgent {
  id: string;
  archetypeId: CustomerArchetypeId;
  name: string;
  requestedRecipeId: string;
  requestedBoxType: PackagingTypeId;
  quantityBoxes: number;
  maxBudget: number;
  patienceMax: number;
  patienceRemaining: number;
  lifecycle: CustomerLifecycle;
  diningMode?: DiningMode;
  tableSlot?: number;
  eatingMaxSec?: number;
  eatingRemainingSec?: number;
  spawnTimeSec: number;
  satisfaction?: number;
  dialogueEn: string;
  dialogueId: string;
  seatSlot: number;
}

export interface CustomerFeedbackPopup {
  id: string;
  customerName: string;
  archetypeId: CustomerArchetypeId;
  recipeNameEn: string;
  recipeNameId: string;
  satisfaction: number;
  ratingStars: 1 | 2 | 3 | 4 | 5;
  sentiment: 'positive' | 'neutral' | 'negative';
  commentEn: string;
  commentId: string;
  reputationDelta: number;
  newReputation: number;
  createdAt: number;
}

export type B2BContractTier = 'community' | 'campus' | 'corporate' | 'partner_cafe';

export interface PreOrderRequest {
  id: string;
  customerName: string;
  archetypeId: CustomerArchetypeId;
  tier?: B2BContractTier;
  minReputation?: number;
  accepted?: boolean;
  penaltyReputation?: number;
  contractStartDay?: number;
  recipeId: string;
  boxType: PackagingTypeId;
  quantityBoxes: number;
  offeredPricePerBox: number;
  dueDay: number;
  fulfilled: boolean;
}

export type DeliveryPlatformId = 'GoFood' | 'GrabFood' | 'ShopeeFood';

export interface OnlineDeliveryOrder {
  id: string;
  platform: DeliveryPlatformId;
  courierName: string;
  recipeId: string;
  boxType: PackagingTypeId;
  quantityBoxes: number;
  grossPricePerBox: number;
  commissionRate: number;
  netPayoutPerBox: number;
  timeRemainingSec: number;
  timeMaxSec: number;
}

export interface SalesOrder {
  id: string;
  customerId: string;
  customerName: string;
  archetypeId: CustomerArchetypeId;
  orderType: 'DIRECT' | 'PRE_ORDER' | 'ONLINE_DELIVERY';
  diningMode?: DiningMode;
  platformName?: DeliveryPlatformId;
  platformCommission?: number;
  productBatchId: string;
  recipeId: string;
  boxType: PackagingTypeId;
  quantityBoxes: number;
  unitPrice: number;
  discount: number;
  totalAmount: number;
  totalCogs: number;
  satisfaction: number;
  isClearance?: boolean;
  day: number;
  timestamp: number;
}

export type TransactionType = 'INCOME' | 'EXPENSE';

export type TransactionCategory =
  | 'INITIAL_CAPITAL'
  | 'INGREDIENT_PURCHASE'
  | 'PACKAGING_PURCHASE'
  | 'SALES_REVENUE'
  | 'OPERATING_EXPENSE'
  | 'UPGRADE_PURCHASE'
  | 'RECIPE_UNLOCK'
  | 'RECIPE_RESEARCH'
  | 'STAFF_EXPENSE'
  | 'GOAL_BONUS'
  | 'DEBT_REPAYMENT'
  | 'BRANCH_EXPANSION'
  | 'FRANCHISE_INCOME';

export interface FinancialTransaction {
  id: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number; // integer Rupiah >= 0
  descriptionEn: string;
  descriptionId: string;
  referenceId: string;
  day: number;
  timestamp: number;
}

export interface DailyReport {
  day: number;
  startingCash: number;
  endingCash: number;
  totalPurchases: number;
  pcsProduced: number;
  boxesPackaged: number;
  boxesSold: number;
  boxesUnsold: number;
  pcsExpired: number;
  inventoryLossValue: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  franchiseIncome?: number;
  netProfit: number;
  avgCustomerSatisfaction: number;
  customersServed: number;
  customersLost: number;
  reputationEnd: number;
}

export type UpgradeId =
  | 'steamer'
  | 'refrigerator'
  | 'prep_table'
  | 'packaging_station'
  | 'decoration'
  | 'dining_seating';

export interface UpgradeLevelDef {
  level: 1 | 2 | 3;
  cost: number;
  capacityValue: number;
  labelEn: string;
  labelId: string;
}

export interface UpgradeDef {
  id: UpgradeId;
  nameEn: string;
  nameId: string;
  descriptionEn: string;
  descriptionId: string;
  levels: UpgradeLevelDef[];
}

export type UpgradeLevels = Record<UpgradeId, 1 | 2 | 3>;

export type CapitalDifficulty = 'easy' | 'medium' | 'hard';

export interface BusinessProfile {
  id: string;
  name: string;
  concept: 'balanced' | 'vegetarian' | 'premium';
  targetMarket: 'general' | 'students' | 'families';
  difficulty?: CapitalDifficulty;
  level: number;
  reputation: number; // 0-100
  createdAt: number;
}

export type FestivalId = 'shrimp_fest' | 'plant_based_week' | 'family_bazaar';

export interface WeeklyFestivalDef {
  id: FestivalId;
  titleEn: string;
  titleId: string;
  descriptionEn: string;
  descriptionId: string;
  themeHintEn: string;
  themeHintId: string;
  targetRecipeIds: string[];
  trafficMultiplier: number; // e.g. 2.0
  revenueMultiplier: number; // e.g. 1.15 on featured dishes
}

export interface RivalShopState {
  name: string;
  specialtyEn: string;
  specialtyId: string;
  focusIngredientIds: string[];
  trendingRecipeIds: string[];
  pricePressureMultiplier: number; // e.g. 1.15 (+15%)
  marketSharePct: number; // 15..60
  strengthScore: number; // 40..95
  lastUpdatedDay: number;
}

export interface OutletTierDef {
  level: number; // 1..5
  nameEn: string;
  nameId: string;
  minReputation: number;
  minNetWorth: number;
  perksEn: string;
  perksId: string;
}

export interface FranchiseBranchTemplate {
  id: string;
  districtNameEn: string;
  districtNameId: string;
  investmentCost: number;
  baseDailyIncome: number;
  minBusinessLevel: number;
  minReputation: number;
  descriptionEn: string;
  descriptionId: string;
}

export interface FranchiseBranch {
  id: string;
  districtNameEn: string;
  districtNameId: string;
  openedDay: number;
  investmentCost: number;
  dailyNetIncome: number;
  level: 1 | 2 | 3;
  managerBonusPct: number;
}

export type AchievementTier = 'bronze' | 'silver' | 'gold';
export type AchievementCategory =
  | 'production'
  | 'sales'
  | 'finance'
  | 'progression'
  | 'service';

export interface AchievementDef {
  id: string;
  titleEn: string;
  titleId: string;
  descriptionEn: string;
  descriptionId: string;
  tier?: AchievementTier;
  category?: AchievementCategory;
}

export interface BonusObjectiveDef {
  id: 'daily_customers' | 'daily_production' | 'serve_50_customers';
  scope: 'daily' | 'milestone';
  titleEn: string;
  titleId: string;
  current: number;
  target: number;
  completed: boolean;
  rewardCash: number;
  referenceId: string;
}

export type DailyMissionType =
  | 'SELL_RECIPE_PCS'
  | 'PRODUCE_PCS'
  | 'HIGH_QC_BATCH'
  | 'PACKAGE_BOXES'
  | 'SERVE_CUSTOMERS'
  | 'EARN_REVENUE'
  | 'SERVE_DELIVERY_OR_B2B';

export interface DailyMission {
  id: string;
  day: number;
  type: DailyMissionType;
  titleEn: string;
  titleId: string;
  descriptionEn: string;
  descriptionId: string;
  recipeId?: string;
  minQualityScore?: number;
  target: number;
  current: number;
  completed: boolean;
  claimed: boolean;
  rewardCash: number;
  unitLabelEn: string;
  unitLabelId: string;
}

export type TutorialStep =
  | 'NONE'
  | 'BUY_INGREDIENTS'
  | 'COOK_BATCH'
  | 'CHECK_QC'
  | 'PACKAGE_DIMSUM'
  | 'OPEN_STORE'
  | 'SERVE_CUSTOMER'
  | 'VIEW_REPORT'
  | 'COMPLETED';

export interface ActiveCookingSession {
  batchId: string;
  recipeId: string;
  batchCount: number; // 1..max based on steamer level
  stage: 'PREP' | 'MIX' | 'WRAP' | 'STEAM';
  ingredientCost: number;
  scores: Partial<CookingScores>;
}

export type KitchenHelperRole = 'prep' | 'mix' | 'wrap' | 'steam';

export interface ActiveDelegatedCooking {
  batchId: string;
  recipeId: string;
  batchCount: number;
  ingredientCost: number;
  scores: CookingScores;
  projectedQualityScore: number;
  assignedHelpers: KitchenHelperRole[];
  startedAt: number;
  durationMs: number;
}

export interface KitchenHelperDef {
  id: KitchenHelperRole;
  name: string;
  roleEn: string;
  roleId: string;
  stage: ActiveCookingSession['stage'];
  hireCost: number;
  dailyWage: number;
  baseTrainCost: number;
  perkSummaryEn: string;
  perkSummaryId: string;
}

export type StaffShiftMode = 'kitchen' | 'wellness';

export type SkillBranch = 'core' | 'speed' | 'precision';

export interface StaffSkillEffects {
  extraPreloadedItems?: number;
  highlightRequiredItems?: boolean;
  fewerDistractors?: number;
  mistakePenaltyMultiplier?: number;
  extraStartMixMatch?: number;
  extraWhiskStep?: number;
  startingStirProgress?: number;
  ratioToleranceBonus?: number;
  extraPreFoldedPleats?: number;
  fewerSamplePieces?: number;
  misclickPenaltyMultiplier?: number;
  steamStabilizationBonus?: number;
  steamSpeedBonusPct?: number;
  startingSteamProgress?: number;
  steamFloorBonus?: number;
  stageQualityBonus?: number;
}

export interface StaffSkillNodeDef {
  id: string;
  role: KitchenHelperRole;
  tier: 1 | 2 | 3;
  branch: SkillBranch;
  prerequisiteId?: string;
  trainingDurationSec: number;
  trainingCost: number;
  titleEn: string;
  titleId: string;
  effectSummaryEn: string;
  effectSummaryId: string;
  effects: StaffSkillEffects;
}

export interface ActiveSkillTraining {
  helperId: KitchenHelperRole;
  nodeId: string;
  startedAt: number;
  durationMs: number;
}

export interface KitchenHelperState {
  id: KitchenHelperRole;
  level: 1 | 2 | 3;
  hiredDay: number;
  morale?: number;
  shift?: StaffShiftMode;
  consecutiveWorkBatches?: number;
  lastWellnessDay?: number;
  lastSkillTrainedDay?: number;
  unlockedSkills?: string[];
  totalTrainingSec?: number;
}

export interface SaveSnapshot {
  version: number;
  savedAt: number;
  gameState: GameState;
  language: Language;
  muted: boolean;
  bgmVolume?: number;
  sfxVolume?: number;
  business: BusinessProfile;
  currentDay: number;
  dayStartCash: number;
  cashBalance: number;
  playerPosition: { x: number; z: number };
  ingredientLots: IngredientLot[];
  packagingStock: Record<PackagingTypeId, number>;
  recipes: RecipeDef[];
  productionBatches: ProductionBatch[];
  productBatches: ProductBatch[];
  preOrders: PreOrderRequest[];
  onlineOrders?: OnlineDeliveryOrder[];
  onlineDeliveryEnabled?: boolean;
  zeroWasteStreakDays?: number;
  salesOrders: SalesOrder[];
  transactions: FinancialTransaction[];
  dailyReports: DailyReport[];
  upgrades: UpgradeLevels;
  kitchenStaff?: KitchenHelperState[];
  activeSkillTraining?: ActiveSkillTraining | null;
  activeDelegation?: ActiveDelegatedCooking | null;
  unpaidDebt?: number;
  researchedRecipeIds?: string[];
  unlockedAchievements: string[];
  tutorialStep: TutorialStep;
  activeMarketEvent: MarketEvent | null;
  activeDailyEvent?: DailyEventDef | null;
  activeFestival?: WeeklyFestivalDef | null;
  rivalShop?: RivalShopState;
  franchiseBranches?: FranchiseBranch[];
  endlessMasteryUnlocked?: boolean;
  prestigeLevel?: number;
  dailyMissions?: DailyMission[];
  supplierRelationships?: Record<string, SupplierRelationshipState>;
  activeSupplierDeals?: Record<string, ActiveSupplierDeal>;
  storeTimeRemainingSec: number;
  todayStats: {
    purchases: number;
    pcsProduced: number;
    boxesPackaged: number;
    pcsExpired: number;
    inventoryLossValue: number;
    qcWastedCost?: number;
    customersServed: number;
    customersLost: number;
    satisfactionSum: number;
  };
}
