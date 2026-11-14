// Shared set-up: every test run sees the same clock, time zone, language and screen,
// so two runs of the same app give identical pictures.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
export const { chromium } = require('playwright');
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TODAY = '2026-11-10T09:00:00';          // a Tuesday
export const VIEWPORTS = { phone: { width: 390, height: 844 }, desktop: { width: 1100, height: 900 } };

export function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures', name + '.json'), 'utf8'));
}

// Open one app ('base': the baseline version, or 'new': the current build) with the given stored data (key -> string).
export async function openApp(browser, base, target, { store = {}, viewport = 'phone', scale = null, bypassCSP = false } = {}) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS[viewport] || viewport, deviceScaleFactor: 1, bypassCSP,
    timezoneId: 'Asia/Bangkok', locale: 'en-GB', serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(({ store, scale }) => {
    try {
      if (!sessionStorage.getItem('__seeded')) {
        localStorage.clear();
        for (const k in store) localStorage.setItem(k, store[k]);
        if (scale) { const th = JSON.parse(localStorage.getItem('tally:theme:v1') || '{"font":"min","colors":{}}'); th.scale = scale; localStorage.setItem('tally:theme:v1', JSON.stringify(th)); }
        sessionStorage.setItem('__seeded', '1');
      }
    } catch (e) {}
  }, { store, scale });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(TODAY));
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // errors the app catches and only logs (its start-up code does this) count too
  page.on('console', m => { if (m.type() === 'error' && !/Service Worker/.test(m.text())) errors.push('logged: ' + m.text().split('\n')[0]); });
  await page.goto(`${base}/${target}/index.html`);
  await page.waitForFunction(() => document.fonts && document.fonts.status === 'loaded');
  // no fades or animations, so a picture never catches something halfway (same for old and new)
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}' });
  await page.waitForTimeout(400);
  return { ctx, page, errors };
}

export function sha(buf) { return require('node:crypto').createHash('sha256').update(buf).digest('hex').slice(0, 16); }
