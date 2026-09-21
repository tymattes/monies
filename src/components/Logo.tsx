export default function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="9" fill="currentColor" />
        <path
          d="M9 22V10l7 8 7-8v12"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-lg font-semibold tracking-tight text-foreground">
        Monies
      </span>
    </span>
  );
}
