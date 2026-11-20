import { INITIAL_RECIPES, formatRupiah } from '../config/gameBalance';
import type {
  DailyMission,
  DailyMissionType,
  RecipeDef,
  UpgradeLevels,
} from '../types/game';

export const DAILY_MISSIONS_COUNT = 3;

export type DailyMissionEvent =
  | {
      type: 'COOK_QC';
      pcsProduced: number;
      qualityScore: number;
      passedQc: boolean;
    }
  | {
      type: 'PACKAGE';
      boxesPackaged: number;
    }
  | {
      type: 'SALE';
      recipeId: string;
      pcsSold: number;
      boxesSold: number;
      revenueAmount: number;
      orderType: 'DIRECT' | 'PRE_ORDER' | 'ONLINE_DELIVERY';
    };

export interface GenerateDailyMissionsParams {
  day: number;
  businessLevel: number;
  recipes: RecipeDef[];
  upgrades?: Partial<UpgradeLevels>;
  rng?: () => number;
}

const MISSION_TYPES: DailyMissionType[] = [
  'SELL_RECIPE_PCS',
  'PRODUCE_PCS',
  'HIGH_QC_BATCH',
  'PACKAGE_BOXES',
  'SERVE_CUSTOMERS',
  'EARN_REVENUE',
  'SERVE_DELIVERY_OR_B2B',
];

function pickRandomItem<T>(items: T[], rng: () => number): T {
  const idx = Math.min(items.length - 1, Math.max(0, Math.floor(rng() * items.length)));
  return items[idx];
}

function shuffleWithRng<T>(items: readonly T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildMissionForType(
  type: DailyMissionType,
  params: {
    day: number;
    businessLevel: number;
    steamerLevel: number;
    unlockedRecipes: RecipeDef[];
    rng: () => number;
  },
): DailyMission {
  const level = Math.max(1, Math.floor(params.businessLevel));
  const steamer = Math.max(1, Math.floor(params.steamerLevel));
  const id = `dm-d${params.day}-${type.toLowerCase()}`;

  switch (type) {
    case 'SELL_RECIPE_PCS': {
      const recipe = pickRandomItem(params.unlockedRecipes, params.rng);
      const tierOptions =
        level >= 3 || steamer >= 3
          ? [40, 50, 60]
          : level >= 2 || steamer >= 2
            ? [30, 40, 50]
            : [20, 30, 50];
      const target = pickRandomItem(tierOptions, params.rng);
      const rewardCash = 12_000 + Math.round((target / 10) * 4_500);
      return {
        id,
        day: params.day,
        type,
        recipeId: recipe.id,
        titleEn: `Sell ${target} ${recipe.nameEn}`,
        titleId: `Jual ${target} ${recipe.nameId}`,
        descriptionEn: `Sell ${target} pcs of ${recipe.nameEn} across walk-in, dine-in, B2B, or delivery orders.`,
        descriptionId: `Jual ${target} pcs ${recipe.nameId} lewat kasir, dine-in, B2B, atau kurir online.`,
        target,
        current: 0,
        completed: false,
        claimed: false,
        rewardCash,
        unitLabelEn: 'pcs',
        unitLabelId: 'pcs',
      };
    }

    case 'PRODUCE_PCS': {
      const tierOptions =
        level >= 3 || steamer >= 3
          ? [40, 50, 60]
          : level >= 2 || steamer >= 2
            ? [30, 40, 50]
            : [20, 30, 40];
      const target = pickRandomItem(tierOptions, params.rng);
      const rewardCash = 10_000 + Math.round((target / 10) * 3_500);
      return {
        id,
        day: params.day,
        type,
        titleEn: `Steam ${target} Dimsum Pcs`,
        titleId: `Kukus ${target} Pcs Dimsum`,
        descriptionEn: `Complete cooking batches totaling ${target} dimsum pieces today.`,
        descriptionId: `Selesaikan proses masak hingga terkumpul ${target} pcs dimsum hari ini.`,
        target,
        current: 0,
        completed: false,
        claimed: false,
        rewardCash,
        unitLabelEn: 'pcs',
        unitLabelId: 'pcs',
      };
    }

    case 'HIGH_QC_BATCH': {
      const minQualityScore = level >= 3 ? 88 : 85;
      const target = level >= 2 && params.rng() >= 0.45 ? 2 : 1;
      const rewardCash = target === 1 ? 15_000 : 26_000;
      return {
        id,
        day: params.day,
        type,
        minQualityScore,
        titleEn: `Chef Craft: ${target} Batch QC ≥ ${minQualityScore}`,
        titleId: `Kualitas Prima: ${target} Batch QC ≥ ${minQualityScore}`,
        descriptionEn: `Finish ${target} steamed batch(es) with a Quality Control score of at least ${minQualityScore}/100.`,
        descriptionId: `Selesaikan ${target} batch kukusan dengan skor Quality Control minimal ${minQualityScore}/100.`,
        target,
        current: 0,
        completed: false,
        claimed: false,
        rewardCash,
        unitLabelEn: target === 1 ? 'batch' : 'batches',
        unitLabelId: 'batch',
      };
    }

    case 'PACKAGE_BOXES': {
      const tierOptions = level >= 3 ? [8, 10, 12] : level >= 2 ? [6, 8, 10] : [4, 6, 8];
      const target = pickRandomItem(tierOptions, params.rng);
      const rewardCash = 10_000 + target * 1_500;
      return {
        id,
        day: params.day,
        type,
        titleEn: `Pack ${target} Fresh Boxes`,
        titleId: `Kemas ${target} Kotak Siap Jual`,
        descriptionEn: `Package ${target} boxes of passed dimsum at the Packaging Bench today.`,
        descriptionId: `Kemas ${target} kotak dimsum lolos QC di Meja Pengemasan hari ini.`,
        target,
        current: 0,
        completed: false,
        claimed: false,
        rewardCash,
        unitLabelEn: 'boxes',
        unitLabelId: 'kotak',
      };
    }

    case 'SERVE_CUSTOMERS': {
      const tierOptions = level >= 3 ? [7, 9, 12] : level >= 2 ? [5, 7, 8] : [3, 5, 6];
      const target = pickRandomItem(tierOptions, params.rng);
      const rewardCash = 10_000 + target * 2_500;
      return {
        id,
        day: params.day,
        type,
        titleEn: `Serve ${target} Orders Today`,
        titleId: `Layani ${target} Pesanan Hari Ini`,
        descriptionEn: `Complete ${target} customer orders via walk-in counter, dine-in, online delivery, or B2B.`,
        descriptionId: `Selesaikan ${target} pesanan pelanggan lewat kasir, dine-in, kurir online, atau B2B.`,
        target,
        current: 0,
        completed: false,
        claimed: false,
        rewardCash,
        unitLabelEn: 'orders',
        unitLabelId: 'pesanan',
      };
    }

    case 'EARN_REVENUE': {
      const target =
        level >= 3
          ? pickRandomItem([140_000, 180_000, 220_000], params.rng)
          : level >= 2
            ? pickRandomItem([90_000, 120_000, 150_000], params.rng)
            : pickRandomItem([50_000, 75_000, 100_000], params.rng);
      const rewardCash = Math.round((target * 0.22) / 1_000) * 1_000;
      return {
        id,
        day: params.day,
        type,
        titleEn: `Earn ${formatRupiah(target)} Sales`,
        titleId: `Raih Omzet ${formatRupiah(target)}`,
        descriptionEn: `Collect ${formatRupiah(target)} in total sales revenue during Day ${params.day}.`,
        descriptionId: `Kumpulkan total pendapatan penjualan sebesar ${formatRupiah(target)} pada Hari ${params.day}.`,
        target,
        current: 0,
        completed: false,
        claimed: false,
        rewardCash,
        unitLabelEn: 'Rp',
        unitLabelId: 'Rp',
      };
    }

    case 'SERVE_DELIVERY_OR_B2B': {
      const target = level >= 2 && params.rng() >= 0.4 ? 2 : 1;
      const rewardCash = target === 1 ? 16_000 : 28_000;
      return {
        id,
        day: params.day,
        type,
        titleEn: `Dispatch ${target} Delivery / B2B Order${target > 1 ? 's' : ''}`,
        titleId: `Kirim ${target} Pesanan Ojol / B2B`,
        descriptionEn: `Fulfill ${target} GoFood/GrabFood/ShopeeFood delivery or wholesale B2B contract(s) today.`,
        descriptionId: `Penuhi ${target} pesanan kurir online (Ojol) atau kontrak B2B hari ini.`,
        target,
        current: 0,
        completed: false,
        claimed: false,
        rewardCash,
        unitLabelEn: target === 1 ? 'order' : 'orders',
        unitLabelId: 'pesanan',
      };
    }
  }
}

export function generateDailyMissions(
  params: GenerateDailyMissionsParams,
): DailyMission[] {
  const rng = params.rng ?? Math.random;
  const unlockedRecipes = params.recipes.filter((r) => r.unlocked);
  const safeUnlocked =
    unlockedRecipes.length > 0 ? unlockedRecipes : [INITIAL_RECIPES[0]];
  const steamerLevel = params.upgrades?.steamer ?? 1;

  const shuffledTypes = shuffleWithRng(MISSION_TYPES, rng);
  const chosenTypes = shuffledTypes.slice(0, DAILY_MISSIONS_COUNT);

  return chosenTypes.map((type) =>
    buildMissionForType(type, {
      day: Math.max(1, Math.floor(params.day)),
      businessLevel: params.businessLevel,
      steamerLevel,
      unlockedRecipes: safeUnlocked,
      rng,
    }),
  );
}

export function applyDailyMissionProgress(
  missions: DailyMission[],
  event: DailyMissionEvent,
): {
  missions: DailyMission[];
  newlyCompleted: DailyMission[];
} {
  const newlyCompleted: DailyMission[] = [];

  const nextMissions = missions.map((mission) => {
    if (mission.completed) return mission;

    let delta = 0;

    if (event.type === 'COOK_QC') {
      if (mission.type === 'PRODUCE_PCS') {
        delta = Math.max(0, Math.round(event.pcsProduced));
      } else if (mission.type === 'HIGH_QC_BATCH') {
        const minScore = mission.minQualityScore ?? 85;
        if (event.passedQc && event.qualityScore >= minScore) {
          delta = 1;
        }
      }
    } else if (event.type === 'PACKAGE') {
      if (mission.type === 'PACKAGE_BOXES') {
        delta = Math.max(0, Math.round(event.boxesPackaged));
      }
    } else if (event.type === 'SALE') {
      if (
        mission.type === 'SELL_RECIPE_PCS' &&
        mission.recipeId === event.recipeId
      ) {
        delta = Math.max(0, Math.round(event.pcsSold));
      } else if (mission.type === 'SERVE_CUSTOMERS') {
        delta = 1;
      } else if (mission.type === 'EARN_REVENUE') {
        delta = Math.max(0, Math.round(event.revenueAmount));
      } else if (
        mission.type === 'SERVE_DELIVERY_OR_B2B' &&
        (event.orderType === 'ONLINE_DELIVERY' || event.orderType === 'PRE_ORDER')
      ) {
        delta = 1;
      }
    }

    if (delta <= 0) return mission;

    const nextCurrent = Math.min(mission.target, mission.current + delta);
    const nextCompleted = nextCurrent >= mission.target;
    const updated: DailyMission = {
      ...mission,
      current: nextCurrent,
      completed: nextCompleted,
    };

    if (nextCompleted && !mission.completed) {
      newlyCompleted.push(updated);
    }
    return updated;
  });

  return { missions: nextMissions, newlyCompleted };
}

export function claimDailyMissionReward(
  missions: DailyMission[],
  missionId: string,
): {
  ok: boolean;
  missions: DailyMission[];
  claimedMission?: DailyMission;
  rewardCash: number;
} {
  const target = missions.find((m) => m.id === missionId);
  if (!target || !target.completed || target.claimed) {
    return {
      ok: false,
      missions,
      rewardCash: 0,
    };
  }

  const claimedMission: DailyMission = {
    ...target,
    claimed: true,
  };

  return {
    ok: true,
    missions: missions.map((m) => (m.id === missionId ? claimedMission : m)),
    claimedMission,
    rewardCash: target.rewardCash,
  };
}
