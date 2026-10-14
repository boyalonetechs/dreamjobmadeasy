"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

// Pricing no longer collects payment directly — unlocking happens in the
// dashboard. Send signed-in users to their shelf, everyone else to log in.
export default function PricingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [loading, user, router]);

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <p className="text-xs text-neutral-400">
          {loading ? "Loading your shelf…" : "Redirecting…"}
        </p>
      </div>
    </section>
  );
}
