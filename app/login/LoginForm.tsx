"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface LoginFormProps {
  redirect?: string;
  demoSandboxEnabled?: boolean;
  supabaseConfigured?: boolean;
  initialErrorCode?: string;
}

const DEMO_ACCOUNTS = [
  {
    code: "OWNER-01",
    label: "Owner — Patric Revuelto",
    role: "OWNER",
    scope: "Global (ORG-001 • K1–K4)",
    accent:
      "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20",
  },
  {
    code: "0001",
    label: "Manager — Priya Sharma",
    role: "MANAGER",
    scope: "K1 Gurugram Central Hub",
    accent:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20",
  },
  {
    code: "2001",
    label: "Line Cook — Rajesh Kumar",
    role: "LINE_COOK",
    scope: "K1 KDS Station",
    accent:
      "border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20",
  },
  {
    code: "3001",
    label: "Dispatch — Arjun Mehta",
    role: "DISPATCH",
    scope: "K1 Courier Staging",
    accent:
      "border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20",
  },
];

const ERROR_MESSAGES: Record<string, string> = {
  not_provisioned:
    "Your account is not provisioned for any kitchen organization. Ask your owner to add your email or phone in Staff & Access.",
  deactivated:
    "Your employee profile is deactivated. Contact your kitchen manager or organization owner.",
  auth_provider_not_configured:
    "Authentication provider is not configured on this deployment.",
  invalid_or_expired_link:
    "Your sign-in link has expired or is invalid. Please request a fresh OTP or magic link.",
  missing_code: "Sign-in callback was missing an authorization code.",
};

type LoginTab = "password" | "otp" | "demo";

export default function LoginForm({
  redirect = "",
  demoSandboxEnabled = false,
  supabaseConfigured = false,
  initialErrorCode = "",
}: LoginFormProps) {
  const router = useRouter();

  const defaultTab: LoginTab = supabaseConfigured
    ? "password"
    : demoSandboxEnabled
      ? "demo"
      : "password";

  const [activeTab, setActiveTab] = useState<LoginTab>(defaultTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpChannel, setOtpChannel] = useState<"email" | "phone">("email");
  const [phone, setPhone] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);

  const [employeeCode, setEmployeeCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(
    initialErrorCode ? ERROR_MESSAGES[initialErrorCode] || initialErrorCode : "",
  );

  async function completeLogin(payload: Record<string, unknown>) {
    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          ...(redirect ? { redirect } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Sign-in failed.");
      }

      if (data.otpSent) {
        setOtpRequested(true);
        setNotice(data.message || "Verification code sent.");
        return;
      }

      const destination =
        typeof data.redirectTo === "string" && data.redirectTo.startsWith("/")
          ? data.redirectTo
          : "/dashboard";

      router.push(destination);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to complete login.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    void completeLogin({
      mode: "password",
      email: email.trim(),
      password,
    });
  }

  function handleOtpRequest(e: React.FormEvent) {
    e.preventDefault();
    void completeLogin({
      mode: "otp_request",
      ...(otpChannel === "email"
        ? { email: email.trim() }
        : { phone: phone.trim() }),
    });
  }

  function handleOtpVerify(e: React.FormEvent) {
    e.preventDefault();
    void completeLogin({
      mode: "otp_verify",
      ...(otpChannel === "email"
        ? { email: email.trim() }
        : { phone: phone.trim() }),
      token: otpToken.trim(),
    });
  }

  function handleDemoSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!demoSandboxEnabled || !employeeCode.trim()) return;
    void completeLogin({ employeeCode: employeeCode.trim() });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#090d14] px-4 py-12 text-slate-100">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#111622] p-7 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-lg font-black text-slate-950">
              DK
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                DarKitOS Station Sign-In
              </h1>
              <p className="text-xs text-slate-400">
                Multi-Tenant Cloud Kitchen RBAC &amp; Realtime KDS
              </p>
            </div>
          </div>

          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
              supabaseConfigured
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : demoSandboxEnabled
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : "border-red-500/40 bg-red-500/10 text-red-300"
            }`}
          >
            {supabaseConfigured
              ? "Supabase Auth"
              : demoSandboxEnabled
                ? "Demo Sandbox"
                : "Provider Unset"}
          </span>
        </div>

        {/* Strict Production Missing Provider Banner */}
        {!supabaseConfigured && !demoSandboxEnabled ? (
          <div className="mb-5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            Authentication provider is not configured on this production
            deployment. Configure{" "}
            <code className="font-mono text-amber-100">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{" "}
            and{" "}
            <code className="font-mono text-amber-100">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>{" "}
            to enable Email/Password and OTP login.
          </div>
        ) : null}

        {/* Auth Method Tabs */}
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-[#0b0f17] p-1 sm:flex">
          <button
            type="button"
            onClick={() => {
              setActiveTab("password");
              setError("");
              setNotice("");
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              activeTab === "password"
                ? "bg-amber-500 text-slate-950"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Email &amp; Password
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("otp");
              setError("");
              setNotice("");
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              activeTab === "otp"
                ? "bg-amber-500 text-slate-950"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Email / Phone OTP
          </button>
          {demoSandboxEnabled ? (
            <button
              type="button"
              onClick={() => {
                setActiveTab("demo");
                setError("");
                setNotice("");
              }}
              className={`col-span-2 flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition sm:col-span-1 ${
                activeTab === "demo"
                  ? "bg-emerald-500 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Demo Sandbox
            </button>
          ) : null}
        </div>

        {/* Alerts */}
        {error ? (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {notice}
          </div>
        ) : null}

        {/* Tab 1: Email + Password */}
        {activeTab === "password" ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Work Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="priya.k1@darkit.in"
                className="w-full rounded-xl border border-slate-700 bg-[#0b0f17] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-slate-700 bg-[#0b0f17] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
            >
              {submitting ? "Signing in..." : "Sign In to Kitchen OS"}
            </button>
          </form>
        ) : null}

        {/* Tab 2: Email / Phone OTP */}
        {activeTab === "otp" ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setOtpChannel("email");
                  setOtpRequested(false);
                }}
                className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  otpChannel === "email"
                    ? "border-amber-500/50 bg-amber-500/15 text-amber-200"
                    : "border-slate-700 bg-[#0b0f17] text-slate-400"
                }`}
              >
                Email OTP / Magic Link
              </button>
              <button
                type="button"
                onClick={() => {
                  setOtpChannel("phone");
                  setOtpRequested(false);
                }}
                className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  otpChannel === "phone"
                    ? "border-amber-500/50 bg-amber-500/15 text-amber-200"
                    : "border-slate-700 bg-[#0b0f17] text-slate-400"
                }`}
              >
                Phone SMS OTP
              </button>
            </div>

            <form
              onSubmit={otpRequested ? handleOtpVerify : handleOtpRequest}
              className="space-y-4"
            >
              {otpChannel === "email" ? (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Provisioned Staff Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="rajesh.k1@darkit.in"
                    className="w-full rounded-xl border border-slate-700 bg-[#0b0f17] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Provisioned Phone (E.164)
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+919810000012"
                    className="w-full rounded-xl border border-slate-700 bg-[#0b0f17] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500"
                  />
                </div>
              )}

              {otpRequested ? (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    6-Digit OTP Verification Code
                  </label>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    value={otpToken}
                    onChange={(e) => setOtpToken(e.target.value)}
                    placeholder="123456"
                    className="w-full rounded-xl border border-slate-700 bg-[#0b0f17] px-3.5 py-2.5 font-mono text-sm tracking-widest text-white placeholder-slate-500 outline-none focus:border-amber-500"
                  />
                </div>
              ) : null}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
                >
                  {submitting
                    ? "Processing..."
                    : otpRequested
                      ? "Verify Code & Sign In"
                      : "Send One-Time Code"}
                </button>
                {otpRequested ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setOtpRequested(false)}
                    className="rounded-xl border border-slate-700 px-3.5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    Resend
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        ) : null}

        {/* Tab 3: Demo Sandbox Quick-Login (NEVER rendered in production unless DEMO_SANDBOX_MODE=true) */}
        {activeTab === "demo" && demoSandboxEnabled ? (
          <div className="space-y-4">
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-200">
              Demo Sandbox Mode active. Pick a pre-seeded kitchen role or enter
              an employee terminal code to launch a signed HS256 demo session.
            </p>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((acct) => (
                <button
                  key={acct.code}
                  type="button"
                  disabled={submitting}
                  onClick={() => void completeLogin({ employeeCode: acct.code })}
                  className={`rounded-xl border p-3 text-left transition ${acct.accent} disabled:opacity-50`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {acct.role}
                    </span>
                    <span className="font-mono text-[10px] opacity-80">
                      {acct.code}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {acct.label}
                  </div>
                  <div className="mt-0.5 text-[11px] opacity-80">
                    {acct.scope}
                  </div>
                </button>
              ))}
            </div>

            <form
              onSubmit={handleDemoSubmit}
              className="flex gap-2 border-t border-slate-800 pt-4"
            >
              <input
                type="text"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                placeholder="Employee code (e.g. 0002, 2002)"
                className="flex-1 rounded-xl border border-slate-700 bg-[#0b0f17] px-3.5 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={submitting || !employeeCode.trim()}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                Launch
              </button>
            </form>
          </div>
        ) : null}

        <div className="mt-6 border-t border-slate-800 pt-4 text-center text-[11px] text-slate-500">
          Protected by Two-Level Organization &amp; Kitchen RBAC • Immediate
          Account Revocation
        </div>
      </div>
    </div>
  );
}
