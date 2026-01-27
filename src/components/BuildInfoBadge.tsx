import { getAppVersion } from "@/hooks/useAppVersion";

export function BuildInfoBadge() {
  const version = getAppVersion();
  const buildTime = import.meta.env.VITE_BUILD_TIME || "unknown";

  return (
    <div
      className="fixed bottom-2 left-2 z-50 rounded-md border bg-background/80 px-2 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur pointer-events-none"
      aria-label="Build information"
    >
      <span className="font-mono">
        {version} • {buildTime}
      </span>
    </div>
  );
}
