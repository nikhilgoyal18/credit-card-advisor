export function AlertCircleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4m0 4v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
      />
    </svg>
  );
}
