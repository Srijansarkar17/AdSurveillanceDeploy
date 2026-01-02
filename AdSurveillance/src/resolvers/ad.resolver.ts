import { generateAdHash } from '../utils/hash.js';

export function resolveAdId(ad: any) {
  return generateAdHash(ad.advertiser + ad.creative);
}
