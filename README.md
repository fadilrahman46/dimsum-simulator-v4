# Dimsumpreneur — Healthy Dimsum Business Simulator

A cozy 3D isometric culinary business simulator built with React, TypeScript, Three.js, Zustand, Tailwind CSS, and IndexedDB.

## Features
- **3D Isometric Bistro Diorama**: Walk around a 9-zone healthy dimsum shop (`Market Terminal`, `Cold Storage`, `Preparation Table`, `Mixing Station`, `Wrapping Bench`, `Bamboo Steamer`, `Packaging Bench`, `Cashier Counter`, and `Business & Upgrades Board`).
- **4 Interactive Cooking Mini-Games**: Preparation drag-and-drop, Mixing ratio calibration, Artisan dimsum wrapping pleats, and Bamboo steamer heat control.
- **Deterministic Business & Accounting Engine**: Integer Rupiah calculations for HPP, COGS, Gross/Net Profit, Cash Flow, FEFO expiry consumption, FIFO lot valuation, and dynamic daily market events.
- **Quality Control & Packaging**: Weighted QC formula (`Q = 0.25R + 0.20M + 0.20W + 0.20S + 0.15H`), Paper/Standard/Family box packaging, and markup pricing.
- **Live Customers & Pre-Orders**: Five distinct customer archetypes walk into the outlet, queue with patience meters, and rate satisfaction (`CS = 0.35Q + 0.25P + 0.20T + 0.20V`).
- **Bilingual EN / ID & Local Persistence**: Instant English / Bahasa Indonesia toggle, procedural Web Audio SFX, and versioned IndexedDB autosave.

## Controls
- **WASD / Arrow Keys** (or Mobile Virtual Joystick): Move entrepreneur
- **E / Space / Click Station**: Interact with nearest or clicked workstation
- **Esc**: Close active modal or Pause game

## Commands
```bash
npm install
npm run dev              # Start dev server on port 3000
npm run test             # Run Vitest domain & integration tests
npm run test:e2e:browser # Run Chromium Playwright 3D & responsive visual QA
npm run lint             # TypeScript type-check
npm run build            # Production build
```
