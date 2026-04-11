'use client';

import { whatsappLinks } from '@/lib/site-data';

export default function WhatsAppFloatingButton() {
  return (
    <a
    href={whatsappLinks.support}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-20 right-6 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-soft transition hover:translate-y-[-2px] hover:bg-[#1fb85a] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 sm:bottom-6"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-current">
        <path d="M12.04 2.01c-5.52 0-10 4.48-10 10 0 1.77.46 3.5 1.33 5.04L2 22l5.08-1.33a9.97 9.97 0 0 0 4.96 1.31h.01c5.52 0 10-4.48 10-10 0-2.67-1.04-5.18-2.93-7.07a9.94 9.94 0 0 0-7.08-2.9zm0 18.32h-.01c-1.55 0-3.07-.41-4.4-1.2l-.32-.19-3.02.79.8-2.95-.21-.33A8.3 8.3 0 0 1 3.7 12c0-4.58 3.73-8.31 8.31-8.31 2.22 0 4.3.86 5.87 2.43a8.25 8.25 0 0 1 2.44 5.88c0 4.58-3.73 8.31-8.31 8.31z" />
        <path d="M16.56 13.6c-.25-.12-1.48-.73-1.7-.82-.22-.08-.38-.12-.54.12-.16.25-.62.82-.76.99-.14.16-.29.18-.54.06-.25-.12-1.04-.38-1.99-1.22-.74-.65-1.24-1.46-1.38-1.71-.14-.25-.02-.39.1-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.3-.02-.41-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.41-.54-.41h-.46c-.16 0-.41.06-.62.29-.22.25-.83.82-.83 1.99s.85 2.32.97 2.48c.12.16 1.69 2.59 4.1 3.63.58.25 1.02.4 1.37.51.57.18 1.1.16 1.51.1.46-.07 1.48-.6 1.69-1.16.21-.57.21-1.05.15-1.16-.06-.11-.22-.18-.46-.3z" />
      </svg>
      <span className="sr-only">WhatsApp</span>
    </a>
  );
}
