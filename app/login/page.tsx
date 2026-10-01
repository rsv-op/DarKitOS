
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [employeeCode, setEmployeeCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
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

      const destination =
        typeof data?.redirectTo === "string"
          ? data.redirectTo
          : "/login";

      router.push(destination);
      router.refresh();
    } catch (error) {
      console.error("Login failed:", error);
      setError("Unable to reach the login service");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/30 mb-4">
                <span className="text-2xl font-bold text-sky-400">
                  DK
                </span>
              </div>

              <h1 className="text-3xl font-bold font-mono text-sky-400">
                DarKitOS
              </h1>

              <p className="mt-2 text-xs text-gray-400 font-mono">
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
                  className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-2"
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
                  className="w-full p-4 rounded-xl bg-gray-950 border border-gray-700 text-white font-mono text-lg text-center tracking-widest outline-none transition focus:border-sky-400 focus:ring-1 focus:ring-sky-400 disabled:opacity-50"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                  <p className="text-red-400 text-xs font-mono text-center">
                    {error}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-gray-700 disabled:text-gray-400 text-gray-950 font-mono font-bold p-4 rounded-xl text-sm uppercase tracking-wider transition"
              >
                {loading
                  ? "Authenticating..."
                  : "Access Station →"}
              </button>
            </form>
          </div>

          <div className="border-t border-gray-800 bg-gray-950/60 p-5">
            <p className="text-[10px] text-gray-500 font-mono text-center uppercase tracking-wider mb-3">
              Development Employee Codes
            </p>

            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="rounded-lg bg-gray-900 border border-gray-800 p-2 text-center">
                <span className="text-gray-500">
                  OWNER
                </span>
                <br />
                <span className="text-sky-400">
                  OWNER-01
                </span>
              </div>

              <div className="rounded-lg bg-gray-900 border border-gray-800 p-2 text-center">
                <span className="text-gray-500">
                  K1 MANAGER
                </span>
                <br />
                <span className="text-sky-400">
                  0001
                </span>
              </div>

              <div className="rounded-lg bg-gray-900 border border-gray-800 p-2 text-center">
                <span className="text-gray-500">
                  K1 COOK
                </span>
                <br />
                <span className="text-sky-400">
                  2001
                </span>
              </div>

              <div className="rounded-lg bg-gray-900 border border-gray-800 p-2 text-center">
                <span className="text-gray-500">
                  K2 MANAGER
                </span>
                <br />
                <span className="text-sky-400">
                  0002
                </span>
              </div>

              <div className="rounded-lg bg-gray-900 border border-gray-800 p-2 text-center">
                <span className="text-gray-500">
                  K2 COOK
                </span>
                <br />
                <span className="text-sky-400">
                  2002
                </span>
              </div>

              <div className="rounded-lg bg-gray-900 border border-gray-800 p-2 text-center">
                <span className="text-gray-500">
                  K3 MANAGER
                </span>
                <br />
                <span className="text-sky-400">
                  0003
                </span>
              </div>

              <div className="rounded-lg bg-gray-900 border border-gray-800 p-2 text-center">
                <span className="text-gray-500">
                  K3 COOK
                </span>
                <br />
                <span className="text-sky-400">
                  2003
                </span>
              </div>

              <div className="rounded-lg bg-gray-900 border border-gray-800 p-2 text-center">
                <span className="text-gray-500">
                  K4 MANAGER
                </span>
                <br />
                <span className="text-sky-400">
                  0004
                </span>
              </div>

              <div className="col-span-2 rounded-lg bg-gray-900 border border-gray-800 p-2 text-center">
                <span className="text-gray-500">
                  K4 COOK
                </span>
                <br />
                <span className="text-sky-400">
                  2004
                </span>
              </div>
            </div>

            <p className="mt-4 text-[9px] text-gray-600 font-mono text-center">
              Development credentials only
            </p>
          </div>
        </div>

        <p className="text-center text-[10px] text-gray-600 font-mono mt-4">
          DarKitOS • Kitchen Operations Gateway
        </p>
      </div>
    </main>
  );
}
