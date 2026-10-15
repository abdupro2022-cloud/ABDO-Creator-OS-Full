import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
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
  TextArea,
} from "../components/ui";

type RunStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

interface RunRow {
  id: string;
  projectId: string | null;
  taskClass: "simple" | "standard" | "full";
  userPrompt: string;
  status: RunStatus;
  currentStep: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface StepRow {
  id: string;
  stepIndex: number;
  role: string;
  inputJson: string;
  outputJson: string | null;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  error: string | null;
  attempts: number;
  startedAt: string | null;
  completedAt: string | null;
}

interface RunDetail {
  run: RunRow & { finalOutputJson: string | null };
  steps: StepRow[];
}

export function WorkflowsPage() {
  const { t } = useTranslation();
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [taskClass, setTaskClass] = useState<"simple" | "standard" | "full">("standard");
  const [open, setOpen] = useState<RunDetail | null>(null);

  const load = async () => {
    setError(null);
    try {
      const res = await api.get<{ runs: RunRow[] }>("/workflows");
      setRuns(res.runs);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load.");
    }
  };
  useEffect(() => {
    void load();
  }, []);

  // poll open run
  useEffect(() => {
    if (!open) return;
    if (open.run.status === "completed" || open.run.status === "failed" || open.run.status === "cancelled") return;
    const t = setInterval(async () => {
      try {
        const res = await api.get<RunDetail>(`/workflows/${open.run.id}`);
        setOpen(res);
        if (res.run.status === "completed" || res.run.status === "failed" || res.run.status === "cancelled") {
          void load();
          clearInterval(t);
        }
      } catch {
        clearInterval(t);
      }
    }, 1500);
    return () => clearInterval(t);
  }, [open]);

  const onRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/workflows", { prompt, taskClass });
      setPrompt("");
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start workflow.");
    } finally {
      setBusy(false);
    }
  };

  const onOpen = async (id: string) => {
    try {
      const res = await api.get<RunDetail>(`/workflows/${id}`);
      setOpen(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load run.");
    }
  };

  const onCancel = async (id: string) => {
    try {
      await api.post(`/workflows/${id}/cancel`);
      void load();
      if (open?.run.id === id) {
        const res = await api.get<RunDetail>(`/workflows/${id}`);
        setOpen(res);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Cancel failed.");
    }
  };

  return (
    <>
      <PageHeader title={t("workflows.title")} subtitle={t("workflows.subtitle")} />
      {error && <ErrorBox message={error} />}
      <Card title={t("workflows.newRun")}>
        <form onSubmit={onRun}>
          <Field label={t("workflows.taskClass")}>
            <Select value={taskClass} onChange={(e) => setTaskClass(e.target.value as "simple" | "standard" | "full")}>
              <option value="simple">{t("workflows.classSimple")}</option>
              <option value="standard">{t("workflows.classStandard")}</option>
              <option value="full">{t("workflows.classFull")}</option>
            </Select>
          </Field>
          <Field label={t("workflows.promptLabel")}>
            <TextArea value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={busy} rows={5} />
          </Field>
          <Button type="submit" disabled={busy || !prompt.trim()}>{t("workflows.run")}</Button>
        </form>
      </Card>

      <Card title={t("workflows.recent")}>
        {runs && runs.length === 0 && <EmptyState title={t("workflows.empty")} />}
        {runs && runs.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {runs.map((r) => (
              <li key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 10, border: "1px solid var(--color-border)", borderRadius: 6, marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.userPrompt.slice(0, 80)}{r.userPrompt.length > 80 ? "…" : ""}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-faint)" }}>{r.taskClass} · {new Date(r.createdAt).toLocaleString()}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StatusPill tone={r.status === "completed" ? "success" : r.status === "failed" ? "error" : r.status === "cancelled" ? "muted" : "warning"}>{r.status}</StatusPill>
                  <Button variant="ghost" onClick={() => onOpen(r.id)}>{t("workflows.open")}</Button>
                  {(r.status === "pending" || r.status === "running") && (
                    <Button variant="danger" onClick={() => onCancel(r.id)}>{t("common.cancel")}</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {open && <RunDetailView detail={open} />}
    </>
  );
}

function RunDetailView({ detail }: { detail: RunDetail }) {
  const { t } = useTranslation();
  const final = detail.run.finalOutputJson ? (JSON.parse(detail.run.finalOutputJson) as { summary: string; status: string; key_points: string[]; recommendations: string[]; risks: string[]; confidence: number; next_actions: string[] }) : null;
  return (
    <Card title={t("workflows.runTitle")} action={
      <StatusPill tone={detail.run.status === "completed" ? "success" : detail.run.status === "failed" ? "error" : "muted"}>{detail.run.status}</StatusPill>
    }>
      <div style={{ fontSize: 13, color: "var(--color-text-faint)", marginBottom: 8 }}>
        {detail.run.taskClass} · {new Date(detail.run.createdAt).toLocaleString()}
      </div>
      <p style={{ fontStyle: "italic" }}>{detail.run.userPrompt}</p>

      {final && (
        <div style={{ marginTop: 12, padding: 12, background: "var(--color-surface-2)", borderRadius: 6 }}>
          <h3 style={{ fontSize: 14, margin: 0 }}>{t("workflows.finalDeliverable")}</h3>
          <p><strong>{final.summary}</strong></p>
          {final.key_points.length > 0 && (
            <>
              <h4 style={{ fontSize: 13, marginTop: 8 }}>Key points</h4>
              <ul>{final.key_points.map((k, i) => <li key={i}>{k}</li>)}</ul>
            </>
          )}
          {final.recommendations.length > 0 && (
            <>
              <h4 style={{ fontSize: 13, marginTop: 8 }}>Recommendations</h4>
              <ul>{final.recommendations.map((k, i) => <li key={i}>{k}</li>)}</ul>
            </>
          )}
          {final.risks.length > 0 && (
            <>
              <h4 style={{ fontSize: 13, marginTop: 8 }}>Risks</h4>
              <ul>{final.risks.map((k, i) => <li key={i}>{k}</li>)}</ul>
            </>
          )}
          <div style={{ fontSize: 12, color: "var(--color-text-faint)", marginTop: 8 }}>confidence: {final.confidence.toFixed(2)}</div>
        </div>
      )}

      <h3 style={{ fontSize: 14, marginTop: 16 }}>{t("workflows.steps")}</h3>
      <ol style={{ paddingInlineStart: 18 }}>
        {detail.steps.map((s) => {
          const out = s.outputJson ? (JSON.parse(s.outputJson) as { summary: string; status: string }) : null;
          return (
            <li key={s.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <strong>{s.role}</strong>
                <StatusPill tone={s.status === "completed" ? "success" : s.status === "failed" ? "error" : "muted"}>{s.status}</StatusPill>
                <span style={{ fontSize: 12, color: "var(--color-text-faint)" }}>
                  {s.attempts} attempt(s)
                  {s.startedAt && ` · started ${new Date(s.startedAt).toLocaleTimeString()}`}
                  {s.completedAt && ` · done ${new Date(s.completedAt).toLocaleTimeString()}`}
                </span>
              </div>
              {s.error && <div style={{ color: "var(--color-error)", fontSize: 12 }}>{s.error}</div>}
              {out && <div style={{ fontSize: 13, marginTop: 4 }}>{out.summary}</div>}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

// Used by ProjectDetail to deep-link
export { Link };
