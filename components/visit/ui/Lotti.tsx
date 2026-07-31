import type { ReactNode } from "react";

/**
 * Lotti — the friendly Kaki Harmoni mascot.
 *
 * ⚠️ PLACEHOLDER: this is a simple hand-drawn SVG stand-in for the real
 * brand mascot illustration. Replace with the final Lotti artwork when ready
 * (keep the same props so callers don't change).
 */

type Variant = "sitting" | "waving" | "celebrating";

export function Lotti({
  variant = "sitting",
  className = "",
  title = "Lotti, the Kaki Harmoni mascot, relaxing with a warm leg soak",
}: {
  variant?: Variant;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 260 240"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>

      {/* plant, left */}
      <g>
        <rect x="20" y="150" width="34" height="40" rx="8" fill="#C9701F" opacity="0.85" />
        <path d="M37 150c-10-6-14-20-8-30 6 6 10 18 8 30Z" fill="#667A55" />
        <path d="M37 150c8-8 10-24 3-33-4 8-6 22-3 33Z" fill="#6F875C" />
        <path d="M37 150c9-4 20-4 26 3-8 2-19 1-26-3Z" fill="#667A55" />
      </g>

      {/* celebrating confetti */}
      {variant === "celebrating" && (
        <g>
          <circle cx="60" cy="40" r="4" fill="#D3A85B" />
          <circle cx="205" cy="50" r="4" fill="#667A55" />
          <rect x="90" y="28" width="7" height="7" rx="2" fill="#EFD6BD" transform="rotate(20 93 31)" />
          <rect x="175" y="30" width="7" height="7" rx="2" fill="#C9D2B8" transform="rotate(-15 178 33)" />
          <circle cx="130" cy="24" r="4" fill="#D3A85B" />
        </g>
      )}

      {/* chair back */}
      <rect x="150" y="70" width="70" height="110" rx="20" fill="#E8D7BB" />
      <rect x="158" y="80" width="54" height="92" rx="14" fill="#EFD6BD" />

      {/* steam from tub */}
      <g stroke="#C9D2B8" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.9">
        <path d="M96 150c-6-6 4-10-2-16" />
        <path d="M120 150c-6-6 4-10-2-16" />
      </g>

      {/* body */}
      <path d="M120 96c22 0 34 16 34 40v26h-70v-26c0-24 12-40 36-40Z" fill="#667A55" />

      {/* arm — waving or resting */}
      {variant === "waving" || variant === "celebrating" ? (
        <path d="M150 120c14-6 22-22 20-34" stroke="#667A55" strokeWidth="14" strokeLinecap="round" fill="none" />
      ) : (
        <path d="M150 128c10 2 16 12 16 24" stroke="#667A55" strokeWidth="14" strokeLinecap="round" fill="none" />
      )}
      {/* resting arm holding cup */}
      <path d="M92 132c-12 2-18 12-18 24" stroke="#667A55" strokeWidth="14" strokeLinecap="round" fill="none" />

      {/* head */}
      <circle cx="120" cy="72" r="30" fill="#F0C9A4" />
      <path d="M90 66c0-20 14-32 30-32s30 12 30 32c-8-6-18-9-30-9s-22 3-30 9Z" fill="#7A5E45" />
      {/* face */}
      <circle cx="110" cy="72" r="3.2" fill="#3F4938" />
      <circle cx="130" cy="72" r="3.2" fill="#3F4938" />
      <path d="M112 82c4 4 12 4 16 0" stroke="#3F4938" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="103" cy="80" r="4" fill="#EFA9A0" opacity="0.6" />
      <circle cx="137" cy="80" r="4" fill="#EFA9A0" opacity="0.6" />

      {/* tea cup, right of resting hand */}
      <g>
        <path d="M60 150h20v8a10 10 0 0 1-20 0Z" fill="#FFFDF8" stroke="#DDD0BB" strokeWidth="2" />
        <path d="M80 152h4a4 4 0 0 1 0 8h-4" fill="none" stroke="#DDD0BB" strokeWidth="2" />
      </g>

      {/* soaking tub */}
      <g>
        <rect x="70" y="176" width="120" height="34" rx="16" fill="#7A5E45" />
        <rect x="76" y="182" width="108" height="18" rx="9" fill="#9FB3C8" opacity="0.35" />
        <path
          d="M78 191c8-5 16-5 24 0s16 5 24 0 16-5 24 0 16 5 24 0"
          fill="none"
          stroke="#667A55"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.7"
        />
      </g>
    </svg>
  );
}

/** Lotti with a handwritten-style speech message beside her. */
export function LottiCard({
  message,
  variant = "sitting",
  className = "",
  children,
}: {
  message?: string;
  variant?: Variant;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className="w-24 shrink-0 sm:w-28">
        <Lotti variant={variant} className="h-auto w-full" />
      </div>
      <div className="relative rounded-[20px] rounded-bl-sm border border-line bg-ivory px-4 py-3 shadow-[var(--shadow-warm)]">
        {message && (
          <p className="text-[17px] italic text-brown" style={{ fontFamily: "var(--font-heading)" }}>
            {message}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
