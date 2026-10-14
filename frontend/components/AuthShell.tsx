import Link from "next/link";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Mark, MetricCard, Pill } from "@/components/brand";

export default function AuthShell({
  badge,
  title,
  blurb,
  bullets,
  footnote,
  children,
}: {
  badge: string;
  title: ReactNode;
  blurb: string;
  bullets: string[];
  footnote: string;
  children: ReactNode;
}) {
  return (
    <section className="ff-display min-h-screen bg-white">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
        {/* visual panel */}
        <div className="relative isolate flex flex-col justify-between overflow-hidden bg-[#1d2a09] px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
          <img
            src="/hero-field.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/30 to-black/70" />

          <div className="relative flex items-center justify-between gap-6">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-white"
              aria-label="Dream Job Made Easy home"
            >
              <Mark className="h-7 w-7" />
              <span className="text-[17px] font-semibold tracking-[-0.01em]">
                Dream Job Made Easy
              </span>
            </Link>
            <Link
              href="/pricing"
              className="hidden text-[13px] text-white/70 transition hover:text-white sm:inline"
            >
              See the price
            </Link>
          </div>

          <div className="relative mt-12 grid gap-8 lg:mt-0 lg:grid-cols-2 lg:items-end">
            <div>
              <Pill tone="dark">{badge}</Pill>
              <h2 className="ff-display mt-6 text-[34px] font-semibold leading-[1.06] tracking-[-0.035em] text-white sm:text-[42px]">
                {title}
              </h2>
              <p className="mt-4 max-w-[430px] text-[14.5px] leading-relaxed text-white/65">
                {blurb}
              </p>
              <ul className="mt-7 max-w-[430px] space-y-2.5">
                {bullets.map((b) => (
                  <li
                    key={b}
                    className="flex items-center gap-3 rounded-xl bg-white/[0.07] px-4 py-3 text-[13.5px] text-white/85 backdrop-blur-sm"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#dff77e] text-neutral-900">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            <div className="hidden justify-end lg:flex">
              <MetricCard label="Tape 01" caption="Finish rate" />
            </div>
          </div>

          <p className="relative mt-12 text-[11.5px] text-white/55">{footnote}</p>
        </div>

        {/* form panel */}
        <div className="flex items-center justify-center px-5 py-14 sm:px-10 lg:px-14">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
      </div>
    </section>
  );
}
