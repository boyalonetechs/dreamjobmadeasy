"use client";
import Link from "next/link";
import {
  Aperture,
  Asterisk,
  Grid3x3,
  Hourglass,
  Star,
  ArrowUpRight,
} from "lucide-react";
import { Cta, Mark, MetricCard, Pill, Stat } from "@/components/brand";
import { useAuth } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/* data                                                                */
/* ------------------------------------------------------------------ */
const NAV = [
  { label: "Tapes", href: "#tapes" },
  { label: "How it works", href: "#how" },
  { label: "Pricing", href: "/pricing" },
  { label: "Reviews", href: "#reviews" },
  { label: "About", href: "#about" },
];

const PILLARS = [
  { icon: Aperture, label: "CV & Cover Letters" },
  { icon: Asterisk, label: "Interview Answers" },
  { icon: Grid3x3, label: "LinkedIn & Aptitude" },
  { icon: Hourglass, label: "Salary & Remote Pay" },
];

const SUITE = [
  {
    title: "LinkedIn that brings offers",
    body: "The headline, the about section and the thirty-minute routine behind 40+ interviews.",
  },
  {
    title: "Aptitude tests without panic",
    body: "SHL, Dragnet and Workforce patterns with drills you can run the night before.",
  },
  {
    title: "Salary talk without fear",
    body: "Quote in naira and dollars, know your number before they ask, and hold your ground.",
  },
];

const FOOTER_LINKS = [
  ["All 8 tapes", "Pricing", "Pay in naira", "Pay in dollars"],
  ["Refunds", "Privacy", "Terms"],
];

const CREDITS = [
  ["©Dream Job Made Easy", "Made with care"],
  ["Instagram", "@dreamjobmadeeasy"],
  ["Support", "hello@dreamjobmadeeasy.com"],
  ["Pay with", "Paystack & PayPal"],
];

const TICKER = [
  "CV",
  "Cover Letters",
  "LinkedIn",
  "Aptitude",
  "Interviews",
  "Salary",
  "Remote",
  "Offers",
];

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */
export default function LandingPage() {
  const { user } = useAuth();
  // Unlock routes straight to the shelf when signed in, otherwise to login.
  const unlockHref = user ? "/dashboard" : "/login";

  return (
    <div className="ff-display bg-white text-neutral-900 antialiased">
      {/* ============================= HERO ============================= */}
      <section className="relative isolate min-h-[640px] overflow-hidden bg-[#1d2a09] lg:min-h-[840px]">
        <img
          src="/hero-field.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/5 to-black/55" />

        {/* header */}
        <header className="absolute inset-x-0 top-0 z-20">
          <div className="mx-auto flex max-w-[1360px] justify-between items-center gap-8 px-5 py-6 sm:px-8 lg:px-12">
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
            <nav className="hidden items-center gap-7 text-[13.5px] text-white/85 lg:flex">
              {NAV.map((n) => (
                <Link
                  key={n.label}
                  href={n.href}
                  className="transition hover:text-white"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-4 sm:gap-6">
              <Link
                href={unlockHref}
                className="rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-black hover:text-white transition hover:bg-black"
              >
                Unlock tapes
              </Link>
            </div>
          </div>
        </header>

        {/* hero body */}
        <div className="relative z-10 mx-auto flex min-h-[680px] max-w-[1360px] flex-col px-5 pb-12 pt-32 sm:px-8 lg:min-h-[680px] 2xl:min-h-[840px] lg:px-12 lg:pb-16">
          {/* floating metric card — pinned under the header on desktop */}
          <div className="absolute right-12 top-[104px] hidden xl:block">
            <MetricCard label="Tape 01" caption="Finish rate" />
          </div>

          <div className="mt-auto grid grid-cols-12 items-end gap-8">
            <div className="col-span-12 lg:col-span-8">
              <h1 className="ff-display text-[clamp(56px,9.4vw,132px)] font-semibold leading-[0.92] tracking-[-0.045em] text-white">
                Get Hired
                <br />
                Faster
                <span className="align-super text-[0.28em] font-medium tracking-normal">
                  ©
                </span>
              </h1>
            </div>

            <div className="col-span-12 lg:col-span-4 lg:self-end">
              <div className="mb-8 flex justify-start xl:hidden ">
                <MetricCard label="Tape 01" caption="Finish rate" />
              </div>

              {/* hero stats */}
              <div className="lg:mb-14 lg:w-[230px]">
                <div className="flex items-start gap-2.5">
                  <Asterisk
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#d9f55c]"
                    strokeWidth={2.5}
                  />
                  <div>
                    <p className="text-[14px] font-semibold text-white">
                      4.9 Rated
                    </p>
                    <p className="text-[11.5px] leading-snug text-white/60">
                      By listeners who got the offer
                    </p>
                  </div>
                </div>
                <div className="mt-5 lg:pl-6">
                  <p className="text-[22px] font-semibold tracking-[-0.02em] text-white">
                    8 Tapes
                  </p>
                  <p className="text-[11.5px] text-white/60">3 hrs 26 min</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* eight tapes                                                 */}
      {/* ---------------------------------------------------------- */}
      <section id="tapes" className="bg-white">
        <div className="mx-auto max-w-[1360px] px-5 py-20 text-center sm:px-8 lg:px-12 lg:py-28">
          <Pill tone="soft">Eight tapes · one payment</Pill>
          <h2 className="ff-display mx-auto mt-7 max-w-[760px] text-[30px] font-semibold leading-[1.14] tracking-[-0.03em] text-neutral-900 sm:text-[38px] lg:text-[44px]">
            The only job-hunting guide
            <br className="hidden sm:block" /> you&apos;ll actually finish.
          </h2>

          <div className="mt-14 grid grid-cols-2 gap-y-10 sm:grid-cols-4">
            {PILLARS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-neutral-100 text-neutral-900">
                  <Icon className="h-[21px] w-[21px]" strokeWidth={1.8} />
                </span>
                <p className="mt-4 text-[13.5px] font-medium text-neutral-800">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* feature row 1                                               */}
      {/* ---------------------------------------------------------- */}
      <section id="how" className="bg-white">
        <div className="mx-auto grid max-w-[1360px] items-center gap-10 px-5 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:px-12">
          <div className="rounded-[28px] bg-gradient-to-br from-[#eef5d6] via-[#f6f8ee] to-[#dde8bd] p-5 sm:p-8 lg:p-10">
            <div className="ps-card bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[12.5px] font-medium text-neutral-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Everything unlocked
                </span>
                <span className="text-[11.5px] text-neutral-400">
                  One payment
                </span>
              </div>

              <div className="mt-4 flex items-center gap-2.5">
                <span className="ff-display text-[34px] font-semibold leading-none tracking-[-0.03em] text-neutral-900">
                  8 Tapes
                </span>
                <span className="rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-600">
                  100%
                </span>
              </div>
              <p className="mt-2 text-[12px] text-neutral-400">
                One payment —{" "}
                <span className="font-semibold text-emerald-600">₦15,000</span>{" "}
                or $19 — opens every chapter
              </p>

              <div className="relative mt-7">
                <div className="h-9 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500" />
                </div>
                <span className="absolute -top-3 left-[54%] rounded-md border border-neutral-100 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-800 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.35)]">
                  3h 26m
                </span>
              </div>

              <div className="mt-7 grid grid-cols-3 gap-3 border-t border-neutral-100 pt-4">
                {[
                  ["3h 26m", "Total runtime"],
                  ["8", "Tapes"],
                  ["∞", "Lifetime replays"],
                ].map(([v, k]) => (
                  <div key={k}>
                    <p className="ff-display text-[17px] font-semibold tracking-[-0.02em] text-neutral-900">
                      {v}
                    </p>
                    <p className="text-[11px] text-neutral-400">{k}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pb-4 lg:pb-0">
            <Pill>Get shortlisted</Pill>
            <h2 className="ff-display mt-6 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] text-neutral-900 sm:text-[38px] lg:text-[42px]">
              A CV that gets
              <br className="hidden sm:block" /> shortlisted.
            </h2>
            <p className="mt-5 max-w-[440px] text-[14.5px] leading-relaxed text-neutral-500">
              The one-page format recruiters actually read, the cover letter
              that gets a reply, and the LinkedIn headline that brings the
              offers.
            </p>
            <div className="mt-7">
              <Cta href={unlockHref}>Unlock all 8 tapes</Cta>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* feature row 2                                               */}
      {/* ---------------------------------------------------------- */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-[1360px] items-center gap-10 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:px-12 lg:py-28">
          <div className="order-2 lg:order-1">
            <Pill>Get signed</Pill>
            <h2 className="ff-display mt-6 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] text-neutral-900 sm:text-[38px] lg:text-[42px]">
              Interview answers that
              <br className="hidden sm:block" /> sound like you.
            </h2>
            <p className="mt-5 max-w-[440px] text-[14.5px] leading-relaxed text-neutral-500">
              Frameworks for the twelve hardest questions, a salary number you
              can defend, and where the remote listings with dollar pay actually
              hide.
            </p>
            <div className="mt-7">
              <Cta href={unlockHref}>Unlock all 8 tapes</Cta>
            </div>
          </div>

          <div className="order-1 rounded-[28px] bg-gradient-to-br from-[#eef2f7] via-[#f7f8f4] to-[#e3ecd2] p-5 sm:p-8 lg:order-2 lg:p-10">
            <div className="ps-card bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-medium text-neutral-700">
                  Salary after the tapes
                </span>
                <span className="text-[11.5px] text-neutral-400">2025</span>
              </div>

              <div className="mt-4 flex items-center gap-2.5">
                <span className="ff-display text-[34px] font-semibold leading-none tracking-[-0.03em] text-neutral-900">
                  $85k
                </span>
                <span className="rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-600">
                  +22%
                </span>
              </div>
              <p className="mt-2 text-[12px] text-neutral-400">
                <span className="font-semibold text-emerald-600">+$15k</span> on
                your last role
              </p>

              <div className="relative mt-6 rounded-2xl bg-neutral-50 px-3 pb-2 pt-4">
                <span className="absolute left-4 top-9 text-[10.5px] text-neutral-400">
                  $120k
                </span>
                <span className="absolute bottom-7 left-4 text-[10.5px] text-neutral-400">
                  $40k
                </span>
                <svg
                  viewBox="0 0 340 150"
                  preserveAspectRatio="none"
                  className="h-[150px] w-full"
                >
                  <defs>
                    <linearGradient id="arrFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#4f46e5"
                        stopOpacity="0.32"
                      />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,132 C34,128 56,124 82,116 C110,107 130,96 156,84 C184,71 206,60 232,48 C258,36 286,26 340,14 L340,150 L0,150 Z"
                    fill="url(#arrFill)"
                  />
                  <path
                    d="M0,132 C34,128 56,124 82,116 C110,107 130,96 156,84 C184,71 206,60 232,48 C258,36 286,26 340,14"
                    fill="none"
                    stroke="#4f46e5"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle cx="232" cy="48" r="5.5" fill="#4f46e5" />
                </svg>
                <span className="absolute right-[24%] top-[24%] rounded-md bg-indigo-600 px-2 py-1 text-[10.5px] font-semibold text-white shadow-lg">
                  $85,000
                </span>
              </div>

              <div className="mt-3 grid grid-cols-4 text-center text-[10.5px] text-neutral-400">
                <span>May</span>
                <span>Jun</span>
                <span>Jul</span>
                <span>Aug</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* suite — black                                               */}
      {/* ---------------------------------------------------------- */}
      <section id="reviews" className="bg-neutral-950 text-white">
        <div className="mx-auto max-w-[1360px] px-5 py-20 sm:px-8 lg:px-12 lg:py-24">
          <div className="text-center">
            <Pill tone="dark">All 8 tapes</Pill>
            <h2 className="ff-display mx-auto mt-7 max-w-[760px] text-[30px] font-semibold leading-[1.14] tracking-[-0.03em] sm:text-[38px] lg:text-[44px]">
              Eight tapes.
              <br className="hidden sm:block" /> One job offer.
            </h2>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {/* card 1 */}
            <div>
              <div className="relative overflow-hidden rounded-2xl">
                <img
                  src="/card-cap-man.jpg"
                  alt="Listener reviewing notes before an interview"
                  className="h-[300px] w-full object-cover object-top lg:h-[340px]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/25" />
                <span className="absolute left-5 top-5 text-[11px] font-medium leading-tight text-white/85">
                  Tapes 01-04
                </span>
              </div>
              <h3 className="ff-display mt-6 text-[19px] font-semibold tracking-[-0.02em]">
                {SUITE[0].title}
              </h3>
              <p className="mt-2.5 max-w-[360px] text-[13.5px] leading-relaxed text-white/50">
                {SUITE[0].body}
              </p>
            </div>

            {/* card 2 — tape overview */}
            <div>
              <div className="relative h-[300px] overflow-hidden rounded-2xl bg-[#71912c] p-5 lg:h-[340px]">
                <div className="rounded-xl bg-white p-4 text-neutral-900">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[13px] font-semibold">Tape overview</p>
                    <p className="text-right text-[9.5px] leading-tight text-neutral-400">
                      8 tapes
                      <br />
                      3h 26m
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-neutral-50 p-3">
                      <p className="text-[9.5px] text-neutral-400">Playing</p>
                      <p className="text-[10.5px] text-neutral-500">Tape 01</p>
                      <div className="mt-2.5 flex items-end gap-1.5">
                        <span className="ff-display text-[24px] font-semibold leading-none tracking-[-0.03em]">
                          01
                        </span>
                        <span className="mb-0.5 rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-bold text-emerald-600">
                          Now
                        </span>
                      </div>
                    </div>
                    <div className="rounded-lg bg-neutral-50 p-3">
                      <p className="text-[9.5px] text-neutral-400">Up next</p>
                      <p className="text-[10.5px] text-neutral-500">Tape 02</p>
                      <div className="mt-2.5 flex items-end gap-1.5">
                        <span className="ff-display text-[24px] font-semibold leading-none tracking-[-0.03em]">
                          02
                        </span>
                        <span className="mb-0.5 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold text-amber-600">
                          Next
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-[9.5px] text-neutral-400">
                    <span>0:00 – 24:10</span>
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5">
                      A CV that gets shortlisted
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex gap-1.5">
                  {[...Array(8)].map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 flex-1 rounded-full ${
                        i < 4 ? "bg-white/85" : "bg-white/30"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <h3 className="ff-display mt-6 text-[19px] font-semibold tracking-[-0.02em]">
                {SUITE[1].title}
              </h3>
              <p className="mt-2.5 max-w-[360px] text-[13.5px] leading-relaxed text-white/50">
                {SUITE[1].body}
              </p>
            </div>

            {/* card 3 */}
            <div>
              <div className="relative overflow-hidden rounded-2xl">
                <img
                  src="/card-hands-plant.jpg"
                  alt="Hands sorting notes on a desk"
                  className="h-[300px] w-full object-cover lg:h-[340px]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/30" />
                <span className="absolute right-5 top-5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/85">
                  Tape 06
                </span>
                <div className="absolute inset-x-5 bottom-5">
                  <p className="ff-display max-w-[70%] text-[22px] font-semibold leading-tight tracking-[-0.02em] text-white">
                    The Interview Room
                  </p>
                  <div className="mt-3 flex gap-2">
                    <span className="rounded-full bg-white/15 px-2.5 py-1 text-[9.5px] uppercase tracking-[0.12em] backdrop-blur">
                      Scripts
                    </span>
                    <span className="rounded-full bg-white/15 px-2.5 py-1 text-[9.5px] uppercase tracking-[0.12em] backdrop-blur">
                      Drills
                    </span>
                  </div>
                </div>
              </div>
              <h3 className="ff-display mt-6 text-[19px] font-semibold tracking-[-0.02em]">
                {SUITE[2].title}
              </h3>
              <p className="mt-2.5 max-w-[360px] text-[13.5px] leading-relaxed text-white/50">
                {SUITE[2].body}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* about                                                       */}
      {/* ---------------------------------------------------------- */}
      <section id="about" className="bg-white">
        <div className="mx-auto max-w-[1360px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <Pill>Who we are</Pill>

              <p className="mt-8 text-[10.5px] font-medium uppercase tracking-[0.2em] text-neutral-400">
                Career audiobook
              </p>
              <p className="mt-1.5 text-[10.5px] font-medium uppercase tracking-[0.2em] text-neutral-400">
                Streamed in your browser
              </p>

              <div className="mt-9 flex items-center gap-3">
                <img
                  src="/avatar-jane.jpg"
                  alt="Blessing Adeyemi"
                  className="h-11 w-11 rounded-full object-cover"
                />
                <div>
                  <p className="text-[14px] font-semibold text-neutral-900">
                    Blessing Adeyemi
                  </p>
                  <p className="text-[12px] text-neutral-400">
                    Author &amp; Narrator
                  </p>
                </div>
              </div>

              <div className="mt-12">
                <p className="text-[13px] text-neutral-500">
                  Trusted by job seekers
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="flex gap-0.5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star
                        key={i}
                        className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                      />
                    ))}
                  </span>
                  <span className="text-[12.5px] font-medium text-neutral-600">
                    4.9
                  </span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8">
              <h2 className="ff-display max-w-[860px] text-[25px] font-medium leading-[1.22] tracking-[-0.03em] text-neutral-900 sm:text-[31px] lg:text-[37px]">
                Everything we learned on the hiring side of the table, recorded
                as eight tapes you can finish on your commute — so you walk in
                knowing exactly what they want.
              </h2>

              <div className="mt-12 grid gap-4 sm:grid-cols-3">
                <div className="grid rounded-2xl border border-neutral-200 bg-neutral-50 sm:col-span-2 sm:grid-cols-2 sm:divide-x sm:divide-neutral-200">
                  <Stat
                    value="92%"
                    badge="Results"
                    badgeClass="bg-emerald-100 text-emerald-600"
                    body="92% of listeners say they felt interview-ready after the final tape."
                    foot="Interview readiness"
                  />
                  <Stat
                    value="64%"
                    badge="Speed"
                    badgeClass="bg-amber-100 text-amber-600"
                    body="Most listeners finish all eight tapes in a week of commuting."
                    foot="Time to finish"
                  />
                </div>

                <div className="hatch relative overflow-hidden rounded-2xl bg-neutral-950 p-5 text-white">
                  <div className="flex items-center gap-2">
                    <span className="ff-display text-[34px] font-semibold leading-none tracking-[-0.04em]">
                      0%
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/70">
                      No fees
                    </span>
                  </div>
                  <p className="mt-3.5 text-[12.5px] leading-snug text-white/55">
                    0 subscriptions — one payment, yours to replay forever.
                  </p>
                  <p className="mt-5 flex items-center gap-1.5 text-[11px] text-white/40">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    One-time payment
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* why listen                                                  */}
      {/* ---------------------------------------------------------- */}
      <section className="bg-white">
        <div className="mx-auto max-w-[1360px] px-5 pb-20 sm:px-8 lg:px-12 lg:pb-28">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-7">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <Pill>Why listen</Pill>
                  <h2 className="ff-display mt-6 max-w-[520px] text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[36px]">
                    Everything you need to walk in prepared.
                  </h2>
                  <div className="mt-7">
                    <Cta href={unlockHref}>Unlock all 8 tapes</Cta>
                  </div>
                </div>
                <span className="mt-1 shrink-0 text-[10.5px] uppercase tracking-[0.18em] text-neutral-300">
                  Dream Job Made Easy
                </span>
              </div>

              <div className="mt-12 grid grid-cols-3 gap-4 border-t border-neutral-100 pt-5 text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                <span>CV &amp; cover letters</span>
                <span>Interviews &amp; aptitude</span>
                <span>Salary &amp; remote</span>
              </div>

              <div className="mt-8 grid grid-cols-12 items-end gap-5">
                <div className="col-span-12 sm:col-span-5 lg:col-span-4">
                  <MetricCard
                    dark
                    label="Tape 01"
                    badge="New"
                    value="8"
                    caption="Tapes · 3h 26m"
                    className="w-full"
                  />
                </div>

                <div className="col-span-12 sm:col-span-7 lg:col-span-4">
                  <p className="text-[17px] font-medium leading-snug tracking-[-0.01em] text-neutral-900">
                    Scripts you can actually remember, written to be heard on
                    the move.
                  </p>
                </div>

                <div className="col-span-12 lg:col-span-4">
                  <img
                    src="/thumb-unlock.jpg"
                    alt="Listener on the move"
                    className="h-24 w-full rounded-2xl object-cover"
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="relative overflow-hidden rounded-3xl">
                <img
                  src="/card-portrait.jpg"
                  alt="Listener using Dream Job Made Easy"
                  className="h-[360px] w-full object-cover object-center lg:h-[470px]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 w-[70%] rounded-2xl bg-white/95 p-4 shadow-[0_26px_50px_-26px_rgba(0,0,0,0.7)] backdrop-blur-sm">
                  <div className="flex items-center justify-between text-[10.5px] text-neutral-400">
                    <span>Your shelf</span>
                    <span>Next up</span>
                  </div>
                  <div className="mt-1.5 flex items-end gap-2">
                    <span className="ff-display text-[30px] font-semibold leading-none tracking-[-0.03em] text-neutral-900">
                      6/8
                    </span>
                    <span className="mb-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
                      75%
                    </span>
                  </div>
                  <div className="mt-4 flex h-14 items-end gap-1.5">
                    {[38, 55, 42, 70, 58, 85, 64, 92, 76, 100].map((h, i) => (
                      <span
                        key={i}
                        style={{ height: `${h}%` }}
                        className={`flex-1 rounded-t ${
                          i === 9 ? "bg-emerald-500" : "bg-neutral-200"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-400">
                    <span>6 tapes done</span>
                    <span>2 tapes left</span>
                  </div>
                </div>
              </div>
              <p className="mt-4 max-w-[440px] text-[12.5px] leading-relaxed text-neutral-400">
                Listen in the browser on any device — your place is saved across
                phone and laptop, so a chapter never starts over.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* footer                                                      */}
      {/* ---------------------------------------------------------- */}
      <footer className="bg-neutral-950 text-white">
        <div className="mx-auto max-w-[1360px] px-5 pt-16 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <h2 className="ff-display text-[30px] font-medium leading-[1.12] tracking-[-0.03em] sm:text-[38px]">
                Start building the career
                <br /> you actually want.
              </h2>
              <form
                className="mt-8 flex max-w-[440px] items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] p-1.5"
                onSubmit={(e) => e.preventDefault()}
              >
                <input
                  type="email"
                  placeholder="Enter your email address"
                  className="min-w-0 flex-1 bg-transparent px-4 py-2 text-[13.5px] text-white placeholder:text-white/40 outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-neutral-900 transition hover:bg-neutral-200"
                >
                  Subscribe
                </button>
              </form>
            </div>

            <div className="grid grid-cols-2 gap-8 lg:col-span-5 lg:justify-items-end">
              {FOOTER_LINKS.map((col) => (
                <ul
                  key={col[0]}
                  className="space-y-2.5 text-[13.5px] text-white/60"
                >
                  {col.map((l) => (
                    <li key={l}>
                      <Link
                        href="/pricing"
                        className="transition hover:text-white"
                      >
                        {l}
                      </Link>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>

          <div className="mt-14 grid gap-6 border-t border-white/10 py-8 sm:grid-cols-2 lg:grid-cols-4">
            {CREDITS.map(([a, b]) => (
              <div key={a}>
                <p className="text-[13px] text-white/90">{a}</p>
                <p className="text-[13px] text-white/45">{b}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 overflow-hidden pb-16 pt-4 sm:gap-5">
            <Mark className="h-[clamp(24px,9.5vw,140px)] w-[clamp(24px,9.5vw,140px)] shrink-0 text-white" />
            <span className="ff-display whitespace-nowrap text-[clamp(24px,7.6vw,116px)] font-semibold leading-none tracking-[-0.055em]">
              DreamJobMadeEasy
            </span>
          </div>
        </div>

        <div className="overflow-hidden border-t border-white/10 py-3">
          <div className="marquee-track">
            {[0, 1].map((half) => (
              <div key={half} className="flex shrink-0">
                {TICKER.map((word) => (
                  <span
                    key={`${half}-${word}`}
                    className="flex shrink-0 items-center gap-5 whitespace-nowrap px-5 text-[10.5px] uppercase tracking-[0.18em] text-white/55"
                  >
                    {word}
                    <Asterisk
                      className="h-3 w-3 text-[#d9f55c]"
                      strokeWidth={2.5}
                    />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
