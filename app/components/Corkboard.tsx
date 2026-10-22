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
        className="board-section reveal reveal-delay-1"
      >
        <div className="board-heading">
          <div>
            <p className="section-kicker">01 / THE WALL</p>
            <h2>آخر أثر على الترابيزة</h2>
          </div>
          <span className="board-count">00 <small>أثر</small></span>
        </div>
        <div className="board-empty">
          <span className="pin-mark" aria-hidden="true" />
          <p>مفيش أثر هنا لسه. كن أول واحد سيب حاجة.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="board-section reveal reveal-delay-1" aria-label="لوحة الفلين بتاعة المكتب">
      <div className="board-heading">
        <div>
          <p className="section-kicker">01 / THE WALL</p>
          <h2>آخر أثر على الترابيزة</h2>
        </div>
        <span className="board-count">
          {String(capsules.length).padStart(2, "0")} <small>أثر حي</small>
        </span>
      </div>
      {sealedPendingCount > 0 && (
        <p className="sealed-hint">
          <span className="seal-glyph" aria-hidden="true" />
          مظروف مختوم مستني اللي بعدك
        </p>
      )}
      <div className="board-surface">
        <CapsuleCard capsule={capsules[0]} featured />

        {capsules.length > 1 ? (
          <details className="history-drawer">
            <summary>
              شوف الرسائل الأقدم <span>({capsules.length - 1})</span>
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
