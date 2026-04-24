export function Rose({
  size = 16,
  strokeWidth = 1.5,
}: {
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="9" r="2.4" />
      <path d="M12 6.6c-.8-1.2-.6-2.6.6-3.2" />
      <path d="M12 6.6c.8-1.2.6-2.6-.6-3.2" />
      <path d="M9.6 9c-1.4 0-2.6-.8-2.8-2.2" />
      <path d="M14.4 9c1.4 0 2.6-.8 2.8-2.2" />
      <path d="M10.4 10.8C9 11.4 7.6 11 7 9.6" />
      <path d="M13.6 10.8c1.4.6 2.8.2 3.4-1.2" />
      <path d="M12 11.4V22" />
      <path d="M12 15c-2 0-3.5 1-4 3" />
      <path d="M12 17c2 0 3.5 1 4 3" />
    </svg>
  );
}
