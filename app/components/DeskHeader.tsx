export default function DeskHeader({
  desk,
  prompt,
}: {
  desk: {
    id: string;
    zoneName: string;
    totalMinutes: number;
  };
  prompt: string;
}) {
  const hours = (desk.totalMinutes / 60).toFixed(1);

  return (
    <header className="card mb-6" style={{ padding: "var(--space-6)" }}>
      <h1
        className="font-bold"
        style={{ color: "var(--ink)", fontSize: "var(--text-2xl)", lineHeight: 1.25 }}
      >
        ترابيزة {desk.id}
      </h1>
      <p
        className="mt-1"
        style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}
      >
        {desk.zoneName}
      </p>

      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-2"
        style={{ marginTop: "var(--space-6)" }}
      >
        <span className="pill" style={{ color: "var(--ink-muted)" }}>
          {hours} ساعة تركيز اتجمعت هنا
        </span>
      </div>

      <div
        className="mt-6 rounded-lg p-4"
        style={{ background: "var(--accent-soft)", color: "var(--ink)" }}
      >
        <p className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
          سؤال الترابيزة
        </p>
        <p className="mt-1 text-sm font-semibold">{prompt}</p>
      </div>
    </header>
  );
}
