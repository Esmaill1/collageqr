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
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4">
        <div className="card w-full p-8">
          <h1 className="mb-1 text-xl font-bold" style={{ color: "var(--ink)" }}>
            لوحة تحكم الإشراف
          </h1>
          <p className="mb-6 text-sm" style={{ color: "var(--ink-muted)" }}>
            مراجعة الكبسولات المخفية والمبلّغ عنها.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="admin-password"
                className="mb-2 block text-sm font-medium"
                style={{ color: "var(--ink)" }}
              >
                كلمة سر الأدمن
              </label>
              <input
                type="password"
                id="admin-password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="كلمة سر الأدمن"
                className="input"
                autoComplete="off"
              />
            </div>
            {error && (
              <p
                role="alert"
                className="text-sm font-semibold"
                style={{ color: "var(--danger)" }}
              >
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || !tokenInput}
              className="btn btn-primary btn-block"
            >
              {busy ? "بنشيك…" : "ادخل"}
            </button>
            <Link
              href="/"
              className="btn btn-ghost btn-block"
              style={{ color: "var(--ink-muted)" }}
            >
              ← ارجع للترابيزات
            </Link>
          </form>
        </div>
      </main>
    );
  }

  const count = capsules?.length ?? 0;

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>
            لوحة تحكم الإشراف
          </h1>
          <span
            className="pill mt-2"
            style={{ color: count > 0 ? "var(--accent)" : "var(--ink-muted)" }}
          >
            مخفي / مبلّغ: <strong>{count}</strong>
          </span>
        </div>
        <Link
          href="/"
          className="btn btn-ghost"
          style={{ color: "var(--ink-muted)" }}
        >
          ← ارجع للترابيزات
        </Link>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-4 text-sm font-semibold"
          style={{ color: "var(--danger)" }}
        >
          {error}
        </p>
      )}

      {capsules === null ? (
        <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
          بيحمّل…
        </p>
      ) : count === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            مفيش حاجة للمراجعة — مفيش كبسولات مخفية أو مبلّغ عنها.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {capsules.map((c) => (
            <li key={c.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>
                    {snapshotLabel(c)}
                  </p>
                  <p
                    className="mt-1 break-words text-sm"
                    style={{ color: "var(--ink-muted)" }}
                  >
                    {snippet(c)}
                  </p>
                </div>
                <p
                  className="flex flex-wrap gap-x-1 text-xs"
                  style={{ color: "var(--ink-faint)" }}
                >
                  <span>{typeLabel(c.type)}</span>
                  <span>·</span>
                  <span>{statusLabel(c.status)}</span>
                  <span>·</span>
                  <span>بلاغات {c.reportCount}</span>
                  <span>·</span>
                  <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                  <span>·</span>
                  <span>ترابيزة {c.deskId}</span>
                  {c.authorAlias ? <span>· — {c.authorAlias}</span> : null}
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
                  className="btn btn-ghost btn-sm"
                  style={{ color: "var(--success)", borderColor: "var(--grid-line)" }}
                >
                  استرجع
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(c.id, "delete")}
                  className="btn btn-danger btn-sm"
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
