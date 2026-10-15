import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import { Button, Card, ErrorBox, Field, PageHeader, TextArea, TextInput } from "../components/ui";

interface OembedResult {
  videoId: string;
  title: string;
  authorName: string;
  authorUrl: string;
  thumbnailUrl: string;
  provider: string;
}

export function YoutubePage() {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [info, setInfo] = useState<OembedResult | null>(null);
  const [transcript, setTranscript] = useState("");
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setInfo(null);
    setBusy(true);
    try {
      const res = await api.post<OembedResult>("/youtube/oembed", { url });
      setInfo(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Fetch failed.");
    } finally { setBusy(false); }
  };

  const onAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info) return;
    setError(null); setAnalysis(null);
    setBusy(true);
    try {
      const res = await api.post<{ analysis: string; usage: unknown }>("/youtube/transcript", { videoId: info.videoId, transcript });
      setAnalysis(res.analysis);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Analyze failed.");
    } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="YouTube" subtitle="Look up video/channel info via YouTube oEmbed (no key required) and analyze a transcript with your configured LLM." />
      {error && <ErrorBox message={error} />}
      <Card>
        <form onSubmit={onFetch}>
          <Field label="YouTube URL or video id">
            <TextInput value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://www.youtube.com/watch?v=..." />
          </Field>
          <Button type="submit" disabled={busy}>Fetch</Button>
        </form>
      </Card>
      {info && (
        <Card title={info.title}>
          <div style={{ display: "flex", gap: 16 }}>
            <img src={info.thumbnailUrl} alt="" style={{ width: 240, borderRadius: 6 }} />
            <div>
              <div>by <a href={info.authorUrl} target="_blank" rel="noreferrer">{info.authorName}</a></div>
              <div style={{ fontSize: 12, color: "var(--color-text-faint)" }}>video id: {info.videoId}</div>
            </div>
          </div>
          <form onSubmit={onAnalyze} style={{ marginTop: 16 }}>
            <Field label="Paste transcript" hint="Live transcript retrieval is not available; you can paste one you already have.">
              <TextArea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={8} minLength={20} required maxLength={200000} />
            </Field>
            <Button type="submit" disabled={busy || transcript.length < 20}>Analyze</Button>
          </form>
          {analysis && (
            <div style={{ marginTop: 12 }}>
              <h3 style={{ fontSize: 14 }}>Analysis</h3>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{analysis}</pre>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
