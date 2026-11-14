// Checks the Android self-update screens with a stand-in for the native updater (Updater.java): the daily check,
// the bar at the top, Later, downloading, the one-time "allow installs" step, failures, the automatic-check switch.
//   node tests/selfupdate.mjs
import { chromium, openApp, fixture } from './harness.mjs';
import { start } from './serve.mjs';

const { server, url } = await start();
const browser = await chromium.launch();
let fails = 0;
const ok = (c, w) => { console.log((c ? 'ok   ' : 'FAIL ') + w); if (!c) fails++; };
const URL_APK = 'https://github.com/popo54321/tally/releases/download/v99.0/tally-99.0.apk';
const SEEN = { 'tally:aboutSeen:v1': '1', 'tally:tourSeen:v1': '1' };

// A stand-in for window.AndroidUpdate. latest: the version GitHub reports; allowed: the install setting.
const fakeNative = ({ latest = '99.0', allowed = true, net = true, installs = 'confirm' } = {}) => {
  const st = { latest, allowed, net, installs, checks: 0, installed: [] };
  window.__upd = st;
  window.AndroidFile = { save() { return true; } };   // looks like the Android app
  const fire = ev => setTimeout(() => window.tallyUpdateEvent && window.tallyUpdateEvent(ev), 30);
  window.AndroidUpdate = {
    current: () => '9.7',
    check() { st.checks++; fire(st.net ? { type: 'check', ok: true, version: st.latest, url: st.latest ? 'https://github.com/popo54321/tally/releases/download/v' + st.latest + '/tally-' + st.latest + '.apk' : '' } : { type: 'check', ok: false, why: 'net' }); return true; },
    canInstall: () => st.allowed,
    allowInstalls() { st.askedAllow = true; },
    install(u) {
      st.installed.push(u);
      if (st.installs === 'fail') { fire({ type: 'progress', pct: 40 }); setTimeout(() => window.tallyUpdateEvent({ type: 'error', why: 'verify' }), 80); return true; }
      fire({ type: 'progress', pct: 0 }); setTimeout(() => window.tallyUpdateEvent({ type: 'progress', pct: 55 }), 60);
      setTimeout(() => window.tallyUpdateEvent({ type: 'installing' }), 120); setTimeout(() => window.tallyUpdateEvent({ type: st.installs }), 180);
      return true;
    },
  };
};
async function open(opts, store = {}) {
  const o = await openApp(browser, url, 'new', { store: { ...fixture('full-male'), ...SEEN, ...store } });
  await o.ctx.close();
  // the stand-in has to exist before the app starts
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Bangkok', locale: 'en-GB', serviceWorkers: 'block' });
  await ctx.addInitScript(({ s, opts, fakeSrc }) => {
    if (!sessionStorage.getItem('__seeded')) { localStorage.clear(); for (const k in s) localStorage.setItem(k, s[k]); sessionStorage.setItem('__seeded', '1'); }
    (0, eval)('(' + fakeSrc + ')')(opts);
  }, { s: { ...fixture('full-male'), ...SEEN, ...store }, opts, fakeSrc: fakeNative.toString() });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${url}/new/index.html`);
  await page.waitForTimeout(3200);   // the automatic check runs 2.5 s after start
  return { ctx, page, errors };
}
const text = (p, id) => p.evaluate(i => { const e = document.getElementById(i); return e && e.offsetParent !== null ? e.textContent.trim() : null; }, id);

try {
  // 1. a newer version: the bar shows, Update downloads and hands over to Android
  let o = await open({ latest: '99.0' }), p = o.page;
  ok(await p.evaluate(() => window.__upd.checks) === 1, 'checks once by itself shortly after start');
  ok(await text(p, 'updNudgeText') === 'Tally 99.0 is ready', 'the bar at the top: "Tally 99.0 is ready"');
  await p.click('#tabs button[data-pg="settings"]');
  ok(/Your data is 100% offline/.test(await text(p, 'updHow')), 'the Version card says your data is 100% offline');
  ok(await text(p, 'updMsg') === 'Tally 99.0 is available' && await text(p, 'updInstall') === 'Update to 99.0', 'the card offers "Update to 99.0"');
  ok(await text(p, 'updGet') === null, 'no trip to the browser download page');
  await p.click('#updNudgeGo'); await p.waitForTimeout(80);
  ok(/^Downloading… \d+%$/.test(await text(p, 'updMsg') || ''), 'Update downloads inside the app (' + await text(p, 'updMsg') + ')');
  await p.waitForTimeout(250);
  ok(await p.evaluate(() => window.__upd.installed[0]) === URL_APK, 'the release file from GitHub is what gets installed');
  ok(/Tap Update in Android’s prompt/.test(await text(p, 'updMsg') || ''), 'then Android’s own prompt takes over');
  ok(o.errors.length === 0, 'no page errors (' + o.errors.join(' | ') + ')');
  await o.ctx.close();

  // 2. Later hides the bar for that version, and the daily check does not run again within the day
  o = await open({ latest: '99.0' }); p = o.page;
  await p.click('#updNudgeLater');
  ok(await text(p, 'updNudge') === null, 'Later hides the bar');
  await p.reload(); await p.waitForTimeout(3200);
  ok(await p.evaluate(() => window.__upd.checks) === 0, 'no second automatic check on the same day');
  await p.click('#tabs button[data-pg="settings"]'); await p.click('#updCheck'); await p.waitForTimeout(150);
  ok(await text(p, 'updNudge') === null && await text(p, 'updInstall') === 'Update to 99.0', 'checking by hand still offers the update in the card, without the bar');
  await o.ctx.close();

  // 3. nothing newer
  o = await open({ latest: '9.7' }); p = o.page;
  ok(await text(p, 'updNudge') === null, 'up to date: no bar');
  await p.click('#tabs button[data-pg="settings"]'); await p.click('#updCheck'); await p.waitForTimeout(150);
  ok(await text(p, 'updMsg') === 'You have the latest version.' && await text(p, 'updInstall') === null, 'Check for update: "You have the latest version."');
  await o.ctx.close();

  // 4. installs not allowed yet: the one-time step
  o = await open({ latest: '99.0', allowed: false }); p = o.page;
  await p.click('#updNudgeGo'); await p.waitForTimeout(80);
  ok(/allow “Install unknown apps” for Tally/.test(await text(p, 'updNudgeText') || '') && await text(p, 'updNudgeAllow') === 'Allow updates', 'first time: asks to allow installs, with a button');
  await p.click('#updNudgeAllow');
  ok(await p.evaluate(() => window.__upd.askedAllow) === true, 'the button opens Android’s setting');
  await p.evaluate(() => { window.__upd.allowed = true; window.tallyUpdateEvent({ type: 'resume' }); });
  await p.click('#tabs button[data-pg="settings"]'); await p.click('#updInstall'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => window.__upd.installed.length) === 1, 'once allowed, Update goes ahead');
  await o.ctx.close();

  // 5. failures
  o = await open({ latest: '99.0', installs: 'fail' }); p = o.page;
  await p.click('#tabs button[data-pg="settings"]'); await p.click('#updInstall'); await p.waitForTimeout(250);
  ok(/did not check out as a genuine Tally update/.test(await text(p, 'updMsg') || '') && await text(p, 'updGet') !== null, 'a download that is not genuine Tally is refused, with the download page offered');
  await o.ctx.close();
  o = await open({ net: false }); p = o.page;
  ok(await text(p, 'updNudge') === null, 'offline at start: the automatic check stays quiet');
  await p.click('#tabs button[data-pg="settings"]'); await p.click('#updCheck'); await p.waitForTimeout(150);
  ok(await text(p, 'updMsg') === 'Could not check. Are you online?', 'checking by hand while offline says so');
  await o.ctx.close();
  o = await open({ latest: '99.0', installs: 'cancelled' }); p = o.page;
  await p.click('#updNudgeGo'); await p.waitForTimeout(300);
  await p.click('#tabs button[data-pg="settings"]');
  ok(await text(p, 'updMsg') === 'Update cancelled. Tap Update to try again.' && await text(p, 'updInstall') === 'Update to 99.0', 'cancelled in Android’s prompt: can try again');
  await o.ctx.close();

  // 6. the automatic check can be switched off
  o = await open({ latest: '99.0' }, { 'tally:updAuto': '0' }); p = o.page;
  ok(await p.evaluate(() => window.__upd.checks) === 0 && await text(p, 'updNudge') === null, 'switched off: no check by itself');
  await p.click('#tabs button[data-pg="settings"]');
  ok(await text(p, 'updAuto') === 'Automatic check: off', 'the switch shows off');
  await p.click('#updAuto');
  ok(await text(p, 'updAuto') === 'Automatic check: on' && await p.evaluate(() => localStorage.getItem('tally:updAuto')) === '1', 'and turns back on');
  await o.ctx.close();

  // 7. the web app: no updater, nothing of this shows
  {
    const w = await openApp(browser, url, 'new', { store: { ...fixture('full-male'), ...SEEN } });
    await w.page.click('#tabs button[data-pg="settings"]');
    ok(await w.page.isVisible('#updCheck') && !(await w.page.isVisible('#updAuto')) && !(await w.page.isVisible('#updNudge')), 'web app: its own Check for update, no Android controls');
    ok(/Your data is 100% offline: it stays on this device/.test(await w.page.textContent('#updHow')), 'web app: "Your data is 100% offline" too');
    ok(w.errors.length === 0, 'no page errors');
    await w.ctx.close();
  }
} finally { await browser.close(); server.close(); }
console.log(fails ? `${fails} self-update check(s) FAILED` : 'all self-update checks passed');
if (fails) process.exitCode = 1;
