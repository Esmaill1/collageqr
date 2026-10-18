"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";

/**
 * Wave 7 admin dashboard (PLAN.md §5): review hidden/flagged capsules and
 * restore (clear reports + republish) or delete them. Auth is a single
 * shared admin token sent as a Bearer header — no accounts, no cookies.
 */

interface AdminCapsule {
  id: string;
  deskId: string;
  type: string;
  authorAlias: string | null;
  textContent: string | null;
  doodleData: string | null;
  trackUrl: string | null;
  reportCount: number;
  status: string;
  createdAt: string;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

function snippet(c: AdminCapsule): string {
  if (c.textContent) {
    return c.textContent.length > 80
      ? `${c.textContent.slice(0, 80)}…`
      : c.textContent;
  }
  if (c.doodleData) return "[رسمة بكسل]";
  return c.trackUrl ? "[كاسيت أغنية]" : "[مفيش محتوى]";
}

const typeLabels: Record<string, string> = {
  note: "ملحوظة",
  sticker: "استيكر",
};

const statusLabels: Record<string, string> = {
  hidden: "مخفي",
  flagged: "مبلّغ",
  published: "منشور",
  sealed: "مختوم",
};

function typeLabel(type: string): string {
  return typeLabels[type] ?? type;
}

function statusLabel(status: string): string {
  return statusLabels[status] ?? status;
}

export default function AdminPage() {
  const [tokenInput, setTokenInput] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [capsules, setCapsules] = useState<AdminCapsule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (authToken: string): Promise<boolean> => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin", {
        headers: authHeaders(authToken),
      });
      if (res.status === 401) {
        setToken(null);
        setCapsules(null);
        setError("كلمة سر غلط");
        return false;
      }
      if (!res.ok) {
        setError(`مشكلة في API الأدمن (${res.status})`);
        return false;
      }
      const data = (await res.json()) as { capsules?: AdminCapsule[] };
      setCapsules(data.capsules ?? []);
      setError(null);
      return true;
    } catch {
      setError("مشكلة في الاتصال");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!tokenInput) return;
    setError(null);
    const ok = await load(tokenInput);
    if (ok) {
      setToken(tokenInput);
      setTokenInput("");
    }
  }

  async function act(capsuleId: string, action: "restore" | "delete") {
    if (!token) return;
    setBusy(true);
    try {
      const res =
        action === "restore"
          ? await fetch("/api/admin", {
              method: "PATCH",
              headers: {
                ...authHeaders(token),
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ id: capsuleId, action: "restore" }),
            })
          : await fetch("/api/admin", {
              method: "DELETE",
              headers: {
                ...authHeaders(token),
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ id: capsuleId }),
            });
      if (res.status === 401) {
        setToken(null);
        setCapsules(null);
        setError("كلمة سر غلط");
        return;
      }
      // Refetch regardless so the table always mirrors the DB.
      await load(token);
    } catch {
      setError("مشكلة في الاتصال");
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <main
        className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4"
      >
        <h1 className="mb-1 text-lg font-semibold text-ink">لوحة تحكم الإشراف</h1>
        <p className="mb-6 text-xs text-ink opacity-60">
          مراجعة الكبسولات المخفية والمبلّغ عنها.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="كلمة سر الأدمن"
            className="w-full rounded border bg-transparent px-3 py-2 text-sm text-ink"
            style={{ borderColor: "var(--grid-line)" }}
            autoComplete="off"
          />
          {error && (
            <p className="text-xs font-semibold text-accent">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy || !tokenInput}
            className="w-full rounded px-3 py-2 text-sm font-semibold text-bg"
            style={{ backgroundColor: "var(--ink)" }}
          >
            {busy ? "بنشيك…" : "ادخل"}
          </button>
          <Link
            href="/"
            className="block text-center text-xs text-ink opacity-60 hover:opacity-90"
          >
            ← ارجع للترابيزات
          </Link>
        </form>
      </main>
    );
  }

  const count = capsules?.length ?? 0;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold text-ink">لوحة تحكم الإشراف</h1>
        <div className="flex items-center gap-4">
          <span className="text-xs text-ink opacity-60">
            مخفي / مبلّغ: <strong>{count}</strong>
          </span>
          <Link
            href="/"
            className="text-xs text-ink opacity-60 hover:opacity-90"
          >
            ← ارجع للترابيزات
          </Link>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-xs font-semibold text-accent">{error}</p>
      )}

      {capsules === null ? (
        <p className="text-sm text-ink opacity-60">بيحمّل…</p>
      ) : count === 0 ? (
        <p className="text-sm text-ink opacity-60">
          مفيش حاجة للمراجعة — مفيش كبسولات مخفية أو مبلّغ عنها.
        </p>
      ) : (
        <ul className="space-y-3">
          {capsules.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border p-4"
              style={{
                borderColor: "var(--grid-line)",
                backgroundColor: "var(--bg)",
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {snapshotLabel(c)}
                  </p>
                  <p className="text-xs text-ink opacity-70 break-words">
                    {snippet(c)}
                  </p>
                </div>
                <p className="text-xs uppercase tracking-wide text-ink opacity-50">
                  {typeLabel(c.type)} · {statusLabel(c.status)} · بلاغات{" "}
                  {c.reportCount} ·{" "}
                  {new Date(c.createdAt).toLocaleDateString()} · ترابيزة{" "}
                  {c.deskId}
                  {c.authorAlias ? ` · — ${c.authorAlias}` : ""}
                </p>
              </div>
              {c.doodleData && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.doodleData}
                  alt=""
                  aria-hidden="true"
                  className="mt-2 h-16 w-32 rounded"
                  style={{
                    imageRendering: "pixelated",
                    border: "1px solid var(--grid-line)",
                  }}
                />
              )}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(c.id, "restore")}
                  className="rounded px-3 py-1.5 text-xs font-semibold text-ink"
                  style={{ border: "1px solid var(--grid-line)" }}
                >
                  استرجع
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(c.id, "delete")}
                  className="rounded px-3 py-1.5 text-xs font-semibold text-accent"
                  style={{ border: "1px solid var(--grid-line)" }}
                >
                  امسح
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function snapshotLabel(c: AdminCapsule): string {
  return c.authorAlias ? `ملحوظة من ${c.authorAlias}` : "ملحوظة مجهولة";
}
