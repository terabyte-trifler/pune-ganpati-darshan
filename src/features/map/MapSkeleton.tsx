/** Map loading state — a calm ground, never a blocking spinner (§50). */
export function MapSkeleton() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--raat)]">
      {/* Suggestion of a street grid so the area does not read as broken */}
      <svg className="h-full w-full opacity-[0.06]" aria-hidden="true">
        <defs>
          <pattern id="streets" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M0 32h64M32 0v64" stroke="var(--chandan)" strokeWidth="1" fill="none" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#streets)" />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <p className="animate-pulse text-[13px] text-[var(--faint)]">Loading Pune map…</p>
      </div>
    </div>
  );
}
