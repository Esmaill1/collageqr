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
        aria-label="لوحة الرسائل"
        className="board-section reveal reveal-delay-1"
      >
        <div className="board-heading">
          <h2>آخر رسالة</h2>
        </div>
        <div className="board-empty">
          <span className="pin-mark" aria-hidden="true" />
          <p>مفيش رسائل هنا لسه.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="board-section reveal reveal-delay-1" aria-label="لوحة الرسائل">
      <div className="board-heading">
        <h2>آخر رسالة</h2>
      </div>
      {sealedPendingCount > 0 && (
        <p className="sealed-hint">
          <span className="seal-glyph" aria-hidden="true" />
          رسالة مقفولة للي بعدك
        </p>
      )}
      <div className="board-surface">
        <CapsuleCard capsule={capsules[0]} featured />

        {capsules.length > 1 ? (
          <details className="history-drawer">
            <summary>
              رسائل أقدم <span>({capsules.length - 1})</span>
            </summary>
            <ul>
              {capsules.slice(1).map((capsule) => (
                <li key={capsule.id}>
                  <CapsuleCard capsule={capsule} />
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </section>
  );
}
