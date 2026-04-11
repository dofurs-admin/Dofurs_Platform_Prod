'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminPaymentsView from '@/components/dashboard/admin/views/AdminPaymentsView';
import { useToast } from '@/components/ui/ToastProvider';

type AdminPaymentTransaction = {
  id: string;
  user_id: string;
  booking_id: number | null;
  transaction_type: string;
  status: string;
  amount_inr: number;
  provider: string;
  provider_payment_id: string | null;
  created_at: string;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  service_type?: string | null;
  booking_mode?: string | null;
  service_address?: string | null;
  service_pincode?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  checkout_context?: string | null;
  inferred?: boolean;
};


export default function PaymentsTab() {
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<AdminPaymentTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/payments/transactions?limit=100');
      const data = await response.json().catch(() => ({})) as { transactions?: AdminPaymentTransaction[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to load payment transactions.');
      }
      setTransactions(data.transactions ?? []);
    } catch (err) { console.error(err);
      showToast('Unable to load payment transactions.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const statusOptions = useMemo(
    () => ['all', ...Array.from(new Set(transactions.map((tx) => tx.status).filter((value) => Boolean(value))))],
    [transactions],
  );

  const methodOptions = useMemo(
    () => [
      'all',
      ...Array.from(
        new Set(
          transactions
            .map((tx) => tx.payment_method ?? tx.provider)
            .filter((value): value is string => typeof value === 'string' && value.length > 0),
        ),
      ),
    ],
    [transactions],
  );

  const serviceOptions = useMemo(
    () => [
      'all',
      ...Array.from(
        new Set(
          transactions
            .map((tx) => tx.service_type)
            .filter((value): value is string => typeof value === 'string' && value.length > 0),
        ),
      ),
    ],
    [transactions],
  );

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((tx) => {
        const methodValue = tx.payment_method ?? tx.provider;
        if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
        if (methodFilter !== 'all' && methodValue !== methodFilter) return false;
        if (serviceFilter !== 'all' && (tx.service_type ?? '') !== serviceFilter) return false;
        return true;
      }),
    [transactions, statusFilter, methodFilter, serviceFilter],
  );

  useEffect(() => {
    setPage(1);
  }, [statusFilter, methodFilter, serviceFilter]);

  return (
    <AdminPaymentsView
      transactions={filteredTransactions}
      isLoading={isLoading}
      page={page}
      onPageChange={setPage}
      statusFilter={statusFilter}
      methodFilter={methodFilter}
      serviceFilter={serviceFilter}
      statusOptions={statusOptions}
      methodOptions={methodOptions}
      serviceOptions={serviceOptions}
      onStatusFilterChange={setStatusFilter}
      onMethodFilterChange={setMethodFilter}
      onServiceFilterChange={setServiceFilter}
      onResetFilters={() => {
        setStatusFilter('all');
        setMethodFilter('all');
        setServiceFilter('all');
      }}
    />
  );
}
