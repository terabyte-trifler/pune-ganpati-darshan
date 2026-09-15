import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
await p.goto('file:///tmp/promo/title.html', { waitUntil:'networkidle' });
await p.waitForTimeout(1500);
await p.screenshot({ path:'/tmp/promo/title.png' });
await b.close();
console.log('ok');
