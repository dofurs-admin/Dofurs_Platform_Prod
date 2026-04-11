import UserSubscriptionsClient from '@/components/dashboard/account/UserSubscriptionsClient';
import { requireAuthenticatedUser } from '@/lib/auth/session';

export default async function UserSubscriptionsPage() {
  await requireAuthenticatedUser();
  return <UserSubscriptionsClient />;
}
