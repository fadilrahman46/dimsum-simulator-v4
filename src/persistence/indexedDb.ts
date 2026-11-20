import {
  INITIAL_RECIPES,
  SAVE_SCHEMA_VERSION,
  createDefaultUpgrades,
  createInitialRivalShop,
  getWeeklyFestivalForDay,
} from '../config/gameBalance';
import { generateDailyMissions } from '../domain/dailyMissionsEngine';
import type { SaveSnapshot } from '../types/game';

const DB_NAME = 'dimsumpreneur_db';
const DB_VERSION = 1;
const STORE_NAME = 'saves';
const PRIMARY_SLOT_KEY = 'active_save';
const FALLBACK_LS_KEY = 'dimsumpreneur_fallback_save_v1';
let memoryFallbackPayload: string | null = null;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

export function migrateSaveSnapshot(raw: unknown): SaveSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<SaveSnapshot>;
  if (!candidate.business || typeof candidate.cashBalance !== 'number') {
    return null;
  }
  if ((candidate.version ?? 0) > SAVE_SCHEMA_VERSION) {
    return null;
  }
  return {
    ...(candidate as SaveSnapshot),
    upgrades: {
      ...createDefaultUpgrades(),
      ...(candidate.upgrades ?? {}),
    },
    onlineOrders: Array.isArray(candidate.onlineOrders) ? candidate.onlineOrders : [],
    onlineDeliveryEnabled:
      typeof candidate.onlineDeliveryEnabled === 'boolean'
        ? candidate.onlineDeliveryEnabled
        : true,
    zeroWasteStreakDays:
      typeof candidate.zeroWasteStreakDays === 'number'
        ? candidate.zeroWasteStreakDays
        : 0,
    activeFestival:
      candidate.activeFestival !== undefined
        ? candidate.activeFestival
        : getWeeklyFestivalForDay(candidate.currentDay ?? 1),
    rivalShop: candidate.rivalShop ?? createInitialRivalShop(),
    franchiseBranches: Array.isArray(candidate.franchiseBranches)
      ? candidate.franchiseBranches
      : [],
    endlessMasteryUnlocked: Boolean(candidate.endlessMasteryUnlocked),
    prestigeLevel:
      typeof candidate.prestigeLevel === 'number' ? candidate.prestigeLevel : 0,
    dailyMissions:
      Array.isArray(candidate.dailyMissions) && candidate.dailyMissions.length > 0
        ? candidate.dailyMissions
        : generateDailyMissions({
            day: candidate.currentDay ?? 1,
            businessLevel: candidate.business.level ?? 1,
            recipes:
              Array.isArray(candidate.recipes) && candidate.recipes.length > 0
                ? candidate.recipes
                : INITIAL_RECIPES,
            upgrades: {
              ...createDefaultUpgrades(),
              ...(candidate.upgrades ?? {}),
            },
          }),
    bgmVolume:
      typeof candidate.bgmVolume === 'number'
        ? Math.max(0, Math.min(1, candidate.bgmVolume))
        : 0.45,
    sfxVolume:
      typeof candidate.sfxVolume === 'number'
        ? Math.max(0, Math.min(1, candidate.sfxVolume))
        : 0.75,
    version: SAVE_SCHEMA_VERSION,
  };
}

export async function saveGameSnapshot(snapshot: SaveSnapshot): Promise<void> {
  const payload: SaveSnapshot = {
    ...snapshot,
    version: SAVE_SCHEMA_VERSION,
    savedAt: Date.now(),
  };

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(payload, PRIMARY_SLOT_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('IndexedDB write failed'));
      };
    });
  } catch {
    const serialized = JSON.stringify(payload);
    // Graceful localStorage fallback if IndexedDB is blocked in restricted context
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(FALLBACK_LS_KEY, serialized);
      } else {
        memoryFallbackPayload = serialized;
      }
    } catch {
      memoryFallbackPayload = serialized;
    }
  }
}

export async function loadGameSnapshot(): Promise<SaveSnapshot | null> {
  try {
    const db = await openDatabase();
    const result = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(PRIMARY_SLOT_KEY);
      req.onsuccess = () => {
        db.close();
        resolve(req.result ?? null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error ?? new Error('IndexedDB read failed'));
      };
    });
    const migrated = migrateSaveSnapshot(result);
    if (migrated) return migrated;
  } catch {
    // Try localStorage / memory fallback
  }

  try {
    const raw =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(FALLBACK_LS_KEY)
        : memoryFallbackPayload;
    if (!raw) return null;
    return migrateSaveSnapshot(JSON.parse(raw));
  } catch {
    return memoryFallbackPayload ? migrateSaveSnapshot(JSON.parse(memoryFallbackPayload)) : null;
  }
}

export async function deleteGameSnapshot(): Promise<void> {
  memoryFallbackPayload = null;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(PRIMARY_SLOT_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // ignore
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(FALLBACK_LS_KEY);
    }
  } catch {
    // ignore
  }
}
