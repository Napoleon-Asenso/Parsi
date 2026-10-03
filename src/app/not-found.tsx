import Link from "next/link";

export default function NotFound() {
  return (
    <section className="card flex flex-col items-center justify-center p-8 text-center md:p-12">
      <h2 className="text-xl font-bold tracking-tight md:text-2xl">
        Page Not Found
      </h2>
      <p className="mt-2 text-sm text-on-surface-variant">
        The requested document or page could not be located.
      </p>
      <Link
        href="/"
        className="btn-primary mt-6 px-6 py-2.5 text-xs font-semibold"
      >
        Return to Upload
      </Link>
    </section>
  );
}
