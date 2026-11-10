// Checks for "Copy this day to…": Add, Replace, Undo, an empty day, and that logged workouts are untouched.
//   node tests/copyday.mjs
import { chromium, openApp, fixture } from './harness.mjs';
import { start } from './serve.mjs';

const { server, url } = await start();
const browser = await chromium.launch();
let fails = 0;
const ok = (cond, what) => { console.log((cond ? 'ok   ' : 'FAIL ') + what); if (!cond) fails++; };
const plan = p => p.evaluate(() => JSON.parse(localStorage.getItem('tally:plan:v1')));
const days = p => p.evaluate(() => localStorage.getItem('tally:entries:v1'));

try {
  const fx = { ...fixture('full-male'), 'tally:aboutSeen:v1': '1' };
  const p0 = JSON.parse(fx['tally:plan:v1']);
  const o = await openApp(browser, url, 'new', { store: fx });
  const page = o.page;
  await page.click('#tabs button[data-pg="workout"]');
  const daysBefore = await days(page);

  // Monday has bench, OHP, lateral raise (bench planned at 4 sets), couch and pigeon stretches, no cardio.
  // Saturday has the run cardio only; Thursday has nothing.
  await page.selectOption('#fDay', 'mon');
  await page.click('#copyDayBtn');
  ok(await page.isVisible('#cpWrap .sh'), 'the button opens the copy dialog');
  ok((await page.textContent('#cpTitle')) === 'Copy Monday', 'dialog is titled after the selected session (' + await page.textContent('#cpTitle') + ')');
  ok(/Monday: 3 movements and 2 stretches\. /.test(await page.textContent('#cpWhat')), 'it says what will be copied (' + await page.textContent('#cpWhat') + ')');
  ok(!(await page.$('#cpDays button[data-d="mon"]')), 'Monday itself is not offered as a target');
  await page.click('#cpGo');
  ok(/Tick at least one day/.test(await page.textContent('#cpMsg')), 'copying with no day ticked asks for one');

  await page.click('#cpDays button[data-d="thu"]'); await page.click('#cpDays button[data-d="sat"]');
  await page.click('#cpGo'); await page.waitForTimeout(300);
  let pl = await plan(page);
  ok(JSON.stringify(pl.thu) === JSON.stringify(p0.mon), 'Add: Thursday gets Monday\'s movements');
  ok(pl.sets.thu && JSON.stringify(pl.sets.thu) === JSON.stringify(p0.sets.mon), 'Add: Thursday gets Monday\'s planned set counts');
  ok(JSON.stringify(pl.sx.thu) === JSON.stringify(p0.sx.mon), 'Add: Thursday gets Monday\'s stretches');
  ok(JSON.stringify(pl.cd.sat) === JSON.stringify(p0.cd.sat), 'Add: Saturday keeps its run');
  ok(JSON.stringify(pl.sat) === JSON.stringify(p0.mon) && JSON.stringify(pl.sx.sat) === JSON.stringify(p0.sx.mon), 'Add: Saturday also gets Monday\'s movements and stretches');
  ok(JSON.stringify(pl.mon) === JSON.stringify(p0.mon) && JSON.stringify(pl.wed) === JSON.stringify(p0.wed), 'Monday and the other days are unchanged');
  ok(/Copied Monday to Thu, Sat/.test(await page.textContent('#cpMsg')), 'it says what was done (' + await page.textContent('#cpMsg') + ')');
  ok(/Thu[\s\S]*Barbell bench/i.test(await page.textContent('#sched')), 'the week strip shows Thursday\'s new plan');

  await page.click('#cpUndo'); await page.waitForTimeout(300);
  pl = await plan(page);
  ok(JSON.stringify(pl) === JSON.stringify(p0), 'Undo puts the whole plan back exactly as it was');
  ok(!(await page.isVisible('#cpUndo')), 'Undo button goes away after use');

  // Replace: Wednesday onto Saturday removes Saturday's run.
  await page.click('#cpX');
  await page.selectOption('#fDay', 'wed');
  await page.click('#copyDayBtn');
  await page.click('#cpMode button[data-m="replace"]');
  ok(/exactly the same as Wednesday/.test(await page.textContent('#cpHowNote')), 'Replace explains what it does');
  await page.click('#cpDays button[data-d="sat"]'); await page.click('#cpGo'); await page.waitForTimeout(300);
  pl = await plan(page);
  ok(JSON.stringify(pl.sat) === JSON.stringify(p0.wed) && JSON.stringify(pl.sx.sat) === JSON.stringify(p0.sx.wed) && !pl.cd.sat, 'Replace: Saturday becomes exactly Wednesday (its run is gone)');

  // An empty day cannot be copied.
  await page.keyboard.press('Escape');
  ok(!(await page.isVisible('#cpWrap .sh')), 'Escape closes the dialog');
  await page.selectOption('#fDay', 'sun');
  await page.click('#copyDayBtn');
  ok(await page.isDisabled('#cpGo') && /nothing planned yet/.test(await page.textContent('#cpWhat')), 'a day with nothing planned cannot be copied, and says why');

  ok((await days(page)) === daysBefore, 'logged days are not touched by copying');
  ok(o.errors.length === 0, 'no page errors (' + o.errors.join(' | ') + ')');
  await o.ctx.close();

  // The copied plan survives a restart, and 8.1 reads it.
  const o2 = await openApp(browser, url, 'new', { store: fx });
  await o2.page.click('#tabs button[data-pg="workout"]');
  await o2.page.selectOption('#fDay', 'mon'); await o2.page.click('#copyDayBtn');
  await o2.page.click('#cpDays button[data-d="tue"]'); await o2.page.click('#cpGo'); await o2.page.waitForTimeout(300);
  const saved = await o2.page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
  await o2.ctx.close();
  const o3 = await openApp(browser, url, 'old', { store: saved });
  ok(/Tue[\s\S]*Barbell bench/i.test(await o3.page.textContent('#sched')), '8.1 opened on the same data shows the copied Tuesday');
  await o3.ctx.close();
} finally { await browser.close(); server.close(); }
console.log(fails ? `${fails} copy-a-day check(s) FAILED` : 'all copy-a-day checks passed');
if (fails) process.exitCode = 1;
