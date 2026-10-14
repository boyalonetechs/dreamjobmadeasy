import { Headphones, Play } from "lucide-react";
import Link from "next/link";

export default function Banner() {
  return (
    <div className="flex flex-col justify-between gap-10 bg-neutral-900 p-8 text-white sm:p-12 lg:p-16 xl:p-20 rounded-r-3xl">
      <Link href="/" className="flex items-center gap-2.5">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-400">
          <Headphones className="h-5 w-5 text-neutral-900" />
        </span>
        <span className="text-xs font-bold leading-tight">
          Dream Job
          <span className="block text-xs font-medium text-neutral-400">
            Made Easy
          </span>
        </span>
      </Link>
      <div>
        <h2 className="max-w-md text-xs font-extrabold tracking-tight sm:text-xs lg:text-xs xl:text-xs">
          Pick up where your tape stopped.
        </h2>
        <p className="mt-3 max-w-md text-xs leading-relaxed text-neutral-300 lg:text-xs xl:text-xs">
          One payment opens every tape. Your progress waits on your shelf.
        </p>
        <Link
          href="/pricing"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-white/20"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          Unlock the full book
        </Link>
      </div>
      <p className="text-xs text-neutral-500">
        8 tapes · 3 hrs 26 min · replay forever
      </p>
    </div>
  );
}
