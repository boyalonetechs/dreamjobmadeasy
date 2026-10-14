export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080";

export type Chapter = {
  id: string;
  no: number;
  title: string;
  duration_label: string;
  blurb: string;
  free: boolean;
  locked: boolean;
  cover_image_url: string | null;
  sample_url: string;
  audio_url: string | null;
  sample_key?: string;
  full_key?: string;
};

export type AdminAudioFile = {
  id: string;
  chapter_id: string;
  kind: string;
  audio_url: string | null;
  storage_provider: string | null;
  storage_key: string | null;
  byte_size: number | null;
};

export type AdminChapter = {
  id: string;
  no: number;
  title: string;
  blurb: string;
  minutes: number;
  duration_label: string;
  cover_image_url: string | null;
  sample_url: string | null;
  sample_key: string | null;
  full_url: string | null;
  full_key: string | null;
};

export type WasabiFile = {
  key: string;
  size: number;
  last_modified: string | null;
};

export type Book = {
  title: string;
  subtitle: string;
  total: string;
  price_ngn: string;
  price_usd: string;
  price_ngn_kobo: number;
  unlocked: boolean;
  chapters: Chapter[];
};

async function req(path: string, opts: RequestInit = {}, token?: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((opts.headers as Record<string, string>) || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

async function reqForm(path: string, body: FormData, token?: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", body, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

export const api = {
  signup: (name: string, email: string, password: string) =>
    req("/api/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password }) }),
  login: (email: string, password: string) =>
    req("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: (token: string) => req("/api/auth/me", {}, token),
  book: (token?: string | null) => req("/api/book", {}, token),
  audio: (id: string, token?: string | null) => req(`/api/audio/${id}`, {}, token),
  paystackInit: (email: string, token: string) =>
    req("/api/payments/paystack/initialize", { method: "POST", body: JSON.stringify({ email }) }, token),
  paystackVerify: (reference: string, token: string) =>
    req(`/api/payments/paystack/verify/${reference}`, {}, token),
  paypalCreate: (token: string) =>
    req("/api/payments/paypal/create-order", { method: "POST", body: JSON.stringify({}) }, token),
  paypalCapture: (order_id: string, token: string) =>
    req("/api/payments/paypal/capture", { method: "POST", body: JSON.stringify({ order_id }) }, token),
  devUnlock: (token: string) => req("/api/dev/unlock", { method: "POST", body: JSON.stringify({}) }, token),
  // Admin
  adminWasabiFiles: (token: string) => req("/api/admin/wasabi/files", {}, token),
  adminUploadFile: (chapterId: string, kind: "cover" | "full", file: File, token: string) => {
    const form = new FormData();
    form.append("chapter_id", chapterId);
    form.append("kind", kind);
    form.append("file", file);
    return reqForm("/api/admin/upload", form, token);
  },
  adminPresignUpload: (chapterId: string, kind: string, filename: string, contentType: string, token: string) =>
    req("/api/admin/wasabi/presign-upload", { method: "POST", body: JSON.stringify({ chapter_id: chapterId, kind, filename, content_type: contentType }) }, token),
  adminAudioSync: (chapterId: string, kind: string, storageKey: string, token: string, byteSize?: number) =>
    req("/api/admin/audio-sync", { method: "POST", body: JSON.stringify({ chapter_id: chapterId, kind, storage_key: storageKey, byte_size: byteSize }) }, token),
  adminChapters: (token: string) => req("/api/admin/chapters", {}, token),
  adminCreateChapter: (data: { title: string; blurb?: string; minutes?: number; seconds?: number; duration_label?: string; no?: number }, token: string) =>
    req("/api/admin/chapters", { method: "POST", body: JSON.stringify(data) }, token),
  adminPresignCover: (chapterId: string, filename: string, contentType: string, token: string) =>
    req("/api/admin/cover/presign-upload", { method: "POST", body: JSON.stringify({ chapter_id: chapterId, filename, content_type: contentType }) }, token),
  adminCoverSync: (chapterId: string, storageKey: string, token: string) =>
    req("/api/admin/cover-sync", { method: "POST", body: JSON.stringify({ chapter_id: chapterId, storage_key: storageKey }) }, token),
  adminUpdateChapter: (
    id: string,
    data: { title?: string; blurb?: string; minutes?: number; seconds?: number; duration_label?: string },
    token: string,
  ) => req(`/api/admin/chapters/${id}`, { method: "PUT", body: JSON.stringify(data) }, token),
  adminDeleteChapter: (id: string, token: string) =>
    req(`/api/admin/chapters/${id}`, { method: "DELETE" }, token),
};
