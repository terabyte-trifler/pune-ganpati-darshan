import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await p.goto('file:///tmp/promo/title4.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
await p.screenshot({ path: '/tmp/promo/title4.png' });
await b.close();
console.log('ok');
