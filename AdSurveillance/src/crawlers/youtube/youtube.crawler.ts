import { chromium } from 'playwright';
import { parseYouTubeAds } from './youtube.parser';

export async function crawlYouTubeAds(keyword: string, region = 'US') {
  const browser = await chromium.launch({ headless: true });

  const page = await browser.newPage({
    locale: 'en-US',
    timezoneId: 'America/New_York',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'
  });

  // ✅ Correct URL (Google Ads Transparency)
  await page.goto(
    `https://adstransparency.google.com/?region=${region}&query=${encodeURIComponent(
      keyword
    )}`,
    { waitUntil: 'networkidle', timeout: 60000 }
  );

  await page.waitForTimeout(8000);

  // Debug (optional but recommended once)
  console.log('YouTube page title:', await page.title());

  const ads = await parseYouTubeAds(page);

  await browser.close();
  return ads;
}
