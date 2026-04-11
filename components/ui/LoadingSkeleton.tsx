type LoadingSkeletonProps = {
  lines?: number;
  className?: string;
};

export default function LoadingSkeleton({ lines = 3, className = '' }: LoadingSkeletonProps) {
  return (
    <div className={`animate-pulse space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="h-3 w-full rounded bg-[#f2dfcf]" />
      ))}
    </div>
  );
}
