import { PawPrint } from 'lucide-react';

type PawMark = {
  className: string;
  delay: string;
  duration: string;
};

const pawMarks: PawMark[] = [
  { className: 'left-[4%] top-[12%] h-8 w-8 -rotate-12 text-[#e9c7ad]/34', delay: '0s', duration: '8.5s' },
  { className: 'left-[10%] top-[34%] h-7 w-7 rotate-6 text-[#e9c7ad]/28', delay: '1.2s', duration: '7.8s' },
  { className: 'left-[7%] top-[66%] h-9 w-9 -rotate-[15deg] text-[#e9c7ad]/30', delay: '0.5s', duration: '9.2s' },
  { className: 'right-[5%] top-[14%] h-8 w-8 rotate-12 text-[#e9c7ad]/34', delay: '0.8s', duration: '8.6s' },
  { className: 'right-[11%] top-[42%] h-7 w-7 -rotate-6 text-[#e9c7ad]/26', delay: '1.7s', duration: '8.1s' },
  { className: 'right-[7%] top-[74%] h-9 w-9 rotate-[16deg] text-[#e9c7ad]/30', delay: '0.3s', duration: '9s' },
  { className: 'left-[44%] top-[22%] hidden h-6 w-6 rotate-[8deg] text-[#e9c7ad]/24 lg:block', delay: '1s', duration: '7.6s' },
  { className: 'left-[53%] top-[56%] hidden h-7 w-7 -rotate-[10deg] text-[#e9c7ad]/24 lg:block', delay: '1.4s', duration: '8.8s' },
  { className: 'left-[38%] top-[82%] hidden h-6 w-6 rotate-12 text-[#e9c7ad]/22 lg:block', delay: '0.9s', duration: '7.9s' },
];

export default function FloatingPawBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden="true">
      {pawMarks.map((mark, index) => (
        <PawPrint
          key={index}
          className={`absolute ${mark.className} animate-paw-float`}
          style={{ animationDelay: mark.delay, animationDuration: mark.duration }}
        />
      ))}
    </div>
  );
}
