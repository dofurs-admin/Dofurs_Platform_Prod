import { redirect } from 'next/navigation';

/**
 * /dashboard/user/bookings — redirect to the main user dashboard
 * which contains the bookings overview. A dedicated bookings sub-page
 * may be added in a future release.
 */
export default function UserBookingsPage() {
  redirect('/dashboard/user');
}
