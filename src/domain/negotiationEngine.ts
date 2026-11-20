import { INGREDIENTS } from '../config/gameBalance';
import type {
  SupplierRelationshipState,
  SupplierRelationshipTier,
} from '../types/game';

export const DEFAULT_SUPPLIER_TRUST = 65;
export const BULK_NEGOTIATION_MIN_PACKS = 3;
export const MAX_NEGOTIATION_ROUNDS = 3;

export type NegotiationTactic = 'friendly' | 'firm' | 'aggressive';
export type NegotiationStatus = 'ACTIVE' | 'ACCEPTED' | 'WALKED_OUT' | 'CANCELLED';
export type OfferRiskLevel = 'low' | 'medium' | 'high' | 'extreme';

export interface SupplierProfile {
  supplier: string;
  specialtyEn: string;
  specialtyId: string;
  baseTolerance: number; // baseline fair discount rate e.g. 0.12 = 12%
  ingredientIds: string[];
}

export interface NegotiationRoundLog {
  round: number;
  tactic: NegotiationTactic;
  requestedDiscountRate: number;
  counterDiscountRate: number;
  outcome: 'ACCEPTED' | 'COUNTERED' | 'WALKED_OUT';
  patienceDelta: number;
  trustDelta: number;
  messageEn: string;
  messageId: string;
}

export interface NegotiationSessionState {
  supplier: string;
  baseSubtotal: number;
  packCount: number;
  initialTrust: number;
  currentTrust: number;
  patience: number; // 0 - 100
  round: number;
  maxRounds: number;
  currentOfferDiscount: number; // supplier's current offer on the table (0..0.30)
  fairCeiling: number; // internal fair max discount based on bulk size & trust
  status: NegotiationStatus;
  trustDeltaTotal: number;
  history: NegotiationRoundLog[];
}

const SUPPLIER_PROFILES_LIST: SupplierProfile[] = [
  {
    supplier: 'Segar Poultry Farm',
    specialtyEn: 'Fresh Lean Poultry Wholesale',
    specialtyId: 'Grosir Daging Ayam Segar',
    baseTolerance: 0.12,
    ingredientIds: ['chicken'],
  },
  {
    supplier: 'Nusantara Seafood',
    specialtyEn: 'Coastal Catch Cooperative',
    specialtyId: 'Koperasi Udang Pesisir',
    baseTolerance: 0.10,
    ingredientIds: ['shrimp'],
  },
  {
    supplier: 'Kedelai Sehat Co.',
    specialtyEn: 'Organic Soy & Silken Tofu',
    specialtyId: 'Tahu Putih Organik',
    baseTolerance: 0.14,
    ingredientIds: ['tofu'],
  },
  {
    supplier: 'Lembang Harvest',
    specialtyEn: 'Highland Vegetable Growers',
    specialtyId: 'Petani Sayur Dataran Tinggi',
    baseTolerance: 0.15,
    ingredientIds: ['carrot', 'spinach', 'broccoli'],
  },
  {
    supplier: 'Highland Fungi',
    specialtyEn: 'Cultivated Shiitake Farms',
    specialtyId: 'Kebun Jamur Shiitake',
    baseTolerance: 0.13,
    ingredientIds: ['mushroom'],
  },
  {
    supplier: 'Spice Market',
    specialtyEn: 'Aromatics & Low-Sodium Blends',
    specialtyId: 'Rempah & Bumbu Rendah Garam',
    baseTolerance: 0.14,
    ingredientIds: ['garlic', 'seasoning'],
  },
  {
    supplier: 'Artisan Dough Co.',
    specialtyEn: 'Wrappers & Tapioca Mill',
    specialtyId: 'Penggilingan Tepung & Kulit Dimsum',
    baseTolerance: 0.12,
    ingredientIds: ['wrapper', 'tapioca'],
  },
];

export function getAllSupplierNames(): string[] {
  const fromIng = Array.from(new Set(INGREDIENTS.map((i) => i.supplier)));
  return fromIng;
}

export function getSupplierProfile(supplier: string): SupplierProfile {
  return (
    SUPPLIER_PROFILES_LIST.find((s) => s.supplier === supplier) ?? {
      supplier,
      specialtyEn: 'Ingredient Wholesale Partner',
      specialtyId: 'Mitra Grosir Bahan Baku',
      baseTolerance: 0.12,
      ingredientIds: INGREDIENTS.filter((i) => i.supplier === supplier).map((i) => i.id),
    }
  );
}

export function clampTrust(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getSupplierRelationshipTier(trust: number): SupplierRelationshipTier {
  if (trust >= 85) return 'trusted';
  if (trust >= 60) return 'good';
  if (trust >= 35) return 'wary';
  return 'strained';
}

export function getSupplierPriceMultiplier(trust: number): number {
  const tier = getSupplierRelationshipTier(trust);
  if (tier === 'trusted') return 0.95; // 5% partner discount
  if (tier === 'strained') return 1.1; // 10% strained surcharge
  return 1.0;
}

export function createInitialSupplierRelationships(): Record<
  string,
  SupplierRelationshipState
> {
  const map: Record<string, SupplierRelationshipState> = {};
  for (const name of getAllSupplierNames()) {
    map[name] = {
      supplier: name,
      trust: DEFAULT_SUPPLIER_TRUST,
      negotiatedCount: 0,
      walkoutCount: 0,
    };
  }
  return map;
}

export function normalizeSupplierRelationships(
  saved?: Record<string, SupplierRelationshipState>,
): Record<string, SupplierRelationshipState> {
  const base = createInitialSupplierRelationships();
  if (!saved) return base;
  for (const [name, rel] of Object.entries(saved)) {
    base[name] = {
      supplier: name,
      trust: clampTrust(rel.trust ?? DEFAULT_SUPPLIER_TRUST),
      negotiatedCount: rel.negotiatedCount ?? 0,
      walkoutCount: rel.walkoutCount ?? 0,
      lastNegotiatedDay: rel.lastNegotiatedDay,
    };
  }
  return base;
}

export function recoverSupplierTrustOvernight(
  rel: SupplierRelationshipState,
): SupplierRelationshipState {
  const tier = getSupplierRelationshipTier(rel.trust);
  if (tier === 'strained') {
    return { ...rel, trust: clampTrust(rel.trust + 8) };
  }
  if (tier === 'wary') {
    return { ...rel, trust: clampTrust(rel.trust + 5) };
  }
  return rel;
}

export function computeBulkDiscountCeiling(
  supplier: string,
  packCount: number,
  trust: number,
): number {
  const profile = getSupplierProfile(supplier);
  const extraBulkPacks = Math.max(0, packCount - BULK_NEGOTIATION_MIN_PACKS);
  const bulkBonus = Math.min(0.08, extraBulkPacks * 0.015);
  const trustModifier =
    trust >= 85 ? 0.04 : trust >= 60 ? 0.015 : trust >= 35 ? -0.02 : -0.06;
  return Math.max(0.06, Math.min(0.26, Number((profile.baseTolerance + bulkBonus + trustModifier).toFixed(3))));
}

export function startNegotiationSession(params: {
  supplier: string;
  baseSubtotal: number;
  packCount: number;
  relationship: SupplierRelationshipState;
}): { ok: true; session: NegotiationSessionState } | { ok: false; reasonEn: string; reasonId: string } {
  const { supplier, baseSubtotal, packCount, relationship } = params;
  const trust = clampTrust(relationship.trust);

  if (packCount < BULK_NEGOTIATION_MIN_PACKS) {
    return {
      ok: false,
      reasonEn: `Order at least ${BULK_NEGOTIATION_MIN_PACKS} packs from ${supplier} to negotiate a bulk rate.`,
      reasonId: `Pesan minimal ${BULK_NEGOTIATION_MIN_PACKS} kemasan dari ${supplier} untuk nego harga grosir.`,
    };
  }

  if (getSupplierRelationshipTier(trust) === 'strained') {
    return {
      ok: false,
      reasonEn: `${supplier} refuses bulk haggling while your relationship is Strained (Trust ${trust}/100). Complete normal orders or wait until tomorrow to rebuild trust.`,
      reasonId: `${supplier} menolak tawar-menawar saat hubungan Tegang (Kepercayaan ${trust}/100). Belanja normal atau tunggu besok untuk memulihkan hubungan.`,
    };
  }

  const initialPatience = trust >= 85 ? 90 : trust >= 60 ? 75 : 55;
  const openingOffer = trust >= 80 ? 0.04 : packCount >= 6 ? 0.03 : 0;
  const fairCeiling = computeBulkDiscountCeiling(supplier, packCount, trust);

  return {
    ok: true,
    session: {
      supplier,
      baseSubtotal,
      packCount,
      initialTrust: trust,
      currentTrust: trust,
      patience: initialPatience,
      round: 1,
      maxRounds: MAX_NEGOTIATION_ROUNDS,
      currentOfferDiscount: openingOffer,
      fairCeiling,
      status: 'ACTIVE',
      trustDeltaTotal: 0,
      history: [],
    },
  };
}

export function assessOfferRisk(
  session: NegotiationSessionState,
  tactic: NegotiationTactic,
  requestedDiscountRate: number,
): {
  risk: OfferRiskLevel;
  patienceEstimateCost: number;
  expectedTrustOnAccept: number;
  expectedTrustOnWalkout: number;
} {
  const stretchRatio = requestedDiscountRate - session.fairCeiling;
  const tacticPatienceBase = tactic === 'friendly' ? 10 : tactic === 'firm' ? 20 : 34;
  const greedPatience = Math.max(0, Math.round(stretchRatio * 220));
  const patienceEstimateCost = tacticPatienceBase + greedPatience;

  const expectedTrustOnAccept =
    tactic === 'friendly' ? 3 : tactic === 'firm' ? 1 : -3;
  const expectedTrustOnWalkout = tactic === 'aggressive' ? -22 : -15;

  let risk: OfferRiskLevel = 'low';
  if (
    session.patience - patienceEstimateCost <= 10 ||
    stretchRatio >= 0.09 ||
    (tactic === 'aggressive' && session.patience <= 45)
  ) {
    risk = 'extreme';
  } else if (
    tactic === 'aggressive' ||
    stretchRatio >= 0.045 ||
    session.patience - patienceEstimateCost <= 25
  ) {
    risk = 'high';
  } else if (tactic === 'firm' || stretchRatio >= 0.01) {
    risk = 'medium';
  }

  return {
    risk,
    patienceEstimateCost,
    expectedTrustOnAccept,
    expectedTrustOnWalkout,
  };
}

export function evaluateNegotiationRound(
  session: NegotiationSessionState,
  input: {
    tactic: NegotiationTactic;
    requestedDiscountRate: number;
  },
  rng: () => number = Math.random,
): NegotiationSessionState {
  if (session.status !== 'ACTIVE') return session;

  const requested = Math.max(0.03, Math.min(0.30, input.requestedDiscountRate));
  const tactic = input.tactic;
  const stretch = requested - session.fairCeiling;

  // Tactic ceiling bonus & patience drain
  const tacticCeilingShift =
    tactic === 'friendly' ? 0 : tactic === 'firm' ? 0.025 : 0.05;
  const effectiveThreshold = session.fairCeiling + tacticCeilingShift;

  const baseDrain = tactic === 'friendly' ? 10 : tactic === 'firm' ? 20 : 34;
  const greedDrain = Math.max(0, Math.round(stretch * 240));
  const patienceCost = baseDrain + greedDrain;
  const nextPatience = Math.max(0, session.patience - patienceCost);

  // Determine immediate acceptance
  let acceptChance = 0;
  if (requested <= session.currentOfferDiscount) {
    acceptChance = 1;
  } else if (requested <= effectiveThreshold - 0.02) {
    acceptChance = tactic === 'friendly' ? 0.92 : tactic === 'firm' ? 0.85 : 0.72;
  } else if (requested <= effectiveThreshold + 0.01) {
    acceptChance = tactic === 'friendly' ? 0.62 : tactic === 'firm' ? 0.58 : 0.48;
  } else if (requested <= effectiveThreshold + 0.04) {
    acceptChance = tactic === 'aggressive' ? 0.25 : 0.12;
  } else {
    acceptChance = 0;
  }

  const roll = rng();

  // Check walkout first if player pushed patience to 0 or asked absurdly high with aggressive push
  const severeOverreach =
    nextPatience <= 0 ||
    (stretch >= 0.11 && tactic === 'aggressive') ||
    (session.round >= session.maxRounds && roll >= acceptChance && nextPatience < 18);

  if (severeOverreach) {
    const trustDrop = tactic === 'aggressive' ? -22 : -15;
    const nextTrust = clampTrust(session.currentTrust + trustDrop);
    const log: NegotiationRoundLog = {
      round: session.round,
      tactic,
      requestedDiscountRate: requested,
      counterDiscountRate: 0,
      outcome: 'WALKED_OUT',
      patienceDelta: -session.patience,
      trustDelta: trustDrop,
      messageEn: `"That's way below my farm's costs! Deal's off—we'll stick to standard rates until trust recovers."`,
      messageId: `"Tawaran itu terlalu menekan modal kami! Negosiasi batal—harga kembali normal sampai kepercayaan pulih."`,
    };
    return {
      ...session,
      patience: 0,
      currentOfferDiscount: 0,
      currentTrust: nextTrust,
      trustDeltaTotal: nextTrust - session.initialTrust,
      status: 'WALKED_OUT',
      history: [...session.history, log],
    };
  }

  if (roll < acceptChance) {
    const trustDelta = tactic === 'friendly' ? 3 : tactic === 'firm' ? 1 : -3;
    const nextTrust = clampTrust(session.currentTrust + trustDelta);
    const pct = Math.round(requested * 100);
    const log: NegotiationRoundLog = {
      round: session.round,
      tactic,
      requestedDiscountRate: requested,
      counterDiscountRate: requested,
      outcome: 'ACCEPTED',
      patienceDelta: -Math.round(patienceCost * 0.4),
      trustDelta,
      messageEn:
        tactic === 'friendly'
          ? `"Fair enough for a loyal buyer! Let's shake on ${pct}% off your ${session.packCount}-pack bulk order."`
          : tactic === 'firm'
            ? `"Tough bargain, but your volume justifies it. Deal locked at ${pct}% off."`
            : `"Fine, you drive a hard bargain—${pct}% off this time, though my margins are paper-thin."`,
      messageId:
        tactic === 'friendly'
          ? `"Cocok untuk mitra langganan! Sepakat diskon ${pct}% untuk pesanan grosir ${session.packCount} kemasan."`
          : tactic === 'firm'
            ? `"Penawaran yang cukup tegas, tapi jumlah belanjamu sepadan. Deal di diskon ${pct}%."`
            : `"Baiklah, negosiasi kerasmu berhasil—diskon ${pct}% kali ini, meski untung kami tipis."`,
    };
    return {
      ...session,
      patience: Math.max(10, session.patience - Math.round(patienceCost * 0.4)),
      currentOfferDiscount: requested,
      currentTrust: nextTrust,
      trustDeltaTotal: nextTrust - session.initialTrust,
      status: 'ACCEPTED',
      history: [...session.history, log],
    };
  }

  // Otherwise supplier counter-offers partway up to fairCeiling
  const stepTarget = Math.min(requested - 0.01, effectiveThreshold);
  const nextCounter = Math.max(
    session.currentOfferDiscount + 0.02,
    Number((((session.currentOfferDiscount + Math.max(session.currentOfferDiscount, stepTarget)) / 2)).toFixed(2)),
  );
  const clampedCounter = Math.min(0.24, Math.max(0.03, Math.round(nextCounter * 100) / 100));
  const roundTrustDelta = tactic === 'aggressive' ? -4 : tactic === 'friendly' ? 1 : 0;
  const nextTrust = clampTrust(session.currentTrust + roundTrustDelta);
  const counterPct = Math.round(clampedCounter * 100);
  const askPct = Math.round(requested * 100);

  // If this was the final round, supplier gives a final take-it-or-leave-it counter!
  const isFinalRound = session.round >= session.maxRounds;

  const log: NegotiationRoundLog = {
    round: session.round,
    tactic,
    requestedDiscountRate: requested,
    counterDiscountRate: clampedCounter,
    outcome: 'COUNTERED',
    patienceDelta: -(session.patience - nextPatience),
    trustDelta: roundTrustDelta,
    messageEn: isFinalRound
      ? `"${askPct}% is still too steep. My final offer for this order is ${counterPct}% off—take it or walk away."`
      : `"I can't do ${askPct}% on fresh stock today, but I can meet you at ${counterPct}% off."`,
    messageId: isFinalRound
      ? `"Diskon ${askPct}% masih terlalu tinggi. Penawaran terakhir kami ${counterPct}%—ambil sekarang atau batalkan."`
      : `"Untuk stok segar belum bisa ${askPct}%, tapi saya bisa beri potongan ${counterPct}%."`,
  };

  return {
    ...session,
    patience: nextPatience,
    round: isFinalRound ? session.maxRounds : session.round + 1,
    currentOfferDiscount: clampedCounter,
    currentTrust: nextTrust,
    trustDeltaTotal: nextTrust - session.initialTrust,
    history: [...session.history, log],
  };
}

export function acceptCurrentCounterOffer(
  session: NegotiationSessionState,
): NegotiationSessionState {
  if (session.status !== 'ACTIVE' || session.currentOfferDiscount <= 0) return session;
  const trustBoost = session.history.length > 0 ? 2 : 1;
  const nextTrust = clampTrust(session.currentTrust + trustBoost);
  const pct = Math.round(session.currentOfferDiscount * 100);
  const log: NegotiationRoundLog = {
    round: session.round,
    tactic: 'friendly',
    requestedDiscountRate: session.currentOfferDiscount,
    counterDiscountRate: session.currentOfferDiscount,
    outcome: 'ACCEPTED',
    patienceDelta: 0,
    trustDelta: trustBoost,
    messageEn: `"Appreciate the smooth compromise! ${pct}% bulk discount is locked in for this checkout."`,
    messageId: `"Terima kasih atas kesepakatan yang baik! Diskon grosir ${pct}% aktif untuk belanja ini."`,
  };
  return {
    ...session,
    currentTrust: nextTrust,
    trustDeltaTotal: nextTrust - session.initialTrust,
    status: 'ACCEPTED',
    history: [...session.history, log],
  };
}

export function cancelNegotiationPolitely(
  session: NegotiationSessionState,
): NegotiationSessionState {
  if (session.status !== 'ACTIVE') return session;
  const penalty = session.history.length > 0 ? -1 : 0;
  const nextTrust = clampTrust(session.currentTrust + penalty);
  return {
    ...session,
    currentTrust: nextTrust,
    trustDeltaTotal: nextTrust - session.initialTrust,
    status: 'CANCELLED',
  };
}

export function applySupplierDealToPackPrice(
  unitPackPrice: number,
  discountRate: number,
): number {
  if (discountRate <= 0) return Math.round(unitPackPrice);
  const discounted = Math.round((unitPackPrice * (1 - discountRate)) / 50) * 50;
  return Math.max(100, discounted);
}
