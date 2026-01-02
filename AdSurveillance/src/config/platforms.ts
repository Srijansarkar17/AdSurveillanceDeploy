export type Platform = 'meta' | 'google' | 'youtube' | 'linkedin';

export const PLATFORM_CONFIG: Record<
  Platform,
  { cpm: number; ctr: number }
> = {
  meta: { cpm: 18, ctr: 0.032 },
  google: { cpm: 20, ctr: 0.03 },
  youtube: { cpm: 22, ctr: 0.028 },
  linkedin: { cpm: 30, ctr: 0.025 }
};
