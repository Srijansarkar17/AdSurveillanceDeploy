export function calculateCTR(impressions: number, ctr: number) {
    const clicks = Math.round(impressions * ctr);
    return { clicks, ctr };
  }
  