export function calculateImpressions(spend: number, cpm: number) {
    const impressions = Math.round((spend / cpm) * 1000);
    return {
      impressions,
      lower: Math.round(impressions * 0.85),
      upper: Math.round(impressions * 1.15)
    };
  }
  