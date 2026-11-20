import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpDown,
  BookOpen,
  CheckCircle2,
  ChefHat,
  Clock,
  FlaskConical,
  Layers,
  Lock,
  PlusCircle,
  Sparkles,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import {
  INGREDIENTS,
  RECIPE_RESEARCH_DEFS,
  doesRecipeMatchFestival,
  formatRupiah,
  getIngredientDef,
} from '../config/gameBalance';
import {
  MIN_ACTIVE_HELPERS_FOR_DELEGATION,
  checkDelegationEligibility,
  computeDelegatedCookingPlan,
  getPrepHygieneBonus,
  getSteamerMaxBatchPcs,
} from '../domain/productionEngine';
import {
  checkRecipeAvailability,
  estimateRecipeIngredientCost,
  validateCustomRecipeIngredients,
} from '../domain/recipeEngine';
import { t } from '../i18n/translations';
import { useGameStore } from '../store/useGameStore';
import type { RecipeDef, RecipeIngredientReq } from '../types/game';

interface ComplexityMeta {
  level: 1 | 2 | 3;
  labelEn: string;
  labelId: string;
  hintEn: string;
  hintId: string;
  barActiveClass: string;
  barActiveSelectedClass: string;
  textClass: string;
}

function getComplexityMeta(recipe: RecipeDef): ComplexityMeta {
  const level: 1 | 2 | 3 =
    recipe.difficulty === 'easy'
      ? 1
      : recipe.difficulty === 'hard'
        ? 3
        : 2;

  if (level === 1) {
    return {
      level: 1,
      labelEn: 'Simple',
      labelId: 'Sederhana',
      hintEn: 'Fast prep & high throughput',
      hintId: 'Cepat dimasak & efisien',
      barActiveClass: 'bg-[#244D3B]',
      barActiveSelectedClass: 'bg-[#A7F3D0]',
      textClass: 'text-[#244D3B]',
    };
  }
  if (level === 2) {
    return {
      level: 2,
      labelEn: 'Moderate',
      labelId: 'Sedang',
      hintEn: 'Balanced steps & quality',
      hintId: 'Langkah & kualitas seimbang',
      barActiveClass: 'bg-[#D97706]',
      barActiveSelectedClass: 'bg-[#FCD34D]',
      textClass: 'text-[#B45309]',
    };
  }
  return {
    level: 3,
    labelEn: 'Complex',
    labelId: 'Kompleks',
    hintEn: 'Multi-step artisan dish',
    hintId: 'Banyak bahan & butuh ketelitian',
    barActiveClass: 'bg-[#B91C1C]',
    barActiveSelectedClass: 'bg-[#FCA5A5]',
    textClass: 'text-[#991B1B]',
  };
}

const ComplexityGauge: React.FC<{
  level: 1 | 2 | 3;
  activeClass: string;
  inactiveClass: string;
}> = ({ level, activeClass, inactiveClass }) => (
  <span className="inline-flex items-end gap-0.5" aria-hidden="true">
    {[1, 2, 3].map((step) => {
      const heightClass = step === 1 ? 'h-2' : step === 2 ? 'h-2.5' : 'h-3';
      return (
        <span
          key={step}
          className={`w-1.5 rounded-[1px] ${heightClass} ${
            step <= level ? activeClass : inactiveClass
          }`}
        />
      );
    })}
  </span>
);

export const RecipeBookModal: React.FC = () => {
  const language = useGameStore((s) => s.language);
  const recipes = useGameStore((s) => s.recipes);
  const ingredientLots = useGameStore((s) => s.ingredientLots);
  const currentDay = useGameStore((s) => s.currentDay);
  const activeMarketEvent = useGameStore((s) => s.activeMarketEvent);
  const upgrades = useGameStore((s) => s.upgrades);
  const cashBalance = useGameStore((s) => s.cashBalance);
  const kitchenStaff = useGameStore((s) => s.kitchenStaff);
  const activeCooking = useGameStore((s) => s.activeCooking);
  const activeDelegation = useGameStore((s) => s.activeDelegation);
  const activeDailyEvent = useGameStore((s) => s.activeDailyEvent);
  const activeFestival = useGameStore((s) => s.activeFestival);
  const rivalShop = useGameStore((s) => s.rivalShop);

  const researchedRecipeIds = useGameStore((s) => s.researchedRecipeIds);

  const startCookingSession = useGameStore((s) => s.startCookingSession);
  const startDelegatedCooking = useGameStore((s) => s.startDelegatedCooking);
  const unlockRecipe = useGameStore((s) => s.unlockRecipe);
  const researchRecipe = useGameStore((s) => s.researchRecipe);
  const createCustomRecipe = useGameStore((s) => s.createCustomRecipe);
  const openStation = useGameStore((s) => s.openStation);
  const closeStation = useGameStore((s) => s.closeStation);

  const [tab, setTab] = useState<'recipes' | 'research' | 'custom'>('recipes');
  const [selectedId, setSelectedId] = useState(recipes[0]?.id ?? 'chicken_carrot');
  const [batchCount, setBatchCount] = useState(1);
  const [sortByEfficiency, setSortByEfficiency] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [researchErr, setResearchErr] = useState<string | null>(null);

  // Custom recipe form state
  const [customName, setCustomName] = useState('Healthy Signature Dimsum');
  const [customReqs, setCustomReqs] = useState<Record<string, number>>({
    chicken: 70,
    spinach: 50,
    carrot: 30,
    wrapper: 10,
    tapioca: 20,
    garlic: 5,
    seasoning: 4,
  });

  const maxPcs = getSteamerMaxBatchPcs(upgrades);
  const maxBatches = Math.max(1, Math.floor(maxPcs / 10));

  const sortedRecipes = useMemo(() => {
    if (!sortByEfficiency) return recipes;
    const rank = { easy: 1, medium: 2, hard: 3 } as const;
    return [...recipes].sort((a, b) => {
      const diffDelta = rank[a.difficulty] - rank[b.difficulty];
      if (diffDelta !== 0) return diffDelta;
      const timeDelta = a.productionTimeSec - b.productionTimeSec;
      if (timeDelta !== 0) return timeDelta;
      return a.ingredients.length - b.ingredients.length;
    });
  }, [recipes, sortByEfficiency]);

  const selectedRecipe = useMemo(
    () => recipes.find((r) => r.id === selectedId) ?? recipes[0],
    [recipes, selectedId],
  );

  const selectedComplexity = useMemo(
    () => (selectedRecipe ? getComplexityMeta(selectedRecipe) : null),
    [selectedRecipe],
  );

  const availability = useMemo(
    () =>
      selectedRecipe
        ? checkRecipeAvailability(selectedRecipe, ingredientLots, currentDay, batchCount)
        : { canProduce: false, missing: [] },
    [selectedRecipe, ingredientLots, currentDay, batchCount],
  );

  const estimatedIngCost = useMemo(
    () =>
      selectedRecipe
        ? estimateRecipeIngredientCost(
            selectedRecipe,
            ingredientLots,
            currentDay,
            activeMarketEvent,
            rivalShop.focusIngredientIds,
          ) * batchCount
        : 0,
    [selectedRecipe, ingredientLots, currentDay, activeMarketEvent, rivalShop.focusIngredientIds, batchCount],
  );

  const delegationCheck = useMemo(
    () =>
      checkDelegationEligibility({
        kitchenStaff,
        activeCooking,
        activeDelegation,
      }),
    [kitchenStaff, activeCooking, activeDelegation],
  );

  const delegatedPlan = useMemo(() => {
    if (!selectedRecipe) return null;
    const hygieneBase = Math.min(
      100,
      91 + getPrepHygieneBonus(upgrades) + (selectedRecipe.researched ? 4 : 0),
    );
    return computeDelegatedCookingPlan({
      recipe: selectedRecipe,
      batchCount,
      kitchenStaff,
      hygieneBase,
      activeDailyEvent,
    });
  }, [selectedRecipe, batchCount, kitchenStaff, upgrades, activeDailyEvent]);

  const handleStartCooking = () => {
    if (!selectedRecipe) return;
    const res = startCookingSession(selectedRecipe.id, batchCount);
    if (!res.ok) {
      setErrorMsg(language === 'id' ? res.errorId ?? null : res.errorEn ?? null);
    }
  };

  const handleDelegateCooking = () => {
    if (!selectedRecipe) return;
    const res = startDelegatedCooking(selectedRecipe.id, batchCount);
    if (!res.ok) {
      setErrorMsg(language === 'id' ? res.errorId ?? null : res.errorEn ?? null);
    }
  };

  const handleSaveCustomRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    const list: RecipeIngredientReq[] = Object.entries(customReqs)
      .filter(([, qty]) => qty > 0)
      .map(([ingredientId, quantity]) => ({ ingredientId, quantity }));

    const validation = validateCustomRecipeIngredients(list);
    if (!validation.valid) {
      setErrorMsg(
        t(
          language,
          'Custom recipes need at least 10 wrappers and 1 protein or vegetable filling.',
          'Resep kustom butuh minimal 10 kulit dimsum dan 1 isian protein/sayur.',
        ),
      );
      return;
    }

    const isVeg = !list.some((r) => r.ingredientId === 'chicken' || r.ingredientId === 'shrimp');
    const customDifficulty: RecipeDef['difficulty'] =
      list.length <= 5 ? 'easy' : list.length <= 7 ? 'medium' : 'hard';
    createCustomRecipe({
      nameEn: customName.trim() || 'Custom Dimsum',
      nameId: customName.trim() || 'Dimsum Kustom',
      descriptionEn: 'Player-created healthy dimsum formulation.',
      descriptionId: 'Formulasi dimsum sehat kreasi sendiri.',
      batchSize: 10,
      productionTimeSec: 40 + list.length * 4,
      difficulty: customDifficulty,
      baseQuality: 78,
      shelfLifeDays: 2,
      isVegetarian: isVeg,
      accentColor: '#6E9B72',
      ingredients: list,
    });
    setTab('recipes');
    setErrorMsg(null);
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-[#1C3529]/55">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#FAF5EA] border border-[#244D3B]/20 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-4 bg-[#244D3B] text-[#FAF5EA] shrink-0">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold">
              {t(language, 'Preparation, Recipe Book & R&D', 'Persiapan, Buku Resep & Riset')}
            </h2>
            <div className="text-xs text-[#D9E8C8] tabular-nums">
              {t(
                language,
                `Steamer Limit: ${maxPcs} pcs / session · Cash: ${formatRupiah(cashBalance)}`,
                `Kapasitas Kukusan: ${maxPcs} pcs / sesi · Kas: ${formatRupiah(cashBalance)}`,
              )}
            </div>
          </div>
          <button
            onClick={closeStation}
            className="p-2 rounded-lg hover:bg-white/10 cursor-pointer"
            aria-label="Close Recipes"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 sm:px-6 pt-2.5 pb-2 flex flex-wrap gap-1.5 border-b border-[#244D3B]/10 bg-[#F6EBD4]/60 shrink-0">
          <button
            type="button"
            onClick={() => {
              setTab('recipes');
              setErrorMsg(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              tab === 'recipes' ? 'bg-[#244D3B] text-white' : 'bg-white text-[#244D3B]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{t(language, 'Recipes', 'Daftar Resep')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('research');
              setResearchErr(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              tab === 'research' ? 'bg-[#244D3B] text-white' : 'bg-white text-[#244D3B]'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span className="tabular-nums">
              {t(
                language,
                `Research (${researchedRecipeIds.length}/${RECIPE_RESEARCH_DEFS.length})`,
                `Riset (${researchedRecipeIds.length}/${RECIPE_RESEARCH_DEFS.length})`,
              )}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('custom');
              setErrorMsg(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              tab === 'custom' ? 'bg-[#244D3B] text-white' : 'bg-white text-[#244D3B]'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{t(language, 'Custom Recipe', 'Buat Resep')}</span>
          </button>
        </div>

        {activeFestival && (
          <div className="px-6 py-2 bg-[#FFF3DC] border-b border-[#ED9B53]/40 flex flex-wrap items-center justify-between gap-2 text-xs text-[#1C3529]">
            <span className="inline-flex items-center gap-1.5 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
              <span>
                {t(language, 'Weekly Culinary Festival:', 'Festival Kuliner Mingguan:')}{' '}
                {language === 'id' ? activeFestival.titleId : activeFestival.titleEn}
              </span>
            </span>
            <span className="font-mono tabular-nums font-bold text-[#92400E]">
              {t(
                language,
                `Featured: ${activeFestival.themeHintEn} (+15% Rev · 2x Traffic)`,
                `Unggulan: ${activeFestival.themeHintId} (+15% Omzet · 2x Tamu)`,
              )}
            </span>
          </div>
        )}

        {tab === 'custom' ? (
          <form onSubmit={handleSaveCustomRecipe} className="flex-1 overflow-y-auto p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#244D3B] mb-1">
                {t(language, 'Custom Recipe Name', 'Nama Resep Kustom')}
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                maxLength={36}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#244D3B]/20 text-sm font-medium"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {INGREDIENTS.map((ing) => (
                <div
                  key={ing.id}
                  className="p-3 rounded-xl bg-white border border-[#244D3B]/15 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="text-xs font-semibold text-[#244D3B]">
                      {language === 'id' ? ing.nameId : ing.nameEn}
                    </div>
                    <div className="text-[11px] text-[#587567]">{ing.unit}</div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={300}
                    step={ing.id === 'wrapper' ? 10 : 5}
                    value={customReqs[ing.id] ?? 0}
                    onChange={(e) =>
                      setCustomReqs((prev) => ({
                        ...prev,
                        [ing.id]: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-16 px-2 py-1 rounded-lg border border-[#244D3B]/20 text-right font-mono tabular-nums text-xs"
                  />
                </div>
              ))}
            </div>
            {errorMsg && <div className="text-xs font-semibold text-[#B91C1C]">{errorMsg}</div>}
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#ED9B53] text-[#1C3529] font-bold text-sm cursor-pointer"
            >
              {t(language, 'Save Custom Recipe', 'Simpan Resep Kustom')}
            </button>
          </form>
        ) : tab === 'research' ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-white border border-[#244D3B]/15">
              <div>
                <div className="font-bold text-sm text-[#244D3B]">
                  {t(
                    language,
                    'Culinary R&D Lab — Healthier & Higher-Margin Formulas',
                    'Lab Riset Kuliner — Formula Lebih Sehat & Hemat Biaya',
                  )}
                </div>
                <div className="text-xs text-[#587567] mt-0.5">
                  {t(
                    language,
                    'Invest earned Rupiah to refine existing dimsum dishes with lower sodium/starch, higher nutrition scores, and lower ingredient cost per batch.',
                    'Gunakan keuntungan Rupiah untuk meriset racikan lebih rendah garam & tepung, mutu nutrisi lebih tinggi, dan biaya bahan lebih hemat per batch.',
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[11px] text-[#587567] font-medium">
                  {t(language, 'Available Budget', 'Saldo Kas Tersedia')}
                </div>
                <div className="font-mono tabular-nums text-base font-bold text-[#244D3B]">
                  {formatRupiah(cashBalance)}
                </div>
              </div>
            </div>

            {researchErr && (
              <div className="p-3 rounded-lg bg-[#FEE2E2] text-[#991B1B] text-xs font-semibold">
                {researchErr}
              </div>
            )}

            <div className="space-y-3">
              {RECIPE_RESEARCH_DEFS.map((rd) => {
                const baseRecipe = recipes.find((r) => r.id === rd.recipeId);
                if (!baseRecipe) return null;

                const isResearched =
                  Boolean(baseRecipe.researched) ||
                  researchedRecipeIds.includes(rd.recipeId);
                const currentCost = estimateRecipeIngredientCost(
                  baseRecipe,
                  ingredientLots,
                  currentDay,
                  activeMarketEvent,
                  rivalShop.focusIngredientIds,
                );
                const researchedPreviewRecipe: RecipeDef = {
                  ...baseRecipe,
                  ingredients: rd.newIngredients,
                };
                const newCost = estimateRecipeIngredientCost(
                  researchedPreviewRecipe,
                  ingredientLots,
                  currentDay,
                  activeMarketEvent,
                  rivalShop.focusIngredientIds,
                );
                const costDelta = newCost - currentCost;

                return (
                  <div
                    key={rd.recipeId}
                    className={`p-4 rounded-xl border space-y-3 ${
                      isResearched
                        ? 'bg-[#D9E8C8]/45 border-[#6E9B72]'
                        : 'bg-white border-[#244D3B]/15'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1 max-w-xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-xs shrink-0"
                            style={{ backgroundColor: baseRecipe.accentColor }}
                          />
                          <span className="font-bold text-sm text-[#244D3B]">
                            {language === 'id' ? baseRecipe.nameId : baseRecipe.nameEn}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-[#587567]" />
                          <span className="font-bold text-sm text-[#244D3B]">
                            {language === 'id' ? rd.formulaNameId : rd.formulaNameEn}
                          </span>
                        </div>
                        <p className="text-xs text-[#587567]">
                          {language === 'id' ? rd.healthBenefitId : rd.healthBenefitEn}
                        </p>
                      </div>

                      <div className="shrink-0">
                        {isResearched ? (
                          <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#244D3B] text-[#FAF5EA] text-xs font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#A7F3D0]" />
                            <span>{t(language, 'Active Formula', 'Formula Aktif')}</span>
                          </span>
                        ) : !baseRecipe.unlocked ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedId(baseRecipe.id);
                              setTab('recipes');
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#244D3B]/25 text-[#244D3B] hover:bg-[#F6EBD4] text-xs font-semibold cursor-pointer"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>{t(language, 'Unlock Dish First', 'Buka Resep Dulu')}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const res = researchRecipe(rd.recipeId);
                              if (!res.ok) {
                                setResearchErr(
                                  language === 'id'
                                    ? res.errorId ?? null
                                    : res.errorEn ?? null,
                                );
                              } else {
                                setResearchErr(null);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#ED9B53] hover:bg-[#DF883D] text-[#1C3529] text-xs font-bold font-mono tabular-nums cursor-pointer"
                          >
                            <FlaskConical className="w-3.5 h-3.5" />
                            <span>
                              {t(language, 'Research', 'Riset')} · {formatRupiah(rd.researchCost)}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Economic & Nutrition Gains */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-[#FAF5EA] border border-[#244D3B]/10">
                        <div className="text-[11px] text-[#587567]">
                          {t(language, 'Ingredient Cost / Batch', 'Biaya Bahan / Batch')}
                        </div>
                        <div className="font-mono tabular-nums font-bold text-[#244D3B] mt-0.5">
                          {isResearched ? (
                            <span>{formatRupiah(currentCost)}</span>
                          ) : (
                            <span>
                              {formatRupiah(currentCost)} → {formatRupiah(newCost)}
                              {costDelta < 0 && (
                                <span className="text-[#244D3B] ml-1">
                                  ({formatRupiah(costDelta)})
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-[#FAF5EA] border border-[#244D3B]/10">
                        <div className="text-[11px] text-[#587567]">
                          {t(language, 'Nutrition Quality', 'Mutu Nutrisi')}
                        </div>
                        <div className="font-mono tabular-nums font-bold text-[#244D3B] mt-0.5">
                          {isResearched
                            ? `Q${baseRecipe.baseQuality} (+4 QC)`
                            : `Q${baseRecipe.baseQuality} → Q${rd.newBaseQuality}`}
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-[#FAF5EA] border border-[#244D3B]/10">
                        <div className="text-[11px] text-[#587567]">
                          {t(language, 'Cycle Speed', 'Waktu Masak')}
                        </div>
                        <div className="font-mono tabular-nums font-bold text-[#244D3B] mt-0.5">
                          {isResearched
                            ? `${baseRecipe.productionTimeSec}${t(language, 's', 'd')}`
                            : `${baseRecipe.productionTimeSec}${t(language, 's', 'd')} → ${rd.newProductionTimeSec}${t(language, 's', 'd')}`}
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-[#FAF5EA] border border-[#244D3B]/10">
                        <div className="text-[11px] text-[#587567]">
                          {t(language, 'Chilled Shelf Life', 'Daya Simpan')}
                        </div>
                        <div className="font-mono tabular-nums font-bold text-[#244D3B] mt-0.5">
                          {isResearched
                            ? `${baseRecipe.shelfLifeDays} ${t(language, 'days', 'hari')}`
                            : `${baseRecipe.shelfLifeDays}${t(language, 'd', 'h')} → ${rd.newShelfLifeDays}${t(language, 'd', 'h')}`}
                        </div>
                      </div>
                    </div>

                    {/* New Ingredient Combination Preview */}
                    <div className="text-[11px] text-[#355446] flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold text-[#244D3B]">
                        {t(language, 'Optimized Blend:', 'Komposisi Baru:')}
                      </span>
                      {rd.newIngredients.map((ing) => {
                        const def = getIngredientDef(ing.ingredientId);
                        return (
                          <span key={ing.ingredientId} className="font-mono tabular-nums">
                            {def ? (language === 'id' ? def.nameId : def.nameEn) : ing.ingredientId}{' '}
                            <strong>
                              {ing.quantity}
                              {def?.unit}
                            </strong>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12">
            {/* Left Recipe List */}
            <div className="md:col-span-5 border-b md:border-b-0 md:border-r border-[#244D3B]/15 p-4 space-y-2 bg-[#F6EBD4]/50">
              <div className="flex items-center justify-between gap-2 pb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#587567]">
                  {t(language, 'Menu Complexity', 'Kompleksitas Menu')}
                </span>
                <button
                  type="button"
                  onClick={() => setSortByEfficiency((v) => !v)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
                    sortByEfficiency
                      ? 'bg-[#244D3B] text-[#FAF5EA] border-[#244D3B]'
                      : 'bg-white text-[#244D3B] border-[#244D3B]/20 hover:bg-[#D9E8C8]/40'
                  }`}
                >
                  <ArrowUpDown className="w-3 h-3" />
                  <span>
                    {sortByEfficiency
                      ? t(language, 'Fastest First', 'Tercepat Dulu')
                      : t(language, 'Prioritize Easy', 'Urutkan Mudah')}
                  </span>
                </button>
              </div>

              {sortedRecipes.map((rec) => {
                const avail = checkRecipeAvailability(rec, ingredientLots, currentDay, 1);
                const complexity = getComplexityMeta(rec);
                const isSelected = selectedId === rec.id;
                const isResearched =
                  Boolean(rec.researched) || researchedRecipeIds.includes(rec.id);
                const isFestivalFeatured = doesRecipeMatchFestival(rec, activeFestival);
                return (
                  <button
                    key={rec.id}
                    onClick={() => {
                      setSelectedId(rec.id);
                      setBatchCount(1);
                      setErrorMsg(null);
                    }}
                    className={`w-full text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#244D3B] text-white border-[#244D3B]'
                        : isFestivalFeatured
                          ? 'bg-[#FFFBF2] text-[#244D3B] border-[#ED9B53] hover:bg-[#FFF3DC]'
                          : 'bg-white text-[#244D3B] border-[#244D3B]/15 hover:bg-[#D9E8C8]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-xs shrink-0"
                          style={{ backgroundColor: rec.accentColor }}
                        />
                        <span className="truncate">
                          {language === 'id' ? rec.nameId : rec.nameEn}
                        </span>
                        {isFestivalFeatured && (
                          <Sparkles
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isSelected ? 'text-[#FCD34D]' : 'text-[#D97706]'
                            }`}
                          />
                        )}
                        {isResearched && (
                          <FlaskConical
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isSelected ? 'text-[#A7F3D0]' : 'text-[#6E9B72]'
                            }`}
                          />
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1.5 shrink-0">
                        <ComplexityGauge
                          level={complexity.level}
                          activeClass={
                            isSelected
                              ? complexity.barActiveSelectedClass
                              : complexity.barActiveClass
                          }
                          inactiveClass={
                            isSelected ? 'bg-white/25' : 'bg-[#244D3B]/15'
                          }
                        />
                        <span
                          className={`text-[11px] font-semibold ${
                            isSelected ? 'text-[#FAF5EA]' : complexity.textClass
                          }`}
                        >
                          {language === 'id' ? complexity.labelId : complexity.labelEn}
                        </span>
                        {!rec.unlocked && <Lock className="w-3.5 h-3.5 opacity-80 shrink-0" />}
                      </span>
                    </div>
                    <div
                      className={`text-xs mt-1.5 flex items-center justify-between gap-2 tabular-nums ${
                        isSelected ? 'text-[#D9E8C8]' : 'text-[#587567]'
                      }`}
                    >
                      <span>
                        {rec.ingredients.length} {t(language, 'items', 'bahan')} ·{' '}
                        {rec.productionTimeSec}{t(language, 's', 'd')} · {rec.batchSize} pcs
                        {isFestivalFeatured ? ' · +15% Festival' : ''}
                      </span>
                      <span className="font-semibold">
                        {avail.canProduce
                          ? t(language, 'Ready', 'Siap Masak')
                          : t(language, 'Missing Stock', 'Kurang Bahan')}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Recipe Details */}
            {selectedRecipe && selectedComplexity && (
              <div className="md:col-span-7 p-6 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-xl font-bold text-[#244D3B] flex flex-wrap items-center gap-2">
                      <span>
                        {language === 'id' ? selectedRecipe.nameId : selectedRecipe.nameEn}
                      </span>
                      {doesRecipeMatchFestival(selectedRecipe, activeFestival) && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#92400E]">
                          <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
                          <span>
                            {t(language, 'Festival Featured (+15% Rev · 2x Traffic)', 'Unggulan Festival (+15% Omzet · 2x Tamu)')}
                          </span>
                        </span>
                      )}
                      {(selectedRecipe.researched ||
                        researchedRecipeIds.includes(selectedRecipe.id)) && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#6E9B72]">
                          <FlaskConical className="w-3.5 h-3.5" />
                          <span>{t(language, 'R&D Competitive Edge', 'Keunggulan Riset R&D')}</span>
                        </span>
                      )}
                    </h3>
                    <span className="text-xs font-semibold text-[#587567]">
                      {selectedRecipe.isVegetarian
                        ? t(language, 'Vegetarian', 'Vegetarian')
                        : t(language, 'Protein Mix', 'Protein')}
                    </span>
                  </div>
                  <p className="text-xs text-[#587567] mt-1 leading-relaxed">
                    {language === 'id'
                      ? selectedRecipe.descriptionId
                      : selectedRecipe.descriptionEn}
                  </p>

                  {/* Complexity & Production Efficiency Indicators */}
                  <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2.5 rounded-xl bg-white border border-[#244D3B]/15">
                      <div className="text-[11px] text-[#587567] font-medium">
                        {t(language, 'Complexity', 'Kompleksitas')}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <ComplexityGauge
                          level={selectedComplexity.level}
                          activeClass={selectedComplexity.barActiveClass}
                          inactiveClass="bg-[#244D3B]/15"
                        />
                        <span className={`text-xs font-bold ${selectedComplexity.textClass}`}>
                          {language === 'id'
                            ? selectedComplexity.labelId
                            : selectedComplexity.labelEn}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white border border-[#244D3B]/15">
                      <div className="text-[11px] text-[#587567] font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{t(language, 'Cycle Time', 'Waktu Masak')}</span>
                      </div>
                      <div className="mt-1 text-xs font-mono tabular-nums font-bold text-[#244D3B]">
                        {selectedRecipe.productionTimeSec}{t(language, 's / batch', 'd / batch')}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white border border-[#244D3B]/15">
                      <div className="text-[11px] text-[#587567] font-medium flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        <span>{t(language, 'Ingredients', 'Bahan Baku')}</span>
                      </div>
                      <div className="mt-1 text-xs font-mono tabular-nums font-bold text-[#244D3B]">
                        {selectedRecipe.ingredients.length}{' '}
                        {t(language, 'types', 'jenis')}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white border border-[#244D3B]/15">
                      <div className="text-[11px] text-[#587567] font-medium flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        <span>{t(language, 'Quality / Life', 'Mutu / Tahan')}</span>
                      </div>
                      <div className="mt-1 text-xs font-mono tabular-nums font-bold text-[#244D3B]">
                        Q{selectedRecipe.baseQuality} · {selectedRecipe.shelfLifeDays}
                        {t(language, 'd', 'h')}
                      </div>
                    </div>
                  </div>

                  {/* Batch Size Selector */}
                  <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-white border border-[#244D3B]/15">
                    <span className="text-xs font-semibold text-[#244D3B]">
                      {t(language, 'Batch Multiplier', 'Jumlah Batch')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4].map((n) => (
                        <button
                          key={n}
                          disabled={n > maxBatches}
                          onClick={() => setBatchCount(n)}
                          className={`px-3 py-1 rounded-lg font-mono tabular-nums text-xs font-bold cursor-pointer disabled:opacity-35 ${
                            batchCount === n
                              ? 'bg-[#ED9B53] text-[#1C3529]'
                              : 'bg-[#F6EBD4] text-[#244D3B]'
                          }`}
                        >
                          {n * selectedRecipe.batchSize} pcs
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ingredient Checklist */}
                  <div className="mt-4 space-y-1.5">
                    <div className="text-xs font-semibold text-[#244D3B]">
                      {t(language, 'Required Ingredients (FEFO)', 'Kebutuhan Bahan (FEFO)')}
                    </div>
                    {selectedRecipe.ingredients.map((req) => {
                      const def = getIngredientDef(req.ingredientId);
                      const miss = availability.missing.find(
                        (m) => m.ingredientId === req.ingredientId,
                      );
                      const needed = req.quantity * batchCount;
                      const have = miss ? miss.available : needed;
                      return (
                        <div
                          key={req.ingredientId}
                          className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-[#244D3B]/10 text-xs"
                        >
                          <span className="font-medium text-[#244D3B]">
                            {def
                              ? language === 'id'
                                ? def.nameId
                                : def.nameEn
                              : req.ingredientId}
                          </span>
                          <span
                            className={`font-mono tabular-nums font-bold ${
                              miss ? 'text-[#B91C1C]' : 'text-[#244D3B]'
                            }`}
                          >
                            {needed} {def?.unit} ({t(language, 'Stock:', 'Stok:')} {have})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-4 border-t border-[#244D3B]/15 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#587567]">
                      {t(language, 'Estimated Ingredient Cost:', 'Estimasi Biaya Bahan:')}
                    </span>
                    <span className="font-mono tabular-nums font-bold text-[#244D3B]">
                      {formatRupiah(estimatedIngCost)}
                    </span>
                  </div>

                  {errorMsg && (
                    <div className="text-xs font-semibold text-[#B91C1C]">{errorMsg}</div>
                  )}

                  {!selectedRecipe.unlocked ? (
                    <button
                      onClick={() => unlockRecipe(selectedRecipe.id)}
                      disabled={cashBalance < (selectedRecipe.unlockCost ?? 35_000)}
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#244D3B] text-white font-bold text-sm disabled:opacity-45 cursor-pointer"
                    >
                      <Unlock className="w-4 h-4" />
                      <span>
                        {t(language, 'Unlock Recipe', 'Buka Resep')} (
                        {formatRupiah(selectedRecipe.unlockCost ?? 35_000)})
                      </span>
                    </button>
                  ) : !availability.canProduce ? (
                    <button
                      onClick={() => openStation('market')}
                      className="w-full px-5 py-3 rounded-xl bg-[#244D3B] text-white font-bold text-sm cursor-pointer"
                    >
                      {t(
                        language,
                        'Missing Ingredients — Go to Market',
                        'Bahan Kurang — Belanja ke Pasar',
                      )}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleStartCooking}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#ED9B53] hover:bg-[#DF883D] text-[#1C3529] font-bold text-sm cursor-pointer"
                        >
                          <ChefHat className="w-4 h-4 shrink-0" />
                          <span>
                            {t(
                              language,
                              `Start 4-Stage Production (${batchCount * selectedRecipe.batchSize} pcs)`,
                              `Mulai 4 Tahap Masak (${batchCount * selectedRecipe.batchSize} pcs)`,
                            )}
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={!delegationCheck.eligible}
                          onClick={handleDelegateCooking}
                          className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-colors ${
                            delegationCheck.eligible
                              ? 'bg-[#244D3B] hover:bg-[#1B3A2C] text-white cursor-pointer'
                              : 'bg-[#E9DEC8] text-[#587567] opacity-80 cursor-not-allowed'
                          }`}
                        >
                          <Users className="w-4 h-4 shrink-0" />
                          <span>
                            {delegationCheck.eligible && delegatedPlan
                              ? t(
                                  language,
                                  `Delegate to Staff (~QC ${delegatedPlan.projectedQualityScore} · ${(delegatedPlan.durationMs / 1000).toFixed(1)}s)`,
                                  `Delegasikan ke Staf (~QC ${delegatedPlan.projectedQualityScore} · ${(delegatedPlan.durationMs / 1000).toFixed(1)}d)`,
                                )
                              : delegationCheck.reason === 'busy'
                                ? t(
                                    language,
                                    'Auto-Batch (Kitchen Busy)',
                                    'Masak Staf (Dapur Sibuk)',
                                  )
                                : t(
                                    language,
                                    `Auto-Batch (${delegationCheck.activeHelpers.length}/${MIN_ACTIVE_HELPERS_FOR_DELEGATION} Staff)`,
                                    `Masak Staf (${delegationCheck.activeHelpers.length}/${MIN_ACTIVE_HELPERS_FOR_DELEGATION} Staf)`,
                                  )}
                          </span>
                        </button>
                      </div>

                      <div className="text-[11px] text-[#587567] flex flex-wrap items-center justify-between gap-2">
                        {delegationCheck.eligible && delegatedPlan ? (
                          <span>
                            {t(
                              language,
                              `Crew Auto-Batch active (${delegationCheck.activeHelpers.length}/4 on Kitchen shift): cooks in background so you can manage market, cashier, or pricing.`,
                              `Auto-Batch Staf aktif (${delegationCheck.activeHelpers.length}/4 di shift Dapur): memasak otomatis agar kamu bisa fokus atur pasar, kasir, dan harga.`,
                            )}
                          </span>
                        ) : (
                          <span>
                            {t(
                              language,
                              `Hire & keep ${MIN_ACTIVE_HELPERS_FOR_DELEGATION}+ Kitchen Helpers on Kitchen shift (Finance → Staff) to unlock Auto-Batch Delegation.`,
                              `Rekrut & aktifkan ${MIN_ACTIVE_HELPERS_FOR_DELEGATION}+ Asisten di shift Dapur (Laporan → Staf) untuk membuka Delegasi Batch Otomatis.`,
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
