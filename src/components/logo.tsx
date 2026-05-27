export function Logo({ size = 36, variant = "default" }: { size?: number; variant?: "default" | "onDark" }) {
  const onDark = variant === "onDark";
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 48 48" className="shrink-0">
        <circle cx="24" cy="20" r="18" fill="none" stroke={onDark ? "rgba(255,255,255,0.9)" : "hsl(var(--gold) / 0.9)"} strokeWidth="2" />
        <path
          d="M24 4c-7.7 0-14 6.3-14 14 0 10.5 14 26 14 26s14-15.5 14-26c0-7.7-6.3-14-14-14z"
          fill={onDark ? "#ffffff" : "hsl(var(--navy))"}
        />
        <circle cx="24" cy="18" r="5" fill={onDark ? "hsl(var(--navy))" : "hsl(var(--gold))"} />
      </svg>
      <div className="leading-none">
        <div className={`text-base font-bold ${onDark ? "text-white" : "text-foreground"}`}>جميل ماب</div>
        <div className={`text-[10px] font-medium uppercase tracking-widest ${onDark ? "text-white/80" : "text-muted-foreground"}`}>JAMEEL MAP</div>
      </div>
    </div>
  );
}
