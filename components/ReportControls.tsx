"use client";

import { useRouter } from "next/navigation";

export function ReportControls({
  period,
  date,
  month,
  basePath = "/reports",
}: {
  period: "day" | "month";
  date: string;
  month: string;
  basePath?: string;
}) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <select
        value={period}
        onChange={(e) =>
          router.push(
            e.target.value === "month"
              ? `${basePath}?period=month&month=${month}`
              : `${basePath}?period=day&date=${date}`,
          )
        }
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      >
        <option value="day">Day</option>
        <option value="month">Month</option>
      </select>
      {period === "month" ? (
        <input
          type="month"
          value={month}
          onChange={(e) =>
            router.push(`${basePath}?period=month&month=${e.target.value}`)
          }
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      ) : (
        <input
          type="date"
          value={date}
          onChange={(e) =>
            router.push(`${basePath}?period=day&date=${e.target.value}`)
          }
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      )}
    </div>
  );
}
