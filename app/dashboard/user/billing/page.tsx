import UserBillingClient from '@/components/dashboard/account/UserBillingClient';
import { requireAuthenticatedUser } from '@/lib/auth/session';

export default async function UserBillingPage() {
  await requireAuthenticatedUser();
  return <UserBillingClient />;
}
