'use client';

import { useRef, ReactNode } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface Props {
  children: ReactNode;
  className?: string;
  as?: 'article' | 'div';
  variant?: 'light' | 'dark';
}

const cardVariants = {
  rest: { scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 25 } },
  hover: { scale: 1.03, y: -8, transition: { type: 'spring' as const, stiffness: 300, damping: 25 } },
};

export default function PremiumCard({ children, className = '', as = 'div', variant = 'light' }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [6, -6]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-6, 6]), { stiffness: 300, damping: 30 });

  const shimmerBg = useTransform(
    [mouseX, mouseY],
    ([mx, my]: number[]) =>
      variant === 'dark'
        ? `radial-gradient(circle at ${(mx + 0.5) * 100}% ${(my + 0.5) * 100}%, rgba(255,255,255,0.1) 0%, transparent 65%)`
        : `radial-gradient(circle at ${(mx + 0.5) * 100}% ${(my + 0.5) * 100}%, rgba(228,153,90,0.2) 0%, transparent 65%)`,
  );

  const borderGlow =
    variant === 'dark'
      ? 'inset 0 0 0 1.5px rgba(255,255,255,0.22), 0 20px 50px rgba(228,153,90,0.12)'
      : 'inset 0 0 0 1.5px rgba(228,153,90,0.85), 0 20px 56px rgba(228,153,90,0.18)';

  function onMouseMove(e: React.MouseEvent<HTMLElement>) {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function onMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  const MotionEl = as === 'article' ? motion.article : motion.div;

  return (
    <div ref={wrapperRef} className="h-full" style={{ perspective: '900px' }}>
      <MotionEl
        variants={cardVariants}
        initial="rest"
        whileHover="hover"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className={`relative h-full will-change-transform ${className}`}
      >
        {children}

        {/* Mouse-follow shimmer */}
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ background: shimmerBg }}
          variants={{
            rest: { opacity: 0 },
            hover: { opacity: 1, transition: { duration: 0.2 } },
          }}
        />

        {/* Border + shadow glow */}
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ boxShadow: borderGlow }}
          variants={{
            rest: { opacity: 0 },
            hover: { opacity: 1, transition: { duration: 0.25 } },
          }}
        />
      </MotionEl>
    </div>
  );
}
