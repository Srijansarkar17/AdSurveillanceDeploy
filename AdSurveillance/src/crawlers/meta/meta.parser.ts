/**
 * Parse Meta/Facebook ads from page content
 */
export async function parseMetaAds(
  page: any,
  keywords: string[] = []
): Promise<Array<{ advertiser: string; creative: string }>> {
  try {
    // Get text content from div elements
    const texts: string[] = await page.$$eval(
      'div',
      (nodes: any[]) =>
        nodes
          .map((n: any) => {
            const text = n.textContent || '';
            return text
              .replace(/\s+/g, ' ')
              .trim();
          })
          .filter((t: string) => t.length > 50)
    );

    console.log(`🔍 Meta ads raw text blocks: ${texts.length}`);

    const uniqueAds = new Map<string, string>();

    for (const text of texts) {
      // 🔥 Apply keyword filter if provided
      if (keywords.length > 0) {
        const hasKeyword = keywords.some((k: string) =>
          text.toLowerCase().includes(k.toLowerCase())
        );
        if (!hasKeyword) {
          continue;
        }
      }

      // Create fingerprint for deduplication
      const fingerprint = text.slice(0, 120).toLowerCase();
      
      // Only add if not already in map
      if (!uniqueAds.has(fingerprint)) {
        uniqueAds.set(fingerprint, text.slice(0, 300));
      }
    }

    const adCount = Array.from(uniqueAds.values()).length;
    console.log(`📱 Meta unique ads after dedupe: ${adCount}`);

    // Format results
    return Array.from(uniqueAds.values()).map(creative => ({
      advertiser: 'Meta Advertiser',
      creative
    }));

  } catch (error) {
    console.error('❌ Error parsing Meta ads:', error);
    return [];
  }
}

/**
 * Extract advertiser name from Meta ad creative
 */
export function extractMetaAdvertiser(creative: string): string {
  try {
    // Look for common patterns in Meta ads
    const lines = creative.split('\n').map(line => line.trim());
    
    // First non-empty line often contains advertiser
    for (const line of lines) {
      if (line && line.length < 50 && !line.includes('Sponsored')) {
        return line;
      }
    }
    
    // Look for "Sponsored by" pattern
    const sponsoredMatch = creative.match(/Sponsored\s+by\s+([^\n]+)/i);
    if (sponsoredMatch) {
      return sponsoredMatch[1].trim();
    }
    
    return 'Meta Advertiser';
  } catch (error) {
    return 'Meta Advertiser';
  }
}

/**
 * Parse Meta ads with enhanced filtering
 */
export async function parseMetaAdsEnhanced(
  page: any,
  competitorName: string
): Promise<Array<{ advertiser: string; creative: string; platform: string }>> {
  try {
    const ads = await parseMetaAds(page, [competitorName]);
    
    return ads.map(ad => ({
      advertiser: extractMetaAdvertiser(ad.creative) || ad.advertiser,
      creative: ad.creative,
      platform: 'meta'
    }));
    
  } catch (error) {
    console.error('❌ Error in enhanced Meta parsing:', error);
    return [];
  }
}

/**
 * Check if text is likely an ad
 */
export function isLikelyMetaAd(text: string): boolean {
  if (!text || text.length < 50) return false;
  
  const lowerText = text.toLowerCase();
  
  // Ad indicators
  const adIndicators = [
    'sponsored',
    'promoted',
    'advertisement',
    'ads',
    'boosted',
    'paid for by',
    'suggested post',
    'suggested for you'
  ];
  
  // Non-ad indicators
  const nonAdIndicators = [
    'login',
    'sign up',
    'password',
    'create account',
    'forgot password',
    'terms of service',
    'privacy policy'
  ];
  
  const hasAdIndicator = adIndicators.some(indicator => 
    lowerText.includes(indicator)
  );
  
  const hasNonAdIndicator = nonAdIndicators.some(indicator => 
    lowerText.includes(indicator)
  );
  
  return hasAdIndicator && !hasNonAdIndicator;
}