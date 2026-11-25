"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import AppShell from "@/components/AppShell";
import {
  KITCHENS_DB,
  PERMISSIONS_DB,
  ROLE_PERMISSIONS_DB,
  type Employee,
  type EmployeeRole,
} from "@/lib/db";

const ROLES: EmployeeRole[] = [
  "OWNER",
  "MANAGER",
  "LINE_COOK",
  "DISPATCH",
];

export default function StaffPage() {
  const [employees, setEmployees] = useState<
    Employee[]
  >([]);
  const [roleFilter, setRoleFilter] =
    useState<string>("ALL");
  const [kitchenFilter, setKitchenFilter] =
    useState<string>("ALL");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // New Employee Form
  const [empCode, setEmpCode] = useState("");
  const [empName, setEmpName] = useState("");
  const [empRole, setEmpRole] =
    useState<EmployeeRole>("LINE_COOK");
  const [empKitchen, setEmpKitchen] =
    useState("K1");

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/system", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.employees)) {
        setEmployees(data.employees);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function toggleEmployeeActive(
    emp: Employee,
  ) {
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/system", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "UPSERT_EMPLOYEE",
          employee: {
            ...emp,
            active: !emp.active,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error ||
            "Requires STAFF_MANAGE permission.",
        );
      }
      setEmployees(data.employees);
      setNotice(
        `Operator ${emp.name} (${emp.employeeCode}) status set to ${!emp.active ? "ACTIVE" : "INACTIVE"}.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Update failed.",
      );
    }
  }

  async function handleAddEmployee(
    e: React.FormEvent,
  ) {
    e.preventDefault();
    if (!empCode.trim() || !empName.trim())
      return;
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/system", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "UPSERT_EMPLOYEE",
          employee: {
            employeeCode: empCode
              .trim()
              .toUpperCase(),
            name: empName.trim(),
            role: empRole,
            kitchenId:
              empRole === "OWNER"
                ? undefined
                : empKitchen,
            active: true,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error ||
            "Requires STAFF_MANAGE permission.",
        );
      }
      setEmployees(data.employees);
      setEmpCode("");
      setEmpName("");
      setNotice(
        `Added operator ${empName} (${empCode.toUpperCase()}) with role ${empRole}.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to add employee.",
      );
    }
  }

  const filteredEmployees = employees.filter(
    (e) => {
      if (
        roleFilter !== "ALL" &&
        e.role !== roleFilter
      )
        return false;
      if (
        kitchenFilter !== "ALL" &&
        (e.kitchenId || "GLOBAL") !==
          kitchenFilter
      )
        return false;
      return true;
    },
  );

  return (
    <AppShell
      title="Staff & access"
      subtitle="Manage staff, assign people to kitchens, and see what each role can do."
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 font-mono text-xs text-red-300">
            ⚠ {error}
          </div>
        )}
        {notice && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 font-mono text-xs text-emerald-300">
            ✓ {notice}
          </div>
        )}

        {/* Canonical RBAC Permission Matrix */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="mb-4">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-sky-400">
              Server-Side Security Boundary
            </span>
            <h2 className="mt-1 text-lg font-black text-white">
              Canonical Role-Based Access Control (RBAC) Permission Matrix
            </h2>
            <p className="text-xs text-slate-400">
              Every protected API route independently verifies the session, employee active state, and required permission code before executing domain logic.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950 font-mono text-[10px] uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">
                    Permission Code
                  </th>
                  <th className="px-4 py-3">
                    Architectural Purpose
                  </th>
                  {ROLES.map((role) => (
                    <th
                      key={role}
                      className="px-4 py-3 text-center"
                    >
                      {role}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {PERMISSIONS_DB.map((perm) => (
                  <tr key={perm.id}>
                    <td className="px-4 py-3 font-mono font-bold text-sky-300">
                      {perm.code}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {perm.description}
                    </td>
                    {ROLES.map((role) => {
                      const granted =
                        ROLE_PERMISSIONS_DB.some(
                          (rp) =>
                            rp.role === role &&
                            rp.permissionId ===
                              perm.id,
                        );
                      return (
                        <td
                          key={role}
                          className="px-4 py-3 text-center font-mono"
                        >
                          {granted ? (
                            <span className="inline-block rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                              ✓ GRANTED
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-600">
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Personnel Directory + Add Employee Form */}
        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-black text-white">
                Personnel Directory ({filteredEmployees.length})
              </h2>
              <div className="flex gap-2">
                <select
                  value={roleFilter}
                  onChange={(e) =>
                    setRoleFilter(e.target.value)
                  }
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
                >
                  <option value="ALL">
                    All Roles
                  </option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <select
                  value={kitchenFilter}
                  onChange={(e) =>
                    setKitchenFilter(
                      e.target.value,
                    )
                  }
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
                >
                  <option value="ALL">
                    All Kitchens
                  </option>
                  <option value="GLOBAL">
                    GLOBAL (Owner)
                  </option>
                  {KITCHENS_DB.map((k) => (
                    <option
                      key={k.id}
                      value={k.id}
                    >
                      {k.id} • {k.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2.5">
              {filteredEmployees.map((emp) => (
                <div
                  key={emp.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3.5"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">
                        {emp.name}
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-300">
                        Code: {emp.employeeCode}
                      </span>
                      <span className="rounded bg-purple-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-purple-300">
                        {emp.role}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-slate-400">
                      ID: {emp.id} • Assigned
                      Kitchen:{" "}
                      <strong className="text-slate-200">
                        {emp.kitchenId ||
                          "GLOBAL (All Hubs)"}
                      </strong>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void toggleEmployeeActive(
                        emp,
                      )
                    }
                    className={`rounded-xl border px-3 py-1.5 font-mono text-xs font-bold transition ${
                      emp.active
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                        : "border-red-500/40 bg-red-500/15 text-red-300 hover:bg-red-500/25"
                    }`}
                  >
                    {emp.active
                      ? "● ACTIVE"
                      : "○ INACTIVE"}
                  </button>
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 h-fit">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">
              Register New Kitchen Operator
            </h3>
            <form
              onSubmit={handleAddEmployee}
              className="mt-4 space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-400">
                  Employee Terminal Code
                </label>
                <input
                  type="text"
                  required
                  value={empCode}
                  onChange={(e) =>
                    setEmpCode(e.target.value)
                  }
                  placeholder="e.g. 2005"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-white"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-400">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={empName}
                  onChange={(e) =>
                    setEmpName(e.target.value)
                  }
                  placeholder="e.g. Ishaan Malhotra"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-400">
                  Canonical Role
                </label>
                <select
                  value={empRole}
                  onChange={(e) =>
                    setEmpRole(
                      e.target
                        .value as EmployeeRole,
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-400">
                  Designated Kitchen
                </label>
                <select
                  value={empKitchen}
                  onChange={(e) =>
                    setEmpKitchen(e.target.value)
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"
                >
                  {KITCHENS_DB.map((k) => (
                    <option
                      key={k.id}
                      value={k.id}
                    >
                      {k.id} • {k.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-500 py-3 font-mono text-xs font-black uppercase text-slate-950 hover:bg-emerald-400"
              >
                + Register Operator
              </button>
            </form>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
