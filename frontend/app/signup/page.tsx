"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import AuthShell from "@/components/AuthShell";
import { Pill, inputCls } from "@/components/brand";

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signup(name, email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Could not create your account.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      badge="Eight tapes · one payment"
      title={
        <>
          Everything you need
          <br />
          to get hired.
        </>
      }
      blurb="Listen on the bus, on a walk, or between applications. No course, no modules, no deadlines — just eight tapes and one offer."
      bullets={[
        "All eight tapes, one payment",
        "Paystack in naira, PayPal in dollars",
        "Replay on any device, forever",
      ]}
      footnote="₦15,000 once · $19 once · no subscription"
    >
      <Pill>Get started</Pill>

      <h1 className="ff-display mt-6 text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] text-neutral-900">
        Create your shelf.
      </h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-neutral-500">
        One account holds your tapes, your progress and your payment. Browsing
        is free — nothing plays until you unlock it.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700"
        >
          {error}
        </div>
      )}

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label
            htmlFor="name"
            className="mb-1.5 block text-[12.5px] font-semibold text-neutral-700"
          >
            First name
          </label>
          <input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Adaeze"
            autoComplete="given-name"
            className={inputCls}
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-[12.5px] font-semibold text-neutral-700"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className={inputCls}
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-[12.5px] font-semibold text-neutral-700"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6+ characters"
            autoComplete="new-password"
            className={inputCls}
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-neutral-900 px-7 py-3.5 text-[14px] font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
        >
          {busy ? "Creating your account…" : "Create an account"}
        </button>
      </form>

      <p className="mt-4 text-[12px] leading-relaxed text-neutral-400">
        Nothing plays until you pay — one payment, yours to replay forever.
      </p>

      <div className="mt-6 flex items-center justify-between border-t border-neutral-100 pt-6 text-[13.5px]">
        <span className="text-neutral-400">Already have one?</span>
        <Link
          href="/login"
          className="font-semibold text-neutral-900 transition hover:text-neutral-500"
        >
          Log in
        </Link>
      </div>
    </AuthShell>
  );
}
