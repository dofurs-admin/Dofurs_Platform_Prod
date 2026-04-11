import Image from 'next/image';
import { theme } from '@/lib/theme';

type BrandMarkProps = {
  compact?: boolean;
};

export default function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className="inline-flex items-center" aria-label={`${theme.brandName} logo`}>
      <span className={`relative inline-flex overflow-hidden ${compact ? 'h-10 w-32' : 'h-12 w-40'} items-center justify-center`}>
        <Image src="/logo/brand-logo.png" alt={`${theme.brandName} logo`} fill sizes="(max-width: 768px) 128px, 160px" className="object-contain" priority />
      </span>
    </div>
  );
}
