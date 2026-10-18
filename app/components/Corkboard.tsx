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
        className="rounded-lg border p-6 text-center text-sm text-ink opacity-70"
        style={{ borderColor: "var(--grid-line)" }}
      >
        مفيش أثر هنا لسه. كن أول واحد سيب حاجة.
      </section>
    );
  }

  return (
    <section aria-label="لوحة الفلين بتاعة المكتب">
      {sealedPendingCount > 0 && (
        <p
          className="mb-4 rounded-lg border border-dashed px-4 py-3 text-xs text-ink opacity-80"
          style={{ borderColor: "var(--accent)" }}
        >
          ✉ مظروف مختوم مستني اللي بعدك
        </p>
      )}
      <ul className="flex flex-col gap-4">
        {capsules.map((capsule) => (
          <li key={capsule.id}>
            <CapsuleCard capsule={capsule} />
          </li>
        ))}
      </ul>
    </section>
  );
}
