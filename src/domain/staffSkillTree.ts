import { getStaffMorale } from '../config/gameBalance';
import type {
  KitchenHelperRole,
  KitchenHelperState,
  StaffSkillEffects,
  StaffSkillNodeDef,
} from '../types/game';

export const SKILL_NODE_COST_BY_TIER: Record<1 | 2 | 3, number> = {
  1: 8_000,
  2: 15_000,
  3: 25_000,
};

export const MIN_MORALE_FOR_SKILL_TRAINING = 35;

export const STAFF_SKILL_TREE: StaffSkillNodeDef[] = [
  // =========================================================================
  // STAGE 1: PREP (Rina Sari)
  // =========================================================================
  {
    id: 'prep_mise_en_place',
    role: 'prep',
    tier: 1,
    branch: 'core',
    trainingDurationSec: 4,
    trainingCost: SKILL_NODE_COST_BY_TIER[1],
    titleEn: 'Mise en Place Drill',
    titleId: 'Latihan Mise en Place',
    effectSummaryEn: 'Pre-loads +1 extra required ingredient into the Prep bowl.',
    effectSummaryId: 'Menyiapkan +1 bahan resep tambahan otomatis ke mangkuk.',
    effects: {
      extraPreloadedItems: 1,
    },
  },
  {
    id: 'prep_knife_speed',
    role: 'prep',
    tier: 2,
    branch: 'speed',
    prerequisiteId: 'prep_mise_en_place',
    trainingDurationSec: 6,
    trainingCost: SKILL_NODE_COST_BY_TIER[2],
    titleEn: 'Station Sorting Focus',
    titleId: 'Fokus Sortir Meja',
    effectSummaryEn: 'Highlights recipe ingredients clearly & removes 1 distractor.',
    effectSummaryId: 'Menandai bahan resep dengan jelas & kurangi 1 pengecoh.',
    effects: {
      highlightRequiredItems: true,
      fewerDistractors: 1,
    },
  },
  {
    id: 'prep_hygiene_seal',
    role: 'prep',
    tier: 2,
    branch: 'precision',
    prerequisiteId: 'prep_mise_en_place',
    trainingDurationSec: 6,
    trainingCost: SKILL_NODE_COST_BY_TIER[2],
    titleEn: 'Clean Cut Precision',
    titleId: 'Presisi Potongan Bersih',
    effectSummaryEn: 'Halves wrong-pick penalty (-6% vs -12%) & +2 Prep QC.',
    effectSummaryId: 'Kurangi penalti salah pilih (-6%) & +2 skor QC Siapkan.',
    effects: {
      mistakePenaltyMultiplier: 0.5,
      stageQualityBonus: 2,
    },
  },
  {
    id: 'prep_auto_station',
    role: 'prep',
    tier: 3,
    branch: 'speed',
    prerequisiteId: 'prep_knife_speed',
    trainingDurationSec: 8,
    trainingCost: SKILL_NODE_COST_BY_TIER[3],
    titleEn: 'Express Prep Flow',
    titleId: 'Alur Persiapan Kilat',
    effectSummaryEn: 'Pre-loads +1 more required item for rapid batch starts.',
    effectSummaryId: 'Menyiapkan +1 bahan lagi secara otomatis untuk mulai cepat.',
    effects: {
      extraPreloadedItems: 1,
    },
  },
  {
    id: 'prep_culinary_prep',
    role: 'prep',
    tier: 3,
    branch: 'precision',
    prerequisiteId: 'prep_hygiene_seal',
    trainingDurationSec: 8,
    trainingCost: SKILL_NODE_COST_BY_TIER[3],
    titleEn: 'Master Ingredient Grading',
    titleId: 'Sortir Kualitas Utama',
    effectSummaryEn: 'Grants +4 Prep QC bonus on every prepared batch.',
    effectSummaryId: 'Memberi bonus +4 QC Siapkan di setiap batch produksi.',
    effects: {
      stageQualityBonus: 4,
    },
  },

  // =========================================================================
  // STAGE 2: MIX (Budi Santoso)
  // =========================================================================
  {
    id: 'mix_balanced_scoop',
    role: 'mix',
    tier: 1,
    branch: 'core',
    trainingDurationSec: 4,
    trainingCost: SKILL_NODE_COST_BY_TIER[1],
    titleEn: 'Portion Calibration',
    titleId: 'Kalibrasi Takaran',
    effectSummaryEn: 'Starts Mixing sliders +6% closer to each recipe’s ideal target ratios.',
    effectSummaryId: 'Slider adonan dimulai +6% lebih dekat ke target rasio tiap resep.',
    effects: {
      extraStartMixMatch: 6,
    },
  },
  {
    id: 'mix_turbo_whisk',
    role: 'mix',
    tier: 2,
    branch: 'speed',
    prerequisiteId: 'mix_balanced_scoop',
    trainingDurationSec: 6,
    trainingCost: SKILL_NODE_COST_BY_TIER[2],
    titleEn: 'Double-Whisk Rhythm',
    titleId: 'Ritme Aduk Ganda',
    effectSummaryEn: 'Adds +12% smoothness progress on every whisk click.',
    effectSummaryId: 'Tambah +12% progres kehalusan setiap kali klik aduk.',
    effects: {
      extraWhiskStep: 12,
    },
  },
  {
    id: 'mix_emulsion_lock',
    role: 'mix',
    tier: 2,
    branch: 'precision',
    prerequisiteId: 'mix_balanced_scoop',
    trainingDurationSec: 6,
    trainingCost: SKILL_NODE_COST_BY_TIER[2],
    titleEn: 'Emulsion Binding',
    titleId: 'Pengikatan Emulsi',
    effectSummaryEn: 'Cuts ratio deviation penalty by 25% & +2 Mix QC.',
    effectSummaryId: 'Kurangi penalti selisih rasio 25% & +2 skor QC Campur.',
    effects: {
      ratioToleranceBonus: 0.25,
      stageQualityBonus: 2,
    },
  },
  {
    id: 'mix_stand_mixer',
    role: 'mix',
    tier: 3,
    branch: 'speed',
    prerequisiteId: 'mix_turbo_whisk',
    trainingDurationSec: 8,
    trainingCost: SKILL_NODE_COST_BY_TIER[3],
    titleEn: 'Pre-Whisked Base',
    titleId: 'Adonan Awal Teraduk',
    effectSummaryEn: 'Starts mixing at 35% smoothness & +10% per whisk click.',
    effectSummaryId: 'Kehalusan awal dimulai dari 35% & +10% ekstra per aduk.',
    effects: {
      startingStirProgress: 35,
      extraWhiskStep: 10,
    },
  },
  {
    id: 'mix_velvet_texture',
    role: 'mix',
    tier: 3,
    branch: 'precision',
    prerequisiteId: 'mix_emulsion_lock',
    trainingDurationSec: 8,
    trainingCost: SKILL_NODE_COST_BY_TIER[3],
    titleEn: 'Silky Texture Mastery',
    titleId: 'Ahli Tekstur Lembut',
    effectSummaryEn: 'Grants +4 Mix QC bonus & +5% tighter starting ratios.',
    effectSummaryId: 'Bonus +4 QC Campur & takaran awal +5% lebih presisi.',
    effects: {
      extraStartMixMatch: 5,
      stageQualityBonus: 4,
    },
  },

  // =========================================================================
  // STAGE 3: WRAP (Siti Aminah)
  // =========================================================================
  {
    id: 'wrap_pleat_guide',
    role: 'wrap',
    tier: 1,
    branch: 'core',
    trainingDurationSec: 4,
    trainingCost: SKILL_NODE_COST_BY_TIER[1],
    titleEn: 'Pleat Rhythm Guide',
    titleId: 'Panduan Ritme Lipatan',
    effectSummaryEn: 'Pre-folds +1 extra wrapper pleat on every sample piece.',
    effectSummaryId: 'Melipat +1 titik lipatan awal ekstra di tiap sampel dimsum.',
    effects: {
      extraPreFoldedPleats: 1,
    },
  },
  {
    id: 'wrap_fast_fingers',
    role: 'wrap',
    tier: 2,
    branch: 'speed',
    prerequisiteId: 'wrap_pleat_guide',
    trainingDurationSec: 6,
    trainingCost: SKILL_NODE_COST_BY_TIER[2],
    titleEn: 'Rapid Batch Sampling',
    titleId: 'Sampel Lipatan Cepat',
    effectSummaryEn: 'Reduces required sample pieces in Stage 3 by 1 piece.',
    effectSummaryId: 'Mengurangi jumlah sampel bentuk di Tahap 3 sebanyak 1 pcs.',
    effects: {
      fewerSamplePieces: 1,
    },
  },
  {
    id: 'wrap_dough_elasticity',
    role: 'wrap',
    tier: 2,
    branch: 'precision',
    prerequisiteId: 'wrap_pleat_guide',
    trainingDurationSec: 6,
    trainingCost: SKILL_NODE_COST_BY_TIER[2],
    titleEn: 'Gentle Wrapper Touch',
    titleId: 'Sentuhan Kulit Halus',
    effectSummaryEn: 'Halves misclick penalty (-3% vs -6%) & +2 Wrap QC.',
    effectSummaryId: 'Kurangi penalti salah klik (-3%) & +2 skor QC Bentuk.',
    effects: {
      misclickPenaltyMultiplier: 0.5,
      stageQualityBonus: 2,
    },
  },
  {
    id: 'wrap_origami_flow',
    role: 'wrap',
    tier: 3,
    branch: 'speed',
    prerequisiteId: 'wrap_fast_fingers',
    trainingDurationSec: 8,
    trainingCost: SKILL_NODE_COST_BY_TIER[3],
    titleEn: 'Chain Folding Flow',
    titleId: 'Alur Lipatan Berantai',
    effectSummaryEn: 'Pre-folds +1 additional pleat (up to 4/5 pleats ready!).',
    effectSummaryId: 'Melipat +1 lipatan tambahan (hingga 4/5 lipatan siap!).',
    effects: {
      extraPreFoldedPleats: 1,
    },
  },
  {
    id: 'wrap_artisan_crown',
    role: 'wrap',
    tier: 3,
    branch: 'precision',
    prerequisiteId: 'wrap_dough_elasticity',
    trainingDurationSec: 8,
    trainingCost: SKILL_NODE_COST_BY_TIER[3],
    titleEn: 'Artisan Crown Seal',
    titleId: 'Segel Mahkota Pengrajin',
    effectSummaryEn: 'Grants +4 Wrap QC quality bonus on shaped dimsum.',
    effectSummaryId: 'Memberi bonus +4 QC Bentuk pada setiap batch dimsum.',
    effects: {
      stageQualityBonus: 4,
    },
  },

  // =========================================================================
  // STAGE 4: STEAM (Hendra Wijaya)
  // =========================================================================
  {
    id: 'steam_valve_tuning',
    role: 'steam',
    tier: 1,
    branch: 'core',
    trainingDurationSec: 4,
    trainingCost: SKILL_NODE_COST_BY_TIER[1],
    titleEn: 'Steam Valve Tuning',
    titleId: 'Setelan Katup Uap',
    effectSummaryEn: 'Stabilizes burner drift (+25% damping) near optimal heat.',
    effectSummaryId: 'Menstabilkan suhu uap (+25% redaman) di zona optimal.',
    effects: {
      steamStabilizationBonus: 0.25,
    },
  },
  {
    id: 'steam_rapid_boil',
    role: 'steam',
    tier: 2,
    branch: 'speed',
    prerequisiteId: 'steam_valve_tuning',
    trainingDurationSec: 6,
    trainingCost: SKILL_NODE_COST_BY_TIER[2],
    titleEn: 'High-Pressure Circulation',
    titleId: 'Sirkulasi Uap Cepat',
    effectSummaryEn: 'Increases bamboo steaming progress speed by +30%.',
    effectSummaryId: 'Mempercepat progres pengukusan bambu sebesar +30%.',
    effects: {
      steamSpeedBonusPct: 0.3,
    },
  },
  {
    id: 'steam_bamboo_seal',
    role: 'steam',
    tier: 2,
    branch: 'precision',
    prerequisiteId: 'steam_valve_tuning',
    trainingDurationSec: 6,
    trainingCost: SKILL_NODE_COST_BY_TIER[2],
    titleEn: 'Bamboo Aroma Seal',
    titleId: 'Segel Aroma Bambu',
    effectSummaryEn: 'Raises minimum steam score floor by +10 & +2 Steam QC.',
    effectSummaryId: 'Menaikkan skor dasar kukus +10 & +2 skor QC Kukus.',
    effects: {
      steamFloorBonus: 10,
      stageQualityBonus: 2,
    },
  },
  {
    id: 'steam_flash_steamer',
    role: 'steam',
    tier: 3,
    branch: 'speed',
    prerequisiteId: 'steam_rapid_boil',
    trainingDurationSec: 8,
    trainingCost: SKILL_NODE_COST_BY_TIER[3],
    titleEn: 'Pre-Heated Flash Chamber',
    titleId: 'Kamar Uap Pra-Panas',
    effectSummaryEn: 'Starts steaming at 25% progress & +25% faster steam rate.',
    effectSummaryId: 'Kukusan mulai di progres 25% & laju kukus +25% lebih cepat.',
    effects: {
      startingSteamProgress: 25,
      steamSpeedBonusPct: 0.25,
    },
  },
  {
    id: 'steam_master_mist',
    role: 'steam',
    tier: 3,
    branch: 'precision',
    prerequisiteId: 'steam_bamboo_seal',
    trainingDurationSec: 8,
    trainingCost: SKILL_NODE_COST_BY_TIER[3],
    titleEn: 'Micro-Mist Precision',
    titleId: 'Kontrol Uap Mikro',
    effectSummaryEn: 'Grants +4 Steam QC bonus & +20% temperature stabilization.',
    effectSummaryId: 'Bonus +4 QC Kukus & +20% stabilisasi suhu kukusan.',
    effects: {
      steamStabilizationBonus: 0.2,
      stageQualityBonus: 4,
    },
  },
];

export function getSkillNodesForRole(role: KitchenHelperRole): StaffSkillNodeDef[] {
  return STAFF_SKILL_TREE.filter((n) => n.role === role);
}

export function getSkillNodeById(nodeId: string): StaffSkillNodeDef | undefined {
  return STAFF_SKILL_TREE.find((n) => n.id === nodeId);
}

export function canTrainSkillNode(
  member: KitchenHelperState | undefined,
  nodeId: string,
  currentDay?: number,
): {
  allowed: boolean;
  reason?:
    | 'not_hired'
    | 'invalid_node'
    | 'wrong_role'
    | 'already_unlocked'
    | 'missing_prereq'
    | 'insufficient_level'
    | 'daily_limit'
    | 'low_morale';
} {
  if (!member) return { allowed: false, reason: 'not_hired' };
  const node = getSkillNodeById(nodeId);
  if (!node) return { allowed: false, reason: 'invalid_node' };
  if (node.role !== member.id) return { allowed: false, reason: 'wrong_role' };

  const unlocked = member.unlockedSkills ?? [];
  if (unlocked.includes(nodeId)) {
    return { allowed: false, reason: 'already_unlocked' };
  }
  if (node.prerequisiteId && !unlocked.includes(node.prerequisiteId)) {
    return { allowed: false, reason: 'missing_prereq' };
  }
  if (member.level < node.tier) {
    return { allowed: false, reason: 'insufficient_level' };
  }
  if (typeof currentDay === 'number' && member.lastSkillTrainedDay === currentDay) {
    return { allowed: false, reason: 'daily_limit' };
  }
  if (getStaffMorale(member) < MIN_MORALE_FOR_SKILL_TRAINING) {
    return { allowed: false, reason: 'low_morale' };
  }
  return { allowed: true };
}

export function unlockStaffSkillNode(
  member: KitchenHelperState,
  nodeId: string,
  trainingDurationSec: number,
  currentDay?: number,
): KitchenHelperState {
  const existing = member.unlockedSkills ?? [];
  if (existing.includes(nodeId)) return member;
  return {
    ...member,
    unlockedSkills: [...existing, nodeId],
    totalTrainingSec: (member.totalTrainingSec ?? 0) + trainingDurationSec,
    lastSkillTrainedDay:
      typeof currentDay === 'number' ? currentDay : member.lastSkillTrainedDay,
  };
}

export function computeHelperSkillEffects(
  member?: KitchenHelperState,
  includeWhileResting = false,
): Required<StaffSkillEffects> {
  const defaults: Required<StaffSkillEffects> = {
    extraPreloadedItems: 0,
    highlightRequiredItems: false,
    fewerDistractors: 0,
    mistakePenaltyMultiplier: 1,
    extraStartMixMatch: 0,
    extraWhiskStep: 0,
    startingStirProgress: 0,
    ratioToleranceBonus: 0,
    extraPreFoldedPleats: 0,
    fewerSamplePieces: 0,
    misclickPenaltyMultiplier: 1,
    steamStabilizationBonus: 0,
    steamSpeedBonusPct: 0,
    startingSteamProgress: 0,
    steamFloorBonus: 0,
    stageQualityBonus: 0,
  };

  if (!member) return defaults;
  if (!includeWhileResting && member.shift === 'wellness') return defaults;

  const unlockedIds = member.unlockedSkills ?? [];
  for (const skillId of unlockedIds) {
    const node = getSkillNodeById(skillId);
    if (!node || node.role !== member.id) continue;
    const fx = node.effects;
    defaults.extraPreloadedItems += fx.extraPreloadedItems ?? 0;
    defaults.highlightRequiredItems =
      defaults.highlightRequiredItems || Boolean(fx.highlightRequiredItems);
    defaults.fewerDistractors += fx.fewerDistractors ?? 0;
    if (typeof fx.mistakePenaltyMultiplier === 'number') {
      defaults.mistakePenaltyMultiplier = Math.min(
        defaults.mistakePenaltyMultiplier,
        fx.mistakePenaltyMultiplier,
      );
    }
    defaults.extraStartMixMatch += fx.extraStartMixMatch ?? 0;
    defaults.extraWhiskStep += fx.extraWhiskStep ?? 0;
    defaults.startingStirProgress = Math.min(
      60,
      defaults.startingStirProgress + (fx.startingStirProgress ?? 0),
    );
    defaults.ratioToleranceBonus = Math.min(
      0.6,
      defaults.ratioToleranceBonus + (fx.ratioToleranceBonus ?? 0),
    );
    defaults.extraPreFoldedPleats += fx.extraPreFoldedPleats ?? 0;
    defaults.fewerSamplePieces += fx.fewerSamplePieces ?? 0;
    if (typeof fx.misclickPenaltyMultiplier === 'number') {
      defaults.misclickPenaltyMultiplier = Math.min(
        defaults.misclickPenaltyMultiplier,
        fx.misclickPenaltyMultiplier,
      );
    }
    defaults.steamStabilizationBonus = Math.min(
      0.6,
      defaults.steamStabilizationBonus + (fx.steamStabilizationBonus ?? 0),
    );
    defaults.steamSpeedBonusPct += fx.steamSpeedBonusPct ?? 0;
    defaults.startingSteamProgress = Math.min(
      50,
      defaults.startingSteamProgress + (fx.startingSteamProgress ?? 0),
    );
    defaults.steamFloorBonus += fx.steamFloorBonus ?? 0;
    defaults.stageQualityBonus += fx.stageQualityBonus ?? 0;
  }

  return defaults;
}
