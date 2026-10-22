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
    <header className="desk-hero reveal">
      <div className="desk-hero-topline">
        <p className="brand-lockup">
          <span className="brand-mark" aria-hidden="true" />
          DeskLore <span aria-hidden="true">/</span> حكايات الترابيزات
        </p>
        <p className="live-status">
          <span className="live-dot" aria-hidden="true" />
          حيّة دلوقتي
        </p>
      </div>

      <div className="desk-hero-grid">
        <div className="desk-hero-copy">
          <p className="section-kicker">01 / A SHARED DESK</p>
          <h1 className="desk-title">
            <span>ترابيزة</span>
            <bdi dir="ltr">{desk.id}</bdi>
          </h1>
          <p className="desk-deck">
            مكان واحد. ناس كتير. أثر صغير يعدّي من طالب لطالب.
          </p>
        </div>

        <div className="desk-stat-card" aria-label="إحصائيات الترابيزة">
          <p className="desk-stat-label">وقت اتجمع هنا</p>
          <p className="desk-stat-value">
            {hours}<span> س</span>
          </p>
          <p className="desk-stat-meta">{desk.zoneName}</p>
        </div>
      </div>

      <div className="desk-prompt-card">
        <span className="prompt-index">السؤال المفتوح</span>
        <p>{prompt}</p>
      </div>

      <div className="desk-flow" aria-label="طريقة استخدام DeskLore">
        <span><b>01</b> اقرأ</span>
        <i aria-hidden="true" />
        <span><b>02</b> ركّز</span>
        <i aria-hidden="true" />
        <span><b>03</b> سيب أثر</span>
      </div>
    </header>
  );
}
