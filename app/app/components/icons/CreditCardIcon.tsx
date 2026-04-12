export function CreditCardIcon({ className = 'h-5 w-5' }: { className?: string }) {
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
        d="M3 10h18M3 10a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2m0 0v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8m0 0V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2"
      />
    </svg>
  );
}
