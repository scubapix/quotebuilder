import type { QuoteStatus } from "@/types";

const STYLES: Record<QuoteStatus, string> = {
  draft: "bg-[#EEF1F3] text-[#5B6B75]",
  sent: "bg-[#E9F0FB] text-[#36568C]",
  accepted: "bg-[#FFF3E2] text-[#8A560B]",
  ordered: "bg-[#E7F4EC] text-[#1E6B43]",
};

export function StatusPill({ status }: { status: QuoteStatus }) {
  return (
    <span
      className={`rounded-full px-[7px] py-0.5 font-mono text-[10px] uppercase tracking-[0.3px] ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
