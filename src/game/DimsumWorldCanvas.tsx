import React, { useEffect, useRef, useState } from 'react';
import { LocateFixed, RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CUSTOMER_ARCHETYPES, getPackagingDef } from '../config/gameBalance';
import { STATION_META, t } from '../i18n/translations';
import { useGameStore } from '../store/useGameStore';
import type { KitchenHelperRole, StationId } from '../types/game';
import { useViewportMode } from '../utils/useViewportMode';
import {
  CAMERA_ORBIT_BOUNDS,
  CAMERA_ZOOM_BOUNDS,
  CUSTOMER_SLOTS,
  DINE_IN_SEAT_SLOTS,
  STAFF_STATION_SLOTS,
  STAFF_WELLNESS_SLOTS,
  STATION_PLACEMENTS,
  clampCameraOrbitYaw,
  clampCameraPitchOffset,
  clampCameraZoom,
  computeCameraOffset,
  findNearestInteractable,
  resolvePlayerCollision,
  worldToScreen,
} from './isoUtils';
import {
  type CharacterRig,
  type InteractiveDecoRef,
  createCustomerModel,
  createEntrepreneurModel,
  createKitchenHelperModel,
  createShopEnvironment,
  createShowcaseBoxesGroup,
  createStationModel,
  disposeObject3D,
} from './models';
import { computeCashierShowcaseLayout } from './showcaseHelpers';

export interface JoystickInputRef {
  dx: number;
  dy: number;
}

interface DimsumWorldCanvasProps {
  joystickRef: React.MutableRefObject<JoystickInputRef>;
}

interface SteamParticle {
  mesh: THREE.Mesh;
  age: number;
  maxAge: number;
  vx: number;
  vz: number;
}

interface FloatingTag {
  id: string;
  label: string;
  subLabel?: string;
  x: number;
  y: number;
  active: boolean;
}

interface CustomerThoughtBubble {
  id: string;
  customerName: string;
  recipeName: string;
  boxLabel: string;
  accentColor: string;
  patienceRatio: number;
  isEating: boolean;
  isDineIn: boolean;
  x: number;
  y: number;
}

const _camTarget = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _camOffset = new THREE.Vector3();
const _moveDir = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const DimsumWorldCanvas: React.FC<DimsumWorldCanvasProps> = ({ joystickRef }) => {
  const language = useGameStore((s) => s.language);
  const gameState = useGameStore((s) => s.gameState);
  const activeStation = useGameStore((s) => s.activeStation);
  const activeCooking = useGameStore((s) => s.activeCooking);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const { width: viewportWidth, isShortLandscape } = useViewportMode();
  const [contextLost, setContextLost] = useState(false);
  const [stationTag, setStationTag] = useState<FloatingTag | null>(null);
  const [customerBubbles, setCustomerBubbles] = useState<CustomerThoughtBubble[]>([]);
  const [cameraUi, setCameraUi] = useState({ zoom: 1, rotated: false });

  const cameraControlsRef = useRef<{
    targetZoom: number;
    targetYaw: number;
    targetPitch: number;
  }>({
    targetZoom: CAMERA_ZOOM_BOUNDS.default,
    targetYaw: 0,
    targetPitch: 0,
  });

  const upgrades = useGameStore((s) => s.upgrades);
  const activeFestival = useGameStore((s) => s.activeFestival);
  const productBatches = useGameStore((s) => s.productBatches);
  const recipes = useGameStore((s) => s.recipes);
  const currentDay = useGameStore((s) => s.currentDay);

  // Refs synced inside animation loop without recreating WebGL renderer
  const sceneObjectsRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    renderer: THREE.WebGLRenderer;
    envGroup: THREE.Group | null;
    interactiveDecos: InteractiveDecoRef[];
    showcaseGroup: THREE.Group | null;
    showcaseBoxCount: number;
    totalBoxesReady: number;
    envMeta: {
      lanternCount: number;
      plantCount: number;
      hasMenuBoard: boolean;
      hasDiningRug: boolean;
      hasFestivalBanner: boolean;
    };
    stationGroups: Map<StationId, { group: THREE.Group; ringMesh: THREE.Mesh }>;
    steamOrigin: THREE.Vector3;
    anisotropy: number;
  } | null>(null);

  const rebuildCashierShowcase = () => {
    const ctx = sceneObjectsRef.current;
    if (!ctx) return;
    const cashierEntry = ctx.stationGroups.get('cashier');
    if (!cashierEntry) return;

    if (ctx.showcaseGroup) {
      cashierEntry.group.remove(ctx.showcaseGroup);
      disposeObject3D(ctx.showcaseGroup);
      ctx.showcaseGroup = null;
    }

    const state = useGameStore.getState();
    const layout = computeCashierShowcaseLayout(
      state.productBatches,
      state.recipes,
      state.currentDay,
    );
    const showcase = createShowcaseBoxesGroup(layout);
    cashierEntry.group.add(showcase);
    ctx.showcaseGroup = showcase;
    ctx.showcaseBoxCount = layout.visibleBoxesCount;
    ctx.totalBoxesReady = layout.totalBoxesReady;
  };

  // Rebuild environment & stations when facility upgrades or weekly festival change
  useEffect(() => {
    const ctx = sceneObjectsRef.current;
    if (!ctx) return;

    if (ctx.showcaseGroup) {
      const prevCashier = ctx.stationGroups.get('cashier');
      prevCashier?.group.remove(ctx.showcaseGroup);
      disposeObject3D(ctx.showcaseGroup);
      ctx.showcaseGroup = null;
    }
    if (ctx.envGroup) {
      ctx.scene.remove(ctx.envGroup);
      disposeObject3D(ctx.envGroup);
    }
    for (const entry of ctx.stationGroups.values()) {
      ctx.scene.remove(entry.group);
      disposeObject3D(entry.group);
    }
    ctx.stationGroups.clear();

    const envRes = createShopEnvironment(upgrades, ctx.anisotropy, activeFestival);
    ctx.scene.add(envRes.group);
    ctx.envGroup = envRes.group;
    ctx.interactiveDecos = envRes.interactiveDecos;
    ctx.envMeta = {
      lanternCount: envRes.lanternCount,
      plantCount: envRes.plantCount,
      hasMenuBoard: envRes.hasMenuBoard,
      hasDiningRug: envRes.hasDiningRug,
      hasFestivalBanner: envRes.hasFestivalBanner,
    };

    for (const placement of STATION_PLACEMENTS) {
      const built = createStationModel(placement.id, upgrades, ctx.anisotropy);
      built.group.position.set(placement.x, 0, placement.z);
      built.group.rotation.y = placement.facingRotationY;
      built.group.userData.stationId = placement.id;
      built.group.traverse((child) => {
        child.userData.stationId = placement.id;
      });
      ctx.scene.add(built.group);
      ctx.stationGroups.set(placement.id, {
        group: built.group,
        ringMesh: built.ringMesh,
      });

      if (placement.id === 'steamer' && built.steamOrigin) {
        ctx.steamOrigin.set(
          placement.x + built.steamOrigin.x,
          built.steamOrigin.y,
          placement.z + built.steamOrigin.z,
        );
      }
    }

    rebuildCashierShowcase();
  }, [upgrades, activeFestival]);

  // Update 3D Cashier display showcase stacks live when packaged stock changes
  useEffect(() => {
    rebuildCashierShowcase();
  }, [productBatches, recipes, currentDay]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setContextLost(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    const horizonHex = 0xf2e5c9;
    scene.background = new THREE.Color(horizonHex);
    scene.fog = new THREE.FogExp2(horizonHex, 0.016);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // True Isometric Orthographic Camera
    const frustum = 10.6;
    const aspect = Math.max(0.5, container.clientWidth / Math.max(1, container.clientHeight));
    const camera = new THREE.OrthographicCamera(
      (-frustum * aspect) / 2,
      (frustum * aspect) / 2,
      frustum / 2,
      -frustum / 2,
      0.1,
      100,
    );
    camera.position.set(14, 13.5, 14);
    camera.lookAt(0, 0.5, 0);

    // Three-point warm/cool studio lighting
    const hemi = new THREE.HemisphereLight(0xdff0ff, 0xc7a372, 0.72);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 1.55);
    keyLight.position.set(10, 16, 8);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 45;
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xffe0b2, 0.45);
    rimLight.position.set(-9, 8, -10);
    scene.add(rimLight);

    const anisotropy = renderer.capabilities.getMaxAnisotropy();
    const initialState = useGameStore.getState();
    const initialUpgrades = initialState.upgrades;
    const envRes = createShopEnvironment(
      initialUpgrades,
      anisotropy,
      initialState.activeFestival ?? null,
    );
    scene.add(envRes.group);

    const stationGroups = new Map<
      StationId,
      { group: THREE.Group; ringMesh: THREE.Mesh }
    >();
    const steamOrigin = new THREE.Vector3(1.4, 1.5, -4.0);

    for (const placement of STATION_PLACEMENTS) {
      const built = createStationModel(placement.id, initialUpgrades, anisotropy);
      built.group.position.set(placement.x, 0, placement.z);
      built.group.rotation.y = placement.facingRotationY;
      built.group.userData.stationId = placement.id;
      built.group.traverse((child) => {
        child.userData.stationId = placement.id;
      });
      scene.add(built.group);
      stationGroups.set(placement.id, {
        group: built.group,
        ringMesh: built.ringMesh,
      });

      if (placement.id === 'steamer' && built.steamOrigin) {
        steamOrigin.set(
          placement.x + built.steamOrigin.x,
          built.steamOrigin.y,
          placement.z + built.steamOrigin.z,
        );
      }
    }

    const initialLayout = computeCashierShowcaseLayout(
      initialState.productBatches,
      initialState.recipes,
      initialState.currentDay,
    );
    const initialShowcase = createShowcaseBoxesGroup(initialLayout);
    stationGroups.get('cashier')?.group.add(initialShowcase);

    sceneObjectsRef.current = {
      scene,
      camera,
      renderer,
      envGroup: envRes.group,
      interactiveDecos: envRes.interactiveDecos,
      showcaseGroup: initialShowcase,
      showcaseBoxCount: initialLayout.visibleBoxesCount,
      totalBoxesReady: initialLayout.totalBoxesReady,
      envMeta: {
        lanternCount: envRes.lanternCount,
        plantCount: envRes.plantCount,
        hasMenuBoard: envRes.hasMenuBoard,
        hasDiningRug: envRes.hasDiningRug,
        hasFestivalBanner: envRes.hasFestivalBanner,
      },
      stationGroups,
      steamOrigin,
      anisotropy,
    };

    // Read-only browser QA projection & scene verification bridge (zero UI impact)
    const qaApi = {
      projectStation: (stationId: StationId) => {
        const placement = STATION_PLACEMENTS.find((p) => p.id === stationId);
        if (!placement) return null;
        camera.updateMatrixWorld();
        const rect = renderer.domElement.getBoundingClientRect();
        const pt = worldToScreen(
          { x: placement.x, y: 0.72, z: placement.z },
          camera,
          rect.width,
          rect.height,
        );
        return {
          x: rect.left + pt.x,
          y: rect.top + pt.y,
          inBounds: pt.x >= 0 && pt.x <= rect.width && pt.y >= 0 && pt.y <= rect.height,
        };
      },
      getSceneStats: () => {
        const ctx = sceneObjectsRef.current;
        return {
          webglActive: !renderer.getContext().isContextLost(),
          stationCount: ctx?.stationGroups.size ?? 0,
          showcaseBoxCount: ctx?.showcaseBoxCount ?? 0,
          totalBoxesReady: ctx?.totalBoxesReady ?? 0,
          lanternCount: ctx?.envMeta.lanternCount ?? 0,
          plantCount: ctx?.envMeta.plantCount ?? 0,
          hasMenuBoard: ctx?.envMeta.hasMenuBoard ?? false,
          hasDiningRug: ctx?.envMeta.hasDiningRug ?? false,
          hasFestivalBanner: ctx?.envMeta.hasFestivalBanner ?? false,
        };
      },
    };
    (window as unknown as { __DIMSUM_QA__?: typeof qaApi }).__DIMSUM_QA__ = qaApi;

    // Player Entrepreneur Model
    const playerRig = createEntrepreneurModel();
    const startPos = useGameStore.getState().playerPosition;
    playerRig.root.position.set(startPos.x, 0, startPos.z);
    scene.add(playerRig.root);

    // Pooled Steam Particles over Bamboo Steamer
    const steamGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const steamParticles: SteamParticle[] = [];
    for (let i = 0; i < 12; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(steamGeo, mat);
      mesh.position.copy(steamOrigin);
      scene.add(mesh);
      steamParticles.push({
        mesh,
        age: (i / 12) * 2.4,
        maxAge: 2.4,
        vx: (Math.random() - 0.5) * 0.14,
        vz: (Math.random() - 0.5) * 0.14,
      });
    }

    // Dynamic Customer & Kitchen Staff Rigs Maps
    const customerRigs = new Map<string, CharacterRig>();
    const staffRigs = new Map<KitchenHelperRole, CharacterRig>();

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Input Tracking (held keys + blur cleanup + raycasting)
    const heldKeys: Record<string, boolean> = {};
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let hoveredStationId: StationId | null = null;

    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts while typing in text inputs
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      heldKeys[e.code] = true;
      const store = useGameStore.getState();

      if (e.code === 'Escape') {
        if (store.activeStation) {
          store.closeStation();
        } else {
          store.togglePause();
        }
        return;
      }

      if (
        (e.code === 'KeyE' || e.code === 'Space') &&
        !store.activeStation &&
        store.gameState !== 'MAIN_MENU' &&
        store.gameState !== 'BUSINESS_SETUP' &&
        store.gameState !== 'GAME_PAUSED' &&
        store.gameState !== 'GAME_OVER'
      ) {
        if (store.nearestStation) {
          e.preventDefault();
          store.openStation(store.nearestStation);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldKeys[e.code] = false;
    };

    const onBlur = () => {
      for (const k of Object.keys(heldKeys)) {
        heldKeys[k] = false;
      }
    };

    let lastHoverCheck = 0;
    let isOrbitDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragDistance = 0;
    let suppressNextClick = false;

    const canInteractViewport = () => {
      const st = useGameStore.getState();
      return (
        st.gameState !== 'MAIN_MENU' &&
        st.gameState !== 'BUSINESS_SETUP' &&
        st.gameState !== 'GAME_PAUSED' &&
        st.gameState !== 'GAME_OVER' &&
        !st.activeStation &&
        !st.activeCooking
      );
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const onWheel = (e: WheelEvent) => {
      if (!canInteractViewport()) return;
      e.preventDefault();
      const ctrl = cameraControlsRef.current;
      ctrl.targetZoom = clampCameraZoom(ctrl.targetZoom - e.deltaY * 0.0011);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!canInteractViewport()) return;
      // Right-click, middle-click, or Shift+Left-click orbits camera
      if (e.button === 2 || e.button === 1 || (e.button === 0 && e.shiftKey)) {
        isOrbitDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragDistance = 0;
        renderer.domElement.style.cursor = 'grabbing';
      }
    };

    const onPointerUp = () => {
      if (isOrbitDragging) {
        if (dragDistance > 4) {
          suppressNextClick = true;
        }
        isOrbitDragging = false;
        renderer.domElement.style.cursor = hoveredStationId ? 'pointer' : 'default';
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (isOrbitDragging) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragDistance += Math.hypot(dx, dy);

        const ctrl = cameraControlsRef.current;
        ctrl.targetYaw = clampCameraOrbitYaw(ctrl.targetYaw - dx * 0.0055);
        ctrl.targetPitch = clampCameraPitchOffset(ctrl.targetPitch + dy * 0.0025);
        return;
      }

      const now = performance.now();
      if (now - lastHoverCheck < 50) return;
      lastHoverCheck = now;

      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);

      const targets = Array.from(stationGroups.values()).map((v) => v.group);
      const hits = raycaster.intersectObjects(targets, true);
      if (hits.length > 0) {
        hoveredStationId = (hits[0].object.userData.stationId as StationId) ?? null;
        renderer.domElement.style.cursor = 'pointer';
      } else {
        hoveredStationId = null;
        const decoTargets = (sceneObjectsRef.current?.interactiveDecos ?? []).map((d) => d.group);
        const decoHits =
          decoTargets.length > 0 ? raycaster.intersectObjects(decoTargets, true) : [];
        renderer.domElement.style.cursor = decoHits.length > 0 ? 'pointer' : 'default';
      }
    };

    const onPointerClick = (e: MouseEvent) => {
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      const store = useGameStore.getState();
      if (
        store.gameState === 'MAIN_MENU' ||
        store.gameState === 'BUSINESS_SETUP' ||
        store.gameState === 'GAME_PAUSED' ||
        store.gameState === 'GAME_OVER' ||
        store.activeStation
      ) {
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);

      const targets = Array.from(stationGroups.values()).map((v) => v.group);
      const hits = raycaster.intersectObjects(targets, true);
      if (hits.length > 0) {
        const sid = hits[0].object.userData.stationId as StationId | undefined;
        if (sid) {
          store.openStation(sid);
          return;
        }
      }

      const decos = sceneObjectsRef.current?.interactiveDecos ?? [];
      if (decos.length > 0) {
        const decoHits = raycaster.intersectObjects(
          decos.map((d) => d.group),
          true,
        );
        if (decoHits.length > 0) {
          const hitDecoId = decoHits[0].object.userData.decoId as string | undefined;
          const decoRef = decos.find((d) => d.id === hitDecoId);
          if (decoRef) {
            decoRef.impulse = 1.0;
          }
        }
      }
    };

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      const asp = w / h;
      camera.left = (-frustum * asp) / 2;
      camera.right = (frustum * asp) / 2;
      camera.top = frustum / 2;
      camera.bottom = -frustum / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onResize);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => onResize())
        : null;
    resizeObserver?.observe(container);
    window.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('click', onPointerClick);

    // Simulation Loop
    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let walkPhase = 0;
    let staffPhase = 0;
    let tagCheckAccum = 0;
    let storeTickAccum = 0;
    let playerFacingY = 0;
    let currentZoom = CAMERA_ZOOM_BOUNDS.default;
    let currentYaw = 0;
    let currentPitch = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      const store = useGameStore.getState();
      const isTitleBackdrop =
        store.gameState === 'MAIN_MENU' || store.gameState === 'BUSINESS_SETUP';
      const canWalk =
        !isTitleBackdrop &&
        store.gameState !== 'GAME_PAUSED' &&
        store.gameState !== 'GAME_OVER' &&
        !store.activeStation;

      // 1. Player Movement & Collision
      let isMoving = false;
      if (canWalk) {
        let screenRight = 0;
        let screenUp = 0;
        if (heldKeys['KeyW'] || heldKeys['ArrowUp']) screenUp += 1;
        if (heldKeys['KeyS'] || heldKeys['ArrowDown']) screenUp -= 1;
        if (heldKeys['KeyD'] || heldKeys['ArrowRight']) screenRight += 1;
        if (heldKeys['KeyA'] || heldKeys['ArrowLeft']) screenRight -= 1;

        if (Math.abs(joystickRef.current.dx) > 0.08 || Math.abs(joystickRef.current.dy) > 0.08) {
          screenRight += joystickRef.current.dx;
          screenUp -= joystickRef.current.dy;
        }

        if (screenRight !== 0 || screenUp !== 0) {
          // Align movement direction with active camera orbit yaw on XZ plane
          const activeYaw = CAMERA_ORBIT_BOUNDS.baseYaw + currentYaw;
          const sinY = Math.sin(activeYaw);
          const cosY = Math.cos(activeYaw);
          const worldDx = screenRight * sinY - screenUp * cosY;
          const worldDz = -screenRight * cosY - screenUp * sinY;
          _moveDir.set(worldDx, 0, worldDz).normalize();

          const speed = 4.2;
          const nextX = playerRig.root.position.x + _moveDir.x * speed * dt;
          const nextZ = playerRig.root.position.z + _moveDir.z * speed * dt;
          const resolved = resolvePlayerCollision(
            nextX,
            nextZ,
            0.38,
            store.upgrades.dining_seating ?? 1,
          );

          playerRig.root.position.x = resolved.x;
          playerRig.root.position.z = resolved.z;
          store.setPlayerPosition(resolved.x, resolved.z);

          playerFacingY = Math.atan2(_moveDir.x, _moveDir.z);
          isMoving = true;
        }
      }

      // Smooth character facing & animation (Walk / Carry / Celebrate / Idle)
      const angleDiff =
        Math.atan2(
          Math.sin(playerFacingY - playerRig.root.rotation.y),
          Math.cos(playerFacingY - playerRig.root.rotation.y),
        );
      playerRig.root.rotation.y += angleDiff * (1 - Math.exp(-12 * dt));

      const celebrating = Date.now() < store.celebratingUntil;
      if (playerRig.carriedTray) {
        playerRig.carriedTray.visible = store.isCarryingProduct;
      }

      if (celebrating) {
        walkPhase += dt * 10;
        playerRig.root.position.y = Math.abs(Math.sin(walkPhase)) * 0.22;
        playerRig.leftArm.rotation.x = -2.4;
        playerRig.rightArm.rotation.x = -2.4;
        playerRig.leftLeg.rotation.x = 0;
        playerRig.rightLeg.rotation.x = 0;
      } else if (isMoving) {
        walkPhase += dt * 11;
        playerRig.root.position.y = Math.abs(Math.sin(walkPhase * 2)) * 0.05;
        const swing = Math.sin(walkPhase) * 0.65;
        playerRig.leftLeg.rotation.x = swing;
        playerRig.rightLeg.rotation.x = -swing;
        if (store.isCarryingProduct) {
          playerRig.leftArm.rotation.x = -0.85;
          playerRig.rightArm.rotation.x = -0.85;
        } else {
          playerRig.leftArm.rotation.x = -swing * 0.7;
          playerRig.rightArm.rotation.x = swing * 0.7;
        }
      } else {
        playerRig.root.position.y = 0;
        playerRig.leftLeg.rotation.x *= 0.8;
        playerRig.rightLeg.rotation.x *= 0.8;
        if (store.isCarryingProduct) {
          playerRig.leftArm.rotation.x = -0.85;
          playerRig.rightArm.rotation.x = -0.85;
        } else {
          playerRig.leftArm.rotation.x *= 0.8;
          playerRig.rightArm.rotation.x *= 0.8;
        }
      }

      // 2. Proximity Station Detection & Highlight Rings
      const nearest = findNearestInteractable({
        x: playerRig.root.position.x,
        z: playerRig.root.position.z,
      });
      const nearestId = nearest?.id ?? null;
      if (store.nearestStation !== nearestId) {
        store.setNearestStation(nearestId);
      }

      const activeHighlightId = hoveredStationId ?? nearestId;
      for (const [sid, entry] of stationGroups.entries()) {
        const ringMat = entry.ringMesh.material as THREE.MeshBasicMaterial;
        const targetOpacity = sid === activeHighlightId ? 0.85 : 0;
        ringMat.opacity += (targetOpacity - ringMat.opacity) * (1 - Math.exp(-10 * dt));
        entry.ringMesh.rotation.z += dt * 0.9;
      }

      // 3. Steam Particles Animation
      const steamActive =
        Boolean(store.activeCooking) ||
        Boolean(store.activeDelegation) ||
        store.gameState === 'STORE_OPEN' ||
        isTitleBackdrop;
      for (const p of steamParticles) {
        p.age += dt;
        if (p.age >= p.maxAge) {
          p.age = 0;
          p.mesh.position.copy(steamOrigin);
        }
        const progress = p.age / p.maxAge;
        p.mesh.position.y = steamOrigin.y + progress * 1.4;
        p.mesh.position.x = steamOrigin.x + p.vx * p.age;
        p.mesh.position.z = steamOrigin.z + p.vz * p.age;
        const scale = 0.7 + progress * 1.5;
        p.mesh.scale.setScalar(scale);
        const mat = p.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = steamActive ? Math.sin(progress * Math.PI) * 0.34 : 0;
      }

      // 3b. Interactive Decoration Ambience & Click Spring Animation
      const activeDecos = sceneObjectsRef.current?.interactiveDecos;
      if (activeDecos && activeDecos.length > 0) {
        const elapsedSec = now * 0.001;
        const decay = Math.exp(-3.4 * dt);
        for (const deco of activeDecos) {
          deco.impulse *= decay;
          if (deco.impulse < 0.002) deco.impulse = 0;

          if (deco.kind === 'lantern') {
            const sway = Math.sin(elapsedSec * 1.45 + deco.phase) * 0.035;
            const pulseSwing = Math.sin(elapsedSec * 11 + deco.phase) * deco.impulse * 0.22;
            deco.group.rotation.z = deco.baseRotationZ + sway + pulseSwing;
          } else if (deco.kind === 'plant') {
            const rustle = Math.sin(elapsedSec * 14 + deco.phase) * deco.impulse * 0.14;
            deco.group.rotation.z = deco.baseRotationZ + rustle;
            const s = deco.baseScale * (1 + deco.impulse * 0.08);
            deco.group.scale.setScalar(s);
          } else {
            const pop = deco.baseScale * (1 + deco.impulse * 0.045);
            deco.group.scale.setScalar(pop);
          }
        }
      }

      // 4. Customer Simulation Tick & 3D Sync
      storeTickAccum += dt;
      if (
        (store.gameState === 'STORE_OPEN' || store.gameState === 'CUSTOMER_SERVICE') &&
        storeTickAccum >= 0.25
      ) {
        store.tickStoreSimulation(storeTickAccum);
        storeTickAccum = 0;
      }

      const activeCustomerIds = new Set(store.customers.map((c) => c.id));
      for (const [cid, rig] of customerRigs.entries()) {
        if (!activeCustomerIds.has(cid)) {
          scene.remove(rig.root);
          customerRigs.delete(cid);
        }
      }

      for (const cust of store.customers) {
        let rig = customerRigs.get(cust.id);
        if (!rig) {
          const arch = CUSTOMER_ARCHETYPES.find((a) => a.id === cust.archetypeId);
          rig = createCustomerModel(arch?.shirtColor ?? '#4F86C6');
          rig.root.position.set(1.2, 0, 5.2);
          scene.add(rig.root);
          customerRigs.set(cust.id, rig);
        }
        const damp = 1 - Math.exp(-3.5 * dt);

        if (cust.lifecycle === 'EATING') {
          const seat =
            DINE_IN_SEAT_SLOTS[(cust.tableSlot ?? 0) % DINE_IN_SEAT_SLOTS.length];
          rig.root.position.x += (seat.x - rig.root.position.x) * damp;
          rig.root.position.z += (seat.z - rig.root.position.z) * damp;
          rig.root.position.y += (-0.08 - rig.root.position.y) * damp;
          const rotDiff = Math.atan2(
            Math.sin(seat.facingRotationY - rig.root.rotation.y),
            Math.cos(seat.facingRotationY - rig.root.rotation.y),
          );
          rig.root.rotation.y += rotDiff * (1 - Math.exp(-6 * dt));
          rig.rightArm.rotation.x = -0.58 + Math.sin(staffPhase * 4.5 + (cust.tableSlot ?? 0)) * 0.22;
          rig.leftArm.rotation.x = -0.35;

          if (rig.patienceBarFill) {
            const eatRatio = Math.max(
              0.08,
              (cust.eatingRemainingSec ?? 0) / Math.max(1, cust.eatingMaxSec ?? 10),
            );
            rig.patienceBarFill.scale.x = eatRatio;
            const barMat = rig.patienceBarFill.material as THREE.MeshBasicMaterial;
            barMat.color.set('#2E7D32');
          }
        } else {
          const slot = CUSTOMER_SLOTS[cust.seatSlot % CUSTOMER_SLOTS.length];
          rig.root.position.x += (slot.x - rig.root.position.x) * damp;
          rig.root.position.z += (slot.z - rig.root.position.z) * damp;
          rig.root.position.y += (0 - rig.root.position.y) * damp;
          rig.root.rotation.y = Math.PI; // face cashier
          rig.rightArm.rotation.x *= 0.85;
          rig.leftArm.rotation.x *= 0.85;

          if (rig.patienceBarFill) {
            const ratio = Math.max(0.05, cust.patienceRemaining / Math.max(1, cust.patienceMax));
            rig.patienceBarFill.scale.x = ratio;
            const barMat = rig.patienceBarFill.material as THREE.MeshBasicMaterial;
            if (ratio > 0.5) barMat.color.set('#6E9B72');
            else if (ratio > 0.25) barMat.color.set('#ED9B53');
            else barMat.color.set('#DC2626');
          }
        }
      }

      // 4b. Hired 3D Kitchen Staff NPCs (Work Stations vs Wellness Rest Area)
      staffPhase += dt;
      const activeHelperIds = new Set(store.kitchenStaff.map((h) => h.id));
      for (const [role, rig] of staffRigs.entries()) {
        if (!activeHelperIds.has(role)) {
          scene.remove(rig.root);
          staffRigs.delete(role);
        }
      }

      const crewBoosted =
        Boolean(store.activeDelegation) || Boolean(store.activeCooking);
      for (const helper of store.kitchenStaff) {
        let rig = staffRigs.get(helper.id);
        const isWellness = helper.shift === 'wellness';
        const targetSlot = isWellness
          ? STAFF_WELLNESS_SLOTS[helper.id]
          : STAFF_STATION_SLOTS[helper.id];

        if (!rig) {
          rig = createKitchenHelperModel(helper.id);
          rig.root.position.set(targetSlot.x, 0, targetSlot.z);
          rig.root.rotation.y = targetSlot.facingRotationY;
          scene.add(rig.root);
          staffRigs.set(helper.id, rig);
        }

        const posDamp = 1 - Math.exp(-3.5 * dt);
        rig.root.position.x += (targetSlot.x - rig.root.position.x) * posDamp;
        rig.root.position.z += (targetSlot.z - rig.root.position.z) * posDamp;

        const rotDiff = Math.atan2(
          Math.sin(targetSlot.facingRotationY - rig.root.rotation.y),
          Math.cos(targetSlot.facingRotationY - rig.root.rotation.y),
        );
        rig.root.rotation.y += rotDiff * (1 - Math.exp(-6 * dt));

        const phaseOffset =
          helper.id === 'prep'
            ? 0
            : helper.id === 'mix'
              ? 1.2
              : helper.id === 'wrap'
                ? 2.4
                : 3.6;

        if (isWellness) {
          rig.root.position.y = Math.sin(staffPhase * 1.8 + phaseOffset) * 0.015 + 0.015;
          rig.leftArm.rotation.x = Math.sin(staffPhase * 1.2 + phaseOffset) * 0.08;
          rig.rightArm.rotation.x = -Math.sin(staffPhase * 1.2 + phaseOffset) * 0.08;
        } else {
          const cadence = crewBoosted ? 9.5 : 5.2;
          const workWave = Math.sin(staffPhase * cadence + phaseOffset);
          rig.root.position.y = Math.abs(workWave) * (crewBoosted ? 0.045 : 0.025);
          rig.rightArm.rotation.x = -0.65 + workWave * (crewBoosted ? 0.55 : 0.32);
          rig.leftArm.rotation.x = -0.55 - workWave * (crewBoosted ? 0.35 : 0.2);
        }
      }

      // 5. Damped Camera Follow + Orbit & Zoom (or gentle pan on Title Screen)
      const camEase = 1 - Math.exp(-8 * dt);
      const ctrl = cameraControlsRef.current;
      if (isTitleBackdrop) {
        const tSec = now * 0.00025;
        _camTarget.set(Math.sin(tSec) * 1.4, 0.4, Math.cos(tSec) * 0.9 - 0.8);
        currentZoom += (1.0 - currentZoom) * camEase;
        currentYaw += (0 - currentYaw) * camEase;
        currentPitch += (0 - currentPitch) * camEase;
      } else {
        _camTarget.set(
          playerRig.root.position.x * 0.65,
          0.4,
          playerRig.root.position.z * 0.65,
        );
        currentZoom += (ctrl.targetZoom - currentZoom) * camEase;
        currentYaw += (ctrl.targetYaw - currentYaw) * camEase;
        currentPitch += (ctrl.targetPitch - currentPitch) * camEase;
      }

      if (Math.abs(camera.zoom - currentZoom) > 0.0005) {
        camera.zoom = currentZoom;
        camera.updateProjectionMatrix();
      }

      computeCameraOffset(currentYaw, currentPitch, _camOffset);
      _desiredCamPos.copy(_camTarget).add(_camOffset);
      const camDamp = 1 - Math.exp(-5 * dt);
      camera.position.lerp(_desiredCamPos, camDamp);
      camera.lookAt(_camTarget);

      // 6. Floating Station Tags & 3D Customer Thought Bubbles (throttled ~15Hz)
      tagCheckAccum += dt;
      if (tagCheckAccum >= 0.07) {
        tagCheckAccum = 0;
        const viewW = renderer.domElement.clientWidth;
        const viewH = renderer.domElement.clientHeight;
        const overlayAllowed =
          !isTitleBackdrop &&
          !store.activeStation &&
          !store.activeCooking &&
          store.gameState !== 'GAME_PAUSED' &&
          store.gameState !== 'GAME_OVER';

        const focusId = hoveredStationId ?? nearestId;
        if (focusId && overlayAllowed) {
          const placement = STATION_PLACEMENTS.find((p) => p.id === focusId);
          if (placement) {
            const pt = worldToScreen(
              { x: placement.x, y: 2.15, z: placement.z },
              camera,
              viewW,
              viewH,
            );
            const meta = STATION_META[focusId];
            setStationTag({
              id: focusId,
              label: store.language === 'id' ? meta.nameId : meta.nameEn,
              subLabel: store.language === 'id' ? meta.actionId : meta.actionEn,
              x: pt.x,
              y: pt.y,
              active: focusId === nearestId,
            });
          }
        } else {
          setStationTag((prev) => (prev ? null : prev));
        }

        // Customer order thought bubbles above waiting 3D customers
        if (overlayAllowed && store.customers.length > 0 && viewW > 0 && viewH > 0) {
          const nextBubbles: CustomerThoughtBubble[] = [];
          for (const cust of store.customers) {
            const rig = customerRigs.get(cust.id);
            if (!rig) continue;
            const pt = worldToScreen(
              { x: rig.root.position.x, y: 1.92, z: rig.root.position.z },
              camera,
              viewW,
              viewH,
            );
            const recipe = store.recipes.find((r) => r.id === cust.requestedRecipeId);
            const pkgDef = getPackagingDef(cust.requestedBoxType);
            const isEating = cust.lifecycle === 'EATING';
            const patienceRatio = isEating
              ? Math.max(
                  0,
                  Math.min(
                    1,
                    (cust.eatingRemainingSec ?? 0) / Math.max(1, cust.eatingMaxSec ?? 10),
                  ),
                )
              : Math.max(
                  0,
                  Math.min(1, cust.patienceRemaining / Math.max(1, cust.patienceMax)),
                );
            nextBubbles.push({
              id: cust.id,
              customerName: cust.name,
              recipeName:
                store.language === 'id'
                  ? recipe?.nameId ?? 'Dimsum Sehat'
                  : recipe?.nameEn ?? 'Healthy Dimsum',
              boxLabel: isEating
                ? store.language === 'id'
                  ? 'Dine-In'
                  : 'Dining'
                : `${cust.quantityBoxes}× ${pkgDef.capacity}pcs`,
              accentColor: recipe?.accentColor ?? '#6E9B72',
              patienceRatio,
              isEating,
              isDineIn: cust.diningMode === 'DINE_IN',
              x: Math.max(76, Math.min(viewW - 76, pt.x)),
              y: Math.max(54, Math.min(viewH - 36, pt.y)),
            });
          }
          setCustomerBubbles(nextBubbles);
        } else {
          setCustomerBubbles((prev) => (prev.length === 0 ? prev : []));
        }

        const roundedZoom = Math.round(ctrl.targetZoom * 100) / 100;
        const isRotated =
          Math.abs(ctrl.targetYaw) > 0.02 ||
          Math.abs(ctrl.targetPitch) > 0.02 ||
          Math.abs(roundedZoom - 1) > 0.02;
        setCameraUi((prev) =>
          prev.zoom === roundedZoom && prev.rotated === isRotated
            ? prev
            : { zoom: roundedZoom, rotated: isRotated },
        );
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (isSoftwareGl) {
      renderer.render(scene, camera);
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      delete (window as unknown as { __DIMSUM_QA__?: unknown }).__DIMSUM_QA__;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);
      resizeObserver?.disconnect();
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('click', onPointerClick);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      disposeObject3D(scene);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [joystickRef]);

  const showCameraBar =
    !contextLost &&
    gameState !== 'MAIN_MENU' &&
    gameState !== 'BUSINESS_SETUP' &&
    gameState !== 'GAME_PAUSED' &&
    gameState !== 'GAME_OVER' &&
    !activeStation &&
    !activeCooking;

  const adjustZoom = (delta: number) => {
    const ctrl = cameraControlsRef.current;
    ctrl.targetZoom = clampCameraZoom(ctrl.targetZoom + delta);
    setCameraUi({
      zoom: Math.round(ctrl.targetZoom * 100) / 100,
      rotated:
        Math.abs(ctrl.targetYaw) > 0.02 ||
        Math.abs(ctrl.targetPitch) > 0.02 ||
        Math.abs(ctrl.targetZoom - 1) > 0.02,
    });
  };

  const adjustOrbitYaw = (delta: number) => {
    const ctrl = cameraControlsRef.current;
    ctrl.targetYaw = clampCameraOrbitYaw(ctrl.targetYaw + delta);
    setCameraUi((prev) => ({
      zoom: prev.zoom,
      rotated:
        Math.abs(ctrl.targetYaw) > 0.02 ||
        Math.abs(ctrl.targetPitch) > 0.02 ||
        Math.abs(ctrl.targetZoom - 1) > 0.02,
    }));
  };

  const resetCameraView = () => {
    const ctrl = cameraControlsRef.current;
    ctrl.targetZoom = CAMERA_ZOOM_BOUNDS.default;
    ctrl.targetYaw = 0;
    ctrl.targetPitch = 0;
    setCameraUi({ zoom: 1, rotated: false });
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#F2E5C9]">
      {/* Isolated WebGL mount container */}
      <div ref={mountRef} data-testid="dimsum-world-canvas" className="w-full h-full" />

      {/* 3D-Projected Customer Order Thought Bubbles (solid cream, zero backdrop-filter) */}
      {!contextLost &&
        customerBubbles.map((bubble) => {
          const isUrgent = !bubble.isEating && bubble.patienceRatio <= 0.3;
          const isWarn =
            !bubble.isEating && bubble.patienceRatio > 0.3 && bubble.patienceRatio <= 0.55;
          return (
            <div
              key={bubble.id}
              className={`pointer-events-none absolute -translate-x-1/2 -translate-y-full z-10 px-2.5 py-1.5 rounded-xl bg-[#FFFBF2] shadow-md border text-left max-w-[168px] ${
                bubble.isEating
                  ? 'border-[#2E7D32]/40'
                  : isUrgent
                    ? 'border-[#DC2626]'
                    : isWarn
                      ? 'border-[#ED9B53]'
                      : 'border-[#244D3B]/25'
              }`}
              style={{ left: bubble.x, top: bubble.y }}
            >
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#244D3B] leading-tight">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: bubble.accentColor }}
                />
                <span className="truncate">{bubble.recipeName}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] font-mono tabular-nums text-[#587567]">
                <span className="truncate">{bubble.customerName}</span>
                <span className="font-semibold text-[#244D3B] shrink-0">
                  {bubble.isDineIn && !bubble.isEating ? `🍽 ${bubble.boxLabel}` : bubble.boxLabel}
                </span>
              </div>
              <div className="mt-1 h-1 w-full rounded-sm bg-[#E9DEC8] overflow-hidden">
                <div
                  className={`h-full ${
                    bubble.isEating
                      ? 'bg-[#2E7D32]'
                      : isUrgent
                        ? 'bg-[#DC2626]'
                        : isWarn
                          ? 'bg-[#ED9B53]'
                          : 'bg-[#6E9B72]'
                  }`}
                  style={{ width: `${Math.round(bubble.patienceRatio * 100)}%` }}
                />
              </div>
            </div>
          );
        })}

      {/* Floating 3D-projected station label (solid cream, zero backdrop-filter over WebGL) */}
      {stationTag && !contextLost && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full z-10 px-3 py-1.5 rounded-lg bg-[#FAF5EA] border border-[#244D3B]/25 shadow-md text-center whitespace-nowrap"
          style={{ left: stationTag.x, top: stationTag.y }}
        >
          <div className="text-xs font-semibold text-[#244D3B]">{stationTag.label}</div>
          {stationTag.subLabel && (
            <div className="text-[11px] text-[#6E9B72] font-medium">
              {stationTag.subLabel}
            </div>
          )}
        </div>
      )}

      {/* Lightweight 3D Camera Orbit & Zoom Bar (solid cream, zero backdrop-filter) */}
      {showCameraBar && (
        <div
          data-testid="camera-controls-bar"
          className={`absolute z-20 flex items-center rounded-xl bg-[#FAF5EA] border border-[#244D3B]/20 shadow-md text-[#244D3B] ${
            isShortLandscape
              ? 'bottom-2 right-2 gap-0.5 px-1.5 py-1'
              : viewportWidth < 768
                ? 'bottom-32 right-3 gap-1 px-2 py-1.5'
                : viewportWidth < 1024
                  ? 'bottom-28 right-4 gap-1 px-2 py-1.5'
                  : 'bottom-5 right-5 gap-1 px-2 py-1.5'
          }`}
        >
          <button
            type="button"
            onClick={() => adjustZoom(-0.15)}
            disabled={cameraUi.zoom <= CAMERA_ZOOM_BOUNDS.min + 0.01}
            title={t(language, 'Zoom Out (Mouse Wheel)', 'Perkecil (Roda Mouse)')}
            aria-label={t(language, 'Zoom Out', 'Perkecil Kamera')}
            className={`${isShortLandscape ? 'w-6 h-6' : 'w-7 h-7'} rounded-lg bg-[#F6EBD4] hover:bg-[#D9E8C8] disabled:opacity-40 flex items-center justify-center cursor-pointer`}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span
            className={`px-1 font-mono tabular-nums font-semibold text-[#355446] text-center ${
              isShortLandscape ? 'text-[10px] min-w-[2rem]' : 'text-[11px] min-w-[2.4rem]'
            }`}
          >
            {cameraUi.zoom.toFixed(1)}×
          </span>
          <button
            type="button"
            onClick={() => adjustZoom(0.15)}
            disabled={cameraUi.zoom >= CAMERA_ZOOM_BOUNDS.max - 0.01}
            title={t(language, 'Zoom In (Mouse Wheel)', 'Perbesar (Roda Mouse)')}
            aria-label={t(language, 'Zoom In', 'Perbesar Kamera')}
            className={`${isShortLandscape ? 'w-6 h-6' : 'w-7 h-7'} rounded-lg bg-[#F6EBD4] hover:bg-[#D9E8C8] disabled:opacity-40 flex items-center justify-center cursor-pointer`}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="h-4 w-px bg-[#244D3B]/15 mx-0.5" />
          <button
            type="button"
            onClick={() => adjustOrbitYaw(-0.22)}
            title={t(
              language,
              'Rotate Left (or Right-Drag)',
              'Putar Kiri (atau Seret Klik Kanan)',
            )}
            aria-label={t(language, 'Rotate Camera Left', 'Putar Kamera Kiri')}
            className={`${isShortLandscape ? 'w-6 h-6' : 'w-7 h-7'} rounded-lg bg-[#F6EBD4] hover:bg-[#D9E8C8] flex items-center justify-center cursor-pointer`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => adjustOrbitYaw(0.22)}
            title={t(
              language,
              'Rotate Right (or Right-Drag)',
              'Putar Kanan (atau Seret Klik Kanan)',
            )}
            aria-label={t(language, 'Rotate Camera Right', 'Putar Kamera Kanan')}
            className={`${isShortLandscape ? 'w-6 h-6' : 'w-7 h-7'} rounded-lg bg-[#F6EBD4] hover:bg-[#D9E8C8] flex items-center justify-center cursor-pointer`}
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          {cameraUi.rotated && (
            <button
              type="button"
              onClick={resetCameraView}
              title={t(language, 'Reset Camera Angle', 'Reset Sudut Kamera')}
              aria-label={t(language, 'Reset Camera', 'Reset Kamera')}
              className={`${isShortLandscape ? 'w-6 h-6' : 'w-7 h-7'} rounded-lg bg-[#ED9B53] hover:bg-[#DF883D] text-[#1C3529] flex items-center justify-center cursor-pointer`}
            >
              <LocateFixed className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* WebGL fallback notice if context lost */}
      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#F6EBD4] p-6 text-center">
          <div className="max-w-md rounded-xl bg-[#FAF5EA] border border-[#244D3B]/20 p-6 shadow-sm">
            <h2 className="font-display text-xl font-bold text-[#244D3B]">
              {t(language, '3D Kitchen Viewport Paused', 'Tampilan Dapur 3D Dijeda')}
            </h2>
            <p className="mt-2 text-sm text-[#3F5D4E]">
              {t(
                language,
                'WebGL rendering context is unavailable or resetting. You can still access all stations via the quick action bar below.',
                'Konteks grafis WebGL sedang tidak tersedia atau dimuat ulang. Kamu tetap bisa membuka semua stasiun melalui bilah pintasan di bawah.',
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
