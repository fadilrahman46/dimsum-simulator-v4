# Laporan Pengujian Aplikasi — Dimsumpreneur

**Tanggal Pengujian:** 18 November 2026  
**Versi Engine / Stack:** React 19, TypeScript, Zustand 5, Three.js, Vite 8, Vitest 5.1, `jsdom` 31  
**Bahasa Laporan:** Bahasa Indonesia  

---

## 1. Ringkasan Eksekutif & Metrik Pengujian

Seluruh lapisan pengujian—mulai dari **Unit Test (Domain Engine)**, **Integrasi State Store & Siklus Bisnis E2E (Zustand)**, **UI DOM E2E Interaktif (`jsdom` + React 19 `react-dom/client`)**, **Pemeriksaan Tipe TypeScript (`tsc --noEmit`)**, hingga **Production Build (`vite build`)** dan **HTTP Smoke Check** pada server lokal—telah dijalankan dan selesai dengan tingkat kelulusan **100%**.

| Kategori Pengujian | File / Perintah | Total Kasus Uji | Lulus | Gagal | Tingkat Kelulusan | Durasi | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Unit Test Domain Engine** | `tests/domain.test.ts` | 17 | 17 | 0 | 100% | ~15 ms | **LULUS** |
| **Integrasi Store & Siklus E2E** | `tests/store.e2e.test.ts` | 5 | 5 | 0 | 100% | 42 ms | **LULUS** |
| **UI DOM E2E Interaktif (`jsdom`)** | `tests/ui.e2e.test.tsx` | 7 | 7 | 0 | 100% | 568 ms | **LULUS** |
| **Total Suite Vitest** | `npx vitest run` | **29** | **29** | **0** | **100%** | **2.72 s** | **LULUS** |
| **TypeScript Static Check** | `npm run lint` (`tsc --noEmit`) | — | — | 0 error | 100% | ~4.0 s | **LULUS** |
| **Production Bundle Build** | `compile_applet` (`vite build`) | — | — | 0 error | 100% | ~3.0 s | **LULUS** |
| **Dev Server HTTP Health** | `http://localhost:3000` | 1 | 1 | 0 | 100% | < 0.1 s | **LULUS (`200 OK`)** |

> **Catatan Lingkungan Pengujian UI:** Biner browser headless Chromium/Playwright tidak tersedia di lingkungan kontainer eksekusi. Oleh karena itu, pengujian **UI E2E** dijalankan melalui rendering DOM React 19 nyata di **`jsdom`** (`react-dom/client` + `act`) yang berinteraksi langsung dengan live Zustand store (`useGameStore`), dikombinasikan dengan pengecekan respons HTTP `200 OK` pada port `3000` serta kompilasi TypeScript/Vite penuh untuk modul Three.js 3D.

---

## 2. Matriks Hasil Pengujian per Fitur (14 Area Fitur)

| No | Fitur Aplikasi | Cakupan Pengujian | Hasil & Verifikasi Utama | Status |
| :---: | :--- | :--- | :--- | :---: |
| 1 | **Setup Bisnis & 3 Tingkat Modal** | Domain, Store E2E, UI DOM E2E | Alokasi Easy (`Rp500.000` / kas `Rp100.000`), Medium (`Rp300.000` / kas `Rp60.000`), Hard (`Rp150.000` / kas `Rp30.000`) terhitung presisi; tombol pilihan kesulitan di `BusinessSetupModal` dan pembukaan resep *Vegetarian* terverifikasi. | **LULUS** |
| 2 | **Pasar Bahan & Kulkas FEFO** | Domain, Store E2E, UI DOM E2E | Pemotongan stok bahan sesuai urutan kedaluwarsa terdekat (FEFO), penghitungan HPP lot FIFO, batas kapasitas kulkas, serta audit stok kedaluwarsa saat pergantian hari berjalan akurat. | **LULUS** |
| 3 | **Negosiasi Pemasok & Relasi** | Domain, Store E2E, UI DOM E2E | Syarat minimal grosir `3+` kemasan di `MarketModal`, alur tawar-menawar di `SupplierNegotiationModal`, penerapan diskon pada keranjang, penalti `WALKED_OUT` -> tier `Strained (+10% harga)`, serta pemulihan kepercayaan semalam terverifikasi. | **LULUS** |
| 4 | **Buku Resep, Kompleksitas & Riset R&D** | Domain, Store E2E, UI DOM E2E | Indikator kompleksitas resep & urutkan cepat, tab `Research` di `RecipeBookModal` memotong Rupiah (`Rp30.000`), menurunkan biaya bahan/batch, menaikkan kualitas dasar (`baseQuality`), mempercepat waktu masak, serta pembuatan resep kustom berfungsi penuh. | **LULUS** |
| 5 | **Mini-Game Masak 4 Tahap** | Domain, Store E2E, UI DOM E2E | Alur penuh `PREP` (pilah bahan) → `MIX` (rasio & aduk) → `WRAP` (5 titik lipatan SVG) → `STEAM` (kontrol suhu optimal 93°C–105°C dengan timer) terhubung mulus hingga menghasilkan batch produksi. | **LULUS** |
| 6 | **Quality Control (QC)** | Domain, Store E2E, UI DOM E2E | Rumus berbobot `Q = 0.25R + 0.20M + 0.20W + 0.20S + 0.15H` akurat; batch `QC_PASSED` diteruskan ke pengemasan sedangkan batch `QC_FAILED` dilarang dikemas dan dapat dibuang via `QualityControlModal`. | **LULUS** |
| 7 | **Pengemasan & Penentuan Harga** | Domain, Store E2E, UI DOM E2E | Perhitungan HPP per kotak, markup harga jual, pengurangan stok kotak kemasan (`Paper Box`, `Standard Box`, `Family Box`), dan penambahan stok etalase di `PackagingModal` berjalan normal. | **LULUS** |
| 8 | **Kasir, Layanan Pelanggan & Pre-Order** | Store E2E, UI DOM E2E | Pembukaan toko (`Open Store Now`), simulasi antrean & kesabaran pelanggan, pemenuhan pesanan langsung (`Serve & Collect`), pencatatan struk transaksi & HPP, serta pelunasan pre-order terverifikasi. | **LULUS** |
| 9 | **Popup Feedback & Reputasi Toko** | Domain, Store E2E, UI DOM E2E | `CustomerFeedbackPopups` menampilkan rating bintang 1–5, kutipan umpan balik, perubahan Reputasi Toko, penutupan popup manual, serta penskalaan trafik pelanggan (`-10%` s.d. `+25%`) dari reputasi. | **LULUS** |
| 10 | **Sistem Event Harian** | Domain, Store E2E, UI DOM E2E | Event positif (mis. *Food Critic Visiting* `+20% Rev`, `+1 Rep/sale`) & tantangan negatif (mis. *Steamer Malfunction* `-8 Steam QC`, `-10% Rev`) tampil di `GameHud` & `CashierModal`, memengaruhi hasil aktual, dan tidak berulang berurutan di Hari ke-2. | **LULUS** |
| 11 | **Widget Target Harian & Target Bonus** | Domain, Store E2E, UI DOM E2E | `GameHud` menampilkan progres Target Omzet Harian, batas limbah bahan, dan bonus termasuk pencapaian **Serve 50 Customers (`+Rp25.000`)**, target pelanggan harian (`+Rp10.000`), dan target produksi (`+Rp8.000`) beserta pencairan kas otomatis ke buku kas (`GOAL_BONUS`). | **LULUS** |
| 12 | **Manajemen Staf, Moral & Shift Wellness** | Domain, Store E2E, UI DOM E2E | Rekrut, latih Lv 1–3, pecat staf, dan gaji harian; meter **Employee Morale** turun bertahap saat bekerja tanpa jeda (memperlambat kecepatan & QC) dan pulih dengan **Shift Wellness** (`+15%` instan 1x/hari, `+18%` per batch, `+28%` semalam). | **LULUS** |
| 13 | **Pohon Skill Staf (Skill Tree)** | Domain, Store E2E, UI DOM E2E | 20 node skill (5 node x 4 peran) dengan validasi prasyarat Tier 1 → Tier 2 → Tier 3, latihan berbatas waktu (`Start` / `Cancel` / selesai otomatis via timer) di `StaffSkillTreePanel`, dan efek efisiensi langsung di mini-game memasak. | **LULUS** |
| 14 | **Laporan Keuangan, Upgrade, Simpan & Bangkrut** | Domain, Store E2E, UI DOM E2E | Laporan Laba Rugi (Omzet, HPP, Laba Kotor, OPEX + gaji staf, Laba Bersih), upgrade fasilitas di `FinanceDashboardModal`, pemeriksaan stok di `InventoryModal`, kontrol bahasa EN/ID & audio di `PauseModal`, serta deteksi kebangkrutan (`GameOverModal`). | **LULUS** |

---

## 3. Rincian Suite Pengujian Terotomasi

### A. `tests/domain.test.ts` (17/17 Lulus)
Menguji logika murni matematika ekonomi, inventaris FEFO, QC berbobot, kurva keseimbangan 3 level modal, keuntungan nutrisi/biaya dari seluruh 4 resep riset R&D, target bonus harian & milestone 50 pelanggan, sistem feedback & reputasi, event harian positif/negatif, kelelahan & pemulihan moral staf, mesin negosiasi grosir (diterima, counter-offer, walkout, pemulihan trust), serta prasyarat & agregasi efek 20 node Skill Tree staf.

### B. `tests/store.e2e.test.ts` (5/5 Lulus)
Menguji integrasi lintas-sistem pada Zustand store (`useGameStore`):
1. Inisialisasi kesulitan `easy` / `medium` / `hard` dan pembukaan otomatis konsep `vegetarian`.
2. Pembelian pasar dengan diskon hasil negosiasi grosir (termasuk konsumsi deal setelah checkout) serta penalti harga `+10%` akibat *walkout* pemasok.
3. Pembukaan resep, riset R&D resep, penolakan riset duplikat/terkunci, dan pembuatan resep kustom.
4. Simulasi siklus lengkap **Hari 1 → Hari 2**: rekrut staf, latih Skill Tree, masak 20 pcs (memicu pencairan bonus produksi + penurunan moral → pulihkan dengan shift *Wellness*), buang batch gagal QC, kemas produk, layani 4 pelanggan dengan event *Food Critic* (memicu bonus pelanggan harian, popup feedback, dan kenaikan reputasi), upgrade kukusan, tutup toko (potong OPEX + gaji staf), dan lanjut Hari 2.
5. Pencairan bonus milestone pelanggan ke-50 (`+Rp25.000`) dan transisi status `GAME_OVER` saat modal, bahan, dan produk habis total.

### C. `tests/ui.e2e.test.tsx` (7/7 Lulus)
Menguji interaksi antarmuka pengguna nyata pada DOM React (`jsdom`):
1. `TitleScreen` → `BusinessSetupModal`: klik *Start New Business*, pilih tingkat kesulitan *Medium/Hard/Easy*, dan kirim formulir mulai Hari 1.
2. `GameHud` & `CustomerFeedbackPopups`: verifikasi tampilnya widget *Daily Goals*, *Serve 50 Customers*, banner *Daily Event*, *Shop Rep*, tombol tutup popup umpan balik, serta tombol pintasan *Quick Dock*.
3. `MarketModal` & `SupplierNegotiationModal`: klik `+3` kemasan, buka modal negosiasi, pilih diskon `-5%` dan taktik *Friendly Partnership*, ajukan/terima penawaran, lalu bayar keranjang diskon.
4. `RecipeBookModal`: uji tombol urutkan kompleksitas, buka tab *Research*, jalankan riset `Rp30.000` hingga berstatus *Active Formula*, serta simpan resep kustom.
5. Alur dapur lengkap: `CookingMiniGamesModal` (klik bahan *Prep*, klik aduk *Mix*, klik 20 titik lipatan SVG *Wrap*, percepat timer kukusan *Steam*) → `QualityControlModal` → `PackagingModal` → `CashierModal` (buka toko, layani tamu, cek tab struk).
6. `FinanceDashboardModal` & `StaffSkillTreePanel`: beli upgrade fasilitas, rekrut staf `Rp35.000`, aktifkan *Wellness Shift*, lalu latih node Skill Tree Tier 1 hingga status *Mastered*.
7. `InventoryModal`, `PauseModal` (ganti bahasa EN/ID & mute suara), dan `GameOverModal` (reset game ke menu utama).

---

## 4. Kesimpulan

Seluruh **29 kasus uji otomatis**, **pemeriksaan TypeScript (`tsc --noEmit`)**, **production build (`vite build`)**, dan **pengecekan HTTP server (`localhost:3000`)** dinyatakan **LULUS (100%)** tanpa error. Aplikasi siap digunakan dan seluruh fitur utama maupun fitur perluasan terbaru berjalan konsisten baik di level logika bisnis, store state, maupun antarmuka pengguna.
