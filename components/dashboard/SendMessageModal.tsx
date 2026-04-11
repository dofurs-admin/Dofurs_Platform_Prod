'use client';

import { useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  recipientId: string;
  recipientName: string;
  bookingId?: number;
  senderRole: 'admin' | 'staff' | 'provider';
};

export default function SendMessageModal({
  isOpen,
  onClose,
  recipientId,
  recipientName,
  bookingId,
  senderRole,
}: Props) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const endpoint = senderRole === 'provider' ? '/api/provider/messages' : '/api/admin/messages';

  async function handleSend() {
    if (!body.trim()) {
      setError('Message body is required');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId,
          subject: subject.trim() || undefined,
          body: body.trim(),
          bookingId: bookingId || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to send message' }));
        setError(data.error || 'Failed to send message');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSubject('');
        setBody('');
        setSuccess(false);
      }, 1500);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  }

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-0 z-[81] flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-3xl border border-[#e7c4a7] bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#e7c4a7] px-5 py-4">
            <div>
              <p className="font-bold text-neutral-950">Send Message</p>
              <p className="text-xs text-neutral-500">To: {recipientName}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-neutral-100"
            >
              <X className="h-4 w-4 text-neutral-600" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4">
            {success ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Send className="h-5 w-5 text-green-600" />
                </div>
                <p className="font-semibold text-green-700">Message sent!</p>
                <p className="text-sm text-neutral-500">{recipientName} will be notified.</p>
              </div>
            ) : (
              <>
                {bookingId && (
                  <p className="text-xs text-neutral-400 bg-neutral-50 rounded-lg px-3 py-2">
                    Regarding booking #{bookingId}
                  </p>
                )}

                <div>
                  <label htmlFor="msg-subject" className="block text-xs font-medium text-neutral-600 mb-1">
                    Subject (optional)
                  </label>
                  <input
                    id="msg-subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Update about your booking"
                    maxLength={200}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral"
                  />
                </div>

                <div>
                  <label htmlFor="msg-body" className="block text-xs font-medium text-neutral-600 mb-1">
                    Message
                  </label>
                  <textarea
                    id="msg-body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Type your message here..."
                    rows={4}
                    maxLength={2000}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral resize-none"
                  />
                  <p className="mt-1 text-right text-[10px] text-neutral-400">{body.length}/2000</p>
                </div>

                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {!success && (
            <div className="border-t border-neutral-100 px-5 py-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !body.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#e49a57,#cf8347)] px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send
              </button>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
