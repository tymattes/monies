// A single decorative bar for a list row: length encodes magnitude relative to
// the list's own max, never the numbers themselves (those stay in the text
// beside it — spec 011's rule that a fill is never the only carrier of a
// value, same as CategoryTable's row bars).
export function MiniBar({
  pct,
  colorClassName,
  hatchColor,
}: {
  pct: number;
  colorClassName?: string;
  hatchColor?: string;
}) {
  const width = `${Math.min(Math.max(pct, 0), 100)}%`;
  return (
    <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
      <div
        className={`h-full rounded-full ${colorClassName ?? ""}`}
        style={
          hatchColor
            ? { width, backgroundImage: `repeating-linear-gradient(45deg, ${hatchColor} 0 2px, transparent 2px 5px)` }
            : { width }
        }
      />
    </div>
  );
}

export function pctOf(value: number, max: number) {
  return max > 0 ? (value / max) * 100 : 0;
}
