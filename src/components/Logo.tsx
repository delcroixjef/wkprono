export function Logo({ size = 36 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0"
      style={{ width: size, height: size }}
      aria-label="WelZeker"
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v18M3 12h18M5.5 6.5l13 11M18.5 6.5l-13 11" opacity="0.5" />
      </svg>
    </div>
  );
}
