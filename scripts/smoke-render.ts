/**
 * Headless render smoke test.
 *
 * Boots a jsdom document, server-renders the whole application tree and every
 * public page, then asserts that key content is present. This catches broken
 * imports, runtime crashes and empty routes without needing a browser.
 *
 * Run with: npx tsx scripts/smoke-render.ts
 */
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:3000/#/home',
  pretendToBeVisual: true,
});

const w = dom.window as unknown as Window & typeof globalThis;
(globalThis as any).window = w;
(globalThis as any).document = w.document;
Object.defineProperty(globalThis, 'navigator', {
  value: w.navigator,
  configurable: true,
  writable: true,
});
(globalThis as any).localStorage = w.localStorage;
(globalThis as any).HTMLElement = w.HTMLElement;
(globalThis as any).Element = w.Element;
(globalThis as any).Node = w.Node;
(globalThis as any).getComputedStyle = w.getComputedStyle;
(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0);
(globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
(globalThis as any).matchMedia = () => ({
  matches: false,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
});
(globalThis as any).IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const { renderToString } = await import('react-dom/server');

const results: { name: string; ok: boolean; error?: string; missing?: string[] }[] = [];

const check = (name: string, html: string, needles: string[]) => {
  const missing = needles.filter((needle) => !html.includes(needle));
  results.push({ name, ok: missing.length === 0, missing });
};

try {
  const { default: App } = await import('../src/App.tsx');
  const html = renderToString(React.createElement(App));
  check('App shell (home route)', html, [
    'WurkUp',
    'Every shift recorded',
    'Create your account',
    'Verified work',
    'Zero-PII QR',
    'Questions workers ask',
    'Senior Bal Vigyan',
  ]);

  const { Home } = await import('../src/components/public/Home');
  const { HowItWorks } = await import('../src/components/public/HowItWorks');
  const { CreateAccount } = await import('../src/components/public/CreateAccount');
  const { SignIn } = await import('../src/components/public/SignIn');
  const { PasswordRecovery } = await import('../src/components/public/PasswordRecovery');
  const { ResetPassword } = await import('../src/components/public/ResetPassword');
  const { Privacy } = await import('../src/components/public/Privacy');
  const { HelpContact } = await import('../src/components/public/HelpContact');
  const { About } = await import('../src/components/public/About');

  const nav = () => {};
  const pages: [string, React.ComponentType<any>, string[]][] = [
    ['Home', Home, ['Every wage explained']],
    ['HowItWorks', HowItWorks, ['From the first site check-in']],
    ['CreateAccount', CreateAccount, ['Set up your WurkUp record']],
    ['SignIn', SignIn, ['Sign in to your portal']],
    ['PasswordRecovery', PasswordRecovery, ['Reset your password']],
    ['ResetPassword', ResetPassword, ['Choose a new password', 'Confirm new password']],
    ['Privacy', Privacy, ['Privacy']],
    ['HelpContact', HelpContact, ['human on the line']],
    ['About', About, ['Built in Indore']],
  ];

  for (const [name, Component, needles] of pages) {
    try {
      const html = renderToString(
        React.createElement(Component, {
          onNavigate: nav,
          onEnterJudgeDemo: nav,
          lang: 'en',
        })
      );
      check(name, html, needles);
    } catch (error: any) {
      results.push({ name, ok: false, error: error?.message ?? String(error) });
    }
  }

  try {
    const expiredHtml = renderToString(React.createElement(ResetPassword, {
      onNavigate: nav,
      lang: 'en',
      recoveryError: 'This password recovery link is invalid or has expired.',
      recoveryComplete: false,
    }));
    check('ResetPassword expired-link guidance', expiredHtml, ['Recovery link unavailable', 'Request a new recovery email']);
  } catch (error: any) {
    results.push({ name: 'ResetPassword expired-link guidance', ok: false, error: error?.message ?? String(error) });
  }

  try {
    const completedHtml = renderToString(React.createElement(ResetPassword, {
      onNavigate: nav,
      lang: 'en',
      recoveryError: null,
      recoveryComplete: true,
    }));
    const hasConfirmation = completedHtml.includes('Password updated') && completedHtml.includes('Continue to sign in');
    const hidesForm = !completedHtml.includes('New password');
    results.push({ name: 'ResetPassword success confirmation', ok: hasConfirmation && hidesForm });
  } catch (error: any) {
    results.push({ name: 'ResetPassword success confirmation', ok: false, error: error?.message ?? String(error) });
  }

  // Authenticated dashboards. These cannot reach Supabase during a headless run,
  // so the assertion is that the shell + section rail render for both roles and
  // both languages — and that the unconfigured state is explicit, not blank.
  const { WorkerDashboard } = await import('../src/components/dashboard/worker/WorkerDashboard');
  const { ContractorDashboard } = await import('../src/components/dashboard/contractor/ContractorDashboard');

  const dashboardUser = {
    id: '00000000-0000-4000-8000-000000000002',
    email: 'dash@example.com',
    phone: '+91 98260 00000',
    fullName: 'Sunita Bai Verma',
    role: 'worker' as const,
    contactVerificationStatus: 'number_supplied' as const,
    manualChecks: [],
    consentToShareContact: false,
    privacyAccepted: true,
    qrReferenceToken: 'token',
    createdAt: '2026-10-01T00:00:00Z',
  };

  const dashboards: [string, React.ComponentType<any>, Record<string, unknown>, string[]][] = [
    [
      'WorkerDashboard (en)',
      WorkerDashboard,
      { user: dashboardUser, lang: 'en' },
      ['Worker workspace', 'Overview', 'Attendance', 'Wages', 'Approvals', 'Disputes', 'Profile', 'Refresh'],
    ],
    [
      'WorkerDashboard (hi)',
      WorkerDashboard,
      { user: dashboardUser, lang: 'hi' },
      ['श्रमिक कार्यक्षेत्र', 'सारांश', 'उपस्थिति', 'मजदूरी'],
    ],
    [
      'ContractorDashboard (en)',
      ContractorDashboard,
      {
        user: { ...dashboardUser, role: 'contractor', organizationName: 'Narmada Infra' },
        lang: 'en',
      },
      ['Contractor workspace', 'Crew', 'Sites', 'Attendance', 'Wages', 'Approvals', 'Disputes'],
    ],
    [
      'ContractorDashboard (hi)',
      ContractorDashboard,
      {
        user: { ...dashboardUser, role: 'contractor', organizationName: 'Narmada Infra' },
        lang: 'hi',
      },
      ['ठेकेदार कार्यक्षेत्र', 'टीम', 'साइट'],
    ],
  ];

  for (const [name, Component, props, needles] of dashboards) {
    try {
      const html = renderToString(React.createElement(Component, props));
      check(name, html, needles);
    } catch (error: any) {
      results.push({ name, ok: false, error: error?.message ?? String(error) });
    }
  }
} catch (error: any) {
  results.push({ name: 'App shell', ok: false, error: error?.message ?? String(error) });
}

let failed = 0;
for (const result of results) {
  if (result.ok) {
    console.log(`  PASS  ${result.name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${result.name}`);
    if (result.error) console.log(`        error: ${result.error}`);
    if (result.missing?.length) console.log(`        missing: ${result.missing.join(', ')}`);
  }
}

console.log(`\n${results.length - failed}/${results.length} screens rendered cleanly.`);
process.exit(failed === 0 ? 0 : 1);
