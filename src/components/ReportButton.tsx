"use client";

import { useState } from "react";

const REASONS = [
  { id: "underage", label: "Looks underage" },
  { id: "non-consensual", label: "Non-consensual / posted without permission" },
  { id: "stolen", label: "Stolen content" },
  { id: "illegal", label: "Illegal content" },
  { id: "spam", label: "Spam / scam" },
  { id: "other", label: "Something else" },
];

export default function ReportButton({
  target,
  targetId,
  className = "",
}: {
  target: "post" | "premium" | "creator";
  targetId: string | number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0].id);
  const [details, setDetails] = useState("");
  const [done, setDone] = useState(false);

  const send = async () => {
    await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, targetId, reason, details }),
    }).catch(() => {});
    setDone(true);
    setTimeout(() => setOpen(false), 1500);
  };

  return (
    <>
      <button
        onClick={() => {
          setDone(false);
          setOpen(true);
        }}
        className={`text-[10px] text-neutral-500 hover:text-red-300 ${className}`}
        aria-label="Report"
      >
        ⚑ Report
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-5 text-left"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            {done ? (
              <p className="text-sm text-emerald-300">Thanks — we&apos;ll review it.</p>
            ) : (
              <>
                <p className="mb-3 font-bold text-white">Report this</p>
                <div className="flex flex-col gap-1.5">
                  {REASONS.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 text-sm text-neutral-300">
                      <input type="radio" checked={reason === r.id} onChange={() => setReason(r.id)} className="accent-pink-500" />
                      {r.label}
                    </label>
                  ))}
                </div>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Details (optional)"
                  rows={2}
                  maxLength={500}
                  className="mt-3 w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white focus:outline-none"
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-neutral-400">
                    Cancel
                  </button>
                  <button onClick={send} className="rounded-full bg-red-500 px-4 py-1.5 text-sm font-bold text-black">
                    Send report
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
