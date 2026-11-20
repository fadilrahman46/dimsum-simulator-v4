import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  GitBranch,
  Lock,
  Play,
  Sparkles,
  Square,
  Zap,
} from 'lucide-react';
import {
  KITCHEN_HELPER_ROSTER,
  formatRupiah,
  getStaffMorale,
} from '../config/gameBalance';
import {
  canTrainSkillNode,
  computeHelperSkillEffects,
  getSkillNodeById,
  getSkillNodesForRole,
} from '../domain/staffSkillTree';
import { t, translateStageLabel } from '../i18n/translations';
import { useGameStore } from '../store/useGameStore';
import type { KitchenHelperRole, StaffSkillNodeDef } from '../types/game';

interface StaffSkillTreePanelProps {
  selectedRole: KitchenHelperRole;
  onSelectRole: (role: KitchenHelperRole) => void;
}

export const StaffSkillTreePanel: React.FC<StaffSkillTreePanelProps> = ({
  selectedRole,
  onSelectRole,
}) => {
  const language = useGameStore((s) => s.language);
  const currentDay = useGameStore((s) => s.currentDay);
  const cashBalance = useGameStore((s) => s.cashBalance);
  const kitchenStaff = useGameStore((s) => s.kitchenStaff);
  const activeSkillTraining = useGameStore((s) => s.activeSkillTraining);
  const startStaffSkillTraining = useGameStore((s) => s.startStaffSkillTraining);
  const cancelStaffSkillTraining = useGameStore((s) => s.cancelStaffSkillTraining);
  const completeStaffSkillTraining = useGameStore((s) => s.completeStaffSkillTraining);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [treeErr, setTreeErr] = useState<string | null>(null);

  useEffect(() => {
    if (!activeSkillTraining) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => {
      const current = Date.now();
      setNowMs(current);
      if (current >= activeSkillTraining.startedAt + activeSkillTraining.durationMs) {
        completeStaffSkillTraining();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [activeSkillTraining, completeStaffSkillTraining]);

  const helperDef = useMemo(
    () => KITCHEN_HELPER_ROSTER.find((h) => h.id === selectedRole)!,
    [selectedRole],
  );
  const hiredMember = useMemo(
    () => kitchenStaff.find((h) => h.id === selectedRole),
    [kitchenStaff, selectedRole],
  );
  const nodes = useMemo(() => getSkillNodesForRole(selectedRole), [selectedRole]);
  const totalSkillFx = useMemo(
    () => computeHelperSkillEffects(hiredMember, true),
    [hiredMember],
  );

  const rootNode = nodes.find((n) => n.tier === 1)!;
  const speedTier2 = nodes.find((n) => n.tier === 2 && n.branch === 'speed')!;
  const precisionTier2 = nodes.find((n) => n.tier === 2 && n.branch === 'precision')!;
  const speedTier3 = nodes.find((n) => n.tier === 3 && n.branch === 'speed')!;
  const precisionTier3 = nodes.find((n) => n.tier === 3 && n.branch === 'precision')!;

  const activeNode = activeSkillTraining
    ? getSkillNodeById(activeSkillTraining.nodeId)
    : undefined;
  const trainingElapsedMs = activeSkillTraining
    ? Math.max(0, nowMs - activeSkillTraining.startedAt)
    : 0;
  const trainingPct = activeSkillTraining
    ? Math.min(100, Math.round((trainingElapsedMs / activeSkillTraining.durationMs) * 100))
    : 0;
  const trainingRemainingSec = activeSkillTraining
    ? Math.max(0, (activeSkillTraining.durationMs - trainingElapsedMs) / 1000)
    : 0;

  const unlockedSet = new Set(hiredMember?.unlockedSkills ?? []);

  const renderNodeCard = (node: StaffSkillNodeDef) => {
    const unlocked = unlockedSet.has(node.id);
    const check = canTrainSkillNode(hiredMember, node.id, currentDay);
    const isTrainingThis = activeSkillTraining?.nodeId === node.id;
    const prereqNode = node.prerequisiteId ? getSkillNodeById(node.prerequisiteId) : null;
    const canAfford = cashBalance >= node.trainingCost;

    const branchLabel =
      node.branch === 'core'
        ? t(language, 'Core Drill', 'Dasar')
        : node.branch === 'speed'
          ? t(language, 'Speed Branch', 'Jalur Kecepatan')
          : t(language, 'Precision Branch', 'Jalur Presisi');

    return (
      <div
        key={node.id}
        className={`p-3.5 rounded-xl border transition-colors flex flex-col justify-between gap-2.5 ${
          unlocked
            ? 'bg-[#D9E8C8]/55 border-[#3D7A5A]'
            : isTrainingThis
              ? 'bg-[#FFFBF2] border-[#ED9B53]'
              : check.allowed
                ? 'bg-white border-[#244D3B]/25'
                : 'bg-[#F6EBD4]/50 border-[#244D3B]/10 opacity-80'
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-[11px] text-[#587567]">
            <span className="font-semibold">
              {t(language, `Tier ${node.tier} · Lv ${node.tier}+`, `Tingkat ${node.tier} · Lv ${node.tier}+`)} · {branchLabel}
            </span>
              <span className="font-mono tabular-nums font-bold text-[#244D3B] inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {node.trainingDurationSec}{t(language, 's', 'd')} · {formatRupiah(node.trainingCost)}
            </span>
          </div>

          <div className="font-bold text-sm text-[#244D3B]">
            {language === 'id' ? node.titleId : node.titleEn}
          </div>

          <p className="text-xs text-[#355446] leading-relaxed">
            {language === 'id' ? node.effectSummaryId : node.effectSummaryEn}
          </p>
        </div>

        <div>
          {unlocked ? (
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#15803D]">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{t(language, 'Mastered', 'Dikuasai')}</span>
            </div>
          ) : isTrainingThis ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums font-bold text-[#B45309]">
                <span>{t(language, 'Training in progress...', 'Sedang berlatih...')}</span>
                <span>{trainingRemainingSec.toFixed(1)}{t(language, 's', 'd')}</span>
              </div>
              <div className="h-2 w-full rounded-sm bg-[#E9DEC8] overflow-hidden">
                <div
                  className="h-full bg-[#ED9B53] transition-all duration-100"
                  style={{ width: `${trainingPct}%` }}
                />
              </div>
              <button
                type="button"
                onClick={cancelStaffSkillTraining}
                className="w-full py-1.5 px-3 rounded-lg border border-[#B91C1C]/30 text-[#B91C1C] hover:bg-[#FEE2E2] text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Square className="w-3 h-3" />
                <span>{t(language, 'Cancel Training (Refund)', 'Batalkan Latihan (Dana Kembali)')}</span>
              </button>
            </div>
          ) : check.allowed ? (
            <button
              type="button"
              disabled={Boolean(activeSkillTraining) || !canAfford}
              onClick={() => {
                const res = startStaffSkillTraining(selectedRole, node.id);
                if (!res.ok) {
                  setTreeErr(language === 'id' ? res.errorId ?? null : res.errorEn ?? null);
                } else {
                  setTreeErr(null);
                }
              }}
              className="w-full py-2 px-3 rounded-lg bg-[#244D3B] hover:bg-[#1B3A2C] disabled:opacity-45 text-white text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" />
              <span>
                {t(
                  language,
                  `Train (${node.trainingDurationSec}s) · ${formatRupiah(node.trainingCost)}`,
                  `Latih (${node.trainingDurationSec}d) · ${formatRupiah(node.trainingCost)}`,
                )}
              </span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#587567]">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>
                {!hiredMember
                  ? t(language, 'Hire specialist first', 'Rekrut asisten dahulu')
                  : check.reason === 'insufficient_level'
                    ? t(
                        language,
                        `Requires Helper Lv ${node.tier} (upgrade in Roster)`,
                        `Butuh Asisten Lv ${node.tier} (latih di Daftar Staf)`,
                      )
                    : check.reason === 'daily_limit'
                      ? t(
                          language,
                          '1 skill drill/day completed (resets tomorrow)',
                          '1 latihan skill/hari selesai (reset besok)',
                        )
                      : check.reason === 'low_morale'
                        ? t(
                            language,
                            'Morale <35% — assign Wellness shift first',
                            'Moral <35% — beri shift Wellness dahulu',
                          )
                        : prereqNode
                          ? t(
                              language,
                              `Requires: ${prereqNode.titleEn}`,
                              `Butuh: ${prereqNode.titleId}`,
                            )
                          : t(language, 'Locked', 'Terkunci')}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Staff Specialist Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {KITCHEN_HELPER_ROSTER.map((h) => {
          const member = kitchenStaff.find((m) => m.id === h.id);
          const unlockedCount = member?.unlockedSkills?.length ?? 0;
          const active = selectedRole === h.id;
          const isTrainingHere = activeSkillTraining?.helperId === h.id;
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => {
                onSelectRole(h.id);
                setTreeErr(null);
              }}
              className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                active
                  ? 'bg-[#244D3B] text-white border-[#244D3B]'
                  : 'bg-white text-[#244D3B] border-[#244D3B]/15 hover:bg-[#F6EBD4]/70'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold text-xs truncate">{h.name}</span>
                <span
                  className={`font-mono tabular-nums text-[11px] font-bold ${
                    active ? 'text-[#ED9B53]' : 'text-[#587567]'
                  }`}
                >
                  {unlockedCount}/5
                </span>
              </div>
              <div
                className={`text-[11px] mt-0.5 truncate ${
                  active ? 'text-[#D9E8C8]' : 'text-[#587567]'
                }`}
              >
                {t(
                  language,
                  `Stage: ${translateStageLabel(language, h.stage)}`,
                  `Tahap: ${translateStageLabel(language, h.stage)}`,
                )}
                {isTrainingHere ? ` · ${t(language, 'Training', 'Berlatih')}` : ''}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Training Status Bar (even when viewing another helper) */}
      {activeSkillTraining && activeNode && (
        <div className="p-3.5 rounded-xl bg-[#FFFBF2] border border-[#ED9B53] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-[#92400E]">
            <Zap className="w-4 h-4 text-[#ED9B53] shrink-0" />
            <div>
              <span className="font-bold">
                {KITCHEN_HELPER_ROSTER.find((h) => h.id === activeSkillTraining.helperId)?.name}
              </span>{' '}
              —{' '}
              <span>
                {language === 'id' ? activeNode.titleId : activeNode.titleEn}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono tabular-nums text-xs font-bold text-[#92400E]">
              {trainingRemainingSec.toFixed(1)}{t(language, 's', 'd')} ({trainingPct}%)
            </span>
            <button
              type="button"
              onClick={cancelStaffSkillTraining}
              className="px-2.5 py-1 rounded-lg border border-[#B91C1C]/30 text-[#B91C1C] text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              {t(language, 'Stop', 'Hentikan')}
            </button>
          </div>
        </div>
      )}

      {treeErr && (
        <div className="p-3 rounded-lg bg-[#FEE2E2] text-[#991B1B] text-xs font-semibold">
          {treeErr}
        </div>
      )}

      {/* Selected Helper Summary Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-white border border-[#244D3B]/15">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <GitBranch className="w-4 h-4 text-[#244D3B]" />
            <h3 className="font-display text-base font-bold text-[#244D3B]">
              {helperDef.name} — {language === 'id' ? helperDef.roleId : helperDef.roleEn}
            </h3>
            <span className="font-mono tabular-nums text-[11px] font-bold px-2 py-0.5 rounded bg-[#F6EBD4] text-[#244D3B]">
              {hiredMember
                ? t(
                    language,
                    `Lv ${hiredMember.level}/3 · Morale ${getStaffMorale(hiredMember)}%`,
                    `Lv ${hiredMember.level}/3 · Moral ${getStaffMorale(hiredMember)}%`,
                  )
                : t(language, 'Not Hired', 'Belum Direkrut')}
            </span>
          </div>
          <p className="text-xs text-[#587567] mt-0.5">
            {t(
              language,
              `Spend training time to specialize ${helperDef.name} for Stage ${translateStageLabel(language, helperDef.stage)}. Unlocked skills also boost Auto-Batch Delegation QC & speed.`,
              `Luangkan waktu latihan untuk spesialisasi ${helperDef.name} di tahap ${translateStageLabel(language, helperDef.stage)}. Skill aktif juga meningkatkan QC & kecepatan Masak Otomatis Staf.`,
            )}
          </p>
        </div>
        <div className="text-right font-mono tabular-nums text-xs">
          <div className="font-bold text-[#244D3B]">
            {unlockedSet.size} / 5 {t(language, 'Skills', 'Skill')}
          </div>
          <div className="text-[#587567]">
            {t(
              language,
              `${hiredMember?.totalTrainingSec ?? 0}s total trained`,
              `Total ${hiredMember?.totalTrainingSec ?? 0}d latihan`,
            )}
          </div>
        </div>
      </div>

      {/* Visual Branching Skill Tree */}
      <div className="p-4 rounded-xl bg-[#F6EBD4]/45 border border-[#244D3B]/12 space-y-2">
        {/* Tier 1 Root */}
        <div className="max-w-md mx-auto">{renderNodeCard(rootNode)}</div>

        {/* SVG Branching Connectors: Tier 1 -> Tier 2 (Left & Right) */}
        <div className="h-7 flex items-center justify-center" aria-hidden="true">
          <svg width="320" height="28" viewBox="0 0 320 28" className="overflow-visible">
            <path
              d="M160 0 L160 12 L75 12 L75 28"
              fill="none"
              stroke={unlockedSet.has(rootNode.id) ? '#3D7A5A' : '#B8C4BC'}
              strokeWidth="2"
            />
            <path
              d="M160 0 L160 12 L245 12 L245 28"
              fill="none"
              stroke={unlockedSet.has(rootNode.id) ? '#3D7A5A' : '#B8C4BC'}
              strokeWidth="2"
            />
          </svg>
        </div>

        {/* Tier 2 Branches (Speed Left, Precision Right) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {renderNodeCard(speedTier2)}
          {renderNodeCard(precisionTier2)}
        </div>

        {/* Straight Connectors: Tier 2 -> Tier 3 Masteries */}
        <div className="hidden md:grid grid-cols-2 gap-3 h-6" aria-hidden="true">
          <div className="flex justify-center">
            <div
              className={`w-0.5 h-full ${
                unlockedSet.has(speedTier2.id) ? 'bg-[#3D7A5A]' : 'bg-[#B8C4BC]'
              }`}
            />
          </div>
          <div className="flex justify-center">
            <div
              className={`w-0.5 h-full ${
                unlockedSet.has(precisionTier2.id) ? 'bg-[#3D7A5A]' : 'bg-[#B8C4BC]'
              }`}
            />
          </div>
        </div>

        {/* Tier 3 Masteries */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {renderNodeCard(speedTier3)}
          {renderNodeCard(precisionTier3)}
        </div>
      </div>

      {/* Cumulative Efficiency Bonus Readout */}
      <div className="p-3.5 rounded-xl bg-white border border-[#244D3B]/15 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-bold text-[#244D3B] inline-flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[#ED9B53]" />
          <span>{t(language, 'Unlocked Mini-Game Efficiency:', 'Efisiensi Mini-Game Aktif:')}</span>
        </span>
        <span className="font-mono tabular-nums text-[#355446]">
          {unlockedSet.size === 0
            ? t(language, 'None yet — train Tier 1 above', 'Belum ada — latih Tingkat 1 di atas')
            : [
                totalSkillFx.stageQualityBonus > 0
                  ? `+${totalSkillFx.stageQualityBonus} ${translateStageLabel(language, helperDef.stage)} QC`
                  : null,
                totalSkillFx.extraPreloadedItems > 0
                  ? t(
                      language,
                      `+${totalSkillFx.extraPreloadedItems} prep pre-load`,
                      `+${totalSkillFx.extraPreloadedItems} bahan awal`,
                    )
                  : null,
                totalSkillFx.fewerDistractors > 0
                  ? t(
                      language,
                      `-${totalSkillFx.fewerDistractors} distractor`,
                      `-${totalSkillFx.fewerDistractors} pengecoh`,
                    )
                  : null,
                totalSkillFx.extraWhiskStep > 0
                  ? t(
                      language,
                      `+${totalSkillFx.extraWhiskStep}%/whisk`,
                      `+${totalSkillFx.extraWhiskStep}%/aduk`,
                    )
                  : null,
                totalSkillFx.startingStirProgress > 0
                  ? t(
                      language,
                      `${totalSkillFx.startingStirProgress}% start mix`,
                      `adonan awal ${totalSkillFx.startingStirProgress}%`,
                    )
                  : null,
                totalSkillFx.extraPreFoldedPleats > 0
                  ? t(
                      language,
                      `+${totalSkillFx.extraPreFoldedPleats} pre-folds`,
                      `+${totalSkillFx.extraPreFoldedPleats} lipatan awal`,
                    )
                  : null,
                totalSkillFx.fewerSamplePieces > 0
                  ? t(
                      language,
                      `-${totalSkillFx.fewerSamplePieces} wrap sample`,
                      `-${totalSkillFx.fewerSamplePieces} sampel bentuk`,
                    )
                  : null,
                totalSkillFx.steamSpeedBonusPct > 0
                  ? t(
                      language,
                      `+${Math.round(totalSkillFx.steamSpeedBonusPct * 100)}% steam speed`,
                      `+${Math.round(totalSkillFx.steamSpeedBonusPct * 100)}% laju kukus`,
                    )
                  : null,
                totalSkillFx.startingSteamProgress > 0
                  ? t(
                      language,
                      `${totalSkillFx.startingSteamProgress}% pre-heated`,
                      `uap awal ${totalSkillFx.startingSteamProgress}%`,
                    )
                  : null,
              ]
                .filter(Boolean)
                .join(' · ') || t(language, 'Active Stage Upgrades', 'Peningkatan Tahap Aktif')}
        </span>
      </div>
    </div>
  );
};
