import { permanentRedirect } from 'next/navigation';

export default function LegacyGroomingRedirectPage() {
  permanentRedirect('/pet-grooming/bengaluru');
}
