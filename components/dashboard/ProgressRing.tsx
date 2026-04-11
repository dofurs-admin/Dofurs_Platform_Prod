'use client';

interface ProgressRingProps {
  percentage: number;
  radius?: number;
  circumference?: number;
  strokeWidth?: number;
  hidePercentage?: boolean;
}

export default function ProgressRing({
  percentage,
  radius = 45,
  circumference = 283,
  strokeWidth = 3,
  hidePercentage = false,
}: ProgressRingProps) {
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  // Dynamically adjust text size based on radius
  const getTextSize = () => {
    if (radius <= 15) return 'text-[8px]';
    if (radius <= 20) return 'text-[10px]';
    if (radius <= 30) return 'text-lg';
    return 'text-2xl';
  };

  // Hide percentage text for very small rings
  const showPercentage = !hidePercentage && radius > 15;

  return (
    <div className="relative flex items-center justify-center">
      <svg width={radius * 2 + 20} height={radius * 2 + 20} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={radius + 10}
          cy={radius + 10}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-neutral-100"
        />
        {/* Progress circle */}
        <circle
          cx={radius + 10}
          cy={radius + 10}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="text-brand-500 transition-all duration-500 ease-out"
        />
      </svg>
      {/* Center text */}
      {showPercentage && (
        <div className="absolute flex items-center justify-center">
          <span className={`${getTextSize()} font-bold text-neutral-900`}>{percentage}%</span>
        </div>
      )}
    </div>
  );
}
