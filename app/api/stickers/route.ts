import { NextResponse } from "next/server";
import QRCode from "qrcode";
import {
  buildDeskUrl,
  defaultDeskIds,
  isValidDeskId,
  parseDeskList,
} from "@/lib/sticker";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("desks");
  const desks = raw ? parseDeskList(raw) : defaultDeskIds();
  const invalidDeskIds = desks.filter((id) => !isValidDeskId(id));
  if (invalidDeskIds.length > 0) {
    return NextResponse.json(
      { error: "invalid-desk-ids", invalidDeskIds },
      { status: 400 },
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : null);
  if (!origin) {
    return NextResponse.json({ error: "app-url-not-configured" }, { status: 500 });
  }

  try {
    const stickers = await Promise.all(
      desks.map(async (id) => {
        const url = buildDeskUrl(id, origin);
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
  } catch {
    return NextResponse.json({ error: "sticker-generation-failed" }, { status: 500 });
  }
}
