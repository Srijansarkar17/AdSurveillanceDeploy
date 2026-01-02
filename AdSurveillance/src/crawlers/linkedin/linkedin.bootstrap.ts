import { chromium } from 'playwright';

async function bootstrapLinkedInSession() {
  const context = await chromium.launchPersistentContext(
    './linkedin-session', // 🔐 SESSION STORAGE
    {
      headless: false,
      viewport: { width: 1280, height: 800 }
    }
  );

  const page = await context.newPage();

  console.log('🔐 Please login to LinkedIn manually...');
  await page.goto('https://www.linkedin.com/ad-library/search');

  console.log('✅ After login & ads visible, close browser manually.');
}

bootstrapLinkedInSession();
