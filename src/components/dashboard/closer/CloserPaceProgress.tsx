interface Props {
  realized: number;
  goal: number;
  expectedToday: number;
}

export function CloserPaceProgress({ realized, goal, expectedToday }: Props) {
  const pctRealized = goal > 0 ? Math.min((realized / goal) * 100, 100) : 0;
  const pctExpected = goal > 0 ? Math.min((expectedToday / goal) * 100, 100) : 0;
  return (
    <div className="relative w-full h-3 rounded-full bg-muted overflow-visible">
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all"
        style={{ width: `${pctRealized}%` }}
      />
      <div
        className="absolute -top-1 -bottom-1 w-0.5 bg-foreground/70"
        style={{ left: `calc(${pctExpected}% - 1px)` }}
        title="Pace esperado hoje"
      />
    </div>
  );
}
