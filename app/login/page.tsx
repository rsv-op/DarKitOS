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
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px
