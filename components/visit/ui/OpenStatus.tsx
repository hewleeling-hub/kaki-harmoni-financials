"use client";

import { useEffect, useState } from "react";
import { businessConfig } from "@/config/business";

type Status = "open" | "closing" | "closed";

/** Current hour (0–23, with fraction) in Malaysia, regardless of viewer TZ. */
function klHourNow(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: businessConfig.openingHours.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour + minute / 60;
}

function compute(): Status {
  const { openHour, closeHour } = businessConfig.openingHours;
  const now = klHourNow();
  if (now < openHour || now >= closeHour) return "closed";
  if (now >= closeHour - 0.5) return "closing"; // within 30 min of close
  return "open";
}

const LABELS: Record<Status, { text: string; dot: string; className: string }> = {
  open: { text: "Open now", dot: "#6F875C", className: "bg-success/15 text-[#3c5230]" },
  closing: { text: "Closing soon", dot: "#D3A85B", className: "bg-gold/20 text-[#7a5410]" },
  closed: { text: "Closed", dot: "#7A5E45", className: "bg-brown/15 text-brown" },
};

export function OpenStatus({ className = "" }: { className?: string }) {
  // Start null so server + first client render match (avoids hydration flash).
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    setStatus(compute());
    const id = setInterval(() => setStatus(compute()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!status) {
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold bg-line/40 text-muted ${className}`}
      >
        {businessConfig.openingHours.label}
      </span>
    );
  }

  const l = LABELS[status];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${l.className} ${className}`}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.dot }} aria-hidden />
      {l.text}
    </span>
  );
}
