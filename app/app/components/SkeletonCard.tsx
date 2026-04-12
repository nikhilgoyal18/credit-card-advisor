export function SkeletonCard() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-24 bg-gray-200 rounded-2xl" />
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
    </div>
  );
}
