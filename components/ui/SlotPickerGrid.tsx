'use client';

export type SlotState = 'available' | 'selected' | 'unavailable' | 'few-left';

export type TimeSlot = {
  startTime: string; // "HH:MM" 24h
  endTime?: string;
  state: SlotState;
  providerCount?: number;
};

type SlotPickerGridProps = {
  slots: TimeSlot[];
  selectedTime: string | null;
  onSelect: (startTime: string) => void;
  label?: string;
};

function formatTime(value: string) {
  const [hourStr, minuteStr] = value.split(':');
  const hour = Number(hourStr);
  const minute = minuteStr ?? '00';
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute} ${period}`;
}

const SLOT_STYLES: Record<SlotState, string> = {
  available:
    'border-brand-200 bg-white text-neutral-800 hover:border-coral hover:bg-brand-50 cursor-pointer',
  selected:
    'border-coral bg-[linear-gradient(135deg,#e49a57,#cf8347)] text-white shadow-sm cursor-pointer',
  unavailable:
    'border-neutral-200 bg-neutral-50 text-neutral-400 line-through cursor-not-allowed opacity-60',
  'few-left':
    'border-amber-300 bg-amber-50 text-amber-800 hover:border-amber-400 cursor-pointer',
};

export default function SlotPickerGrid({
  slots,
  selectedTime,
  onSelect,
  label = 'Select a time',
}: SlotPickerGridProps) {
  if (slots.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
        No slots available for this date.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {label && <p className="text-sm font-semibold text-neutral-700">{label}</p>}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        {slots.map((slot) => {
          const isSelected = selectedTime === slot.startTime;
          const effectiveState: SlotState = isSelected ? 'selected' : slot.state;

          return (
            <button
              key={slot.startTime}
              type="button"
              disabled={slot.state === 'unavailable'}
              onClick={() => slot.state !== 'unavailable' && onSelect(slot.startTime)}
              className={`relative flex flex-col items-center rounded-xl border px-2 py-2.5 text-xs font-semibold transition-all duration-150 ${SLOT_STYLES[effectiveState]}`}
            >
              <span>{formatTime(slot.startTime)}</span>
              {slot.state === 'few-left' && !isSelected && (
                <span className="mt-0.5 text-[10px] font-medium text-amber-600">few left</span>
              )}
              {typeof slot.providerCount === 'number' && slot.state === 'available' && !isSelected && (
                <span className="mt-0.5 text-[10px] text-neutral-400">{slot.providerCount}p</span>
              )}
            </button>
          );
        })}
      </div>

      {selectedTime && (
        <p className="text-xs text-neutral-500">
          Selected: <span className="font-semibold text-coral">{formatTime(selectedTime)}</span>
        </p>
      )}
    </div>
  );
}
