import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import {
  Button,
  Card,
  ErrorBox,
  Field,
  PageHeader,
  StatusPill,
  TextArea,
  TextInput,
} from "../components/ui";
import type { ChatResponse, ProviderCatalogEntry, UserProviderView } from "@abdo/shared";
import { useEffect } from "react";

export function AssistantPage() {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<UserProviderView[] | null>(null);
  const [catalog, setCatalog] = useState<ProviderCatalogEntry[] | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [prompt, setPrompt] = useState<string>("");
  const [roleGuidance, setRoleGuidance] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ChatResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [mine, cat] = await Promise.all([
          api.get<{ providers: UserProviderView[] }>("/providers/mine"),
          api.get<{ catalog: ProviderCatalogEntry[] }>("/providers/catalog"),
        ]);
        if (cancelled) return;
        setProviders(mine.providers);
        setCatalog(cat.catalog);
        if (mine.providers.length > 0) setSelected(mine.providers[0].id);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load providers.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSend = async () => {
    setError(null);
    setBusy(true);
    setResult(null);
    try {
      const res = await api.post<ChatResponse>("/agents/chat", {
        prompt,
        providerConfigId: selected || undefined,
        model: model || undefined,
        roleGuidance: roleGuidance || undefined,
      });
      setResult(res);
    } catch (err) {
      if (err instanceof ApiError && err.code === "no_provider_configured") {
        setError(t("assistant.noProviderBody"));
      } else {
        setError(err instanceof Error ? err.message : "Chat failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (providers && providers.length === 0) {
    return (
      <>
        <PageHeader title={t("assistant.title")} subtitle={t("assistant.subtitle")} />
        <Card title={t("assistant.noProviderTitle")}>
          <p>{t("assistant.noProviderBody")}</p>
          <Link to="/providers"><Button>{t("assistant.goToProviders")}</Button></Link>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("assistant.title")} subtitle={t("assistant.subtitle")} />
      {error && <ErrorBox message={error} />}
      <Card>
        {providers && providers.length > 1 && (
          <Field label="Provider">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--color-border-strong)", background: "var(--color-surface)" }}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.catalogId})
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={t("assistant.promptLabel")}>
          <TextArea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t("assistant.promptPlaceholder")}
            disabled={busy}
          />
        </Field>
        <Field label={t("assistant.roleGuidanceLabel")}>
          <TextInput
            value={roleGuidance}
            onChange={(e) => setRoleGuidance(e.target.value)}
            placeholder={t("assistant.roleGuidancePlaceholder")}
            disabled={busy}
          />
        </Field>
        <Field label="Model (optional override)">
          <TextInput value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. gpt-4o-mini" disabled={busy} />
        </Field>
        <Button onClick={onSend} disabled={busy || !prompt.trim()}>
          {busy ? t("common.loading") : t("assistant.send")}
        </Button>
      </Card>
      {result && (
        <Card title={t("assistant.resultTitle")} action={<StatusPill tone={result.output.status === "ok" ? "success" : result.output.status === "error" ? "error" : "warning"}>{result.output.status}</StatusPill>}>
          <div style={{ fontSize: 13, color: "var(--color-text-faint)", marginBottom: 8 }}>
            {result.role} · {result.model} · {result.providerId.slice(0, 8)}
            {result.usage?.totalTokens != null ? ` · ${result.usage.totalTokens} tokens` : ""}
          </div>
          <p style={{ marginTop: 0 }}><strong>{result.output.summary}</strong></p>
          {result.output.key_points.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, marginTop: 12 }}>Key points</h3>
              <ul>
                {result.output.key_points.map((k, i) => <li key={i}>{k}</li>)}
              </ul>
            </>
          )}
          {result.output.recommendations.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, marginTop: 12 }}>Recommendations</h3>
              <ul>
                {result.output.recommendations.map((k, i) => <li key={i}>{k}</li>)}
              </ul>
            </>
          )}
          {result.output.risks.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, marginTop: 12 }}>Risks</h3>
              <ul>
                {result.output.risks.map((k, i) => <li key={i}>{k}</li>)}
              </ul>
            </>
          )}
          {result.output.next_actions.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, marginTop: 12 }}>Next actions</h3>
              <ul>
                {result.output.next_actions.map((k, i) => <li key={i}>{k}</li>)}
              </ul>
            </>
          )}
          {result.warnings.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--color-warning)" }}>
              Warnings: {result.warnings.join(", ")}
            </div>
          )}
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer", color: "var(--color-text-muted)" }}>{t("assistant.rawLabel")}</summary>
            <pre style={{ background: "var(--color-surface-2)", padding: 12, borderRadius: 6, overflowX: "auto", fontSize: 12 }}>{result.rawText}</pre>
          </details>
        </Card>
      )}
    </>
  );
}
