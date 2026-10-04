"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

// Canonical mapping matching the DARKitOS spec
const BRANDS = [
  {
    id: "brand-burgerbox",
    name: "BurgerBox 🍔",
  },
  {
    id: "brand-pizzalab",
    name: "PizzaLab 🍕",
  },
  {
    id: "brand-greenbowl",
    name: "GreenBowl 🥗",
  },
  {
    id: "brand-currycraft",
    name: "CurryCraft 🍛",
  },
];

const KITCHENS = [
  {
    id: "K1",
    name: "Kitchen 1 (Gurgaon)",
    brands: [
      "brand-burgerbox",
      "brand-pizzalab",
    ],
  },
  {
    id: "K2",
    name: "Kitchen 2 (Sushant Lok)",
    brands: ["brand-greenbowl"],
  },
  {
    id: "K3",
    name: "Kitchen 3 (Cyber Hub)",
    brands: ["brand-currycraft"],
  },
];

const CHANNELS = [
  "Zomato",
  "Swiggy",
  "Direct Web",
  "DEV_INJECT",
];

export default function OrderInjectionPage() {
  const router = useRouter();
  const [brandId, setBrandId] =
    useState("");
  const [kitchenId, setKitchenId] =
    useState("");
  const [channel, setChannel] =
    useState("Zomato");
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  // Strict cascading logic: Only show kitchens that support the selected brand
  const validKitchens = useMemo(() => {
    if (!brandId) return [];
    return KITCHENS.filter((k) =>
      k.brands.includes(brandId)
    );
  }, [brandId]);

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();
    if (!brandId || !kitchenId)
      return alert(
        "Select Brand and Kitchen"
      );

    setIsSubmitting(true);
    try {
      const res = await fetch(
        "/api/orders",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            brandId,
            kitchenId,
            channel,
            totalAmount:
              Math.floor(
                Math.random() * 800
              ) + 200,
            itemCount:
              Math.floor(
                Math.random() * 3
              ) + 1,
            notes: "Synthetic test order",
          }),
        }
      );

      if (!res.ok)
        throw new Error(
          await res.text()
        );

      setBrandId("");
      setKitchenId("");
      alert(
        "Order injected successfully!"
      );
      router.refresh();
    } catch (error) {
      alert(
        `Injection failed: ${error}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">
        Order Injection Testing
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6"
      >
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            1. Select Virtual Brand
          </label>
          <select
            value={brandId}
            onChange={(e) => {
              setBrandId(e.target.value);
              setKitchenId("");
            }}
            className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50"
            required
          >
            <option value="">
              -- Choose Brand --
            </option>
            {BRANDS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            2. Select Physical Kitchen
          </label>
          <select
            value={kitchenId}
            onChange={(e) =>
              setKitchenId(e.target.value)
            }
            disabled={
              !brandId ||
              validKitchens.length === 0
            }
            className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50 disabled:opacity-50"
            required
          >
            <option value="">
              {brandId
                ? "-- Choose Valid Kitchen --"
                : "Select a brand first"}
            </option>
            {validKitchens.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            3. Select Channel
          </label>
          <div className="flex gap-4">
            {CHANNELS.map((c) => (
              <label
                key={c}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name="channel"
                  value={c}
                  checked={channel === c}
                  onChange={(e) =>
                    setChannel(e.target.value)
                  }
                />
                <span className="text-sm text-slate-700">
                  {c}
                </span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg uppercase tracking-wider transition-colors disabled:opacity-50"
        >
          {isSubmitting
            ? "Injecting..."
            : "Inject Order"}
        </button>
      </form>
    </div>
  );
}
