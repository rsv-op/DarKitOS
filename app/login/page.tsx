"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  EMPLOYEES_DB,
  type Employee,
} from "@/lib/db";

function getDefaultRoute(employee: Employee): string {
  if (employee.role === "OWNER") {
    return "/owner";
  }

  if (employee.role === "MANAGER" || employee.role === "LINE_COOK") {
    return "/cook";
  }

  if (employee.role === "DISPATCH") {
    return "/dispatch";
  }

  return "/login";
}

function canAccessRoute(
  employee: Employee,
  pathname: string
): boolean {
  if (pathname.startsWith("/owner")) {
    return employee.role === "OWNER";
  }

  if (
    pathname.startsWith("/cook") ||
    pathname.startsWith("/dispatch")
  ) {
    return Boolean(employee.kitchenId);
  }

  return true;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [employeeCode, setEmployeeCode] = useState("");
  const [error, setError] = useState("");

  const activeEmployees = useMemo(
    () => EMPLOYEES_DB.filter((employee) => employee.active),
    []
  );

  function login(employee: Employee) {
    const requestedRoute =
      searchParams.get("redirect") || "";

    const destination = canAccessRoute(
      employee,
      requestedRoute
    )
      ? requestedRoute || getDefaultRoute(employee)
      : getDefaultRoute(employee);

    document.cookie =
      `employee_code=${encodeURIComponent(employee.employeeCode)}; ` +
      "Path=/; SameSite=Lax";

    setError("");

    router.push(destination);
    router.refresh();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedCode = employeeCode.trim();

    const employee = activeEmployees.find(
      (item) =>
        item.employeeCode.toLowerCase() ===
        normalizedCode.toLowerCase()
    );

    if (!employee) {
      setError("Invalid employee code.");
      return;
    }

    login(employee);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1fr_1.2fr]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div className="mb-8">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
                Dark Cloud Kitchen OS
              </p>

              <h1 className="mt-3 text-3xl font-bold">
                Sign in
              </h1>

              <p className="mt-2 text-sm text-slate-400">
                Enter your employee code to access the
                operational workspace.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="employeeCode"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Employee code
                </label>

                <input
                  id="employeeCode"
                  type="text"
                  value={employeeCode}
                  onChange={(event) =>
                    setEmployeeCode(event.target.value)
                  }
                  placeholder="e.g. OWNER-01"
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-slate-400"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-slate-950 transition hover:bg-slate-200"
              >
                Sign in
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div className="mb-5">
              <h2 className="text-xl font-semibold">
                Test users
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Select an active employee to test the
                corresponding workspace.
              </p>
            </div>

            <div className="grid gap-3">
              {activeEmployees.map((employee) => (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => login(employee)}
                  className="rounded-xl border border-slate-700 bg-slate-950 p-4 text-left transition hover:border-slate-400 hover:bg-slate-800"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-white">
                        {employee.name}
                      </p>

                      <p className="mt-1 text-sm text-slate-400">
                        {employee.role}
                        {employee.kitchenId
                          ? ` • ${employee.kitchenId}`
                          : " • All kitchens"}
                      </p>
                    </div>

                    <span className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300">
                      {employee.employeeCode}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
