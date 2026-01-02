import { chromium } from 'playwright';
import { parseGoogleAds } from './google.parser';

export async function crawlGoogleAds(
  keyword: string,
  region: string = 'IN'
) {
  const browser = await chromium.launch({
    headless: true
  });

  const page = await browser.newPage({
    locale: 'en-US',
    timezoneId: 'Asia/Kolkata'
  });

  const url = `https://adstransparency.google.com/?region=${region}&q=${encodeURIComponent(
    keyword
  )}`;

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Google ads load lazily
    await page.waitForTimeout(8000);

    // Scroll multiple times to trigger rendering
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 2500);
      await page.waitForTimeout(2000);
    }

    // Safety wait
    await page.waitForTimeout(3000);

    const ads = await parseGoogleAds(page);

    return ads || [];
  } catch (error) {
    console.error('❌ Google crawler failed', error);
    return [];
  } finally {
    await browser.close();
  }
}
