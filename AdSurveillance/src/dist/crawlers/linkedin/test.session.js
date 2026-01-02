"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
(async () => {
    const context = await playwright_1.chromium.launchPersistentContext('./linkedin-session', { headless: false });
    const page = await context.newPage();
    await page.goto('https://www.linkedin.com/ad-library/search?keywords=Nike');
    console.log('👉 If you can see ads in browser, session is valid.');
})();
