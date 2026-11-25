"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import GuideIcon from "@/components/GuideIcon";
import type { Employee } from "@/lib/db";
import { DEMO_ROLES } from "@/lib/getting-started";

type SignInSource = "staff" | "demo";

const buttonFocus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300";

function isInternalPath(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return false;
  }
  try {
    return (
      new URL(value, window.location.origin).origin === window.location.origin
    );
  } catch {
    return false;
  }
}

export default function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"code" | "pin">("code");
  const [employeeCode, setEmployeeCode] = useState("");
  const [pin, setPin] = useState("");
  const [pending, setPending] = useState<SignInSource | null>(null);
  const [failure, setFailure] = useState<{
    source: SignInSource;
    message: string;
  } | null>(null);
  const [demoSandboxEnabled, setDemoSandboxEnabled] = useState<boolean>(true);
  const [demoEmployees, setDemoEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/session", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setDemoSandboxEnabled(Boolean(data.demoSandboxEnabled));
        if (Array.isArray(data.employees)) {
          setDemoEmployees(data.employees);
        }
      })
      .catch(() => {
        // Ignore transient errors on initial load
      });
    return () => {
      active = false;
    };
  }, []);

  const otherDemoAccounts = demoEmployees.filter(
    (employee) =>
      employee.active &&
      !DEMO_ROLES.some(({ code }) => code === employee.employeeCode),
  );

  async function signIn(value: string, source: SignInSource) {
    const code = value.trim();
    if (pending) return;
    if (!code) {
      setFailure({
        source,
        message: "Enter your employee code or shift PIN.",
      });
      return;
    }

    setPending(source);
    setFailure(null);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeCode: code,
          redirect:
            source === "staff" && isInternalPath(redirectTo)
              ? redirectTo
              : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setFailure({
          source,
          message:
            response.status === 401 && source === "staff"
              ? "That code or PIN wasn’t recognized. Please check it and try again."
              : data.error || "Couldn’t sign in. Please try again.",
        });
        if (source === "staff") setPin("");
        return;
      }
      router.replace(
        isInternalPath(data.redirectTo) ? data.redirectTo : "/dashboard",
      );
      router.refresh();
    } catch {
      setFailure({
        source,
        message: "Couldn’t connect to DarKitOS. Please try again.",
      });
    } finally {
      setPending(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void signIn(mode === "code" ? employeeCode : pin, "staff");
  }

  function pressKey(key: string) {
    setFailure(null);
    if (key === "Clear") {
      setPin("");
    } else if (key === "Delete") {
      setPin((current) => current.slice(0, -1));
    } else if (pin.length < 4) {
      const next = pin + key;
      setPin(next);
      if (next.length === 4) void signIn(next, "staff");
    }
  }

  const isPin = mode === "pin";

  return (
    <div
      className={`mt-7 grid items-start gap-5 ${
        demoSandboxEnabled
          ? "lg:grid-cols-[0.85fr_1.15fr]"
          : "max-w-lg mx-auto"
      }`}
    >
      <section
        aria-labelledby="staff-sign-in"
        className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 sm:p-6"
      >
        <h2 id="staff-sign-in" className="text-xl font-bold text-white">
          Employee sign-in
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-300">
          Use the code or PIN provided for your station.
        </p>
        <div
          role="group"
          aria-label="Sign-in method"
          className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-slate-950 p-1"
        >
          {(["code", "pin"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              disabled={pending !== null}
              onClick={() => {
                setMode(option);
                setPin("");
                setFailure(null);
              }}
              className={`min-h-10 rounded-lg px-2 text-sm font-semibold ${buttonFocus} ${
                mode === option
                  ? "bg-slate-700 text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              {option === "code" ? "Employee code" : "Shift PIN"}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
          <div>
            <label
              htmlFor="sign-in-value"
              className="block text-sm font-medium text-slate-200"
            >
              {isPin ? "4-digit shift PIN" : "Employee code"}
            </label>
            <input
              key={mode}
              id="sign-in-value"
              name={isPin ? "pin" : "employeeCode"}
              type={isPin ? "password" : "text"}
              inputMode={isPin ? "numeric" : "text"}
              autoComplete={isPin ? "current-password" : "username"}
              autoCapitalize={isPin ? "off" : "characters"}
              spellCheck={false}
              pattern={isPin ? "[0-9]{4}" : undefined}
              maxLength={isPin ? 4 : undefined}
              value={isPin ? pin : employeeCode}
              onChange={(event) =>
                isPin
                  ? setPin(event.target.value.replace(/\D/g, ""))
                  : setEmployeeCode(event.target.value)
              }
              required
              disabled={pending !== null}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3 text-base text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/20"
            />
          </div>
          {isPin && (
            <div
              role="group"
              aria-label="Shift PIN keypad"
              className="grid grid-cols-3 gap-2"
            >
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
                "Clear",
                "0",
                "Delete",
              ].map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={pending !== null}
                  onClick={() => pressKey(key)}
                  className={`min-h-10 rounded-lg border border-slate-700 bg-slate-950 text-sm font-semibold text-slate-200 hover:bg-slate-800 ${buttonFocus}`}
                >
                  {key}
                </button>
              ))}
            </div>
          )}
          {failure?.source === "staff" && (
            <p
              role="alert"
              className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200"
            >
              {failure.message}
            </p>
          )}
          <button
            type="submit"
            disabled={pending !== null}
            className={`min-h-11 w-full rounded-xl bg-cyan-200 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-60 ${buttonFocus}`}
          >
            {pending === "staff" ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>

      {demoSandboxEnabled && (
        <section
          id="demo-roles"
          aria-labelledby="demo-roles-title"
          className="scroll-mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-5 sm:p-6"
        >
          <h2 id="demo-roles-title" className="text-xl font-bold text-white">
            Choose a demo role
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-300">
            Demo Sandbox Mode is active. Pick the station role you want to try.
          </p>
          {failure?.source === "demo" && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200"
            >
              {failure.message}
            </p>
          )}
          {pending === "demo" && (
            <p role="status" className="mt-2 text-sm text-cyan-200">
              Opening your demo workspace…
            </p>
          )}
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {DEMO_ROLES.map((role) => (
              <li key={role.code}>
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => void signIn(role.code, "demo")}
                  className={`flex h-full w-full flex-col items-start rounded-xl border border-slate-700 bg-slate-950/70 p-3.5 text-left transition hover:border-cyan-300/50 hover:bg-slate-900 disabled:cursor-wait ${buttonFocus}`}
                >
                  <span className="flex w-full items-center gap-2 font-semibold text-white">
                    <GuideIcon
                      name={role.icon}
                      className="h-4 w-4 text-cyan-200"
                    />
                    {role.label}
                    <GuideIcon
                      name="arrow"
                      className="ml-auto h-4 w-4 text-cyan-200"
                    />
                  </span>
                  <span className="mb-2 mt-1.5 text-sm leading-5 text-slate-300">
                    {role.description}
                  </span>
                  <span className="mt-auto text-xs font-medium text-cyan-200">
                    Starts in {role.startsAt}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {otherDemoAccounts.length > 0 && (
            <details className="mt-4 rounded-xl border border-slate-800/90 bg-slate-950/50 p-3">
              <summary
                className={`cursor-pointer rounded text-sm font-medium text-slate-200 ${buttonFocus}`}
              >
                More sample accounts
              </summary>
              <div className="mt-3 flex flex-wrap gap-2">
                {otherDemoAccounts.map((employee) => (
                  <button
                    key={employee.id}
                    type="button"
                    disabled={pending !== null}
                    onClick={() => void signIn(employee.employeeCode, "demo")}
                    className={`rounded-lg border border-slate-700 px-2.5 py-2 text-xs text-slate-200 hover:border-cyan-300/45 ${buttonFocus}`}
                  >
                    {employee.name} ·{" "}
                    {DEMO_ROLES.find(({ role }) => role === employee.role)
                      ?.label ?? employee.role}
                    {employee.kitchenId ? ` · ${employee.kitchenId}` : ""}
                  </button>
                ))}
              </div>
            </details>
          )}
          <p className="mt-4 text-xs leading-5 text-slate-400">
            This demo is shared and may reset. Use sample information only.
          </p>
        </section>
      )}
    </div>
  );
}
