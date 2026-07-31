import Link from "next/link";

/** Kaki Harmoni wordmark — teal "Kaki" + terracotta "Harm♥ni", warm variant. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/visit"
      aria-label="Kaki Harmoni — home"
      className={`inline-flex flex-col leading-none ${className}`}
    >
      <span className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
        <span className="text-olive">Kaki</span>{" "}
        <span className="text-brown">
          Harm<span aria-hidden="true" className="text-[#c2724f]">♥</span>ni
        </span>
      </span>
      <span className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
        Relax • Refresh • Reconnect
      </span>
    </Link>
  );
}
