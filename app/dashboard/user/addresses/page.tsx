import UserAddressesClient from '@/components/dashboard/account/UserAddressesClient';
import { requireAuthenticatedUser } from '@/lib/auth/session';

export default async function UserAddressesPage() {
  await requireAuthenticatedUser();
  return <UserAddressesClient />;
}
