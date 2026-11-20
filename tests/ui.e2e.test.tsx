// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessSetupModal } from '../src/components/BusinessSetupModal';
import { CashierModal } from '../src/components/CashierModal';
import { CookingMiniGamesModal } from '../src/components/CookingMiniGamesModal';
import { CustomerFeedbackPopups } from '../src/components/CustomerFeedbackPopups';
import { DailyMissionsDashboard } from '../src/components/DailyMissionsDashboard';
import { FinanceDashboardModal } from '../src/components/FinanceDashboardModal';
import { GameHud } from '../src/components/GameHud';
import { InventoryModal } from '../src/components/InventoryModal';
import { MarketModal } from '../src/components/MarketModal';
import { PackagingModal } from '../src/components/PackagingModal';
import { GameOverModal, PauseModal } from '../src/components/PauseAndEndModals';
import { QualityControlModal } from '../src/components/QualityControlModal';
import { RecipeBookModal } from '../src/components/RecipeBookModal';
import { RotateToLandscapeOverlay } from '../src/components/RotateToLandscapeOverlay';
import { TitleScreen } from '../src/components/TitleScreen';
import { DAILY_EVENTS, getWeeklyFestivalForDay } from '../src/config/gameBalance';
import type { JoystickInputRef } from '../src/game/DimsumWorldCanvas';
import { useGameStore } from '../src/store/useGameStore';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function renderElement(el: React.ReactElement) {
  act(() => {
    root.render(el);
  });
}

function findButtonByText(text: string | RegExp): HTMLButtonElement | undefined {
  const buttons = Array.from(container.querySelectorAll('button'));
  return buttons.find((btn) => {
    const content = btn.textContent?.trim() ?? '';
    return typeof text === 'string' ? content.includes(text) : text.test(content);
  });
}

function clickButton(text: string | RegExp) {
  const btn = findButtonByText(text);
  if (!btn) {
    throw new Error(`Button matching "${String(text)}" not found in DOM`);
  }
  act(() => {
    btn.click();
  });
}

describe('Dimsumpreneur UI DOM E2E Interaction Suite', () => {
  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await useGameStore.getState().resetGame();
  });

  afterEach(() => {
    vi.useRealTimers();
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('navigates TitleScreen -> BusinessSetupModal, toggles Easy/Medium/Hard capital, and launches Day 1', async () => {
    renderElement(<TitleScreen />);
    expect(container.textContent).toContain('Dimsumpreneur');
    clickButton('Start New Business');
    expect(useGameStore.getState().gameState).toBe('BUSINESS_SETUP');

    renderElement(<BusinessSetupModal />);
    expect(container.textContent).toContain('Establish Your Dimsum Outlet');
    expect(container.textContent).toContain('Rp500.000');

    // Switch difficulty to Medium & Hard and verify breakdown updates
    clickButton('Medium');
    expect(container.textContent).toContain('Rp300.000');
    clickButton('Hard');
    expect(container.textContent).toContain('Rp150.000');
    clickButton('Easy');
    expect(container.textContent).toContain('Rp500.000');

    // Submit setup form
    const form = container.querySelector('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(useGameStore.getState().gameState).toBe('MORNING_PREP');
    expect(useGameStore.getState().cashBalance).toBe(100_000);
  });

  it('renders GameHud Daily Goals, Daily Event, Shop Reputation, Quick Dock, and dismissible Customer Feedback Popups', async () => {
    await useGameStore.getState().startNewGame({
      name: 'Warung Uji',
      concept: 'balanced',
      targetMarket: 'general',
      difficulty: 'easy',
      enableTutorial: false,
    });

    useGameStore.setState({
      activeDailyEvent: DAILY_EVENTS.find((e) => e.id === 'food_critic')!,
      business: { ...useGameStore.getState().business, reputation: 60 },
      feedbackPopups: [
        {
          id: 'ui-fb-1',
          customerName: 'Rani',
          archetypeId: 'healthy',
          recipeNameEn: 'Chicken Carrot Dimsum',
          recipeNameId: 'Dimsum Ayam Wortel',
          satisfaction: 94,
          ratingStars: 5,
          sentiment: 'positive',
          commentEn: 'Super fresh bamboo aroma and balanced filling!',
          commentId: 'Aroma kukusan bambu segar dan isiannya pas!',
          reputationDelta: 3,
          newReputation: 63,
          createdAt: Date.now(),
        },
      ],
    });

    const joystickRef: React.MutableRefObject<JoystickInputRef> = {
      current: { dx: 0, dy: 0 },
    };

    renderElement(
      <div>
        <GameHud joystickRef={joystickRef} />
        <CustomerFeedbackPopups />
      </div>,
    );

    expect(container.textContent).toContain('Warung Uji');
    expect(container.textContent).toContain('Daily Goals');
    expect(container.textContent).toContain('Serve 50 Customers');
    expect(container.textContent).toContain('Food Critic Visiting');
    expect(container.textContent).toContain('Shop Rep 60/100');
    expect(container.textContent).toContain('Rani');
    expect(container.textContent).toContain('Super fresh bamboo aroma');

    // Dismiss popup via close button
    const dismissBtn = container.querySelector('button[aria-label="Dismiss customer feedback"]') as HTMLButtonElement;
    expect(dismissBtn).not.toBeNull();
    act(() => {
      dismissBtn.click();
    });
    expect(useGameStore.getState().feedbackPopups).toHaveLength(0);

    // Click Quick Dock "Market" button -> opens Market station
    clickButton('Market');
    expect(useGameStore.getState().activeStation).toBe('market');
  });

  it('opens MarketModal, adds 3+ packs, runs SupplierNegotiationModal, and checks out discounted cart', async () => {
    await useGameStore.getState().startNewGame({
      name: 'Nego Test Shop',
      concept: 'balanced',
      targetMarket: 'general',
      difficulty: 'easy',
      enableTutorial: false,
    });
    useGameStore.setState({ activeMarketEvent: null });

    renderElement(<MarketModal />);
    expect(container.textContent).toContain('Ingredient & Packaging Market');

    // Add 3 packs of Chicken Breast via +3 bulk button
    const plus3Buttons = Array.from(container.querySelectorAll('button')).filter(
      (b) => b.textContent?.trim() === '+3',
    );
    expect(plus3Buttons.length).toBeGreaterThan(0);
    act(() => {
      plus3Buttons[0].click();
    });

    // Bulk negotiation button for Segar Poultry Farm unlocks
    clickButton(/Negotiate Segar Poultry Farm/);
    expect(container.textContent).toContain('Wholesale Bulk Negotiation');
    expect(container.textContent).toContain('Supplier Trust');

    // Select -5% safe discount & Friendly Partnership -> guaranteed instant/amenable outcome
    clickButton('-5%');
    clickButton('Friendly Partnership');
    clickButton(/Propose 5% Off/);

    // If counter-offer instead of instant accept, accept counter; otherwise close outcome banner
    const acceptCounter = findButtonByText(/Accept .* Counter/);
    if (acceptCounter) {
      act(() => {
        acceptCounter.click();
      });
    }
    const returnBtn = findButtonByText('Return to Market Cart');
    if (returnBtn) {
      act(() => {
        returnBtn.click();
      });
    }

    const deal = useGameStore.getState().activeSupplierDeals['Segar Poultry Farm'];
    expect(deal).toBeDefined();

    // Confirm discounted checkout
    const cashBefore = useGameStore.getState().cashBalance;
    clickButton('Confirm Purchase');
    expect(useGameStore.getState().cashBalance).toBeLessThan(cashBefore);
  });

  it('uses RecipeBookModal Complexity sort, Research tab R&D investment, and Custom Recipe tab', async () => {
    await useGameStore.getState().startNewGame({
      name: 'R&D Kitchen',
      concept: 'balanced',
      targetMarket: 'general',
      difficulty: 'easy',
      enableTutorial: false,
    });

    renderElement(<RecipeBookModal />);
    expect(container.textContent).toContain('Menu Complexity');
    expect(container.textContent).toContain('Simple');

    // Toggle efficiency sort
    clickButton('Prioritize Easy');
    expect(container.textContent).toContain('Fastest First');

    // Switch to Research tab and research Chicken Carrot Dimsum (Rp30.000)
    clickButton(/Research \(0\//);
    expect(container.textContent).toContain('Culinary R&D Lab');
    clickButton(/Research · Rp30\.000/);

    expect(useGameStore.getState().researchedRecipeIds).toContain('chicken_carrot');
    expect(container.textContent).toContain('Active Formula');

    // Switch to Custom Recipe tab and save custom recipe
    clickButton('Custom Recipe');
    const customForm = container.querySelector('form')!;
    act(() => {
      customForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(
      useGameStore.getState().recipes.some((r) => r.nameEn === 'Healthy Signature Dimsum'),
    ).toBe(true);
  });

  it('completes 4-stage CookingMiniGamesModal -> QualityControlModal -> PackagingModal -> CashierModal E2E flow', async () => {
    vi.useFakeTimers();
    await useGameStore.getState().startNewGame({
      name: 'Full Kitchen E2E',
      concept: 'balanced',
      targetMarket: 'general',
      difficulty: 'easy',
      enableTutorial: false,
    });
    useGameStore.setState({
      activeDailyEvent: DAILY_EVENTS.find((e) => e.id === 'food_critic')!,
    });

    // Start cooking Chicken Carrot Dimsum
    const startRes = useGameStore.getState().startCookingSession('chicken_carrot', 1);
    expect(startRes.ok).toBe(true);

    // Stage 1: Prep
    renderElement(<CookingMiniGamesModal />);
    expect(container.textContent).toContain('Stage 1: Ingredient Preparation');
    const reqButtons = Array.from(container.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('In recipe'),
    );
    expect(reqButtons).toHaveLength(6);
    for (const btn of reqButtons) {
      act(() => {
        btn.click();
      });
    }
    clickButton('Proceed to Mixing Station');
    expect(useGameStore.getState().activeCooking?.stage).toBe('MIX');

    // Stage 2: Mix
    renderElement(<CookingMiniGamesModal />);
    expect(container.textContent).toContain('Stage 2: Filling Composition & Mixing');
    for (let i = 0; i < 6; i++) {
      const whiskBtn = findButtonByText(/Whisk & Fold/);
      if (whiskBtn && !whiskBtn.disabled) {
        act(() => {
          whiskBtn.click();
        });
      }
    }
    clickButton('Finish Mixing');
    expect(useGameStore.getState().activeCooking?.stage).toBe('WRAP');

    // Stage 3: Wrap (4 sample pieces * 5 pleat <g> targets)
    renderElement(<CookingMiniGamesModal />);
    expect(container.textContent).toContain('Stage 3: Artisan Dimsum Wrapping');
    for (let piece = 0; piece < 4; piece++) {
      const pleatTargets = Array.from(container.querySelectorAll('svg g'));
      expect(pleatTargets).toHaveLength(5);
      for (const g of pleatTargets) {
        act(() => {
          g.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
      }
    }
    expect(useGameStore.getState().activeCooking?.stage).toBe('STEAM');

    // Stage 4: Steam (advance fake interval timer until 100%)
    renderElement(<CookingMiniGamesModal />);
    expect(container.textContent).toContain('Stage 4: Bamboo Steaming Control');
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    clickButton('Open Bamboo Lid & Inspect Quality');
    vi.useRealTimers();

    // Quality Control Modal
    expect(useGameStore.getState().gameState).toBe('QUALITY_CONTROL');
    renderElement(<QualityControlModal />);
    expect(container.textContent).toContain('QC PASSED');
    clickButton('Send to Packaging');

    // Packaging Modal
    expect(useGameStore.getState().gameState).toBe('PACKAGING');
    renderElement(<PackagingModal />);
    expect(container.textContent).toContain('Packaging & Pricing Bench');
    clickButton('Pack Boxes');
    expect(useGameStore.getState().productBatches).toHaveLength(1);

    // Cashier Modal -> Open Store & Serve Customer
    renderElement(<CashierModal />);
    clickButton('Open Store Now');
    expect(useGameStore.getState().gameState).toBe('STORE_OPEN');
    expect(useGameStore.getState().customers).toHaveLength(1);

    clickButton(/Serve & Collect/);
    expect(useGameStore.getState().salesOrders).toHaveLength(1);
    expect(useGameStore.getState().feedbackPopups).toHaveLength(1);

    // Check Today's Receipts tab
    clickButton(/Today's Receipts \(1\)/);
    expect(container.textContent).toContain('COGS');
  });

  it('interacts with FinanceDashboardModal tabs: Upgrades, Kitchen Staff Morale/Wellness, and StaffSkillTreePanel training drill', async () => {
    vi.useFakeTimers();
    await useGameStore.getState().startNewGame({
      name: 'HR & Finance Lab',
      concept: 'balanced',
      targetMarket: 'general',
      difficulty: 'easy',
      enableTutorial: false,
    });
    useGameStore.setState({ cashBalance: 250_000 });

    renderElement(<FinanceDashboardModal />);
    expect(container.textContent).toContain('Cash Flow & P&L Statement');

    // Upgrades Tab -> Upgrade Packaging Station (Rp50.000)
    clickButton('Equipment Upgrades');
    const upgradeButtons = Array.from(container.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Upgrade ·'),
    );
    expect(upgradeButtons.length).toBeGreaterThan(0);
    act(() => {
      upgradeButtons[0].click();
    });
    expect(useGameStore.getState().upgrades.steamer).toBe(2);

    // Kitchen Staff Tab -> Hire Prep Helper (Rp35.000) -> Assign Wellness Shift
    clickButton(/Kitchen Staff/);
    const hireBtn = findButtonByText(/Hire · Rp35\.000/);
    expect(hireBtn).toBeDefined();
    act(() => {
      hireBtn!.click();
    });
    expect(useGameStore.getState().kitchenStaff).toHaveLength(1);
    expect(container.textContent).toContain('Employee Morale');

    clickButton('Assign Wellness Shift');
    expect(useGameStore.getState().kitchenStaff[0].shift).toBe('wellness');
    expect(container.textContent).toContain('Wellness Shift');

    // Staff Skill Tree sub-view -> Train Tier 1 Root Node (4s) -> advance timer to master
    clickButton('Skill Tree');
    expect(container.textContent).toContain('Unlocked Mini-Game Efficiency');
    clickButton(/Train \(4s\)/);
    expect(useGameStore.getState().activeSkillTraining?.nodeId).toBe('prep_mise_en_place');

    act(() => {
      vi.advanceTimersByTime(4500);
    });
    expect(useGameStore.getState().activeSkillTraining).toBeNull();
    expect(useGameStore.getState().kitchenStaff[0].unlockedSkills).toContain(
      'prep_mise_en_place',
    );
    expect(container.textContent).toContain('Mastered');
    vi.useRealTimers();
  });

  it('renders InventoryModal, PauseModal language/mute toggles, and GameOverModal reset flow', async () => {
    await useGameStore.getState().startNewGame({
      name: 'Storage & Menu Check',
      concept: 'balanced',
      targetMarket: 'general',
      difficulty: 'easy',
      enableTutorial: false,
    });

    renderElement(<InventoryModal />);
    expect(container.textContent).toContain('Cold Storage & Inventory');
    clickButton('Packaging Boxes');
    expect(container.textContent).toContain('Paper Box');

    renderElement(<PauseModal />);
    expect(container.textContent).toContain('Cozy BGM Volume');
    expect(container.textContent).toContain('Kitchen & Shop SFX');
    const bgmSlider = container.querySelector(
      'input[aria-label="BGM Volume"]',
    ) as HTMLInputElement | null;
    const sfxSlider = container.querySelector(
      'input[aria-label="SFX Volume"]',
    ) as HTMLInputElement | null;
    expect(bgmSlider).not.toBeNull();
    expect(sfxSlider).not.toBeNull();
    act(() => {
      useGameStore.getState().setBgmVolume(0.3);
      useGameStore.getState().setSfxVolume(0.85);
    });
    expect(container.textContent).toContain('30%');
    expect(container.textContent).toContain('85%');

    clickButton('English');
    expect(useGameStore.getState().language).toBe('id');
    expect(container.textContent).toContain('Musik Latar (BGM)');
    expect(container.textContent).toContain('Efek Suara (SFX)');
    clickButton('Suara Aktif');
    expect(useGameStore.getState().muted).toBe(true);

    renderElement(<GameOverModal />);
    expect(container.textContent).toContain('KEBANGKRUTAN USAHA');
    await act(async () => {
      clickButton('Mulai Bisnis Baru');
    });
    expect(useGameStore.getState().gameState).toBe('MAIN_MENU');
  });

  it('supports recipe-specific Mix/Wrap/Steam on shrimp_veg, GameHud Compact mode, and Indonesian localization', async () => {
    vi.useFakeTimers();
    await useGameStore.getState().startNewGame({
      name: 'Outlet Nusantara',
      concept: 'premium',
      targetMarket: 'families',
      difficulty: 'easy',
      enableTutorial: false,
    });
    useGameStore.setState({ language: 'id' });
    expect(useGameStore.getState().language).toBe('id');

    // Verify GameHud Compact HUD toggle in Indonesian mode
    const joystickRef: React.MutableRefObject<JoystickInputRef> = {
      current: { dx: 0, dy: 0 },
    };
    renderElement(<GameHud joystickRef={joystickRef} />);
    expect(container.textContent).toContain('Target Harian');
    expect(container.textContent).toContain('Sembunyikan Panel Kiri');
    clickButton('Sembunyikan Panel Kiri');
    expect(container.textContent).toContain('Tampilkan Panel Kiri');
    expect(container.textContent).not.toContain('Outlet Nusantara');
    expect(container.textContent).not.toContain('Target Harian');
    clickButton('Tampilkan Panel Kiri');
    expect(container.textContent).toContain('Outlet Nusantara');
    expect(container.textContent).toContain('Target Harian');

    expect(container.textContent).toContain('HUD Ringkas');
    clickButton('HUD Ringkas');
    expect(container.textContent).toContain('HUD Penuh');
    expect(container.textContent).not.toContain('Target Omzet Hari 1');

    // Start cooking shrimp_veg -> Mix (60% / 25%), Wrap (6 crescent pleats), Steam (78°C start)
    act(() => {
      useGameStore.setState((s) => ({
        recipes: s.recipes.map((r) =>
          r.id === 'shrimp_veg' ? { ...r, unlocked: true } : r,
        ),
      }));
    });
    let prepRes: { ok: boolean; error?: string } = { ok: false };
    act(() => {
      prepRes = useGameStore.getState().startCookingSession('shrimp_veg', 1);
    });
    expect(prepRes.ok).toBe(true);

    // Jump straight to MIX to verify dynamic shrimp_veg ratios & 6-pleat Wrap & 78°C Steam
    act(() => {
      useGameStore.getState().completeCookingStage('PREP', 96);
    });
    renderElement(<CookingMiniGamesModal />);
    expect(container.textContent).toContain('Target 60%');
    expect(container.textContent).toContain('Target 25%');

    act(() => {
      useGameStore.getState().completeCookingStage('MIX', 95);
    });
    renderElement(<CookingMiniGamesModal />);
    expect(container.textContent).toContain('Kipas Sabit Hakau (6 lipatan)');
    expect(container.querySelectorAll('svg g')).toHaveLength(6);

    act(() => {
      useGameStore.getState().completeCookingStage('WRAP', 95);
    });
    renderElement(<CookingMiniGamesModal />);
    expect(container.textContent).toContain('78°C');
    clickButton('Api Besar');
    act(() => {
      vi.advanceTimersByTime(900);
    });
    // Pausing game freezes SteamMiniGame timer cleanly
    const pausedSnapshot = container.textContent;
    act(() => {
      useGameStore.getState().togglePause();
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(container.textContent).toBe(pausedSnapshot);
    act(() => {
      useGameStore.getState().togglePause();
    });
    clickButton('Api Sedang');
    act(() => {
      vi.advanceTimersByTime(5100);
    });
    clickButton('Angkat Kukusan & Cek Kualitas');
    vi.useRealTimers();

    // Check Indonesian QualityControlModal & CashierModal localization
    renderElement(<QualityControlModal />);
    expect(container.textContent).toContain('LOLOS QC');
    expect(container.textContent).toMatch(/Sempurna|Sangat Baik/);
    expect(container.textContent).toContain('Resep (R)');
    clickButton('Kirim ke Pengemasan');

    renderElement(<PackagingModal />);
    expect(container.textContent).toContain('HPP Aktual / Kotak');
    clickButton('Kemas Produk');

    renderElement(<CashierModal />);
    clickButton('Buka Toko Sekarang');
    clickButton(/Layani & Bayar/);
    clickButton(/Struk Hari Ini \(1\)/);
    expect(container.textContent).toContain('HPP');
    expect(container.textContent).toContain('Langsung');
  });

  it('unlocks Auto-Batch Delegation in RecipeBookModal with 2+ kitchen helpers, completes via GameHud timer, and unifies Staff progression UI', async () => {
    vi.useFakeTimers();
    await useGameStore.getState().startNewGame({
      name: 'Auto Crew Kitchen',
      concept: 'balanced',
      targetMarket: 'general',
      difficulty: 'easy',
      enableTutorial: false,
    });
    useGameStore.setState({ cashBalance: 250_000, language: 'en' });

    // 1 helper -> delegation button stays locked at 1/2
    act(() => {
      expect(useGameStore.getState().hireKitchenHelper('prep').ok).toBe(true);
    });
    renderElement(<RecipeBookModal />);
    expect(container.textContent).toContain('Auto-Batch (1/2 Staff)');

    // Hire 2nd helper -> check unified FinanceDashboardModal + StaffSkillTreePanel UI
    act(() => {
      expect(useGameStore.getState().hireKitchenHelper('mix').ok).toBe(true);
    });
    renderElement(<FinanceDashboardModal />);
    clickButton(/Kitchen Staff/);
    expect(container.textContent).toContain('Auto-Batch Ready');
    expect(container.textContent).toContain('Skill Tier 1/3');
    expect(container.textContent).toContain('Lv 2 unlocks Skill Tier 2 & Auto-Batch power');

    clickButton('Skill Tree');
    expect(container.textContent).toContain('Lv 1/3 · Morale 85%');

    // Delegate from RecipeBookModal -> GameHud shows progress and timer completes batch
    renderElement(<RecipeBookModal />);
    clickButton(/Delegate to Staff/);
    expect(useGameStore.getState().activeDelegation).not.toBeNull();

    const joystickRef: React.MutableRefObject<JoystickInputRef> = {
      current: { dx: 0, dy: 0 },
    };
    renderElement(<GameHud joystickRef={joystickRef} />);
    expect(container.textContent).toContain('Staff Auto-Batch');

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(useGameStore.getState().activeDelegation).toBeNull();
    expect(useGameStore.getState().productionBatches).toHaveLength(1);
    expect(useGameStore.getState().productionBatches[0].status).toBe('QC_PASSED');
    vi.useRealTimers();
  });

  it('applies Clearance Sale markdowns from InventoryModal and CashierModal and labels Clearance receipts', async () => {
    await useGameStore.getState().startNewGame({
      name: 'Zero Waste Bistro',
      concept: 'balanced',
      targetMarket: 'general',
      difficulty: 'easy',
      enableTutorial: false,
    });
    useGameStore.setState({
      language: 'en',
      productBatches: [
        {
          id: 'pb-exp-tonight',
          productionBatchId: 'prod-1',
          recipeId: 'chicken_carrot',
          packagingTypeId: 'paper_box',
          boxesProduced: 2,
          boxesAvailable: 2,
          pcsPerBox: 4,
          unitCostPerBox: 6_000,
          sellingPricePerBox: 12_000,
          qualityScore: 89,
          status: 'PACKAGED',
          producedDay: 1,
          expiryDay: 1,
        },
      ],
    });

    // InventoryModal Packaged Dimsum tab -> apply -25% markdown
    renderElement(<InventoryModal />);
    clickButton('Packaged Dimsum');
    expect(container.textContent).toContain('Expires tonight');
    clickButton('-25%');
    expect(useGameStore.getState().productBatches[0].sellingPricePerBox).toBe(9_000);
    expect(container.textContent).toContain('Rp9.000');

    // CashierModal -> toggle -40%, open store, serve customer, verify Clearance receipt tag
    renderElement(<CashierModal />);
    expect(container.textContent).toContain('Expiring Tonight — Clearance Sale');
    clickButton('-40%');
    expect(useGameStore.getState().productBatches[0].sellingPricePerBox).toBe(7_200);
    expect(container.textContent).toContain('Rp7.200 (-40%)');

    clickButton('Open Store Now');
    clickButton(/Serve & Collect/);
    clickButton(/Today's Receipts \(1\)/);
    expect(container.textContent).toContain('Clearance');
  });

  it('renders Prioritas P1 UI: Dine-In tables, Rush Hour HUD badge, Online Delivery Ojol dispatch, B2B Contracts, 9 Recipes, and 26 Achievements', async () => {
    await useGameStore.getState().startNewGame({
      name: 'Bistro P1 Lengkap',
      concept: 'balanced',
      targetMarket: 'general',
      difficulty: 'easy',
      enableTutorial: false,
    });

    useGameStore.setState({
      language: 'en',
      cashBalance: 350_000,
      gameState: 'STORE_OPEN',
      storeTimeRemainingSec: 65,
      rushHourActive: true,
      business: { ...useGameStore.getState().business, reputation: 65 },
      productBatches: [
        {
          id: 'pb-ui-p1',
          productionBatchId: 'prod-ui-1',
          recipeId: 'chicken_carrot',
          packagingTypeId: 'paper_box',
          boxesProduced: 5,
          boxesAvailable: 5,
          pcsPerBox: 4,
          unitCostPerBox: 6_000,
          sellingPricePerBox: 12_000,
          qualityScore: 92,
          status: 'PACKAGED',
          producedDay: 1,
          expiryDay: 3,
        },
        {
          id: 'pb-ui-b2b',
          productionBatchId: 'prod-ui-2',
          recipeId: 'chicken_carrot',
          packagingTypeId: 'standard_box',
          boxesProduced: 3,
          boxesAvailable: 3,
          pcsPerBox: 8,
          unitCostPerBox: 11_000,
          sellingPricePerBox: 22_000,
          qualityScore: 92,
          status: 'PACKAGED',
          producedDay: 1,
          expiryDay: 3,
        },
      ],
      customers: [
        {
          id: 'ui-cust-dine',
          archetypeId: 'family',
          name: 'Keluarga Sari',
          requestedRecipeId: 'chicken_carrot',
          requestedBoxType: 'paper_box',
          quantityBoxes: 1,
          maxBudget: 25_000,
          patienceMax: 30,
          patienceRemaining: 28,
          lifecycle: 'WAITING_ORDER',
          diningMode: 'DINE_IN',
          tableSlot: 0,
          spawnTimeSec: 0,
          dialogueEn: 'Table for one box please!',
          dialogueId: 'Makan di tempat ya!',
          seatSlot: 0,
        },
      ],
      onlineOrders: [
        {
          id: 'ui-ojol-1',
          platform: 'ShopeeFood',
          courierName: 'Teh Rina (Kurir)',
          recipeId: 'chicken_carrot',
          boxType: 'paper_box',
          quantityBoxes: 1,
          grossPricePerBox: 14_000,
          commissionRate: 0.15,
          netPayoutPerBox: 11_900,
          timeRemainingSec: 22,
          timeMaxSec: 25,
        },
      ],
      preOrders: [
        {
          id: 'ui-b2b-1',
          customerName: 'BEM Kampus Sehat Nusantara',
          archetypeId: 'student',
          tier: 'campus',
          minReputation: 50,
          accepted: false,
          penaltyReputation: 3,
          contractStartDay: 1,
          recipeId: 'chicken_carrot',
          boxType: 'standard_box',
          quantityBoxes: 2,
          offeredPricePerBox: 26_000,
          dueDay: 2,
          fulfilled: false,
        },
      ],
    });

    // 1. GameHud displays Rush Hour wave, Dine-In table ratio, and Ojol alert badge
    const joystickRef: React.MutableRefObject<JoystickInputRef> = {
      current: { dx: 0, dy: 0 },
    };
    renderElement(<GameHud joystickRef={joystickRef} />);
    expect(container.textContent).toContain('Lunch Rush Hour');
    expect(container.textContent).toContain('Dine-In 0/2');
    expect(container.textContent).toContain('Ojol: 1');

    // 2. CashierModal: Dine-In badge -> Serve guest -> Seated Dine-In Table -> Online Delivery tab -> B2B Contracts tab
    renderElement(<CashierModal />);
    expect(container.textContent).toContain('Dine-In (+18%)');
    clickButton(/Serve & Collect/);
    expect(container.textContent).toContain('Seated Dine-In Tables (1/2)');
    expect(container.textContent).toContain('Table #1 · Keluarga Sari');

    clickButton(/Online Delivery \(1\)/);
    expect(container.textContent).toContain('ShopeeFood');
    expect(container.textContent).toContain('Teh Rina (Kurir)');
    clickButton(/Dispatch Courier/);
    expect(useGameStore.getState().onlineOrders).toHaveLength(0);

    clickButton(/B2B Contracts \(1\)/);
    expect(container.textContent).toContain('Campus Event');
    expect(container.textContent).toContain('Due Day 2');
    clickButton('Accept Contract');
    expect(useGameStore.getState().preOrders[0].accepted).toBe(true);
    clickButton(/Fulfill \(/);
    expect(useGameStore.getState().preOrders[0].fulfilled).toBe(true);

    // 3. RecipeBookModal lists all 9 recipes & 9 R&D entries
    renderElement(<RecipeBookModal />);
    expect(container.textContent).toContain('Low-Fat Mentai Dimsum');
    expect(container.textContent).toContain('Whole-Wheat Herb Bun');
    expect(container.textContent).toContain('Research (0/9)');

    // 4. FinanceDashboardModal shows dining_seating upgrade & 26 tiered Achievements with category filter
    renderElement(<FinanceDashboardModal />);
    clickButton('Equipment Upgrades');
    expect(container.textContent).toContain('Dine-In Dining Area');
    clickButton('Ledger & Achievements');
    expect(container.textContent).toContain('/26');
    expect(container.textContent).toContain('Cozy Table Host');
    clickButton('Finance');
    expect(container.textContent).toContain('Dimsum Millionaire');
  });

  it('renders P2 Weekly Festival, Rival Surge pricing, Outlet Tiers, Franchise Branch expansion, and Endless Mastery UI', async () => {
    const fest7 = getWeeklyFestivalForDay(7)!;
    await useGameStore.getState().startNewGame({
      name: 'Outlet Maharaja',
      concept: 'balanced',
      targetMarket: 'general',
      difficulty: 'easy',
      enableTutorial: false,
    });

    useGameStore.setState({
      currentDay: 7,
      gameState: 'STORE_OPEN',
      cashBalance: 650_000,
      activeDailyEvent: null,
      activeFestival: fest7,
      upgrades: {
        steamer: 3,
        refrigerator: 3,
        prep_table: 2,
        packaging_station: 2,
        decoration: 2,
        dining_seating: 2,
      },
      business: {
        ...useGameStore.getState().business,
        level: 5,
        reputation: 88,
      },
      productBatches: [
        {
          id: 'pb-ui-fest',
          productionBatchId: 'prod-ui-f',
          recipeId: 'shrimp_veg',
          packagingTypeId: 'paper_box',
          boxesProduced: 3,
          boxesAvailable: 3,
          pcsPerBox: 4,
          unitCostPerBox: 8_000,
          sellingPricePerBox: 20_000,
          qualityScore: 92,
          status: 'PACKAGED',
          producedDay: 7,
          expiryDay: 9,
        },
      ],
      customers: [
        {
          id: 'ui-fest-cust',
          archetypeId: 'explorer',
          name: 'Pengunjung Bazar',
          requestedRecipeId: 'shrimp_veg',
          requestedBoxType: 'paper_box',
          quantityBoxes: 1,
          maxBudget: 30_000,
          patienceMax: 30,
          patienceRemaining: 29,
          lifecycle: 'WAITING_ORDER',
          diningMode: 'TAKEAWAY',
          spawnTimeSec: 0,
          dialogueEn: 'Fresh shrimp please!',
          dialogueId: 'Udang segarnya ya!',
          seatSlot: 0,
        },
      ],
    });

    // 1. GameHud displays Outlet Tier name, Active Festival banner & Rival Share
    const joystickRef: React.MutableRefObject<JoystickInputRef> = {
      current: { dx: 0, dy: 0 },
    };
    renderElement(<GameHud joystickRef={joystickRef} />);
    expect(container.textContent).toContain('Franchise Network');
    expect(container.textContent).toContain(fest7.titleEn);
    expect(container.textContent).toContain('Kedai Naga Sehat');

    // 2. MarketModal highlights Rival demand campaign & +15% surge tags
    renderElement(<MarketModal />);
    expect(container.textContent).toContain('Kedai Naga Sehat');
    expect(container.textContent).toContain('Rival Surge +15%');

    // 3. RecipeBookModal highlights Weekly Culinary Festival banner & featured dishes
    renderElement(<RecipeBookModal />);
    expect(container.textContent).toContain('Weekly Culinary Festival');
    clickButton(/Shrimp Vegetable Dimsum/i);
    expect(container.textContent).toContain('Festival Featured (+15% Rev');

    // 4. CashierModal displays Festival banner and +15% Serve & Collect total (Rp23.000)
    renderElement(<CashierModal />);
    expect(container.textContent).toContain(fest7.titleEn);
    expect(container.textContent).toContain('Rp23.000');

    // 5. FinanceDashboardModal -> Expansion & Rivalry tab: open branch, upgrade branch, unlock Endless Mastery
    renderElement(<FinanceDashboardModal />);
    clickButton('Expansion & Rivalry');
    expect(container.textContent).toContain('Outlet Scale Progression');
    expect(container.textContent).toContain('BSD Wellness Kiosk');
    expect(container.textContent).toContain('Weekly Culinary Festival');

    clickButton(/Open Branch · Rp220\.000/);
    expect(useGameStore.getState().franchiseBranches).toHaveLength(1);
    expect(container.textContent).toContain('Expand Lv 2');

    clickButton(/Unlock Endless Mastery/);
    expect(useGameStore.getState().endlessMasteryUnlocked).toBe(true);
    expect(useGameStore.getState().prestigeLevel).toBe(1);
    expect(container.textContent).toContain('Rank ★1');
  });

  it('renders Daily Missions in GameHud and FinanceDashboardModal and reflects auto-granted bonus currency cleanly', async () => {
    await useGameStore.getState().startNewGame({
      name: 'Warung Misi',
      concept: 'balanced',
      targetMarket: 'general',
      difficulty: 'easy',
      enableTutorial: false,
    });

    useGameStore.setState({
      cashBalance: 100_000,
      dailyMissions: [
        {
          id: 'ui-dm-1',
          day: 1,
          type: 'SELL_RECIPE_PCS',
          recipeId: 'shrimp_veg',
          titleEn: 'Sell 50 Shrimp Dumplings',
          titleId: 'Jual 50 Pangsit Udang',
          descriptionEn: 'Sell 50 pcs.',
          descriptionId: 'Jual 50 pcs.',
          target: 50,
          current: 40,
          completed: false,
          claimed: false,
          rewardCash: 30_000,
          unitLabelEn: 'pcs',
          unitLabelId: 'pcs',
        },
        {
          id: 'ui-dm-2',
          day: 1,
          type: 'PACKAGE_BOXES',
          titleEn: 'Pack 4 Fresh Boxes',
          titleId: 'Kemas 4 Kotak Siap Jual',
          descriptionEn: 'Pack 4 boxes.',
          descriptionId: 'Kemas 4 kotak.',
          target: 4,
          current: 4,
          completed: true,
          claimed: false,
          rewardCash: 16_000,
          unitLabelEn: 'boxes',
          unitLabelId: 'kotak',
        },
        {
          id: 'ui-dm-3',
          day: 1,
          type: 'HIGH_QC_BATCH',
          minQualityScore: 85,
          titleEn: 'Chef Craft: 1 Batch QC ≥ 85',
          titleId: 'Kualitas Prima: 1 Batch QC ≥ 85',
          descriptionEn: 'High QC batch.',
          descriptionId: 'Batch QC tinggi.',
          target: 1,
          current: 0,
          completed: false,
          claimed: false,
          rewardCash: 15_000,
          unitLabelEn: 'batch',
          unitLabelId: 'batch',
        },
      ],
    });

    const joystickRef: React.MutableRefObject<JoystickInputRef> = {
      current: { dx: 0, dy: 0 },
    };
    renderElement(<GameHud joystickRef={joystickRef} />);

    expect(container.textContent).toContain('Daily Missions');
    expect(container.textContent).toContain('Sell 50 Shrimp Dumplings');
    expect(container.textContent).toContain('Pack 4 Fresh Boxes');
    expect(container.textContent).toContain('Chef Craft: 1 Batch QC ≥ 85');

    // Progressing Shrimp mission to 50 automatically grants both Shrimp (+30k) and any pending completed mission (+16k)
    let rewardRes!: ReturnType<ReturnType<typeof useGameStore.getState>['trackDailyMissionProgress']>;
    act(() => {
      rewardRes = useGameStore.getState().trackDailyMissionProgress({
        type: 'SALE',
        recipeId: 'shrimp_veg',
        pcsSold: 10,
        boxesSold: 1,
        revenueAmount: 25_000,
        orderType: 'DIRECT',
      });
    });
    expect(rewardRes.bonusGranted).toBe(46_000);
    expect(useGameStore.getState().cashBalance).toBe(146_000);

    // Live HUD updates automatically via Zustand subscription
    expect(container.textContent).toContain('2/3');
    expect(container.textContent).toContain('Bonus Added +Rp30.000');

    // Open FinanceDashboardModal and verify DailyMissionsDashboard status is displayed in Report tab
    renderElement(<FinanceDashboardModal />);
    expect(container.textContent).toContain('Daily Missions');
    expect(container.textContent).toContain('Day 1');
    expect(container.textContent).toContain('Bonus Added to Wallet');
  });

  it('renders dedicated DailyMissionsDashboard with 3 goals, completion status, and interactive claimable reward button', async () => {
    await useGameStore.getState().startNewGame({
      name: 'Warung Dashboard Misi',
      concept: 'balanced',
      targetMarket: 'general',
      difficulty: 'easy',
      enableTutorial: false,
    });

    useGameStore.setState({
      cashBalance: 100_000,
      dailyMissions: [
        {
          id: 'dash-dm-1',
          day: 1,
          type: 'SELL_RECIPE_PCS',
          recipeId: 'shrimp_veg',
          titleEn: 'Sell 50 Shrimp Dumplings',
          titleId: 'Jual 50 Pangsit Udang',
          descriptionEn: 'Sell 50 pcs.',
          descriptionId: 'Jual 50 pcs.',
          target: 50,
          current: 50,
          completed: true,
          claimed: false,
          rewardCash: 30_000,
          unitLabelEn: 'pcs',
          unitLabelId: 'pcs',
        },
        {
          id: 'dash-dm-2',
          day: 1,
          type: 'PACKAGE_BOXES',
          titleEn: 'Pack 4 Fresh Boxes',
          titleId: 'Kemas 4 Kotak Siap Jual',
          descriptionEn: 'Pack 4 boxes.',
          descriptionId: 'Kemas 4 kotak.',
          target: 4,
          current: 4,
          completed: true,
          claimed: true,
          rewardCash: 16_000,
          unitLabelEn: 'boxes',
          unitLabelId: 'kotak',
        },
        {
          id: 'dash-dm-3',
          day: 1,
          type: 'HIGH_QC_BATCH',
          minQualityScore: 85,
          titleEn: 'Chef Craft: 1 Batch QC ≥ 85',
          titleId: 'Kualitas Prima: 1 Batch QC ≥ 85',
          descriptionEn: 'High QC batch.',
          descriptionId: 'Batch QC tinggi.',
          target: 1,
          current: 0,
          completed: false,
          claimed: false,
          rewardCash: 15_000,
          unitLabelEn: 'batch',
          unitLabelId: 'batch',
        },
      ],
    });

    renderElement(<DailyMissionsDashboard />);

    expect(container.textContent).toContain('Daily Missions');
    expect(container.textContent).toContain('2/3 Completed');
    expect(container.textContent).toContain('Sell 50 Shrimp Dumplings');
    expect(container.textContent).toContain('Pack 4 Fresh Boxes');
    expect(container.textContent).toContain('Chef Craft: 1 Batch QC ≥ 85');

    // Explicit completion status labels
    expect(container.textContent).toContain('Completed · Ready to Claim');
    expect(container.textContent).toContain('Completed · Bonus Claimed');
    expect(container.textContent).toContain('In Progress');

    // Clicking the claimable reward button claims the completed mission and credits the wallet
    clickButton(/Claim Reward \+Rp30\.000/);
    expect(useGameStore.getState().cashBalance).toBe(130_000);
    expect(useGameStore.getState().dailyMissions.find((m) => m.id === 'dash-dm-1')?.claimed).toBe(
      true,
    );
    expect(container.textContent).toContain('Bonus Added to Wallet');
    expect(container.textContent).not.toContain('Ready to Claim');
  });

  it('shows RotateToLandscapeOverlay on mobile portrait, hides automatically on landscape, and supports portrait continue', () => {
    const origW = window.innerWidth;
    const origH = window.innerHeight;

    const setWindowSize = (w: number, h: number) => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: h });
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
    };

    try {
      setWindowSize(390, 844);
      renderElement(<RotateToLandscapeOverlay />);
      expect(container.querySelector('[data-testid="rotate-to-landscape-overlay"]')).not.toBeNull();
      expect(container.textContent).toContain('Rotate to Landscape');

      // Rotating to mobile landscape automatically hides the overlay
      setWindowSize(844, 390);
      expect(container.querySelector('[data-testid="rotate-to-landscape-overlay"]')).toBeNull();

      // Rotating back to portrait brings it back until explicitly dismissed
      setWindowSize(360, 780);
      expect(container.querySelector('[data-testid="rotate-to-landscape-overlay"]')).not.toBeNull();

      clickButton('Continue in Portrait');
      expect(container.querySelector('[data-testid="rotate-to-landscape-overlay"]')).toBeNull();
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: origW });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: origH });
    }
  });
});
