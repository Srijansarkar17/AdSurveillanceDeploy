/**
 * Parse Google ads from page content
 */
export async function parseGoogleAds(page: any): Promise<string[]> {
  try {
    const texts: string[] = await page.$$eval(
      'div, span, a',
      (nodes: any[]) =>
        nodes
          .map((n: any) => {
            const text = n.textContent || '';
            return text
              .replace(/\s+/g, ' ')
              .trim();
          })
          .filter((t: string) => t.length > 30 && t.length < 500)
    );

    // Filter for ad-like text
    const adTexts = texts.filter((text: string) => 
      text.toLowerCase().includes('ad') || 
      text.toLowerCase().includes('sponsored') ||
      text.includes('$') ||
      text.includes('buy') ||
      text.includes('sale') ||
      text.includes('discount')
    );

    return Array.from(new Set(adTexts)); // Remove duplicates
  } catch (error) {
    console.error('❌ Error parsing Google ads:', error);
    return [];
  }
}