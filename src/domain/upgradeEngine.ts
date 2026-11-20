import { getUpgradeDef } from '../config/gameBalance';
import type { UpgradeId, UpgradeLevelDef, UpgradeLevels } from '../types/game';

export function getNextUpgradeLevel(
  upgrades: UpgradeLevels,
  upgradeId: UpgradeId,
): UpgradeLevelDef | null {
  const current = upgrades[upgradeId];
  if (current >= 3) return null;
  const def = getUpgradeDef(upgradeId);
  return def.levels.find((l) => l.level === current + 1) ?? null;
}

export function canPurchaseUpgrade(
  upgrades: UpgradeLevels,
  upgradeId: UpgradeId,
  cashBalance: number,
): { allowed: boolean; nextLevel: UpgradeLevelDef | null; reason?: string } {
  const nextLevel = getNextUpgradeLevel(upgrades, upgradeId);
  if (!nextLevel) {
    return { allowed: false, nextLevel: null, reason: 'max_level' };
  }
  if (cashBalance < nextLevel.cost) {
    return { allowed: false, nextLevel, reason: 'insufficient_cash' };
  }
  return { allowed: true, nextLevel };
}
