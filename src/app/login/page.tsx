"use client";

import {
  useState,
  useEffect,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import { authenticatePin } from "./actions";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] =
    useState(false);
  const router = useRouter();
  const searchParams =
    useSearchParams();
  const redirectPath =
    searchParams.get("redirect") ||
    "/";

  useEffect(() => {
    if (pin.length === 4) {
      handleSubmit();
    }
  }, [pin]);

  const handleKeyPress = (key: string) => {
    setError("");
    if (pin.length < 4)
      setPin((prev) => prev + key);
    if (navigator.vibrate)
      navigator.vibrate(20);
  };

  const handleDelete = () => {
    setPin((prev) =>
      prev.slice(0, -1)
    );
    if (navigator.vibrate)
      navigator.vibrate(20);
  };

  const handleSubmit = async () => {
    setLoading(true);
    const result =
      await authenticatePin(pin);

    if (result.success) {
      if (navigator.vibrate)
        navigator.vibrate(50);
      router.push(redirectPath);
    } else {
      if (navigator.vibrate)
        navigator.vibrate([
          200, 100, 200,
        ]);
      setError(
        result.error ||
          "Authentication failed"
      );
      setPin("");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B111E] flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-[#1E293B] rounded-2xl border border-slate-700 p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight mb-2">
            DARKitOS Station
          </h1>
          <p className="text-slate-400 text-sm">
            Enter your 4-digit shift PIN
            to unlock
          </p>
        </div>

        {/* PIN Display */}
        <div className="flex justify-center gap-4 mb-8">
          {[...Array(4)].map(
            (_, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full transition-colors duration-200 ${
                  i < pin.length
                    ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                    : "bg-slate-700"
                }`}
              />
            )
          )}
        </div>

        {/* Status Banner */}
        <div className="h-6 mb-6 text-center">
          {error && (
            <p className="text-red-400 text-sm font-medium animate-pulse">
              {error}
            </p>
          )}
          {loading && (
            <p className="text-sky-400 text-sm font-medium">
              Authenticating...
            </p>
          )}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(
            (num) => (
              <button
                key={num}
                onClick={() =>
                  handleKeyPress(
                    num.toString()
                  )
                }
                disabled={loading}
                className="h-16 rounded-xl bg-slate-800 text-slate-200 text-2xl font-semibold border border-slate-700 active:bg-slate-700 active:scale-95 transition-all"
              >
                {num}
              </button>
            )
          )}
          <button
            onClick={() =>
              handleKeyPress("0")
            }
            disabled={loading}
            className="col-start-2 h-16 rounded-xl bg-slate-800 text-slate-200 text-2xl font-semibold border border-slate-700 active:bg-slate-700 active:scale-95 transition-all"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            disabled={
              loading || pin.length === 0
            }
            className="col-start-3 h-16 rounded-xl bg-slate-800/50 text-slate-400 text-sm font-bold uppercase tracking-wider border border-slate-700/50 active:bg-slate-700 active:text-slate-200 transition-all"
          >
            Del
          </button>
        </div>

        {/* Dev Quick-Switch Presets */}
        <div className="pt-6 border-t border-slate-700/50">
          <p className="text-xs text-slate-500 mb-3 text-center uppercase tracking-wider">
            Testing Overrides
          </p>
          <div className="flex justify-center gap-2">
            <button
              onClick={() =>
                setPin("1111")
              }
              className="px-3 py-1.5 rounded bg-slate-800 text-slate-400 text-xs hover:bg-slate-700 hover:text-white transition-colors"
            >
              Cook
            </button>
            <button
              onClick={() =>
                setPin("2222")
              }
              className="px-3 py-1.5 rounded bg-slate-800 text-slate-400 text-xs hover:bg-slate-700 hover:text-white transition-colors"
            >
              Dispatch
            </button>
            <button
              onClick={() =>
                setPin("3333")
              }
              className="px-3 py-1.5 rounded bg-slate-800 text-slate-400 text-xs hover:bg-slate-700 hover:text-white transition-colors"
            >
              Owner
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
