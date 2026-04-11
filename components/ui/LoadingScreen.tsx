'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoadingScreen() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (document.readyState === 'complete') {
      const timerId = setTimeout(() => setIsLoading(false), 300);
      return () => clearTimeout(timerId);
    }

    const handleLoad = () => {
      setTimeout(() => setIsLoading(false), 300);
    };

    window.addEventListener('load', handleLoad);
    const maxTimer = setTimeout(() => setIsLoading(false), 4000);

    return () => {
      window.removeEventListener('load', handleLoad);
      clearTimeout(maxTimer);
    };
  }, []);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          key="loading-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="loading-screen-root"
          aria-label="Loading Dofurs"
          role="status"
        >
          {/* Decorative radial gradient overlay */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `
                radial-gradient(circle at 14% 10%, rgba(228, 153, 90, 0.12), transparent 52%),
                radial-gradient(circle at 86% 90%, rgba(154, 122, 87, 0.08), transparent 48%)
              `,
            }}
            aria-hidden="true"
          />

          {/* Logo with breathe animation */}
          <div className="loading-logo-breathe relative">
            <Image
              src="/logo/brand-logo.png"
              alt="Dofurs logo"
              width={192}
              height={64}
              priority
              className="h-14 w-44 object-contain sm:h-16 sm:w-48"
            />
          </div>

          {/* Progress bar */}
          <div className="loading-progress-track mt-6">
            <div className="loading-progress-fill" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
