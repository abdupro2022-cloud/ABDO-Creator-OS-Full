import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import { Button, Card, ErrorBox, Field, PageHeader, TextArea } from "../components/ui";

interface DocRow { id: string; title: string; body: string; }

export function HelpPage() {
  const { t } = useTranslation();
  const [docs, setDocs] = useState<DocRow[] | null>(null);
  const [open, setOpen] = useState<DocRow | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ docs: DocRow[] }>("/help/docs");
        setDocs(res.docs);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load docs.");
      }
    })();
  }, []);

  const onAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    setAnswer(null);
    try {
      const res = await api.post<{ answer: string; usage: unknown }>("/help/ask", { question });
      setAnswer(res.answer);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ask failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={t("help.title")} subtitle={t("help.subtitle")} />
      {error && <ErrorBox message={error} />}
      <Card title="Ask the help assistant">
        <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{t("help.assistantScope")}</p>
        <form onSubmit={onAsk}>
          <Field label="Question"><TextArea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} required maxLength={2000} /></Field>
          <Button type="submit" disabled={busy || !question.trim()}>{busy ? t("common.loading") : t("help.ask")}</Button>
        </form>
        {answer && (
          <div style={{ marginTop: 12, padding: 12, background: "var(--color-surface-2)", borderRadius: 6 }}>
            <h3 style={{ fontSize: 14, margin: 0 }}>Answer</h3>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, margin: 0 }}>{answer}</pre>
          </div>
        )}
      </Card>
      <Card title="Documentation">
        {docs && docs.map((d) => (
          <div key={d.id} style={{ marginBottom: 10 }}>
            <Button variant="ghost" onClick={async () => {
              try {
                const res = await api.get<{ doc: DocRow }>(`/help/docs/${d.id}`);
                setOpen(res.doc);
              } catch (err) {
                setError(err instanceof ApiError ? err.message : "Failed.");
              }
            }}>{d.title}</Button>
            {open?.id === d.id && (
              <div style={{ marginTop: 6, padding: 12, background: "var(--color-surface-2)", borderRadius: 6 }}>
                {open.body}
              </div>
            )}
          </div>
        ))}
      </Card>
    </>
  );
}
