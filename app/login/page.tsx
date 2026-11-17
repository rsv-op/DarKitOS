"use client";

import {
  FormEvent,
  Suspense,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import { EMPLOYEES_DB } from "@/lib/db";

const STATION_PRESETS = [
  {
    code: "OWNER-01",
    pin: "3333",
    name: "Patric Revuelto",
    role: "OWNER",
    kitchen: "Global All-Kitchen Scope",
    desc: "Command Center, VerticalForge BI, Brands, Kitchens, Staff RBAC",
    badge: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
  {
    code: "0001",
    pin: "9999",
    name: "Priya Sharma",
    role: "MANAGER",
    kitchen: "K1 • Gurugram Central Hub",
    desc: "Order Injection, Inventory Control, Cancellations, Operations",
    badge: "border-purple-500/40 bg-purple-500/10 text-purple-300",
  },
  {
    code: "2001",
    pin: "1111",
    name: "Rajesh Kumar",
    role: "LINE_COOK",
    kitchen: "K1 • Gurugram Central Hub",
    desc: "Cook KDS Station, Atomic Recipe Depletion, Mark Ready",
    badge: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  },
  {
    code: "3001",
    pin: "2222",
    name: "Arjun Mehta",
    role: "DISPATCH",
    kitchen: "K1 • Gurugram Central Hub",
    desc: "Dispatch Pass, Driver Assignment, Pickup & Handoff Evidence",
    badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  },
];

function LoginTerminalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam =
    searchParams.get("redirect") || "";

  const [mode, setMode] = useState<
    "CODE" | "PIN"
  >("CODE");
  const [employeeCode, setEmployeeCode] =
    useState("OWNER-01");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] =
    useState(false);

  async function executeLogin(codeOrPin: string) {
    const trimmed = codeOrPin.trim();
    if (!trimmed) {
      setError(
        "Employee code or station PIN is required",
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/login",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            employeeCode: trimmed,
            redirect: redirectParam,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data?.error ||
            "Invalid employee credentials",
        );
        setPin("");
        return;
      }

      const destination =
        typeof data?.redirectTo === "string"
          ? data.redirectTo
          : "/dashboard";

      router.replace(destination);
      router.refresh();
    } catch (err) {
      console.error("Login failed:", err);
      setError(
        "Unable to reach the Cloud7 Auth Gateway",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleFormSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    void executeLogin(
      mode === "CODE" ? employeeCode : pin,
    );
  }

  function handlePinDigit(digit: string) {
    setError("");
    if (pin.length < 4) {
      const next = pin + digit;
      setPin(next);
      if (next.length === 4) {
        void executeLogin(next);
      }
    }
  }

  return (
    <main className="min-h-screen bg-[#060911] text-slate-100 flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden">
      {/* Ambient Background Glow */}
      <div className="pointer-events-none absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-1/4 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />

      {/* Top Ecosystem Boot Banner */}
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/40 bg-sky-500/10 font-mono text-base font-black text-sky-400">
            DK
          </div>
          <div>
            <p className="font-mono text-sm font-black tracking-tight text-white">
              DarKIT<span className="text-emerald-400">OS</span>{" "}
              <span className="text-xs font-normal text-slate-400">
                • Cloud7 & VerticalForge Ecosystem
              </span>
            </p>
            <p className="font-mono text-[11px] text-slate-500">
              PostgreSQL RLS (is_local=true) • Edge Circuit Breaker: CLOSED • WebSocket KDS Sync
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            BOOT SEQUENCE READY
          </span>
        </div>
      </header>

      {/* Main Authentication Grid */}
      <div className="mx-auto my-8 grid w-full max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr] items-center">
        {/* Left: Login Terminal Card */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-sky-400">
                Station Authentication
              </span>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black text-white">
                Unlock DarKIT OS Terminal
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-400">
                Authenticate via canonical Employee Code or rapid-entry 4-digit Shift PIN.
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-950 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("CODE");
                setError("");
              }}
              className={`rounded-lg py-2.5 font-mono text-xs font-bold uppercase tracking-wider transition ${
                mode === "CODE"
                  ? "bg-sky-500 text-slate-950 shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Employee Code
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("PIN");
                setError("");
              }}
              className={`rounded-lg py-2.5 font-mono text-xs font-bold uppercase tracking-wider transition ${
                mode === "PIN"
                  ? "bg-emerald-500 text-slate-950 shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              4-Digit Shift PIN
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 font-mono text-xs text-red-300"
            >
              ⚠ {error}
            </div>
          )}

          {mode === "CODE" ? (
            <form
              onSubmit={handleFormSubmit}
              className="space-y-5"
            >
              <div>
                <label
                  htmlFor="employeeCode"
                  className="mb-2 block font-mono text-xs font-bold uppercase tracking-wider text-slate-300"
                >
                  Employee Code
                </label>
                <input
                  id="employeeCode"
                  name="employeeCode"
                  type="text"
                  value={employeeCode}
                  onChange={(e) =>
                    setEmployeeCode(
                      e.target.value,
                    )
                  }
                  placeholder="e.g. OWNER-01, 0001, 2001, 3001"
                  autoFocus
                  autoComplete="username"
                  autoCapitalize="characters"
                  spellCheck={false}
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-4 text-center font-mono text-lg font-bold tracking-widest text-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 py-4 font-mono text-sm font-black uppercase tracking-wider text-slate-950 shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Authenticating Session..."
                  : "Access Operational Station →"}
              </button>
            </form>
          ) : (
            <div>
              {/* 4-Digit PIN Dots */}
              <div className="mb-6 flex justify-center gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-4 w-4 rounded-full transition-all ${
                      i < pin.length
                        ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)] scale-110"
                        : "bg-slate-800 border border-slate-700"
                    }`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  "1",
                  "2",
                  "3",
                  "4",
                  "5",
                  "6",
                  "7",
                  "8",
                  "9",
                ].map((num) => (
                  <button
                    key={num}
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      handlePinDigit(num)
                    }
                    className="h-14 rounded-xl border border-slate-800 bg-slate-950 font-mono text-xl font-bold text-white transition hover:border-emerald-500/50 hover:bg-slate-800 active:scale-95"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPin("")}
                  className="h-14 rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs font-bold uppercase text-slate-400 hover:text-white"
                >
                  Clear
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    handlePinDigit("0")
                  }
                  className="h-14 rounded-xl border border-slate-800 bg-slate-950 font-mono text-xl font-bold text-white hover:border-emerald-500/50 hover:bg-slate-800"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPin((p) =>
                      p.slice(0, -1),
                    )
                  }
                  className="h-14 rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs font-bold uppercase text-amber-400 hover:text-amber-300"
                >
                  ⌫ Del
                </button>
              </div>
              <p className="mt-4 text-center font-mono text-xs text-slate-400">
                PIN Presets:{" "}
                <strong className="text-amber-300">
                  3333
                </strong>{" "}
                (Owner) •{" "}
                <strong className="text-purple-300">
                  9999
                </strong>{" "}
                (Manager) •{" "}
                <strong className="text-sky-300">
                  1111
                </strong>{" "}
                (Cook) •{" "}
                <strong className="text-emerald-300">
                  2222
                </strong>{" "}
                (Dispatch)
              </p>
            </div>
          )}
        </section>

        {/* Right: Instant Role & Station Launch Cards */}
        <section className="space-y-4">
          <div>
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-emerald-400">
              One-Click Role Terminal Presets
            </span>
            <h2 className="mt-1 text-xl font-bold text-white">
              Select an Authorized Operational Persona
            </h2>
            <p className="text-xs text-slate-400">
              Click any persona card below to sign in immediately with its canonical RBAC permissions.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {STATION_PRESETS.map((preset) => (
              <button
                key={preset.code}
                type="button"
                disabled={loading}
                onClick={() => {
                  setEmployeeCode(preset.code);
                  void executeLogin(
                    preset.code,
                  );
                }}
                className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:border-sky-500/50 hover:bg-slate-900"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${preset.badge}`}
                    >
                      {preset.role}
                    </span>
                    <span className="font-mono text-xs text-slate-400">
                      Code:{" "}
                      <strong className="text-white">
                        {preset.code}
                      </strong>{" "}
                      / PIN: {preset.pin}
                    </span>
                  </div>
                  <p className="mt-3 text-base font-bold text-white group-hover:text-sky-300">
                    {preset.name}
                  </p>
                  <p className="font-mono text-[11px] text-slate-400">
                    {preset.kitchen}
                  </p>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                    {preset.desc}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-2.5 font-mono text-[11px] font-bold text-sky-400">
                  <span>Launch Station</span>
                  <span>→</span>
                </div>
              </button>
            ))}
          </div>

          {/* All Canonical Directory Codes */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Canonical Staff Directory ({EMPLOYEES_DB.length} Active Operators)
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EMPLOYEES_DB.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => {
                    setEmployeeCode(
                      emp.employeeCode,
                    );
                    void executeLogin(
                      emp.employeeCode,
                    );
                  }}
                  className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 font-mono text-[11px] text-slate-300 hover:border-sky-500/40 hover:text-white"
                >
                  <strong className="text-sky-400">
                    {emp.employeeCode}
                  </strong>{" "}
                  • {emp.name} ({emp.role}
                  {emp.kitchenId
                    ? ` @ ${emp.kitchenId}`
                    : ""}
                  )
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      <footer className="mx-auto w-full max-w-6xl border-t border-slate-800/80 pt-4 text-center font-mono text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <span>
          DarKIT OS • Cloud7 Infrastructure • VerticalForge Diagnostics
        </span>
        <span>
          Canonical Pipeline: UI → API Route → Domain Logic → Store → Persistence
        </span>
      </footer>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#060911] flex items-center justify-center font-mono text-sm text-sky-400">
          Initializing DarKIT OS Boot Sequence...
        </div>
      }
    >
      <LoginTerminalContent />
    </Suspense>
  );
}
