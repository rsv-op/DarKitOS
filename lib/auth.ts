import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

const SECRET_KEY =
  process.env.JWT_SECRET ||
  "dark-cloud-os-fallback-secret-key-2026";

const key = new TextEncoder().encode(
  SECRET_KEY
);

export type Role =
  | "OWNER"
  | "MANAGER"
  | "LINE_COOK"
  | "DISPATCH";

export interface SessionPayload {
  userId: string;
  role: Role;
  kitchenId?: string;
  iat?: number;
  exp?: number;
}

export async function signToken(
  payload: SessionPayload
): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(key);
}

export async function verifyToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(
      token,
      key
    );
    return payload as SessionPayload;
  } catch (error) {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(
    "dark_cloud_session"
  )?.value;

  if (!token) return null;

  return await verifyToken(token);
}
