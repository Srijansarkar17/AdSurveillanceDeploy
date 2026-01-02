import { chromium } from 'playwright';
import { parseMetaAds } from './meta.parser';

export async function crawlMetaAds(keyword: string) {
  const browser = await chromium.launch({
    headless: false
  });
  

  const page = await browser.newPage({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'
  });

  // Go to Meta Ad Library
  await page.goto(
    `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=IN&q=${encodeURIComponent(
      keyword
    )}`,
    { waitUntil: 'domcontentloaded', timeout: 60000 }
  );

  console.log('META PAGE TITLE:', await page.title());

await page.screenshot({
  path: 'meta-page-debug.png',
  fullPage: true
});


  // Give UI time to render
  await page.waitForTimeout(4000);

  // Scroll to trigger lazy loading
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, 5000);
    await page.waitForTimeout(2500);
  }
  

  // Do NOT hard fail if selector missing
  const ads = await parseMetaAds(page, [keyword]);

  await browser.close();
  return ads;
}
