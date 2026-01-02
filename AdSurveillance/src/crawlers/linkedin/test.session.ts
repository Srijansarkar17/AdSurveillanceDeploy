import { chromium } from 'playwright';

(async () => {
  const context = await chromium.launchPersistentContext(
    './linkedin-session',
    { headless: false }
  );

  const page = await context.newPage();
  await page.goto('https://www.linkedin.com/ad-library/search?keywords=Nike');

  console.log('👉 If you can see ads in browser, session is valid.');
})();
