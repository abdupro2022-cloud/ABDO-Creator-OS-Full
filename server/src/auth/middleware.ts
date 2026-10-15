import type { Request, Response, NextFunction } from "express";
import { verifySession } from "./jwt.js";
import { db } from "../db.js";
import type { SessionUser } from "@abdo/shared";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.header("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m) {
    res.status(401).json({ error: { code: "unauthenticated", message: "Missing bearer token." } });
    return;
  }
  const payload = verifySession(m[1]);
  if (!payload) {
    res.status(401).json({ error: { code: "unauthenticated", message: "Invalid or expired session." } });
    return;
  }
  const row = db
    .prepare(
      `SELECT id, email, display_name as displayName, role, created_at as createdAt
       FROM users WHERE id = ?`,
    )
    .get(payload.sub) as SessionUser | undefined;
  if (!row) {
    res.status(401).json({ error: { code: "unauthenticated", message: "User not found." } });
    return;
  }
  req.user = row;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: { code: "forbidden", message: "Admin required." } });
    return;
  }
  next();
}
