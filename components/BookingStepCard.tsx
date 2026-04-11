'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { BriefcaseBusiness, CalendarClock, ShieldCheck } from 'lucide-react';

const STEP_ICONS = [BriefcaseBusiness, CalendarClock, ShieldCheck];

interface Props {
  index: number;
  title: string;
  description: string;
  image: string;
}

const cardVariants = {
  rest: { scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 25 } },
  hover: { scale: 1.035, y: -10, transition: { type: 'spring' as const, stiffness: 300, damping: 25 } },
};

const iconVariants = {
  rest: {
    boxShadow: '0 2px 8px rgba(228,153,90,0.16), inset 0 1px 0 rgba(255,255,255,1)',
    transition: { duration: 0.35 },
  },
  hover: {
    boxShadow: '0 0 0 5px rgba(228,153,90,0.18), 0 0 32px rgba(228,153,90,0.6), inset 0 1px 0 rgba(255,255,255,1)',
    transition: { duration: 0.35 },
  },
};

const imageVariants = {
  rest: { opacity: 0.18, transition: { duration: 0.4 } },
  hover: { opacity: 0.32, transition: { duration: 0.4 } },
};

const shimmerVariants = {
  rest: { opacity: 0, transition: { duration: 0.3 } },
  hover: { opacity: 1, transition: { duration: 0.2 } },
};

const borderVariants = {
  rest: { opacity: 0, transition: { duration: 0.3 } },
  hover: { opacity: 1, transition: { duration: 0.25 } },
};

export default function BookingStepCard({ index, title, description, image }: Props) {
  const Icon = STEP_ICONS[index];
  const cardRef = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [7, -7]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-7, 7]), { stiffness: 300, damping: 30 });

  const shimmerBg = useTransform(
    [mouseX, mouseY],
    ([mx, my]: number[]) =>
      `radial-gradient(circle at ${(mx + 0.5) * 100}% ${(my + 0.5) * 100}%, rgba(228,153,90,0.22) 0%, transparent 65%)`,
  );

  function onMouseMove(e: React.MouseEvent<HTMLElement>) {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function onMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  return (
    <div ref={cardRef} style={{ perspective: '900px' }}>
      <motion.article
        variants={cardVariants}
        initial="rest"
        whileHover="hover"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className="relative h-full overflow-hidden rounded-[20px] border border-[#e7c4a7] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.08)_52%,rgba(255,250,244,0.05)_100%)] p-5 shadow-gloss-premium backdrop-blur-[2px] cursor-default will-change-transform"
      >
        {/* Background image — blended like a shadow */}
        <motion.div variants={imageVariants} className="absolute inset-0 pointer-events-none">
          <Image src={image} alt="" fill className="object-cover" aria-hidden="true" />
        </motion.div>

        {/* Mouse-follow radial shimmer */}
        <motion.div
          variants={shimmerVariants}
          className="pointer-events-none absolute inset-0 rounded-[20px]"
          style={{ background: shimmerBg }}
        />

        {/* Coral border glow on hover */}
        <motion.div
          variants={borderVariants}
          className="pointer-events-none absolute inset-0 rounded-[20px]"
          style={{ boxShadow: 'inset 0 0 0 1.5px rgba(228,153,90,0.85), 0 24px 64px rgba(228,153,90,0.18)' }}
        />

        <p className="relative z-10 text-xs font-semibold uppercase tracking-[0.14em] text-coral">
          Step {index + 1}
        </p>

        {/* Icon with coral glow */}
        <motion.span
          variants={iconVariants}
          className="relative z-10 mt-3 inline-flex h-11 w-11 items-center justify-center rounded-[22%] bg-[linear-gradient(150deg,#fff8f0_0%,#fde3c8_100%)] text-coral"
        >
          <Icon className="h-5 w-5" />
        </motion.span>

        <h3 className="relative z-10 mt-4 text-lg font-semibold text-[#3a2c22]">{title}</h3>
        <p className="relative z-10 mt-2 text-sm text-[#816b5d]">{description}</p>
      </motion.article>
    </div>
  );
}
