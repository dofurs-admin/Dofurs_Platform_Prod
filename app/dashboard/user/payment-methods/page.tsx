import UserPaymentMethodsClient from '@/components/dashboard/account/UserPaymentMethodsClient';
import { requireAuthenticatedUser } from '@/lib/auth/session';

export default async function UserPaymentMethodsPage() {
  await requireAuthenticatedUser();
  return <UserPaymentMethodsClient />;
}
