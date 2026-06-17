import type { AppMode } from "@/types";

function WaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]">
      <path
        d="M2 17c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 12c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"
        stroke="#04201f"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const MODE_LABEL: Record<AppMode, string> = {
  live: "Live store",
  dry_run: "Dry run (safe)",
  demo: "Demo",
};

const MODE_DOT: Record<AppMode, string> = {
  live: "bg-[#3ED598] shadow-[0_0_0_3px_rgba(62,213,152,0.18)]",
  dry_run: "bg-[#FFB454] shadow-[0_0_0_3px_rgba(255,180,84,0.18)]",
  demo: "bg-muted",
};

interface AppHeaderProps {
  activeView: "builder" | "quotes";
  mode?: AppMode;
  openQuoteCount?: number;
  onNavBuilder?: () => void;
  onNavQuotes?: () => void;
  onSettings?: () => void;
}

export function AppHeader({
  activeView,
  mode = "demo",
  openQuoteCount = 0,
  onNavBuilder,
  onNavQuotes,
  onSettings,
}: AppHeaderProps) {
  return (
    <header className="flex items-center gap-3.5 bg-ink px-5 py-3.5 text-white">
      <div className="flex items-center gap-[11px]">
        <div className="grid h-[30px] w-[30px] flex-none place-items-center rounded-lg bg-gradient-to-br from-teal to-[#1AA59E] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]">
          <WaveIcon />
        </div>
        <div>
          <h1 className="font-display text-[15.5px] font-semibold tracking-[0.2px]">
            System Builder
          </h1>
          <div className="mt-px text-[10.5px] uppercase tracking-[0.5px] text-[#88A6B5]">
            Scubapix POS · BigCommerce
          </div>
        </div>
      </div>

      <nav className="ml-[18px] flex gap-1">
        <button
          type="button"
          onClick={onNavBuilder}
          className={`rounded-lg px-[13px] py-[7px] font-display text-[13px] font-medium ${
            activeView === "builder"
              ? "bg-white/13 text-white"
              : "text-[#9DB0C9] hover:bg-white/[0.07] hover:text-white"
          }`}
        >
          Builder
        </button>
        <button
          type="button"
          onClick={onNavQuotes}
          className={`rounded-lg px-[13px] py-[7px] font-display text-[13px] font-medium ${
            activeView === "quotes"
              ? "bg-white/13 text-white"
              : "text-[#9DB0C9] hover:bg-white/[0.07] hover:text-white"
          }`}
        >
          Open quotes
          {openQuoteCount > 0 && (
            <span className="ml-1.5 rounded-full bg-teal px-1.5 py-px font-mono text-[10px] text-[#04201f]">
              {openQuoteCount}
            </span>
          )}
        </button>
      </nav>

      <div
        className="ml-auto flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.07] px-[11px] py-1.5 font-mono text-[11.5px]"
        title="Connection mode"
      >
        <span className={`h-[7px] w-[7px] flex-none rounded-full ${MODE_DOT[mode]}`} />
        <span>{MODE_LABEL[mode]}</span>
      </div>

      <button
        type="button"
        onClick={onSettings}
        className="grid h-8 w-8 place-items-center rounded-lg border border-white/14 bg-white/[0.08] text-[15px] leading-none text-[#CFE0E8] hover:bg-white/16"
        title="Settings"
        aria-label="Settings"
      >
        &#9881;
      </button>
    </header>
  );
}
