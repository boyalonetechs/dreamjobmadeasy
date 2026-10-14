import Link from "next/link";
import type { ReactNode } from "react";
import { Asterisk, ArrowUpRight } from "lucide-react";

export const BRAND = "Dream Job Made Easy";

/* ------------------------------------------------------------------ */
/* mark                                                                */
/* ------------------------------------------------------------------ */
export function Mark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden>
      <circle
        cx="20"
        cy="20"
        r="16.4"
        stroke="currentColor"
        strokeWidth="3.2"
      />
      <path
        d="M27 14.6c-3.6-2.5-9.5-2.1-11.8 1.4-1.8 2.8.4 5.7 3.8 6.4 3.6.7 6 3.4 4.8 6.2-1.5 3.5-7.4 4.5-11.4 1.9"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({
  className = "",
  markClass = "h-7 w-7",
}: {
  className?: string;
  markClass?: string;
}) {
  return (
    <Link
      href="/"
      className={`flex items-center gap-2.5 ${className}`}
      aria-label={`${BRAND} home`}
    >
      <Mark className={markClass} />
      <span className="text-[17px] font-semibold tracking-[-0.01em]">
        Dream Job Made Easy
      </span>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* pill badge                                                          */
/* ------------------------------------------------------------------ */
export function Pill({
  children,
  tone = "light",
  className = "",
}: {
  children: ReactNode;
  tone?: "light" | "soft" | "dark";
  className?: string;
}) {
  const tones = {
    light: "bg-white text-neutral-800 border border-black/10",
    soft: "bg-[#ecfba8] text-neutral-900 border border-transparent",
    dark: "bg-white/5 text-white/85 border border-white/15",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] ${tones[tone]} ${className}`}
    >
      <Asterisk className="h-3 w-3 shrink-0" strokeWidth={2.4} />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* buttons                                                             */
/* ------------------------------------------------------------------ */
const CTA_TONES = {
  dark: "bg-neutral-900 text-white hover:bg-neutral-700",
  light: "bg-white text-neutral-900 hover:bg-neutral-100",
  lime: "bg-[#dff77e] text-neutral-900 hover:bg-[#d2f05f]",
  outline: "border border-white/25 text-white hover:bg-white/10",
} as const;

export function Cta({
  href = "/pricing",
  children,
  tone = "dark",
  className = "",
}: {
  href?: string;
  children: ReactNode;
  tone?: keyof typeof CTA_TONES;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-[13px] font-medium transition ${CTA_TONES[tone]} ${className}`}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* stat tile (who we are)                                              */
/* ------------------------------------------------------------------ */
export function Stat({
  value,
  badge,
  badgeClass,
  body,
  foot,
}: {
  value: string;
  badge: string;
  badgeClass: string;
  body: string;
  foot: string;
}) {
  return (
    <div className="p-5">
      <div className="flex items-center gap-2">
        <span className="ff-display text-[34px] font-semibold leading-none tracking-[-0.04em] text-neutral-900">
          {value}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}
        >
          {badge}
        </span>
      </div>
      <p className="mt-3.5 text-[12.5px] leading-snug text-neutral-500">
        {body}
      </p>
      <p className="mt-5 flex items-center gap-1.5 text-[11px] text-neutral-400">
        <ArrowUpRight className="h-3.5 w-3.5" />
        {foot}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* floating metric card                                                */
/* ------------------------------------------------------------------ */
export function MetricCard({
  dark = false,
  label = "Tape 01",
  value = "98%",
  caption = "Finish rate",
  badge = "UP",
  className = "",
}: {
  dark?: boolean;
  label?: string;
  value?: string;
  caption?: string;
  badge?: string;
  className?: string;
}) {
  const glyph = (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
      <rect x="3" y="3" width="6" height="6" rx="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1.5" />
      <rect x="11" y="11" width="6" height="6" rx="3" />
    </svg>
  );

  if (dark) {
    return (
      <div
        className={`rounded-2xl bg-neutral-950 p-4 text-white ${className}`}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#7c5cf7]/25 text-[#28c86b]">
            {glyph}
          </span>
          <span className="text-right text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">
            {label}
          </span>
        </div>
        <svg viewBox="0 0 180 44" className="mt-3.5 h-9 w-full">
          <polyline
            points="0,36 20,30 38,33 56,22 74,26 92,14 110,18 128,9 146,13 164,5 180,8"
            fill="none"
            stroke="#8b7cf6"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-400">
            {badge}
          </span>
          <span className="ff-display text-[26px] font-semibold leading-none tracking-[-0.03em]">
            {value}
          </span>
        </div>
        <p className="mt-1 text-[11.5px] text-white/45">{caption}</p>
      </div>
    );
  }

  return (
    <div
      className={`w-[210px] rounded-2xl bg-white p-4 shadow-[0_28px_50px_-24px_rgba(0,0,0,0.6)] ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#28c86b]/15 text-[#28c86b]">
          {glyph}
        </span>
        <span className="text-right text-[9.5px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
          {label}
        </span>
      </div>
      <svg viewBox="0 0 180 44" className="mt-4 h-11 w-full">
        <polyline
          points="0,36 20,30 38,33 56,22 74,26 92,14 110,18 128,9 146,13 164,5 180,8"
          fill="none"
          stroke="#7c5cf7"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-2 flex items-center gap-2">
        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-emerald-600">
          {badge}
        </span>
        <span className="ff-display text-[26px] font-semibold leading-none tracking-[-0.03em] text-neutral-900">
          {value}
        </span>
      </div>
      <p className="mt-1 text-[12px] text-neutral-400">{caption}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* form field                                                          */
/* ------------------------------------------------------------------ */
export const inputCls =
  "w-full rounded-xl border border-neutral-200 bg-white px-4 py-3.5 text-[14px] text-neutral-900 placeholder:text-neutral-400 transition focus:border-neutral-900 focus:outline-none focus:ring-4 focus:ring-neutral-900/5";
