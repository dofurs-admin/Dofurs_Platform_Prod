import type { PricingBreakdown } from '@/lib/bookings/types';
import AsyncState from '@/components/ui/AsyncState';

export default function PriceBreakdownCard({ price, isLoading }: { price: PricingBreakdown | null; isLoading?: boolean }) {
  return (
    <div className="rounded-xl border border-[#f2dfcf] bg-[#fff7f0] p-3 transition-all duration-300 ease-out hover:-translate-y-0.5">
      <p className="text-xs font-semibold text-ink">Price Breakdown</p>
      <AsyncState
        isLoading={isLoading || false}
        isEmpty={!isLoading && !price}
        loadingFallback={<p className="mt-1 text-xs text-[#6b6b6b]">Calculating...</p>}
        emptyFallback={<p className="mt-1 text-xs text-[#6b6b6b]">Select a service to preview price.</p>}
      >
        {price && (
          <div className="mt-2 space-y-1 text-[11px] text-[#6b6b6b]">
            {price.breakdown.map((line, index) => (
              <p key={`${line}-${index}`}>{line}</p>
            ))}
            <p>Base: ₹{price.base_total}</p>
            <p>Add-ons: ₹{price.addon_total}</p>
            <p>Discount: ₹{price.discount_amount}</p>
            <p className="mt-1 text-sm font-semibold text-ink">Total: ₹{price.final_total}</p>
          </div>
        )}
      </AsyncState>
    </div>
  );
}
