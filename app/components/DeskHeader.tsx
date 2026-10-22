export default function DeskHeader() {
  return (
    <header className="desk-hero desk-hero-simple reveal">
      <div className="desk-hero-topline">
        <p className="brand-lockup">
          <span className="brand-mark" aria-hidden="true" />
          DeskLore
        </p>
      </div>

      <div className="desk-hero-grid">
        <div className="desk-hero-copy">
          <h1 className="desk-title">
            <span>براحتك.</span>
          </h1>
          <p className="desk-deck">
            اقرا، ركّز شوية، واكتب أي حاجة لو حابب.
          </p>
        </div>
      </div>
    </header>
  );
}
