# Analisis Kekurangan & Roadmap Pengembangan — Dimsumpreneur

**Tanggal Analisis:** 18 November 2026  
**Cakupan Audit:** Logika domain ekonomi & produksi, state store Zustand, kanvas 3D Three.js, audio-visual, dan UI/UX HUD  
**Bahasa Dokumen:** Bahasa Indonesia  

---

## 1. Posisi Game Saat Ini (Pondasi yang Sudah Solid)

Sebagian masalah struktural pada iterasi awal telah berhasil diperbaiki dan berjalan stabil di build saat ini:

- **Ekonomi & Inventaris:** Sistem lot **FEFO/FIFO** bahan segar, penggabungan sisa potongan antar-batch (`packageRecipeBatchesFEFO`) sehingga tidak ada lagi sisa pcs yatim terbuang paksa, pencatatan tunggakan **OPEX & gaji (`unpaidDebt`)** berbunga 10% semalam beserta batas bangkrut, serta 3 tingkat modal awal (*Easy*, *Medium*, *Hard*).
- **Variasi Mini-Game & Audio-Visual:** Target rasio `Mix` dinamis per resep, 4 pola lipatan `Wrap` (*Crown*, *Crescent*, *Wave*, *Lotus*), simulasi suhu `Steam` mulai 78°C dengan fluktuasi uap (anti-AFK), kontrol kamera 3D (*zoom/orbit/reset*), *thought bubble* pelanggan 3D, BGM pentatonik & efek uap prosedural dengan kontrol volume terpisah, serta HUD adaptif (*Compact HUD*, *Quick Dock toggle*, dan *toggle* sembunyikan/tampilkan Panel Kiri).
- **Sistem Manajerial:** Negosiasi grosir pemasok, R&D formula resep + resep kustom, *Daily Events*, *Daily Goals & Bonus Objectives*, *Customer Feedback & Shop Reputation*, serta *Staff Morale*, *Wellness Shift*, dan *Staff Skill Tree* (20 node berbiaya Rupiah dengan persistensi *save/load*).

---

## 2. Rincian Analisis Kekurangan Saat Ini

| Domain Audit | Kekurangan yang Masih Ada | Dampak ke Pemain |
| :--- | :--- | :--- |
| **Dunia 3D & Staf Dapur** | Staf dapur yang direkrut (*Rina, Budi, Siti, Hendra*) belum muncul sebagai karakter 3D di stasiun dapur masing-masing. | Dapur 3D terasa sepi dan progres rekrutmen staf kurang terasa secara visual. |
| **Otomatisasi *Late-Game*** | Belum ada fitur delegasi produksi otomatis meskipun staf sudah Lv 3 dan Skill Tree penuh. | Setelah Hari ke-5+, pengulangan 4 tahap mini-game secara manual berubah menjadi *grinding*. |
| **Modal 2D vs Kanvas 3D** | Interaksi meja mengunci pergerakan karakter 3D dan mengambil alih layar dengan modal 2D penuh; stok etalase belum terlihat secara visual di kasir 3D. | Imersi ruang restoran 3D terputus selama transaksi dan produksi. |
| **Kesatuan Progresi Staf** | Upgrade level staf (Lv 1–3) berjalan terpisah dari *Skill Tree*; sesi latihan *Skill Tree* berdurasi 4–8 detik masih dapat ditunggu di fase `MORNING_PREP` tanpa batas harian. | Arah investasi SDM terasa terpecah dan kurang memiliki *opportunity cost* waktu operasional. |
| **Manajemen Stok Hampir Basi** | Belum ada fitur diskon penghabisan (*Clearance Sale*) untuk kotak dimsum yang kedaluwarsa di hari berjalan (`expiryDay === currentDay`). | Pemain kesulitan menyelamatkan kas dari stok hari terakhir sebelum hangus menjadi limbah. |
| **Variasi B2B (*Pre-Order*)** | `generateDailyPreOrders()` baru berputar di 2 klien statis (*Kantor Sehat Nusantara* & *Komunitas Yoga Pagi*) dengan harga tetap (`Rp18.500` / `Rp32.000`). | Kurang relevan terhadap fluktuasi HPP/R&D dan kurang menantang di fase menengah. |
| **Konten Menengah & *Endgame*** | `ACHIEVEMENTS` baru berjumlah 5 lencana; resep bawaan baru 4 jenis; `business.level` masih berupa angka abstrak tanpa jenjang skala outlet nyata. | Motivasi jangka panjang melewati Hari ke-10 cepat menurun. |
| **QA Visual Browser Nyata** | Pengujian E2E UI berjalan di `jsdom`; rendering WebGL Three.js, *raycasting* klik 3D, dan responsivitas di rasio layar sempit belum teruji otomatis di browser nyata. | Risiko *regression* visual/interaksi WebGL tidak tertangkap oleh test DOM saja. |

---

## 3. Roadmap Prioritas Pengerjaan & Rekomendasi Fitur Baru (Terpadu)

Berikut rencana pengerjaan terpadu yang menggabungkan perbaikan kekurangan saat ini dengan penambahan fitur baru, diurutkan dari dampak tertinggi (**P0 → P3**):

### Prioritas P0 — Perbaikan Alur Inti & Pengurang *Grinding* (Wajib Pertama)

1. **Penyatuan Progresi Staf & Fitur *Auto-Batch Delegation***
   - **Perbaikan Sistem:** Hubungkan Level Staf (Lv 1–3) sebagai syarat membuka Tier *Skill Tree* (Lv 1 → Tier 1, Lv 2 → Tier 2, Lv 3 → Tier 3) dan batasi kuota sesi *training* per hari kerja.
   - **Fitur Baru:** Tambahkan opsi **"Delegasikan Batch ke Staf"** setelah syarat *Skill Tree* terbuka. Staf memproses batch di latar belakang dengan skor QC otomatis berbasis `(Level Staf + Skill + Employee Morale)`, sehingga pemain bisa fokus pada strategi harga, QC, pasar, dan pelayanan kasir.
2. **Visualisasi Staf Dapur 3D (*Living Kitchen Crew*)**
   - **Fitur Baru:** Render model NPC 3D untuk setiap staf yang direkrut pada stasiun Prep, Mix, Wrap, dan Steam lengkap dengan animasi bekerja saat dapur aktif dan animasi istirahat saat *Wellness Shift*.
3. **Mekanik Diskon Penghabisan (*Clearance Sale*)**
   - **Fitur Baru:** Tambahkan tombol diskon cepat (-25% / -40%) pada kotak dimsum yang akan kedaluwarsa hari ini (`expiryDay === currentDay`) untuk menarik pembeli *budget* (Pelajar/Mahasiswa) dan menekan limbah pangan (*zero-waste*).

---

### Prioritas P1 — Kedalaman Bisnis & Dinamika Jam Operasional (Hari ke-3 s.d. ke-14)

4. **Sistem *Dine-In Seating* & Gelombang *Rush Hour***
   - **Fitur Baru:** Tambah 2–4 meja makan *dine-in* 3D di area outlet yang dapat dibeli dan di-upgrade. Pelanggan *dine-in* membayar margin lebih baik dan memberi bonus *Shop Reputation* lebih tinggi, namun menyita kursi hingga selesai makan dan menuntut kecepatan saji saat gelombang *Rush Hour*.
5. **Papan Kontrak B2B Dinamis & Saluran Pesan-Antar Online (*Omnichannel*)**
   - **Perbaikan & Fitur:** Perluas pre-order menjadi papan kontrak B2B berjenjang (Kampus, Korporat, Kafe Mitra, Komunitas) dengan harga mengikuti HPP dinamis, syarat minimum *Shop Reputation*, batas waktu pengerjaan, dan penalti reputasi jika gagal kirim.
   - **Fitur Baru:** Tambahkan kanal **Aplikasi Pesan-Antar (Ojol)** bervolume tinggi namun mengenakan komisi platform 15–20%, mendorong pemain menyusun strategi harga *omnichannel*.
6. **Ekspansi Katalog Resep (8–10 Resep) & Achievement Bertingkat (25+ Lencana)**
   - **Fitur Baru:** Tambah variasi resep sehat baru (mis. *Dimsum Mentai Rendah Lemak*, *Kuotie Panggang*, *Lumpia Kulit Tahu*, *Bakpao Gandum*) serta 25+ lencana bertingkat (*Zero-Waste Streak*, *R&D Master*, *Bebas Utang*, *Reputasi 95+*).

---

### Prioritas P2 — Siklus Mingguan, Kompetisi & *Endgame* (Retensi Jangka Panjang)

7. **Festival Kuliner Mingguan & Kedai Rival**
   - **Fitur Baru:** Hadirkan siklus mingguan setiap kelipatan 7 hari berupa **Festival Kuliner Tematik** (*Pekan Udang Segar*, *Minggu Plant-Based*, *Bazar Keluarga*) dengan lonjakan trafik 2× untuk menu bertema cocok.
   - **Fitur Baru:** Tambah **Kedai Rival** yang memengaruhi tren selera pasar dan fluktuasi harga bahan, sehingga inovasi R&D dan negosiasi pemasok menjadi penentu daya saing.
8. **Jenjang Skala Usaha & Mode Ekspansi Cabang (*Franchise / Prestige*)**
   - **Fitur Baru:** Wujudkan `business.level` ke jenjang progresi nyata (*Gerobak Rintisan → Kios Ruko → Bistro Sehat → Restoran Utama → Jaringan Waralaba*), lengkap dengan target modal bersih untuk membuka cabang pasif otomatis atau melanjutkan ke *Endless Mastery Mode*.

---

### Prioritas P3 — *Polish* Visual 3D & QA Otomatis

9. **Indikator Stok Etalase 3D & Dekorasi Interaktif**
   - Tampilkan tumpukan kotak dimsum di meja etalase kasir sesuai `totalBoxesReady`, serta perkuat dampak visual dekorasi yang di-upgrade (lampion, papan menu, tanaman herbal) di kanvas 3D.
10. **Suite Uji Visual Browser Nyata (Playwright / Chromium)**
    - Tambahkan skrip pengujian Chromium/Playwright untuk memvalidasi konteks WebGL Three.js, akurasi *raycasting* klik stasiun 3D, dan ketahanan layout HUD di berbagai ukuran layar (mobile, tablet, desktop 720p/1080p).

---

## 4. Ringkasan Urutan Eksekusi

| Tahap | Paket Pekerjaan | Fokus Utama |
| :---: | :--- | :--- |
| **Tahap 1** | **Paket P0** | Penyatuan *Skill Tree* + *Auto-Batch Delegation*, NPC Staf 3D, *Clearance Sale* |
| **Tahap 2** | **Paket P1** | *Dine-In Seating* + *Rush Hour*, Papan Kontrak B2B + Kanal Online, 8–10 Resep & 25+ Achievement |
| **Tahap 3** | **Paket P2** | Festival Kuliner Mingguan, Kedai Rival, Jenjang *Franchise / Endgame* |
| **Tahap 4** | **Paket P3** | Stok Etalase 3D & Uji E2E Browser Nyata (Playwright) |
