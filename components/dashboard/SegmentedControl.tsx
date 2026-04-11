'use client';

interface SegmentedControlProps {
  options: Array<{ value: string; label: string; icon?: string }>;
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export default function SegmentedControl({
  options,
  value,
  onChange,
  label,
}: SegmentedControlProps) {
  return (
    <div>
      {label && (
        <label className="mb-2 block text-sm font-semibold text-neutral-900">
          {label}
        </label>
      )}

      <div className="inline-flex gap-2 rounded-xl border border-neutral-200/60 bg-neutral-50 p-1">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-150 flex items-center gap-2 ${
              value === option.value
                ? 'bg-white text-neutral-950 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {option.icon && <span>{option.icon}</span>}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
