import type { CapsuleFeedItem } from "@/lib/feed";
import CapsuleCard from "./CapsuleCard";

export default function Corkboard({
  capsules,
  sealedPendingCount,
}: {
  capsules: CapsuleFeedItem[];
  sealedPendingCount: number;
}) {
  if (capsules.length === 0) {
    return (
      <section
        aria-label="لوحة الفلين بتاعة المكتب"
        className="flex flex-col items-center justify-center px-6 py-10 text-center"
        style={{
          border: "1px dashed var(--grid-line)",
          borderRadius: "var(--radius-lg)",
          background: "var(--paper)",
        }}
      >
        <span aria-hidden="true" style={{ fontSize: "var(--text-3xl)" }}>
          📌
        </span>
        <p
          className="mt-2"
          style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}
        >
          مفيش أثر هنا لسه. كن أول واحد سيب حاجة.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="لوحة الفلين بتاعة المكتب">
      {sealedPendingCount > 0 && (
        <p
          className="mb-4 px-4 py-3"
          style={{
            border: "1px solid var(--accent)",
            borderRadius: "var(--radius-md)",
            background: "var(--accent-soft)",
            color: "var(--accent)",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
          }}
        >
          ✉ مظروف مختوم مستني اللي بعدك
        </p>
      )}
      <ul className="columns-1 gap-4 sm:columns-2">
        {capsules.map((capsule) => (
          <li key={capsule.id} className="mb-4 break-inside-avoid">
            <CapsuleCard capsule={capsule} />
          </li>
        ))}
      </ul>
    </section>
  );
}
