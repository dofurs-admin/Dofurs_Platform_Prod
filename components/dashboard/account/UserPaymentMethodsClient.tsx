'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { apiRequest } from '@/lib/api/client';
import { useToast } from '@/components/ui/ToastProvider';

type PaymentMethodCode = 'razorpay' | 'upi' | 'card' | 'netbanking' | 'wallet' | 'cash';

type PaymentMethodPreference = {
  preferred_payment_method: PaymentMethodCode;
  preferred_upi_vpa: string | null;
  billing_email: string | null;
};

type DetectedPaymentMethod = {
  code: PaymentMethodCode;
  label: string;
  lastUsedAt: string | null;
  source: 'transactions' | 'preference';
};

const METHOD_OPTIONS: Array<{ value: PaymentMethodCode; label: string }> = [
  { value: 'razorpay', label: 'Razorpay Checkout' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'netbanking', label: 'Netbanking' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'cash', label: 'Cash (Pay After Service)' },
];

function formatDate(value: string | null) {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return parsed.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function UserPaymentMethodsClient() {
  const [preference, setPreference] = useState<PaymentMethodPreference>({
    preferred_payment_method: 'razorpay',
    preferred_upi_vpa: null,
    billing_email: null,
  });
  const [detectedMethods, setDetectedMethods] = useState<DetectedPaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const loadPaymentMethods = useCallback(async () => {
    setIsLoading(true);

    try {
      const payload = await apiRequest<{
        preference: PaymentMethodPreference;
        detectedMethods: DetectedPaymentMethod[];
      }>('/api/payments/methods');

      setPreference(payload.preference);
      setDetectedMethods(payload.detectedMethods ?? []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to load payment methods.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadPaymentMethods();
  }, [loadPaymentMethods]);

  function savePreferences() {
    const normalizedEmail = preference.billing_email?.trim() || null;
    const normalizedVpa = preference.preferred_upi_vpa?.trim() || null;

    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      showToast('Enter a valid billing email address.', 'error');
      return;
    }

    if (normalizedVpa && !/^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/.test(normalizedVpa)) {
      showToast('Enter a valid UPI ID.', 'error');
      return;
    }

    startTransition(async () => {
      try {
        await apiRequest('/api/payments/methods', {
          method: 'PUT',
          body: JSON.stringify({
            preferred_payment_method: preference.preferred_payment_method,
            preferred_upi_vpa: normalizedVpa,
            billing_email: normalizedEmail,
          }),
        });

        await loadPaymentMethods();
        showToast('Payment preferences saved.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to save payment preferences.', 'error');
      }
    });
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-[#e8ccb3] bg-white p-6 shadow-premium-md">
        <h1 className="text-xl font-semibold text-ink">Manage Payment Methods</h1>
        <p className="mt-1 text-sm text-[#6b6b6b]">
          Configure your default payment rail and keep billing details ready for fast checkout.
        </p>
      </section>

      <section className="rounded-3xl border border-[#e8ccb3] bg-white p-6 shadow-premium-md">
        {isLoading ? <p className="text-sm text-[#6b6b6b]">Loading payment settings...</p> : null}

        {!isLoading ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-ink">
                Default payment method
                <select
                  value={preference.preferred_payment_method}
                  onChange={(event) =>
                    setPreference((current) => ({
                      ...current,
                      preferred_payment_method: event.target.value as PaymentMethodCode,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
                >
                  {METHOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-ink">
                Preferred UPI ID
                <input
                  type="text"
                  placeholder="name@bank"
                  value={preference.preferred_upi_vpa ?? ''}
                  onChange={(event) =>
                    setPreference((current) => ({
                      ...current,
                      preferred_upi_vpa: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
                />
              </label>

              <label className="text-sm font-medium text-ink sm:col-span-2">
                Billing email
                <input
                  type="email"
                  placeholder="billing@example.com"
                  value={preference.billing_email ?? ''}
                  onChange={(event) =>
                    setPreference((current) => ({
                      ...current,
                      billing_email: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-[#e8ccb3] px-4 py-2.5 text-sm"
                />
              </label>
            </div>

            <button
              type="button"
              disabled={isPending}
              onClick={savePreferences}
              className="mt-4 rounded-full border border-[#e8ccb3] bg-[#fff4e6] px-5 py-2.5 text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isPending ? 'Saving...' : 'Save Payment Preferences'}
            </button>

            <div className="mt-6">
              <h2 className="text-base font-semibold text-ink">Detected Payment Methods</h2>
              <p className="mt-1 text-xs text-[#6b6b6b]">
                Auto-detected from your payment transactions and selected preferences.
              </p>

              {detectedMethods.length === 0 ? (
                <p className="mt-3 text-sm text-[#6b6b6b]">No payment methods detected yet.</p>
              ) : (
                <div className="mt-3 grid gap-3">
                  {detectedMethods.map((method) => (
                    <article key={`${method.code}-${method.source}`} className="rounded-2xl border border-[#ecd8c5] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-ink">{method.label}</p>
                        <span className="rounded-full border border-[#e8ccb3] bg-[#fff8ef] px-2.5 py-1 text-xs font-semibold text-[#7b5f49]">
                          {method.source === 'transactions' ? 'Auto detected' : 'Preferred'}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[#5f5f5f]">Last used: {formatDate(method.lastUsedAt)}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
