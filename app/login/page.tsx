"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [employeeCode, setEmployeeCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  async function handleLogin(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");

    const code = employeeCode.trim();

    if (!code) {
      setError("Employee code is required");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeCode: code,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data?.error || "Invalid employee code",
        );
        return;
      }

      router.push(
        typeof data?.redirectTo === "string"
          ? data.redirectTo
          : "/login",
      );

      router.refresh();
    } catch (error) {
      console.error("Login failed:", error);
      setError("Unable to reach the login service");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <h1 className="font-mono text-3xl font-bold text-sky-400">
              DarKitOS
            </h1>

            <p className="mt-2 font-mono text-xs text-gray-400">
              Unified Cloud Kitchen Operating System
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            className="space-y-5"
          >
            <div>
              <label
                htmlFor="employeeCode"
                className="mb-2 block font-mono text-xs uppercase tracking-wider text-gray-400"
              >
                Employee Code
              </label>

              <input
                id="employeeCode"
                name="employeeCode"
                type="text"
                value={employeeCode}
                onChange={(event) =>
                  setEmployeeCode(event.target.value)
                }
                placeholder="Enter employee code"
                autoComplete="username"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                disabled={loading}
                className="w-full rounded-xl border border-gray-700 bg-gray-950 p-4 text-center font-mono text-lg tracking-widest text-white outline-none transition focus:border-sky-400 focus:ring-1 focus:ring-sky-400 disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                <p className="text-center font-mono text-xs text-red-400">
                  {error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-sky-500 p-4 font-mono text-sm font-bold uppercase tracking-wider text-gray-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
            >
              {loading
                ? "Authenticating..."
                : "Access Station →"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center font-mono text-[10px] text-gray-600">
          DarKitOS • Kitchen Operations Gateway
        </p>
      </div>
    </main>
  );
}
