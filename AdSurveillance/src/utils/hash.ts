import crypto from 'crypto';

export function generateAdHash(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}
