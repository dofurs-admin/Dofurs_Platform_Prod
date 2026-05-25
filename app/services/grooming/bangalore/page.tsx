import { permanentRedirect } from 'next/navigation';

export default function LegacyGroomingRedirectPage() {
  permanentRedirect('/services/grooming/bengaluru');
}
