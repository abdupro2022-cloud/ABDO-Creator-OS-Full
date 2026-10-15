import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import { Button, Card, EmptyState, ErrorBox, Field, PageHeader, StatusPill, TextArea, TextInput } from "../components/ui";
import type { ResearchReport } from "@abdo/shared";

export function ResearchPage() {
  const { t } = useTranslation();
  const [reports, setReports] = useState<ResearchReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [summary, setSummary] = useState("");
  const [sourcesText, setSourcesText] = useState("");
  const [claimsText, setClaimsText] = useState("");
  const [factCheckText, setFactCheckText] = useState("");
  const [open, setOpen] = useState<ResearchReport | null>(null);

  const load = async () => {
    setError(null);
    try {
      const res = await api.get<{ reports: ResearchReport[] }>("/research");
      setReports(res.reports);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load.");
    }
  };
  useEffect(() => { void load(); }, []);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const sources = sourcesText.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
        const [url, title, reliability] = line.split("|").map((s) => s.trim());
        return {
          url: url || "https://example.invalid",
          title: title || url || "(untitled)",
          publicationDate: null,
          reliability: (["high", "medium", "low", "unknown"].includes(reliability) ? reliability : "unknown") as "high" | "medium" | "low" | "unknown",
        };
      });
      const claims = claimsText.split("\n").map((l) => l.trim()).filter(Boolean).map((line, i) => {
        const [text, status] = line.split("|").map((s) => s.trim());
        const validStatuses = ["verified", "supported", "unverified", "conflicting", "inference", "speculation"] as const;
        type Status = (typeof validStatuses)[number];
        const safeStatus: Status = (validStatuses as readonly string[]).includes(status ?? "") ? (status as Status) : "unverified";
        return {
          id: `c-${i}`,
          text: text || line,
          status: safeStatus,
          supportingSourceUrls: [],
          conflictingSourceUrls: [],
        };
      });
      await api.post("/research", {
        query,
        summary,
        sources,
        claims,
        factCheckNotes: factCheckText.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      setCreating(false);
      setQuery(""); setSummary(""); setSourcesText(""); setClaimsText(""); setFactCheckText("");
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save report.");
    }
  };

  const onOpen = async (id: string) => {
    const res = await api.get<{ report: ResearchReport }>(`/research/${id}`);
    setOpen(res.report);
  };

  return (
    <>
      <PageHeader title={t("research.title")} subtitle={t("research.subtitle")} action={
        <Button onClick={() => setCreating((c) => !c)}>{creating ? t("common.cancel") : t("research.newReport")}</Button>
      } />
      {error && <ErrorBox message={error} />}
      <div role="status" style={{ padding: 10, background: "var(--color-surface-2)", borderRadius: 6, marginBottom: 12, color: "var(--color-text-muted)", fontSize: 13 }}>
        {t("research.liveSearchUnavailable")}
      </div>
      {creating && (
        <Card>
          <form onSubmit={onSave}>
            <Field label={t("research.queryLabel")}><TextInput value={query} onChange={(e) => setQuery(e.target.value)} required maxLength={500} /></Field>
            <Field label={t("research.summaryLabel")}><TextArea value={summary} onChange={(e) => setSummary(e.target.value)} required maxLength={20000} /></Field>
            <Field label={t("research.sourcesLabel")}>
              <TextArea value={sourcesText} onChange={(e) => setSourcesText(e.target.value)} />
            </Field>
            <Field label={t("research.claimsLabel")}>
              <TextArea value={claimsText} onChange={(e) => setClaimsText(e.target.value)} />
            </Field>
            <Field label={t("research.factCheckLabel")}>
              <TextArea value={factCheckText} onChange={(e) => setFactCheckText(e.target.value)} />
            </Field>
            <Button type="submit">{t("research.save")}</Button>
          </form>
        </Card>
      )}
      <Card title={t("research.title")}>
        {reports && reports.length === 0 && <EmptyState title={t("research.noReports")} />}
        {reports && reports.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {reports.map((r) => (
              <li key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 10, border: "1px solid var(--color-border)", borderRadius: 6, marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.query}</div>
                  <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{r.claims.length} claims · {r.sources.length} sources</div>
                </div>
                <Button variant="ghost" onClick={() => onOpen(r.id)}>{t("research.openReport")}</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {open && (
        <Card title={open.query}>
          <p>{open.summary}</p>
          <h3 style={{ fontSize: 14, marginTop: 12 }}>Claims</h3>
          <ul>
            {open.claims.map((c) => (
              <li key={c.id} style={{ marginBottom: 6 }}>
                <StatusPill tone={c.status === "verified" || c.status === "supported" ? "success" : c.status === "conflicting" ? "error" : "muted"}>{t("research." + statusKey(c.status))}</StatusPill>{" "}
                {c.text}
              </li>
            ))}
          </ul>
          <h3 style={{ fontSize: 14, marginTop: 12 }}>Sources</h3>
          <ul>
            {open.sources.map((s, i) => (
              <li key={i}>
                <a href={s.url} target="_blank" rel="noreferrer">{s.title || s.url}</a>{" "}
                <StatusPill tone={s.reliability === "high" ? "success" : s.reliability === "low" ? "warning" : "muted"}>{s.reliability}</StatusPill>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function statusKey(s: string): string {
  switch (s) {
    case "verified": return "statusVerified";
    case "supported": return "statusSupported";
    case "unverified": return "statusUnverified";
    case "conflicting": return "statusConflicting";
    case "inference": return "statusInference";
    case "speculation": return "statusSpeculation";
    default: return "statusUnverified";
  }
}
