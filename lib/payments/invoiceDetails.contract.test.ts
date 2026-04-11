import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadInvoiceDetailForAdmin, loadInvoiceDetailForUser } from '@/lib/payments/invoiceDetails';
import { buildInvoicePdfBuffer, buildInvoicePrintHtml } from '@/lib/payments/invoiceDocument';

type TableName =
  | 'billing_invoices'
  | 'billing_invoice_items'
  | 'payment_transactions'
  | 'payment_events'
  | 'booking_payment_collections';

type MockDataset = Record<TableName, Array<Record<string, unknown>>>;

type BuilderState = {
  table: TableName;
  filters: Array<{ field: string; value: unknown }>;
};

function applyFilters(rows: Array<Record<string, unknown>>, filters: Array<{ field: string; value: unknown }>) {
  return rows.filter((row) => filters.every((filter) => row[filter.field] === filter.value));
}

function createSupabaseDatasetMock(dataset: MockDataset): SupabaseClient {
  return {
    from: (table: string) => {
      const tableName = table as TableName;
      const state: BuilderState = { table: tableName, filters: [] };

      const builder = {
        select: () => builder,
        eq: (field: string, value: unknown) => {
          state.filters.push({ field, value });
          return builder;
        },
        in: () => builder,
        order: () => builder,
        limit: () => builder,
        returns: async <T>() => {
          const rows = applyFilters(dataset[state.table] ?? [], state.filters);
          return { data: rows as T, error: null };
        },
        maybeSingle: async <T>() => {
          const rows = applyFilters(dataset[state.table] ?? [], state.filters);
          return { data: (rows[0] as T) ?? null, error: null };
        },
      };

      return builder;
    },
  } as unknown as SupabaseClient;
}

function buildFixtureDataset(): MockDataset {
  return {
    billing_invoices: [
      {
        id: 'inv_1',
        user_id: 'user_1',
        invoice_number: 'INV-SVC-20260410-123000-111111',
        invoice_type: 'service',
        status: 'paid',
        booking_id: 78,
        user_subscription_id: null,
        payment_transaction_id: 'tx_1',
        subtotal_inr: 899,
        discount_inr: 0,
        tax_inr: 0,
        cgst_inr: 0,
        sgst_inr: 0,
        igst_inr: 0,
        gst_invoice_number: null,
        gstin: null,
        hsn_sac_code: null,
        total_inr: 899,
        issued_at: '2026-04-10T06:20:00.000Z',
        paid_at: '2026-04-10T06:21:00.000Z',
        created_at: '2026-04-10T06:19:00.000Z',
      },
    ],
    billing_invoice_items: [
      {
        id: 'item_1',
        invoice_id: 'inv_1',
        item_type: 'service',
        description: 'Home visit grooming session',
        quantity: 1,
        unit_amount_inr: 899,
        line_total_inr: 899,
        created_at: '2026-04-10T06:19:30.000Z',
      },
    ],
    payment_transactions: [
      {
        id: 'tx_1',
        user_id: 'user_1',
        provider: 'razorpay',
        status: 'captured',
        provider_payment_id: 'pay_ABC123',
        created_at: '2026-04-10T06:21:00.000Z',
        metadata: {
          provider_order_id: 'order_123',
        },
      },
    ],
    payment_events: [
      {
        transaction_id: 'tx_1',
        payload: {
          payment: {
            entity: {
              id: 'pay_ABC123',
              method: 'upi',
              vpa: 'alice@oksbi',
            },
          },
        },
        created_at: '2026-04-10T06:21:05.000Z',
      },
    ],
    booking_payment_collections: [],
  };
}

describe('invoice detail contract (user/admin sync)', () => {
  it('returns the same invoice document model for user and admin loaders', async () => {
    const supabase = createSupabaseDatasetMock(buildFixtureDataset());

    const userDetail = await loadInvoiceDetailForUser(supabase, 'user_1', 'inv_1');
    const adminDetail = await loadInvoiceDetailForAdmin(supabase, 'inv_1');

    expect(userDetail).not.toBeNull();
    expect(adminDetail).not.toBeNull();

    expect(userDetail?.invoice).toEqual(adminDetail?.invoice);
    expect(userDetail?.items).toEqual(adminDetail?.items);
    expect(userDetail?.payment).toEqual(adminDetail?.payment);

    expect(userDetail?.payment?.display_method).toBe('UPI (alice@oksbi)');
    expect(userDetail?.payment?.provider_payment_id).toBe('pay_ABC123');
  });

  it('enforces user scope while allowing admin visibility', async () => {
    const supabase = createSupabaseDatasetMock(buildFixtureDataset());

    const foreignUserDetail = await loadInvoiceDetailForUser(supabase, 'user_2', 'inv_1');
    const adminDetail = await loadInvoiceDetailForAdmin(supabase, 'inv_1');

    expect(foreignUserDetail).toBeNull();
    expect(adminDetail).not.toBeNull();
  });

  it('renders print html and pdf with shared compliance and payment blocks', async () => {
    const supabase = createSupabaseDatasetMock(buildFixtureDataset());
    const detail = await loadInvoiceDetailForAdmin(supabase, 'inv_1');

    expect(detail).not.toBeNull();

    const html = buildInvoicePrintHtml({
      invoice: detail!.invoice,
      items: detail!.items,
      payment: detail!.payment,
      issuer: {
        ...detail!.company,
        registrationNumber: 'CIN-U12345KA2026PTC000001',
        gstin: '29ABCDE1234F1Z5',
      },
      autoPrint: false,
    });

    expect(html).toContain('CIN-U12345KA2026PTC000001');
    expect(html).toContain('29ABCDE1234F1Z5');
    expect(html).toContain('UPI (alice@oksbi)');
    expect(html).toContain('/terms-conditions');

    const pdf = buildInvoicePdfBuffer({
      invoice: detail!.invoice,
      items: detail!.items,
      payment: detail!.payment,
      issuer: {
        ...detail!.company,
        registrationNumber: 'CIN-U12345KA2026PTC000001',
        gstin: '29ABCDE1234F1Z5',
      },
    });

    const pdfText = pdf.toString('utf8');
    expect(pdfText).toContain('PAYMENT METHOD: UPI \\(alice@oksbi\\)');
    expect(pdfText).toContain('Registration: CIN-U12345KA2026PTC000001');
    expect(pdfText).toContain('Terms: https://dofurs.in/terms-conditions');
  });
});
