import jwt from "jsonwebtoken";
import { config } from "../config.js";

export interface JwtPayload {
  sub: string; // user id
  role: "user" | "admin";
}

export function signSession(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: "7d", algorithm: "HS256" });
}

export function verifySession(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
    if (typeof decoded === "string") return null;
    const sub = (decoded as Record<string, unknown>).sub;
    const role = (decoded as Record<string, unknown>).role;
    if (typeof sub !== "string") return null;
    if (role !== "user" && role !== "admin") return null;
    return { sub, role };
  } catch {
    return null;
  }
}
