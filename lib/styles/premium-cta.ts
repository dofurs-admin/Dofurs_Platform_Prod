import { cn } from '@/lib/design-system';

const premiumPrimaryCtaBase =
  'inline-flex items-center rounded-full border border-[#ca7d44] bg-[linear-gradient(135deg,#e49a57_0%,#cf8347_55%,#bf733c_100%)] text-white shadow-[0_10px_24px_rgba(182,102,40,0.32)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-[1.04] hover:shadow-[0_16px_30px_rgba(182,102,40,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d89157]/50 focus-visible:ring-offset-2';

const premiumSecondaryCtaBase =
  'inline-flex items-center rounded-full border border-[#e3c7ad] bg-[linear-gradient(180deg,#ffffff_0%,#fff5ea_100%)] text-[#6e4123] shadow-[0_8px_20px_rgba(158,102,56,0.14)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#d6af8b] hover:bg-[linear-gradient(180deg,#fffdfb_0%,#ffefdf_100%)] hover:text-[#5c341b] hover:shadow-[0_14px_26px_rgba(158,102,56,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6af8b]/40 focus-visible:ring-offset-2';

export function premiumPrimaryCtaClass(className?: string) {
  return cn(premiumPrimaryCtaBase, className);
}

export function premiumSecondaryCtaClass(className?: string) {
  return cn(premiumSecondaryCtaBase, className);
}
