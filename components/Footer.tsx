import { Facebook, Instagram, Linkedin, Twitter, Youtube } from 'lucide-react';
import Link from 'next/link';
import BrandMark from './BrandMark';
import { footerInfoLinks, footerPolicyLinks } from '@/lib/site-data';
import { theme } from '@/lib/theme';

const socials = [
  { icon: Twitter, href: 'https://x.com/dofurs', label: 'Twitter' },
  { icon: Youtube, href: 'https://www.youtube.com/@dofurspetcare', label: 'YouTube' },
  { icon: Linkedin, href: 'https://www.linkedin.com/company/dofurs-petcare/', label: 'LinkedIn' },
  { icon: Instagram, href: 'https://www.instagram.com/dofurs.petcare/', label: 'Instagram' },
  { icon: Facebook, href: 'https://www.facebook.com/profile.php?id=61568180277956', label: 'Facebook' },
];

export default function Footer() {
  return (
    <footer className="dofurs-footer-shell relative overflow-hidden border-t border-[#e2c2a4] bg-[linear-gradient(140deg,#fff4e4_0%,#fffdf9_46%,#ffe9d2_100%)] py-8 md:py-9">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.68),rgba(255,255,255,0))]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_14%,rgba(228,153,90,0.24),transparent_40%),radial-gradient(circle_at_88%_84%,rgba(154,122,87,0.16),transparent_36%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-[1px] bg-[linear-gradient(165deg,rgba(255,255,255,0.5),rgba(255,250,244,0.2))]" aria-hidden="true" />

      <div className={`${theme.layout.container} relative z-10 grid gap-5 md:grid-cols-2 md:gap-x-8 md:gap-y-5 lg:grid-cols-4`}>
        <div className="lg:col-span-1">
          <BrandMark compact />
          <p className="mt-2 text-xs text-ink/60">© 2026 Dofurs - Premium Pet Care, Bangalore.</p>
        </div>

        <div>
          <p className="text-sm font-semibold tracking-wide text-ink/95">Explore</p>
          <div className="mt-2 grid gap-0.5">
            {footerInfoLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-2 py-2 text-sm text-ink/75 transition-all duration-300 hover:translate-x-0.5 hover:bg-white/50 hover:text-coral"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold tracking-wide text-ink/95">Policies</p>
          <div className="mt-2 grid gap-0.5">
            {footerPolicyLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-2 py-2 text-sm text-ink/75 transition-all duration-300 hover:translate-x-0.5 hover:bg-white/50 hover:text-coral"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold tracking-wide text-ink/95">Follow</p>
          <div className="mt-2 flex items-center gap-2.5">
          {socials.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.label}
                href={item.href}
                aria-label={item.label}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e7c4a7] bg-[linear-gradient(145deg,#fff8f0,#fff2e2)] text-ink transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#de9158,#c7773b)] hover:text-white hover:shadow-[0_10px_20px_rgba(199,119,59,0.35)]"
              >
                <Icon size={18} />
              </a>
            );
          })}
          </div>
        </div>
      </div>
      <div className={`${theme.layout.container} relative z-10 mt-5 border-t border-[#e2c2a4] pt-3.5 text-center text-xs text-ink/55`}>
        Crafted with care for pet parents and professionals.
      </div>
    </footer>
  );
}
