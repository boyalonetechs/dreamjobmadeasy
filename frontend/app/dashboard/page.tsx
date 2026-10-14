"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Play, Lock, X, Check, Loader, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api, API_BASE, Book, Chapter } from "@/lib/api";
import { Mark, Pill, inputCls } from "@/components/brand";
import PaypalButton from "@/components/PaypalButton";

// Cover art lives in object storage; read it back through the backend proxy
// (the raw Wasabi URL is private, and presigned GETs are rejected).
const coverSrc = (chapter: Chapter, token?: string | null) =>
  chapter.cover_image_url
    ? `${API_BASE}/api/cover/${chapter.id}?token=${token ?? ""}`
    : "";

// PaypalButton lives in @/components/PaypalButton.

export default function Dashboard() {
  const { user, token, loading: authLoading, logout, refresh } = useAuth();
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [book, setBook] = useState<Book | null>(null);
  const [bookError, setBookError] = useState("");
  const [payResult, setPayResult] = useState<{
    ok: boolean;
    title: string;
    message: string;
  } | null>(null);
  const [current, setCurrent] = useState<Chapter | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [progress, setProgress] = useState(0);

  const [query, setQuery] = useState("");
  const [avatarOk, setAvatarOk] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    refresh()
      .catch(() => {})
      .finally(async () => {
        try {
          const b = await api.book(token);
          setBook(b);
        } catch (e) {
          setBookError(
            e instanceof Error ? e.message : "Could not load your tapes.",
          );
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!unlockOpen) return;
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v2/inline.js";
    s.async = true;
    document.body.appendChild(s);
    return () => {
      document.body.removeChild(s);
    };
  }, [unlockOpen]);

  useEffect(() => {
    if (!unlockOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUnlockOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [unlockOpen]);

  if (authLoading || !user) {
    return (
      <div className="ff-display flex min-h-screen items-center justify-center bg-white">
        <div className="flex items-center gap-3 text-neutral-400">
          <Mark className="h-6 w-6 animate-pulse text-neutral-900" />
          <p className="text-[13.5px]">Loading your shelf…</p>
        </div>
      </div>
    );
  }

  const playChapter = async (c: Chapter) => {
    if (c.locked) {
      setUnlockOpen(true);
      return;
    }
    setLoadingAudio(true);
    setBookError("");
    try {
      // every tape is gated — the url only ever comes from the paid endpoint
      const url = (await api.audio(c.id, token)).audio_url;
      setCurrent(c);
      setAudioUrl(url);
      setProgress(0);
      setTimeout(() => audioRef.current?.play().catch(() => {}), 80);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not play this tape.";
      setBookError(msg);
      if (msg.toLowerCase().includes("locked")) setUnlockOpen(true);
    } finally {
      setLoadingAudio(false);
    }
  };

  const playNext = () => {
    if (!book || !current) return;
    const idx = book.chapters.findIndex((c) => c.id === current.id);
    const next = book.chapters.slice(idx + 1).find((c) => !c.locked);
    if (next) playChapter(next);
  };

  const closePlayer = () => {
    audioRef.current?.pause();
    setCurrent(null);
    setAudioUrl("");
    setProgress(0);
  };

  const finishUnlock = async () => {
    await refresh();
    setUnlockOpen(false);
    if (token) setBook(await api.book(token));
    setPayResult({
      ok: true,
      title: "Payment successful",
      message: "All eight tapes are unlocked. Enjoy listening.",
    });
  };

  const handlePayError = (message: string) => {
    setBookError(message);
    setPayResult({
      ok: false,
      title: "Payment unsuccessful",
      message,
    });
  };

  const subscribe = async () => {
    setBookError("");
    setSubscribing(true);
    try {
      if (!token) throw new Error("Log in again.");
      const init = await api.paystackInit(user.email, token);
      if (init.mock) {
        await api.paystackVerify(init.reference as string, token);
        await finishUnlock();
        return;
      }
      const accessCode: string | undefined = init?.data?.access_code;
      if (!window.PaystackPop || !accessCode) {
        const url: string | undefined = init?.data?.authorization_url;
        if (url) window.location.href = url;
        else throw new Error("Paystack did not return a checkout link.");
        return;
      }
      // v2 resumeTransaction uses the access code from our server-side
      // initialize, so the browser never calls Paystack's API directly.
      const popup = new window.PaystackPop();
      popup.resumeTransaction(accessCode, {
        onLoad: () => {
          // Checkout is on screen; get our modal out of the way.
          setUnlockOpen(false);
        },
        onSuccess: (res: { reference: string }) => {
          void (async () => {
            try {
              await api.paystackVerify(res.reference, token);
              await finishUnlock();
            } catch (e) {
              handlePayError(
                e instanceof Error ? e.message : "Payment did not confirm.",
              );
            } finally {
              setSubscribing(false);
            }
          })();
        },
        onCancel: () => setSubscribing(false),
        onError: (err: { message?: string }) => {
          handlePayError(err?.message || "Could not start the transaction.");
          setUnlockOpen(true);
          setSubscribing(false);
        },
      });
    } catch (e) {
      handlePayError(
        e instanceof Error ? e.message : "Could not start the payment.",
      );
      setSubscribing(false);
    }
  };

  const chapters = book?.chapters ?? [];
  const unlockedCount = chapters.filter((c) => !c.locked).length;
  const firstName = user.name.split(" ")[0];
  const q = query.trim().toLowerCase();
  const visibleChapters = chapters.filter(
    (c) => !q || c.title.toLowerCase().includes(q),
  );
  const pct = chapters.length
    ? Math.round((unlockedCount / chapters.length) * 100)
    : 0;

  return (
    <div className="ff-display min-h-screen bg-white text-neutral-900">
      {/* ---------------- header ---------------- */}
      <header className="sticky top-0 z-30 border-b border-neutral-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1360px] items-center gap-4 px-5 py-4 sm:px-8 lg:px-12">
          <Link
            href="/"
            className="flex items-center gap-2.5"
            aria-label="Dream Job Made Easy home"
          >
            <Mark className="h-7 w-7 text-neutral-900" />
            <span className="hidden text-[17px] font-semibold tracking-[-0.01em] sm:inline">
              Dream Job Made Easy
            </span>
          </Link>

          <div className="relative ml-auto flex items-center gap-3">
            <div className="relative hidden sm:block">
              <input
                type="text"
                placeholder="Search tapes"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={`${inputCls} rounded-full py-1 pl-4 pr-10 text-[13px]`}
              />
              <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            </div>

            <button
              onClick={() => setProfileOpen((v) => !v)}
              aria-label="Account menu"
              className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-900 text-white"
            >
              {avatarOk ? (
                <Image
                  src="/avatar.jpg"
                  alt="Account"
                  fill
                  className="object-cover"
                  onError={() => setAvatarOk(false)}
                />
              ) : (
                <span className="text-[13px] font-semibold">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              )}
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-20 z-20 w-64 rounded-2xl border border-neutral-100 bg-white p-4 shadow-[0_24px_50px_-24px_rgba(0,0,0,0.4)]">
                <p className="text-[13.5px] font-semibold text-neutral-900">
                  {user.name}
                </p>
                <p className="truncate text-[12px] text-neutral-400">
                  {user.email}
                </p>
                <p className="mt-3 text-[12.5px] leading-snug text-neutral-500">
                  {book?.unlocked
                    ? "Full access — all tapes open."
                    : `${unlockedCount} of ${chapters.length} tapes open.`}
                </p>
                {!book?.unlocked && (
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      setUnlockOpen(true);
                    }}
                    className="mt-4 block w-full rounded-full bg-neutral-900 px-4 py-2.5 text-[12.5px] font-medium text-white transition hover:bg-neutral-700"
                  >
                    Unlock the full book
                  </button>
                )}
                <button
                  onClick={logout}
                  className="mt-2 w-full rounded-full border border-neutral-200 px-4 py-2.5 text-[12.5px] font-medium text-neutral-600 transition hover:border-neutral-900 hover:text-neutral-900"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ---------------- main ---------------- */}
      <main className="mx-auto max-w-[1360px] px-5 pb-36 sm:px-8 lg:px-12">
        {bookError && (
          <p
            role="alert"
            className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700"
          >
            {bookError}
          </p>
        )}

        {/* greeting */}
        <section className="pt-10">
          <Pill tone={book?.unlocked ? "soft" : "light"}>
            {book?.unlocked ? "Full access" : "AudioBooks"}
          </Pill>
          <h1 className="ff-display mt-6 max-w-[760px] text-[32px] font-semibold leading-[1.06] tracking-[-0.035em] text-neutral-900 sm:text-[44px]">
            Welcome back, {firstName}.
          </h1>
          <p className="mt-3 text-[14.5px] text-neutral-500">
            {chapters.length > 0
              ? `${unlockedCount} of ${chapters.length} tapes open · 3 hrs 26 min`
              : "Loading your tapes…"}
          </p>
        </section>

        {/* access banner */}
        <section className="mt-8">
          <div className="grid gap-6 rounded-3xl bg-neutral-950 p-6 text-white sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-10">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#dff77e]">
                  {book?.unlocked ? "Unlocked" : "Locked"}
                </span>
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/35">
                  One payment, yours forever
                </span>
              </div>
              <p className="ff-display mt-4 text-[24px] font-semibold leading-tight tracking-[-0.025em] sm:text-[28px]">
                {book?.unlocked
                  ? "Every tape is open. Press play."
                  : `All ${chapters.length || 8} tapes are locked.`}
              </p>
              {!book?.unlocked && (
                <p className="mt-2 max-w-[560px] text-[14px] leading-relaxed text-white/55">
                  One payment opens everything — {book?.price_ngn ?? "₦15,000"}{" "}
                  with Paystack or {book?.price_usd ?? "$19.00"} with PayPal.
                </p>
              )}
              <div className="mt-6 h-2 w-full max-w-[460px] overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#dff77e] transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {!book?.unlocked && (
              <button
                onClick={() => setUnlockOpen(true)}
                className="justify-self-start rounded-full bg-[#dff77e] px-7 py-3.5 text-[14px] font-medium text-neutral-900 transition hover:bg-[#d2f05f] lg:justify-self-end"
              >
                Unlock all {chapters.length || 8} tapes
              </button>
            )}
          </div>
        </section>

        {/* my tapes */}
        <section className="mt-14" id="tapes">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Pill>All eight tapes</Pill>
            {book && (
              <span className="text-[13px] text-neutral-400">
                {unlockedCount} of {chapters.length} open
              </span>
            )}
          </div>

          {!book ? (
            <p className="mt-6 text-[13.5px] text-neutral-400">
              Loading your tapes…
            </p>
          ) : visibleChapters.length === 0 ? (
            <p className="mt-6 text-[13.5px] text-neutral-400">
              No tapes match your search. Try another word.
            </p>
          ) : (
            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              {visibleChapters.map((tape) => {
                const isCurrent = current?.id === tape.id;
                const open = !tape.locked;
                return (
                  <article
                    key={tape.id}
                    className={`group flex overflow-hidden rounded-lg border bg-white transition ${
                      isCurrent
                        ? "border-neutral-900 shadow-[0_18px_44px_-26px_rgba(0,0,0,0.5)]"
                        : "border-neutral-100 hover:border-neutral-200 hover:shadow-[0_18px_44px_-28px_rgba(0,0,0,0.45)]"
                    }`}
                  >
                    <div className="relative w-36 shrink-0 h-40 sm:w-44">
                      {coverSrc(tape, token) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={coverSrc(tape, token)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-neutral-100 text-neutral-300">
                          <Mark className="h-8 w-8" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />
                      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-neutral-900">
                        Chapter {tape.no}
                      </span>
                      {isCurrent && (
                        <span className="absolute right-3 top-3 rounded-full bg-[#dff77e] px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-neutral-900">
                          Playing
                        </span>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col justify-between p-4">
                      <div>
                        <h3 className="ff-display text-[15px] font-semibold leading-snug tracking-[-0.01em] text-neutral-900">
                          {tape.title}
                        </h3>
                        <p className="mt-1 text-[12.5px] text-neutral-400">
                          {tape.duration_label}
                        </p>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        {isCurrent ? (
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                            <div
                              className="h-full rounded-full bg-neutral-900"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        ) : (
                          <span
                            className={`text-[11.5px] font-medium ${
                              open ? "text-emerald-600" : "text-neutral-400"
                            }`}
                          >
                            {open ? "Ready to play" : "Locked"}
                          </span>
                        )}
                        <button
                          onClick={() => playChapter(tape)}
                          aria-label={
                            open
                              ? `Play ${tape.title}`
                              : `${tape.title} is locked`
                          }
                          disabled={loadingAudio}
                          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition disabled:opacity-50 ${
                            open
                              ? "bg-[#dff77e] text-neutral-900 hover:scale-105"
                              : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                          }`}
                        >
                          {open ? (
                            <Play className="h-4 w-4 fill-current" />
                          ) : (
                            <Lock className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* ---------------- now playing ---------------- */}
      {current && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-neutral-950 px-4 py-3 text-white">
          <div className="mx-auto flex max-w-[1360px] items-center gap-4">
            {coverSrc(current, token) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverSrc(current, token)}
                alt=""
                className="h-11 w-11 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-white/40">
                <Mark className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0 shrink-0">
              <p className="max-w-[180px] truncate text-[13.5px] font-semibold">
                {loadingAudio ? "Loading tape…" : current.title}
              </p>
              <p className="text-[11.5px] text-white/45">
                Chapter {current.no}
              </p>
            </div>
            <audio
              ref={audioRef}
              key={audioUrl}
              src={audioUrl}
              controls
              controlsList="nodownload"
              onContextMenu={(e) => e.preventDefault()}
              preload="metadata"
              className="h-9 min-w-0 flex-1 [color-scheme:dark]"
              onTimeUpdate={(e) => {
                const a = e.currentTarget;
                if (a.duration) setProgress((a.currentTime / a.duration) * 100);
              }}
              onEnded={() => {
                if (autoplay) playNext();
              }}
            />
            <button
              onClick={closePlayer}
              aria-label="Close player"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ---------------- unlock modal ---------------- */}
      {unlockOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-neutral-950/70 p-4 backdrop-blur-sm"
          onClick={() => !subscribing && setUnlockOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="unlock-title"
            className="ff-display my-auto flex w-full max-w-md flex-col rounded-3xl bg-white p-6 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)] sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <Pill tone="soft">One payment</Pill>
              <button
                onClick={() => setUnlockOpen(false)}
                disabled={subscribing}
                aria-label="Close"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <h2
              id="unlock-title"
              className="ff-display mt-6 text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-neutral-900"
            >
              Open all eight tapes.
            </h2>
            <p className="mt-2.5 text-[14px] leading-relaxed text-neutral-500">
              One payment. Yours to replay forever, on any device.
            </p>

            <ul className="mt-6 space-y-2.5">
              {[
                `All ${chapters.length || 8} chapters unlocked instantly`,
                "Every tape, front to back",
                "Listen on any device, any time",
              ].map((li) => (
                <li
                  key={li}
                  className="flex items-center gap-2.5 text-[13.5px] text-neutral-600"
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#ecfba8] text-neutral-900">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {li}
                </li>
              ))}
            </ul>

            <div className="mt-6">
              <div className="flex items-baseline gap-2 border-t border-neutral-200 pt-6">
                <span className="ff-display text-[34px] font-semibold leading-none tracking-[-0.04em] text-neutral-900">
                  {book?.price_ngn ?? "₦15,000"}
                </span>
                <span className="text-[13px] text-neutral-400">
                  or {book?.price_usd ?? "$19.00"} with PayPal
                </span>
              </div>

              {bookError && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700"
                >
                  {bookError}
                </p>
              )}

              <button
                onClick={subscribe}
                disabled={subscribing}
                className="mt-5 w-full rounded-full bg-neutral-900 px-7 py-3.5 text-[14px] font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
              >
                {subscribing ? (
                  <Loader className="mx-auto animate-spin" />
                ) : (
                  `Pay ${book?.price_ngn ?? "₦15,000"} with Paystack`
                )}
              </button>
              <p className="mt-2 text-center text-[12px] text-neutral-400">
                Card, bank transfer, or USSD
              </p>

              <div className="mt-3">
                <PaypalButton
                  token={token ?? ""}
                  amountLabel={book?.price_usd ?? "$19.00"}
                  onSuccess={() => {
                    void finishUnlock();
                  }}
                  onError={handlePayError}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- payment result popup ---------------- */}
      {payResult && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-950/70 p-4 backdrop-blur-sm"
          onClick={() => setPayResult(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="ff-display w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${
                payResult.ok
                  ? "bg-[#ecfba8] text-neutral-900"
                  : "bg-red-100 text-red-600"
              }`}
            >
              {payResult.ok ? (
                <Check className="h-7 w-7" strokeWidth={3} />
              ) : (
                <AlertTriangle className="h-7 w-7" strokeWidth={2.5} />
              )}
            </div>
            <h3 className="mt-5 text-[20px] font-semibold tracking-[-0.02em] text-neutral-900">
              {payResult.title}
            </h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-neutral-500">
              {payResult.message}
            </p>
            <button
              onClick={() => {
                const failed = !payResult.ok;
                setPayResult(null);
                if (failed) setUnlockOpen(true);
              }}
              className="mt-6 w-full rounded-full bg-neutral-900 px-7 py-3.5 text-[14px] font-medium text-white transition hover:bg-neutral-700"
            >
              {payResult.ok ? "Start listening" : "Try again"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
