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
    label: "Patric Revuelto",
    role: "OWNER",
    scope: "Global · ORG-001 (K1–K4)",
  },
  {
    code: "0001",
    label: "Priya Sharma",
    role: "MANAGER",
    scope: "K1 Gurugram Hub",
  },
  {
    code: "2001",
    label: "Rajesh Kumar",
    role: "LINE_COOK",
    scope: "K1 Cook KDS",
  },
  {
    code: "3001",
    label: "Arjun Mehta",
    role: "DISPATCH",
    scope: "K1 Courier Pass",
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
    initialErrorCode
      ? ERROR_MESSAGES[initialErrorCode] || initialErrorCode
      : "",
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
          : "/owner";

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
    <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 py-12 text-zinc-100">
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-white/[0.08] bg-[#0e0e11]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.1] bg-[#151519] text-xs font-bold tracking-tighter text-zinc-100">
              DK
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
                DarKitOS
              </h1>
              <p className="text-[11px] text-zinc-500">Station Sign-In</p>
            </div>
          </div>

          <span
            className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-medium ${
              supabaseConfigured
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : demoSandboxEnabled
                  ? "border-amber-500/35 bg-amber-500/10 text-amber-300"
                  : "border-rose-500/35 bg-rose-500/10 text-rose-300"
            }`}
          >
            {supabaseConfigured
              ? "Supabase Auth"
              : demoSandboxEnabled
                ? "Demo Sandbox"
                : "Provider Unset"}
          </span>
        </div>

        <div className="p-5">
          {/* Missing Provider Banner */}
          {!supabaseConfigured && !demoSandboxEnabled ? (
            <div className="mb-4 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
              Configure{" "}
              <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
              (or set <code className="font-mono">DEMO_SANDBOX_MODE=true</code>{" "}
              for preview).
            </div>
          ) : null}

          {/* Segmented Tabs */}
          <div className="mb-5 flex rounded-md border border-white/[0.06] bg-[#151519] p-0.5">
            <button
              type="button"
              onClick={() => {
                setActiveTab("password");
                setError("");
                setNotice("");
              }}
              className={`flex-1 rounded-[5px] px-2.5 py-1.5 text-xs font-medium transition-colors ${
                activeTab === "password"
                  ? "bg-[#27272e] text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Staff Sign-In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("otp");
                setError("");
                setNotice("");
              }}
              className={`flex-1 rounded-[5px] px-2.5 py-1.5 text-xs font-medium transition-colors ${
                activeTab === "otp"
                  ? "bg-[#27272e] text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              OTP
            </button>
            {demoSandboxEnabled ? (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("demo");
                  setError("");
                  setNotice("");
                }}
                className={`flex-1 rounded-[5px] px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === "demo"
                    ? "bg-[#27272e] text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Demo Sandbox
              </button>
            ) : null}
          </div>

          {error ? (
            <div className="mb-4 rounded-md border border-rose-500/35 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200">
              {error}
            </div>
          ) : null}

          {notice ? (
            <div className="mb-4 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-200">
              {notice}
            </div>
          ) : null}

          {/* Tab 1: Staff Sign-In */}
          {activeTab === "password" ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-400">
                  Work Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="priya.k1@darkit.in"
                  className="h-9 w-full rounded-md border border-white/[0.08] bg-[#151519] px-3 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-white/[0.22]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-400">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="h-9 w-full rounded-md border border-white/[0.08] bg-[#151519] px-3 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-white/[0.22]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="h-9 w-full rounded-md bg-zinc-100 text-xs font-semibold text-zinc-950 transition-colors hover:bg-white disabled:opacity-50"
              >
                {submitting ? "Signing in..." : "Sign In"}
              </button>
            </form>
          ) : null}

          {/* Tab 2: OTP */}
          {activeTab === "otp" ? (
            <div className="space-y-3.5">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setOtpChannel("email");
                    setOtpRequested(false);
                  }}
                  className={`flex-1 rounded-md border py-1.5 text-[11px] font-medium ${
                    otpChannel === "email"
                      ? "border-white/[0.2] bg-[#1d1d22] text-zinc-100"
                      : "border-white/[0.06] bg-[#151519] text-zinc-400"
                  }`}
                >
                  Email OTP
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOtpChannel("phone");
                    setOtpRequested(false);
                  }}
                  className={`flex-1 rounded-md border py-1.5 text-[11px] font-medium ${
                    otpChannel === "phone"
                      ? "border-white/[0.2] bg-[#1d1d22] text-zinc-100"
                      : "border-white/[0.06] bg-[#151519] text-zinc-400"
                  }`}
                >
                  SMS OTP
                </button>
              </div>

              <form
                onSubmit={otpRequested ? handleOtpVerify : handleOtpRequest}
                className="space-y-3.5"
              >
                {otpChannel === "email" ? (
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-zinc-400">
                      Staff Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="rajesh.k1@darkit.in"
                      className="h-9 w-full rounded-md border border-white/[0.08] bg-[#151519] px-3 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-white/[0.22]"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-zinc-400">
                      Phone (E.164)
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+919810000012"
                      className="h-9 w-full rounded-md border border-white/[0.08] bg-[#151519] px-3 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-white/[0.22]"
                    />
                  </div>
                )}

                {otpRequested ? (
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-zinc-400">
                      6-Digit Verification Code
                    </label>
                    <input
                      type="text"
                      required
                      inputMode="numeric"
                      value={otpToken}
                      onChange={(e) => setOtpToken(e.target.value)}
                      placeholder="123456"
                      className="h-9 w-full rounded-md border border-white/[0.08] bg-[#151519] px-3 font-mono text-xs tracking-widest text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-white/[0.22]"
                    />
                  </div>
                ) : null}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="h-9 flex-1 rounded-md bg-zinc-100 text-xs font-semibold text-zinc-950 transition-colors hover:bg-white disabled:opacity-50"
                  >
                    {submitting
                      ? "Processing..."
                      : otpRequested
                        ? "Verify & Sign In"
                        : "Send One-Time Code"}
                  </button>
                  {otpRequested ? (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setOtpRequested(false)}
                      className="h-9 rounded-md border border-white/[0.08] bg-[#151519] px-3 text-xs text-zinc-300 hover:text-white"
                    >
                      Resend
                    </button>
                  ) : null}
                </div>
              </form>
            </div>
          ) : null}

          {/* Tab 3: Demo Sandbox */}
          {activeTab === "demo" && demoSandboxEnabled ? (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {DEMO_ACCOUNTS.map((acct) => (
                  <button
                    key={acct.code}
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      void completeLogin({ employeeCode: acct.code })
                    }
                    className="rounded-md border border-white/[0.08] bg-[#151519] p-3 text-left transition-colors hover:border-white/[0.2] hover:bg-[#1d1d22] disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="font-semibold text-zinc-300">
                        {acct.role}
                      </span>
                      <span className="text-zinc-500">{acct.code}</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-zinc-100">
                      {acct.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {acct.scope}
                    </p>
                  </button>
                ))}
              </div>

              <form
                onSubmit={handleDemoSubmit}
                className="flex gap-2 border-t border-white/[0.06] pt-3.5"
              >
                <input
                  type="text"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  placeholder="Code or shift PIN (e.g. 0002, 2002)"
                  className="h-8 flex-1 rounded-md border border-white/[0.08] bg-[#151519] px-2.5 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-white/[0.22]"
                />
                <button
                  type="submit"
                  disabled={submitting || !employeeCode.trim()}
                  className="h-8 rounded-md bg-zinc-100 px-3 text-xs font-semibold text-zinc-950 hover:bg-white disabled:opacity-40"
                >
                  Launch
                </button>
              </form>
            </div>
          ) : null}
        </div>

        <div className="border-t border-white/[0.06] bg-[#09090b]/50 px-5 py-2.5 text-center font-mono text-[10px] text-zinc-500">
          Two-Level Organization &amp; Kitchen RBAC · Instant Revocation
        </div>
      </div>
    </div>
  );
}
