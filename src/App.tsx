import { useEffect, useRef } from 'react';
import { BusinessSetupModal } from './components/BusinessSetupModal';
import { CashierModal } from './components/CashierModal';
import { CookingMiniGamesModal } from './components/CookingMiniGamesModal';
import { CustomerFeedbackPopups } from './components/CustomerFeedbackPopups';
import { FinanceDashboardModal } from './components/FinanceDashboardModal';
import { GameHud } from './components/GameHud';
import { InventoryModal } from './components/InventoryModal';
import { MarketModal } from './components/MarketModal';
import { PackagingModal } from './components/PackagingModal';
import { GameOverModal, PauseModal } from './components/PauseAndEndModals';
import { QualityControlModal } from './components/QualityControlModal';
import { RecipeBookModal } from './components/RecipeBookModal';
import { LandscapeLockButton } from './components/LandscapeLockButton';
import { RotateToLandscapeOverlay } from './components/RotateToLandscapeOverlay';
import { TitleScreen } from './components/TitleScreen';
import { DimsumWorldCanvas, type JoystickInputRef } from './game/DimsumWorldCanvas';
import { useGameStore } from './store/useGameStore';
import { useSmartphoneImmersive } from './utils/useViewportMode';

export default function App() {
  // Smartphones: first tap switches to fullscreen + landscape
  useSmartphoneImmersive();
  const initApp = useGameStore((s) => s.initApp);
  const gameState = useGameStore((s) => s.gameState);
  const activeStation = useGameStore((s) => s.activeStation);
  const activeCooking = useGameStore((s) => s.activeCooking);

  const joystickRef = useRef<JoystickInputRef>({ dx: 0, dy: 0 });

  useEffect(() => {
    initApp();
  }, [initApp]);

  const showWorldHud =
    gameState !== 'MAIN_MENU' && gameState !== 'BUSINESS_SETUP';

  return (
    <main className="relative w-screen h-screen overflow-hidden select-none bg-[#F2E5C9]">
      {/* Persistent 3D Isometric Restaurant Diorama */}
      <DimsumWorldCanvas joystickRef={joystickRef} />

      {/* Title & Business Setup Screens */}
      {gameState === 'MAIN_MENU' && <TitleScreen />}
      {gameState === 'BUSINESS_SETUP' && <BusinessSetupModal />}

      {/* Active Gameplay HUD */}
      {showWorldHud && <GameHud joystickRef={joystickRef} />}
      {showWorldHud && <CustomerFeedbackPopups />}

      {/* Active 4-Stage Cooking Mini-Games Pipeline */}
      {activeCooking && <CookingMiniGamesModal />}

      {/* Contextual Station Modals (when not inside cooking pipeline) */}
      {!activeCooking && activeStation === 'market' && <MarketModal />}
      {!activeCooking && activeStation === 'storage' && <InventoryModal />}
      {!activeCooking &&
        (activeStation === 'prep' ||
          activeStation === 'mixing' ||
          activeStation === 'wrapping') && <RecipeBookModal />}
      {!activeCooking && activeStation === 'steamer' && <QualityControlModal />}
      {!activeCooking && activeStation === 'packaging' && <PackagingModal />}
      {!activeCooking && activeStation === 'cashier' && <CashierModal />}
      {!activeCooking &&
        (activeStation === 'board' || gameState === 'FINANCIAL_REPORT') && (
          <FinanceDashboardModal />
        )}

      {/* System Modals */}
      {gameState === 'GAME_PAUSED' && <PauseModal />}
      {gameState === 'GAME_OVER' && <GameOverModal />}

      {/* Smartphone browser: one-tap fullscreen + landscape lock */}
      <LandscapeLockButton />

      {/* Mobile Portrait Rotate-to-Landscape Prompt */}
      <RotateToLandscapeOverlay />
    </main>
  );
}
