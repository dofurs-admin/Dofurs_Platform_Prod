import { permanentRedirect } from 'next/navigation';

export default function VetVisitsRedirectPage() {
  permanentRedirect('/pet-grooming/bengaluru');
}
