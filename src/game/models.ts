import * as THREE from 'three';
import { getDineInCapacity } from '../config/gameBalance';
import type {
  KitchenHelperRole,
  StationId,
  UpgradeLevels,
  WeeklyFestivalDef,
} from '../types/game';
import { DINE_IN_TABLES } from './isoUtils';
import {
  type CashierShowcaseLayout,
  computeShopDecorationVisualState,
} from './showcaseHelpers';
import {
  createAwningTexture,
  createBambooWeaveTexture,
  createContactShadowTexture,
  createKitchenTileTexture,
  createMenuChalkboardTexture,
  createWoodPlankTexture,
  createWovenRugTexture,
} from './textures';

export interface CharacterRig {
  root: THREE.Group;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  carriedTray?: THREE.Group;
  patienceBarFill?: THREE.Mesh;
}

export interface InteractiveDecoRef {
  id: string;
  kind: 'lantern' | 'plant' | 'menu_board';
  group: THREE.Group;
  baseRotationZ: number;
  baseScale: number;
  phase: number;
  impulse: number;
}

export interface ShopEnvironmentResult {
  group: THREE.Group;
  interactiveDecos: InteractiveDecoRef[];
  lanternCount: number;
  plantCount: number;
  hasMenuBoard: boolean;
  hasDiningRug: boolean;
  hasFestivalBanner: boolean;
}

const shadowMatCache = { mat: null as THREE.MeshBasicMaterial | null };

export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const mat = mesh.material;
    if (!mat) return;
    const mats = Array.isArray(mat) ? mat : [mat];
    for (const m of mats) {
      if (m === shadowMatCache.mat) continue;
      const std = m as THREE.MeshStandardMaterial;
      if (std.map) std.map.dispose();
      m.dispose();
    }
  });
}

function getContactShadowPlane(radius: number): THREE.Mesh {
  if (!shadowMatCache.mat) {
    shadowMatCache.mat = new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(),
      transparent: true,
      depthWrite: false,
    });
  }
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  const mesh = new THREE.Mesh(geo, shadowMatCache.mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.012;
  return mesh;
}

function makeRoundedBox(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  castShadow = true,
): THREE.Mesh {
  const shape = new THREE.Shape();
  const r = Math.min(w, d) * 0.12;
  const hw = w / 2 - r;
  const hd = d / 2 - r;
  shape.moveTo(-hw, -d / 2);
  shape.lineTo(hw, -d / 2);
  shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -hd);
  shape.lineTo(w / 2, hd);
  shape.quadraticCurveTo(w / 2, d / 2, hw, d / 2);
  shape.lineTo(-hw, d / 2);
  shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, hd);
  shape.lineTo(-w / 2, -hd);
  shape.quadraticCurveTo(-w / 2, -d / 2, -hw, -d / 2);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.02, h - 0.04),
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.02, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

export function createEntrepreneurModel(): CharacterRig {
  const root = new THREE.Group();
  root.add(getContactShadowPlane(0.55));

  const coatMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.65 });
  const apronMat = new THREE.MeshStandardMaterial({ color: '#6E9B72', roughness: 0.78 });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#F3C7A3', roughness: 0.6 });
  const hairMat = new THREE.MeshStandardMaterial({ color: '#2E231D', roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: '#244D3B', roughness: 0.8 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#1A1A1A', roughness: 0.3 });

  // Legs (articulated at hip)
  const legGeo = new THREE.CapsuleGeometry(0.09, 0.24, 4, 8);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.13, 0.24, 0);
  leftLeg.castShadow = true;
  root.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.13, 0.24, 0);
  rightLeg.castShadow = true;
  root.add(rightLeg);

  // Chef torso + sage apron
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.56, 12), coatMat);
  torso.position.y = 0.68;
  torso.castShadow = true;
  root.add(torso);

  const apron = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.14), apronMat);
  apron.position.set(0, 0.62, 0.21);
  apron.castShadow = true;
  root.add(apron);

  // Arms
  const armGeo = new THREE.CapsuleGeometry(0.075, 0.24, 4, 8);
  const leftArm = new THREE.Mesh(armGeo, coatMat);
  leftArm.position.set(-0.32, 0.7, 0);
  leftArm.castShadow = true;
  root.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, coatMat);
  rightArm.position.set(0.32, 0.7, 0);
  rightArm.castShadow = true;
  root.add(rightArm);

  // Head + eyes
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), skinMat);
  head.position.y = 1.15;
  head.castShadow = true;
  root.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.245, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hairMat,
  );
  hair.position.set(0, 1.17, -0.03);
  hair.rotation.x = -0.35;
  root.add(hair);

  const eyeGeo = new THREE.SphereGeometry(0.03, 8, 8);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.08, 1.16, 0.22);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.08, 1.16, 0.22);
  root.add(eyeL, eyeR);

  // Chef Toque Hat (band + puffed crown)
  const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.2, 0.16, 14), coatMat);
  hatBand.position.y = 1.38;
  hatBand.castShadow = true;
  const hatCrown = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 12), coatMat);
  hatCrown.scale.set(1, 0.72, 1);
  hatCrown.position.y = 1.52;
  hatCrown.castShadow = true;
  root.add(hatBand, hatCrown);

  // Carried bamboo tray (toggled when carrying packaged boxes)
  const carriedTray = new THREE.Group();
  carriedTray.position.set(0, 0.78, 0.44);
  const trayRim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.22, 0.08, 14),
    new THREE.MeshStandardMaterial({ color: '#D2A66E', roughness: 0.85 }),
  );
  carriedTray.add(trayRim);
  for (let i = 0; i < 3; i++) {
    const bun = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 10, 8),
      new THREE.MeshStandardMaterial({ color: '#FAF2DF', roughness: 0.5 }),
    );
    const angle = (i * Math.PI * 2) / 3;
    bun.position.set(Math.cos(angle) * 0.09, 0.05, Math.sin(angle) * 0.09);
    carriedTray.add(bun);
  }
  carriedTray.visible = false;
  root.add(carriedTray);

  return { root, leftArm, rightArm, leftLeg, rightLeg, carriedTray };
}

export function createCustomerModel(shirtColor: string): CharacterRig {
  const root = new THREE.Group();
  root.add(getContactShadowPlane(0.48));

  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.72 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: '#39434F', roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#ECC2A0', roughness: 0.6 });
  const hairMat = new THREE.MeshStandardMaterial({ color: '#2A211B', roughness: 0.85 });

  const legGeo = new THREE.CapsuleGeometry(0.075, 0.22, 4, 8);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.1, 0.22, 0);
  leftLeg.castShadow = true;
  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.1, 0.22, 0);
  rightLeg.castShadow = true;

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.5, 12), shirtMat);
  torso.position.y = 0.62;
  torso.castShadow = true;

  const armGeo = new THREE.CapsuleGeometry(0.06, 0.2, 4, 8);
  const leftArm = new THREE.Mesh(armGeo, shirtMat);
  leftArm.position.set(-0.27, 0.65, 0);
  const rightArm = new THREE.Mesh(armGeo, shirtMat);
  rightArm.position.set(0.27, 0.65, 0);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 14), skinMat);
  head.position.y = 1.04;
  head.castShadow = true;

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairMat,
  );
  hair.position.set(0, 1.07, -0.02);
  hair.rotation.x = -0.25;

  // Floating patience indicator bar above head
  const barBg = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.07, 0.04),
    new THREE.MeshBasicMaterial({ color: '#1C3529' }),
  );
  barBg.position.set(0, 1.44, 0);

  const patienceBarFill = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.045, 0.05),
    new THREE.MeshBasicMaterial({ color: '#6E9B72' }),
  );
  patienceBarFill.position.set(0, 1.44, 0.01);

  root.add(leftLeg, rightLeg, torso, leftArm, rightArm, head, hair, barBg, patienceBarFill);
  return { root, leftArm, rightArm, leftLeg, rightLeg, patienceBarFill };
}

const HELPER_PALETTE: Record<
  KitchenHelperRole,
  { apron: string; hat: string; hair: string; shirt: string; skin: string }
> = {
  prep: {
    apron: '#3D7A5A',
    hat: '#FAF5EA',
    hair: '#2E231D',
    shirt: '#F5EFE2',
    skin: '#ECC19E',
  },
  mix: {
    apron: '#ED9B53',
    hat: '#244D3B',
    hair: '#251D18',
    shirt: '#FAF5EA',
    skin: '#E6B792',
  },
  wrap: {
    apron: '#8B5E83',
    hat: '#F6EBD4',
    hair: '#3A2820',
    shirt: '#FAF5EA',
    skin: '#F3C7A3',
  },
  steam: {
    apron: '#244D3B',
    hat: '#ED9B53',
    hair: '#1F1A17',
    shirt: '#EDE4D1',
    skin: '#E2B28D',
  },
};

export function createKitchenHelperModel(role: KitchenHelperRole): CharacterRig {
  const pal = HELPER_PALETTE[role];
  const root = new THREE.Group();
  root.add(getContactShadowPlane(0.46));

  const shirtMat = new THREE.MeshStandardMaterial({ color: pal.shirt, roughness: 0.7 });
  const apronMat = new THREE.MeshStandardMaterial({ color: pal.apron, roughness: 0.78 });
  const hatMat = new THREE.MeshStandardMaterial({ color: pal.hat, roughness: 0.65 });
  const skinMat = new THREE.MeshStandardMaterial({ color: pal.skin, roughness: 0.6 });
  const hairMat = new THREE.MeshStandardMaterial({ color: pal.hair, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: '#2F3E37', roughness: 0.82 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#1A1A1A', roughness: 0.35 });
  const toolMat = new THREE.MeshStandardMaterial({
    color: '#D5DCE0',
    roughness: 0.28,
    metalness: 0.8,
  });

  const legGeo = new THREE.CapsuleGeometry(0.075, 0.21, 4, 8);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.11, 0.21, 0);
  leftLeg.castShadow = true;

  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.11, 0.21, 0);
  rightLeg.castShadow = true;

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.5, 12), shirtMat);
  torso.position.y = 0.61;
  torso.castShadow = true;

  const apron = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.4, 0.12), apronMat);
  apron.position.set(0, 0.56, 0.18);
  apron.castShadow = true;

  const armGeo = new THREE.CapsuleGeometry(0.062, 0.2, 4, 8);
  const leftArm = new THREE.Mesh(armGeo, shirtMat);
  leftArm.position.set(-0.27, 0.64, 0);
  leftArm.castShadow = true;

  const rightArm = new THREE.Mesh(armGeo, shirtMat);
  rightArm.position.set(0.27, 0.64, 0);
  rightArm.castShadow = true;

  // Role tool attached to right arm so kitchen activity reads clearly
  const toolProp =
    role === 'prep'
      ? new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.22), toolMat)
      : role === 'mix'
        ? new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.05, 0.22, 8), toolMat)
        : role === 'wrap'
          ? new THREE.Mesh(
              new THREE.CylinderGeometry(0.028, 0.028, 0.22, 8),
              new THREE.MeshStandardMaterial({ color: '#B88450', roughness: 0.78 }),
            )
          : new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.16), apronMat);
  toolProp.position.set(0, -0.14, 0.12);
  toolProp.rotation.x = Math.PI / 2.4;
  rightArm.add(toolProp);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 14), skinMat);
  head.position.y = 1.03;
  head.castShadow = true;

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.215, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hairMat,
  );
  hair.position.set(0, 1.05, -0.02);
  hair.rotation.x = -0.3;

  const eyeGeo = new THREE.SphereGeometry(0.025, 8, 8);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.07, 1.04, 0.19);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.07, 1.04, 0.19);

  // Chef cap / bandana accent
  const capBand = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.21, 0.11, 14), hatMat);
  capBand.position.set(0, 1.18, 0);
  capBand.castShadow = true;
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), hatMat);
  capTop.scale.set(1, 0.65, 1);
  capTop.position.set(0, 1.25, 0);

  root.add(
    leftLeg,
    rightLeg,
    torso,
    apron,
    leftArm,
    rightArm,
    head,
    hair,
    eyeL,
    eyeR,
    capBand,
    capTop,
  );
  return { root, leftArm, rightArm, leftLeg, rightLeg };
}

export function createStationModel(
  stationId: StationId,
  upgrades: UpgradeLevels,
  anisotropy = 4,
): { group: THREE.Group; steamOrigin?: THREE.Vector3; ringMesh: THREE.Mesh } {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: '#C69763', roughness: 0.75 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: '#7D5533', roughness: 0.8 });
  const creamMat = new THREE.MeshStandardMaterial({ color: '#F6EBD4', roughness: 0.55 });
  const sageMat = new THREE.MeshStandardMaterial({ color: '#6E9B72', roughness: 0.6 });
  const forestMat = new THREE.MeshStandardMaterial({ color: '#244D3B', roughness: 0.65 });
  const steelMat = new THREE.MeshStandardMaterial({
    color: '#D5DCE0',
    roughness: 0.25,
    metalness: 0.85,
  });
  const orangeMat = new THREE.MeshStandardMaterial({ color: '#ED9B53', roughness: 0.5 });
  const bambooMat = new THREE.MeshStandardMaterial({
    map: createBambooWeaveTexture(anisotropy),
    roughness: 0.82,
  });

  // Ground contact shadow
  group.add(getContactShadowPlane(0.95));

  // Highlight ring at base (subtle until hovered/near)
  const ringGeo = new THREE.RingGeometry(0.76, 0.88, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: '#ED9B53',
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.position.y = 0.025;
  group.add(ringMesh);

  let steamOrigin: THREE.Vector3 | undefined;

  if (stationId === 'storage') {
    // Double glass-front cold refrigerator + produce crate
    const body = makeRoundedBox(1.4, 1.85, 0.95, creamMat);
    const topTrim = makeRoundedBox(1.44, 0.14, 1.0, sageMat);
    topTrim.position.y = 1.84;
    const glassPane = new THREE.Mesh(
      new THREE.BoxGeometry(1.12, 1.35, 0.06),
      new THREE.MeshPhysicalMaterial({
        color: '#DDF2EE',
        roughness: 0.08,
        transparent: true,
        opacity: 0.45,
      }),
    );
    glassPane.position.set(0, 1.0, 0.47);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), steelMat);
    handle.position.set(0.45, 1.0, 0.53);
    const interiorGlow = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 1.25, 0.2),
      new THREE.MeshStandardMaterial({
        color: '#D9E8C8',
        emissive: '#B8DEC8',
        emissiveIntensity: 0.35,
      }),
    );
    interiorGlow.position.set(0, 1.0, 0.3);
    // Side produce crate
    const crate = makeRoundedBox(0.55, 0.45, 0.55, woodMat);
    crate.position.set(0.92, 0, 0.15);
    const carrotProp = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.25, 8), orangeMat);
    carrotProp.rotation.z = 0.6;
    carrotProp.position.set(0.9, 0.5, 0.15);
    group.add(body, topTrim, interiorGlow, glassPane, handle, crate, carrotProp);
  } else if (stationId === 'market') {
    // Market Terminal kiosk with tablet POS
    const desk = makeRoundedBox(1.2, 0.92, 0.8, woodMat);
    const frontPanel = makeRoundedBox(1.06, 0.65, 0.12, forestMat);
    frontPanel.position.set(0, 0.15, 0.38);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.24, 10), steelMat);
    stand.position.set(0, 1.02, 0);
    const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.06), forestMat);
    monitor.position.set(0, 1.24, 0);
    monitor.rotation.x = -0.25;
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.54, 0.32),
      new THREE.MeshStandardMaterial({
        color: '#D9E8C8',
        emissive: '#6E9B72',
        emissiveIntensity: 0.45,
      }),
    );
    screen.position.set(0, 1.24, 0.036);
    screen.rotation.x = -0.25;
    group.add(desk, frontPanel, stand, monitor, screen);
  } else if (stationId === 'prep') {
    const table = makeRoundedBox(1.65, 0.88, 0.95, woodMat);
    const legs = makeRoundedBox(1.5, 0.4, 0.82, darkWoodMat);
    const count = upgrades.prep_table;
    group.add(legs, table);
    for (let i = 0; i < count; i++) {
      const offsetX = count === 1 ? 0 : (i - (count - 1) / 2) * 0.48;
      const board = makeRoundedBox(0.42, 0.05, 0.34, creamMat);
      board.position.set(offsetX, 0.88, 0.05);
      const knife = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.06), steelMat);
      knife.position.set(offsetX + 0.08, 0.94, 0.1);
      knife.rotation.y = 0.4;
      group.add(board, knife);
    }
  } else if (stationId === 'mixing') {
    const bench = makeRoundedBox(1.35, 0.88, 0.88, creamMat);
    const top = makeRoundedBox(1.4, 0.08, 0.92, steelMat);
    top.position.y = 0.84;
    // Lathe ceramic bowl
    const bowlPts = [
      new THREE.Vector2(0.01, 0),
      new THREE.Vector2(0.18, 0),
      new THREE.Vector2(0.28, 0.22),
      new THREE.Vector2(0.25, 0.24),
      new THREE.Vector2(0.16, 0.04),
      new THREE.Vector2(0.01, 0.04),
    ];
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlPts, 18), forestMat);
    bowl.position.set(-0.15, 0.92, 0.05);
    bowl.castShadow = true;
    const batter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.16, 0.1, 14),
      orangeMat,
    );
    batter.position.set(-0.15, 1.0, 0.05);
    const jar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.22, 10), sageMat);
    jar1.position.set(0.35, 1.03, -0.15);
    const jar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 10), orangeMat);
    jar2.position.set(0.5, 1.01, 0.05);
    group.add(bench, top, bowl, batter, jar1, jar2);
  } else if (stationId === 'wrapping') {
    const base = makeRoundedBox(1.45, 0.86, 0.9, woodMat);
    const marbleTop = makeRoundedBox(1.5, 0.07, 0.94, creamMat);
    marbleTop.position.y = 0.84;
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.42, 12), darkWoodMat);
    roller.rotation.z = Math.PI / 2;
    roller.position.set(-0.3, 0.95, 0.1);
    group.add(base, marbleTop, roller);
    // 4 sculpted dimsum dumplings on tray
    for (let i = 0; i < 4; i++) {
      const dimsum = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 10, 8),
        new THREE.MeshStandardMaterial({ color: '#FAF0D7', roughness: 0.45 }),
      );
      dimsum.scale.set(1, 0.78, 1);
      dimsum.position.set(0.12 + (i % 2) * 0.22, 0.95, -0.1 + Math.floor(i / 2) * 0.22);
      group.add(dimsum);
    }
  } else if (stationId === 'steamer') {
    const stove = makeRoundedBox(1.45, 0.82, 1.0, forestMat);
    const steelHob = makeRoundedBox(1.38, 0.08, 0.92, steelMat);
    steelHob.position.y = 0.82;
    const burner = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.04, 10, 24),
      new THREE.MeshStandardMaterial({
        color: '#ED9B53',
        emissive: '#ED9B53',
        emissiveIntensity: 0.55,
      }),
    );
    burner.rotation.x = Math.PI / 2;
    burner.position.set(0, 0.91, 0);
    group.add(stove, steelHob, burner);

    // Stacked bamboo tiers matching Upgrade Level 1 / 2 / 3
    const tiers = upgrades.steamer;
    for (let t = 0; t < tiers; t++) {
      const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.22, 18), bambooMat);
      basket.position.set(0, 1.04 + t * 0.23, 0);
      basket.castShadow = true;
      group.add(basket);
    }
    const lid = new THREE.Mesh(
      new THREE.ConeGeometry(0.4, 0.16, 18),
      bambooMat,
    );
    lid.position.set(0, 1.04 + tiers * 0.23, 0);
    lid.castShadow = true;
    const lidHandle = new THREE.Mesh(
      new THREE.TorusGeometry(0.06, 0.018, 8, 12),
      darkWoodMat,
    );
    lidHandle.position.set(0, 1.14 + tiers * 0.23, 0);
    group.add(lid, lidHandle);
    steamOrigin = new THREE.Vector3(0, 1.24 + tiers * 0.23, 0);
  } else if (stationId === 'packaging') {
    const table = makeRoundedBox(1.4, 0.86, 0.95, woodMat);
    group.add(table);
    const boxCount = upgrades.packaging_station + 1;
    for (let i = 0; i < boxCount; i++) {
      const box = makeRoundedBox(0.34, 0.16, 0.28, i % 2 === 0 ? orangeMat : sageMat);
      box.position.set(-0.36 + i * 0.26, 0.86 + (i > 1 ? 0.16 : 0), 0.06);
      group.add(box);
    }
    const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 16), forestMat);
    ribbon.rotation.x = Math.PI / 2;
    ribbon.position.set(0.44, 0.9, -0.2);
    group.add(ribbon);
  } else if (stationId === 'cashier') {
    const counter = makeRoundedBox(2.05, 0.96, 0.95, woodMat);
    const topSlab = makeRoundedBox(2.12, 0.08, 1.02, creamMat);
    topSlab.position.y = 0.94;
    const register = makeRoundedBox(0.46, 0.28, 0.38, forestMat);
    register.position.set(-0.45, 1.02, 0);
    const registerScreen = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.22, 0.05),
      new THREE.MeshStandardMaterial({
        color: '#D9E8C8',
        emissive: '#6E9B72',
        emissiveIntensity: 0.4,
      }),
    );
    registerScreen.position.set(-0.45, 1.38, -0.05);
    // Warm glass display showcase for dimsum boxes
    const warmer = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.44, 0.56),
      new THREE.MeshPhysicalMaterial({
        color: '#FFF4DF',
        roughness: 0.1,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
      }),
    );
    warmer.position.set(0.45, 1.24, 0);
    warmer.renderOrder = 2;
    const tray = makeRoundedBox(0.64, 0.05, 0.44, orangeMat);
    tray.position.set(0.45, 1.03, 0);
    group.add(counter, topSlab, register, registerScreen, warmer, tray);
  } else if (stationId === 'board') {
    const easelLegs = makeRoundedBox(0.95, 0.9, 0.65, darkWoodMat);
    const boardFrame = makeRoundedBox(1.12, 0.95, 0.12, woodMat);
    boardFrame.position.set(0, 0.9, 0);
    const boardFace = new THREE.Mesh(
      new THREE.BoxGeometry(0.96, 0.76, 0.14),
      forestMat,
    );
    boardFace.position.set(0, 1.38, 0.01);
    // Chart bar accents
    for (let i = 0; i < 3; i++) {
      const h = 0.18 + i * 0.14;
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, h, 0.04),
        i === 2 ? orangeMat : sageMat,
      );
      bar.position.set(-0.24 + i * 0.24, 1.15 + h / 2, 0.08);
      group.add(bar);
    }
    group.add(easelLegs, boardFrame, boardFace);
  }

  return { group, steamOrigin, ringMesh };
}

/**
 * Builds stacked miniature dimsum boxes inside the Cashier glass display warmer,
 * matching live `productBatches` stock (`totalBoxesReady`, packaging color & recipe ribbon).
 */
export function createShowcaseBoxesGroup(layout: CashierShowcaseLayout): THREE.Group {
  const container = new THREE.Group();
  container.position.set(0.45, 1.08, 0);
  container.userData.stationId = 'cashier';

  // Status indicator strip on front lip of showcase tray
  const indicatorColor =
    layout.stockTier === 'full'
      ? '#4E9A68'
      : layout.stockTier === 'medium'
        ? '#6E9B72'
        : layout.stockTier === 'low'
          ? '#ED9B53'
          : '#8E9992';

  const statusBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.025, 0.03),
    new THREE.MeshStandardMaterial({
      color: indicatorColor,
      emissive: indicatorColor,
      emissiveIntensity: layout.stockTier === 'empty' ? 0.1 : 0.65,
      roughness: 0.35,
    }),
  );
  statusBar.position.set(0, -0.02, 0.22);
  statusBar.userData.stationId = 'cashier';
  container.add(statusBar);

  if (layout.slots.length === 0) {
    return container;
  }

  const matCache = new Map<string, THREE.MeshStandardMaterial>();
  const getCachedMat = (hex: string, roughness = 0.62) => {
    const key = `${hex}_${roughness}`;
    let mat = matCache.get(key);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({ color: hex, roughness });
      matCache.set(key, mat);
    }
    return mat;
  };

  const lidMat = getCachedMat('#FAF5EA', 0.48);
  const clearanceDotMat = new THREE.MeshStandardMaterial({
    color: '#F59E0B',
    emissive: '#F59E0B',
    emissiveIntensity: 0.45,
    roughness: 0.35,
  });

  for (const slot of layout.slots) {
    const boxGroup = new THREE.Group();
    boxGroup.position.set(slot.x, slot.y, slot.z);
    boxGroup.rotation.y = (slot.index % 3 - 1) * 0.06;

    const bodyH = slot.height * 0.72;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(slot.width, bodyH, slot.depth),
      getCachedMat(slot.boxColorHex, 0.68),
    );
    body.position.y = bodyH / 2;
    body.castShadow = true;
    body.userData.stationId = 'cashier';

    const lidH = slot.height * 0.28;
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(slot.width * 1.03, lidH, slot.depth * 1.03),
      lidMat,
    );
    lid.position.y = bodyH + lidH / 2;
    lid.userData.stationId = 'cashier';

    // Flavor ribbon belly-band
    const ribbon = new THREE.Mesh(
      new THREE.BoxGeometry(slot.width * 0.3, slot.height * 1.04, slot.depth * 1.06),
      getCachedMat(slot.accentColorHex, 0.42),
    );
    ribbon.position.y = slot.height * 0.52;
    ribbon.userData.stationId = 'cashier';

    boxGroup.add(body, lid, ribbon);

    if (slot.isClearance) {
      const tag = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.012, 8),
        clearanceDotMat,
      );
      tag.position.set(slot.width * 0.3, slot.height + 0.008, slot.depth * 0.25);
      tag.userData.stationId = 'cashier';
      boxGroup.add(tag);
    }

    boxGroup.userData.stationId = 'cashier';
    container.add(boxGroup);
  }

  return container;
}

export function createShopEnvironment(
  upgrades: UpgradeLevels,
  anisotropy = 4,
  activeFestival: WeeklyFestivalDef | null = null,
): ShopEnvironmentResult {
  const env = new THREE.Group();
  const interactiveDecos: InteractiveDecoRef[] = [];

  // Base warm ground skirt extending seamlessly into fog
  const skirt = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: '#EBDCC0', roughness: 0.95 }),
  );
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.y = -0.05;
  skirt.receiveShadow = true;
  env.add(skirt);

  // Main Bistro Platform
  const platformBase = new THREE.Mesh(
    new THREE.BoxGeometry(13.2, 0.32, 11.2),
    new THREE.MeshStandardMaterial({ color: '#8A6340', roughness: 0.85 }),
  );
  platformBase.position.set(0, -0.17, 0);
  platformBase.receiveShadow = true;
  env.add(platformBase);

  // Kitchen Floor (back half z in [-5.4, 0.2])
  const kitchenFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(12.8, 5.6),
    new THREE.MeshStandardMaterial({
      map: createKitchenTileTexture(anisotropy),
      roughness: 0.65,
    }),
  );
  kitchenFloor.rotation.x = -Math.PI / 2;
  kitchenFloor.position.set(0, 0.002, -2.6);
  kitchenFloor.receiveShadow = true;
  env.add(kitchenFloor);

  // Dining Floor (front half z in [0.2, 5.4])
  const diningFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(12.8, 5.2),
    new THREE.MeshStandardMaterial({
      map: createWoodPlankTexture(anisotropy),
      roughness: 0.72,
    }),
  );
  diningFloor.rotation.x = -Math.PI / 2;
  diningFloor.position.set(0, 0.004, 2.8);
  diningFloor.receiveShadow = true;
  env.add(diningFloor);

  // Back-left & Back-right cozy framing walls
  const wallCreamMat = new THREE.MeshStandardMaterial({ color: '#F6EBD4', roughness: 0.8 });
  const wainscotMat = new THREE.MeshStandardMaterial({ color: '#6E9B72', roughness: 0.72 });

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(13.0, 2.8, 0.24), wallCreamMat);
  backWall.position.set(0, 1.4, -5.5);
  backWall.castShadow = true;
  backWall.receiveShadow = true;

  const backTrim = new THREE.Mesh(new THREE.BoxGeometry(13.05, 0.9, 0.28), wainscotMat);
  backTrim.position.set(0, 0.45, -5.48);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.8, 11.0), wallCreamMat);
  leftWall.position.set(-6.4, 1.4, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;

  const leftTrim = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.9, 11.05), wainscotMat);
  leftTrim.position.set(-6.38, 0.45, 0);

  env.add(backWall, backTrim, leftWall, leftTrim);

  // Striped Shop Awning over front entrance
  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.14, 1.3),
    new THREE.MeshStandardMaterial({
      map: createAwningTexture(anisotropy),
      roughness: 0.75,
    }),
  );
  awning.position.set(1.2, 2.35, 5.45);
  awning.rotation.x = 0.28;
  awning.castShadow = true;
  env.add(awning);

  // Customer Dining Tables & Stools (2 to 4 tables based on dining_seating level)
  const woodMat = new THREE.MeshStandardMaterial({ color: '#C69763', roughness: 0.75 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: '#7D5533', roughness: 0.8 });
  const stoolMat = new THREE.MeshStandardMaterial({ color: '#244D3B', roughness: 0.65 });
  const coasterMat = new THREE.MeshStandardMaterial({ color: '#FAF5EA', roughness: 0.5 });
  const tableCapacity = getDineInCapacity(upgrades);
  const tablePositions = DINE_IN_TABLES.slice(0, tableCapacity);
  for (const tp of tablePositions) {
    const tblTop = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.08, 16), woodMat);
    tblTop.position.set(tp.x, 0.72, tp.z);
    tblTop.castShadow = true;
    const tblLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.7, 10), stoolMat);
    tblLeg.position.set(tp.x, 0.35, tp.z);
    const coaster = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.03, 12), coasterMat);
    coaster.position.set(tp.x, 0.775, tp.z);
    env.add(tblTop, tblLeg, coaster);

    for (const sx of [-0.72, 0.72]) {
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.42, 12), stoolMat);
      stool.position.set(tp.x + sx, 0.21, tp.z);
      stool.castShadow = true;
      env.add(stool);
    }
  }

  // Shop Decoration Upgrades (Levels 1 -> 2 -> 3) + Active Festival Accents
  const decoState = computeShopDecorationVisualState(upgrades, activeFestival);
  const decoLevel = decoState.decorationLevel;

  // 1. Interactive Wall Menu Chalkboard (Back Wall, right-center above kitchen)
  const menuGroup = new THREE.Group();
  menuGroup.position.set(-0.15, 1.75, -5.34);
  const menuFrame = makeRoundedBox(2.25, 1.15, 0.08, decoLevel >= 2 ? woodMat : darkWoodMat);
  menuFrame.rotation.x = Math.PI / 2;
  menuFrame.position.set(0, 0, -0.02);
  const menuFace = new THREE.Mesh(
    new THREE.PlaneGeometry(2.05, 1.0),
    new THREE.MeshStandardMaterial({
      map: createMenuChalkboardTexture(
        decoLevel,
        activeFestival ? activeFestival.titleId : null,
        anisotropy,
      ),
      roughness: 0.78,
    }),
  );
  menuFace.position.set(0, 0, 0.05);
  const chalkLedge = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.06, 0.12), darkWoodMat);
  chalkLedge.position.set(0, -0.58, 0.04);
  menuGroup.add(menuFrame, menuFace, chalkLedge);

  if (decoState.hasMenuBoardLight) {
    const brassMat = new THREE.MeshStandardMaterial({
      color: '#D4A553',
      roughness: 0.28,
      metalness: 0.82,
    });
    const sconceArm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.22), brassMat);
    sconceArm.position.set(0, 0.64, 0.1);
    const sconceHood = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 0.12, 12),
      new THREE.MeshStandardMaterial({
        color: '#FFF2CE',
        emissive: '#ED9B53',
        emissiveIntensity: 0.65,
      }),
    );
    sconceHood.rotation.z = Math.PI / 2;
    sconceHood.scale.set(1, 3.2, 1);
    sconceHood.position.set(0, 0.64, 0.2);
    menuGroup.add(sconceArm, sconceHood);
  }
  const menuId = 'deco_menu_board';
  menuGroup.userData.decoId = menuId;
  menuGroup.traverse((child) => {
    child.userData.decoId = menuId;
  });
  env.add(menuGroup);
  interactiveDecos.push({
    id: menuId,
    kind: 'menu_board',
    group: menuGroup,
    baseRotationZ: 0,
    baseScale: 1,
    phase: 0,
    impulse: 0,
  });

  // 2. Composite Potted Herbal & Bamboo Plants (interactive sway on click)
  const potMat = new THREE.MeshStandardMaterial({ color: '#D88A48', roughness: 0.72 });
  const soilMat = new THREE.MeshStandardMaterial({ color: '#4B3627', roughness: 0.95 });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#4E8255', roughness: 0.62 });
  const sproutMat = new THREE.MeshStandardMaterial({ color: '#83B876', roughness: 0.55 });
  const blossomMat = new THREE.MeshStandardMaterial({
    color: '#F6EBD4',
    emissive: '#ED9B53',
    emissiveIntensity: 0.22,
    roughness: 0.45,
  });

  decoState.plantPositions.forEach((pc, idx) => {
    const plantGroup = new THREE.Group();
    plantGroup.position.set(pc.x, 0, pc.z);
    plantGroup.scale.setScalar(pc.scale);

    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.4, 12), potMat);
    pot.position.y = 0.2;
    pot.castShadow = true;

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.035, 8, 16), potMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.4;

    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 12), soilMat);
    soil.position.y = 0.38;

    const bushMain = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 1), leafMat);
    bushMain.position.set(0, 0.68, 0);
    bushMain.castShadow = true;

    const bushTop = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 1), sproutMat);
    bushTop.position.set(0.08, 0.92, -0.04);
    bushTop.castShadow = true;

    plantGroup.add(pot, rim, soil, bushMain, bushTop);

    if (pc.hasBlossoms) {
      for (let b = 0; b < 3; b++) {
        const angle = (b * Math.PI * 2) / 3;
        const blossom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), blossomMat);
        blossom.position.set(Math.cos(angle) * 0.22, 0.78 + (b % 2) * 0.14, Math.sin(angle) * 0.22);
        plantGroup.add(blossom);
      }
    }

    const decoId = `deco_plant_${idx}`;
    plantGroup.userData.decoId = decoId;
    plantGroup.traverse((child) => {
      child.userData.decoId = decoId;
    });
    env.add(plantGroup);
    interactiveDecos.push({
      id: decoId,
      kind: 'plant',
      group: plantGroup,
      baseRotationZ: 0,
      baseScale: pc.scale,
      phase: idx * 1.1,
      impulse: 0,
    });
  });

  // 3. Composite Hanging Paper Lanterns (1 -> 2 -> 4 + 2 festival lanterns)
  const capMat = new THREE.MeshStandardMaterial({
    color: '#D4A553',
    roughness: 0.35,
    metalness: 0.75,
  });
  const cordMat = new THREE.MeshStandardMaterial({ color: '#3E2B1E', roughness: 0.9 });
  const regularLanternMat = new THREE.MeshStandardMaterial({
    color: '#ED9B53',
    emissive: '#ED9B53',
    emissiveIntensity: decoState.lanternEmissiveIntensity,
    roughness: 0.42,
  });
  const festColor = decoState.festivalAccentHex ?? '#E56B45';
  const festivalLanternMat = new THREE.MeshStandardMaterial({
    color: festColor,
    emissive: festColor,
    emissiveIntensity: decoState.lanternEmissiveIntensity + 0.12,
    roughness: 0.38,
  });

  decoState.lanternPositions.forEach((lp, idx) => {
    const lanternGroup = new THREE.Group();
    // Pivot near ceiling/cord top so lantern swings naturally like a pendulum
    lanternGroup.position.set(lp.x, lp.y + 0.45, lp.z);

    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.42, 6), cordMat);
    cord.position.y = -0.21;

    const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.04, 12), capMat);
    topCap.position.y = -0.39;

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 14, 12),
      lp.isFestival ? festivalLanternMat : regularLanternMat,
    );
    body.scale.set(1, 1.24, 1);
    body.position.y = -0.58;

    const bottomCap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.04, 12), capMat);
    bottomCap.position.y = -0.79;

    const tassel = new THREE.Mesh(
      new THREE.ConeGeometry(0.035, 0.16, 8),
      lp.isFestival ? festivalLanternMat : capMat,
    );
    tassel.rotation.x = Math.PI;
    tassel.position.y = -0.89;

    lanternGroup.add(cord, topCap, body, bottomCap, tassel);

    const decoId = `deco_lantern_${idx}`;
    lanternGroup.userData.decoId = decoId;
    lanternGroup.traverse((child) => {
      child.userData.decoId = decoId;
    });
    env.add(lanternGroup);
    interactiveDecos.push({
      id: decoId,
      kind: 'lantern',
      group: lanternGroup,
      baseRotationZ: 0,
      baseScale: 1,
      phase: idx * 0.9,
      impulse: 0,
    });
  });

  // 4. Festival Pennant Bunting along the Back Wall
  if (decoState.hasFestivalBanner) {
    const festMatPrimary = new THREE.MeshStandardMaterial({
      color: decoState.festivalAccentHex ?? '#ED9B53',
      roughness: 0.5,
    });
    const festMatAlt = new THREE.MeshStandardMaterial({ color: '#FAF5EA', roughness: 0.55 });
    for (let i = 0; i < 9; i++) {
      const px = -4.0 + i * 1.0;
      const pennant = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.34, 3),
        i % 2 === 0 ? festMatPrimary : festMatAlt,
      );
      pennant.rotation.x = Math.PI;
      pennant.position.set(px, 2.52, -5.22);
      env.add(pennant);
    }
  }

  // 5. Premium Woven Botanical Dining Rug (Decoration Lv 3)
  if (decoState.hasDiningRug) {
    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 3.8),
      new THREE.MeshStandardMaterial({
        map: createWovenRugTexture(anisotropy),
        roughness: 0.92,
      }),
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(-3.9, 0.015, 3.4);
    rug.receiveShadow = true;
    env.add(rug);
  }

  return {
    group: env,
    interactiveDecos,
    lanternCount: decoState.lanternCount,
    plantCount: decoState.plantPositions.length,
    hasMenuBoard: true,
    hasDiningRug: decoState.hasDiningRug,
    hasFestivalBanner: decoState.hasFestivalBanner,
  };
}

