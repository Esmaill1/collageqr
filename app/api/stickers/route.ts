import { NextResponse } from "next/server";
import QRCode from "qrcode";
import {
  buildDeskUrl,
  defaultDeskIds,
  parseDeskList,
} from "@/lib/sticker";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("desks");
  const desks = raw ? parseDeskList(raw) : defaultDeskIds();

  const stickers = await Promise.all(
    desks.map(async (id) => {
      const url = buildDeskUrl(id);
      const qrSvg = await QRCode.toString(url, {
        type: "svg",
        margin: 1,
        width: 200,
        color: { dark: "#1a1714", light: "#ffffff" },
      });
      return { id, url, qrSvg };
    }),
  );

  return NextResponse.json(stickers);
}
