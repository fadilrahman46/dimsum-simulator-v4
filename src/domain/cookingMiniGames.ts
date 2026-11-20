import { getIngredientDef } from '../config/gameBalance';
import type { RecipeDef } from '../types/game';

export interface MixRecipeProfile {
  profileId: 'balanced' | 'seafood' | 'plant_umami' | 'garden_veggie' | 'custom';
  targetMain: number; // slider bounds 20..80
  targetSecondary: number; // slider bounds 10..60
  mainLabelEn: string;
  mainLabelId: string;
  secondaryLabelEn: string;
  secondaryLabelId: string;
  hintEn: string;
  hintId: string;
}

export type WrapShapeStyle = 'crown' | 'crescent' | 'wave' | 'lotus';

export interface WrapPleatPoint {
  id: number;
  x: number;
  y: number;
}

export interface WrapRecipePattern {
  style: WrapShapeStyle;
  nameEn: string;
  nameId: string;
  instructionEn: string;
  instructionId: string;
  wrapperTint: string;
  points: WrapPleatPoint[];
}

export interface SteamProfile {
  startTemp: number;
  minTemp: number;
  maxTemp: number;
  optimalMin: number;
  optimalMax: number;
  ambientCoolPerTick: number;
  surgeAmplitude: number;
}

export const STEAM_CONSTANTS = {
  startTemp: 78,
  minTemp: 72,
  maxTemp: 120,
  optimalMin: 93,
  optimalMax: 105,
} as const;

export function getMixProfileForRecipe(recipe: RecipeDef): MixRecipeProfile {
  if (recipe.id === 'chicken_carrot') {
    return {
      profileId: 'balanced',
      targetMain: 55,
      targetSecondary: 30,
      mainLabelEn: 'Lean Chicken Filling',
      mainLabelId: 'Isian Daging Ayam',
      secondaryLabelEn: 'Sweet Carrot Crunch',
      secondaryLabelId: 'Wortel Segar',
      hintEn: 'Classic balanced poultry & sweet carrot emulsion.',
      hintId: 'Emulsi seimbang daging ayam dan wortel manis.',
    };
  }

  if (recipe.id === 'shrimp_veg') {
    return {
      profileId: 'seafood',
      targetMain: 60,
      targetSecondary: 25,
      mainLabelEn: 'Fresh Shrimp Paste',
      mainLabelId: 'Pasta Udang Segar',
      secondaryLabelEn: 'Broccoli & Carrot',
      secondaryLabelId: 'Brokoli & Wortel',
      hintEn: 'High-protein seafood mix for crisp hakau bounce.',
      hintId: 'Komposisi udang tinggi untuk tekstur kenyal segar.',
    };
  }

  if (recipe.id === 'tofu_mushroom') {
    return {
      profileId: 'plant_umami',
      targetMain: 50,
      targetSecondary: 35,
      mainLabelEn: 'Silken Tofu Base',
      mainLabelId: 'Dasar Tahu Putih',
      secondaryLabelEn: 'Shiitake Umami',
      secondaryLabelId: 'Jamur Shiitake',
      hintEn: 'Gentle tofu fold enriched with aromatic shiitake.',
      hintId: 'Lipatan tahu lembut dengan aroma jamur shiitake.',
    };
  }

  if (recipe.id === 'rainbow_veggie') {
    return {
      profileId: 'garden_veggie',
      targetMain: 35,
      targetSecondary: 50,
      mainLabelEn: 'Binder & Seasoning',
      mainLabelId: 'Pengikat & Bumbu',
      secondaryLabelEn: 'Rainbow Greens',
      secondaryLabelId: 'Sayuran Pelangi',
      hintEn: 'Leafy green-forward blend with light starch binding.',
      hintId: 'Dominan sayuran hijau segar dengan pengikat ringan.',
    };
  }

  if (recipe.id === 'mentai_chicken') {
    return {
      profileId: 'balanced',
      targetMain: 55,
      targetSecondary: 25,
      mainLabelEn: 'Chicken & Tofu Emulsion',
      mainLabelId: 'Emulsi Ayam & Tahu',
      secondaryLabelEn: 'Sweet Carrot & Glaze',
      secondaryLabelId: 'Wortel Manis & Saus',
      hintEn: 'Creamy high-protein chicken & silken tofu mentai balance.',
      hintId: 'Keseimbangan ayam lembut dan tahu sutra untuk glaze mentai.',
    };
  }

  if (recipe.id === 'kuotie_panggang') {
    return {
      profileId: 'balanced',
      targetMain: 50,
      targetSecondary: 35,
      mainLabelEn: 'Minced Poultry Base',
      mainLabelId: 'Isian Ayam Cincang',
      secondaryLabelEn: 'Spinach & Roasted Garlic',
      secondaryLabelId: 'Bayam & Bawang Panggang',
      hintEn: 'Savory seared dumpling ratio with generous garden spinach.',
      hintId: 'Rasio kuotie gurih dengan porsi bayam dan bawang putih seimbang.',
    };
  }

  if (recipe.id === 'lumpia_tahu') {
    return {
      profileId: 'plant_umami',
      targetMain: 45,
      targetSecondary: 40,
      mainLabelEn: 'Pressed Silken Tofu',
      mainLabelId: 'Tahu Putih Halus',
      secondaryLabelEn: 'Carrot & Shiitake Ribbons',
      secondaryLabelId: 'Wortel & Jamur Shiitake',
      hintEn: 'Crisp vegetable ribbons folded evenly into seasoned tofu.',
      hintId: 'Irisan wortel dan jamur shiitake berpadu lembut dengan tahu.',
    };
  }

  if (recipe.id === 'hakau_bayam') {
    return {
      profileId: 'seafood',
      targetMain: 65,
      targetSecondary: 25,
      mainLabelEn: 'Whole Crisp Shrimp',
      mainLabelId: 'Udang Segar Utuh',
      secondaryLabelEn: 'Spinach & Carrot Dice',
      secondaryLabelId: 'Bayam & Dadu Wortel',
      hintEn: 'Snappy shrimp-forward blend for translucent spinach hakau.',
      hintId: 'Dominan udang kenyal dengan cincangan bayam dan wortel.',
    };
  }

  if (recipe.id === 'bakpao_gandum') {
    return {
      profileId: 'garden_veggie',
      targetMain: 40,
      targetSecondary: 45,
      mainLabelEn: 'Herbal Tofu Filling',
      mainLabelId: 'Isian Tahu Herbal',
      secondaryLabelEn: 'Shiitake & Broccoli Mix',
      secondaryLabelId: 'Campuran Jamur & Brokoli',
      hintEn: 'Fiber-rich whole-grain bun filling with aromatic mushrooms.',
      hintId: 'Isian bakpao gandum kaya serat dengan jamur dan brokoli.',
    };
  }

  // Derive targets dynamically for custom or future recipes from ingredient composition
  let proteinQty = 0;
  let veggieQty = 0;
  let otherQty = 0;

  for (const req of recipe.ingredients) {
    const def = getIngredientDef(req.ingredientId);
    if (!def) continue;
    if (def.category === 'protein') proteinQty += req.quantity;
    else if (def.category === 'vegetable') veggieQty += req.quantity;
    else if (def.category === 'seasoning' || req.ingredientId === 'tapioca') {
      otherQty += req.quantity;
    }
  }

  const totalFilling = Math.max(1, proteinQty + veggieQty + otherQty);
  const rawMain = Math.round(((proteinQty > 0 ? proteinQty : otherQty) / totalFilling) * 85);
  const rawSec = Math.round((veggieQty / totalFilling) * 85);

  const targetMain = Math.max(25, Math.min(75, Math.round(rawMain / 5) * 5));
  const targetSecondary = Math.max(15, Math.min(55, Math.round(rawSec / 5) * 5));

  return {
    profileId: 'custom',
    targetMain,
    targetSecondary,
    mainLabelEn: proteinQty > 0 ? 'Primary Protein Base' : 'Binder & Herb Base',
    mainLabelId: proteinQty > 0 ? 'Isian Protein Utama' : 'Bahan Pengikat & Bumbu',
    secondaryLabelEn: 'Fresh Vegetable Mix',
    secondaryLabelId: 'Campuran Sayuran Segar',
    hintEn: 'Calibrated specifically to your custom ingredient ratios.',
    hintId: 'Dikalibrasi khusus mengikuti komposisi resep kustommu.',
  };
}

export function computeMixStartingRatios(params: {
  targetMain: number;
  targetSecondary: number;
  helperLevel?: 1 | 2 | 3;
  extraStartMatch?: number;
}): { initialMain: number; initialSecondary: number } {
  const { targetMain, targetSecondary, helperLevel, extraStartMatch = 0 } = params;

  const baseOffsetMain = targetMain >= 50 ? -15 : 15;
  const baseOffsetSec = targetSecondary >= 35 ? -12 : 10;

  const rawStartMain = Math.max(20, Math.min(80, targetMain + baseOffsetMain));
  const rawStartSec = Math.max(10, Math.min(60, targetSecondary + baseOffsetSec));

  const levelRatio =
    helperLevel === 3 ? 1 : helperLevel === 2 ? 0.8 : helperLevel === 1 ? 0.45 : 0;

  let startMain = Math.round(rawStartMain + (targetMain - rawStartMain) * levelRatio);
  let startSec = Math.round(rawStartSec + (targetSecondary - rawStartSec) * levelRatio);

  if (extraStartMatch > 0) {
    const moveToward = (curr: number, target: number, step: number) => {
      if (curr < target) return Math.min(target, curr + step);
      if (curr > target) return Math.max(target, curr - step);
      return curr;
    };
    startMain = moveToward(startMain, targetMain, extraStartMatch);
    startSec = moveToward(startSec, targetSecondary, extraStartMatch);
  }

  return {
    initialMain: Math.max(20, Math.min(80, startMain)),
    initialSecondary: Math.max(10, Math.min(60, startSec)),
  };
}

export function getWrapPatternForRecipe(recipe: RecipeDef): WrapRecipePattern {
  let style: WrapShapeStyle = 'crown';

  if (recipe.id === 'shrimp_veg' || recipe.id === 'hakau_bayam') {
    style = 'crescent';
  } else if (
    recipe.id === 'tofu_mushroom' ||
    recipe.id === 'kuotie_panggang' ||
    recipe.id === 'lumpia_tahu'
  ) {
    style = 'wave';
  } else if (recipe.id === 'rainbow_veggie' || recipe.id === 'bakpao_gandum') {
    style = 'lotus';
  } else if (recipe.id !== 'chicken_carrot' && recipe.id !== 'mentai_chicken') {
    const hasShrimp = recipe.ingredients.some((i) => i.ingredientId === 'shrimp');
    const hasTofuOrMushroom = recipe.ingredients.some(
      (i) => i.ingredientId === 'tofu' || i.ingredientId === 'mushroom',
    );
    if (hasShrimp) style = 'crescent';
    else if (recipe.isVegetarian) style = 'lotus';
    else if (hasTofuOrMushroom) style = 'wave';
  }

  if (style === 'crescent') {
    return {
      style: 'crescent',
      nameEn: 'Hakau Crescent Fan (6 pleats)',
      nameId: 'Kipas Sabit Hakau (6 lipatan)',
      instructionEn: 'Crimp all 6 arc pleats along the translucent crescent rim.',
      instructionId: 'Cubit ke-6 titik lipatan di sepanjang lengkung sabit hakau.',
      wrapperTint: '#FAF5EB',
      points: [
        { id: 0, x: 42, y: 112 },
        { id: 1, x: 62, y: 66 },
        { id: 2, x: 92, y: 40 },
        { id: 3, x: 128, y: 40 },
        { id: 4, x: 158, y: 66 },
        { id: 5, x: 178, y: 112 },
      ],
    };
  }

  if (style === 'wave') {
    return {
      style: 'wave',
      nameEn: 'Gyoza Twin-Wave Fold (4 pleats)',
      nameId: 'Lipatan Gelombang Gyoza (4 lipatan)',
      instructionEn: 'Pinch the 4 alternating ridge points to seal the silken tofu pocket.',
      instructionId: 'Tekan 4 titik punggung lipatan untuk menyegel kantong tahu lembut.',
      wrapperTint: '#F5E5C0',
      points: [
        { id: 0, x: 52, y: 92 },
        { id: 1, x: 90, y: 58 },
        { id: 2, x: 130, y: 58 },
        { id: 3, x: 168, y: 92 },
      ],
    };
  }

  if (style === 'lotus') {
    return {
      style: 'lotus',
      nameEn: 'Jade Lotus Blossom (6 pleats)',
      nameId: 'Kuncup Teratai Hijau (6 lipatan)',
      instructionEn: 'Tuck all 6 hexagonal petal points around the spinach-herb wrapper.',
      instructionId: 'Lipat 6 sudut kelopak heksagonal pada kulit bayam herbal.',
      wrapperTint: '#E6F2DC',
      points: [
        { id: 0, x: 110, y: 26 },
        { id: 1, x: 174, y: 63 },
        { id: 2, x: 174, y: 137 },
        { id: 3, x: 110, y: 174 },
        { id: 4, x: 46, y: 137 },
        { id: 5, x: 46, y: 63 },
      ],
    };
  }

  return {
    style: 'crown',
    nameEn: 'Siomay Open Crown (5 pleats)',
    nameId: 'Mahkota Terbuka Siomay (5 lipatan)',
    instructionEn: 'Tap all 5 radial crown markers around the open wrapper edge.',
    instructionId: 'Ketuk 5 titik lipatan mahkota di tepi kulit siomay.',
    wrapperTint: '#FAF0D7',
    points: [
      { id: 0, x: 110, y: 26 },
      { id: 1, x: 178, y: 74 },
      { id: 2, x: 152, y: 156 },
      { id: 3, x: 68, y: 156 },
      { id: 4, x: 42, y: 74 },
    ],
  };
}

export function getSteamProfileForRecipe(recipe: RecipeDef): SteamProfile {
  // Subtle culinary variations while keeping clear 93-105°C core target
  if (recipe.id === 'shrimp_veg' || recipe.id === 'hakau_bayam') {
    return {
      startTemp: STEAM_CONSTANTS.startTemp,
      minTemp: STEAM_CONSTANTS.minTemp,
      maxTemp: STEAM_CONSTANTS.maxTemp,
      optimalMin: 95,
      optimalMax: 106,
      ambientCoolPerTick: -0.35,
      surgeAmplitude: 2.3,
    };
  }
  if (recipe.id === 'tofu_mushroom' || recipe.id === 'lumpia_tahu') {
    return {
      startTemp: STEAM_CONSTANTS.startTemp,
      minTemp: STEAM_CONSTANTS.minTemp,
      maxTemp: STEAM_CONSTANTS.maxTemp,
      optimalMin: 91,
      optimalMax: 102,
      ambientCoolPerTick: -0.25,
      surgeAmplitude: 1.9,
    };
  }
  if (recipe.id === 'kuotie_panggang' || recipe.id === 'bakpao_gandum') {
    return {
      startTemp: STEAM_CONSTANTS.startTemp,
      minTemp: STEAM_CONSTANTS.minTemp,
      maxTemp: STEAM_CONSTANTS.maxTemp,
      optimalMin: 94,
      optimalMax: 106,
      ambientCoolPerTick: -0.32,
      surgeAmplitude: 2.2,
    };
  }
  return {
    startTemp: STEAM_CONSTANTS.startTemp,
    minTemp: STEAM_CONSTANTS.minTemp,
    maxTemp: STEAM_CONSTANTS.maxTemp,
    optimalMin: STEAM_CONSTANTS.optimalMin,
    optimalMax: STEAM_CONSTANTS.optimalMax,
    ambientCoolPerTick: -0.3,
    surgeAmplitude: 2.1,
  };
}

export function computeNextSteamTemp(params: {
  prevTemp: number;
  heatLevel: 'low' | 'medium' | 'high';
  tickIndex: number;
  profile: SteamProfile;
  stabilization?: number; // 0..0.85
  helperLevel?: 1 | 2 | 3;
  randomVal?: number; // 0..1 deterministic hook for testing
}): { nextTemp: number; gustDelta: number } {
  const {
    prevTemp,
    heatLevel,
    tickIndex,
    profile,
    stabilization = 0,
    helperLevel,
    randomVal = Math.random(),
  } = params;

  const optimalMid = (profile.optimalMin + profile.optimalMax) / 2;

  // Periodic bamboo steamer pressure surge / kitchen draft wave
  const wave = Math.sin(tickIndex * 0.55) * profile.surgeAmplitude * 0.6;
  const noise = (randomVal - 0.52) * profile.surgeAmplitude;
  const rawGust = wave + noise;
  const dampedGust = rawGust * (1 - stabilization);

  // Burner delta: Medium alone gently cools/drifts and cannot reach 93°C from 78°C AFK;
  // High climbs strongly (+3.4/tick), Low cools (-2.5/tick).
  const burnerDrive =
    heatLevel === 'high'
      ? 3.4
      : heatLevel === 'low'
        ? -2.5
        : profile.ambientCoolPerTick;

  const centerPull = helperLevel
    ? (optimalMid - prevTemp) * (0.045 * helperLevel)
    : 0;

  const nextTemp = Math.max(
    profile.minTemp,
    Math.min(profile.maxTemp, prevTemp + burnerDrive + dampedGust + centerPull),
  );

  return {
    nextTemp,
    gustDelta: dampedGust,
  };
}
