import { Router } from "express";
import { nanoid } from "nanoid";
import {
  type UserProviderConfigInput,
  type UserProviderView,
  UserProviderConfigInputSchema,
  type ProviderCatalogEntry,
} from "@abdo/shared";
import { db } from "../db.js";
import { requireAuth } from "../auth/middleware.js";
import { encryptSecret, decryptSecret } from "../crypto/envelope.js";
import { logger } from "../logger.js";
import { PROVIDER_CATALOG, findCatalogEntry } from "../services/providers/registry.js";
import { openaiCompatibleAdapter } from "../services/providers/openaiCompatible.js";

export const providersRouter: Router = Router();

providersRouter.get("/catalog", requireAuth, (_req, res) => {
  res.json({ catalog: PROVIDER_CATALOG });
});

providersRouter.get("/mine", requireAuth, (req, res) => {
  const user = req.user!;
  const rows = db
    .prepare(
      `SELECT id, catalog_id as catalogId, label, base_url as baseUrl,
              default_model as defaultModel, enabled, encrypted_api_key as encryptedKey,
              created_at as createdAt, updated_at as updatedAt
       FROM user_provider_configs WHERE user_id = ?
       ORDER BY created_at DESC`,
    )
    .all(user.id) as Array<{
      id: string;
      catalogId: string;
      label: string;
      baseUrl: string | null;
      defaultModel: string | null;
      enabled: number;
      encryptedKey: Buffer;
      createdAt: string;
      updatedAt: string;
    }>;
  const view: UserProviderView[] = rows.map((r) => ({
    id: r.id,
    catalogId: r.catalogId,
    label: r.label,
    baseUrl: r.baseUrl,
    defaultModel: r.defaultModel,
    enabled: r.enabled === 1,
    hasKey: r.encryptedKey.length > 0,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
  res.json({ providers: view });
});

providersRouter.post("/", requireAuth, (req, res) => {
  const user = req.user!;
  const parsed = UserProviderConfigInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_input", message: "Invalid provider config.", details: parsed.error.flatten() } });
    return;
  }
  const data: UserProviderConfigInput = parsed.data;
  const entry = findCatalogEntry(data.catalogId);
  if (!entry) {
    res.status(400).json({ error: { code: "unknown_catalog_id", message: `Unknown catalog id: ${data.catalogId}` } });
    return;
  }
  if (!entry.implemented) {
    res.status(400).json({ error: { code: "not_implemented", message: `Provider ${entry.name} is in the catalog but is not yet implemented. The architecture supports it; a provider-specific adapter is pending.` } });
    return;
  }
  const id = nanoid();
  const now = new Date().toISOString();
  const encrypted = encryptSecret(data.apiKey);
  const baseUrl = data.baseUrl ?? entry.baseUrl ?? null;
  db.prepare(
    `INSERT INTO user_provider_configs
     (id, user_id, catalog_id, label, base_url, encrypted_api_key, default_model, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    user.id,
    data.catalogId,
    data.label,
    baseUrl,
    encrypted,
    data.defaultModel ?? null,
    data.enabled ? 1 : 0,
    now,
    now,
  );
  logger.info("provider config added", { userId: user.id, catalogId: data.catalogId, configId: id });
  res.status(201).json({
    provider: {
      id,
      catalogId: data.catalogId,
      label: data.label,
      baseUrl,
      defaultModel: data.defaultModel ?? null,
      enabled: data.enabled,
      hasKey: true,
      createdAt: now,
      updatedAt: now,
    } satisfies UserProviderView,
  });
});

providersRouter.delete("/:id", requireAuth, (req, res) => {
  const user = req.user!;
  const result = db
    .prepare(`DELETE FROM user_provider_configs WHERE id = ? AND user_id = ?`)
    .run(req.params.id, user.id);
  if (result.changes === 0) {
    res.status(404).json({ error: { code: "not_found", message: "Provider config not found." } });
    return;
  }
  res.json({ ok: true });
});

providersRouter.post("/:id/test", requireAuth, async (req, res) => {
  const user = req.user!;
  const row = db
    .prepare(
      `SELECT id, catalog_id, base_url, default_model, encrypted_api_key
       FROM user_provider_configs WHERE id = ? AND user_id = ?`,
    )
    .get(req.params.id, user.id) as
    | { id: string; catalog_id: string; base_url: string | null; default_model: string | null; encrypted_api_key: Buffer }
    | undefined;
  if (!row) {
    res.status(404).json({ error: { code: "not_found", message: "Provider config not found." } });
    return;
  }
  const entry = findCatalogEntry(row.catalog_id);
  if (!entry || !entry.implemented) {
    res.status(400).json({ error: { code: "not_implemented", message: `Provider ${row.catalog_id} is not implemented.` } });
    return;
  }
  const baseUrl = row.base_url ?? entry.baseUrl;
  if (!baseUrl) {
    res.status(400).json({ error: { code: "missing_base_url", message: "This provider has no base URL. Set one in the config." } });
    return;
  }
  let apiKey: string;
  try {
    apiKey = decryptSecret(row.encrypted_api_key);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: { code: "decrypt_failed", message } });
    return;
  }
  try {
    const models = await openaiCompatibleAdapter.listModels(baseUrl, apiKey);
    res.json({ ok: true, baseUrl, modelCount: models.length, sample: models.slice(0, 10).map((m) => m.id) });
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "unknown";
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: { code, message } });
  }
});

providersRouter.get("/:id/models", requireAuth, async (req, res) => {
  const user = req.user!;
  const row = db
    .prepare(
      `SELECT catalog_id, base_url, encrypted_api_key
       FROM user_provider_configs WHERE id = ? AND user_id = ?`,
    )
    .get(req.params.id, user.id) as
    | { catalog_id: string; base_url: string | null; encrypted_api_key: Buffer }
    | undefined;
  if (!row) {
    res.status(404).json({ error: { code: "not_found", message: "Provider config not found." } });
    return;
  }
  const entry = findCatalogEntry(row.catalog_id);
  if (!entry || !entry.implemented || !entry.modelDiscovery) {
    res.json({ models: [], supported: false });
    return;
  }
  const baseUrl = row.base_url ?? entry.baseUrl;
  if (!baseUrl) {
    res.json({ models: [], supported: true, note: "No base URL configured." });
    return;
  }
  let apiKey: string;
  try {
    apiKey = decryptSecret(row.encrypted_api_key);
  } catch (err) {
    res.status(500).json({ error: { code: "decrypt_failed", message: err instanceof Error ? err.message : String(err) } });
    return;
  }
  try {
    const models = await openaiCompatibleAdapter.listModels(baseUrl, apiKey);
    res.json({ models: models.map((m) => m.id), supported: true });
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "unknown";
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: { code, message } });
  }
});

/** Helper used by the agent route to resolve an active provider + key for a user. */
export interface ResolvedProvider {
  configId: string;
  entry: ProviderCatalogEntry;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function resolveProviderForUser(
  userId: string,
  preferredConfigId?: string,
  preferredModel?: string,
): ResolvedProvider | null {
  const row = preferredConfigId
    ? (db
        .prepare(
          `SELECT id, catalog_id, base_url, default_model, encrypted_api_key
           FROM user_provider_configs WHERE id = ? AND user_id = ? AND enabled = 1`,
        )
        .get(preferredConfigId, userId) as
        | { id: string; catalog_id: string; base_url: string | null; default_model: string | null; encrypted_api_key: Buffer }
        | undefined)
    : (db
        .prepare(
          `SELECT id, catalog_id, base_url, default_model, encrypted_api_key
           FROM user_provider_configs WHERE user_id = ? AND enabled = 1
           ORDER BY created_at DESC LIMIT 1`,
        )
        .get(userId) as
        | { id: string; catalog_id: string; base_url: string | null; default_model: string | null; encrypted_api_key: Buffer }
        | undefined);
  if (!row) return null;
  const entry = findCatalogEntry(row.catalog_id);
  if (!entry || !entry.implemented) return null;
  const baseUrl = row.base_url ?? entry.baseUrl;
  if (!baseUrl) return null;
  const apiKey = decryptSecret(row.encrypted_api_key);
  const model = preferredModel ?? row.default_model ?? "gpt-4o-mini";
  return { configId: row.id, entry, baseUrl, apiKey, model };
}
