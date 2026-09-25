"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/categories";

type Status = "pending" | "approved" | "rejected" | null;

const input =
  "rounded-lg bg-white/5 px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-400";

// Grabs a still ~1s into a video for its (server-blurred) teaser.
async function videoCover(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("Couldn't read that video"));
    });
    video.currentTime = Math.min(1, (video.duration || 2) / 2);
    await new Promise<void>((resolve) => (video.onseeked = () => resolve()));
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't make a cover"))), "image/jpeg", 0.85),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Creator studio section for posting real content of yourself: ID
// verification first (owner-approved), then uploads that go to review.
export default function CreatorOwnContent({ wallet, minPrice }: { wallet: string; minPrice: number }) {
  const [status, setStatus] = useState<Status | undefined>(undefined);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // verification form
  const [legalName, setLegalName] = useState("");
  const [dob, setDob] = useState("");
  const [country, setCountry] = useState("");
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [attestId, setAttestId] = useState(false);

  // upload form
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0].id);
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(String(minPrice * 5));
  const [attestContent, setAttestContent] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const loadStatus = () =>
    fetch("/api/creator/verify")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setStatus(d?.status ?? null);
        setRejectReason(d?.rejectReason ?? null);
      })
      .catch(() => setStatus(null));

  useEffect(() => {
    loadStatus();
  }, []);

  const submitVerification = async () => {
    if (!idDoc || !selfie) return;
    setBusy(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append("legalName", legalName);
      form.append("dateOfBirth", dob);
      form.append("country", country);
      form.append("idDoc", idDoc);
      form.append("selfie", selfie);
      form.append("attest", attestId ? "yes" : "no");
      const res = await fetch("/api/creator/verify", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Couldn't submit");
        return;
      }
      await loadStatus();
    } finally {
      setBusy(false);
    }
  };

  const submitPost = async () => {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const isVideo = file.type.startsWith("video/");
      const cover = isVideo ? await videoCover(file) : null;
      const ext = file.name.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");
      setProgress(0);
      const blob = await upload(`creator-media/${wallet.toLowerCase()}/post.${ext}`, file, {
        access: "public",
        handleUploadUrl: "/api/creator/media-upload",
        contentType: file.type,
        multipart: file.size > 20 * 1024 * 1024,
        onUploadProgress: (p) => setProgress(Math.round(p.percentage)),
      });
      setProgress(null);

      const form = new FormData();
      form.append("mediaUrl", blob.url);
      form.append("title", title);
      form.append("category", category);
      form.append("description", description);
      form.append("price", price);
      form.append("attest", attestContent ? "yes" : "no");
      if (cover) form.append("cover", cover, "cover.jpg");
      const res = await fetch("/api/creator/own-posts", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Couldn't post");
        return;
      }
      setFile(null);
      setTitle("");
      setDescription("");
      setAttestContent(false);
      setMsg("Submitted! It goes live once it's approved.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  if (status === undefined) return null;

  return (
    <section className="flex w-full flex-col gap-3 rounded-2xl border border-white/10 bg-neutral-900/60 p-5 text-left">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Post your own content</p>

      {status === "approved" ? (
        <>
          <p className="text-sm text-neutral-400">
            ✅ You&apos;re verified. Upload photos or videos of yourself — each one is reviewed before it goes live.
          </p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-neutral-300"
          />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={input} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className={input}
          />
          <label className="flex items-center gap-2 text-sm text-neutral-400">
            Price
            <input
              type="number"
              min={minPrice}
              step={0.01}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={`${input} w-28`}
            />
            NOMO
          </label>
          <label className="flex items-start gap-2 text-xs text-neutral-300">
            <input
              type="checkbox"
              checked={attestContent}
              onChange={(e) => setAttestContent(e.target.checked)}
              className="mt-0.5 accent-pink-500"
            />
            Everyone shown is me or another adult (18+) who has consented to being filmed and to this being sold here, and I
            own the rights to it.
          </label>
          <button
            disabled={busy || !file || !title.trim() || !attestContent || !(Number(price) >= minPrice)}
            onClick={submitPost}
            className="rounded-full bg-pink-500 px-6 py-3 text-sm font-black text-black transition hover:bg-pink-400 disabled:opacity-40"
          >
            {progress !== null ? `Uploading ${progress}%...` : busy ? "Submitting..." : "Upload & submit for review"}
          </button>
        </>
      ) : status === "pending" ? (
        <p className="text-sm text-amber-300">⏳ Your ID is being reviewed. You&apos;ll be able to upload once it&apos;s approved.</p>
      ) : (
        <>
          <p className="text-sm text-neutral-400">
            To sell photos or videos of yourself you need to verify you&apos;re 18+. Your ID is encrypted and only seen by the
            site owner for age verification.
          </p>
          {status === "rejected" && (
            <p className="text-sm text-red-400">Your last submission was rejected{rejectReason ? `: ${rejectReason}` : ""}.</p>
          )}
          <input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Legal full name" className={input} />
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Date of birth
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={input} />
          </label>
          <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" className={input} />
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Photo of your government ID (front)
            <input type="file" accept="image/*" onChange={(e) => setIdDoc(e.target.files?.[0] ?? null)} className="text-sm text-neutral-300" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Selfie holding that ID next to your face
            <input type="file" accept="image/*" onChange={(e) => setSelfie(e.target.files?.[0] ?? null)} className="text-sm text-neutral-300" />
          </label>
          <label className="flex items-start gap-2 text-xs text-neutral-300">
            <input type="checkbox" checked={attestId} onChange={(e) => setAttestId(e.target.checked)} className="mt-0.5 accent-pink-500" />
            I am 18 or older, this is my own valid ID, and I am the person in the selfie.
          </label>
          <button
            disabled={busy || !legalName.trim() || !dob || !country.trim() || !idDoc || !selfie || !attestId}
            onClick={submitVerification}
            className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-black text-black transition hover:bg-emerald-300 disabled:opacity-40"
          >
            {busy ? "Submitting..." : "Submit for verification"}
          </button>
        </>
      )}
      {msg && <p className="text-xs text-neutral-300">{msg}</p>}
    </section>
  );
}
