# Tinjauan Publisher & Rekomendasi Pengembangan — Dimsumpreneur

**Tanggal Tinjauan:** 18 November 2026  
**Perspektif Evaluasi:** Game Publisher (Product, Game Design, Ekonomi, UX & Retensi)  
**Basis Audit:** Seluruh sistem permainan, kalkulasi ekonomi, mini-game, UI/UX, audio-visual 3D, dan persistensi data  
**Bahasa Dokumen:** Bahasa Indonesia  

---

## 1. Ringkasan Eksekutif Publisher (Market Fit & Pondasi)

Secara konsep, **Dimsumpreneur** memiliki *unique selling proposition (USP)* yang sangat kuat di segmen *Cozy Tycoon / Educational Business Sim*:

- **Simulasi Bisnis yang Autentik:** Mekanik *FEFO (First Expired, First Out)* untuk bahan segar, penghitungan HPP/COGS per lot dan per batch, markup harga jual dinamis, negosiasi grosir dengan pemasok, hingga laporan Laba Rugi (P&L) harian memberikan kedalaman manajerial nyata—bukan sekadar game kasir klik cepat.
- **Sistem Operasional yang Saling Terkait:** Kehadiran *Daily Goals*, *Daily Events*, *Customer Feedback & Shop Reputation*, *Employee Morale & Wellness Shifts*, serta *Staff Skill Tree* membentuk *gameplay loop* harian yang kaya pilihan strategis dan sudah terverifikasi stabilitas teknisnya.

Namun, dari sudut pandang **Publisher** yang mengevaluasi daya tarik komersial, kualitas *game feel*, keseimbangan ekonomi, serta retensi pemain melewati Hari ke-7+, terdapat sejumlah kekurangan struktural yang perlu segera diperbaiki sebelum perilisan luas.

---

## 2. Review Kekurangan Game (Berdasarkan Audit Sistem)

| Domain Audit | Temuan Kekurangan Utama | Dampak terhadap Pengalaman Pemain |
| :--- | :--- | :--- |
| **Dunia 3D & Core Loop** | Kanvas 3D hanya berfungsi sebagai *lobby/launcher* menuju modal 2D layar penuh; staf dapur tidak muncul di 3D. | Imersi terputus; dapur terasa sepi dan progres rekrutmen staf tidak terasa secara visual. |
| **Kelelahan Klik (Late-Game)** | Belum ada otomatisasi/delegasi masak batch meskipun staf sudah Lv 3 & Skill Tree penuh. | Setelah Hari ke-5+, mengulang mini-game identik puluhan kali berubah menjadi *grinding* melelahkan. |
| **Ekonomi Kemasan (Batch vs Box)** | Produksi resep tetap **10 pcs/batch**, sementara kotak kemasan **4 / 8 / 16 pcs** (minimal stok kemas 4 pcs). | Mengemas 1× kotak isi 8 (atau 2× isi 4) selalu menyisakan **2 pcs yatim** yang tidak bisa dikemas dari batch tunggal. |
| **Celah OPEX & Gaji Kas Rp0** | Pemotongan OPEX harian & gaji staf dibatasi `Math.min(cashBalance, ...)`. | Pemain bisa menghabiskan kas hingga Rp0 sebelum tutup toko untuk lolos dari sewa dan gaji tanpa utang/penalti. |
| **Eksploitasi Staff Skill Tree** | Training Skill Tree berbiaya **Rp0**, tanpa konsumsi moral/energi, dan selesai via timer 4–8 detik saat toko belum buka (`MORNING_PREP`). | Seluruh Skill Tree bisa dibuka penuh secara gratis di Hari ke-1 sebelum melayani satu pelanggan pun; progres latihan aktif juga belum tersimpan di *Save*. |
| **Sistem Staf Terpecah Dua** | Upgrade level staf lama (bayar uang untuk bonus QC datar) terpisah dari Skill Tree baru (gratis timer untuk bonus efisiensi mini-game). | Pemain bingung menentukan prioritas investasi SDM dan tidak ada kesatuan progresi karier staf. |
| **Kedalaman Mini-Game** | *Mix* selalu memakai target rasio statis (`55% / 30%`) untuk semua resep; *Steam* mulai di `98°C` api medium sehingga bisa lulus AFK; *Wrap* mengulang 5 titik lipatan identik. | *Skill ceiling* rendah; pemain cepat bosan karena tidak ada adaptasi strategi per menu dimsum. |
| **Pre-Order & Achievement** | Pre-order harian hanya berputar di 2 klien statis (*Kantor Sehat Nusantara* & *Komunitas Yoga Pagi*) dengan harga tetap; Achievement baru 5 buah. | Kurang tantangan jangka menengah dan kurang memberi penghargaan atas peningkatan R&D maupun reputasi tinggi. |
| **HUD, Lokalisasi & Audio** | Pojok kiri-atas dan kanan-atas HUD padat menumpuk di layar kecil/720p; masih ada teks Inggris di mode Indonesia (`Excellent/Very Good/Poor`, `COGS`, `Tahap: PREP`, `Recipe (R)`); belum ada musik latar (BGM) & suara ambience dapur. | Menurunkan kesan *polish* komersial, berisiko menutupi ruang 3D di layar kecil, dan atmosfer *cozy* belum terbangun maksimal. |

### Rincian Analisis Kekurangan

#### A. Diskoneksi Dunia 3D dengan Gameplay (Modal-Heavy Syndrome)
1. **Karakter Terkunci Saat Aktivitas Inti:** Begitu pemain berinteraksi dengan meja mana pun, pergerakan 3D langsung dikunci dan layar diambil alih oleh modal 2D penuh (Pasar, Masak, QC, Kemas, Kasir). Akibatnya, lingkungan restoran 3D yang sudah dibangun kurang berperan aktif selama jam operasional.
2. **Staf Dapur Tidak Hadir Secara Visual:** Meskipun pemain dapat merekrut beberapa staf dapur dengan peran berbeda, mereka hanya eksis sebagai data teks dan avatar UI—tidak ada NPC staf yang berdiri atau bekerja di kompor/meja persiapan 3D.
3. **Absennya Otomatisasi di Tahap Lanjut:** Tidak adanya fitur delegasi produksi membuat kepemilikan staf kurang memberikan kelegaan operasional saat volume pesanan melonjak.

#### B. Celah Keseimbangan Ekonomi & Sistem Progresi
1. **Jebakan Sisa 2 Pcs ("Packaging Remainder Trap"):** Rasio 10 pcs/batch berbenturan langsung dengan kemasan 4, 8, dan 16 pcs serta filter UI yang mensyaratkan stok minimal 4 pcs. Ini memicu pemborosan tersembunyi (*forced waste*) yang terasa tidak adil bagi pemain yang sudah berhitung HPP dengan teliti.
2. **Penghindaran Beban Tetap (*Zero-Cost OPEX Escape*):** Karena sistem tidak mencatat utang usaha saat kas tidak mencukupi biaya OPEX dan gaji, manajemen arus kas kehilangan ketegangan riilnya ketika kas mepet.
3. **Ketimpangan Ekonomi Skill Tree:** Karena biaya Rp0 dan waktu tunggu sangat singkat berbasis jam dinding saat fase persiapan pagi, tidak ada *opportunity cost* dalam melatih staf. Selain itu, status `activeSkillTraining` tidak ikut masuk dalam *SaveSnapshot*, sehingga latihan yang sedang berjalan hilang jika pemain memuat ulang permainan.

#### C. Variasi Mini-Game & Konten Menengah
1. **Resep Berbeda, Tantangan Masak Sama:** Memasak Hakau Udang, Tahu Kukus, Vegetarian, atau resep kustom R&D menghasilkan pengalaman mini-game *Mix* dan *Wrap* yang persis sama.
2. **Kontrol Panas Kukusan Kurang Menuntut Interaksi:** Posisi awal suhu `98°C` pada api `Medium` terlalu nyaman sehingga tahap *Steam* tidak menguji refleks manajemen panas pemain.
3. **Klien Pre-Order & Target Jangka Panjang Terbatas:** Tanpa variasi klien B2B yang terikat level reputasi dan tanpa daftar achievement bertingkat (mis. 20–30 lencana), motivasi bermain setelah Hari ke-10 cepat menurun.

#### D. UI/UX, Lokalisasi & Audio-Visual
1. **Kepadatan HUD:** Tumpukan *Business Strip*, *Daily Event Banner*, *Daily Goals*, banner tutorial, notifikasi *toast*, dan *Customer Feedback Popups* berisiko menyempitkan bidang pandang di resolusi 720p maupun perangkat mobile.
2. **Ketidakkonsistenan Bahasa:** Kebocoran istilah teknis bahasa Inggris di mode Bahasa Indonesia memecah imersi sebagai game lokal/regional yang rapi.
3. **Soundscape Terbatas:** Efek synthesizer sederhana tanpa BGM lo-fi/oriental dan tanpa suara lingkungan dapur (uap kukusan, bel kasir, riuh ringan pengunjung) membuat sesi bermain terasa terlalu hening.

---

## 3. Roadmap Perbaikan Prioritas (Fix & Polish)

| Prioritas | Fokus Perbaikan | Langkah Eksekusi Konkret | Hasil yang Diharapkan |
| :---: | :--- | :--- | :--- |
| **P0** | **Selaraskan Batch vs Kemasan** | Ubah hasil standar menjadi **12 pcs/batch** (habis dibagi 4/6/12) atau tambahkan **Snack Pack 2 pcs** / izinkan penggabungan sisa batch segar di hari yang sama. | Nol pcs terbuang secara paksa; kalkulasi margin lebih adil. |
| **P0** | **Tutup Celah OPEX Kas Rp0** | Catat kekurangan sewa/gaji sebagai **Tunggakan/Utang Usaha** berbunga ringan dan turunkan **Employee Morale** drastis bila gaji tertunda. | Risiko kebangkrutan & manajemen kas menjadi otentik. |
| **P0** | **Seimbangkan & Satukan Skill Tree** | Gabungkan progresi training uang dengan Skill Tree; beri biaya pelatihan + konsumsi moral atau batas **1 sesi training per hari kerja**, serta simpan `activeSkillTraining` ke *SaveSnapshot*. | Tidak bisa di-*farm* gratis di Hari 1; progres *save/load* aman 100%. |
| **P1** | **Dinamiskan 3 Mini-Game Utama** | **Mix:** target rasio unik per kategori resep.<br>**Steam:** mulai di ~78°C + fluktuasi uap acak agar tak bisa AFK.<br>**Wrap:** variasi pola lipatan sesuai jenis dimsum. | Setiap resep memberi sensasi memasak berbeda dan menguji ketangkasan. |
| **P1** | **Audit Lokalisasi 100% & HUD Adaptif** | Terjemahkan seluruh label tersisa (`Sempurna/Sangat Baik/Kurang`, `HPP`, label fase masak lokal); sediakan tombol *collapse/minimize* untuk *Daily Goals* & *Daily Event*. | Tampilan bersih di semua ukuran layar dan konsisten dalam EN/ID. |
| **P2** | **Soundscape & Kamera 3D** | Tambahkan BGM *cozy* yang dapat diatur volumenya terpisah dari SFX, suara desis kukusan & bel toko, *thought bubble* di atas pelanggan 3D, serta kontrol *zoom/orbit* ringan. | *Game feel* jauh lebih hangat, hidup, dan siap *showcase*. |

---

## 4. Rekomendasi Fitur Baru untuk Menyempurnakan Game (Expansion Pitch)

Untuk menaikkan kelas **Dimsumpreneur** dari prototipe simulasi yang solid menjadi produk komersial dengan retensi tinggi, berikut enam fitur strategis yang direkomendasikan:

### 1. Visual Kitchen Crew & Fitur *"Auto-Batch Delegation"*
- **Konsep:** Staf yang direkrut benar-benar muncul sebagai karakter 3D di area persiapan, pengadonan, dan kukusan.
- **Mekanik:** Setelah membuka node kunci di *Skill Tree*, pemain mendapat opsi **"Delegasikan Batch ke Staf"**. Staf akan memproses batch secara otomatis di latar belakang dengan skor kualitas yang dihitung dari `(Skill Level + Employee Morale)`, sementara pemain fokus mengawasi QC, penentuan harga, kasir, dan strategi pasar.
- **Nilai Publisher:** Menghilangkan kejenuhan klik berulang di *late-game* dan memberi penghargaan nyata atas investasi SDM.

### 2. Sistem *Dine-In Seating* & Jam Sibuk Dinamis (*Rush Hour*)
- **Konsep:** Tambah 2–4 meja makan di dalam/teras kedai yang dapat dibeli dan di-upgrade selain antrean *take-away*.
- **Mekanik:** Pelanggan *dine-in* bersedia membayar lebih mahal dan memberi lonjakan *Shop Reputation* lebih besar, namun membutuhkan manajemen kursi kosong, kecepatan saji hangat, dan ritme *Rush Hour* makan siang/malam.
- **Nilai Publisher:** Memberi alasan kuat bagi kanvas 3D untuk tampil lebih hidup dan memperkaya alur keputusan selama jam buka toko.

### 3. Saluran Pesan-Antar Online & Kontrak Katering B2B Berjenjang
- **Konsep:** Ekspansi saluran pendapatan di luar pelanggan *walk-in*.
- **Mekanik:**
  - **Aplikasi Pesan-Antar (Ojol):** Permintaan tinggi sepanjang hari, tetapi mengenakan komisi platform 15–20% sehingga memaksa pemain menghitung ulang strategi harga jual agar tidak rugi HPP.
  - **Kontrak Katering Mingguan:** Variasi klien (kantor korporat, kampus, komunitas, kafe mitra) dengan syarat minimum *Shop Reputation* dan bonus besar jika seluruh pengiriman tepat waktu.
- **Nilai Publisher:** Memperdalam aspek edukasi bisnis modern (*omnichannel margin*) dan memberi tujuan jangka menengah.

### 4. Festival Kuliner Akhir Pekan & Kedai Rival AI
- **Konsep:** Dinamika ekosistem luar toko agar ekonomi tidak terasa berjalan di ruang hampa.
- **Mekanik:**
  - Setiap hari ke-7, 14, 21 hadir **Festival Kuliner Tematik** (misal *Minggu Vegetarian*, *Festival Pedas*, *Pekan Udang Segar*) dengan lonjakan omzet 2× lipat untuk menu bertema cocok.
  - Kehadiran **Kedai Rival** yang ikut memengaruhi tren harga atau preferensi pelanggan, mendorong pemain berinovasi lewat tab *Research (R&D)* dan negosiasi aktif dengan pemasok.
- **Nilai Publisher:** Menciptakan ritme mingguan (*weekly cadence*) yang membuat pemain selalu punya alasan menanti hari berikutnya.

### 5. Kustomisasi Dekorasi & Upgrade Stasiun 3D Berdampak Nyata
- **Konsep:** Item progresi toko yang terlihat langsung di dunia 3D dan memberi bonus pasif terukur.
- **Mekanik:** Lampion gantung untuk menarik trafik pelanggan, papan menu neon untuk menaikkan batas toleransi harga, kukusan bambu tingkat 3 untuk memperbesar kapasitas produksi, serta kulkas kaca untuk memperpanjang masa simpan bahan.
- **Nilai Publisher:** Kepuasan visual (*tangible progression*) yang sangat kuat bagi pemain genre *tycoon*.

### 6. Target *Endgame* Berjenjang & Mode Ekspansi Cabang (*Franchise / Prestige*)
- **Konsep:** Struktur tujuan jangka panjang agar game terasa memiliki "puncak" yang memuaskan.
- **Mekanik:** Peta pencapaian skala usaha (*Gerobak Rintisan → Kios Ruko → Restoran Utama → Jaringan Waralaba*). Setelah mencapai target modal bersih dan reputasi tertentu, pemain dapat membuka cabang pasif dengan manajer otomatis atau melanjutkan ke *Endless Mastery Mode* lengkap dengan 25–30 Achievement serta papan rekor efisiensi bisnis.
- **Nilai Publisher:** Memberikan kepuasan tamat (*closure*) sekaligus nilai main ulang (*replayability*) jangka panjang.

---

## 5. Penutup & Langkah Selanjutnya yang Disarankan

Pondasi **Dimsumpreneur** sudah sangat layak jual dari sisi akurasi logika bisnis dan kestabilan teknis. Eksekusi **Prioritas P0** (penyelarasan batch-kemasan, penutupan celah OPEX kas Rp0, serta penyeimbangan & persistensi *Skill Tree*) akan langsung memulihkan integritas ekonomi permainan, sementara implementasi **Prioritas P1** dan fitur **Auto-Batch Delegation / Dine-In** akan mengangkat pengalaman bermain ke level game indie komersial siap rilis.
