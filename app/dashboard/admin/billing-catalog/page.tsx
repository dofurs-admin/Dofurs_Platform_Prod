import { redirect } from 'next/navigation';

export default async function AdminBillingCatalogPage() {
  redirect('/dashboard/admin/subscriptions');
}
