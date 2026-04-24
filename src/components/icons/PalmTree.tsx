export function PalmTree({
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
      <path d="M12 22V10" />
      <path d="M12 10c0-3-2-5-6-5-1.5 0-2.5.5-3 1" />
      <path d="M12 10c0-3 2-5 6-5 1.5 0 2.5.5 3 1" />
      <path d="M12 10c-2.5-1.5-5-2-8-1" />
      <path d="M12 10c2.5-1.5 5-2 8-1" />
      <path d="M9.5 22h5" />
    </svg>
  );
}
