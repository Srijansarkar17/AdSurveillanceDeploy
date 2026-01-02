export function calculateSpend(impressions: number, cpm: number) {
    const spend = (impressions / 1000) * cpm;
    return {
      spend,
      lower: spend * 0.8,
      upper: spend * 1.2
    };
  }
  