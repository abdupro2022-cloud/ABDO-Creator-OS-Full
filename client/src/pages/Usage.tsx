import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import { Card, EmptyState, ErrorBox, PageHeader } from "../components/ui";

interface UsageRow {
  model: string | null;
  source: "provider" | "estimated" | "unknown";
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export function UsagePage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<UsageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ usage: UsageRow[] }>("/usage");
        setRows(res.usage);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load.");
      }
    })();
  }, []);
  return (
    <>
      <PageHeader title={t("usage.title")} subtitle={t("usage.subtitle")} />
      {error && <ErrorBox message={error} />}
      <Card>
        {rows && rows.length === 0 && <EmptyState title={t("usage.noUsage")} />}
        {rows && rows.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "start", color: "var(--color-text-muted)" }}>
                <th style={{ textAlign: "start", padding: 8 }}>Model</th>
                <th style={{ textAlign: "start", padding: 8 }}>Source</th>
                <th style={{ textAlign: "end", padding: 8 }}>{t("usage.calls")}</th>
                <th style={{ textAlign: "end", padding: 8 }}>{t("usage.promptTokens")}</th>
                <th style={{ textAlign: "end", padding: 8 }}>{t("usage.completionTokens")}</th>
                <th style={{ textAlign: "end", padding: 8 }}>{t("usage.totalTokens")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: 8 }}>{r.model ?? "—"}</td>
                  <td style={{ padding: 8, color: r.source === "provider" ? "var(--color-success)" : "var(--color-text-faint)" }}>{r.source}</td>
                  <td style={{ padding: 8, textAlign: "end" }}>{r.calls}</td>
                  <td style={{ padding: 8, textAlign: "end" }}>{r.promptTokens}</td>
                  <td style={{ padding: 8, textAlign: "end" }}>{r.completionTokens}</td>
                  <td style={{ padding: 8, textAlign: "end" }}>{r.totalTokens}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
