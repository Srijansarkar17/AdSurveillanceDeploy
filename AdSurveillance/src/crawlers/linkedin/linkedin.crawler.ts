import { chromium } from 'playwright';
import { parseLinkedInAds } from './linkedin.parser';

export async function crawlLinkedInAds(keyword: string) {
  const context = await chromium.launchPersistentContext(
    './linkedin-session',
    {
      headless: true,
      viewport: { width: 1280, height: 800 }
    }
  );

  const page = await context.newPage();

  const url = `https://www.linkedin.com/ad-library/search?keywords=${encodeURIComponent(
    keyword
  )}`;

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Allow ads to render
    await page.waitForTimeout(8000);

    // Scroll to load ads
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 3000);
      await page.waitForTimeout(2000);
    }

    const ads = await parseLinkedInAds(page);
    return ads;
  } catch (err) {
    console.error('❌ LinkedIn crawler failed', err);
    return [];
  } finally {
    await context.close();
  }
}
