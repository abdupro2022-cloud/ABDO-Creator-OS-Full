import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import { Button, Card, ErrorBox, Field, PageHeader, Select, TextArea, TextInput } from "../components/ui";

type ToolName = "idea_dev" | "summary" | "rewrite" | "seo_outline" | "audience_analysis" | "repurpose" | "youtube_outline";

interface ToolResult {
  tool: ToolName;
  result: Record<string, unknown>;
  usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null; source: string } | null;
  warnings: string[];
  rawText: string;
}

export function ToolsPage() {
  const { t } = useTranslation();
  const [tool, setTool] = useState<ToolName>("idea_dev");
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [text, setText] = useState("");
  const [tone, setTone] = useState("neutral");
  const [length, setLength] = useState("5-7 minutes");
  const [product, setProduct] = useState("");
  const [target, setTarget] = useState("twitter thread, linkedin post, email");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ToolResult | null>(null);

  const onRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    setResult(null);
    try {
      const inputs: Record<string, unknown> = {};
      if (tool === "idea_dev" || tool === "audience_analysis" || tool === "seo_outline" || tool === "youtube_outline") {
        inputs.topic = topic;
        inputs.audience = audience || undefined;
      }
      if (tool === "audience_analysis") inputs.product = product || undefined;
      if (tool === "youtube_outline") inputs.length = length;
      if (tool === "summary" || tool === "rewrite" || tool === "repurpose") inputs.text = text;
      if (tool === "rewrite") {
        inputs.tone = tone;
        inputs.audience = audience || undefined;
      }
      if (tool === "repurpose") inputs.target = target;
      const res = await api.post<ToolResult>("/tools/run", { tool, inputs });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Tool run failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={t("tools.title")} subtitle={t("tools.subtitle")} />
      {error && <ErrorBox message={error} />}
      <Card>
        <form onSubmit={onRun}>
          <Field label={t("tools.chooseTool")}>
            <Select value={tool} onChange={(e) => setTool(e.target.value as ToolName)}>
              <option value="idea_dev">{t("tools.ideaDev")}</option>
              <option value="summary">{t("tools.summarize")}</option>
              <option value="rewrite">{t("tools.rewrite")}</option>
              <option value="seo_outline">{t("tools.seoOutline")}</option>
              <option value="audience_analysis">{t("tools.audience")}</option>
              <option value="repurpose">{t("tools.repurpose")}</option>
              <option value="youtube_outline">{t("tools.youtubeOutline")}</option>
            </Select>
          </Field>
          {(tool === "idea_dev" || tool === "audience_analysis" || tool === "seo_outline" || tool === "youtube_outline") && (
            <Field label="Topic"><TextInput value={topic} onChange={(e) => setTopic(e.target.value)} required /></Field>
          )}
          {tool === "audience_analysis" && (
            <Field label="Product / offer"><TextInput value={product} onChange={(e) => setProduct(e.target.value)} /></Field>
          )}
          {tool === "youtube_outline" && (
            <Field label="Target length"><TextInput value={length} onChange={(e) => setLength(e.target.value)} /></Field>
          )}
          {(tool === "idea_dev" || tool === "audience_analysis" || tool === "seo_outline" || tool === "rewrite" || tool === "youtube_outline") && (
            <Field label="Audience"><TextInput value={audience} onChange={(e) => setAudience(e.target.value)} /></Field>
          )}
          {tool === "rewrite" && (
            <Field label="Tone"><TextInput value={tone} onChange={(e) => setTone(e.target.value)} /></Field>
          )}
          {tool === "repurpose" && (
            <Field label="Target formats (comma-separated)"><TextInput value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
          )}
          {(tool === "summary" || tool === "rewrite" || tool === "repurpose") && (
            <Field label="Text"><TextArea value={text} onChange={(e) => setText(e.target.value)} required rows={8} /></Field>
          )}
          <Button type="submit" disabled={busy}>{busy ? t("common.loading") : t("tools.run")}</Button>
        </form>
      </Card>
      {result && (
        <Card title={t("tools.resultTitle")} action={
          result.usage?.totalTokens != null ? <span style={{ fontSize: 12, color: "var(--color-text-faint)" }}>{result.usage.totalTokens} tokens</span> : null
        }>
          <ToolResultView result={result.result} tool={result.tool} />
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer", color: "var(--color-text-muted)" }}>Raw</summary>
            <pre style={{ background: "var(--color-surface-2)", padding: 12, borderRadius: 6, overflowX: "auto", fontSize: 12 }}>{result.rawText}</pre>
          </details>
        </Card>
      )}
    </>
  );
}

function ToolResultView({ result, tool }: { result: Record<string, unknown>; tool: ToolName }) {
  if (tool === "idea_dev") {
    return (
      <div>
        <h4 style={{ fontSize: 13 }}>Angles</h4>
        <ul>{(result.angles as string[] | undefined)?.map((a, i) => <li key={i}>{a}</li>)}</ul>
        <h4 style={{ fontSize: 13 }}>Hooks</h4>
        <ul>{(result.hooks as string[] | undefined)?.map((a, i) => <li key={i}>{a}</li>)}</ul>
        <h4 style={{ fontSize: 13 }}>Outlines</h4>
        {((result.outlines as Array<{ angle: string; outline: string[] }> | undefined) ?? []).map((o, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <strong>{o.angle}</strong>
            <ul>{o.outline.map((b, j) => <li key={j}>{b}</li>)}</ul>
          </div>
        ))}
      </div>
    );
  }
  if (tool === "summary") {
    return (
      <div>
        <p><strong>{(result.executiveSummary as string | undefined) ?? ""}</strong></p>
        <ul>{(result.keyPoints as string[] | undefined)?.map((k, i) => <li key={i}>{k}</li>)}</ul>
      </div>
    );
  }
  if (tool === "rewrite") {
    return (
      <div>
        <p style={{ whiteSpace: "pre-wrap" }}>{(result.rewritten as string | undefined) ?? ""}</p>
        <h4 style={{ fontSize: 13, marginTop: 8 }}>Changes</h4>
        <ul>{(result.changes as string[] | undefined)?.map((c, i) => <li key={i}>{c}</li>)}</ul>
      </div>
    );
  }
  if (tool === "seo_outline") {
    return (
      <div>
        <h4 style={{ fontSize: 13 }}>Title options</h4>
        <ul>{(result.titleOptions as string[] | undefined)?.map((t, i) => <li key={i}>{t}</li>)}</ul>
        <h4 style={{ fontSize: 13 }}>Primary keywords</h4>
        <ul>{(result.primaryKeywords as string[] | undefined)?.map((t, i) => <li key={i}>{t}</li>)}</ul>
        <h4 style={{ fontSize: 13 }}>Secondary keywords</h4>
        <ul>{(result.secondaryKeywords as string[] | undefined)?.map((t, i) => <li key={i}>{t}</li>)}</ul>
        <h4 style={{ fontSize: 13 }}>Outline</h4>
        {((result.outline as Array<{ heading: string; subpoints: string[] }> | undefined) ?? []).map((o, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <strong>{o.heading}</strong>
            <ul>{o.subpoints.map((s, j) => <li key={j}>{s}</li>)}</ul>
          </div>
        ))}
        <h4 style={{ fontSize: 13 }}>Meta description</h4>
        <p>{(result.metaDescription as string | undefined) ?? ""}</p>
        <div style={{ fontSize: 12, color: "var(--color-warning)", marginTop: 8 }}>Note: keyword metrics are not invented. If the model mentions search volume, it must be labeled as an estimate.</div>
      </div>
    );
  }
  if (tool === "audience_analysis") {
    return (
      <div>
        <h4 style={{ fontSize: 13 }}>Segments</h4>
        {((result.segments as Array<{ name: string; painPoints: string[]; channels: string[]; messagingAngle: string }> | undefined) ?? []).map((s, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <strong>{s.name}</strong>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Pain: {s.painPoints?.join("; ")}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Channels: {s.channels?.join("; ")}</div>
            <div style={{ fontSize: 12 }}>Angle: {s.messagingAngle}</div>
          </div>
        ))}
        <h4 style={{ fontSize: 13 }}>Objections</h4>
        <ul>{(result.objections as string[] | undefined)?.map((o, i) => <li key={i}>{o}</li>)}</ul>
        <h4 style={{ fontSize: 13 }}>Value props</h4>
        <ul>{(result.valueProps as string[] | undefined)?.map((v, i) => <li key={i}>{v}</li>)}</ul>
      </div>
    );
  }
  if (tool === "repurpose") {
    return (
      <div>
        {((result.variants as Array<{ platform: string; content: string }> | undefined) ?? []).map((v, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <strong>{v.platform}</strong>
            <p style={{ whiteSpace: "pre-wrap" }}>{v.content}</p>
          </div>
        ))}
      </div>
    );
  }
  if (tool === "youtube_outline") {
    return (
      <div>
        <h4 style={{ fontSize: 13 }}>Title options</h4>
        <ul>{(result.titleOptions as string[] | undefined)?.map((t, i) => <li key={i}>{t}</li>)}</ul>
        <h4 style={{ fontSize: 13 }}>Thumbnail concepts</h4>
        <ul>{(result.thumbnailConcepts as string[] | undefined)?.map((t, i) => <li key={i}>{t}</li>)}</ul>
        <h4 style={{ fontSize: 13 }}>Hook</h4>
        <p>{(result.hook as string | undefined) ?? ""}</p>
        <h4 style={{ fontSize: 13 }}>Sections</h4>
        {((result.sections as Array<{ label: string; beats: string[] }> | undefined) ?? []).map((s, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <strong>{s.label}</strong>
            <ul>{s.beats.map((b, j) => <li key={j}>{b}</li>)}</ul>
          </div>
        ))}
        <h4 style={{ fontSize: 13 }}>CTA</h4>
        <p>{(result.cta as string | undefined) ?? ""}</p>
      </div>
    );
  }
  return <pre style={{ fontSize: 12 }}>{JSON.stringify(result, null, 2)}</pre>;
}
