import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Screen, dofursColors, getBillingHistory } from '@dofurs/shared';

type PaymentInvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_type: string;
  status: string;
  total_inr: number;
  created_at: string;
  paid_at: string | null;
  payment_summary?: {
    method?: string | null;
    provider?: string | null;
    reference?: string | null;
    status?: string | null;
    paid_at?: string | null;
  } | null;
};

function formatCurrency(value: number) {
  return `INR ${Math.round(value)}`;
}

export default function PlaceholderScreen() {
  const paymentHistoryQuery = useQuery({
    queryKey: ['customer', 'payment-history'],
    queryFn: () => getBillingHistory({ limit: 50 }),
  });

  const invoices = (paymentHistoryQuery.data?.invoices ?? []) as PaymentInvoiceRow[];

  return (
    <Screen scroll>
      <Text style={styles.title}>Payment history</Text>
      <Text style={styles.subtitle}>Track invoices, payment methods, and settlement status.</Text>

      {paymentHistoryQuery.isLoading ? <Text style={styles.meta}>Loading invoices...</Text> : null}

      {paymentHistoryQuery.isError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>Unable to load payment history right now.</Text>
          <Pressable style={styles.retryButton} onPress={() => paymentHistoryQuery.refetch()}>
            <Text style={styles.retryButtonLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {invoices.map((invoice) => {
        const payment = invoice.payment_summary ?? null;
        return (
          <View key={invoice.id} style={styles.card}>
            <Text style={styles.cardTitle}>{invoice.invoice_number || 'Invoice'}</Text>
            <Text style={styles.meta}>Type: {invoice.invoice_type}</Text>
            <Text style={styles.meta}>Status: {invoice.status}</Text>
            <Text style={styles.total}>{formatCurrency(invoice.total_inr)}</Text>
            <Text style={styles.meta}>Created: {invoice.created_at ? new Date(invoice.created_at).toLocaleString() : '--'}</Text>
            <Text style={styles.meta}>Paid: {invoice.paid_at ? new Date(invoice.paid_at).toLocaleString() : '--'}</Text>

            {payment ? (
              <View style={styles.paymentBox}>
                <Text style={styles.meta}>Method: {payment.method ?? '--'}</Text>
                <Text style={styles.meta}>Provider: {payment.provider ?? '--'}</Text>
                <Text style={styles.meta}>Reference: {payment.reference ?? '--'}</Text>
                <Text style={styles.meta}>Payment status: {payment.status ?? '--'}</Text>
              </View>
            ) : null}
          </View>
        );
      })}

      {!paymentHistoryQuery.isLoading && !paymentHistoryQuery.isError && invoices.length === 0 ? (
        <Text style={styles.meta}>No payment records found yet.</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: dofursColors.ink,
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#5d5853',
    fontSize: 13,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7c4a7',
    backgroundColor: '#fff8f0',
    padding: 12,
    gap: 4,
  },
  cardTitle: {
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  total: {
    color: dofursColors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  paymentBox: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#edd7c6',
    backgroundColor: '#fffdfb',
    padding: 8,
    gap: 3,
  },
  meta: {
    color: '#6d635c',
    fontSize: 12,
  },
  errorCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1b5a8',
    backgroundColor: '#fff2ef',
    padding: 12,
    gap: 8,
  },
  errorText: {
    color: '#a6483b',
    fontSize: 13,
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7bda8',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  retryButtonLabel: {
    color: dofursColors.ink,
    fontSize: 12,
    fontWeight: '600',
  },
});
