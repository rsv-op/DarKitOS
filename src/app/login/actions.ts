"use server";

import { cookies } from "next/headers";
import { signToken, type Role } from "@/lib/auth";

const PIN_ROLES: Record<string, Role> = {
  "1111": "LINE_COOK",
  "2222": "DISPATCH",
  "3333": "OWNER",
  "9999": "MANAGER",
};

export async function authenticatePin(
  pin: string
) {
  const role = PIN_ROLES[pin];

  if (!role) {
    return {
      success: false,
      error:
        "Invalid station PIN. Please try again.",
    };
  }

  const token = await signToken({
    userId: `usr_${pin}`,
    role: role,
    kitchenId: "K1",
  });

  cookies().set({
    name: "dark_cloud_session",
    value: token,
    httpOnly: true,
    secure:
      process.env.NODE_ENV ===
      "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return { success: true, role };
}
