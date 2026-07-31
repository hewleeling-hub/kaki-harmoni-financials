import Link from "next/link";
import type { ReactNode } from "react";

/* ------------------------------------------------------------------ *
 * Button — one component, three variants. Renders as a Next <Link> for
 * internal hrefs, a plain <a> for external (http/tel/wa) links, or a
 * <button> when given onClick / type. Min height 48px, large radius,
 * strong hover + focus + disabled states.
 * ------------------------------------------------------------------ */

type Variant = "primary" | "secondary" | "promotion";
type Size = "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-olive text-ivory border border-transparent hover:bg-olive-dark shadow-[var(--shadow-warm)] hover:-translate-y-0.5",
  secondary:
    "bg-ivory text-olive-dark border border-olive hover:bg-beige/50 hover:-translate-y-0.5",
  promotion:
    "bg-gold text-[#4a3411] border border-transparent hover:brightness-95 hover:-translate-y-0.5",
};

const SIZES: Record<Size, string> = {
  md: "min-h-12 px-5 text-base",
  lg: "min-h-14 px-7 text-lg",
};

interface ButtonProps {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  disabled?: boolean;
  full?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function Button({
  children,
  href,
  onClick,
  type = "button",
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  disabled,
  full,
  className = "",
  ...rest
}: ButtonProps) {
  const classes = [
    "inline-flex items-center justify-center gap-2 rounded-[26px] font-semibold",
    "transition duration-200 ease-out",
    "disabled:opacity-50 disabled:pointer-events-none",
    VARIANTS[variant],
    SIZES[size],
    full ? "w-full" : "",
    className,
  ].join(" ");

  const inner = (
    <>
      {icon}
      <span>{children}</span>
      {iconRight}
    </>
  );

  const isExternal =
    href && /^(https?:|tel:|mailto:|wa\.me)/.test(href);

  if (href && isExternal) {
    return (
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        className={classes}
        {...rest}
      >
        {inner}
      </a>
    );
  }

  if (href) {
    return (
      <Link href={href} className={classes} {...rest}>
        {inner}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
      {...rest}
    >
      {inner}
    </button>
  );
}

/* ------------------------------ Card ------------------------------ */

export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "li";
}) {
  return (
    <Tag
      className={`rounded-[22px] border border-line bg-ivory p-6 shadow-[var(--shadow-warm)] ${className}`}
    >
      {children}
    </Tag>
  );
}

/* -------------------------- SectionHeading ------------------------- */

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  center,
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  center?: boolean;
  className?: string;
}) {
  return (
    <div className={`${center ? "text-center mx-auto" : ""} max-w-2xl ${className}`}>
      {eyebrow && (
        <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-olive">
          {eyebrow}
        </p>
      )}
      <h2 className="text-[26px] leading-tight text-olive-dark sm:text-[30px]">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 text-lg text-muted">{subtitle}</p>
      )}
    </div>
  );
}

/* ----------------------------- Badge ------------------------------ */

export function Badge({
  children,
  tone = "olive",
}: {
  children: ReactNode;
  tone?: "olive" | "gold" | "sage";
}) {
  const tones: Record<string, string> = {
    olive: "bg-olive/12 text-olive-dark",
    gold: "bg-gold/20 text-[#7a5410]",
    sage: "bg-sage/50 text-olive-dark",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/* ------------------------ PlaceholderImage ------------------------ *
 * A clearly-marked stand-in until real shop photography is added.
 * Swap for a <next/image> when the real asset lands.
 */
export function PlaceholderImage({
  label,
  ratio = "4 / 3",
  className = "",
}: {
  label: string;
  ratio?: string;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={`Placeholder image: ${label}`}
      className={`relative overflow-hidden rounded-[24px] border border-line ${className}`}
      style={{ aspectRatio: ratio, background: "linear-gradient(135deg,#EFD6BD 0%,#C9D2B8 100%)" }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-4 text-center">
        <span className="rounded-full bg-ivory/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brown">
          Placeholder
        </span>
        <span className="text-sm font-medium text-olive-dark/80">{label}</span>
      </div>
    </div>
  );
}
