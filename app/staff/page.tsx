"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import type { Employee, EmployeeRole, KitchenConfig } from "@/lib/db";

interface StaffApiResponse {
  employees?: Employee[];
  kitchens?: KitchenConfig[];
  organizationId?: string;
  error?: string;
}

const ROLE_OPTIONS: EmployeeRole[] = [
  "OWNER",
  "MANAGER",
  "LINE_COOK",
  "DISPATCH",
];

const ROLE_BADGE: Record<EmployeeRole, string> = {
  OWNER: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  MANAGER: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  LINE_COOK: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  DISPATCH: "border-purple-500/40 bg-purple-500/15 text-purple-300",
};

export default function StaffPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [kitchens, setKitchens] = useState<KitchenConfig[]>([]);
  const [organizationId, setOrganizationId] = useState<string>("ORG-001");
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Provisioning form state
  const [name, setName] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<EmployeeRole>("LINE_COOK");
  const [kitchenId, setKitchenId] = useState<string>("K1");
  const [sendInvite, setSendInvite] = useState<boolean>(true);

  const isGlobalOwner =
    currentUser?.role === "OWNER" || !currentUser?.kitchenId;

  const loadStaff = useCallback(async () => {
    try {
      const [sessionRes, staffRes] = await Promise.all([
        fetch("/api/session", { cache: "no-store" }),
        fetch("/api/staff", { cache: "no-store" }),
      ]);

      if (sessionRes.ok) {
        const sData = await sessionRes.json();
        if (sData.employee) {
          setCurrentUser(sData.employee as Employee);
        }
      }

      const data = (await staffRes.json()) as StaffApiResponse;
      if (!staffRes.ok) {
        throw new Error(
          data.error || "Requires STAFF_MANAGE permission to view staff.",
        );
      }

      setEmployees(Array.isArray(data.employees) ? data.employees : []);
      if (Array.isArray(data.kitchens) && data.kitchens.length > 0) {
        setKitchens(data.kitchens);
        setKitchenId((prev) =>
          data.kitchens?.some((k) => k.id === prev)
            ? prev
            : data.kitchens![0].id,
        );
      }
      if (data.organizationId) {
        setOrganizationId(data.organizationId);
      }
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load staff directory.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  async function handleProvision(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          employeeCode: employeeCode.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          role,
          kitchenId: role === "OWNER" ? undefined : kitchenId,
          sendInvite,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to provision staff member.");
      }

      if (Array.isArray(data.employees)) {
        setEmployees(data.employees);
      }
      setName("");
      setEmployeeCode("");
      setEmail("");
      setPhone("");
      setNotice(
        data.inviteSent
          ? `Provisioned ${data.employee?.name} and sent Supabase email invite.`
          : `Provisioned ${data.employee?.name} (${data.employee?.employeeCode}). They can now sign in via Email/Password or OTP.`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to provision staff.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePatchEmployee(
    emp: Employee,
    updates: Partial<Pick<Employee, "active" | "role" | "kitchenId">>,
  ) {
    setUpdatingId(emp.id);
    setError("");
    setNotice("");

    try {
      const res = await fetch("/api/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: emp.id,
          employeeCode: emp.employeeCode,
          ...updates,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to update staff record.");
      }

      if (Array.isArray(data.employees)) {
        setEmployees(data.employees);
      }
      setNotice(
        updates.active === false
          ? `${emp.name} deactivated — active sessions are immediately revoked (403 Forbidden).`
          : `Updated ${emp.name} (${emp.employeeCode}).`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update employee.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  const activeCount = employees.filter((e) => e.active).length;
  const linkedCount = employees.filter((e) => Boolean(e.authUserId)).length;

  return (
    <AppShell
      title="Staff & Multi-Tenant RBAC Access"
      subtitle={`Organization ${organizationId} • Provision kitchen operators, assign physical hubs, and revoke access instantly.`}
      actions={
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            {activeCount} Active Staff
          </span>
          <span className="rounded-full border border-sky-500/35 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
            {linkedCount} Auth Linked
          </span>
        </div>
      }
    >
      <div className="space-y-6">
        {error ? (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {notice}
          </div>
        ) : null}

        {/* Provision / Invite New Staff Card */}
        <section className="rounded-2xl border border-slate-800 bg-[#111622] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-white">
                Provision Kitchen Staff Member
              </h2>
              <p className="text-xs text-slate-400">
                Add an employee by work email or phone number. Their Supabase
                Auth identity auto-links on first verified Email/Password or OTP
                sign-in.
              </p>
            </div>
            <span className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 font-mono text-xs text-slate-300">
              Tenant: {organizationId}
            </span>
          </div>

          <form
            onSubmit={handleProvision}
            className="grid grid-cols-1 gap-3 md:grid-cols-6"
          >
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name (e.g. Rohan Verma)"
              className="rounded-xl border border-slate-700 bg-[#0b0f17] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500 md:col-span-2"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (rohan.k1@darkit.in)"
              className="rounded-xl border border-slate-700 bg-[#0b0f17] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500 md:col-span-2"
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (+9198...)"
              className="rounded-xl border border-slate-700 bg-[#0b0f17] px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500"
            />
            <input
              type="text"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              placeholder="Code (auto)"
              className="rounded-xl border border-slate-700 bg-[#0b0f17] px-3 py-2 font-mono text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500"
            />

            <select
              value={role}
              onChange={(e) => setRole(e.target.value as EmployeeRole)}
              className="rounded-xl border border-slate-700 bg-[#0b0f17] px-3 py-2 text-sm text-white outline-none focus:border-amber-500 md:col-span-2"
            >
              {ROLE_OPTIONS.filter((r) => isGlobalOwner || r !== "OWNER").map(
                (r) => (
                  <option key={r} value={r}>
                    Role: {r.replaceAll("_", " ")}
                  </option>
                ),
              )}
            </select>

            <select
              value={role === "OWNER" ? "" : kitchenId}
              disabled={role === "OWNER" || !isGlobalOwner}
              onChange={(e) => setKitchenId(e.target.value)}
              className="rounded-xl border border-slate-700 bg-[#0b0f17] px-3 py-2 text-sm text-white outline-none focus:border-amber-500 disabled:opacity-60 md:col-span-2"
            >
              {role === "OWNER" ? (
                <option value="">All Kitchens (Org-Wide Scope)</option>
              ) : (
                kitchens.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.id} — {k.name}
                  </option>
                ))
              )}
            </select>

            <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#0b0f17] px-3 py-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={sendInvite}
                onChange={(e) => setSendInvite(e.target.checked)}
                className="accent-amber-500"
              />
              Send Auth Invite
            </label>

            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "+ Provision Staff"}
            </button>
          </form>
        </section>

        {/* Staff Directory Table */}
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#111622]">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <h2 className="text-base font-bold text-white">
              Organization Staff Directory ({employees.length})
            </h2>
            <button
              type="button"
              onClick={() => void loadStaff()}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400">
              Loading staff directory...
            </div>
          ) : employees.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No staff records visible for your scope.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-800 bg-[#0b0f17] text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Operator</th>
                    <th className="px-4 py-3">Contact / Auth Identity</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Kitchen Scope</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Access Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {employees.map((emp) => {
                    const isSelf = currentUser?.id === emp.id;
                    const busy = updatingId === emp.id;

                    return (
                      <tr
                        key={emp.id}
                        className={`transition hover:bg-slate-800/30 ${
                          !emp.active ? "opacity-60" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">
                            {emp.name}
                            {isSelf ? (
                              <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                                YOU
                              </span>
                            ) : null}
                          </div>
                          <div className="font-mono text-xs text-slate-400">
                            {emp.employeeCode} • {emp.id}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-xs">
                          <div className="text-slate-200">
                            {emp.email || "No email"}
                          </div>
                          <div className="text-slate-400">
                            {emp.phone || "No phone"}
                          </div>
                          <span
                            className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              emp.authUserId
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {emp.authUserId
                              ? "Supabase Auth Linked"
                              : "Auto-Links on First Login"}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <select
                            disabled={busy || isSelf || (!isGlobalOwner && emp.role === "OWNER")}
                            value={emp.role}
                            onChange={(e) =>
                              void handlePatchEmployee(emp, {
                                role: e.target.value as EmployeeRole,
                              })
                            }
                            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold outline-none ${ROLE_BADGE[emp.role]} bg-slate-950 disabled:opacity-60`}
                          >
                            {ROLE_OPTIONS.filter(
                              (r) => isGlobalOwner || r !== "OWNER",
                            ).map((r) => (
                              <option
                                key={r}
                                value={r}
                                className="bg-slate-900 text-white"
                              >
                                {r.replaceAll("_", " ")}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="px-4 py-3">
                          {emp.role === "OWNER" ? (
                            <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
                              All Org Kitchens
                            </span>
                          ) : (
                            <select
                              disabled={busy || !isGlobalOwner}
                              value={emp.kitchenId || ""}
                              onChange={(e) =>
                                void handlePatchEmployee(emp, {
                                  kitchenId: e.target.value,
                                })
                              }
                              className="rounded-lg border border-slate-700 bg-[#0b0f17] px-2.5 py-1 text-xs text-slate-200 outline-none disabled:opacity-60"
                            >
                              {kitchens.map((k) => (
                                <option key={k.id} value={k.id}>
                                  {k.id} ({k.code})
                                </option>
                              ))}
                            </select>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                              emp.active
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                : "border-red-500/40 bg-red-500/10 text-red-300"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                emp.active ? "bg-emerald-400" : "bg-red-400"
                              }`}
                            />
                            {emp.active ? "Active" : "Deactivated"}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            disabled={busy || isSelf}
                            onClick={() =>
                              void handlePatchEmployee(emp, {
                                active: !emp.active,
                              })
                            }
                            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
                              emp.active
                                ? "border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                            }`}
                          >
                            {busy
                              ? "Updating..."
                              : emp.active
                                ? "Deactivate Now"
                                : "Reactivate"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
