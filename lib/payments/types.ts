export type RazorpayOrderRequest = {
  amountInPaise: number;
  currency?: 'INR';
  receipt: string;
  notes?: Record<string, string>;
};

export type RazorpayOrderResponse = {
  id: string;
  entity: 'order';
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
};

export type PaymentProvider = 'razorpay' | 'manual';

export type PaymentTransactionStatus =
  | 'initiated'
  | 'authorized'
  | 'captured'
  | 'failed'
  | 'refunded'
  | 'pending_manual'
  | 'paid_manual';

export type PaymentTransactionType = 'subscription_purchase' | 'service_collection';

export type SubscriptionPaymentVerificationInput = {
  providerOrderId: string;
  providerPaymentId: string;
  providerSignature: string;
};

export type WebhookProcessResult = {
  accepted: boolean;
  message: string;
};
