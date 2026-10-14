"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Headphones, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

function SuccessInner() {
  const params = useSearchParams();
  const { token, refresh } = useAuth();
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [msg, setMsg] = useState("Confirming your payment…");

  useEffect(() => {
    const run = async () => {
      const provider = params.get("provider");
      const reference = params.get("reference");
      // PayPal appends ?token=<orderId>&PayerID=... to the return_url.
      const orderId = params.get("order_id") || params.get("token");
      const mock = params.get("mock");
      try {
        if (!token) {
          setMsg("Log in on this device to finish unlocking your tapes.");
          setState("error");
          return;
        }
        if (mock) {
          await api.devUnlock(token);
        } else if (provider === "paystack" && reference) {
          await api.paystackVerify(reference, token);
        } else if (provider === "paypal" && orderId) {
          await api.paypalCapture(orderId, token);
        } else {
          throw new Error("Missing payment details. Start the payment again.");
        }
        await refresh();
        setState("done");
      } catch (e) {
        setState("error");
        setMsg(e instanceof Error ? e.message : "Payment did not confirm.");
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="mx-auto w-full max-w-xl rounded-md border border-neutral-100 bg-white p-8 text-center shadow-[0_2px_20px_-4px_rgba(0,0,0,0.06)] sm:p-12">
      {state === "working" && (
        <>
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900">
            <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
          </span>
          <h1 className="mt-5 text-xs font-extrabold tracking-tight text-neutral-900">
            Confirming payment.
          </h1>
          <p className="mt-2 text-xs text-neutral-500">
            Hold on. We are asking {params.get("provider") || "your bank"} if the money landed.
          </p>
        </>
      )}
      {state === "done" && (
        <>
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-400">
            <Check className="h-6 w-6 text-neutral-900" />
          </span>
          <p className="mt-5 inline-block rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white">
            Payment cleared
          </p>
          <h1 className="mt-3 text-xs font-extrabold tracking-tight text-neutral-900 sm:text-xs">
            All eight tapes are yours.
          </h1>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-neutral-500">
            Your shelf is unlocked. Start with tape 1 before your next interview.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-full bg-amber-400 px-7 py-3.5 text-xs font-semibold text-neutral-900 transition hover:bg-amber-300"
          >
            Start listening
          </Link>
        </>
      )}
      {state === "error" && (
        <>
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900">
            <Headphones className="h-6 w-6 text-white" />
          </span>
          <h1 className="mt-5 text-xs font-extrabold tracking-tight text-neutral-900">
            We could not confirm it yet.
          </h1>
          <p className="mt-2 text-xs text-neutral-500">{msg}</p>
          <p className="mt-1 text-xs text-neutral-500">
            If money left your account, wait a minute and confirm again from your shelf.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-full bg-neutral-900 px-7 py-3.5 text-xs font-semibold text-white transition hover:bg-neutral-800"
            >
              Check my shelf
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-neutral-200 px-7 py-3.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300"
            >
              Try payment again
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function SuccessPage() {
  return (
    <section className="bg-white">
      <div className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center px-6 py-16">
        <Suspense
          fallback={
            <div className="rounded-md border border-neutral-100 bg-white p-12 text-xs text-neutral-400">
              Confirming…
            </div>
          }
        >
          <SuccessInner />
        </Suspense>
      </div>
    </section>
  );
}
