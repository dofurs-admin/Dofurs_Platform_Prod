'use client';

interface LocationEditorProps {
  variant: 'desktop' | 'mobile';
  pincode: string;
  pincodeDraft: string;
  onPincodeDraftChange: (value: string) => void;
  onSave: () => void;
}

export function LocationEditor({ variant, pincode, pincodeDraft, onPincodeDraftChange, onSave }: LocationEditorProps) {
  const inputId = variant === 'desktop' ? 'header-pincode-input' : 'mobile-pincode-input';
  const containerId = variant === 'desktop' ? 'header-location-editor' : 'mobile-location-editor';

  if (variant === 'desktop') {
    return (
      <div
        id={containerId}
        className="absolute right-0 top-14 z-[42] w-64 rounded-2xl border border-[#e7c4a7] bg-[linear-gradient(160deg,#fff9f2,#fff2e3)] p-3 shadow-soft-md"
      >
        <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8f6645]">
          Your pincode
        </label>
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          value={pincodeDraft}
          onChange={(event) => onPincodeDraftChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
          className="mt-2 w-full rounded-xl border border-[#e4c7ab] bg-white px-3 py-2 text-sm font-semibold text-ink outline-none ring-coral/25 transition focus:ring-2"
          placeholder="6-digit pincode"
          aria-label="Enter 6 digit pincode"
        />
        <p className="mt-1 text-[11px] text-[#8f6645]">Current pincode: {pincode}</p>
        <button
          type="button"
          onClick={onSave}
          disabled={!/^\d{6}$/.test(pincodeDraft.trim())}
          className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-[#1f1a17] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#2f2722] disabled:cursor-not-allowed disabled:bg-[#7a6860]"
        >
          Save pincode
        </button>
      </div>
    );
  }

  // mobile variant
  return (
    <div id={containerId} className="rounded-2xl border border-[#ddb994] bg-[#fff8f0] p-2.5">
      <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8f6645]">
        Your pincode
      </label>
      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        value={pincodeDraft}
        onChange={(event) => onPincodeDraftChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
        className="mt-2 w-full rounded-xl border border-[#e4c7ab] bg-white px-3 py-2 text-sm font-semibold text-ink outline-none ring-coral/25 transition focus:ring-2"
        placeholder="6-digit pincode"
      />
      <p className="mt-1 text-[11px] text-[#8f6645]">Current pincode: {pincode}</p>
      <button
        type="button"
        onClick={onSave}
        disabled={!/^\d{6}$/.test(pincodeDraft.trim())}
        className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-[#1f1a17] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#7a6860]"
      >
        Save pincode
      </button>
    </div>
  );
}
