import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Flame, HeartPulse, Sparkles, Users, UtensilsCrossed } from 'lucide-react';
import {
  getEffectiveHelperQualityBonus,
  getEffectiveHelperSpeedMultiplier,
  getIngredientDef,
  getKitchenHelperDef,
  getStaffMorale,
} from '../config/gameBalance';
import {
  computeHelperSkillEffects,
} from '../domain/staffSkillTree';
import {
  computeNextSteamTemp,
  computeMixStartingRatios,
  getMixProfileForRecipe,
  getSteamProfileForRecipe,
  getWrapPatternForRecipe,
} from '../domain/cookingMiniGames';
import { t } from '../i18n/translations';
import { useGameStore } from '../store/useGameStore';
import type { KitchenHelperState, RecipeDef } from '../types/game';
import { soundFx } from '../utils/audio';

export const CookingMiniGamesModal: React.FC = () => {
  const language = useGameStore((s) => s.language);
  const gameState = useGameStore((s) => s.gameState);
  const activeCooking = useGameStore((s) => s.activeCooking);
  const recipes = useGameStore((s) => s.recipes);
  const kitchenStaff = useGameStore((s) => s.kitchenStaff);
  const activeDailyEvent = useGameStore((s) => s.activeDailyEvent);
  const completeCookingStage = useGameStore((s) => s.completeCookingStage);

  const recipe = useMemo(
    () => recipes.find((r) => r.id === activeCooking?.recipeId),
    [recipes, activeCooking?.recipeId],
  );

  if (!activeCooking || !recipe) return null;

  const prepHelper = kitchenStaff.find((h) => h.id === 'prep');
  const mixHelper = kitchenStaff.find((h) => h.id === 'mix');
  const wrapHelper = kitchenStaff.find((h) => h.id === 'wrap');
  const steamHelper = kitchenStaff.find((h) => h.id === 'steam');

  const stages = [
    { key: 'PREP', en: '1. Prep', id: '1. Siapkan' },
    { key: 'MIX', en: '2. Mix', id: '2. Campur' },
    { key: 'WRAP', en: '3. Wrap', id: '3. Bentuk' },
    { key: 'STEAM', en: '4. Steam', id: '4. Kukus' },
  ] as const;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-[#1C3529]/60">
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-[#FAF5EA] border border-[#244D3B]/20 shadow-xl overflow-hidden">
        {/* Top Stage Progress Bar */}
        <div className="px-4 py-2.5 sm:px-6 sm:py-4 bg-[#244D3B] text-[#FAF5EA] shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs text-[#D9E8C8]">
                {t(language, 'Production Kitchen', 'Dapur Produksi')} ·{' '}
                {activeCooking.batchCount * recipe.batchSize} pcs
              </div>
              <h2 className="font-display text-base sm:text-lg md:text-xl font-bold">
                {language === 'id' ? recipe.nameId : recipe.nameEn}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs">
              {stages.map((st) => {
                const isCurrent = activeCooking.stage === st.key;
                return (
                  <span
                    key={st.key}
                    className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg font-semibold ${
                      isCurrent ? 'bg-[#ED9B53] text-[#1C3529]' : 'bg-white/10 text-[#D9E8C8]'
                    }`}
                  >
                    {language === 'id' ? st.id : st.en}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {activeCooking.stage === 'PREP' && (
            <PrepMiniGame
              language={language}
              requiredIds={recipe.ingredients.map((i) => i.ingredientId)}
              helper={prepHelper}
              onComplete={(score) => completeCookingStage('PREP', score)}
            />
          )}
          {activeCooking.stage === 'MIX' && (
            <MixMiniGame
              language={language}
              recipe={recipe}
              helper={mixHelper}
              onComplete={(score) => completeCookingStage('MIX', score)}
            />
          )}
          {activeCooking.stage === 'WRAP' && (
            <WrapMiniGame
              language={language}
              recipe={recipe}
              accentColor={recipe.accentColor}
              helper={wrapHelper}
              onComplete={(score) => completeCookingStage('WRAP', score)}
            />
          )}
          {activeCooking.stage === 'STEAM' && (
            <SteamMiniGame
              language={language}
              recipe={recipe}
              helper={steamHelper}
              isPaused={gameState === 'GAME_PAUSED'}
              steamEventPenalty={activeDailyEvent?.steamScoreDelta ?? 0}
              steamEventTitle={
                activeDailyEvent
                  ? language === 'id'
                    ? activeDailyEvent.titleId
                    : activeDailyEvent.titleEn
                  : undefined
              }
              onComplete={(score) => completeCookingStage('STEAM', score)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * MINI-GAME 1: PREPARATION (Drag-and-Drop or Click Ingredients into Prep Bowl)
 * ========================================================================== */
const PrepMiniGame: React.FC<{
  language: 'en' | 'id';
  requiredIds: string[];
  helper?: KitchenHelperState;
  onComplete: (score: number) => void;
}> = ({ language, requiredIds, helper, onComplete }) => {
  const isResting = helper?.shift === 'wellness';
  const activeLevel = helper && !isResting ? helper.level : undefined;
  const morale = getStaffMorale(helper);
  const skillFx = computeHelperSkillEffects(helper);
  const speedBonusItems = activeLevel ? (morale >= 80 ? 1 : morale < 25 ? -1 : 0) : 0;
  const preloadedCount = activeLevel
    ? Math.max(
        0,
        Math.min(
          Math.max(0, requiredIds.length - 1),
          activeLevel + speedBonusItems + skillFx.extraPreloadedItems,
        ),
      )
    : 0;
  const [added, setAdded] = useState<string[]>(() =>
    requiredIds.slice(0, preloadedCount),
  );
  const [mistakes, setMistakes] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const helperDef = helper ? getKitchenHelperDef('prep') : null;
  const qualityMod = getEffectiveHelperQualityBonus(helper) + skillFx.stageQualityBonus;
  const distractorCount = Math.max(0, 2 - skillFx.fewerDistractors);

  const trayItems = useMemo(() => {
    const distractors = ['shrimp', 'spinach', 'tofu', 'mushroom', 'broccoli'].filter(
      (id) => !requiredIds.includes(id),
    );
    const pool = [...requiredIds, ...distractors.slice(0, distractorCount)];
    return pool.sort();
  }, [requiredIds, distractorCount]);

  const handleDropOrClick = (ingId: string) => {
    if (added.includes(ingId)) return;
    if (requiredIds.includes(ingId)) {
      soundFx.playChop();
      setAdded((prev) => [...prev, ingId]);
    } else {
      soundFx.playError();
      setMistakes((m) => m + 1);
    }
  };

  const allCollected = requiredIds.every((id) => added.includes(id));
  const penaltyPerMistake = Math.round(12 * skillFx.mistakePenaltyMultiplier);
  const currentAccuracy = Math.max(40, 100 - mistakes * penaltyPerMistake);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-lg font-bold text-[#244D3B]">
          {t(language, 'Stage 1: Ingredient Preparation', 'Tahap 1: Persiapan Bahan')}
        </h3>
        <p className="text-xs text-[#587567] mt-0.5">
          {t(
            language,
            'Drag (or tap) ONLY the ingredients required by this recipe into the prep bowl.',
            'Seret (atau ketuk) HANYA bahan yang dibutuhkan resep ini ke dalam mangkuk persiapan.',
          )}
        </p>
        {helperDef && helper && (
          isResting ? (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#F6EBD4] border border-[#ED9B53]/50 text-xs font-semibold text-[#92400E]">
              <HeartPulse className="w-3.5 h-3.5" />
              <span>
                {t(
                  language,
                  `${helperDef.name} is resting on Wellness shift (${morale}% morale)`,
                  `${helperDef.name} sedang istirahat di shift Wellness (moral ${morale}%)`,
                )}
              </span>
            </div>
          ) : (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#D9E8C8]/70 border border-[#6E9B72] text-xs font-semibold text-[#244D3B]">
              <Users className="w-3.5 h-3.5" />
              <span>
                {t(
                  language,
                  `${helperDef.name} (Lv ${helper.level} · Morale ${morale}%) pre-sorted ${preloadedCount} item(s) · ${qualityMod >= 0 ? `+${qualityMod}` : qualityMod} Prep QC`,
                  `${helperDef.name} (Lv ${helper.level} · Moral ${morale}%) siapkan ${preloadedCount} bahan · ${qualityMod >= 0 ? `+${qualityMod}` : qualityMod} QC`,
                )}
              </span>
            </div>
          )
        )}
      </div>

      {/* Draggable / Tappable Ingredient Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {trayItems.map((id) => {
          const def = getIngredientDef(id);
          const isAdded = added.includes(id);
          const isReq = requiredIds.includes(id);
          return (
            <button
              key={id}
              type="button"
              draggable={!isAdded}
              onDragStart={(e) => e.dataTransfer.setData('text/plain', id)}
              onClick={() => handleDropOrClick(id)}
              disabled={isAdded}
              className={`p-3 rounded-xl border text-left transition-transform active:scale-95 cursor-grab ${
                isAdded
                  ? 'bg-[#D9E8C8] border-[#6E9B72] opacity-65'
                  : skillFx.highlightRequiredItems && isReq
                    ? 'bg-[#F2F8ED] border-[#3D7A5A] hover:border-[#ED9B53]'
                    : 'bg-white border-[#244D3B]/20 hover:border-[#ED9B53]'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className="w-3 h-3 rounded-sm border border-black/10"
                  style={{ backgroundColor: def?.colorHex ?? '#ccc' }}
                />
                {isAdded && <Check className="w-4 h-4 text-[#244D3B]" />}
              </div>
              <div className="mt-1.5 text-xs font-semibold text-[#244D3B]">
                {def ? (language === 'id' ? def.nameId : def.nameEn) : id}
              </div>
              <div className="text-[11px] text-[#587567]">
                {isReq
                  ? t(language, 'In recipe', 'Sesuai resep')
                  : t(language, 'Extra pantry', 'Bahan lain')}
              </div>
            </button>
          );
        })}
      </div>

      {/* Drop Zone Prep Bowl */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const id = e.dataTransfer.getData('text/plain');
          if (id) handleDropOrClick(id);
        }}
        className={`rounded-2xl border-2 border-dashed p-5 text-center transition-colors ${
          dragOver
            ? 'bg-[#D9E8C8] border-[#244D3B]'
            : 'bg-[#F6EBD4] border-[#6E9B72]'
        }`}
      >
        <UtensilsCrossed className="w-6 h-6 mx-auto text-[#244D3B] mb-1.5" />
        <div className="text-sm font-bold text-[#244D3B] tabular-nums">
          {t(
            language,
            `Prep Bowl: ${added.length} / ${requiredIds.length} ingredients ready`,
            `Mangkuk Persiapan: ${added.length} / ${requiredIds.length} bahan siap`,
          )}
        </div>
        <div className="text-xs text-[#587567] mt-0.5 tabular-nums">
          {t(language, `Accuracy: ${currentAccuracy}%`, `Akurasi: ${currentAccuracy}%`)} ·{' '}
          {t(language, `Wrong picks: ${mistakes}`, `Salah pilih: ${mistakes}`)}
        </div>
      </div>

      <button
        disabled={!allCollected}
        onClick={() => onComplete(currentAccuracy)}
        className="w-full py-3 rounded-xl bg-[#ED9B53] hover:bg-[#DF883D] disabled:opacity-45 text-[#1C3529] font-bold text-sm cursor-pointer"
      >
        {t(language, 'Proceed to Mixing Station', 'Lanjut ke Pencampuran')}
      </button>
    </div>
  );
};

/* ============================================================================
 * MINI-GAME 2: MIXING (Recipe-Specific Target Ratios + Stirring Consistency)
 * ========================================================================== */
const MixMiniGame: React.FC<{
  language: 'en' | 'id';
  recipe: RecipeDef;
  helper?: KitchenHelperState;
  onComplete: (score: number) => void;
}> = ({ language, recipe, helper, onComplete }) => {
  const isResting = helper?.shift === 'wellness';
  const activeLevel = helper && !isResting ? helper.level : undefined;
  const morale = getStaffMorale(helper);
  const speedMult = getEffectiveHelperSpeedMultiplier(helper);
  const skillFx = computeHelperSkillEffects(helper);
  const qualityMod = getEffectiveHelperQualityBonus(helper) + skillFx.stageQualityBonus;

  const mixProfile = useMemo(() => getMixProfileForRecipe(recipe), [recipe]);
  const { initialMain, initialSecondary } = useMemo(
    () =>
      computeMixStartingRatios({
        targetMain: mixProfile.targetMain,
        targetSecondary: mixProfile.targetSecondary,
        helperLevel: activeLevel,
        extraStartMatch: skillFx.extraStartMixMatch,
      }),
    [mixProfile.targetMain, mixProfile.targetSecondary, activeLevel, skillFx.extraStartMixMatch],
  );

  const whiskStep =
    Math.max(12, Math.round((20 + (activeLevel ?? 0) * 5) * speedMult)) +
    skillFx.extraWhiskStep;
  const helperDef = helper ? getKitchenHelperDef('mix') : null;

  const [proteinRatio, setProteinRatio] = useState(initialMain);
  const [veggieRatio, setVeggieRatio] = useState(initialSecondary);
  const [stirProgress, setStirProgress] = useState(skillFx.startingStirProgress);

  const targetProtein = mixProfile.targetMain;
  const targetVeggie = mixProfile.targetSecondary;
  const deviation =
    Math.abs(proteinRatio - targetProtein) + Math.abs(veggieRatio - targetVeggie);
  const ratioScore = Math.max(
    45,
    100 - Math.round(deviation * 1.1 * (1 - skillFx.ratioToleranceBonus)),
  );

  const handleStir = () => {
    soundFx.playMix();
    setStirProgress((p) => Math.min(100, p + whiskStep));
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-lg font-bold text-[#244D3B]">
          {t(language, 'Stage 2: Filling Composition & Mixing', 'Tahap 2: Komposisi & Pengadukan')}
        </h3>
        <p className="text-xs text-[#587567] mt-0.5">
          {t(
            language,
            `Calibrate this recipe’s balance (${targetProtein}% / ${targetVeggie}%), then stir until smooth. ${mixProfile.hintEn}`,
            `Kalibrasi rasio resep ini (${targetProtein}% / ${targetVeggie}%), lalu aduk hingga merata. ${mixProfile.hintId}`,
          )}
        </p>
        {helperDef && helper && (
          isResting ? (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#F6EBD4] border border-[#ED9B53]/50 text-xs font-semibold text-[#92400E]">
              <HeartPulse className="w-3.5 h-3.5" />
              <span>
                {t(
                  language,
                  `${helperDef.name} is resting on Wellness shift (${morale}% morale)`,
                  `${helperDef.name} sedang istirahat di shift Wellness (moral ${morale}%)`,
                )}
              </span>
            </div>
          ) : (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#D9E8C8]/70 border border-[#6E9B72] text-xs font-semibold text-[#244D3B]">
              <Users className="w-3.5 h-3.5" />
              <span>
                {t(
                  language,
                  `${helperDef.name} (Lv ${helper.level} · Morale ${morale}%): ${speedMult.toFixed(2)}x speed (+${whiskStep}%/whisk) · ${qualityMod >= 0 ? `+${qualityMod}` : qualityMod} Mix QC`,
                  `${helperDef.name} (Lv ${helper.level} · Moral ${morale}%): ${speedMult.toFixed(2)}x cepat (+${whiskStep}%/aduk) · ${qualityMod >= 0 ? `+${qualityMod}` : qualityMod} QC`,
                )}
              </span>
            </div>
          )
        )}
      </div>

      <div className="space-y-3 bg-white p-4 rounded-xl border border-[#244D3B]/15">
        <div>
          <div className="flex justify-between text-xs font-semibold text-[#244D3B] mb-1 tabular-nums">
            <span>
              {language === 'id' ? mixProfile.mainLabelId : mixProfile.mainLabelEn} (
              {t(language, `Target ${targetProtein}%`, `Target ${targetProtein}%`)})
            </span>
            <span>{proteinRatio}%</span>
          </div>
          <input
            type="range"
            min={20}
            max={80}
            value={proteinRatio}
            onChange={(e) => setProteinRatio(Number(e.target.value))}
            className="w-full accent-[#244D3B]"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs font-semibold text-[#244D3B] mb-1 tabular-nums">
            <span>
              {language === 'id' ? mixProfile.secondaryLabelId : mixProfile.secondaryLabelEn} (
              {t(language, `Target ${targetVeggie}%`, `Target ${targetVeggie}%`)})
            </span>
            <span>{veggieRatio}%</span>
          </div>
          <input
            type="range"
            min={10}
            max={60}
            value={veggieRatio}
            onChange={(e) => setVeggieRatio(Number(e.target.value))}
            className="w-full accent-[#6E9B72]"
          />
        </div>

        <div className="pt-2 flex items-center justify-between text-xs font-semibold text-[#587567] tabular-nums">
          <span>{t(language, 'Formula Match:', 'Kesesuaian Formula:')}</span>
          <span className="text-[#244D3B] font-mono">{ratioScore}%</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-[#244D3B] tabular-nums">
          <span>{t(language, 'Batter Smoothness', 'Kehalusan Adonan')}</span>
          <span>{stirProgress}%</span>
        </div>
        <div className="w-full h-3 rounded-full bg-[#D9E8C8] overflow-hidden">
          <div
            className="h-full bg-[#244D3B] transition-all duration-150"
            style={{ width: `${stirProgress}%` }}
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleStir}
            disabled={stirProgress >= 100}
            className="flex-1 py-3 rounded-xl bg-[#6E9B72] hover:bg-[#5B855F] disabled:opacity-45 text-white font-bold text-sm cursor-pointer"
          >
            {t(
              language,
              `Whisk & Fold (+${whiskStep}%)`,
              `Aduk Adonan (+${whiskStep}%)`,
            )}
          </button>
          <button
            type="button"
            disabled={stirProgress < 100}
            onClick={() => onComplete(ratioScore)}
            className="flex-1 py-3 rounded-xl bg-[#ED9B53] hover:bg-[#DF883D] disabled:opacity-45 text-[#1C3529] font-bold text-sm cursor-pointer"
          >
            {t(language, 'Finish Mixing', 'Lanjut ke Pembentukan')}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * MINI-GAME 3: WRAPPING (Recipe-Specific Wrapper Silhouettes & Pleat Patterns)
 * ========================================================================== */
const WrapMiniGame: React.FC<{
  language: 'en' | 'id';
  recipe: RecipeDef;
  accentColor: string;
  helper?: KitchenHelperState;
  onComplete: (score: number) => void;
}> = ({ language, recipe, accentColor, helper, onComplete }) => {
  const isResting = helper?.shift === 'wellness';
  const activeLevel = helper && !isResting ? helper.level : undefined;
  const morale = getStaffMorale(helper);
  const speedMult = getEffectiveHelperSpeedMultiplier(helper);
  const skillFx = computeHelperSkillEffects(helper);
  const qualityMod = getEffectiveHelperQualityBonus(helper) + skillFx.stageQualityBonus;

  const pattern = useMemo(() => getWrapPatternForRecipe(recipe), [recipe]);
  const basePieces = activeLevel && morale >= 80 ? 3 : activeLevel && morale < 25 ? 5 : 4;
  const totalPieces = Math.max(2, basePieces - skillFx.fewerSamplePieces);
  const maxPreFolds = Math.max(0, pattern.points.length - 1);
  const preFoldCount = activeLevel
    ? Math.min(maxPreFolds, activeLevel + skillFx.extraPreFoldedPleats)
    : 0;
  const preFoldedIds = useMemo(
    () => pattern.points.slice(0, preFoldCount).map((p) => p.id),
    [pattern.points, preFoldCount],
  );
  const helperDef = helper ? getKitchenHelperDef('wrap') : null;
  const [pieceIndex, setPieceIndex] = useState(0);
  const [pleated, setPleated] = useState<number[]>(() => preFoldedIds);
  const [misclicks, setMisclicks] = useState(0);

  const foldAnchor =
    pattern.style === 'crescent'
      ? { x: 110, y: 122 }
      : pattern.style === 'wave'
        ? { x: 110, y: 118 }
        : { x: 110, y: 100 };

  const handlePleat = (pid: number) => {
    if (pleated.includes(pid)) return;
    soundFx.playWrap();
    const next = [...pleated, pid];
    if (next.length >= pattern.points.length) {
      if (pieceIndex + 1 >= totalPieces) {
        const penaltyPerMisclick = Math.round(6 * skillFx.misclickPenaltyMultiplier);
        const finalScore = Math.max(55, 98 - misclicks * penaltyPerMisclick);
        onComplete(finalScore);
      } else {
        setPieceIndex((i) => i + 1);
        setPleated(preFoldedIds);
      }
    } else {
      setPleated(next);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold text-[#244D3B]">
            {t(language, 'Stage 3: Artisan Dimsum Wrapping', 'Tahap 3: Pembentukan Lipatan Dimsum')}
          </h3>
          <span className="px-2.5 py-0.5 rounded-md bg-[#E9DEC8] text-[#244D3B] text-[11px] font-bold">
            {language === 'id' ? pattern.nameId : pattern.nameEn}
          </span>
        </div>
        <p className="text-xs text-[#587567] mt-0.5 tabular-nums">
          {language === 'id' ? pattern.instructionId : pattern.instructionEn}{' '}
          ({pieceIndex + 1} / {totalPieces}{' '}
          {t(language, 'sample pieces', 'sampel')})
        </p>
        {helperDef && helper && (
          isResting ? (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#F6EBD4] border border-[#ED9B53]/50 text-xs font-semibold text-[#92400E]">
              <HeartPulse className="w-3.5 h-3.5" />
              <span>
                {t(
                  language,
                  `${helperDef.name} is resting on Wellness shift (${morale}% morale)`,
                  `${helperDef.name} sedang istirahat di shift Wellness (moral ${morale}%)`,
                )}
              </span>
            </div>
          ) : (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#D9E8C8]/70 border border-[#6E9B72] text-xs font-semibold text-[#244D3B]">
              <Users className="w-3.5 h-3.5" />
              <span>
                {t(
                  language,
                  `${helperDef.name} (Lv ${helper.level} · Morale ${morale}%): ${speedMult.toFixed(2)}x speed · ${preFoldedIds.length} pre-folded · ${qualityMod >= 0 ? `+${qualityMod}` : qualityMod} Wrap QC`,
                  `${helperDef.name} (Lv ${helper.level} · Moral ${morale}%): ${speedMult.toFixed(2)}x cepat · ${preFoldedIds.length} lipatan awal · ${qualityMod >= 0 ? `+${qualityMod}` : qualityMod} QC`,
                )}
              </span>
            </div>
          )
        )}
      </div>

      <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-[#F6EBD4] border border-[#244D3B]/15">
        <svg
          width="220"
          height="200"
          viewBox="0 0 220 200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setMisclicks((m) => m + 1);
            }
          }}
          className="cursor-crosshair select-none"
        >
          {/* Distinct wrapper silhouette per dimsum shape */}
          {pattern.style === 'crescent' && (
            <>
              <path
                d="M 32 134 C 32 56, 188 56, 188 134 Q 110 156 32 134 Z"
                fill={pattern.wrapperTint}
                stroke="#D2A66E"
                strokeWidth="4"
              />
              <ellipse cx="110" cy="112" rx="44" ry="22" fill={accentColor} opacity="0.88" />
            </>
          )}
          {pattern.style === 'wave' && (
            <>
              <path
                d="M 38 118 Q 56 54 110 54 Q 164 54 182 118 Q 148 152 110 148 Q 72 152 38 118 Z"
                fill={pattern.wrapperTint}
                stroke="#D2A66E"
                strokeWidth="4"
              />
              <ellipse cx="110" cy="108" rx="42" ry="26" fill={accentColor} opacity="0.88" />
            </>
          )}
          {pattern.style === 'lotus' && (
            <>
              <polygon
                points="110,24 176,62 176,138 110,176 44,138 44,62"
                fill={pattern.wrapperTint}
                stroke="#6E9B72"
                strokeWidth="4"
                strokeLinejoin="round"
              />
              <circle cx="110" cy="100" r="34" fill={accentColor} opacity="0.88" />
            </>
          )}
          {pattern.style === 'crown' && (
            <>
              <circle
                cx="110"
                cy="100"
                r="74"
                fill={pattern.wrapperTint}
                stroke="#D2A66E"
                strokeWidth="4"
              />
              <circle cx="110" cy="100" r="34" fill={accentColor} opacity="0.88" />
            </>
          )}

          {/* Pleat fold lines */}
          {pleated.map((pid) => {
            const pt = pattern.points.find((p) => p.id === pid);
            if (!pt) return null;
            return (
              <line
                key={`fold-${pid}`}
                x1={pt.x}
                y1={pt.y}
                x2={foldAnchor.x}
                y2={foldAnchor.y}
                stroke="#244D3B"
                strokeWidth="2.5"
                strokeDasharray="4 3"
              />
            );
          })}
          {/* Interactive Pleat Targets */}
          {pattern.points.map((pt) => {
            const done = pleated.includes(pt.id);
            return (
              <g
                key={pt.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePleat(pt.id);
                }}
                className="cursor-pointer"
              >
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="16"
                  fill={done ? '#6E9B72' : '#ED9B53'}
                  stroke="#244D3B"
                  strokeWidth="2"
                />
                <text
                  x={pt.x}
                  y={pt.y + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill={done ? '#FFFFFF' : '#1C3529'}
                >
                  {done ? '✓' : pt.id + 1}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="text-xs font-semibold text-[#244D3B] tabular-nums">
          {t(
            language,
            `Pleats folded: ${pleated.length} / ${pattern.points.length}`,
            `Lipatan: ${pleated.length} / ${pattern.points.length}`,
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * MINI-GAME 4: STEAMING (Dynamic 78°C Preheat + Pressure Surges & Heat Zone)
 * ========================================================================== */
const SteamMiniGame: React.FC<{
  language: 'en' | 'id';
  recipe: RecipeDef;
  helper?: KitchenHelperState;
  isPaused?: boolean;
  steamEventPenalty?: number;
  steamEventTitle?: string;
  onComplete: (score: number) => void;
}> = ({
  language,
  recipe,
  helper,
  isPaused = false,
  steamEventPenalty = 0,
  steamEventTitle,
  onComplete,
}) => {
  const isResting = helper?.shift === 'wellness';
  const activeLevel = helper && !isResting ? helper.level : undefined;
  const morale = getStaffMorale(helper);
  const speedMult = getEffectiveHelperSpeedMultiplier(helper);
  const skillFx = computeHelperSkillEffects(helper);
  const qualityMod = getEffectiveHelperQualityBonus(helper) + skillFx.stageQualityBonus;

  const steamProfile = useMemo(() => getSteamProfileForRecipe(recipe), [recipe]);
  const [heatLevel, setHeatLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [temp, setTemp] = useState(steamProfile.startTemp);
  const [gustHint, setGustHint] = useState<'surge' | 'draft' | 'steady'>('steady');
  const [progress, setProgress] = useState(skillFx.startingSteamProgress);
  const optimalTicksRef = useRef(0);
  const totalTicksRef = useRef(0);
  const tickIndexRef = useRef(0);
  const helperDef = helper ? getKitchenHelperDef('steam') : null;

  useEffect(() => {
    return () => {
      soundFx.setSteamAmbience(false);
    };
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const progressStep =
      (3.2 + (activeLevel ?? 0) * 0.7) * speedMult * (1 + skillFx.steamSpeedBonusPct);
    const stabilization = Math.min(
      0.85,
      (activeLevel ?? 0) * 0.22 + skillFx.steamStabilizationBonus,
    );
    const interval = window.setInterval(() => {
      tickIndexRef.current += 1;
      const tick = tickIndexRef.current;
      setTemp((prevTemp) => {
        const { nextTemp, gustDelta } = computeNextSteamTemp({
          prevTemp,
          heatLevel,
          tickIndex: tick,
          profile: steamProfile,
          stabilization,
          helperLevel: activeLevel,
        });
        totalTicksRef.current += 1;
        if (nextTemp >= steamProfile.optimalMin && nextTemp <= steamProfile.optimalMax) {
          optimalTicksRef.current += 1;
        }
        if (gustDelta > 0.75) setGustHint('surge');
        else if (gustDelta < -0.75) setGustHint('draft');
        else setGustHint('steady');
        return nextTemp;
      });
      setProgress((prev) => Math.min(100, prev + progressStep));
    }, 150);
    return () => window.clearInterval(interval);
  }, [
    heatLevel,
    isPaused,
    activeLevel,
    speedMult,
    skillFx.steamSpeedBonusPct,
    skillFx.steamStabilizationBonus,
    steamProfile,
  ]);

  const isDone = progress >= 100;
  const inOptimalZone =
    temp >= steamProfile.optimalMin && temp <= steamProfile.optimalMax;
  const floorScore = Math.min(95, 55 + skillFx.steamFloorBonus);
  const currentScore =
    totalTicksRef.current > 0
      ? Math.max(
          floorScore,
          Math.round(
            floorScore +
              (optimalTicksRef.current / totalTicksRef.current) * (100 - floorScore),
          ),
        )
      : 80;

  const span = Math.max(1, steamProfile.maxTemp - steamProfile.minTemp);
  const zoneLeftPct = ((steamProfile.optimalMin - steamProfile.minTemp) / span) * 100;
  const zoneWidthPct = ((steamProfile.optimalMax - steamProfile.optimalMin) / span) * 100;
  const needleLeftPct = Math.max(
    0,
    Math.min(96, ((temp - steamProfile.minTemp) / span) * 96),
  );

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-lg font-bold text-[#244D3B]">
          {t(language, 'Stage 4: Bamboo Steaming Control', 'Tahap 4: Kontrol Pengukusan Bambu')}
        </h3>
        <p className="text-xs text-[#587567] mt-0.5">
          {t(
            language,
            `Steamer starts warm at ${steamProfile.startTemp}°C — boost with High Boil into ${steamProfile.optimalMin}°C–${steamProfile.optimalMax}°C, then balance surges using Medium or Low Heat.`,
            `Kukusan mulai di ${steamProfile.startTemp}°C — panaskan dengan Api Besar ke ${steamProfile.optimalMin}°C–${steamProfile.optimalMax}°C, lalu jaga gejolak uap pakai Api Sedang/Kecil.`,
          )}
        </p>
        {helperDef && helper && (
          isResting ? (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#F6EBD4] border border-[#ED9B53]/50 text-xs font-semibold text-[#92400E]">
              <HeartPulse className="w-3.5 h-3.5" />
              <span>
                {t(
                  language,
                  `${helperDef.name} is resting on Wellness shift (${morale}% morale)`,
                  `${helperDef.name} sedang istirahat di shift Wellness (moral ${morale}%)`,
                )}
              </span>
            </div>
          ) : (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#D9E8C8]/70 border border-[#6E9B72] text-xs font-semibold text-[#244D3B]">
              <Users className="w-3.5 h-3.5" />
              <span>
                {t(
                  language,
                  `${helperDef.name} (Lv ${helper.level} · Morale ${morale}%): ${speedMult.toFixed(2)}x steam speed · ${qualityMod >= 0 ? `+${qualityMod}` : qualityMod} Steam QC`,
                  `${helperDef.name} (Lv ${helper.level} · Moral ${morale}%): ${speedMult.toFixed(2)}x cepat · ${qualityMod >= 0 ? `+${qualityMod}` : qualityMod} QC`,
                )}
              </span>
            </div>
          )
        )}
        {steamEventPenalty < 0 && steamEventTitle && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FEE2E2] border border-[#DC2626]/35 text-xs font-semibold text-[#991B1B]">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>
              {steamEventTitle}: {steamEventPenalty} {t(language, 'Steam QC today', 'skor Kukus hari ini')}
            </span>
          </div>
        )}
      </div>

      {/* Temperature Gauge */}
      <div className="p-4 rounded-xl bg-white border border-[#244D3B]/15 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 text-[#244D3B]">
            <Flame className="w-4 h-4 text-[#ED9B53]" />
            <span>{t(language, 'Steamer Temperature', 'Suhu Kukusan')}</span>
            {gustHint !== 'steady' && (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  gustHint === 'surge'
                    ? 'bg-[#FEF3C7] text-[#B45309]'
                    : 'bg-[#E0F2FE] text-[#0369A1]'
                }`}
              >
                {gustHint === 'surge'
                  ? t(language, 'Steam Surge ↑', 'Lonjakan Uap ↑')
                  : t(language, 'Cool Draft ↓', 'Angin Dingin ↓')}
              </span>
            )}
          </span>
          <span
            className={`font-mono tabular-nums font-bold ${
              inOptimalZone ? 'text-[#244D3B]' : 'text-[#B91C1C]'
            }`}
          >
            {Math.round(temp)}°C{' '}
            {inOptimalZone
              ? t(language, '(Optimal)', '(Optimal)')
              : temp > steamProfile.optimalMax
                ? t(language, '(Too Hot — Use Low)', '(Terlalu Panas — Api Kecil)')
                : t(language, '(Too Cool — Use High)', '(Kurang Panas — Api Besar)')}
          </span>
        </div>

        {/* Visual gauge bar with recipe-calibrated optimal green zone */}
        <div className="relative h-5 rounded-full bg-[#F6EBD4] overflow-hidden border border-[#244D3B]/15">
          <div
            className="absolute inset-y-0 bg-[#6E9B72]/35"
            style={{ left: `${zoneLeftPct}%`, width: `${zoneWidthPct}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-2 bg-[#244D3B] rounded-full transition-all duration-100"
            style={{ left: `${needleLeftPct}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          {(
            [
              { id: 'low', en: 'Low Heat', idLabel: 'Api Kecil' },
              { id: 'medium', en: 'Medium Steam', idLabel: 'Api Sedang' },
              { id: 'high', en: 'High Boil', idLabel: 'Api Besar' },
            ] as const
          ).map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => {
                soundFx.playClick();
                setHeatLevel(btn.id);
              }}
              className={`py-2 rounded-lg text-xs font-bold cursor-pointer ${
                heatLevel === btn.id
                  ? 'bg-[#244D3B] text-white'
                  : 'bg-[#F6EBD4] text-[#244D3B]'
              }`}
            >
              {language === 'id' ? btn.idLabel : btn.en}
            </button>
          ))}
        </div>
      </div>

      {/* Steaming Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-semibold text-[#244D3B] tabular-nums">
          <span>{t(language, 'Steaming Progress', 'Progres Pengukusan')}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-3.5 rounded-full bg-[#D9E8C8] overflow-hidden">
          <div
            className="h-full bg-[#ED9B53] transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <button
        type="button"
        disabled={!isDone}
        onClick={() => onComplete(currentScore)}
        className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[#ED9B53] hover:bg-[#DF883D] disabled:opacity-45 text-[#1C3529] font-bold text-sm cursor-pointer"
      >
        <Sparkles className="w-4 h-4" />
        <span>
          {isDone
            ? t(language, 'Open Bamboo Lid & Inspect Quality', 'Angkat Kukusan & Cek Kualitas')
            : t(language, 'Steaming in progress...', 'Sedang mengukus...')}
        </span>
      </button>
    </div>
  );
};
