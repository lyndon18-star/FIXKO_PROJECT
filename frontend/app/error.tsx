// This is the global error screen. Next.js shows this component whenever the whole
// app crashes, so the user sees a friendly message instead of a blank page.
"use client";

import { useEffect } from "react";

// Shows "Something went wrong" with a Try again button that reloads the page.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Log the real error to the console so developers can see what broke.
  useEffect(() => {
    console.error("Unhandled application error.", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      {/* The white card with the error message and the Try again button. */}
      <section className="w-full max-w-lg rounded-2xl bg-white p-8 text-slate-900 shadow-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-600">Fixko</p>
        <h1 className="mt-3 text-2xl font-black">Something went wrong</h1>
        <p className="mt-3 text-slate-500">The page could not finish loading. Please try again.</p>
        {/* Try again button — calls reset() to re-render the crashed page. */}
        <button className="btn-primary mt-6" onClick={() => reset()}>Try again</button>
      </section>
    </main>
  );
}
