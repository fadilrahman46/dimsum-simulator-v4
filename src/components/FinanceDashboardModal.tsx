import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  Crown,
  GitBranch,
  HeartPulse,
  Sparkles,
  Swords,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import {
  ACHIEVEMENTS,
  FRANCHISE_BRANCH_TEMPLATES,
  KITCHEN_HELPER_ROSTER,
  OUTLET_TIERS,
  UPGRADE_DEFS,
  WEEKLY_FESTIVALS,
  computeAverageTeamMorale,
  computeTotalFranchiseDailyIncome,
  formatRupiah,
  getEffectiveHelperQualityBonus,
  getEffectiveHelperSpeedMultiplier,
  getFranchiseBranchUpgradeCost,
  getIngredientDef,
  getKitchenHelperTrainCost,
  getNextUpcomingFestival,
  getOutletTierDef,
  getStaffMorale,
  getStaffMoraleTier,
  getTotalDailyStaffWages,
} from '../config/gameBalance';
import { buildDailyReport } from '../domain/financeEngine';
import {
  getIngredientInventoryValuation,
  getProductInventoryValuation,
} from '../domain/inventoryEngine';
import {
  ENDLESS_MASTERY_ACTIVATION_COST,
  canUnlockEndlessMastery,
  computeNetWorth,
} from '../domain/progressionEngine';
import { computeHelperSkillEffects } from '../domain/staffSkillTree';
import { canPurchaseUpgrade } from '../domain/upgradeEngine';
import { t, translateStageLabel } from '../i18n/translations';
import { useGameStore } from '../store/useGameStore';
import type { AchievementCategory, AchievementTier, KitchenHelperRole } from '../types/game';
import { DailyMissionsDashboard } from './DailyMissionsDashboard';
import { StaffSkillTreePanel } from './StaffSkillTreePanel';

export const FinanceDashboardModal: React.FC = () => {
  const language = useGameStore((s) => s.language);
  const gameState = useGameStore((s) => s.gameState);
  const currentDay = useGameStore((s) => s.currentDay);
  const dayStartCash = useGameStore((s) => s.dayStartCash);
  const cashBalance = useGameStore((s) => s.cashBalance);
  const unpaidDebt = useGameStore((s) => s.unpaidDebt);
  const transactions = useGameStore((s) => s.transactions);
  const salesOrders = useGameStore((s) => s.salesOrders);
  const productBatches = useGameStore((s) => s.productBatches);
  const ingredientLots = useGameStore((s) => s.ingredientLots);
  const dailyReports = useGameStore((s) => s.dailyReports);
  const todayStats = useGameStore((s) => s.todayStats);
  const business = useGameStore((s) => s.business);
  const upgrades = useGameStore((s) => s.upgrades);
  const kitchenStaff = useGameStore((s) => s.kitchenStaff);
  const activeSkillTraining = useGameStore((s) => s.activeSkillTraining);
  const unlockedAchievements = useGameStore((s) => s.unlockedAchievements);
  const activeFestival = useGameStore((s) => s.activeFestival);
  const rivalShop = useGameStore((s) => s.rivalShop);
  const franchiseBranches = useGameStore((s) => s.franchiseBranches);
  const endlessMasteryUnlocked = useGameStore((s) => s.endlessMasteryUnlocked);
  const prestigeLevel = useGameStore((s) => s.prestigeLevel);
  const researchedRecipeIds = useGameStore((s) => s.researchedRecipeIds);

  const purchaseUpgrade = useGameStore((s) => s.purchaseUpgrade);
  const openFranchiseBranch = useGameStore((s) => s.openFranchiseBranch);
  const upgradeFranchiseBranch = useGameStore((s) => s.upgradeFranchiseBranch);
  const activateEndlessMastery = useGameStore((s) => s.activateEndlessMastery);
  const hireKitchenHelper = useGameStore((s) => s.hireKitchenHelper);
  const trainKitchenHelper = useGameStore((s) => s.trainKitchenHelper);
  const completeStaffSkillTraining = useGameStore((s) => s.completeStaffSkillTraining);
  const setKitchenHelperShift = useGameStore((s) => s.setKitchenHelperShift);
  const fireKitchenHelper = useGameStore((s) => s.fireKitchenHelper);
  const repayDebt = useGameStore((s) => s.repayDebt);
  const advanceToNextDay = useGameStore((s) => s.advanceToNextDay);
  const closeStation = useGameStore((s) => s.closeStation);

  const [tab, setTab] = useState<'report' | 'upgrades' | 'staff' | 'ledger' | 'expansion'>('report');
  const [staffSubView, setStaffSubView] = useState<'roster' | 'skills'>('roster');
  const [selectedSkillRole, setSelectedSkillRole] = useState<KitchenHelperRole>('prep');
  const [achievementFilter, setAchievementFilter] = useState<'all' | AchievementCategory>('all');
  const [upgradeErr, setUpgradeErr] = useState<string | null>(null);
  const [staffErr, setStaffErr] = useState<string | null>(null);
  const [expansionErr, setExpansionErr] = useState<string | null>(null);
  const [confirmFireId, setConfirmFireId] = useState<KitchenHelperRole | null>(null);

  useEffect(() => {
    if (!activeSkillTraining) return;
    const remainingMs = Math.max(
      0,
      activeSkillTraining.startedAt + activeSkillTraining.durationMs - Date.now(),
    );
    const timer = window.setTimeout(() => {
      completeStaffSkillTraining();
    }, remainingMs + 30);
    return () => window.clearTimeout(timer);
  }, [activeSkillTraining, completeStaffSkillTraining]);

  const dailyPayroll = useMemo(
    () => getTotalDailyStaffWages(kitchenStaff),
    [kitchenStaff],
  );
  const averageMorale = useMemo(
    () => computeAverageTeamMorale(kitchenStaff),
    [kitchenStaff],
  );

  const closedReportToday = dailyReports.find((r) => r.day === currentDay);

  // Live preview of today's P&L even before closing store
  const activeReport = useMemo(() => {
    if (closedReportToday) return closedReportToday;
    return buildDailyReport({
      day: currentDay,
      startingCash: dayStartCash,
      endingCash: cashBalance,
      transactions,
      salesOrders,
      productBatches,
      pcsProduced: todayStats.pcsProduced,
      boxesPackaged: todayStats.boxesPackaged,
      pcsExpired: todayStats.pcsExpired,
      inventoryLossValue:
        todayStats.inventoryLossValue + (todayStats.qcWastedCost ?? 0),
      customersServed: todayStats.customersServed,
      customersLost: todayStats.customersLost,
      satisfactionSum: todayStats.satisfactionSum,
      reputationEnd: business.reputation,
    });
  }, [
    closedReportToday,
    currentDay,
    dayStartCash,
    cashBalance,
    transactions,
    salesOrders,
    productBatches,
    todayStats,
    business.reputation,
  ]);

  const ingredientValuation = useMemo(
    () => getIngredientInventoryValuation(ingredientLots, currentDay),
    [ingredientLots, currentDay],
  );
  const productValuation = useMemo(
    () => getProductInventoryValuation(productBatches, currentDay),
    [productBatches, currentDay],
  );
  const inventoryAssetValue = ingredientValuation + productValuation;
  const netWorth = useMemo(
    () =>
      computeNetWorth({
        cashBalance,
        ingredientValuation,
        productValuation,
        franchiseBranches,
        unpaidDebt,
      }),
    [cashBalance, ingredientValuation, productValuation, franchiseBranches, unpaidDebt],
  );

  const chartReports = useMemo(() => {
    if (closedReportToday) return dailyReports.slice(-7);
    return [...dailyReports, activeReport].slice(-7);
  }, [dailyReports, activeReport, closedReportToday]);

  const maxChartVal = Math.max(
    50_000,
    ...chartReports.map((r) => Math.max(r.revenue, Math.abs(r.netProfit))),
  );

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-[#1C3529]/55">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#FAF5EA] border border-[#244D3B]/20 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-4 bg-[#244D3B] text-[#FAF5EA] shrink-0">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold">
              {t(language, 'Business Report & Facility Upgrades', 'Laporan Keuangan & Upgrade Fasilitas')}
            </h2>
            <div className="text-xs text-[#D9E8C8] tabular-nums">
              {t(language, `Day ${currentDay}`, `Hari ${currentDay}`)} ·{' '}
              {t(language, 'Cash:', 'Kas:')} {formatRupiah(cashBalance)} ·{' '}
              {t(language, 'Inventory Assets:', 'Nilai Persediaan:')} {formatRupiah(inventoryAssetValue)}
              {unpaidDebt > 0 && (
                <>
                  {' · '}
                  <span className="font-bold text-[#FCA5A5]">
                    {t(language, 'Unpaid Debt:', 'Tunggakan:')} {formatRupiah(unpaidDebt)}
                  </span>
                </>
              )}
            </div>
          </div>
          {gameState !== 'FINANCIAL_REPORT' && (
            <button
              onClick={closeStation}
              className="p-2 rounded-lg hover:bg-white/10 cursor-pointer"
              aria-label="Close Report"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 pb-2 flex flex-wrap gap-1.5 border-b border-[#244D3B]/10 bg-[#F6EBD4]/60">
          <button
            onClick={() => setTab('report')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              tab === 'report' ? 'bg-[#244D3B] text-white' : 'bg-white text-[#244D3B]'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{t(language, 'Financial Report', 'Laporan Keuangan')}</span>
          </button>
          <button
            onClick={() => setTab('upgrades')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              tab === 'upgrades' ? 'bg-[#244D3B] text-white' : 'bg-white text-[#244D3B]'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>{t(language, 'Equipment Upgrades', 'Upgrade Peralatan')}</span>
          </button>
          <button
            onClick={() => {
              setTab('staff');
              setStaffErr(null);
              setConfirmFireId(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              tab === 'staff' ? 'bg-[#244D3B] text-white' : 'bg-white text-[#244D3B]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span className="tabular-nums">
              {t(language, `Kitchen Staff (${kitchenStaff.length}/4)`, `Staf Dapur (${kitchenStaff.length}/4)`)}
            </span>
          </button>
          <button
            onClick={() => setTab('ledger')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
              tab === 'ledger' ? 'bg-[#244D3B] text-white' : 'bg-white text-[#244D3B]'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>{t(language, 'Ledger & Achievements', 'Buku Kas & Prestasi')}</span>
          </button>
          <button
            onClick={() => {
              setTab('expansion');
              setExpansionErr(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
              tab === 'expansion' ? 'bg-[#244D3B] text-white' : 'bg-white text-[#244D3B]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>{t(language, 'Expansion & Rivalry', 'Ekspansi & Rival')}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {unpaidDebt > 0 && (
            <div className="p-3.5 rounded-xl bg-[#FEE2E2] border border-[#DC2626]/40 flex flex-wrap items-center justify-between gap-3 text-xs text-[#991B1B]">
              <div>
                <div className="font-bold">
                  {t(
                    language,
                    `Unpaid OPEX / Payroll Debt: ${formatRupiah(unpaidDebt)}`,
                    `Tunggakan OPEX / Gaji Usaha: ${formatRupiah(unpaidDebt)}`,
                  )}
                </div>
                <div className="mt-0.5 opacity-90">
                  {t(
                    language,
                    'Carries +10% overnight late fee and causes bankruptcy if debt reaches Rp100.000.',
                    'Menanggung bunga +10% per malam dan memicu kebangkrutan jika mencapai Rp100.000.',
                  )}
                </div>
              </div>
              <button
                type="button"
                disabled={cashBalance <= 0}
                onClick={() => repayDebt()}
                className="px-3.5 py-2 rounded-lg bg-[#991B1B] hover:bg-[#7F1D1D] disabled:opacity-45 text-white font-bold cursor-pointer whitespace-nowrap"
              >
                {t(
                  language,
                  `Pay Debt (${formatRupiah(Math.min(cashBalance, unpaidDebt))})`,
                  `Bayar Utang (${formatRupiah(Math.min(cashBalance, unpaidDebt))})`,
                )}
              </button>
            </div>
          )}

          {tab === 'report' && (
            <>
              {/* P&L Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: t(language, 'Revenue', 'Pendapatan'),
                    val: formatRupiah(activeReport.revenue),
                    color: 'text-[#244D3B]',
                  },
                  {
                    label: t(language, 'COGS (HPP Sold)', 'HPP Terjual'),
                    val: formatRupiah(activeReport.cogs),
                    color: 'text-[#587567]',
                  },
                  {
                    label: t(language, 'Gross Profit', 'Laba Kotor'),
                    val: formatRupiah(activeReport.grossProfit),
                    color: activeReport.grossProfit >= 0 ? 'text-[#244D3B]' : 'text-[#B91C1C]',
                  },
                  {
                    label: t(language, 'Net Profit', 'Laba Bersih'),
                    val: formatRupiah(activeReport.netProfit),
                    color: activeReport.netProfit >= 0 ? 'text-[#6E9B72]' : 'text-[#B91C1C]',
                  },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="p-3.5 rounded-xl bg-white border border-[#244D3B]/15"
                  >
                    <div className="text-[11px] text-[#587567] font-medium">{kpi.label}</div>
                    <div className={`font-mono tabular-nums text-lg font-bold mt-1 ${kpi.color}`}>
                      {kpi.val}
                    </div>
                  </div>
                ))}
              </div>

              {/* Detailed Statement & Operations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white border border-[#244D3B]/15 space-y-2 text-xs">
                  <div className="font-bold text-sm text-[#244D3B] mb-2">
                    {t(language, 'Cash Flow & P&L Statement', 'Arus Kas & Laba Rugi')}
                  </div>
                  {[
                    [t(language, 'Starting Cash', 'Kas Awal'), formatRupiah(activeReport.startingCash)],
                    [t(language, 'Total Supply Purchases', 'Total Belanja Bahan'), formatRupiah(activeReport.totalPurchases)],
                    [t(language, 'Operating Expenses (OPEX)', 'Biaya Operasional'), formatRupiah(activeReport.operatingExpenses)],
                    ...((activeReport.franchiseIncome ?? 0) > 0
                      ? [
                          [
                            t(language, 'Franchise Royalties', 'Royalti Waralaba'),
                            `+${formatRupiah(activeReport.franchiseIncome ?? 0)}`,
                          ],
                        ]
                      : []),
                    [t(language, 'Expired Inventory Loss', 'Kerugian Kedaluwarsa'), formatRupiah(activeReport.inventoryLossValue)],
                    [t(language, 'Ending Cash Balance', 'Saldo Kas Akhir'), formatRupiah(activeReport.endingCash)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between py-1 border-b border-[#244D3B]/8">
                      <span className="text-[#587567]">{k}</span>
                      <span className="font-mono tabular-nums font-bold text-[#244D3B]">{v}</span>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-xl bg-white border border-[#244D3B]/15 space-y-2 text-xs">
                  <div className="font-bold text-sm text-[#244D3B] mb-2">
                    {t(language, 'Operations & Service Metrics', 'Metrik Produksi & Layanan')}
                  </div>
                  {[
                    [t(language, 'Dimsum Produced', 'Dimsum Diproduksi'), `${activeReport.pcsProduced} pcs`],
                    [t(language, 'Boxes Sold / Unsold', 'Kotak Terjual / Sisa'), `${activeReport.boxesSold} / ${activeReport.boxesUnsold}`],
                    [t(language, 'Customers Served / Lost', 'Tamu Dilayani / Pergi'), `${activeReport.customersServed} / ${activeReport.customersLost}`],
                    [t(language, 'Avg Satisfaction', 'Rata-rata Kepuasan'), `${activeReport.avgCustomerSatisfaction}%`],
                    [t(language, 'Business Reputation', 'Reputasi Bisnis'), `${activeReport.reputationEnd}/100`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between py-1 border-b border-[#244D3B]/8">
                      <span className="text-[#587567]">{k}</span>
                      <span className="font-mono tabular-nums font-bold text-[#244D3B]">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Multi-Day Performance Bar Chart */}
              <div className="p-4 rounded-xl bg-white border border-[#244D3B]/15">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-[#244D3B]">
                    {t(language, 'Daily Revenue vs Net Profit Trend', 'Tren Pendapatan vs Laba Bersih Harian')}
                  </span>
                  <span className="text-[11px] text-[#587567]">
                    {t(language, 'Green: Revenue · Orange: Net Profit', 'Hijau: Pendapatan · Oranye: Laba Bersih')}
                  </span>
                </div>
                <div className="h-32 flex items-end gap-4 px-2">
                  {chartReports.map((r) => {
                    const revH = Math.max(4, Math.round((r.revenue / maxChartVal) * 100));
                    const profH = Math.max(
                      4,
                      Math.round((Math.max(0, r.netProfit) / maxChartVal) * 100),
                    );
                    return (
                      <div key={r.day} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                        <div className="w-full flex items-end justify-center gap-1.5 h-24">
                          <div
                            className="w-4 rounded-t bg-[#244D3B]"
                            style={{ height: `${revH}%` }}
                            title={`${t(language, 'Revenue', 'Pendapatan')}: ${formatRupiah(r.revenue)}`}
                          />
                          <div
                            className={`w-4 rounded-t ${r.netProfit >= 0 ? 'bg-[#ED9B53]' : 'bg-[#DC2626]'}`}
                            style={{ height: `${profH}%` }}
                            title={`${t(language, 'Net Profit', 'Laba Bersih')}: ${formatRupiah(r.netProfit)}`}
                          />
                        </div>
                        <span className="text-[11px] font-mono tabular-nums text-[#587567]">
                          {t(language, 'D', 'H')}{r.day}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <DailyMissionsDashboard variant="dashboard" />
            </>
          )}

          {tab === 'upgrades' && (
            <div className="space-y-3">
              {upgradeErr && (
                <div className="p-3 rounded-lg bg-[#FEE2E2] text-[#991B1B] text-xs font-semibold">
                  {upgradeErr}
                </div>
              )}
              {UPGRADE_DEFS.map((u) => {
                const currLvl = upgrades[u.id];
                const currDef = u.levels.find((l) => l.level === currLvl)!;
                const check = canPurchaseUpgrade(upgrades, u.id, cashBalance);

                return (
                  <div
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-white border border-[#244D3B]/15"
                  >
                    <div className="max-w-lg">
                      <div className="font-bold text-sm text-[#244D3B]">
                        {language === 'id' ? u.nameId : u.nameEn} · Lv {currLvl}/3
                      </div>
                      <div className="text-xs text-[#587567] mt-0.5">
                        {language === 'id' ? u.descriptionId : u.descriptionEn}
                      </div>
                      <div className="text-xs font-semibold text-[#6E9B72] mt-1">
                        {t(language, 'Current:', 'Saat ini:')}{' '}
                        {language === 'id' ? currDef.labelId : currDef.labelEn}
                        {check.nextLevel && (
                          <>
                            {' '}
                            → {t(language, 'Next:', 'Berikutnya:')}{' '}
                            {language === 'id' ? check.nextLevel.labelId : check.nextLevel.labelEn}
                          </>
                        )}
                      </div>
                    </div>

                    {check.nextLevel ? (
                      <button
                        onClick={() => {
                          const res = purchaseUpgrade(u.id);
                          if (!res.ok) {
                            setUpgradeErr(
                              language === 'id' ? res.errorId ?? null : res.errorEn ?? null,
                            );
                          } else {
                            setUpgradeErr(null);
                          }
                        }}
                        className="px-4 py-2.5 rounded-xl bg-[#ED9B53] hover:bg-[#DF883D] text-[#1C3529] text-xs font-bold font-mono tabular-nums cursor-pointer"
                      >
                        {t(language, 'Upgrade', 'Upgrade')} · {formatRupiah(check.nextLevel.cost)}
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-[#6E9B72]">
                        {t(language, 'MAX LEVEL', 'LEVEL MAKSIMAL')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'staff' && (
            <div className="space-y-4">
              {/* Sub-navigation: Roster & Morale vs Staff Skill Tree */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#244D3B]/10">
                <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F6EBD4]">
                  <button
                    type="button"
                    onClick={() => setStaffSubView('roster')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      staffSubView === 'roster'
                        ? 'bg-[#244D3B] text-white'
                        : 'text-[#244D3B] hover:bg-white/60'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>{t(language, 'Roster & Morale', 'Daftar & Moral Staf')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaffSubView('skills')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      staffSubView === 'skills'
                        ? 'bg-[#244D3B] text-white'
                        : 'text-[#244D3B] hover:bg-white/60'
                    }`}
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>{t(language, 'Skill Tree', 'Pohon Skill Staf')}</span>
                  </button>
                </div>

                {activeSkillTraining && (
                  <span className="text-xs font-semibold text-[#B45309] font-mono tabular-nums">
                    {t(language, 'Active skill drill running...', 'Latihan skill sedang berlangsung...')}
                  </span>
                )}
              </div>

              {staffSubView === 'skills' ? (
                <StaffSkillTreePanel
                  selectedRole={selectedSkillRole}
                  onSelectRole={setSelectedSkillRole}
                />
              ) : (
                <>
              {/* Payroll & Coverage Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-white border border-[#244D3B]/15">
                  <div className="text-[11px] text-[#587567] font-medium">
                    {t(language, 'Active Kitchen Shift', 'Staf Shift Dapur Aktif')}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="font-mono tabular-nums text-lg font-bold text-[#244D3B]">
                      {kitchenStaff.filter((h) => (h.shift ?? 'kitchen') === 'kitchen').length} /{' '}
                      {KITCHEN_HELPER_ROSTER.length}
                    </span>
                    <span
                      className={`text-[11px] font-bold ${
                        kitchenStaff.filter((h) => (h.shift ?? 'kitchen') === 'kitchen').length >= 2
                          ? 'text-[#244D3B]'
                          : 'text-[#B45309]'
                      }`}
                    >
                      {kitchenStaff.filter((h) => (h.shift ?? 'kitchen') === 'kitchen').length >= 2
                        ? t(language, 'Auto-Batch Ready', 'Auto-Batch Siap')
                        : t(language, 'Need 2+ for Auto-Batch', 'Butuh 2+ Auto-Batch')}
                    </span>
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-[#244D3B]/15">
                  <div className="text-[11px] text-[#587567] font-medium">
                    {t(language, 'Daily Payroll (Closing OPEX)', 'Gaji Harian (OPEX Tutup)')}
                  </div>
                  <div className="font-mono tabular-nums text-lg font-bold text-[#244D3B] mt-0.5">
                    {formatRupiah(dailyPayroll)}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-[#244D3B]/15">
                  <div className="text-[11px] text-[#587567] font-medium">
                    {t(language, 'Team Employee Morale', 'Moral Tim Dapur')}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="font-mono tabular-nums text-lg font-bold text-[#244D3B]">
                      {kitchenStaff.length > 0 ? `${averageMorale}%` : '—'}
                    </span>
                    <span className="text-[11px] text-[#587567] tabular-nums">
                      {t(
                        language,
                        `${kitchenStaff.filter((m) => m.shift === 'wellness').length} Wellness`,
                        `${kitchenStaff.filter((m) => m.shift === 'wellness').length} Istirahat`,
                      )}
                    </span>
                  </div>
                  {kitchenStaff.length > 0 && (
                    <div className="mt-1.5 h-1.5 w-full rounded-sm bg-[#E9DEC8] overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          averageMorale >= 80
                            ? 'bg-[#244D3B]'
                            : averageMorale >= 50
                              ? 'bg-[#6E9B72]'
                              : averageMorale >= 25
                                ? 'bg-[#ED9B53]'
                                : 'bg-[#DC2626]'
                        }`}
                        style={{ width: `${averageMorale}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="px-3.5 py-2.5 rounded-xl bg-[#F6EBD4]/75 border border-[#244D3B]/15 text-xs text-[#355446]">
                {t(
                  language,
                  'Working consecutive batches without breaks lowers Employee Morale, slowing cooking speed and reducing QC quality. Assign tired helpers to Wellness shifts to restore morale (+15% instant once/day, +18% per batch, +28% overnight).',
                  'Bekerja terus-menerus tanpa istirahat menurunkan Moral Karyawan, memperlambat masak & menurunkan kualitas QC. Atur shift Wellness untuk memulihkan moral (+15% langsung 1x/hari, +18% per batch, +28% semalam).',
                )}
              </div>

              {staffErr && (
                <div className="p-3 rounded-lg bg-[#FEE2E2] text-[#991B1B] text-xs font-semibold">
                  {staffErr}
                </div>
              )}

              <div className="space-y-3">
                {KITCHEN_HELPER_ROSTER.map((helper) => {
                  const hired = kitchenStaff.find((h) => h.id === helper.id);
                  const trainCost = hired
                    ? getKitchenHelperTrainCost(helper, hired.level)
                    : null;
                  const morale = getStaffMorale(hired);
                  const moraleTier = getStaffMoraleTier(morale);
                  const isWellness = hired?.shift === 'wellness';
                  const skillFx = computeHelperSkillEffects(hired);
                  const activeBonus =
                    getEffectiveHelperQualityBonus(hired) + skillFx.stageQualityBonus;
                  const unlockedSkillCount = hired?.unlockedSkills?.length ?? 0;
                  const speedMult = getEffectiveHelperSpeedMultiplier(hired);
                  const workStreak = hired?.consecutiveWorkBatches ?? 0;
                  const isConfirmingFire = confirmFireId === helper.id;

                  const moraleLabel =
                    moraleTier === 'high'
                      ? t(language, 'Energized (+20% speed)', 'Bersemangat (+20% cepat)')
                      : moraleTier === 'steady'
                        ? t(language, 'Steady', 'Stabil')
                        : moraleTier === 'tired'
                          ? t(language, 'Fatigued (-15% speed)', 'Lelah (-15% cepat)')
                          : t(language, 'Burned Out (-30% speed)', 'Kelelahan (-30% cepat)');

                  return (
                    <div
                      key={helper.id}
                      className={`flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border ${
                        hired
                          ? isWellness
                            ? 'bg-[#FFFBF2] border-[#ED9B53]'
                            : 'bg-white border-[#6E9B72]'
                          : 'bg-white/80 border-[#244D3B]/15'
                      }`}
                    >
                      <div className="flex-1 min-w-[260px] max-w-xl space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-[#244D3B]">
                            {helper.name}
                          </span>
                          <span className="text-xs font-semibold text-[#587567]">
                            · {language === 'id' ? helper.roleId : helper.roleEn}
                          </span>
                          {hired ? (
                            <>
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#244D3B] tabular-nums">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#6E9B72]" />
                                <span>Lv {hired.level}/3</span>
                              </span>
                              <span className="px-2 py-0.5 rounded bg-[#EEF5E6] text-[#244D3B] text-[10px] font-bold tabular-nums">
                                {t(
                                  language,
                                  `Skill Tier ${hired.level}/3`,
                                  `Skill Tingkat ${hired.level}/3`,
                                )}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  isWellness
                                    ? 'bg-[#FEF3C7] text-[#92400E]'
                                    : 'bg-[#D9E8C8] text-[#244D3B]'
                                }`}
                              >
                                {isWellness ? (
                                  <>
                                    <HeartPulse className="w-3 h-3" />
                                    <span>{t(language, 'Wellness Shift', 'Shift Wellness')}</span>
                                  </>
                                ) : (
                                  <>
                                    <ChefHat className="w-3 h-3" />
                                    <span>{t(language, 'Kitchen Shift', 'Shift Dapur')}</span>
                                  </>
                                )}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs font-medium text-[#8CA396]">
                              {t(language, 'Available', 'Tersedia')}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-[#587567]">
                          {language === 'id' ? helper.perkSummaryId : helper.perkSummaryEn}
                          {hired && hired.level < 3 && (
                            <span className="ml-1.5 font-semibold text-[#244D3B]">
                              ·{' '}
                              {t(
                                language,
                                `Lv ${hired.level + 1} unlocks Skill Tier ${hired.level + 1} & Auto-Batch power.`,
                                `Lv ${hired.level + 1} membuka Skill Tingkat ${hired.level + 1} & skor Auto-Batch.`,
                              )}
                            </span>
                          )}
                        </div>

                        {hired && (
                          <div className="p-2.5 rounded-lg bg-[#FAF5EA] border border-[#244D3B]/10 space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-bold text-[#244D3B]">
                                {t(language, 'Employee Morale', 'Moral Karyawan')}
                              </span>
                              <span
                                className={`font-mono tabular-nums font-bold ${
                                  moraleTier === 'high' || moraleTier === 'steady'
                                    ? 'text-[#244D3B]'
                                    : moraleTier === 'tired'
                                      ? 'text-[#B45309]'
                                      : 'text-[#991B1B]'
                                }`}
                              >
                                {morale}/100 · {moraleLabel}
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-sm bg-[#E9DEC8] overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  moraleTier === 'high'
                                    ? 'bg-[#244D3B]'
                                    : moraleTier === 'steady'
                                      ? 'bg-[#6E9B72]'
                                      : moraleTier === 'tired'
                                        ? 'bg-[#ED9B53]'
                                        : 'bg-[#DC2626]'
                                }`}
                                style={{ width: `${morale}%` }}
                              />
                            </div>
                            {workStreak >= 2 && !isWellness && (
                              <div className="text-[11px] font-semibold text-[#B45309] tabular-nums">
                                {t(
                                  language,
                                  `Worked ${workStreak} consecutive batches without a break — Wellness shift recommended.`,
                                  `Bekerja ${workStreak} batch berturut-turut tanpa istirahat — disarankan shift Wellness.`,
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono tabular-nums text-[#355446]">
                          <span>
                            {t(language, 'Wage:', 'Gaji:')}{' '}
                            <strong>{formatRupiah(helper.dailyWage)}</strong>/
                            {t(language, 'day', 'hari')}
                          </span>
                          {hired && (
                            <span className="text-[#244D3B] font-semibold">
                              {isWellness
                                ? t(
                                    language,
                                    'Resting on Wellness shift (+morale recovery)',
                                    'Istirahat di shift Wellness (pemulihan moral)',
                                  )
                                : t(
                                    language,
                                    `Active: ${activeBonus >= 0 ? `+${activeBonus}` : activeBonus} ${translateStageLabel(language, helper.stage)} QC · ${speedMult.toFixed(2)}x speed`,
                                    `Aktif: ${activeBonus >= 0 ? `+${activeBonus}` : activeBonus} QC ${translateStageLabel(language, helper.stage)} · ${speedMult.toFixed(2)}x cepat`,
                                  )}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {!hired ? (
                          <button
                            type="button"
                            onClick={() => {
                              const res = hireKitchenHelper(helper.id);
                              if (!res.ok) {
                                setStaffErr(
                                  language === 'id'
                                    ? res.errorId ?? null
                                    : res.errorEn ?? null,
                                );
                              } else {
                                setStaffErr(null);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#ED9B53] hover:bg-[#DF883D] text-[#1C3529] text-xs font-bold font-mono tabular-nums cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>
                              {t(language, 'Hire', 'Rekrut')} · {formatRupiah(helper.hireCost)}
                            </span>
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setKitchenHelperShift(
                                  helper.id,
                                  isWellness ? 'kitchen' : 'wellness',
                                )
                              }
                              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                                isWellness
                                  ? 'bg-[#6E9B72] hover:bg-[#5B855F] text-white'
                                  : 'bg-[#ED9B53] hover:bg-[#DF883D] text-[#1C3529]'
                              }`}
                            >
                              {isWellness ? (
                                <>
                                  <ChefHat className="w-3.5 h-3.5" />
                                  <span>{t(language, 'Return to Kitchen', 'Kembali ke Dapur')}</span>
                                </>
                              ) : (
                                <>
                                  <HeartPulse className="w-3.5 h-3.5" />
                                  <span>{t(language, 'Assign Wellness Shift', 'Atur Shift Wellness')}</span>
                                </>
                              )}
                            </button>

                            {trainCost !== null ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const res = trainKitchenHelper(helper.id);
                                  if (!res.ok) {
                                    setStaffErr(
                                      language === 'id'
                                        ? res.errorId ?? null
                                        : res.errorEn ?? null,
                                    );
                                  } else {
                                    setStaffErr(null);
                                  }
                                }}
                                className="px-3.5 py-2 rounded-xl bg-[#244D3B] hover:bg-[#1B3A2C] text-white text-xs font-bold font-mono tabular-nums cursor-pointer"
                              >
                                {t(language, `Train Lv ${hired.level + 1}`, `Latih Lv ${hired.level + 1}`)} ·{' '}
                                {formatRupiah(trainCost)}
                              </button>
                            ) : (
                              <span className="px-3 py-2 text-xs font-bold text-[#6E9B72]">
                                {t(language, 'MAX SKILL', 'SKILL MAKS')}
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSkillRole(helper.id);
                                setStaffSubView('skills');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#244D3B]/25 bg-white hover:bg-[#F6EBD4] text-[#244D3B] text-xs font-bold font-mono tabular-nums cursor-pointer whitespace-nowrap"
                            >
                              <GitBranch className="w-3.5 h-3.5" />
                              <span>
                                {t(language, 'Skills', 'Skill')} ({unlockedSkillCount}/5)
                              </span>
                            </button>

                            {isConfirmingFire ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    fireKitchenHelper(helper.id);
                                    setConfirmFireId(null);
                                    setStaffErr(null);
                                  }}
                                  className="px-3 py-2 rounded-xl bg-[#B91C1C] text-white text-xs font-bold cursor-pointer"
                                >
                                  {t(language, 'Confirm Fire', 'Yakin Pecat')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmFireId(null)}
                                  className="px-2.5 py-2 rounded-xl bg-[#F6EBD4] text-[#244D3B] text-xs font-semibold cursor-pointer"
                                >
                                  {t(language, 'Cancel', 'Batal')}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmFireId(helper.id)}
                                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#B91C1C]/30 text-[#B91C1C] hover:bg-[#FEE2E2] text-xs font-semibold cursor-pointer"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                                <span>{t(language, 'Fire', 'Pecat')}</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
                </>
              )}
            </div>
          )}

          {tab === 'ledger' && (() => {
            const achProgressPct = Math.round(
              (unlockedAchievements.length / Math.max(1, ACHIEVEMENTS.length)) * 100,
            );
            const filteredAchievements = ACHIEVEMENTS.filter(
              (a) => achievementFilter === 'all' || a.category === achievementFilter,
            );
            const tierBadgeStyle: Record<AchievementTier, { en: string; id: string; cls: string }> = {
              bronze: { en: 'Bronze', id: 'Perunggu', cls: 'bg-[#F5E1CE] text-[#7C3F1D]' },
              silver: { en: 'Silver', id: 'Perak', cls: 'bg-[#E5E7EB] text-[#374151]' },
              gold: { en: 'Gold', id: 'Emas', cls: 'bg-[#FEF3C7] text-[#92400E]' },
            };
            const filterOptions: Array<{ id: 'all' | AchievementCategory; en: string; idLabel: string }> = [
              { id: 'all', en: 'All', idLabel: 'Semua' },
              { id: 'production', en: 'Production', idLabel: 'Produksi' },
              { id: 'sales', en: 'Sales', idLabel: 'Penjualan' },
              { id: 'service', en: 'Service', idLabel: 'Layanan' },
              { id: 'finance', en: 'Finance', idLabel: 'Keuangan' },
              { id: 'progression', en: 'Progression', idLabel: 'Progres' },
            ];
            return (
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-[#244D3B] inline-flex items-center gap-2">
                    <span>{t(language, 'Business Achievements', 'Pencapaian Bisnis')}</span>
                    <span className="px-2 py-0.5 rounded-md bg-[#EEF5E6] text-[#244D3B] font-mono tabular-nums text-[11px]">
                      {unlockedAchievements.length}/{ACHIEVEMENTS.length} ({achProgressPct}%)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {filterOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAchievementFilter(opt.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                          achievementFilter === opt.id
                            ? 'bg-[#244D3B] text-white'
                            : 'bg-white text-[#244D3B] border border-[#244D3B]/15'
                        }`}
                      >
                        {language === 'id' ? opt.idLabel : opt.en}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-2 w-full rounded-sm bg-[#E9DEC8] overflow-hidden">
                  <div
                    className="h-full bg-[#244D3B] transition-all duration-300"
                    style={{ width: `${achProgressPct}%` }}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {filteredAchievements.map((ach) => {
                    const earned = unlockedAchievements.includes(ach.id);
                    const tierMeta = tierBadgeStyle[ach.tier ?? 'bronze'];
                    return (
                      <div
                        key={ach.id}
                        className={`p-3 rounded-xl border text-xs ${
                          earned
                            ? 'bg-[#D9E8C8]/70 border-[#6E9B72] text-[#244D3B]'
                            : 'bg-white border-[#244D3B]/10 text-[#6B8276]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold">
                            {language === 'id' ? ach.titleId : ach.titleEn}
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${tierMeta.cls}`}>
                            {language === 'id' ? tierMeta.id : tierMeta.en}
                          </span>
                        </div>
                        <div className="mt-0.5">
                          {language === 'id' ? ach.descriptionId : ach.descriptionEn}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-[#244D3B] mb-2">
                  {t(language, 'Recent Financial Transactions', 'Riwayat Transaksi Keuangan')}
                </div>
                <div className="space-y-1.5">
                  {transactions
                    .slice(-15)
                    .reverse()
                    .map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-[#244D3B]/10 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-[#244D3B]">
                            {language === 'id' ? tx.descriptionId : tx.descriptionEn}
                          </span>
                          <span className="text-[#587567] ml-2">
                            ({t(language, `Day ${tx.day}`, `Hari ${tx.day}`)})
                          </span>
                        </div>
                        <span
                          className={`font-mono tabular-nums font-bold ${
                            tx.type === 'INCOME' ? 'text-[#244D3B]' : 'text-[#B91C1C]'
                          }`}
                        >
                          {tx.type === 'INCOME' ? '+' : '-'}
                          {formatRupiah(tx.amount)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
            );
          })()}

          {tab === 'expansion' && (() => {
            const currentTier = getOutletTierDef(business.level);
            const totalBranchIncome = computeTotalFranchiseDailyIncome(
              franchiseBranches,
              prestigeLevel,
            );
            const masteryCheck = canUnlockEndlessMastery({
              businessLevel: business.level,
              reputation: business.reputation,
              franchiseBranchesCount: franchiseBranches.length,
              cashBalance,
            });
            const playerSharePct = Math.max(0, 100 - rivalShop.marketSharePct);
            const nextFest = getNextUpcomingFestival(currentDay);
            const affectedIngNames = rivalShop.focusIngredientIds
              .map((fid) => {
                const def = getIngredientDef(fid);
                return def ? (language === 'id' ? def.nameId : def.nameEn) : fid;
              })
              .join(', ');

            return (
              <div className="space-y-5">
                {expansionErr && (
                  <div className="p-3 rounded-lg bg-[#FEE2E2] text-[#991B1B] text-xs font-semibold">
                    {expansionErr}
                  </div>
                )}

                {/* 1. Outlet Scale Tier & Net Worth Roadmap */}
                <div className="p-4 rounded-xl bg-white border border-[#244D3B]/15 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#587567]">
                        {t(language, 'Outlet Scale Progression', 'Jenjang Skala Usaha')}
                      </div>
                      <div className="font-display text-lg font-bold text-[#244D3B]">
                        Lv {business.level} ·{' '}
                        {language === 'id' ? currentTier.nameId : currentTier.nameEn}
                        {prestigeLevel > 0 && (
                          <span className="ml-2 text-sm text-[#B45309] font-mono tabular-nums">
                            ★{prestigeLevel}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div className="text-[11px] text-[#587567]">
                        {t(language, 'Business Net Worth', 'Kekayaan Bersih Usaha')}
                      </div>
                      <div className="text-base font-bold text-[#244D3B]">
                        {formatRupiah(netWorth)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    {OUTLET_TIERS.map((tier) => {
                      const reached = business.level >= tier.level;
                      const isCurrent = currentTier.level === tier.level;
                      return (
                        <div
                          key={tier.level}
                          className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                            isCurrent
                              ? 'bg-[#D9E8C8]/75 border-[#244D3B]'
                              : reached
                                ? 'bg-[#EEF5E6] border-[#6E9B72]/50'
                                : 'bg-[#FAF5EA] border-[#244D3B]/10 text-[#587567]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 font-bold text-[#244D3B]">
                            <span className="font-mono tabular-nums">Lv {tier.level}</span>
                            {reached && <CheckCircle2 className="w-3.5 h-3.5 text-[#244D3B]" />}
                          </div>
                          <div className="font-bold text-[#244D3B]">
                            {language === 'id' ? tier.nameId : tier.nameEn}
                          </div>
                          <div className="text-[11px] leading-snug text-[#355446]">
                            {language === 'id' ? tier.perksId : tier.perksEn}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Franchise Branch Expansion & Endless Mastery */}
                <div className="p-4 rounded-xl bg-white border border-[#244D3B]/15 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 font-bold text-sm text-[#244D3B]">
                      <Building2 className="w-4 h-4 text-[#ED9B53]" />
                      <span>
                        {t(
                          language,
                          `Franchise Branches (${franchiseBranches.length}/${FRANCHISE_BRANCH_TEMPLATES.length})`,
                          `Ekspansi Cabang Waralaba (${franchiseBranches.length}/${FRANCHISE_BRANCH_TEMPLATES.length})`,
                        )}
                      </span>
                    </div>
                    <div className="font-mono tabular-nums text-xs font-bold text-[#244D3B]">
                      {t(language, 'Daily Passive Royalties:', 'Royalti Pasif Harian:')}{' '}
                      +{formatRupiah(totalBranchIncome)}/{t(language, 'day', 'hari')}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {FRANCHISE_BRANCH_TEMPLATES.map((tpl) => {
                      const owned = franchiseBranches.find((b) => b.id === tpl.id);
                      const upgradeCost = owned ? getFranchiseBranchUpgradeCost(owned) : null;
                      const meetsLevel = business.level >= tpl.minBusinessLevel;
                      const meetsRep = business.reputation >= tpl.minReputation;
                      const meetsCash = cashBalance >= tpl.investmentCost;
                      const canOpen = !owned && meetsLevel && meetsRep && meetsCash;
                      const prestigeMult = 1 + Math.max(0, prestigeLevel) * 0.15;
                      const effectiveDaily = owned
                        ? Math.round(owned.dailyNetIncome * prestigeMult)
                        : Math.round(tpl.baseDailyIncome * prestigeMult);

                      return (
                        <div
                          key={tpl.id}
                          className={`p-3.5 rounded-xl border space-y-2 text-xs ${
                            owned
                              ? 'bg-[#EEF5E6] border-[#6E9B72]'
                              : 'bg-[#FAF5EA]/70 border-[#244D3B]/15'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-bold text-sm text-[#244D3B]">
                                {language === 'id' ? tpl.districtNameId : tpl.districtNameEn}
                              </div>
                              <div className="text-[11px] text-[#587567] mt-0.5">
                                {language === 'id' ? tpl.descriptionId : tpl.descriptionEn}
                              </div>
                            </div>
                            {owned && (
                              <span className="font-mono tabular-nums font-bold text-[#244D3B] shrink-0">
                                Lv {owned.level}/3
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono tabular-nums">
                            <span className="font-bold text-[#244D3B]">
                              +{formatRupiah(effectiveDaily)}/{t(language, 'day', 'hari')}
                            </span>

                            {!owned ? (
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-[11px] text-[#587567]">
                                  {t(
                                    language,
                                    `Req: Lv ${tpl.minBusinessLevel}+ · Rep ${tpl.minReputation}+`,
                                    `Syarat: Lv ${tpl.minBusinessLevel}+ · Rep ${tpl.minReputation}+`,
                                  )}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const res = openFranchiseBranch(tpl.id);
                                    if (!res.ok) {
                                      setExpansionErr(
                                        language === 'id'
                                          ? res.errorId ?? null
                                          : res.errorEn ?? null,
                                      );
                                    } else {
                                      setExpansionErr(null);
                                    }
                                  }}
                                  className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap ${
                                    canOpen
                                      ? 'bg-[#ED9B53] hover:bg-[#DF883D] text-[#1C3529]'
                                      : 'bg-[#E9DEC8] text-[#355446]'
                                  }`}
                                >
                                  {t(language, 'Open Branch', 'Buka Cabang')} ·{' '}
                                  {formatRupiah(tpl.investmentCost)}
                                </button>
                              </div>
                            ) : upgradeCost !== null ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const res = upgradeFranchiseBranch(owned.id);
                                  if (!res.ok) {
                                    setExpansionErr(
                                      language === 'id'
                                        ? res.errorId ?? null
                                        : res.errorEn ?? null,
                                    );
                                  } else {
                                    setExpansionErr(null);
                                  }
                                }}
                                className="px-3.5 py-2 rounded-lg bg-[#244D3B] hover:bg-[#1B3A2C] text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                              >
                                {t(language, `Expand Lv ${owned.level + 1}`, `Ekspansi Lv ${owned.level + 1}`)} ·{' '}
                                {formatRupiah(upgradeCost)}
                              </button>
                            ) : (
                              <span className="font-bold text-[#244D3B]">
                                {t(language, 'MAX BRANCH', 'CABANG MAKS')}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Endless Mastery Endgame Card */}
                  <div className="p-3.5 rounded-xl bg-[#FFFBF2] border border-[#ED9B53] flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5 max-w-xl">
                      <div className="inline-flex items-center gap-1.5 font-bold text-sm text-[#1C3529]">
                        <Crown className="w-4 h-4 text-[#D97706]" />
                        <span>
                          {endlessMasteryUnlocked
                            ? t(
                                language,
                                `Endless Mastery Mode · Rank ★${prestigeLevel}`,
                                `Mode Endless Mastery · Peringkat ★${prestigeLevel}`,
                              )
                            : t(
                                language,
                                'Endgame: Endless Mastery Certification',
                                'Endgame: Sertifikasi Endless Mastery',
                              )}
                        </span>
                      </div>
                      <div className="text-[#587567]">
                        {t(
                          language,
                          `Requires Outlet Lv 5, Reputation 80+, 1+ Branch, and ${formatRupiah(ENDLESS_MASTERY_ACTIVATION_COST)}. Grants +15% passive royalties across all branches per Prestige rank.`,
                          `Butuh Outlet Lv 5, Reputasi 80+, 1+ Cabang, dan biaya ${formatRupiah(ENDLESS_MASTERY_ACTIVATION_COST)}. Menambah royalti semua cabang +15% per peringkat Prestise.`,
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const res = activateEndlessMastery();
                        if (!res.ok) {
                          setExpansionErr(
                            language === 'id' ? res.errorId ?? null : res.errorEn ?? null,
                          );
                        } else {
                          setExpansionErr(null);
                        }
                      }}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold font-mono tabular-nums cursor-pointer whitespace-nowrap ${
                        masteryCheck.allowed
                          ? 'bg-[#244D3B] hover:bg-[#1B3A2C] text-white'
                          : 'bg-[#E9DEC8] text-[#355446]'
                      }`}
                    >
                      {endlessMasteryUnlocked
                        ? t(
                            language,
                            `Ascend Rank ★${prestigeLevel + 1} · ${formatRupiah(ENDLESS_MASTERY_ACTIVATION_COST)}`,
                            `Naik Peringkat ★${prestigeLevel + 1} · ${formatRupiah(ENDLESS_MASTERY_ACTIVATION_COST)}`,
                          )
                        : t(
                            language,
                            `Unlock Endless Mastery · ${formatRupiah(ENDLESS_MASTERY_ACTIVATION_COST)}`,
                            `Aktifkan Endless Mastery · ${formatRupiah(ENDLESS_MASTERY_ACTIVATION_COST)}`,
                          )}
                    </button>
                  </div>
                </div>

                {/* 3. Rival Shop Tracker & 4. Weekly Culinary Festival Calendar */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Rival Shop Tracker */}
                  <div className="p-4 rounded-xl bg-white border border-[#244D3B]/15 space-y-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-bold text-sm text-[#244D3B]">
                        <Swords className="w-4 h-4 text-[#B91C1C]" />
                        <span>
                          {t(language, 'Rival Competition:', 'Persaingan Rival:')}{' '}
                          {rivalShop.name}
                        </span>
                      </span>
                      <span className="font-mono tabular-nums font-bold text-[#244D3B]">
                        {t(language, `You ${playerSharePct}%`, `Toko ${playerSharePct}%`)} vs{' '}
                        <span className="text-[#991B1B]">{rivalShop.marketSharePct}%</span>
                      </span>
                    </div>

                    <div className="h-2.5 w-full rounded-sm bg-[#FEE2E2] overflow-hidden flex">
                      <div
                        className="h-full bg-[#244D3B] transition-all duration-300"
                        style={{ width: `${playerSharePct}%` }}
                      />
                    </div>

                    <div className="space-y-1 text-[#355446]">
                      <div>
                        <span className="font-semibold text-[#244D3B]">
                          {t(language, 'Active Focus:', 'Kampanye Aktif:')}{' '}
                        </span>
                        {language === 'id' ? rivalShop.specialtyId : rivalShop.specialtyEn}
                      </div>
                      <div>
                        <span className="font-semibold text-[#244D3B]">
                          {t(language, 'Market Pressure (+15%):', 'Kenaikan Bahan (+15%):')}{' '}
                        </span>
                        <span className="text-[#991B1B] font-semibold">{affectedIngNames}</span>
                      </div>
                      <div className="text-[#587567] pt-1 border-t border-[#244D3B]/10 tabular-nums">
                        {t(
                          language,
                          `Counterplay: ${researchedRecipeIds.length} R&D formulas researched & Shop Rep ${business.reputation}/100 erode rival share over time. Use Supplier Bulk Deals to offset price surges.`,
                          `Strategi: ${researchedRecipeIds.length} riset R&D aktif & Reputasi ${business.reputation}/100 terus menekan pangsa rival. Manfaatkan Nego Grosir Pemasok untuk meredam lonjakan harga.`,
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Weekly Culinary Festival Calendar */}
                  <div className="p-4 rounded-xl bg-white border border-[#244D3B]/15 space-y-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-bold text-sm text-[#244D3B]">
                        <CalendarDays className="w-4 h-4 text-[#D97706]" />
                        <span>
                          {t(language, 'Weekly Culinary Festival', 'Kalender Festival Mingguan')}
                        </span>
                      </span>
                      <span className="font-mono tabular-nums font-bold text-[#92400E]">
                        {activeFestival
                          ? t(language, 'LIVE TODAY!', 'BERLANGSUNG!')
                          : t(
                              language,
                              `${nextFest.daysUntil}d until Day ${nextFest.festivalDay}`,
                              `${nextFest.daysUntil}h menuju Hari ${nextFest.festivalDay}`,
                            )}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {WEEKLY_FESTIVALS.map((fest, idx) => {
                        const isLive = activeFestival?.id === fest.id;
                        const isUpcoming = !activeFestival && nextFest.festival.id === fest.id;
                        const cycleDay = (idx + 1) * 7;
                        return (
                          <div
                            key={fest.id}
                            className={`p-2.5 rounded-lg border ${
                              isLive
                                ? 'bg-[#FFF3DC] border-[#ED9B53]'
                                : isUpcoming
                                  ? 'bg-[#EEF5E6] border-[#6E9B72]/50'
                                  : 'bg-[#FAF5EA] border-[#244D3B]/10'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 font-bold text-[#244D3B]">
                              <span className="inline-flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-[#D97706]" />
                                <span>{language === 'id' ? fest.titleId : fest.titleEn}</span>
                              </span>
                              <span className="font-mono tabular-nums text-[11px] text-[#92400E]">
                                {isLive
                                  ? t(language, 'TODAY · 2x · +15%', 'HARI INI · 2x · +15%')
                                  : t(language, `Day ${cycleDay} cycle`, `Siklus H${cycleDay}`)}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#587567] mt-0.5">
                              {language === 'id' ? fest.themeHintId : fest.themeHintEn}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Footer for End-of-Day Advance */}
        {gameState === 'FINANCIAL_REPORT' && (
          <div className="px-6 py-4 bg-white border-t border-[#244D3B]/15 flex items-center justify-between gap-3">
            <div className="text-xs text-[#587567]">
              {t(
                language,
                'Ready to start tomorrow? Unsold expired stock will be audited at dawn.',
                'Siap memulai hari esok? Stok kedaluwarsa akan diaudit saat pagi.',
              )}
            </div>
            <button
              onClick={advanceToNextDay}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#ED9B53] hover:bg-[#DF883D] text-[#1C3529] font-bold text-sm cursor-pointer whitespace-nowrap"
            >
              <span>
                {t(language, `Start Day ${currentDay + 1}`, `Mulai Hari ${currentDay + 1}`)}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
