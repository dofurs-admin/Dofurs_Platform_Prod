import crypto from 'node:crypto';

const requestedBytes = Number(process.argv[2] ?? process.env.BILLING_AUTOMATION_SECRET_BYTES ?? '48');

if (!Number.isInteger(requestedBytes) || requestedBytes < 32 || requestedBytes > 128) {
  throw new Error('Secret byte length must be an integer between 32 and 128.');
}

const secret = crypto.randomBytes(requestedBytes).toString('base64url');
console.log(secret);
