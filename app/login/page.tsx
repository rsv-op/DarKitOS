import Link from "next/link";

const stations = [
  {
    href: "/owner",
    title: "Owner",
    description:
      "Command center for cross-kitchen operations, inventory and performance.",
  },
  {
    href: "/cook",
    title: "Cook",
    description:
      "Kitchen order queue for preparation and ready-for-pickup updates.",
  },
  {
    href: "/dispatch",
    title: "Dispatch",
    description:
      "Driver assignment, pickup and dispatch workflow.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-5xl flex-col justify-center">
        <header className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Dark Cloud Kitchen OS
          </p>

          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            Kitchen Operations
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Unified operating system for orders,
            cooking, dispatch, inventory and
            cross-kitchen visibility.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {stations.map((station) => (
            <Link
              key={station.href}
              href={station.href}
              className="group rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-slate-600 hover:bg-slate-800"
            >
              <div className="flex min-h-48 flex-col justify-between">
                <div>
                  <h2 className="text-xl font-bold">
                    {station.title}
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {station.description}
                  </p>
                </div>

                <div className="mt-6 text-sm font-bold text-slate-200">
                  Open station →
                </div>
              </div>
            </Link>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold">
                Employee access
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Station access is controlled by the
                employee role and permissions.
              </p>
            </div>

            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-4 text-sm font-bold text-slate-200 hover:bg-slate-800"
            >
              Employee Login
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
