"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Headphones } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function Nav() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const linkCls = (href: string) =>
    pathname === href
      ? "rounded-full bg-neutral-900 px-5 py-2 text-white"
      : "px-5 py-2 hover:text-neutral-900";

  return (
    <header className="bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 pt-8 sm:px-10 lg:px-16">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Dream Job Made Easy home">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900">
            <Headphones className="h-5 w-5 text-white" />
          </span>
          <span className="text-xs font-bold leading-tight text-neutral-900">
            Dream Job
            <span className="block text-xs font-medium text-neutral-400">Made Easy</span>
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-1 rounded-full border border-neutral-200 bg-white p-1 text-xs font-medium text-neutral-500 sm:flex"
        >
          <Link href="/" className={linkCls("/")}>Home</Link>
          <Link href="/pricing" className={linkCls("/pricing")}>Pricing</Link>
          {user ? (
            <Link href="/dashboard" className={linkCls("/dashboard")}>My shelf</Link>
          ) : (
            <Link href="/signup" className={linkCls("/signup")}>Sign up</Link>
          )}
        </nav>

        {user ? (
          <button
            onClick={logout}
            className="rounded-full bg-neutral-900 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-neutral-800"
          >
            Log out
          </button>
        ) : (
          <Link
            href="/login"
            className="rounded-full bg-neutral-900 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-neutral-800"
          >
            Login
          </Link>
        )}
      </div>
    </header>
  );
}
