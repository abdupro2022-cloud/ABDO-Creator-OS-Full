import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  PageHeader,
  Select,
  StatusPill,
  TextInput,
} from "../components/ui";
import type { ProviderCatalogEntry, UserProviderView } from "@abdo/shared";

export function ProvidersPage() {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<ProviderCatalogEntry[] | null>(null);
  const [mine, setMine] = useState<UserProviderView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [catalogId, setCatalogId] = useState<string>("");
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const [c, m] = await Promise.all([
        api.get<{ catalog: ProviderCatalogEntry[] }>("/providers/catalog"),
        api.get<{ providers: UserProviderView[] }>("/providers/mine"),
      ]);
      setCatalog(c.catalog);
      setMine(m.providers);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load.");
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const selectedEntry = catalog?.find((c) => c.id === catalogId);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await api.post("/providers", {
        catalogId,
        label,
        baseUrl: baseUrl || undefined,
        apiKey,
        defaultModel: defaultModel || undefined,
        enabled: true,
      });
      setAdding(false);
      setLabel("");
      setBaseUrl("");
      setApiKey("");
      setDefaultModel("");
      setInfo("Provider added.");
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add provider.");
    } finally {
      setBusy(false);
    }
  };

  const onTest = async (id: string) => {
    setError(null);
    setInfo(null);
    try {
      const res = await api.post<{ ok: boolean; baseUrl: string; modelCount: number; sample: string[] }>(`/providers/${id}/test`);
      setInfo(`${t("providers.testResultOk")} Found ${res.modelCount} models. Sample: ${res.sample.join(", ")}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connection test failed.");
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm(t("common.delete") + "?")) return;
    try {
      await api.del(`/providers/${id}`);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed.");
    }
  };

  return (
    <>
      <PageHeader title={t("providers.title")} subtitle={t("providers.subtitle")} action={
        <Button onClick={() => setAdding((a) => !a)}>{adding ? t("common.cancel") : t("providers.addNew")}</Button>
      } />
      {error && <ErrorBox message={error} />}
      {info && (
        <div role="status" style={{ padding: 10, borderRadius: 6, background: "#ecfdf5", color: "var(--color-success)", marginBottom: 12 }}>{info}</div>
      )}

      {adding && (
        <Card title={t("providers.addNew")}>
          <form onSubmit={onAdd}>
            <Field label={t("providers.selectProvider")}>
              <Select value={catalogId} onChange={(e) => setCatalogId(e.target.value)} required>
                <option value="">—</option>
                {catalog?.filter((c) => c.implemented).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
            <Field label={t("providers.labelLabel")}>
              <TextInput value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={80} placeholder="My OpenAI key" />
            </Field>
            <Field label={t("providers.baseUrlLabel")} hint={selectedEntry?.baseUrl ?? "Leave blank to use the catalog default."}>
              <TextInput value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://..." />
            </Field>
            <Field label={t("providers.apiKeyLabel")}>
              <TextInput type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required autoComplete="off" />
            </Field>
            <Field label={t("providers.defaultModelLabel")} hint="e.g. gpt-4o-mini, deepseek-chat">
              <TextInput value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} />
            </Field>
            <Button type="submit" disabled={busy || !catalogId || !label || !apiKey}>{t("providers.saveProvider")}</Button>
          </form>
        </Card>
      )}

      <Card title={t("providers.catalog")}>
        {!catalog && <p>{t("common.loading")}</p>}
        {catalog && (
          <div style={{ display: "grid", gap: 8 }}>
            {catalog.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 8, border: "1px solid var(--color-border)", borderRadius: 6 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{c.description}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <StatusPill tone={c.implemented ? "success" : "muted"}>
                    {c.implemented ? t("providers.implemented") : t("providers.notImplemented")}
                  </StatusPill>
                  {c.modelDiscovery && <StatusPill tone="muted">{t("providers.supportsModelDiscovery")}</StatusPill>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={t("providers.mine")}>
        {mine && mine.length === 0 && <EmptyState title={t("providers.noProviders")} />}
        {mine && mine.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {mine.map((p) => (
              <li key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 10, border: "1px solid var(--color-border)", borderRadius: 6, marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{p.label} <span style={{ color: "var(--color-text-faint)", fontSize: 13, fontWeight: 400 }}>· {p.catalogId}</span></div>
                  <div style={{ fontSize: 12, color: "var(--color-text-faint)" }}>
                    {p.baseUrl ?? "(default base URL)"} · {p.defaultModel ?? "no default model"} · {p.hasKey ? "key on file" : "no key"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Button variant="ghost" onClick={() => onTest(p.id)}>{t("providers.testConnection")}</Button>
                  <Button variant="danger" onClick={() => onDelete(p.id)}>{t("providers.deleteProvider")}</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
