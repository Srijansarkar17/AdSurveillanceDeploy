// import { chromium } from 'playwright';
// import { parseTikTokAds } from './tiktok.parser';

// export async function crawlTikTokAds(region = 'US') {
//   const browser = await chromium.launch({ headless: true });

//   const page = await browser.newPage({
//     locale: 'en-US',
//     timezoneId: 'America/New_York'
//   });

//   await page.goto(
//     `https://ads.tiktok.com/business/creativecenter/inspiration/topads?region=${region}`,
//     { waitUntil: 'networkidle', timeout: 60000 }
//   );

//   await page.waitForTimeout(6000);

//   const ads = await parseTikTokAds(page);

//   await browser.close();
//   return ads;
// }
