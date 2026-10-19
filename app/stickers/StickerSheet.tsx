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
        if (!res.ok) throw new Error(`فشل توليد الاستيكرات (HTTP ${res.status})`);
        const data: Sticker[] = await res.json();
        if (!cancelled) setStickers(data);
      } catch (err) {
        if (!cancelled) {
          setStickers([]);
          setError(err instanceof Error ? err.message : "فشل توليد الاستيكرات.");
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
    <section className="w-full">
      <div className="not-print">
        <label
          htmlFor="desk-list"
          className="mb-2 block text-sm font-medium"
          style={{ color: "var(--ink)" }}
        >
          أرقام الترابيزات
        </label>
        <textarea
          id="desk-list"
          rows={6}
          value={deskInput}
          onChange={(e) => setDeskInput(e.target.value)}
          className="input font-mono text-sm"
          style={{ resize: "vertical" }}
        />
        <p className="mt-1 text-xs" style={{ color: "var(--ink-faint)" }}>
          بفاصلة، مسافة، أو سطر جديد
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveDesks(parseDeskList(deskInput))}
            className="btn btn-primary"
          >
            ولّد
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn btn-ghost"
          >
            اطبع
          </button>
          <span className="pill" style={{ color: "var(--ink-muted)" }}>
            {activeDesks.length} ترابيزة
          </span>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-3 text-sm font-semibold"
            style={{ color: "var(--danger)" }}
          >
            {error}
          </p>
        )}
      </div>

      <div className="not-print mt-8">
        {loading && (
          <p
            className="flex items-center gap-2 text-sm"
            style={{ color: "var(--ink-muted)" }}
          >
            <span className="cassette-spin" aria-hidden="true">↻</span>
            <span>بيولّد أكواد QR…</span>
          </p>
        )}
        {!loading && stickers.length === 0 && !error && (
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            مفيش ترابيزات لسه — عدّل القائمة واضغط ولّد.
          </p>
        )}
      </div>

      {!loading && stickers.length > 0 && (
        <div className="sticker-sheet mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {stickers.map((s) => (
            <div key={s.id} className="sticker">
              {renderQr(s.qrSvg, `كود QR لترابيزة ${s.id}`)}
              <p className="sticker-id">ترابيزة #{s.id}</p>
              <p className="sticker-sub">امسح عشان تفتح كبسولة الترابيزة + مؤقت التركيز</p>
            </div>
          ))}
        </div>
      )}

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
