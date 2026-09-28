"use client";

import {
  FormEvent,
  useState,
} from "react";

import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router =
    useRouter();

  const [employeeCode, setEmployeeCode] =
    useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const code =
      employeeCode.trim();

    if (!code) {
      setError(
        "Employee code is required."
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response =
        await fetch(
          "/api/login",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              employeeCode: code,
            }),
          }
        );

      const data =
        (await response.json()) as {
          success?: boolean;
          error?: string;
          redirectTo?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Login failed."
        );
      }

      router.push(
        data.redirectTo ??
          "/"
      );

      router.refresh();
    } catch (err) {
      console.error(
        "Login failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Login failed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <div className="mb-6">
          <p className="text-sm font-medium uppercase tracking-wider text-slate-500">
            Dark OS
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Employee Login
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Enter your assigned employee
            code to access the kitchen
            operating system.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <div>
            <label
              htmlFor="employeeCode"
              className="mb-2 block text-sm font-semibold text-slate-300"
            >
              Employee code
            </label>

            <input
              id="employeeCode"
              name="employeeCode"
              type="text"
              autoComplete="username"
              autoCapitalize="characters"
              spellCheck={false}
              value={employeeCode}
              onChange={(event) =>
                setEmployeeCode(
                  event.target.value
                )
              }
              placeholder="e.g. 0001"
              disabled={loading}
              className="min-h-14 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-lg font-semibold text-white outline-none placeholder:text-slate-600 focus:border-slate-500 disabled:opacity-50"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-800 bg-red-950/50 p-4 text-sm text-red-200"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              !employeeCode.trim()
            }
            className="min-h-14 w-full rounded-xl bg-white px-5 py-4 text-base font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99]"
          >
            {loading
              ? "SIGNING IN..."
              : "SIGN IN"}
          </button>
        </form>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Access
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            Access is controlled by the
            employee role and permissions
            configured by Dark OS.
          </p>
        </div>
      </section>
    </main>
  );
}
