import StickerSheet from "./StickerSheet";
import { defaultDeskIds } from "@/lib/sticker";

export default function StickersPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full flex-col items-center px-4 py-10 text-ink">
      <h1 className="text-2xl font-bold">DeskLore — QR Sticker Generator</h1>
      <p className="mt-2 max-w-md text-center text-sm opacity-70">
        Print on matte vinyl/paper, 4×4cm, place top-right of desk surface
      </p>
      <div className="mt-8 flex w-full justify-center">
        <StickerSheet desks={defaultDeskIds()} />
      </div>
    </main>
  );
}
