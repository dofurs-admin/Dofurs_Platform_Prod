export function createIdempotencyKey(prefix: string) {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timestampPart = Date.now().toString(36);
  return `${prefix}-${timestampPart}-${randomPart}`;
}
