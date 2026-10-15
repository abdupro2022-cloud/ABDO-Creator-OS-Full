import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import { Button, Card, EmptyState, ErrorBox, Field, PageHeader, TextArea, TextInput } from "../components/ui";

interface Script {
  id: string;
  ownerId: string;
  projectId: string | null;
  title: string;
  hook: string;
  body: string;
  outro: string;
  createdAt: string;
  updatedAt: string;
}

export function ScriptsPage() {
  const { t } = useTranslation();
  const [scripts, setScripts] = useState<Script[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState<Script | null>(null);
  const [hook, setHook] = useState("");
  const [body, setBody] = useState("");
  const [outro, setOutro] = useState("");
  const [info, setInfo] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const res = await api.get<{ scripts: Script[] }>("/scripts");
      setScripts(res.scripts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load.");
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.post<{ script: Script }>("/scripts", { title });
      setOpen(res.script);
      setHook(res.script.hook);
      setBody(res.script.body);
      setOutro(res.script.outro);
      setCreating(false);
      setTitle("");
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create.");
    }
  };

  const onOpen = async (id: string) => {
    try {
      const res = await api.get<{ script: Script }>(`/scripts/${id}`);
      setOpen(res.script);
      setHook(res.script.hook);
      setBody(res.script.body);
      setOutro(res.script.outro);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to open.");
    }
  };

  const onSave = async () => {
    if (!open) return;
    setError(null);
    setInfo(null);
    try {
      const res = await api.patch<{ script: Script }>(`/scripts/${open.id}`, { title: open.title, hook, body, outro });
      setOpen(res.script);
      setInfo("Saved.");
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed.");
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete?")) return;
    try {
      await api.del(`/scripts/${id}`);
      if (open?.id === id) setOpen(null);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed.");
    }
  };

  return (
    <>
      <PageHeader title={t("scripts.title")} subtitle={t("scripts.subtitle")} action={
        <Button onClick={() => setCreating((c) => !c)}>{creating ? t("common.cancel") : t("scripts.newScript")}</Button>
      } />
      {error && <ErrorBox message={error} />}
      {info && <div role="status" style={{ padding: 10, background: "#ecfdf5", color: "var(--color-success)", borderRadius: 6, marginBottom: 12 }}>{info}</div>}
      {creating && (
        <Card>
          <form onSubmit={onCreate}>
            <Field label="Title"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} /></Field>
            <Button type="submit">{t("common.create")}</Button>
          </form>
        </Card>
      )}
      <Card title="Your scripts">
        {scripts && scripts.length === 0 && <EmptyState title={t("common.empty")} />}
        {scripts && scripts.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {scripts.map((s) => (
              <li key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 10, border: "1px solid var(--color-border)", borderRadius: 6, marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-faint)" }}>updated {new Date(s.updatedAt).toLocaleString()}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Button variant="ghost" onClick={() => onOpen(s.id)}>Open</Button>
                  <Button variant="danger" onClick={() => onDelete(s.id)}>{t("common.delete")}</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {open && (
        <Card title={open.title} action={<Button onClick={onSave}>{t("common.save")}</Button>}>
          <Field label={t("scripts.hookLabel")}><TextArea value={hook} onChange={(e) => setHook(e.target.value)} rows={3} /></Field>
          <Field label={t("scripts.bodyLabel")}><TextArea value={body} onChange={(e) => setBody(e.target.value)} rows={12} /></Field>
          <Field label={t("scripts.outroLabel")}><TextArea value={outro} onChange={(e) => setOutro(e.target.value)} rows={3} /></Field>
        </Card>
      )}
    </>
  );
}
