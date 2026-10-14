"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader } from "lucide-react";
import { useAuth } from "@/lib/auth";
import AuthShell from "@/components/AuthShell";
import { Pill, inputCls } from "@/components/brand";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not log you in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      badge="All 8 tapes"
      title={
        <>
          Pick up where
          <br />
          your tape stopped.
        </>
      }
      blurb="One payment opens every tape. Your progress waits on your shelf, exactly where you left it."
      bullets={[
        "All 8 tapes, front to back",
        "Pay in naira with Paystack, dollars with PayPal",
        "Replay on any device, forever",
      ]}
      footnote="8 tapes · 3 hrs 26 min · replay forever"
    >
      <Pill>Welcome back</Pill>

      <h1 className="ff-display mt-6 text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] text-neutral-900">
        Log in to your shelf.
      </h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-neutral-500">
        Your tapes, your progress and your receipt — all under the same email.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            autoComplete="current-password"
            className={inputCls}
          />
          {error && (
            <p
              role="alert"
              className="mt-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700"
            >
              {error}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center rounded-full bg-neutral-900 px-7 py-3.5 text-[14px] font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
        >
          {busy ? (
            <Loader className="h-4 w-4 animate-spin" />
          ) : (
            "Log in"
          )}
        </button>
      </form>

      <div className="mt-7 flex items-center justify-between border-t border-neutral-100 pt-6 text-[13.5px]">
        <span className="text-neutral-400">New here?</span>
        <Link
          href="/signup"
          className="font-semibold text-neutral-900 transition hover:text-neutral-500"
        >
          Create an account
        </Link>
      </div>
    </AuthShell>
  );
}
