"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import {
  EMPLOYEES_DB,
  type Employee,
} from "@/lib/db";

type LoginResponse = {
  employee?: {
    id: string;
    employeeCode: string;
    name: string;
    role: Employee["role"];
    kitchenId?: string;
  };
  redirectTo?: string;
  error?: string;
};

function getDefaultRoute(
  employee: Employee
): string {
  if (employee.role === "OWNER") {
    return "/owner";
  }

  if (
    employee.role === "MANAGER" ||
    employee.role === "LINE_COOK"
  ) {
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
    return Boolean(
      employee.kitchenId
    );
  }

  return true;
}

export default function LoginPage() {
  const router = useRouter();

  const searchParams =
    useSearchParams();

  const [
    employeeCode,
    setEmployeeCode,
  ] = useState("");

  const [error, setError] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const activeEmployees =
    useMemo(
      () =>
        EMPLOYEES_DB.filter(
          (employee) =>
            employee.active
        ),
      []
    );

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const normalizedCode =
      employeeCode.trim();

    if (!normalizedCode) {
      setError(
        "Employee code is required."
      );
      return;
    }

    const employee =
      activeEmployees.find(
        (item) =>
          item.employeeCode.toLowerCase() ===
          normalizedCode.toLowerCase()
      );

    if (!employee) {
      setError(
        "Invalid employee code."
      );
      return;
    }

    const requestedRoute =
      searchParams.get(
        "redirect"
      ) || "";

    const destination =
      requestedRoute &&
      canAccessRoute(
        employee,
        requestedRoute
      )
        ? requestedRoute
        : getDefaultRoute(
            employee
          );

    setSubmitting(true);
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
              employeeCode:
                normalizedCode,
              redirect:
                destination,
            }),
          }
        );

      const data =
        (await response.json()) as LoginResponse;

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Unable to sign in."
        );
      }

      const redirectTo =
        data.redirectTo &&
        canAccessRoute(
          employee,
          data.redirectTo
        )
          ? data.redirectTo
          : destination;

      router.replace(
        redirectTo
      );

      router.refresh();
    } catch (loginError) {
      console.error(
        "Login failed:",
        loginError
      );

      setError(
        loginError instanceof Error
          ? loginError.message
          : "Unable to sign in."
      );

      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Dark Cloud Kitchen OS
          </p>

          <h1 className="mt-2 text-3xl font-black text-slate-900">
            Sign in
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Enter your employee code to access your operational station.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <div>
            <label
              htmlFor="employee-code"
              className="block text-sm font-semibold text-slate-700"
            >
              Employee code
            </label>

            <input
              id="employee-code"
              name="employeeCode"
              type="text"
              value={
                employeeCode
              }
              onChange={(event) =>
                setEmployeeCode(
                  event.target.value
                )
              }
              autoComplete="username"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={
                submitting
              }
              placeholder="Enter employee code"
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-4 text-base text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
            />
          </div>

          <button
            type="submit"
            disabled={
              submitting ||
              !employeeCode.trim()
            }
            className="w-full rounded-xl bg-slate-900 px-4 py-4 text-base font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "Signing in..."
              : "Sign in"}
          </button>
        </form>

        <div className="mt-6 rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Access
          </p>

          <p className="mt-1 text-sm text-slate-600">
            Your assigned role determines the operational station you can access.
          </p>
        </div>
      </section>
    </main>
  );
}
