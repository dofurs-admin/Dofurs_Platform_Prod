import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import {
  Screen,
  dofursColors,
  getBillingInvoiceDetail,
  getBillingInvoiceDocumentUrl,
} from '@dofurs/shared';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function formatCurrency(value: unknown) {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `INR ${Math.round(numeric)}`;
}

function formatDate(value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return '--';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '--';
  }

  return parsed.toLocaleString();
}

export default function CustomerInvoiceDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const invoiceId = typeof params.id === 'string' ? params.id : '';
  const [openError, setOpenError] = useState<string | null>(null);

  const invoiceQuery = useQuery({
    queryKey: ['customer', 'invoice-detail', invoiceId],
    queryFn: () => getBillingInvoiceDetail(invoiceId),
    enabled: invoiceId.length > 0,
  });

  const invoice = useMemo(() => {
    const payload = invoiceQuery.data;
    if (!isRecord(payload) || !isRecord(payload.invoice)) {
      return null;
    }

    return payload.invoice;
  }, [invoiceQuery.data]);

  const items = useMemo(() => {
    const payload = invoiceQuery.data;
    if (!isRecord(payload) || !Array.isArray(payload.items)) {
      return [];
    }

    return payload.items.filter((item): item is Record<string, unknown> => isRecord(item));
  }, [invoiceQuery.data]);

  const payment = useMemo(() => {
    const payload = invoiceQuery.data;
    if (!isRecord(payload) || !isRecord(payload.payment)) {
      return null;
    }

    return payload.payment;
  }, [invoiceQuery.data]);

  async function handleOpenDocument(kind: 'print' | 'pdf') {
    setOpenError(null);

    try {
      const url = getBillingInvoiceDocumentUrl(invoiceId, {
        kind,
        inline: kind === 'pdf',
      });

      await Linking.openURL(url);
    } catch {
      setOpenError('Unable to open invoice document on this device right now.');
    }
  }

  return (
    <Screen scroll>
      <Text style={styles.pageTitle}>Invoice details</Text>

      {invoiceQuery.isLoading ? <Text style={styles.meta}>Loading invoice details...</Text> : null}
      {invoiceQuery.isError ? <Text style={styles.error}>Unable to load invoice details right now.</Text> : null}

      {!invoiceQuery.isLoading && !invoiceQuery.isError && invoice ? (
        <>
          <View style={styles.card}>
            <Text style={styles.invoiceNumber}>{typeof invoice.invoice_number === 'string' ? invoice.invoice_number : 'Invoice'}</Text>
            <Text style={styles.meta}>Status: {typeof invoice.status === 'string' ? invoice.status : '--'}</Text>
            <Text style={styles.meta}>Type: {typeof invoice.invoice_type === 'string' ? invoice.invoice_type : '--'}</Text>
            <Text style={styles.meta}>Issued: {formatDate(invoice.issued_at ?? invoice.created_at)}</Text>
            <Text style={styles.meta}>Paid: {formatDate(invoice.paid_at)}</Text>

            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>Total payable</Text>
              <Text style={styles.totalValue}>{formatCurrency(invoice.total_inr)}</Text>
            </View>

            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Subtotal</Text>
              <Text style={styles.amountValue}>{formatCurrency(invoice.subtotal_inr)}</Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Discount</Text>
              <Text style={styles.amountValue}>{formatCurrency(invoice.discount_inr)}</Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Tax</Text>
              <Text style={styles.amountValue}>{formatCurrency(invoice.tax_inr)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Line items</Text>
            {items.length === 0 ? <Text style={styles.meta}>No invoice line items available.</Text> : null}
            {items.map((item) => (
              <View key={String(item.id ?? Math.random())} style={styles.lineItemCard}>
                <Text style={styles.lineItemTitle}>{typeof item.description === 'string' ? item.description : 'Invoice item'}</Text>
                <Text style={styles.meta}>Quantity: {typeof item.quantity === 'number' ? item.quantity : 1}</Text>
                <Text style={styles.meta}>Unit amount: {formatCurrency(item.unit_amount_inr)}</Text>
                <Text style={styles.meta}>Line total: {formatCurrency(item.line_total_inr)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Payment summary</Text>
            {!payment ? <Text style={styles.meta}>Payment metadata unavailable.</Text> : null}
            {payment ? (
              <>
                <Text style={styles.meta}>Mode: {typeof payment.display_method === 'string' ? payment.display_method : '--'}</Text>
                <Text style={styles.meta}>Provider: {typeof payment.provider === 'string' ? payment.provider : '--'}</Text>
                <Text style={styles.meta}>Status: {typeof payment.status === 'string' ? payment.status : '--'}</Text>
                <Text style={styles.meta}>Reference: {typeof payment.payment_reference === 'string' ? payment.payment_reference : '--'}</Text>
              </>
            ) : null}
          </View>

          <View style={styles.actionsRow}>
            <Pressable style={styles.secondaryButton} onPress={() => void handleOpenDocument('print')}>
              <Text style={styles.secondaryButtonLabel}>Open printable invoice</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => void handleOpenDocument('pdf')}>
              <Text style={styles.secondaryButtonLabel}>Open PDF invoice</Text>
            </Pressable>
          </View>

          {openError ? <Text style={styles.error}>{openError}</Text> : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    color: dofursColors.ink,
    fontSize: 23,
    fontWeight: '700',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 12,
    gap: 6,
  },
  invoiceNumber: {
    color: dofursColors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  totalBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e3cfbc',
    backgroundColor: '#fffefb',
    padding: 10,
    gap: 2,
  },
  totalLabel: {
    color: '#6c625a',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  totalValue: {
    color: dofursColors.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    color: '#6f6359',
    fontSize: 12,
  },
  amountValue: {
    color: dofursColors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  lineItemCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ead3c0',
    backgroundColor: '#fffdf9',
    padding: 8,
    gap: 3,
  },
  lineItemTitle: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  actionsRow: {
    gap: 9,
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryButtonLabel: {
    color: dofursColors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  meta: {
    color: '#6d635c',
    fontSize: 12,
  },
  error: {
    color: '#a6483b',
    fontSize: 13,
  },
});
