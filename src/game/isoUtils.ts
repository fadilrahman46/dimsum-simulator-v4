import * as THREE from 'three';
import type { KitchenHelperRole, StationId } from '../types/game';

export interface StationPlacement {
  id: StationId;
  x: number;
  z: number;
  width: number;
  depth: number;
  interactRadius: number;
  facingRotationY: number;
}

/**
 * 9-Zone Isometric Bistro & Kitchen Layout (14m x 12m interior: x in [-6.5, 6.5], z in [-5.5, 5.5])
 * Back Kitchen (z < 0): Storage, Market, Prep, Mixing, Wrapping, Steamer, Packaging
 * Front Outlet (z > 0): Cashier Counter, Business Board, Customer Dining & Queue Area
 */
export const STATION_PLACEMENTS: StationPlacement[] = [
  {
    id: 'storage',
    x: -4.6,
    z: -4.0,
    width: 1.6,
    depth: 1.2,
    interactRadius: 2.0,
    facingRotationY: 0,
  },
  {
    id: 'market',
    x: -2.0,
    z: -4.2,
    width: 1.3,
    depth: 1.0,
    interactRadius: 1.9,
    facingRotationY: 0,
  },
  {
    id: 'prep',
    x: -4.4,
    z: -1.4,
    width: 1.8,
    depth: 1.1,
    interactRadius: 2.0,
    facingRotationY: Math.PI / 2,
  },
  {
    id: 'mixing',
    x: -1.6,
    z: -1.6,
    width: 1.5,
    depth: 1.0,
    interactRadius: 1.9,
    facingRotationY: 0,
  },
  {
    id: 'wrapping',
    x: 1.3,
    z: -1.6,
    width: 1.6,
    depth: 1.0,
    interactRadius: 1.9,
    facingRotationY: 0,
  },
  {
    id: 'steamer',
    x: 1.4,
    z: -4.0,
    width: 1.6,
    depth: 1.2,
    interactRadius: 2.0,
    facingRotationY: 0,
  },
  {
    id: 'packaging',
    x: 4.3,
    z: -3.2,
    width: 1.6,
    depth: 1.2,
    interactRadius: 2.0,
    facingRotationY: -Math.PI / 2,
  },
  {
    id: 'cashier',
    x: 1.2,
    z: 1.2,
    width: 2.2,
    depth: 1.1,
    interactRadius: 2.2,
    facingRotationY: 0,
  },
  {
    id: 'board',
    x: 4.6,
    z: 0.4,
    width: 1.3,
    depth: 1.1,
    interactRadius: 2.0,
    facingRotationY: -Math.PI / 2,
  },
];

export interface BoxCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const WORLD_BOUNDS = {
  minX: -5.8,
  maxX: 5.8,
  minZ: -4.8,
  maxZ: 4.8,
};

export const CUSTOMER_SLOTS: Array<{ x: number; z: number }> = [
  { x: 0.2, z: 3.1 },
  { x: 1.8, z: 3.2 },
  { x: -1.8, z: 3.4 },
  { x: 3.4, z: 3.4 },
];

export const DINE_IN_TABLES: Array<{ x: number; z: number }> = [
  { x: -3.9, z: 2.5 },
  { x: -3.9, z: 4.35 },
  { x: 4.4, z: 2.5 },
  { x: 4.4, z: 4.35 },
];

export const DINE_IN_SEAT_SLOTS: Array<{
  x: number;
  z: number;
  facingRotationY: number;
}> = [
  { x: -3.18, z: 2.5, facingRotationY: -Math.PI / 2 },
  { x: -3.18, z: 4.35, facingRotationY: -Math.PI / 2 },
  { x: 3.68, z: 2.5, facingRotationY: Math.PI / 2 },
  { x: 3.68, z: 4.35, facingRotationY: Math.PI / 2 },
];

export const STAFF_STATION_SLOTS: Record<
  KitchenHelperRole,
  { x: number; z: number; facingRotationY: number }
> = {
  prep: { x: -5.25, z: -1.4, facingRotationY: Math.PI / 2 },
  mix: { x: -1.6, z: -2.42, facingRotationY: 0 },
  wrap: { x: 1.3, z: -2.42, facingRotationY: 0 },
  steam: { x: 2.38, z: -4.0, facingRotationY: -Math.PI / 2 },
};

export const STAFF_WELLNESS_SLOTS: Record<
  KitchenHelperRole,
  { x: number; z: number; facingRotationY: number }
> = {
  prep: { x: -4.95, z: 2.5, facingRotationY: Math.PI / 2 },
  mix: { x: -4.95, z: 4.35, facingRotationY: Math.PI / 2 },
  wrap: { x: -2.9, z: 2.5, facingRotationY: -Math.PI / 2 },
  steam: { x: -2.9, z: 4.35, facingRotationY: -Math.PI / 2 },
};

export function getStationColliders(diningLevel = 1): BoxCollider[] {
  const colliders: BoxCollider[] = STATION_PLACEMENTS.map((s) => ({
    minX: s.x - s.width * 0.52,
    maxX: s.x + s.width * 0.52,
    minZ: s.z - s.depth * 0.52,
    maxZ: s.z + s.depth * 0.52,
  }));

  // Dining tables in Customer Area (2 base + up to 2 unlocked via dining_seating)
  colliders.push(
    { minX: -4.6, maxX: -3.2, minZ: 1.8, maxZ: 3.2 },
    { minX: -4.6, maxX: -3.2, minZ: 3.8, maxZ: 5.0 },
  );
  if (diningLevel >= 2) {
    colliders.push({ minX: 3.7, maxX: 5.1, minZ: 1.8, maxZ: 3.2 });
  }
  if (diningLevel >= 3) {
    colliders.push({ minX: 3.7, maxX: 5.1, minZ: 3.8, maxZ: 5.0 });
  }
  return colliders;
}

export function resolvePlayerCollision(
  nextX: number,
  nextZ: number,
  radius = 0.38,
  diningLevel = 1,
): { x: number; z: number } {
  let x = Math.max(WORLD_BOUNDS.minX + radius, Math.min(WORLD_BOUNDS.maxX - radius, nextX));
  let z = Math.max(WORLD_BOUNDS.minZ + radius, Math.min(WORLD_BOUNDS.maxZ - radius, nextZ));

  const colliders = getStationColliders(diningLevel);
  for (const box of colliders) {
    const closestX = Math.max(box.minX, Math.min(x, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
    const dx = x - closestX;
    const dz = z - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq) || 0.0001;
      const overlap = radius - dist;
      x += (dx / dist) * overlap;
      z += (dz / dist) * overlap;
    }
  }
  return { x, z };
}

const _projVec = new THREE.Vector3();

export function worldToScreen(
  worldPos: { x: number; y?: number; z: number },
  camera: THREE.Camera,
  width: number,
  height: number,
): { x: number; y: number } {
  _projVec.set(worldPos.x, worldPos.y ?? 0, worldPos.z).project(camera);
  return {
    x: ((_projVec.x + 1) / 2) * width,
    y: ((-_projVec.y + 1) / 2) * height,
  };
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: THREE.Camera,
  width: number,
  height: number,
  targetY = 0,
): { x: number; z: number } {
  const ndcX = (screenX / width) * 2 - 1;
  const ndcY = -(screenY / height) * 2 + 1;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -targetY);
  const hit = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, hit);
  return { x: hit.x, z: hit.z };
}

export function calculateDepth(x: number, z: number): number {
  return x + z;
}

export function findNearestInteractable(
  position: { x: number; z: number },
  placements: StationPlacement[] = STATION_PLACEMENTS,
): StationPlacement | null {
  let nearest: StationPlacement | null = null;
  let bestDist = Infinity;

  for (const station of placements) {
    const dx = position.x - station.x;
    const dz = position.z - station.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= station.interactRadius && dist < bestDist) {
      bestDist = dist;
      nearest = station;
    }
  }
  return nearest;
}

export const CAMERA_ZOOM_BOUNDS = {
  min: 0.75,
  max: 1.65,
  default: 1.0,
} as const;

export const CAMERA_ORBIT_BOUNDS = {
  baseYaw: Math.PI / 4,
  minYawOffset: -0.58,
  maxYawOffset: 0.58,
  minPitchOffset: -0.18,
  maxPitchOffset: 0.22,
  planarDist: Math.hypot(14, 14),
  baseHeight: 13.5,
} as const;

export function clampCameraZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return CAMERA_ZOOM_BOUNDS.default;
  return Math.max(CAMERA_ZOOM_BOUNDS.min, Math.min(CAMERA_ZOOM_BOUNDS.max, zoom));
}

export function clampCameraOrbitYaw(yawOffset: number): number {
  if (!Number.isFinite(yawOffset)) return 0;
  return Math.max(
    CAMERA_ORBIT_BOUNDS.minYawOffset,
    Math.min(CAMERA_ORBIT_BOUNDS.maxYawOffset, yawOffset),
  );
}

export function clampCameraPitchOffset(pitchOffset: number): number {
  if (!Number.isFinite(pitchOffset)) return 0;
  return Math.max(
    CAMERA_ORBIT_BOUNDS.minPitchOffset,
    Math.min(CAMERA_ORBIT_BOUNDS.maxPitchOffset, pitchOffset),
  );
}

export function computeCameraOffset(
  yawOffset: number,
  pitchOffset: number,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  const yaw = CAMERA_ORBIT_BOUNDS.baseYaw + clampCameraOrbitYaw(yawOffset);
  const pitch = clampCameraPitchOffset(pitchOffset);
  const planar = CAMERA_ORBIT_BOUNDS.planarDist * (1 - pitch * 0.25);
  const height = CAMERA_ORBIT_BOUNDS.baseHeight * (1 + pitch * 0.42);
  return out.set(Math.cos(yaw) * planar, height, Math.sin(yaw) * planar);
}

