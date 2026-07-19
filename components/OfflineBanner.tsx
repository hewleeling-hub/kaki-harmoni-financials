"use client";

import { useEffect, useState } from "react";
import { getQueueLength, flushQueue, onQueueChange } from "@/lib/offlineQueue";

// Sprint 4: visible "offline — sales queued" banner + auto-flush on reconnect.
export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    setOnline(navigator.onLine);
    setQueued(getQueueLength());

    const goOnline = async () => {
      setOnline(true);
      await flushQueue();
      setQueued(getQueueLength());
    };
    const goOffline = () => setOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const off = onQueueChange(() => setQueued(getQueueLength()));

    // Attempt a flush on mount in case we reloaded while items were queued.
    if (navigator.onLine) flushQueue().then(() => setQueued(getQueueLength()));

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      off();
    };
  }, []);

  if (online && queued === 0) return null;

  return (
    <div
      className={`w-full px-4 py-2 text-center text-sm font-medium ${
        online ? "bg-amber-500 text-white" : "bg-red-600 text-white"
      }`}
    >
      {online
        ? `Syncing ${queued} queued ${queued === 1 ? "sale" : "sales"}…`
        : `Offline — ${queued} ${queued === 1 ? "sale" : "sales"} queued, will sync when online`}
    </div>
  );
}
