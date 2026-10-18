"use client";

import { useEffect, useState } from "react";
import { parseDeskList } from "@/lib/sticker";

type Sticker = { id: string; url: string; qrSvg: string };

function renderQr(svg: string, alt: string) {
  return <div className="sticker-qr" dangerouslySetInnerHTML={{ __html: svg }} aria-label={alt} role="img" />;
}

export default function StickerSheet({ desks }: { desks: string[] }) {
  const [deskInput, setDeskInput] = useState<string>(desks.join("\n"));
  const [activeDesks, setActiveDesks] = useState<string[]>(desks);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (activeDesks.length === 0) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/stickers?desks=${encodeURIComponent(activeDesks.join(","))}`);
        if (!res.ok) throw new Error(`Failed to generate stickers (HTTP ${res.status})`);
        const data: Sticker[] = await res.json();
        if (!cancelled) setStickers(data);
      } catch (err) {
        if (!cancelled) {
          setStickers([]);
          setError(err instanceof Error ? err.message : "Failed to generate stickers.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeDesks]);

  return (
    <section className="not-print w-full max-w-3xl">
      <label htmlFor="desk-list" className="mb-2 block text-sm font-medium" style={{ color: "var(--ink)" }}>
        Desk IDs (comma, space, or newline separated)
      </label>
      <textarea
        id="desk-list"
        rows={6}
        value={deskInput}
        onChange={(e) => setDeskInput(e.target.value)}
        className="w-full rounded border p-3 font-mono text-sm"
        style={{ borderColor: "var(--grid-line)", background: "var(--bg)", color: "var(--ink)" }}
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setActiveDesks(parseDeskList(deskInput))}
          className="rounded px-4 py-2 text-sm font-semibold"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          Generate
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded border px-4 py-2 text-sm font-semibold"
          style={{ borderColor: "var(--ink)", color: "var(--ink)" }}
        >
          Print
        </button>
        <span className="text-sm" style={{ color: "var(--ink)" }}>
          {activeDesks.length} desk{activeDesks.length === 1 ? "" : "s"}
        </span>
      </div>
      {error && (
        <p className="mt-3 text-sm" style={{ color: "var(--accent)" }}>
          {error}
        </p>
      )}

      <div className="mt-8">
        {loading && <p className="text-sm" style={{ color: "var(--ink)" }}>Generating QR codes…</p>}
        {!loading && stickers.length > 0 && (
          <div className="sticker-sheet grid grid-cols-1 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {stickers.map((s) => (
              <div key={s.id} className="sticker">
                {renderQr(s.qrSvg, `QR code for Desk ${s.id}`)}
                <p className="sticker-id">DESK #{s.id}</p>
                <p className="sticker-sub">Scan to open this desk&apos;s time-capsule &amp; focus timer</p>
              </div>
            ))}
          </div>
        )}
        {!loading && stickers.length === 0 && !error && (
          <p className="text-sm" style={{ color: "var(--ink)" }}>
            No desks yet — edit the list and press Generate.
          </p>
        )}
      </div>

      <style jsx global>{`
        .sticker {
          width: 4cm;
          height: 4cm;
          box-sizing: border-box;
          padding: 4px;
          background: #ffffff;
          color: #1a1714;
          border: 0.4mm solid #1a1714;
          border-radius: 1mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .sticker-qr {
          width: 2.4cm;
          height: 2.4cm;
        }
        .sticker-qr svg {
          width: 100%;
          height: 100%;
          display: block;
        }
        .sticker-id {
          margin-top: 2px;
          font-weight: 700;
          font-size: 9pt;
          letter-spacing: 0.4pt;
        }
        .sticker-sub {
          font-size: 6.5pt;
          line-height: 1.25;
          max-width: 3.6cm;
        }
        @media print {
          @page {
            size: A4;
            margin: 8mm;
          }
          body {
            background: #ffffff !important;
            background-image: none !important;
          }
          .not-print {
            display: none !important;
          }
          .sticker-sheet {
            grid-template-columns: repeat(4, 4cm);
            gap: 2mm;
          }
          .sticker {
            border-color: #1a1714;
          }
        }
      `}</style>
    </section>
  );
}
