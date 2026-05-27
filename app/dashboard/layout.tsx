import { Plus_Jakarta_Sans } from 'next/font/google';
import DashboardRouteFrame from './DashboardRouteFrame';
import '../internal-utilities.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardRouteFrame fontClassName={plusJakarta.className}>
      {children}
    </DashboardRouteFrame>
  );
}
