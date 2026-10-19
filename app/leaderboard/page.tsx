import Link from "next/link";

/** The pilot keeps attention on the desk-to-desk message chain. */
export default function LeaderboardPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center px-4 text-center">
      <section className="card w-full p-8">
        <p className="text-4xl" aria-hidden="true">
          💌
        </p>
        <h1 className="mt-4 text-xl font-bold" style={{ color: "var(--ink)" }}>
          ترتيب الترابيزات لسه مستني
        </h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
          في النسخة التجريبية، كل التركيز على الرسائل اللي بتعدّي من طالب لطالب.
        </p>
        <Link href="/" className="btn btn-primary btn-block mt-6">
          ارجع للترابيزة
        </Link>
      </section>
    </main>
  );
}
