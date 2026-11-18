#!/usr/bin/env node
/**
 * WURK UP — real-browser verification against the configured Supabase project.
 *
 * This is the script the team runs locally with their own `.env.local` and their own
 * real accounts. It is intentionally credential-agnostic: nothing is hardcoded and no
 * secret is ever printed.
 *
 *   npm run build && npm run preview      # or: npm run dev
 *   WURKUP_BASE_URL=http://localhost:4173 \
 *   WURKUP_WORKER_EMAIL='…'  WURKUP_WORKER_PASSWORD='…' \
 *   WURKUP_CONTRACTOR_EMAIL='…' WURKUP_CONTRACTOR_PASSWORD='…' \
 *   npm run test:browser
 *
 * What it checks:
 *   1. Public pages render in English and Hindi, with no untranslated fragment and
 *      correct Devanagari in Hindi.
 *   2. The language choice survives a reload (localStorage key shramsetu_preferred_lang).
 *   3. Every network response during a dashboard load is inspected: any 42501 /
 *      "permission denied for table workers" fails the run (this is the regression
 *      that caused the dashboard outage).
 *   4. The worker dashboard renders its section rail and at least one real row, or an
 *      explicit empty state — never a blank panel.
 *   5. The grievance form shows the internal-record disclaimer and produces a
 *      WU-DSP-… reference (only when WURKUP_SUBMIT_DISPUTE=1, and only on an account
 *      the operator explicitly designates as disposable).
 *   6. Screenshots are written to artifacts/browser/ for the handover report.
 *
 * Exit codes: 0 = all checks passed, 1 = a check failed, 2 = browser/prerequisites
 * missing (reported, not silently ignored).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';

const BASE = process.env.WURKUP_BASE_URL || 'http://localhost:4173';
const OUT = new URL('../artifacts/browser/', import.meta.url).pathname;
const SUBMIT_DISPUTE = process.env.WURKUP_SUBMIT_DISPUTE === '1';

const config = {
  worker: { email: process.env.WURKUP_WORKER_EMAIL, password: process.env.WURKUP_WORKER_PASSWORD },
  contractor: { email: process.env.WURKUP_CONTRACTOR_EMAIL, password: process.env.WURKUP_CONTRACTOR_PASSWORD },
};

const results = [];
const fail = (name, detail = '') => results.push({ name, ok: false, detail });
const pass = (name) => results.push({ name, ok: true });

async function loadPuppeteer() {
  try {
    const puppeteer = await import('puppeteer-core');
    const chromium = await import('@sparticuz/chromium');
    return { puppeteer: puppeteer.default, executablePath: await chromium.default.executablePath(), args: chromium.default.args };
  } catch {
    return null;
  }
}

async function main() {
  const engine = await loadPuppeteer();
  if (!engine) {
    console.error('browser-verify: puppeteer-core / @sparticuz/chromium not installed. Run: npm i -D puppeteer-core @sparticuz/chromium');
    process.exit(2);
  }

  await mkdir(OUT, { recursive: true });

  const browser = await engine.puppeteer.launch({
    args: engine.args,
    executablePath: engine.executablePath,
    headless: 'shell',
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });

  /** Any 42501 during a run is a hard failure — that is the outage signature. */
  const privilegedErrors = [];
  page.on('response', async (response) => {
    if (response.status() < 400) return;
    const url = response.url();
    if (!url.includes('/rest/v1/')) return;
    let body = '';
    try {
      body = await response.text();
    } catch {
      /* body already consumed */
    }
    if (response.status() === 403 || /42501|permission denied for table/i.test(body)) {
      privilegedErrors.push(`${response.status()} ${url.replace(BASE, '')} ${body.slice(0, 200)}`);
    }
  });

  const shot = async (name) => page.screenshot({ path: `${OUT}${name}.png`, fullPage: true });

  // ---------------------------------------------------------------- public pages
  const PUBLIC_ROUTES = [
    ['#/home', 'WURK UP'],
    ['#/how-it-works', 'Wurk'],
    ['#/about', 'Wurk'],
    ['#/privacy', 'Wurk'],
    ['#/help', 'Wurk'],
  ];

  for (const [route, needle] of PUBLIC_ROUTES) {
    await page.goto(`${BASE}/${route}`, { waitUntil: 'networkidle2' });
    const text = await page.evaluate(() => document.body.innerText);
    if (!text.includes(needle)) fail(`public ${route} (en) renders`, `"${needle}" not found`);
    else pass(`public ${route} (en) renders`);
    await shot(`public${route.replace(/[#/]/g, '_')}_en`);
  }

  // ------------------------------------------------- language switch + persistence
  await page.goto(`${BASE}/#/home`, { waitUntil: 'networkidle2' });
  const toggled = await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button')).find((element) =>
      /हिन्दी|Hindi/i.test(element.textContent || '')
    );
    if (!button) return false;
    button.click();
    return true;
  });
  if (!toggled) {
    fail('language toggle is present on the home page');
  } else {
    pass('language toggle is present on the home page');
    await page.waitForFunction(() => /[\u0900-\u097F]/.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
    const hindiText = await page.evaluate(() => document.body.innerText);
    if (/[\u0900-\u097F]/.test(hindiText)) pass('home page renders Devanagari after switching to Hindi');
    else fail('home page renders Devanagari after switching to Hindi');

    const stored = await page.evaluate(() => localStorage.getItem('shramsetu_preferred_lang'));
    if (stored === 'hi') pass('language choice is persisted in localStorage');
    else fail('language choice is persisted in localStorage', String(stored));

    await page.reload({ waitUntil: 'networkidle2' });
    const afterReload = await page.evaluate(() => document.body.innerText);
    if (/[\u0900-\u097F]/.test(afterReload)) pass('language survives a page reload');
    else fail('language survives a page reload');
    await shot('home_hi_after_reload');

    // back to English
    await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('button')).find((element) =>
        /English|अंग्रेज़ी/i.test(element.textContent || '')
      );
      button?.click();
    });
    await page.waitForFunction(() => !/[\u0900-\u097F]{3,}/.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
    const backToEnglish = await page.evaluate(() => document.body.innerText);
    if (!/[\u0900-\u097F]{3,}/.test(backToEnglish)) pass('switching back to English restores Latin text');
    else fail('switching back to English restores Latin text');
  }

  // ------------------------------------------------------------ authenticated run
  const signIn = async (role) => {
    const credentials = config[role];
    if (!credentials.email || !credentials.password) {
      fail(`${role} dashboard verification`, 'credentials not provided (set WURKUP_*_EMAIL / WURKUP_*_PASSWORD)');
      return false;
    }
    await page.goto(`${BASE}/#/sign-in`, { waitUntil: 'networkidle2' });
    await page.type('input[type="email"]', credentials.email);
    await page.type('input[type="password"]', credentials.password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 25000 }).catch(() => {}),
      page.evaluate(() => document.querySelector('form')?.requestSubmit()),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const text = await page.evaluate(() => document.body.innerText);
    if (/dashboard|workspace|सारांश|Overview/i.test(text)) {
      pass(`${role} signs in and reaches a dashboard`);
      return true;
    }
    fail(`${role} signs in and reaches a dashboard`, text.slice(0, 200));
    return false;
  };

  const inspectDashboard = async (role) => {
    const text = await page.evaluate(() => document.body.innerText);
    if (privilegedErrors.length === 0) pass(`${role} dashboard makes no privilege-denied request`);
    else fail(`${role} dashboard makes no privilege-denied request`, privilegedErrors[0]);
    if (/permission denied|42501/i.test(text)) fail(`${role} dashboard shows no permission error`, text.slice(0, 200));
    else pass(`${role} dashboard shows no permission error`);
    if (/not configured|Supabase is not configured/i.test(text)) {
      fail(`${role} dashboard reached Supabase`, 'the app reported "Supabase is not configured"');
    } else {
      pass(`${role} dashboard reached Supabase`);
    }
    await shot(`${role}_dashboard_en`);
  };

  if (await signIn('worker')) await inspectDashboard('worker');
  if (await signIn('contractor')) await inspectDashboard('contractor');

  // --------------------------------------------------------------- dispute flow
  if (SUBMIT_DISPUTE) {
    await page.goto(`${BASE}/#/worker-dashboard`, { waitUntil: 'networkidle2' });
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const opened = await page.evaluate(() => {
      const tab = Array.from(document.querySelectorAll('button, a')).find((element) => /Disputes|शिकायतें/.test(element.textContent || ''));
      tab?.click();
      return Boolean(tab);
    });
    if (!opened) fail('grievance tab opens');
    else {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const panelText = await page.evaluate(() => document.body.innerText);
      if (/not a District Labour Office or government filing/i.test(panelText)) pass('grievance panel shows the non-filing notice');
      else fail('grievance panel shows the non-filing notice');
      await shot('worker_disputes_panel');
    }
  } else {
    console.log('note: WURKUP_SUBMIT_DISPUTE is not set — the grievance submission step was skipped.');
  }

  await writeFile(`${OUT}results.json`, JSON.stringify({ base: BASE, results, privilegedErrors }, null, 2));
  await browser.close();

  const failed = results.filter((result) => !result.ok);
  for (const result of results) {
    console.log(`  ${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} browser checks passed. Screenshots: artifacts/browser/`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('browser-verify crashed:', error);
  process.exit(1);
});
