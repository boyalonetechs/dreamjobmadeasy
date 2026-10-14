"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Headphones } from "lucide-react";
import Nav from "./Nav";

export default function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare =
    pathname?.startsWith("/dashboard") ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname?.startsWith("/admin");
  // The landing page ships its own header + footer so it can match the design 1:1.
  const landing = pathname === "/";
  const hideNav = bare || landing;

  return (
    <>
      {!hideNav && <Nav />}
      <main>{children}</main>
      {!bare && !landing && (
        <footer className="border-t border-neutral-100 bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-6 py-10 sm:px-10 lg:px-16">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900">
                <Headphones className="h-4 w-4 text-white" />
              </span>
              <span className="text-xs font-bold text-neutral-900">
                Dream Job Made Easy
                <span className="block text-xs font-medium text-neutral-400">
                  An audiobook for getting hired
                </span>
              </span>
            </Link>
            <p className="text-xs text-neutral-400">
              Pay in naira with Paystack or in dollars with PayPal.
              Questions? hello@dreamjobmadeeasy.com
            </p>
          </div>
        </footer>
      )}
    </>
  );
}
