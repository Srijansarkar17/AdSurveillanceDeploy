import { generateAdHash } from '../utils/hash.js';

export function resolveCampaignId(advertiser: string) {
  return generateAdHash(advertiser + '_campaign');
}
