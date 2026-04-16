'use client';

import { useEffect, useState } from 'react';
import { BellRing, Scissors, ShieldPlus, Stethoscope, X } from 'lucide-react';

const WELCOME_MODAL_STORAGE_KEY = 'dofurs.welcome-offer-modal.v1.seen';
const WELCOME_MODAL_DELAY_MS = 3000;
const WELCOME_REFERRAL_LINK = '/auth/sign-in?mode=signup&ref=DOFMQS68G';
const SHOULD_PERSIST_MODAL_SEEN_STATE = process.env.NODE_ENV === 'production';

type WelcomeOfferModalProps = {
  signupHref?: string;
  onSignup?: () => void;
};

const benefits = [
  {
    icon: Scissors,
    label: 'Grooming at Your Door step',
  },
  {
    icon: ShieldPlus,
    label: 'Lifetime Pet Health Passport',
  },
  {
    icon: BellRing,
    label: 'Smart Vaccination Reminders',
  },
  {
    icon: Stethoscope,
    label: 'Vet Care at Home or Clinic',
  },
] as const;

export default function WelcomeOfferModal({
  signupHref = WELCOME_REFERRAL_LINK,
  onSignup,
}: WelcomeOfferModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [offerTimerSeconds, setOfferTimerSeconds] = useState<number | null>(null);

  useEffect(() => {
    setIsMounted(true);

    const hasSeenModal =
      SHOULD_PERSIST_MODAL_SEEN_STATE &&
      window.localStorage.getItem(WELCOME_MODAL_STORAGE_KEY) === '1';
    if (hasSeenModal) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIsVisible(true);
      if (SHOULD_PERSIST_MODAL_SEEN_STATE) {
        window.localStorage.setItem(WELCOME_MODAL_STORAGE_KEY, '1');
      }
    }, WELCOME_MODAL_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (isVisible) {
      const randomSecondsUnderOneHour = Math.floor(Math.random() * 3599) + 1;
      setOfferTimerSeconds(randomSecondsUnderOneHour);
      return;
    }

    setOfferTimerSeconds(null);
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible || offerTimerSeconds === null || offerTimerSeconds <= 0) {
      return;
    }

    const interval = window.setInterval(() => {
      setOfferTimerSeconds((previousSeconds) => {
        if (previousSeconds === null || previousSeconds <= 1) {
          return 0;
        }

        return previousSeconds - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isVisible, offerTimerSeconds]);

  useEffect(() => {
    if (!isVisible) {
      setIsAnimatingIn(false);
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      setIsAnimatingIn(true);
    });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsVisible(false);
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isVisible]);

  function handleSignup() {
    onSignup?.();
    window.location.assign(signupHref);
  }

  function formatOfferTimer(totalSeconds: number | null): string {
    if (totalSeconds === null) {
      return '00:00';
    }

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  if (!isMounted || !isVisible) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-[140] flex items-center justify-center px-4 backdrop-blur-md transition-opacity duration-300 ${isAnimatingIn ? 'bg-[#1d1108]/60 opacity-100' : 'bg-[#1d1108]/0 opacity-0'}`}
      onClick={() => setIsVisible(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-offer-title"
      aria-describedby="welcome-offer-description"
    >
      <div
        className={`relative w-full max-w-[560px] overflow-hidden rounded-[34px] border border-[#e9bf94] bg-[linear-gradient(155deg,#fffefc_0%,#fffaf4_38%,#fdecd8_100%)] shadow-[0_32px_85px_rgba(70,35,8,0.34)] transition-all duration-300 ease-out ${isAnimatingIn ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-[0.98] opacity-0'}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0)_34%)]" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-12 -top-14 h-36 w-36 rounded-full bg-[radial-gradient(circle,#ffd3a8_0%,rgba(255,211,168,0)_72%)]" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-16 bottom-10 h-40 w-40 rounded-full bg-[radial-gradient(circle,#e2a26a_0%,rgba(226,162,106,0)_72%)]" aria-hidden="true" />

        <div className="relative p-5 sm:p-7">
          <button
            type="button"
            onClick={() => setIsVisible(false)}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ddb28d] bg-white/90 text-[#764524] shadow-[0_6px_14px_rgba(124,70,30,0.2)] transition hover:bg-white"
            aria-label="Close welcome offer"
          >
            <X className="h-4 w-4" />
          </button>

          <p className="inline-flex rounded-full border border-[#e7c7ad] bg-[#fff7ee] px-3 py-1 pr-10 text-[10px] font-bold uppercase tracking-[0.2em] text-[#7f4c2c] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            Welcome Offer
          </p>
          <h2
            id="welcome-offer-title"
            className="mt-3 pr-10 text-[1.55rem] font-extrabold leading-tight tracking-[-0.02em] whitespace-nowrap text-[#2a180b] sm:text-[1.85rem]"
          >
            🎉 Add 2+ Years to Your Pet&apos;s Life 🐾
          </h2>
          <p className="mt-3 inline-flex rounded-full border border-[#efc9a7] bg-[#ffe9d5] px-3 py-1 text-lg font-bold text-[#af5118] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            + Get ₹500 Free on Signup
          </p>
          <p id="welcome-offer-description" className="mt-3 text-sm leading-relaxed text-[#5b3f2b] sm:text-[15px]">
            Never miss vaccinations. Prevent life-threatening diseases. Give your pet the care they deserve — at home.
          </p>

          <ul className="mt-5 space-y-3 border-l-2 border-[#eabf97] pl-4">
            {benefits.map(({ icon: Icon, label }) => (
              <li key={label} className="relative flex items-center gap-3 text-sm font-semibold text-[#3f2a1a] sm:text-[15px]">
                <span className="absolute -left-[1.42rem] h-2.5 w-2.5 rounded-full bg-[#d77330] shadow-[0_0_0_3px_#fff1e2]" aria-hidden="true" />
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(160deg,#ffc48f_0%,#e98a3b_100%)] text-white shadow-[0_6px_12px_rgba(190,108,45,0.28)]">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 rounded-2xl border border-[#e6b992] bg-[linear-gradient(180deg,rgba(255,252,248,0.88),rgba(255,247,239,0.88))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] sm:p-4">
            <button
              type="button"
              onClick={handleSignup}
              className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#f7a645_0%,#db6c20_100%)] px-5 text-sm font-bold text-white shadow-[0_12px_24px_rgba(221,119,40,0.35)] transition hover:brightness-105"
            >
              Claim ₹500
            </button>
            <button
              type="button"
              onClick={() => setIsVisible(false)}
              className="mt-2.5 w-full text-sm font-semibold text-[#8a5a35] transition hover:text-[#6f4425]"
            >
              Maybe later
            </button>
          </div>

          <p className="mt-4 text-center text-xs font-bold uppercase tracking-[0.13em] text-[#a06035]">
            Offer expires in {formatOfferTimer(offerTimerSeconds)}
          </p>
        </div>
      </div>
    </div>
  );
}
