"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileAudio,
  Loader2,
  X,
  Image as ImageIcon,
  RefreshCw,
  Music2,
  Clock,
  Disc3,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api, API_BASE, AdminChapter, WasabiFile } from "@/lib/api";
import { Mark, Pill, inputCls } from "@/components/brand";

type FormState = {
  title: string;
  blurb: string;
  no: string;
  minutes: string;
  seconds: string;
  durationLabel: string;
  coverImage: File | null;
  fullAudio: File | null;
  editChapterId: string | null;
};

const EMPTY_FORM: FormState = {
  title: "",
  blurb: "",
  no: "1",
  minutes: "0",
  seconds: "0",
  durationLabel: "",
  coverImage: null,
  fullAudio: null,
  editChapterId: null,
};

const parseDuration = (label: string) => {
  const parts = label.split(":").map((p) => parseInt(p, 10));
  if (parts.length === 0) return { minutes: 0, seconds: 0 };
  if (parts.length === 1) return { minutes: parts[0] || 0, seconds: 0 };
  return {
    minutes: parts[parts.length - 2] || 0,
    seconds: parts[parts.length - 1] || 0,
  };
};

const readAudioDuration = (file: File): Promise<number> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const d = audio.duration;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) ? d : 0);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the audio duration."));
    };
    audio.src = url;
  });

export default function AdminPage() {
  const { user, token, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [chapters, setChapters] = useState<AdminChapter[]>([]);
  const [wasabiFiles, setWasabiFiles] = useState<WasabiFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (!user.is_admin) {
      router.push("/dashboard");
      return;
    }
    loadAll();
  }, [user, authLoading, router]);

  const loadAll = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [chaptersRes, filesRes] = await Promise.all([
        api.adminChapters(token),
        api.adminWasabiFiles(token),
      ]);
      setChapters(chaptersRes.chapters || []);
      setWasabiFiles(filesRes.files || []);
    } catch (e) {
      showMsg("error", e instanceof Error ? e.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  const showMsg = (type: "success" | "error", text: string) => {
    setMsg({ type, text });
    window.setTimeout(() => setMsg(null), 5000);
  };

  const nextChapter = () => {
    const maxNo = chapters.reduce((m, c) => Math.max(m, c.no ?? 0), 0);
    return { no: maxNo + 1 };
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
  };

  const openUpload = () => {
    const { no } = nextChapter();
    setForm({ ...EMPTY_FORM, no: String(no) });
    setModalOpen(true);
  };

  const openEdit = (chapter: AdminChapter) => {
    const { minutes, seconds } = parseDuration(chapter.duration_label);
    setForm({
      title: chapter.title,
      blurb: chapter.blurb,
      no: String(chapter.no),
      minutes: String(minutes),
      seconds: String(seconds),
      durationLabel: chapter.duration_label,
      coverImage: null,
      fullAudio: null,
      editChapterId: chapter.id,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    if (!submitting) resetForm();
  };

  const handleAudioChange = (file: File | null) => {
    setForm((f) => ({
      ...f,
      fullAudio: file,
      minutes: "0",
      seconds: "0",
      durationLabel: "",
    }));
    if (!file) return;
    readAudioDuration(file)
      .then((d) => {
        const minutes = Math.floor(d / 60);
        const seconds = Math.floor(d % 60);
        setForm((f) =>
          f.fullAudio === file
            ? {
                ...f,
                minutes: String(minutes),
                seconds: String(seconds),
                durationLabel: `${minutes}:${String(seconds).padStart(2, "0")}`,
              }
            : f,
        );
      })
      .catch(() => {
        setForm((f) =>
          f.fullAudio === file ? { ...f, durationLabel: "" } : f,
        );
      });
  };

  const uploadFile = async (
    chapterId: string,
    kind: "cover" | "full",
    file: File,
  ): Promise<boolean> => {
    if (!token) return false;
    try {
      await api.adminUploadFile(chapterId, kind, file, token);
      return true;
    } catch (e) {
      showMsg("error", e instanceof Error ? e.message : "Upload failed.");
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!form.title.trim()) return showMsg("error", "Title is required.");
    if (!form.fullAudio)
      return showMsg("error", "Pick an audio file to upload.");

    const minutes = parseInt(form.minutes, 10) || 0;
    const seconds = Math.min(59, parseInt(form.seconds, 10) || 0);
    const durationLabel =
      form.durationLabel || `${minutes}:${String(seconds).padStart(2, "0")}`;

    setSubmitting(true);
    setMsg(null);
    try {
      let chapterId: string;
      if (!form.editChapterId) {
        const res = await api.adminCreateChapter(
          {
            title: form.title.trim(),
            blurb: form.blurb,
            minutes,
            seconds,
            duration_label: durationLabel,
            no: Number(form.no),
          },
          token,
        );
        if (!res?.id)
          throw new Error("Chapter created but no id was returned.");
        chapterId = res.id;
      } else {
        chapterId = form.editChapterId;
        await api.adminUpdateChapter(
          chapterId,
          {
            title: form.title.trim(),
            blurb: form.blurb,
            minutes,
            seconds,
            duration_label: durationLabel,
          },
          token,
        );
      }

      const tasks: Promise<boolean>[] = [
        uploadFile(chapterId, "full", form.fullAudio),
      ];
      if (form.coverImage) {
        tasks.push(uploadFile(chapterId, "cover", form.coverImage));
      }
      const results = await Promise.all(tasks);

      if (results.every(Boolean)) {
        showMsg(
          "success",
          form.editChapterId
            ? "Chapter updated."
            : "Audio uploaded successfully.",
        );
        setModalOpen(false);
        resetForm();
        loadAll();
      }
    } catch (err) {
      showMsg("error", err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!token) return;
    if (
      !confirm(
        "Delete this chapter and all its files? This removes the chapter, its audio and its cover. This cannot be undone.",
      )
    )
      return;
    try {
      await api.adminDeleteChapter(chapterId, token);
      showMsg("success", "Chapter and its files deleted.");
      loadAll();
    } catch (e) {
      showMsg("error", e instanceof Error ? e.message : "Delete failed.");
    }
  };

  if (authLoading || !user) {
    return (
      <div className="ff-display flex min-h-screen items-center justify-center bg-white">
        <div className="flex items-center gap-3 text-neutral-400">
          <Mark className="h-6 w-6 animate-pulse text-neutral-900" />
          <p className="text-[13.5px]">Loading…</p>
        </div>
      </div>
    );
  }
  if (!user.is_admin) {
    return (
      <div className="ff-display flex min-h-screen items-center justify-center bg-white">
        <p className="text-neutral-400">Access denied.</p>
      </div>
    );
  }

  const isEditing = !!form.editChapterId;

  return (
    <div className="ff-display min-h-screen bg-neutral-50 text-neutral-900">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
          <Link
            href="/"
            className="flex items-center gap-2"
            aria-label="Dream Job Made Easy home"
          >
            <Mark className="h-7 w-7" />
            <span className="hidden text-[15px] font-semibold tracking-[-0.01em] sm:inline">
              Dream Job Made Easy
            </span>
          </Link>
          <Pill tone="soft">Admin</Pill>
          <span className="text-[13.5px] text-neutral-500">
            Audio & chapter management
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-full border border-neutral-200 px-4 py-2 text-[12.5px] font-medium text-neutral-600 transition hover:border-neutral-900"
            >
              Dashboard
            </Link>
            <button
              onClick={logout}
              className="rounded-full border border-neutral-200 px-4 py-2 text-[12.5px] font-medium text-neutral-600 transition hover:border-neutral-900"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-5 py-8 pb-20">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-semibold tracking-[-0.03em] sm:text-[32px]">
              Manage Audio Uploads
            </h1>
            <p className="mt-1 text-[13.5px] text-neutral-500">
              Upload audio and cover art. Duration is read automatically from
              the file.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadAll}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-[12px] font-medium text-neutral-600 transition hover:border-neutral-900 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
            <button
              onClick={openUpload}
              className="flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-[12.5px] font-medium text-white transition hover:bg-neutral-700"
            >
              <Upload className="h-4 w-4" />
              Upload New Audio
            </button>
          </div>
        </div>

        {msg && (
          <div
            role="alert"
            className={`mt-5 rounded-2xl border px-4 py-3 text-[13px] ${
              msg.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {msg.text}
          </div>
        )}

        {/* ---------------- existing chapters ---------------- */}
        <section className="mt-8">
          <Pill>Existing Chapters</Pill>

          <div className="mt-4">
            {loading ? (
              <p className="flex items-center justify-center gap-2 py-10 text-[13.5px] text-neutral-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading chapters…
              </p>
            ) : chapters.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-neutral-200 bg-white px-6 py-12 text-center">
                <p className="text-[14px] font-medium text-neutral-600">
                  No chapters yet.
                </p>
                <p className="mt-1 text-[12.5px] text-neutral-400">
                  Click “Upload New Audio” to add the first one.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {chapters.map((chapter) => (
                  <article
                    key={chapter.id}
                    className="flex flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white"
                  >
                    <div className="flex gap-4 p-4">
                      {chapter.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${API_BASE}/api/cover/${chapter.id}?token=${token}`}
                          alt={`${chapter.title} cover`}
                          className="h-20 w-20 shrink-0 rounded-2xl object-cover"
                        />
                      ) : (
                        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border border-neutral-200 bg-neutral-100 text-neutral-400">
                          <ImageIcon className="h-8 w-8" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-600">
                            Chapter {chapter.no}
                          </span>
                          <span className="flex items-center gap-1 text-[11.5px] text-neutral-400">
                            <Clock className="h-3.5 w-3.5" />
                            {chapter.duration_label}
                          </span>
                        </div>
                        <h2 className="mt-1.5 truncate text-[16px] font-semibold leading-snug tracking-[-0.01em]">
                          {chapter.title}
                        </h2>
                        <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-neutral-500">
                          {chapter.blurb || "No description yet."}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-medium ${
                          chapter.full_key
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        <FileAudio className="h-3.5 w-3.5" />
                        Full audio {chapter.full_key ? "✓" : "—"}
                      </span>

                      <button
                        onClick={() => handleDeleteChapter(chapter.id)}
                        className="text-[11px] font-medium text-red-500 underline-offset-2 hover:underline"
                      >
                        Delete
                      </button>

                      <button
                        onClick={() => openEdit(chapter)}
                        className="ml-auto rounded-full border border-neutral-200 px-4 py-1.5 text-[12px] font-medium text-neutral-600 transition hover:border-neutral-900 hover:text-neutral-900"
                      >
                        Edit
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ---------------- wasabi files ---------------- */}
        <section className="mt-10 hidden">
          <Pill>Wasabi Files</Pill>
          <div className="mt-4 overflow-hidden rounded-3xl border border-neutral-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-neutral-100 bg-neutral-50">
                  <tr>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
                      Key
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
                      Size
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
                      Last modified
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-8 text-center text-[13px] text-neutral-400"
                      >
                        Loading…
                      </td>
                    </tr>
                  ) : wasabiFiles.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-8 text-center text-[13px] text-neutral-400"
                      >
                        No files in the bucket yet.
                      </td>
                    </tr>
                  ) : (
                    wasabiFiles.map((f, i) => (
                      <tr
                        key={i}
                        className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50"
                      >
                        <td className="max-w-[380px] truncate px-4 py-2.5 font-mono text-[11.5px] text-neutral-700">
                          {f.key}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-[12.5px] text-neutral-500">
                          {(f.size / 1024 / 1024).toFixed(2)} MB
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-[12.5px] text-neutral-500">
                          {f.last_modified || "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {/* ---------------- upload / edit modal ---------------- */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4 backdrop-blur-sm"
          onClick={() => !submitting && closeModal()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
            className="ff-display max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)] sm:p-7"
          >
            <div className="flex items-center justify-between gap-3">
              <Pill tone={isEditing ? "light" : "soft"}>
                {isEditing ? "Edit Chapter" : "Upload New Audio"}
              </Pill>
              <button
                onClick={closeModal}
                disabled={submitting}
                aria-label="Close"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 grid gap-5">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
                  Audio Title
                </label>
                <input
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="e.g., A CV that gets shortlisted"
                  className={inputCls}
                  disabled={submitting}
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
                  Duration{" "}
                  <span className="normal-case text-neutral-300">
                    (auto from file)
                  </span>
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3.5">
                  <Clock className="h-4 w-4 text-neutral-400" />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.minutes}
                    readOnly
                    className="w-14 bg-transparent text-center text-[14px] font-semibold text-neutral-900 focus:outline-none"
                    aria-label="Minutes"
                  />
                  <span className="text-neutral-400">:</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.seconds}
                    readOnly
                    className="w-14 bg-transparent text-center text-[14px] font-semibold text-neutral-900 focus:outline-none"
                    aria-label="Seconds"
                  />
                  <span className="ml-auto truncate text-[12.5px] text-neutral-400">
                    {form.durationLabel
                      ? `Total ${form.durationLabel}`
                      : "mm:ss"}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["coverImage", "Cover Image", "image/*"],
                    ["fullAudio", "Audio File (MP3)", "audio/mpeg,audio/mp3"],
                  ] as const
                ).map(([field, label, accept]) => {
                  const file = form[field];
                  const Icon = field === "coverImage" ? ImageIcon : Music2;
                  return (
                    <label
                      key={field}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed p-3.5 transition hover:border-neutral-900 ${
                        file
                          ? "border-neutral-900 bg-neutral-50"
                          : "border-neutral-200 bg-white"
                      } ${submitting ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-600">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
                          {label}
                        </span>
                        <span className="block truncate text-[12.5px] font-medium text-neutral-800">
                          {file ? file.name : "No file selected"}
                        </span>
                        {file && (
                          <span className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                            {field === "fullAudio" && form.durationLabel && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {form.durationLabel}
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                      {file && (
                        <button
                          type="button"
                          aria-label={`Clear ${label}`}
                          onClick={(e) => {
                            e.preventDefault();
                            if (field === "coverImage")
                              setForm((f) => ({ ...f, coverImage: null }));
                            else handleAudioChange(null);
                          }}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-200 hover:text-neutral-900"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      <input
                        type="file"
                        accept={accept}
                        className="sr-only"
                        disabled={submitting}
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          if (field === "coverImage")
                            setForm((f) => ({ ...f, coverImage: file }));
                          else handleAudioChange(file);
                        }}
                      />
                    </label>
                  );
                })}
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
                  Blurb / Description
                </label>
                <textarea
                  value={form.blurb}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, blurb: e.target.value }))
                  }
                  rows={3}
                  placeholder="What listeners get from this tape…"
                  className={`${inputCls} resize-none`}
                  disabled={submitting}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-5">
                <span className="flex items-center gap-1.5 text-[12.5px] text-neutral-400">
                  <Disc3 className="h-4 w-4" />
                  {isEditing ? "Editing" : "Will be added as"} Chapter {form.no}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={submitting}
                    className="rounded-full border border-neutral-200 px-5 py-2.5 text-[12.5px] font-medium text-neutral-600 transition hover:border-neutral-900 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-2.5 text-[12.5px] font-medium text-white transition hover:bg-neutral-700 disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        {isEditing ? "Save Changes" : "Upload Audio"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
