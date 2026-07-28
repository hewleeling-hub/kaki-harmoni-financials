"use client";

import { useRouter } from "next/navigation";

export function ReportControls({
  period,
  date,
  month,
  start,
  end,
  basePath = "/reports",
}: {
  period: "day" | "month" | "range";
  date: string;
  month: string;
  start: string;
  end: string;
  basePath?: string;
}) {
  const router = useRouter();

  function go(next: Record<string, string>) {
    const qs = new URLSearchParams(next).toString();
    router.push(`${basePath}?${qs}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={period}
        onChange={(e) => {
          const p = e.target.value;
          if (p === "month") go({ period: "month", month });
          else if (p === "range") go({ period: "range", start, end });
          else go({ period: "day", date });
        }}
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      >
        <option value="day">Day</option>
        <option value="month">Month</option>
        <option value="range">Range</option>
      </select>

      {period === "month" && (
        <input
          type="month"
          value={month}
          onChange={(e) => go({ period: "month", month: e.target.value })}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      )}

      {period === "day" && (
        <input
          type="date"
          value={date}
          onChange={(e) => go({ period: "day", date: e.target.value })}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      )}

      {period === "range" && (
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={start}
            max={end}
            onChange={(e) => go({ period: "range", start: e.target.value, end })}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <span className="text-neutral-400">→</span>
          <input
            type="date"
            value={end}
            min={start}
            onChange={(e) => go({ period: "range", start, end: e.target.value })}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      )}
    </div>
  );
}
