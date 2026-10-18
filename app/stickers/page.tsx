import StickerSheet from "./StickerSheet";
import { defaultDeskIds } from "@/lib/sticker";

export default function StickersPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full flex-col items-center px-4 py-10 text-ink">
      <h1 className="text-2xl font-bold">DeskLore — مولّد استيكرات QR</h1>
      <p className="mt-2 max-w-md text-center text-sm opacity-70">
        اطبع على ورق/فينيل مطفي، 4×4 سم، حطه فوق يمين الترابيزة
      </p>
      <div className="mt-8 flex w-full justify-center">
        <StickerSheet desks={defaultDeskIds()} />
      </div>
    </main>
  );
}
