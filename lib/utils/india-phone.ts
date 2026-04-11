export function extractIndianPhoneDigits(value: string) {
  const digits = value.replace(/\D/g, '');

  if (digits.startsWith('91') && digits.length > 10) {
    return digits.slice(2, 12);
  }

  if (digits.startsWith('0') && digits.length > 10) {
    return digits.slice(1, 11);
  }

  return digits.slice(0, 10);
}

export function toIndianE164(value: string) {
  const digits = extractIndianPhoneDigits(value);

  if (digits.length !== 10) {
    return '';
  }

  return `+91${digits}`;
}

export function isValidIndianE164(value: string) {
  return /^\+91\d{10}$/.test(value.trim());
}
