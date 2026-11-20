import type { Language, StationId, TutorialStep } from '../types/game';

export const STATION_META: Record<
  StationId,
  { nameEn: string; nameId: string; actionEn: string; actionId: string }
> = {
  market: {
    nameEn: 'Market Terminal',
    nameId: 'Terminal Pasar',
    actionEn: 'Buy Ingredients & Boxes',
    actionId: 'Belanja Bahan & Kemasan',
  },
  storage: {
    nameEn: 'Cold Storage',
    nameId: 'Kulkas Bahan',
    actionEn: 'Inspect Stock & Expiry',
    actionId: 'Cek Stok & Kedaluwarsa',
  },
  prep: {
    nameEn: 'Preparation Table',
    nameId: 'Meja Persiapan',
    actionEn: 'Choose Recipe & Cook',
    actionId: 'Pilih Resep & Masak',
  },
  mixing: {
    nameEn: 'Mixing Station',
    nameId: 'Stasiun Pencampuran',
    actionEn: 'Continue Mixing',
    actionId: 'Lanjut Mencampur',
  },
  wrapping: {
    nameEn: 'Wrapping Bench',
    nameId: 'Meja Pembentukan',
    actionEn: 'Continue Wrapping',
    actionId: 'Lanjut Membentuk',
  },
  steamer: {
    nameEn: 'Bamboo Steamer',
    nameId: 'Kukusan Bambu',
    actionEn: 'Steam & Quality Control',
    actionId: 'Kukus & Cek Kualitas',
  },
  packaging: {
    nameEn: 'Packaging Bench',
    nameId: 'Meja Pengemasan',
    actionEn: 'Pack QC-Passed Dimsum',
    actionId: 'Kemas Dimsum Lolos QC',
  },
  cashier: {
    nameEn: 'Cashier Counter',
    nameId: 'Meja Kasir',
    actionEn: 'Open Store & Serve',
    actionId: 'Buka Toko & Layani',
  },
  board: {
    nameEn: 'Business & Upgrades',
    nameId: 'Laporan & Upgrade',
    actionEn: 'Finance & Facility Upgrades',
    actionId: 'Keuangan & Upgrade',
  },
};

export const TUTORIAL_LABELS: Record<TutorialStep, { en: string; id: string }> = {
  NONE: { en: '', id: '' },
  BUY_INGREDIENTS: {
    en: 'Step 1: Visit the Market Terminal (or click Market) to check prices or buy fresh ingredients.',
    id: 'Langkah 1: Kunjungi Terminal Pasar untuk melihat harga atau belanja bahan segar.',
  },
  COOK_BATCH: {
    en: 'Step 2: Walk to the Preparation Table to select a recipe and complete the 4 cooking mini-games.',
    id: 'Langkah 2: Ke Meja Persiapan untuk memilih resep dan menyelesaikan 4 mini-game memasak.',
  },
  CHECK_QC: {
    en: 'Step 3: Review your batch Quality Control score at the Steamer Station.',
    id: 'Langkah 3: Periksa skor Quality Control (QC) hasil masakmu.',
  },
  PACKAGE_DIMSUM: {
    en: 'Step 4: Go to the Packaging Bench to pack QC-passed dimsum and set your selling price.',
    id: 'Langkah 4: Ke Meja Pengemasan untuk mengemas dimsum lolos QC dan atur harga jual.',
  },
  OPEN_STORE: {
    en: 'Step 5: Walk to the Cashier Counter and open your outlet for customers!',
    id: 'Langkah 5: Ke Meja Kasir dan buka outlet untuk menyambut pelanggan!',
  },
  SERVE_CUSTOMER: {
    en: 'Step 6: Serve arriving customers at the Cashier Counter before their patience runs out.',
    id: 'Langkah 6: Layani pelanggan di Meja Kasir sebelum kesabarannya habis.',
  },
  VIEW_REPORT: {
    en: 'Step 7: Close the store when finished and inspect your Daily Financial Report.',
    id: 'Langkah 7: Tutup toko saat selesai dan periksa Laporan Keuangan Harian.',
  },
  COMPLETED: {
    en: 'Day 1 guide complete! Keep growing your healthy dimsum brand.',
    id: 'Panduan Hari 1 selesai! Terus kembangkan bisnis dimsum sehatmu.',
  },
};

export function t(lang: Language, en: string, id: string): string {
  return lang === 'id' ? id : en;
}

const QUALITY_CATEGORY_ID: Record<string, string> = {
  Excellent: 'Sempurna',
  'Very Good': 'Sangat Baik',
  Good: 'Baik',
  Average: 'Cukup',
  Poor: 'Kurang',
};

export function translateQualityCategory(lang: Language, category: string): string {
  if (lang === 'en') return category;
  return QUALITY_CATEGORY_ID[category] ?? category;
}

const STAGE_LABELS: Record<string, { en: string; id: string }> = {
  PREP: { en: 'Prep', id: 'Siapkan' },
  MIX: { en: 'Mix', id: 'Campur' },
  WRAP: { en: 'Wrap', id: 'Bentuk' },
  STEAM: { en: 'Steam', id: 'Kukus' },
};

export function translateStageLabel(lang: Language, stage: string): string {
  const entry = STAGE_LABELS[stage.toUpperCase()];
  if (!entry) return stage;
  return lang === 'id' ? entry.id : entry.en;
}

