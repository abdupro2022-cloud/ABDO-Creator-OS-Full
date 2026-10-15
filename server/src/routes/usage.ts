import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../auth/middleware.js";

export const usageRouter: Router = Router();

/** Aggregated usage for the current user. Honest about whether tokens were reported. */
usageRouter.get("/", requireAuth, (req, res) => {
  const user = req.user!;
  const rows = db
    .prepare(
      `SELECT model, source, COUNT(*) as calls,
              COALESCE(SUM(prompt_tokens), 0) as promptTokens,
              COALESCE(SUM(completion_tokens), 0) as completionTokens,
              COALESCE(SUM(total_tokens), 0) as totalTokens
       FROM usage_records WHERE user_id = ? GROUP BY model, source`,
    )
    .all(user.id) as Array<{
      model: string | null;
      source: "provider" | "estimated" | "unknown";
      calls: number;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    }>;
  res.json({ usage: rows });
});
