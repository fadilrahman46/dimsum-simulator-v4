import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const PORT = 4185;
const BASE_URL = process.env.QA_TARGET_URL || `http://127.0.0.1:${PORT}`;

function resolveBrowserExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

async function waitForServer(url, serverProc, timeoutMs = 25_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (serverProc && serverProc.exitCode !== null) {
      throw new Error(`Vite server exited prematurely with code ${serverProc.exitCode}`);
    }
    try {
      const res = await fetch(url);
      if (res.ok) {
        const html = await res.text();
        if (html.includes('Dimsum')) return;
      }
    } catch {
      // keep polling until server is ready
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for Vite server at ${url}`);
}

function rectsOverlap(a, b) {
  if (!a || !b) return false;
  return !(a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1);
}

async function isShown(page, testId) {
  return page.getByTestId(testId).isVisible().catch(() => false);
}

async function verifySplitLeftPanels(page, label) {
  const infoToggle = page.getByTestId('info-panel-toggle');
  assert.equal(await infoToggle.getAttribute('aria-pressed'), 'true', `[${label}] Info panel should start ON`);
  assert.ok(await isShown(page, 'info-panel-level'), `[${label}] Info panel must show level strip`);

  // 1. Info panel switches OFF without touching Missions/Goals
  await infoToggle.click();
  await page.waitForTimeout(150);
  assert.equal(await infoToggle.getAttribute('aria-pressed'), 'false');
  assert.equal(await isShown(page, 'info-panel-level'), false, `[${label}] Level strip must hide when Info is OFF`);
  assert.equal(await isShown(page, 'info-panel-events'), false, `[${label}] Event/challenge must hide when Info is OFF`);
  assert.ok(await isShown(page, 'daily-missions-card'), `[${label}] Daily Missions must stay when Info is OFF`);
  assert.ok(await isShown(page, 'daily-goals-card'), `[${label}] Daily Goals must stay when Info is OFF`);

  // 2 & 3. Missions and Goals minimize/expand independently of each other
  for (const [testId, otherId] of [
    ['daily-missions-card', 'daily-goals-card'],
    ['daily-goals-card', 'daily-missions-card'],
  ]) {
    const toggle = page.getByTestId(testId).locator('button[aria-expanded]').first();
    const other = page.getByTestId(otherId).locator('button[aria-expanded]').first();
    const otherBefore = await other.getAttribute('aria-expanded');
    const before = await toggle.getAttribute('aria-expanded');
    const heightBefore = (await page.getByTestId(testId).boundingBox()).height;
    await toggle.click();
    await page.waitForTimeout(150);
    const after = await toggle.getAttribute('aria-expanded');
    const heightAfter = (await page.getByTestId(testId).boundingBox()).height;
    assert.notEqual(after, before, `[${label}] ${testId} must toggle minimize state`);
    assert.ok(
      after === 'false' ? heightAfter < heightBefore : heightAfter > heightBefore,
      `[${label}] ${testId} height must shrink when minimized / grow when expanded (${heightBefore} -> ${heightAfter})`,
    );
    assert.equal(await other.getAttribute('aria-expanded'), otherBefore, `[${label}] ${otherId} must not change`);
    await toggle.click(); // restore
    await page.waitForTimeout(100);
  }

  await infoToggle.click();
  await page.waitForTimeout(150);
  assert.ok(await isShown(page, 'info-panel-level'), `[${label}] Info panel must return when switched ON`);
}

/**
 * Mimics the browser rule that matters: orientation.lock() only succeeds while the page is fullscreen,
 * and requestFullscreen() only succeeds inside a user gesture. Records every call for assertions.
 */
const FULLSCREEN_LOCK_STUB = `
  (() => {
    window.__fsCalls = 0; window.__lockCalls = []; window.__lockOk = 0; let fs = false;
    const gesture = () => navigator.userActivation ? navigator.userActivation.isActive : true;
    Element.prototype.requestFullscreen = function () {
      window.__fsCalls += 1;
      if (!gesture()) return Promise.reject(new Error('NotAllowedError: needs user gesture'));
      fs = true;
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => document.documentElement });
      return Promise.resolve();
    };
    window.screen.orientation.lock = function (mode) {
      window.__lockCalls.push(mode);
      if (!fs) return Promise.reject(new Error('NotSupportedError: lock needs fullscreen'));
      window.__lockOk += 1;
      Object.defineProperty(window.screen.orientation, 'type', { configurable: true, get: () => 'landscape-primary' });
      window.screen.orientation.dispatchEvent(new Event('change'));
      return Promise.resolve();
    };
  })();
`;

/** PWA: manifest + icons valid, service worker caches for offline (production builds), Install App button flows. */
async function verifyPwaInstall(browser, baseUrl) {
  const isViteDev = await fetch(new URL('/@vite/client', baseUrl))
    .then((r) => r.ok)
    .catch(() => false);

  // 1. Manifest and icons
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(baseUrl, { waitUntil: 'load', timeout: 30_000 });
  const manifestInfo = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) return { error: 'missing <link rel="manifest">' };
    const res = await fetch(link.href);
    const manifest = await res.json();
    const icons = [];
    for (const icon of manifest.icons ?? []) {
      const r = await fetch(new URL(icon.src, link.href));
      const blob = await r.blob();
      const bmp = r.ok ? await createImageBitmap(blob) : null;
      icons.push({ src: icon.src, sizes: icon.sizes, purpose: icon.purpose ?? 'any', ok: r.ok, type: blob.type, w: bmp?.width, h: bmp?.height });
    }
    const theme = document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
    const apple = document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href');
    return { manifest, icons, theme, apple, startUrlOk: !!new URL(manifest.start_url, link.href) };
  });
  assert.ok(!manifestInfo.error, manifestInfo.error);
  const m = manifestInfo.manifest;
  assert.ok(m.name && m.short_name, 'Manifest needs name and short_name');
  assert.equal(m.display, 'fullscreen', 'Manifest display must be fullscreen');
  assert.equal(m.orientation, 'landscape', 'Manifest orientation must be landscape');
  assert.ok(m.start_url && m.scope, 'Manifest needs start_url and scope');
  for (const i of manifestInfo.icons) {
    assert.ok(i.ok && i.type === 'image/png', `Icon ${i.src} must load as image/png`);
    assert.equal(`${i.w}x${i.h}`, i.sizes, `Icon ${i.src} declared ${i.sizes} but is ${i.w}x${i.h}`);
  }
  const has = (size, purpose) => manifestInfo.icons.some((i) => i.sizes === size && i.purpose === purpose);
  assert.ok(has('192x192', 'any') && has('512x512', 'any'), 'Manifest needs 192 and 512 "any" icons');
  assert.ok(has('192x192', 'maskable') || has('512x512', 'maskable'), 'Manifest needs a maskable icon');
  assert.ok(manifestInfo.theme && manifestInfo.apple, 'theme-color meta and apple-touch-icon link must exist');

  // 2. Service worker script is served and parses; in production builds it must also take control and serve offline
  const swText = await fetch(new URL('sw.js', baseUrl)).then((r) => r.text());
  assert.doesNotThrow(() => new Function(swText), 'sw.js must be valid JavaScript');
  let swMode = 'script-only (vite dev server does not register the worker)';
  if (!isViteDev) {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({ waitUntil: 'load' }); // reload so the page is controlled and assets get cached
    await page.waitForTimeout(500);
    assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'Service worker must control the page after reload');
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(500);
    await ctx.setOffline(true);
    await page.reload({ waitUntil: 'load', timeout: 20_000 });
    await page.waitForSelector('[data-testid="dimsum-world-canvas"] canvas', { timeout: 20_000 });
    await ctx.setOffline(false);
    swMode = 'registered, controlled, offline reload OK';
  }
  await ctx.close();

  // 3. Install button: hidden until the browser offers installation, then calls prompt(), hides after appinstalled
  const desk = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const dp = await desk.newPage();
  await dp.goto(baseUrl, { waitUntil: 'load', timeout: 30_000 });
  await dp.waitForTimeout(400);
  assert.equal(await isShown(dp, 'install-app-btn'), false, 'Install button must stay hidden when the browser offers no install');
  const prevented = await dp.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    window.__installPromptCalls = 0;
    e.prompt = () => { window.__installPromptCalls += 1; return Promise.resolve(); };
    e.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
    window.dispatchEvent(e);
    return e.defaultPrevented;
  });
  assert.equal(prevented, true, 'beforeinstallprompt must be captured (default mini-infobar suppressed)');
  await dp.waitForSelector('[data-testid="install-app-btn"]', { timeout: 3_000 });
  await dp.getByTestId('install-app-btn').click();
  await dp.waitForTimeout(200);
  assert.equal(await dp.evaluate(() => window.__installPromptCalls), 1, 'Clicking Install App must call the deferred prompt() once');
  await dp.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await dp.waitForTimeout(200);
  assert.equal(await isShown(dp, 'install-app-btn'), false, 'Install button must hide after appinstalled');
  await desk.close();

  // 4. iPhone (no beforeinstallprompt): manual Add to Home Screen steps; standalone launch hides the button
  const iphoneOpts = {
    viewport: { width: 844, height: 390 },
    screen: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  };
  const ios = await browser.newContext(iphoneOpts);
  const ip = await ios.newPage();
  await ip.goto(baseUrl, { waitUntil: 'load', timeout: 30_000 });
  await ip.waitForSelector('[data-testid="install-app-btn"]', { timeout: 15_000 });
  assert.equal(await isShown(ip, 'install-ios-steps'), false, 'iOS steps must be collapsed until requested');
  await ip.getByTestId('install-app-btn').click();
  await ip.waitForSelector('[data-testid="install-ios-steps"]', { timeout: 3_000 });
  assert.match(await ip.getByTestId('install-ios-steps').innerText(), /Layar Utama|Home Screen/, 'iOS steps must mention Home Screen');
  await ios.close();

  const standalone = await browser.newContext(iphoneOpts);
  const sp = await standalone.newPage();
  await sp.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true, configurable: true }));
  await sp.goto(baseUrl, { waitUntil: 'load', timeout: 30_000 });
  await sp.waitForTimeout(500);
  assert.equal(await isShown(sp, 'install-app-btn'), false, 'Install button must hide when already running as an installed app');
  await standalone.close();

  return swMode;
}

/** Smartphone browser: a simple button locks landscape on demand; it hides when it cannot help. */
async function verifyLandscapeLockButton(browser, baseUrl) {
  const phoneOpts = {
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  };

  // A. Portrait phone that chose "Continue in Portrait" still has the button; tap -> fullscreen + landscape lock, button hides
  const ctxA = await browser.newContext(phoneOpts);
  const a = await ctxA.newPage();
  await a.addInitScript(FULLSCREEN_LOCK_STUB);
  await a.goto(baseUrl, { waitUntil: 'load', timeout: 30_000 });
  await a.waitForTimeout(600);
  await a.getByTestId('continue-portrait-btn').tap();
  await a.waitForTimeout(300);
  assert.equal(await isShown(a, 'rotate-to-landscape-overlay'), false, 'Overlay must close after Continue in Portrait');
  assert.ok(await isShown(a, 'landscape-lock-btn'), 'Smartphone browser must show the landscape lock button');
  const box = await a.getByTestId('landscape-lock-btn').boundingBox();
  assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 390 && box.height >= 32, 'Button must sit inside the screen and be tappable');
  // The rotate prompt's silent on-load attempt already tried (and was refused); count only what the tap adds
  const before = await a.evaluate(() => ({ fs: window.__fsCalls, lock: window.__lockCalls.length }));
  await a.getByTestId('landscape-lock-btn').tap();
  await a.waitForTimeout(400);
  const after = await a.evaluate(() => ({ fs: window.__fsCalls, lock: window.__lockCalls.length, ok: window.__lockOk }));
  const calls = { fs: after.fs - before.fs, lock: after.lock - before.lock, ok: after.ok };
  assert.equal(calls.fs, 1, `Button tap must request fullscreen exactly once (got ${calls.fs})`);
  assert.equal(calls.lock, 1, `Button tap must lock landscape exactly once (got ${calls.lock})`);
  assert.equal(calls.ok, 1, 'Landscape lock must succeed after fullscreen');
  assert.equal(await isShown(a, 'landscape-lock-btn'), false, 'Button must hide once landscape fullscreen is active');
  await ctxA.close();

  // B. Browser refuses fullscreen and lock: the button explains why instead of failing silently
  const ctxB = await browser.newContext(phoneOpts);
  const b = await ctxB.newPage();
  await b.addInitScript(`
    Element.prototype.requestFullscreen = () => Promise.reject(new Error('NotAllowedError'));
    window.screen.orientation.lock = () => Promise.reject(new Error('NotSupportedError'));
  `);
  await b.goto(baseUrl, { waitUntil: 'load', timeout: 30_000 });
  await b.waitForTimeout(600);
  await b.getByTestId('continue-portrait-btn').tap();
  await b.getByTestId('landscape-lock-btn').tap();
  await b.waitForSelector('[data-testid="landscape-lock-hint"]', { timeout: 3_000 });
  await ctxB.close();

  // C. iPhone Safari (no fullscreen, no lock API): a button that cannot work must not be offered
  const ctxC = await browser.newContext(phoneOpts);
  const c = await ctxC.newPage();
  await c.addInitScript(`
    Element.prototype.requestFullscreen = undefined;
    window.screen.orientation.lock = undefined;
  `);
  await c.goto(baseUrl, { waitUntil: 'load', timeout: 30_000 });
  await c.waitForTimeout(600);
  assert.equal(await isShown(c, 'landscape-lock-btn'), false, 'No lock button without fullscreen/lock support');
  await ctxC.close();

  // D. Installed app (manifest already forces landscape): no button
  const ctxD = await browser.newContext(phoneOpts);
  const d = await ctxD.newPage();
  await d.addInitScript(FULLSCREEN_LOCK_STUB);
  await d.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true, configurable: true }));
  await d.goto(baseUrl, { waitUntil: 'load', timeout: 30_000 });
  await d.waitForTimeout(600);
  assert.equal(await isShown(d, 'landscape-lock-btn'), false, 'No lock button inside an installed app');
  await ctxD.close();

  // E. Phone already held sideways in a browser tab still gets the button (fullscreen is not active yet)
  const ctxE = await browser.newContext({
    viewport: { width: 844, height: 390 },
    screen: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  const e = await ctxE.newPage();
  await e.addInitScript(FULLSCREEN_LOCK_STUB);
  await e.goto(baseUrl, { waitUntil: 'load', timeout: 30_000 });
  await e.waitForTimeout(600);
  assert.ok(await isShown(e, 'landscape-lock-btn'), 'Landscape phone in a browser tab must show the button until fullscreen');
  const eb = await e.getByTestId('landscape-lock-btn').boundingBox();
  assert.ok(eb && eb.x + eb.width <= 844 && eb.y + eb.height <= 390, 'Button must fit inside the landscape screen');
  await ctxE.close();
}

/** HUD toggles must never throw: regression for "setShowLeftPanel is not defined" on the Compact HUD button. */
async function verifyHudToggles(browser, baseUrl) {
  const profiles = [
    { label: 'phone-landscape', opts: { viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 }, isMobile: true, hasTouch: true } },
    { label: 'desktop', opts: { viewport: { width: 1280, height: 720 } } },
  ];
  for (const { label, opts } of profiles) {
    const ctx = await browser.newContext(opts);
    const pg = await ctx.newPage();
    const pageErrors = [];
    pg.on('pageerror', (err) => pageErrors.push(String(err)));
    await pg.addInitScript(FULLSCREEN_LOCK_STUB);
    await pg.goto(baseUrl, { waitUntil: 'load', timeout: 30_000 });
    await pg.getByRole('button', { name: /Start New Business/i }).click();
    await pg.getByRole('button', { name: /Open Kitchen & Begin Day 1/i }).click();
    await pg.waitForTimeout(800);
    const skip = pg.getByRole('button', { name: /^Skip$/i });
    if (await skip.count()) await skip.first().click();

    const compact = pg.getByRole('button', { name: /Toggle Compact HUD/i });
    const before = await compact.getAttribute('aria-pressed');
    await compact.click();
    await pg.waitForTimeout(250);
    const after = await compact.getAttribute('aria-pressed');
    assert.notEqual(before, after, `[${label}] Compact HUD button must flip its pressed state`);
    await compact.click();
    await pg.waitForTimeout(250);
    assert.equal(await compact.getAttribute('aria-pressed'), before, `[${label}] Compact HUD button must flip back`);

    // Every other always-visible HUD toggle must also respond without throwing
    for (const name of [/Info Panel/i, /Minimize Daily Missions|Expand Daily Missions/i, /Minimize Daily Goals|Expand Daily Goals/i, /Toggle Sound/i]) {
      const el = pg.getByRole('button', { name }).first();
      if (await el.count()) {
        await el.click();
        await pg.waitForTimeout(150);
      }
    }
    assert.deepEqual(pageErrors, [], `[${label}] HUD toggles threw: ${pageErrors.join(' | ')}`);
    await ctx.close();
  }
}

/**
 * Daily Missions dashboard: the modal used to live inside the pointer-events-none HUD, so Close/Claim taps fell
 * through to the canvas, and Escape paused the game instead of closing it. Station modals' Close buttons were
 * also covered by the floating landscape-lock button on phones.
 */
async function verifyMissionsDashboard(browser, baseUrl) {
  const profiles = [
    { label: 'phone-landscape', opts: { viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, phone: true },
    { label: 'desktop', opts: { viewport: { width: 1280, height: 720 } }, phone: false },
  ];
  for (const { label, opts, phone } of profiles) {
    const ctx = await browser.newContext(opts);
    const pg = await ctx.newPage();
    const pageErrors = [];
    pg.on('pageerror', (err) => pageErrors.push(String(err)));
    await pg.addInitScript(FULLSCREEN_LOCK_STUB);
    await pg.goto(baseUrl, { waitUntil: 'load', timeout: 30_000 });
    await pg.getByRole('button', { name: /Start New Business/i }).click();
    await pg.getByRole('button', { name: /Open Kitchen & Begin Day 1/i }).click();
    await pg.waitForTimeout(800);
    const skip = pg.getByRole('button', { name: /^Skip$/i });
    if (await skip.count()) await skip.first().click();

    const dialog = pg.getByRole('dialog', { name: /Daily Missions Dashboard/i });
    // Real pointer events at the element's centre (also proves nothing overlaps it)
    const tapCentre = async (locator) => {
      const box = await locator.boundingBox();
      assert.ok(box, `[${label}] element must be visible`);
      await pg.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await pg.waitForTimeout(250);
    };
    const openDashboard = async () => {
      await pg.getByRole('button', { name: /Open Missions Dashboard/i }).first().click();
      await pg.waitForTimeout(300);
      assert.equal(await dialog.count(), 1, `[${label}] Missions dashboard must open`);
    };

    await openDashboard();
    await tapCentre(dialog.getByRole('button', { name: /^Close$/i }));
    assert.equal(await dialog.count(), 0, `[${label}] Close (X) must close the missions dashboard`);

    await openDashboard();
    await pg.keyboard.press('Escape');
    await pg.waitForTimeout(250);
    assert.equal(await dialog.count(), 0, `[${label}] Escape must close the missions dashboard`);
    assert.equal(
      await pg.getByRole('button', { name: /Resume/i }).count(),
      0,
      `[${label}] Escape on the dashboard must not pause the game`,
    );

    // Station modal Close must not be covered by the floating landscape button
    await pg.getByRole('button', { name: /^Market$/i }).first().click();
    await pg.waitForTimeout(500);
    const closeMarket = pg.getByRole('button', { name: /Close Market/i });
    if (await closeMarket.count()) {
      const hit = await closeMarket.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!top && el.contains(top);
      });
      assert.ok(hit, `[${label}] Close Market must be the element under its own centre point`);
      if (phone) {
        assert.equal(await isShown(pg, 'landscape-lock-btn'), false, 'Landscape button must hide while a station modal is open');
      }
    }
    assert.deepEqual(pageErrors, [], `[${label}] Missions dashboard flow threw: ${pageErrors.join(' | ')}`);
    await ctx.close();
  }
}

/** Smartphone: portrait shows the prompt; the first tap goes fullscreen + landscape lock; opt-out is respected. */
async function verifySmartphoneRotateFlow(browser, baseUrl) {
  const phoneOpts = {
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  };

  // A. Tap anywhere on the prompt -> fullscreen requested, then landscape locked
  const phone = await browser.newContext(phoneOpts);
  const p = await phone.newPage();
  await p.addInitScript(FULLSCREEN_LOCK_STUB);
  await p.goto(baseUrl, { waitUntil: 'load', timeout: 30_000 });
  await p.waitForTimeout(600);
  assert.ok(await isShown(p, 'rotate-to-landscape-overlay'), 'Smartphone portrait must show the rotate prompt');
  const beforeTap = await p.evaluate(() => ({ fs: window.__fsCalls, lockOk: window.__lockOk, lock: window.__lockCalls }));
  assert.equal(beforeTap.fs, 0, 'No fullscreen request without a user gesture');
  assert.equal(beforeTap.lockOk, 0, 'Orientation lock must not succeed before fullscreen');

  await p.getByTestId('rotate-to-landscape-overlay').locator('h2').tap();
  await p.waitForTimeout(400);
  const afterTap = await p.evaluate(() => ({ fs: window.__fsCalls, lockOk: window.__lockOk, lock: window.__lockCalls }));
  assert.ok(afterTap.fs >= 1, 'First tap must request fullscreen');
  assert.ok(afterTap.lockOk >= 1 && afterTap.lock.at(-1) === 'landscape', 'First tap must lock landscape orientation');

  // The device then rotates: prompt disappears and the game is usable
  await p.setViewportSize({ width: 844, height: 390 });
  await p.waitForTimeout(300);
  assert.equal(await isShown(p, 'rotate-to-landscape-overlay'), false, 'Landscape must hide the prompt');
  await phone.close();

  // B. Browser refuses fullscreen (iPhone Safari): manual-rotate hint, never a silent failure
  const iphone = await browser.newContext(phoneOpts);
  const ip = await iphone.newPage();
  await ip.addInitScript(`
    window.__fsCalls = 0;
    Element.prototype.requestFullscreen = undefined;
    window.screen.orientation.lock = undefined;
  `);
  await ip.goto(baseUrl, { waitUntil: 'load', timeout: 30_000 });
  await ip.waitForTimeout(600);
  await ip.getByTestId('rotate-landscape-btn').tap();
  await ip.waitForTimeout(300);
  assert.match(await ip.getByTestId('rotate-to-landscape-overlay').innerText(), /Home Screen|Layar Utama/i);
  await iphone.close();

  // C. "Continue in Portrait" opts out: no fullscreen/lock on this or later taps
  const keep = await browser.newContext(phoneOpts);
  const kp = await keep.newPage();
  await kp.addInitScript(FULLSCREEN_LOCK_STUB);
  await kp.goto(baseUrl, { waitUntil: 'load', timeout: 30_000 });
  await kp.waitForTimeout(600);
  await kp.getByTestId('continue-portrait-btn').tap();
  await kp.waitForTimeout(250);
  assert.equal(await isShown(kp, 'rotate-to-landscape-overlay'), false, 'Continue in Portrait must dismiss the prompt');
  await kp.mouse.click(200, 400);
  await kp.waitForTimeout(250);
  assert.equal(await kp.evaluate(() => window.__fsCalls), 0, 'Opting out of landscape must not trigger fullscreen');
  await keep.close();

  // D. A phone already in landscape still goes fullscreen on its first tap
  const land = await browser.newContext({
    viewport: { width: 844, height: 390 },
    screen: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  const lp = await land.newPage();
  await lp.addInitScript(FULLSCREEN_LOCK_STUB);
  await lp.goto(baseUrl, { waitUntil: 'load', timeout: 30_000 });
  await lp.waitForTimeout(600);
  assert.equal(await isShown(lp, 'rotate-to-landscape-overlay'), false);
  await lp.mouse.click(420, 200);
  await lp.waitForTimeout(250);
  assert.ok((await lp.evaluate(() => window.__fsCalls)) >= 1, 'Landscape smartphone must go fullscreen on first tap');
  await land.close();

  const tablet = await browser.newContext({
    viewport: { width: 768, height: 1024 },
    screen: { width: 768, height: 1024 },
    isMobile: true,
    hasTouch: true,
  });
  const tp = await tablet.newPage();
  await tp.goto(baseUrl, { waitUntil: 'load', timeout: 30_000 });
  await tp.waitForTimeout(600);
  assert.equal(await isShown(tp, 'rotate-to-landscape-overlay'), false, 'Tablet portrait must not show the smartphone rotate prompt');
  await tablet.close();
}

async function auditViewportLayout(page, label, width, height, opts = {}) {
  const { expectRotateOverlay = false, expectJoystick = false } = opts;
  await page.setViewportSize({ width, height });
  await page
    .waitForFunction(
      ({ w, h }) => {
        const c = document.querySelector('[data-testid="dimsum-world-canvas"] canvas');
        if (!c) return false;
        const r = c.getBoundingClientRect();
        return r.width >= w - 2 && r.height >= h - 2;
      },
      { w: width, h: height },
      { timeout: 3_000 },
    )
    .catch(() => {});
  await page.waitForTimeout(250);

  if (expectRotateOverlay) {
    const rotateOverlay = page.getByTestId('rotate-to-landscape-overlay');
    const visible = await rotateOverlay.isVisible().catch(() => false);
    if (visible) {
      await page.getByTestId('continue-portrait-btn').click();
      await page.waitForTimeout(150);
    }
  } else {
    const rotateVisible = await page
      .getByTestId('rotate-to-landscape-overlay')
      .isVisible()
      .catch(() => false);
    assert.equal(rotateVisible, false, `[${label}] Rotate-to-Landscape overlay must hide in non-portrait viewport`);
  }

  const metrics = await page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const docOverflowX = document.documentElement.scrollWidth - vw;
    const canvas = document.querySelector('[data-testid="dimsum-world-canvas"] canvas');
    const canvasRect = canvas ? canvas.getBoundingClientRect() : null;

    const pauseBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      /Menu|Jeda/i.test(b.getAttribute('aria-label') || b.textContent || ''),
    );
    const hidePanelBtn = document.querySelector('[data-testid="info-panel-toggle"]');
    const quickDockBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      /Hide Quick Dock|Show Quick Dock|Pintasan/i.test(b.textContent || ''),
    );
    const zoomBtn = document.querySelector('button[aria-label="Zoom In"], button[aria-label="Perbesar Kamera"]');
    const joyEl = document.querySelector('[data-testid="virtual-joystick"]');
    const quickDock = document.querySelector('[data-testid="quick-station-dock"]');
    const cameraBar = document.querySelector('[data-testid="camera-controls-bar"]');
    const leftScrollBox = document.querySelector('[data-testid="left-panel-stack"]');

    const checkBox = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
        inViewport:
          r.width > 0 &&
          r.height > 0 &&
          r.left >= -2 &&
          r.top >= -2 &&
          r.right <= vw + 2 &&
          r.bottom <= vh + 2,
      };
    };

    return {
      vw,
      vh,
      docOverflowX,
      canvasRect: canvasRect
        ? { width: canvasRect.width, height: canvasRect.height }
        : null,
      pauseBtn: checkBox(pauseBtn),
      hidePanelBtn: checkBox(hidePanelBtn),
      quickDockBtn: checkBox(quickDockBtn),
      zoomBtn: checkBox(zoomBtn),
      joystick: checkBox(joyEl),
      quickDock: checkBox(quickDock),
      cameraBar: checkBox(cameraBar),
      leftScrollBox: checkBox(leftScrollBox),
    };
  });

  assert.ok(metrics.docOverflowX <= 2, `[${label}] Horizontal overflow detected: ${metrics.docOverflowX}px`);
  assert.ok(
    metrics.canvasRect && metrics.canvasRect.width >= width - 2 && metrics.canvasRect.height >= height - 2,
    `[${label}] WebGL canvas should fill viewport, got ${JSON.stringify(metrics.canvasRect)}`,
  );
  assert.ok(metrics.pauseBtn?.inViewport, `[${label}] Pause/Menu button clipped: ${JSON.stringify(metrics.pauseBtn)}`);
  assert.ok(metrics.hidePanelBtn?.inViewport, `[${label}] Info Panel toggle clipped: ${JSON.stringify(metrics.hidePanelBtn)}`);
  assert.ok(metrics.quickDockBtn?.inViewport, `[${label}] Quick Dock toggle clipped: ${JSON.stringify(metrics.quickDockBtn)}`);
  assert.ok(metrics.zoomBtn?.inViewport, `[${label}] 3D Camera Zoom control clipped: ${JSON.stringify(metrics.zoomBtn)}`);

  if (expectJoystick) {
    assert.ok(metrics.joystick?.inViewport, `[${label}] Touch joystick must be visible inside viewport: ${JSON.stringify(metrics.joystick)}`);
    assert.equal(
      rectsOverlap(metrics.joystick, metrics.leftScrollBox),
      false,
      `[${label}] Joystick overlaps Left Panel (${JSON.stringify(metrics.joystick)} vs ${JSON.stringify(metrics.leftScrollBox)})`,
    );
    assert.equal(
      rectsOverlap(metrics.joystick, metrics.quickDock),
      false,
      `[${label}] Joystick overlaps Quick Dock (${JSON.stringify(metrics.joystick)} vs ${JSON.stringify(metrics.quickDock)})`,
    );
  }
  assert.equal(
    rectsOverlap(metrics.cameraBar, metrics.quickDock),
    false,
    `[${label}] Camera bar overlaps Quick Dock (${JSON.stringify(metrics.cameraBar)} vs ${JSON.stringify(metrics.quickDock)})`,
  );

  // Left side = 3 independent panels: Info (on/off), Daily Missions (minimize), Daily Goals (minimize)
  await verifySplitLeftPanels(page, label);

  // Open Market modal at this viewport and assert it stays inside viewport bounds
  await page.getByRole('button', { name: /^Market$/i }).click();
  await page.waitForTimeout(200);
  const modalBox = await page.evaluate(() => {
    const dialog = document.querySelector('h2')?.closest('div[class*="rounded-2xl"]');
    if (!dialog) return null;
    const r = dialog.getBoundingClientRect();
    return {
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
    };
  });
  assert.ok(modalBox, `[${label}] Market modal dialog not found`);
  assert.ok(
    modalBox.left >= -2 && modalBox.top >= -2 && modalBox.right <= width + 2 && modalBox.bottom <= height + 2,
    `[${label}] Modal overflowed viewport ${width}x${height}: ${JSON.stringify(modalBox)}`,
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
}

async function runBrowserQa() {
  let serverProc = null;
  let serverLogs = '';
  if (!process.env.QA_TARGET_URL) {
    serverProc = spawn(
      process.execPath,
      [
        path.resolve('node_modules/vite/bin/vite.js'),
        '--host',
        '127.0.0.1',
        '--port',
        String(PORT),
        '--strictPort',
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, DISABLE_HMR: 'true' },
      },
    );
    serverProc.stdout?.on('data', (chunk) => {
      serverLogs += chunk.toString();
    });
    serverProc.stderr?.on('data', (chunk) => {
      serverLogs += chunk.toString();
    });
    await waitForServer(BASE_URL, serverProc);
  }

  const executablePath = resolveBrowserExecutable();
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  });

  const consoleErrors = [];
  const pageErrors = [];

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!/WebSocket/i.test(text)) {
          consoleErrors.push(text);
        }
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    await page.goto(BASE_URL, { waitUntil: 'load', timeout: 30_000 });
    await page.waitForSelector('[data-testid="dimsum-world-canvas"] canvas', { timeout: 30_000 });
    await page.waitForTimeout(500);

    // 1. Verify WebGL canvas mounted & non-blank rendered screenshot
    const initialStats = await page.evaluate(() => window.__DIMSUM_QA__?.getSceneStats());
    assert.ok(initialStats?.webglActive, 'Three.js WebGL context must be active');
    assert.equal(initialStats.stationCount, 9, 'All 9 3D restaurant stations must mount');

    const canvasShot = await page.locator('[data-testid="dimsum-world-canvas"] canvas').screenshot();
    assert.ok(canvasShot.byteLength > 8_000, '3D canvas screenshot must contain rendered geometry');

    // 1b. Rotate prompt is smartphone-only: a narrowed desktop window must NOT show it
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    assert.equal(
      await page.getByTestId('rotate-to-landscape-overlay').isVisible(),
      false,
      'Narrow desktop window (no touch, large screen) must not show the smartphone rotate prompt',
    );
    assert.equal(
      await page.getByTestId('landscape-lock-btn').isVisible(),
      false,
      'Narrow desktop window must not show the landscape lock button',
    );
    await verifySmartphoneRotateFlow(browser, BASE_URL);
    const pwaMode = await verifyPwaInstall(browser, BASE_URL);
    await verifyLandscapeLockButton(browser, BASE_URL);
    await verifyHudToggles(browser, BASE_URL);
    await verifyMissionsDashboard(browser, BASE_URL);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(200);
    const landscapeTitleCard = await page.evaluate(() => {
      const card = document.querySelector('h1')?.closest('div[class*="rounded-2xl"]');
      if (!card) return null;
      const r = card.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, vh: window.innerHeight };
    });
    assert.ok(
      landscapeTitleCard && landscapeTitleCard.bottom <= landscapeTitleCard.vh + 2,
      `TitleScreen card must fit inside 844x390 landscape viewport without clipping: ${JSON.stringify(landscapeTitleCard)}`,
    );
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(200);

    // 2. Navigate TitleScreen -> BusinessSetupModal -> Gameplay
    await page.getByRole('button', { name: /Start New Business/i }).click();
    await page.waitForSelector('input[type="text"]');
    await page.getByRole('button', { name: /Open Kitchen & Begin Day 1/i }).click();
    await page.waitForTimeout(300);

    const skipBtn = page.getByRole('button', { name: /^Skip$/i });
    if (await skipBtn.isVisible()) {
      await skipBtn.click();
    }
    await page.waitForTimeout(600); // wait for camera settle on player

    // 3. Test 3D Station Click Raycasting on real canvas coordinates
    const stationChecks = [
      { id: 'market', heading: /Ingredient & Packaging Market/i },
      { id: 'prep', heading: /Preparation, Recipe Book & R&D/i },
      { id: 'cashier', heading: /Cashier & Customer Service/i },
      { id: 'board', heading: /Business Report & Facility Upgrades/i },
    ];

    for (const st of stationChecks) {
      const projected = await page.evaluate(
        (stationId) => window.__DIMSUM_QA__?.projectStation(stationId),
        st.id,
      );
      assert.ok(projected && projected.inBounds, `Station ${st.id} must project inside canvas viewport`);

      await page.mouse.move(projected.x, projected.y);
      await page.waitForTimeout(140);
      await page.mouse.click(projected.x, projected.y);
      await page.waitForSelector(`h2`, { timeout: 5_000 });
      const modalText = await page.locator('h2').first().innerText();
      assert.match(modalText, st.heading, `3D click on ${st.id} should open matching modal (got "${modalText}")`);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(180);
    }

    // 4. Test 3D Decoration Upgrade progression via Finance Board -> Equipment Upgrades
    await page.getByRole('button', { name: /^Finance$/i }).click();
    await page.getByRole('button', { name: /Equipment Upgrades/i }).click();
    await page.waitForTimeout(150);

    const statsBeforeUpgrade = await page.evaluate(() => window.__DIMSUM_QA__?.getSceneStats());
    assert.equal(statsBeforeUpgrade.lanternCount, 1);
    assert.equal(statsBeforeUpgrade.plantCount, 1);

    // Purchase Shop Interior & Lanterns Lv 2 (cost Rp80.000, starter cash is Rp100.000)
    await page
      .locator('div.rounded-xl', { hasText: /Shop Interior & Lanterns/i })
      .getByRole('button', { name: /Upgrade/i })
      .click();
    await page.waitForTimeout(250);

    const statsAfterUpgrade = await page.evaluate(() => window.__DIMSUM_QA__?.getSceneStats());
    assert.equal(statsAfterUpgrade.lanternCount, 2, 'Upgrading decor to Lv 2 should add a second 3D lantern');
    assert.equal(statsAfterUpgrade.plantCount, 3, 'Upgrading decor to Lv 2 should add right-wing herbal planters');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);

    // 5. Audit responsive HUD & modal layouts across Mobile Portrait, Mobile Landscape, Tablet, 720p, and 1080p
    const viewports = [
      { label: 'mobile-portrait-360x780', width: 360, height: 780, expectRotateOverlay: false, expectJoystick: true },
      { label: 'mobile-portrait-390x844', width: 390, height: 844, expectRotateOverlay: false, expectJoystick: true },
      { label: 'mobile-landscape-667x375', width: 667, height: 375, expectRotateOverlay: false, expectJoystick: true },
      { label: 'mobile-landscape-844x390', width: 844, height: 390, expectRotateOverlay: false, expectJoystick: true },
      { label: 'tablet-768x1024', width: 768, height: 1024, expectRotateOverlay: false, expectJoystick: false },
      { label: 'desktop-1280x720', width: 1280, height: 720, expectRotateOverlay: false, expectJoystick: false },
      { label: 'desktop-1920x1080', width: 1920, height: 1080, expectRotateOverlay: false, expectJoystick: false },
    ];
    for (const vp of viewports) {
      await auditViewportLayout(page, vp.label, vp.width, vp.height, vp);
    }

    // 6. Verify PauseModal stays within mobile landscape 667x375 bounds
    await page.setViewportSize({ width: 667, height: 375 });
    await page.waitForTimeout(150);
    await page.getByRole('button', { name: /Menu|Jeda/i }).click();
    await page.waitForTimeout(150);
    const pauseBox = await page.evaluate(() => {
      const dialog = document.querySelector('h2')?.closest('div[class*="rounded-2xl"]');
      if (!dialog) return null;
      const r = dialog.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, vh: window.innerHeight };
    });
    assert.ok(
      pauseBox && pauseBox.top >= 0 && pauseBox.bottom <= pauseBox.vh + 2,
      `PauseModal must fit cleanly in 667x375 landscape: ${JSON.stringify(pauseBox)}`,
    );

    assert.deepEqual(pageErrors, [], `Uncaught page errors detected: ${pageErrors.join(' | ')}`);
    assert.deepEqual(consoleErrors, [], `Browser console errors detected: ${consoleErrors.join(' | ')}`);

    console.log(
      JSON.stringify(
        {
          ok: true,
          webglActive: initialStats.webglActive,
          raycastedStations: stationChecks.map((s) => s.id),
          decorUpgradeVerified: {
            before: { lanterns: statsBeforeUpgrade.lanternCount, plants: statsBeforeUpgrade.plantCount },
            after: { lanterns: statsAfterUpgrade.lanternCount, plants: statsAfterUpgrade.plantCount },
          },
          pwa: pwaMode,
          viewportsAudited: viewports.map((v) => v.label),
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
    if (serverProc) {
      serverProc.kill('SIGTERM');
    }
  }
}

runBrowserQa().catch((err) => {
  console.error('Browser QA Suite Failed:', err);
  process.exit(1);
});
