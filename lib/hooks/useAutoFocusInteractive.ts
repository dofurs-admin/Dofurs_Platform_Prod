import { useEffect, useRef, RefObject } from 'react';

const INTERACTIVE_SELECTOR =
  '[data-autofocus], [aria-invalid="true"], input:not([type="hidden"]):not([aria-hidden="true"]), select, textarea, [role="combobox"], [role="listbox"]';

/**
 * Scrolls the first interactive element inside a container into view
 * and optionally focuses it.
 *
 * @param trigger - value that triggers re-execution when it changes (e.g. isOpen, stepIndex)
 * @param options.enabled - skip when false (default: true)
 * @param options.delay - ms to wait for animations/portals to settle (default: 150)
 * @param options.focus - whether to focus the element (default: true)
 */
export function useAutoFocusInteractive<T extends HTMLElement = HTMLDivElement>(
  trigger: unknown,
  options: { enabled?: boolean; delay?: number; focus?: boolean } = {},
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const { enabled = true, delay = 150, focus = true } = options;

  useEffect(() => {
    if (!enabled || !trigger) return;

    const raf = requestAnimationFrame(() => {
      const timer = setTimeout(() => {
        const container = ref.current;
        if (!container) return;

        const target = container.querySelector<HTMLElement>(INTERACTIVE_SELECTOR);
        if (!target) return;

        target.scrollIntoView({ behavior: 'smooth', block: 'center' });

        if (focus && target.matches('input, select, textarea')) {
          target.focus({ preventScroll: true });
        }
      }, delay);

      // Store timer on raf cleanup
      (raf as unknown as { _timer?: ReturnType<typeof setTimeout> })._timer = timer;
    });

    return () => {
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, enabled]);

  return ref;
}

/**
 * Scrolls to the first element matching `[aria-invalid="true"]` within a container or document.
 * Call after form validation to guide users to the first error.
 */
export function scrollToFirstError(container?: HTMLElement | null) {
  const root = container ?? document;
  const target = root.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (target.matches('input, select, textarea')) {
      target.focus({ preventScroll: true });
    }
  }
}
