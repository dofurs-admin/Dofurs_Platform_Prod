import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

type InvoiceSeries = 'SVC' | 'SUB' | 'MAN';

type LegacyInvoicePrefix = 'INV-SVC' | 'INV-SUB' | 'INV-MAN';

const LEGACY_PREFIX_BY_SERIES: Record<InvoiceSeries, LegacyInvoicePrefix> = {
  SVC: 'INV-SVC',
  SUB: 'INV-SUB',
  MAN: 'INV-MAN',
};

function buildLegacyInvoiceNumber(prefix: LegacyInvoicePrefix) {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const t = String(now.getUTCHours()).padStart(2, '0')
    + String(now.getUTCMinutes()).padStart(2, '0')
    + String(now.getUTCSeconds()).padStart(2, '0');
  const rand = crypto.randomInt(100000, 999999);
  return `${prefix}-${y}${m}${d}-${t}-${rand}`;
}

function normalizeRpcInvoiceNumber(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (
      first
      && typeof first === 'object'
      && 'next_invoice_number' in first
      && typeof first.next_invoice_number === 'string'
      && first.next_invoice_number.trim().length > 0
    ) {
      return first.next_invoice_number.trim();
    }
  }

  if (
    value
    && typeof value === 'object'
    && 'next_invoice_number' in value
    && typeof value.next_invoice_number === 'string'
    && value.next_invoice_number.trim().length > 0
  ) {
    return value.next_invoice_number.trim();
  }

  return null;
}

export async function getNextInvoiceNumber(
  supabase: SupabaseClient,
  series: InvoiceSeries,
): Promise<string> {
  const rpcClient = supabase as SupabaseClient & {
    rpc?: (
      fn: string,
      args?: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };

  if (typeof rpcClient.rpc === 'function') {
    try {
      const { data, error } = await rpcClient.rpc('next_invoice_number', {
        p_series: series,
      });

      if (!error) {
        const rpcInvoiceNumber = normalizeRpcInvoiceNumber(data);
        if (rpcInvoiceNumber) {
          return rpcInvoiceNumber;
        }
      }
    } catch {
      // Legacy fallback keeps invoice creation operational before migrations are applied.
    }
  }

  return buildLegacyInvoiceNumber(LEGACY_PREFIX_BY_SERIES[series]);
}
