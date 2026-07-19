"use client";

import { useRouter } from "next/navigation";

export function DatePicker({ date }: { date: string }) {
  const router = useRouter();
  return (
    <input
      type="date"
      value={date}
      onChange={(e) => router.push(`/reports?date=${e.target.value}`)}
      className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
    />
  );
}
