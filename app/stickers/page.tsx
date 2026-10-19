import StickerSheet from "./StickerSheet";
import { defaultDeskIds } from "@/lib/sticker";

export default function StickersPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full flex-col items-center px-4 py-10">
      <div className="not-print w-full max-w-3xl text-center">
        <h1 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>
          DeskLore — مولّد استيكرات QR
        </h1>
        <p className="mt-2 max-w-md mx-auto text-sm" style={{ color: "var(--ink-muted)" }}>
          اطبع على ورق/فينيل مطفي، 4×4 سم، حطه فوق يمين الترابيزة
        </p>
      </div>
      <div className="mt-8 flex w-full justify-center">
        <div className="card w-full max-w-3xl p-6 print:p-0 print:border-0 print:shadow-none print:bg-transparent">
          <StickerSheet desks={defaultDeskIds()} />
        </div>
      </div>
    </main>
  );
}
