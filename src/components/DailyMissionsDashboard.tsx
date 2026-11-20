import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Gift,
  LayoutGrid,
  ListChecks,
  X,
} from 'lucide-react';
import { formatRupiah } from '../config/gameBalance';
import { t } from '../i18n/translations';
import { useGameStore } from '../store/useGameStore';
import type { DailyMission } from '../types/game';

export interface DailyMissionsDashboardProps {
  variant?: 'dashboard' | 'compact';
  expanded?: boolean;
  onToggleExpanded?: () => void;
  onOpenDashboard?: () => void;
}

function getMissionProgressLabel(mission: DailyMission, language: 'en' | 'id'): string {
  if (mission.type === 'EARN_REVENUE') {
    return `${formatRupiah(mission.current)} / ${formatRupiah(mission.target)}`;
  }
  const unit = language === 'id' ? mission.unitLabelId : mission.unitLabelEn;
  return `${mission.current}/${mission.target} ${unit}`;
}

function getMissionProgressPct(mission: DailyMission): number {
  return Math.min(100, Math.round((mission.current / Math.max(1, mission.target)) * 100));
}

export const DailyMissionsDashboard: React.FC<DailyMissionsDashboardProps> = ({
  variant = 'dashboard',
  expanded = true,
  onToggleExpanded,
  onOpenDashboard,
}) => {
  const language = useGameStore((s) => s.language);
  const currentDay = useGameStore((s) => s.currentDay);
  const dailyMissions = useGameStore((s) => s.dailyMissions);
  const claimDailyMission = useGameStore((s) => s.claimDailyMission);
  const claimAllDailyMissions = useGameStore((s) => s.claimAllDailyMissions);

  if (dailyMissions.length === 0) {
    if (variant === 'compact') {
      return null;
    }
    return (
      <section
        data-testid="daily-missions-dashboard"
        aria-label={t(language, 'Daily Missions Dashboard', 'Dasbor Misi Harian')}
        className="p-5 rounded-xl bg-white border border-[#244D3B]/15 text-xs text-[#587567]"
      >
        <div className="flex items-center gap-2 font-bold text-[#244D3B] text-sm">
          <ListChecks className="w-4 h-4 text-[#ED9B53] shrink-0" />
          <span>{t(language, 'Daily Missions', 'Misi Harian')}</span>
        </div>
        <p className="mt-2 leading-relaxed">
          {t(
            language,
            'Three randomized daily missions are assigned at the start of each business day.',
            'Tiga misi harian acak akan dibagikan setiap awal hari operasional.',
          )}
        </p>
      </section>
    );
  }

  const completedCount = dailyMissions.filter((m) => m.completed).length;
  const claimableMissions = dailyMissions.filter((m) => m.completed && !m.claimed);
  const totalRewardPool = dailyMissions.reduce((sum, m) => sum + m.rewardCash, 0);

  if (variant === 'compact') {
    return (
      <div
        data-testid="daily-missions-card"
        className="pointer-events-auto w-68 sm:w-80 [@media(max-height:520px)]:w-60 [@media(max-height:520px)]:sm:w-68 rounded-xl bg-[#FAF5EA] border border-[#244D3B]/20 shadow-sm px-3.5 py-2.5 text-xs"
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onToggleExpanded}
            className="flex-1 flex items-center justify-between gap-2 text-left cursor-pointer min-w-0"
            aria-expanded={expanded}
            title={
              expanded
                ? t(language, 'Minimize Daily Missions', 'Perkecil Misi Harian')
                : t(language, 'Expand Daily Missions', 'Perluas Misi Harian')
            }
          >
            <span className="inline-flex items-center gap-1.5 font-bold text-[#244D3B] min-w-0">
              <ListChecks className="w-3.5 h-3.5 text-[#ED9B53] shrink-0" />
              <span className="truncate">{t(language, 'Daily Missions', 'Misi Harian')}</span>
              <span className="font-mono text-[11px] font-semibold text-[#587567] tabular-nums shrink-0">
                {completedCount}/{dailyMissions.length}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[#587567] shrink-0">
              {claimableMissions.length > 0 && !expanded && (
                <span className="font-bold text-[#B45309] tabular-nums">
                  {t(
                    language,
                    `${claimableMissions.length} Ready`,
                    `${claimableMissions.length} Siap`,
                  )}
                </span>
              )}
              {expanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </span>
          </button>

          {claimableMissions.length > 1 && (
            <button
              type="button"
              onClick={() => claimAllDailyMissions()}
              className="px-2 py-0.5 rounded bg-[#ED9B53] hover:bg-[#E08A3C] text-[#1C3529] text-[10px] font-bold cursor-pointer whitespace-nowrap shrink-0"
            >
              {t(language, 'Claim All', 'Klaim Semua')}
            </button>
          )}

          {onOpenDashboard && (
            <button
              type="button"
              onClick={onOpenDashboard}
              title={t(language, 'Open Missions Dashboard', 'Buka Dasbor Misi')}
              aria-label={t(language, 'Open Missions Dashboard', 'Buka Dasbor Misi')}
              className="inline-flex items-center justify-center w-6 h-6 rounded border border-[#244D3B]/15 bg-[#F6EBD4]/80 hover:bg-[#D9E8C8] text-[#244D3B] cursor-pointer shrink-0"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {expanded && (
          <div className="mt-2 space-y-1.5">
            {dailyMissions.map((mission) => {
              const pct = getMissionProgressPct(mission);
              const progressLabel = getMissionProgressLabel(mission, language);
              const isClaimable = mission.completed && !mission.claimed;

              return (
                <div
                  key={mission.id}
                  className={`rounded-lg px-2.5 py-2 border ${
                    mission.claimed
                      ? 'bg-[#D9E8C8]/65 border-[#6E9B72]/50'
                      : isClaimable
                        ? 'bg-[#FFF5E1] border-[#ED9B53]'
                        : 'bg-[#F6EBD4]/60 border-[#244D3B]/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-[#244D3B] leading-snug">
                      {language === 'id' ? mission.titleId : mission.titleEn}
                    </span>
                    {isClaimable ? (
                      <button
                        type="button"
                        onClick={() => claimDailyMission(mission.id)}
                        className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#ED9B53] hover:bg-[#E08A3C] text-[#1C3529] text-[10px] font-bold font-mono tabular-nums cursor-pointer whitespace-nowrap"
                      >
                        <Gift className="w-3 h-3" />
                        <span>
                          {t(language, 'Claim', 'Klaim')} +{formatRupiah(mission.rewardCash)}
                        </span>
                      </button>
                    ) : mission.claimed ? (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-[#244D3B] font-mono tabular-nums whitespace-nowrap">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>
                          {t(language, 'Bonus Added', 'Bonus Masuk')} +{formatRupiah(mission.rewardCash)}
                        </span>
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10px] font-mono tabular-nums font-bold text-[#92400E] whitespace-nowrap">
                        +{formatRupiah(mission.rewardCash)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 flex-1 rounded-sm bg-[#E9DEC8] overflow-hidden">
                      <div
                        className={`h-full transition-all duration-200 ${
                          mission.claimed
                            ? 'bg-[#244D3B]'
                            : isClaimable
                              ? 'bg-[#ED9B53]'
                              : 'bg-[#6E9B72]'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono tabular-nums text-[#587567] shrink-0">
                      {progressLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <section
      data-testid="daily-missions-dashboard"
      aria-label={t(language, 'Daily Missions Dashboard', 'Dasbor Misi Harian')}
      className="p-4 sm:p-5 rounded-xl bg-white border border-[#244D3B]/15 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="inline-flex items-center gap-2 text-sm font-bold text-[#244D3B]">
            <ListChecks className="w-4 h-4 text-[#ED9B53] shrink-0" />
            <span>{t(language, 'Daily Missions', 'Misi Harian')}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#587567] font-mono tabular-nums">
            <span>{t(language, `Day ${currentDay}`, `Hari ${currentDay}`)}</span>
            <span aria-hidden="true">·</span>
            <span>
              {completedCount}/{dailyMissions.length}{' '}
              {t(language, 'Completed', 'Selesai')}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {formatRupiah(totalRewardPool)} {t(language, 'Total Bonus', 'Total Bonus')}
            </span>
          </div>
        </div>

        {claimableMissions.length > 0 && (
          <button
            type="button"
            onClick={() => claimAllDailyMissions()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#ED9B53] hover:bg-[#E08A3C] text-[#1C3529] text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            <Gift className="w-3.5 h-3.5 shrink-0" />
            <span>{t(language, 'Claim All Completed', 'Klaim Semua Selesai')}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {dailyMissions.map((mission) => {
          const pct = getMissionProgressPct(mission);
          const progressText = getMissionProgressLabel(mission, language);
          const isClaimable = mission.completed && !mission.claimed;

          const statusLabel = mission.claimed
            ? t(language, 'Completed · Bonus Claimed', 'Selesai · Bonus Diklaim')
            : isClaimable
              ? t(language, 'Completed · Ready to Claim', 'Selesai · Siap Diklaim')
              : t(language, 'In Progress', 'Sedang Berjalan');

          return (
            <article
              key={mission.id}
              data-testid={`daily-mission-item-${mission.id}`}
              className={`p-4 rounded-lg border flex flex-col justify-between gap-3 ${
                mission.claimed
                  ? 'bg-[#D9E8C8]/45 border-[#6E9B72]/55'
                  : isClaimable
                    ? 'bg-[#FFF5E1] border-[#ED9B53]'
                    : 'bg-[#FAF5EA] border-[#244D3B]/15'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                  <span
                    className={`inline-flex items-center gap-1.5 ${
                      mission.claimed
                        ? 'text-[#244D3B]'
                        : isClaimable
                          ? 'text-[#92400E]'
                          : 'text-[#587567]'
                    }`}
                  >
                    {mission.claimed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    ) : isClaimable ? (
                      <Gift className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{statusLabel}</span>
                  </span>
                  <span className="font-mono tabular-nums text-[#587567] shrink-0">
                    {pct}%
                  </span>
                </div>

                <h3 className="text-sm font-bold text-[#244D3B] leading-snug">
                  {language === 'id' ? mission.titleId : mission.titleEn}
                </h3>
                <p className="text-xs text-[#587567] leading-relaxed">
                  {language === 'id' ? mission.descriptionId : mission.descriptionEn}
                </p>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-[#244D3B]/10">
                <div className="flex items-center justify-between gap-2 text-xs font-mono tabular-nums">
                  <span className="text-[#355446] font-medium">{progressText}</span>
                  <span className="font-bold text-[#92400E]">
                    +{formatRupiah(mission.rewardCash)}
                  </span>
                </div>

                <div className="h-1.5 w-full rounded-sm bg-[#E9DEC8] overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 ${
                      mission.claimed
                        ? 'bg-[#244D3B]'
                        : isClaimable
                          ? 'bg-[#ED9B53]'
                          : 'bg-[#6E9B72]'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {isClaimable ? (
                  <button
                    type="button"
                    onClick={() => claimDailyMission(mission.id)}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#ED9B53] hover:bg-[#E08A3C] text-[#1C3529] text-xs font-bold cursor-pointer whitespace-nowrap transition-colors"
                  >
                    <Gift className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {t(language, 'Claim Reward', 'Klaim Hadiah')} +{formatRupiah(mission.rewardCash)}
                    </span>
                  </button>
                ) : mission.claimed ? (
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#244D3B]">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{t(language, 'Bonus Added to Wallet', 'Bonus Masuk ke Dompet')}</span>
                  </div>
                ) : (
                  <div className="text-[11px] font-medium text-[#587567]">
                    {t(
                      language,
                      'Reach the goal target to earn this bonus.',
                      'Capai target misi untuk mendapatkan bonus ini.',
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export interface DailyMissionsModalProps {
  open: boolean;
  onClose: () => void;
}

export const DailyMissionsModal: React.FC<DailyMissionsModalProps> = ({
  open,
  onClose,
}) => {
  const language = useGameStore((s) => s.language);
  const cashBalance = useGameStore((s) => s.cashBalance);

  useEffect(() => {
    if (!open) return;
    // Capture phase + stopImmediatePropagation: the world canvas also listens for Escape
    // (it toggles pause). Without this, Escape paused the game and the store update
    // re-subscribed this effect mid-dispatch, so the dashboard itself never closed.
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [open, onClose]);

  if (!open) return null;

  // Rendered through a portal: the HUD root is `pointer-events-none` and forms its own
  // stacking context, so a modal nested inside it was click-through (Close and Claim
  // buttons never received taps) and could be covered by other fixed controls.
  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 z-[45] bg-[#1B3A2C]/55 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t(language, 'Daily Missions Dashboard', 'Dasbor Misi Harian')}
    >
      <div className="w-full max-w-4xl max-h-[92vh] rounded-2xl bg-[#FAF5EA] border border-[#244D3B]/20 shadow-xl flex flex-col overflow-hidden">
        <div className="px-4 py-2.5 sm:px-5 sm:py-4 border-b border-[#244D3B]/15 bg-[#F6EBD4] flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-[#244D3B] truncate">
              {t(language, 'Daily Missions Dashboard', 'Dasbor Misi Harian')}
            </h2>
            <p className="text-xs text-[#587567] font-mono tabular-nums">
              {t(language, 'Wallet Balance', 'Saldo Dompet')}: {formatRupiah(cashBalance)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(language, 'Close', 'Tutup')}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-[#244D3B]/15 text-[#244D3B] hover:bg-[#D9E8C8] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 sm:p-5 overflow-y-auto space-y-3">
          <DailyMissionsDashboard variant="dashboard" />
        </div>
      </div>
    </div>,
    document.body,
  );
};
