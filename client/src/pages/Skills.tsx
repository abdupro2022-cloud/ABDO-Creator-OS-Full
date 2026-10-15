import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import { Button, Card, EmptyState, ErrorBox, Field, PageHeader, TextArea, TextInput } from "../components/ui";
import type { SkillDefinition } from "@abdo/shared";

export function SkillsPage() {
  const { t } = useTranslation();
  const [skills, setSkills] = useState<SkillDefinition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [category, setCategory] = useState("utility");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const res = await api.get<{ skills: SkillDefinition[] }>("/skills");
      setSkills(res.skills);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load skills.");
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await api.post("/skills", {
        name,
        version,
        category,
        description,
        systemPrompt,
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        requiredCapabilities: ["text"],
        permissions: ["read:own_projects"],
        allowedTools: ["providers.chat"],
        executable: false,
      });
      setCreating(false);
      setName(""); setDescription(""); setSystemPrompt(""); setVersion("1.0.0"); setCategory("utility");
      setInfo("Skill created.");
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create skill.");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (s: SkillDefinition) => {
    if (!confirm(t("skills.deleteSkillConfirm"))) return;
    try {
      await api.del(`/skills/${s.id}`);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed.");
    }
  };

  const builtIn = skills?.filter((s) => s.builtIn) ?? [];
  const yours = skills?.filter((s) => !s.builtIn) ?? [];

  return (
    <>
      <PageHeader title={t("skills.title")} subtitle={t("skills.subtitle")} action={
        <Button onClick={() => setCreating((c) => !c)}>{creating ? t("common.cancel") : t("skills.newSkill")}</Button>
      } />
      {error && <ErrorBox message={error} />}
      {info && <div role="status" style={{ padding: 10, borderRadius: 6, background: "#ecfdf5", color: "var(--color-success)", marginBottom: 12 }}>{info}</div>}
      {creating && (
        <Card title={t("skills.newSkill")}>
          <form onSubmit={onCreate}>
            <Field label="Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} /></Field>
            <Field label={t("skills.version")}><TextInput value={version} onChange={(e) => setVersion(e.target.value)} required pattern="\d+\.\d+\.\d+" /></Field>
            <Field label={t("skills.category")}><TextInput value={category} onChange={(e) => setCategory(e.target.value)} required maxLength={60} /></Field>
            <Field label={t("skills.description")}><TextInput value={description} onChange={(e) => setDescription(e.target.value)} required maxLength={2000} /></Field>
            <Field label={t("skills.systemPrompt")} hint="Declarative instructions only. No code blocks or shell patterns — the server will reject those.">
              <TextArea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} required maxLength={20000} />
            </Field>
            <Button type="submit" disabled={busy}>{t("common.save")}</Button>
          </form>
        </Card>
      )}
      <Card title={t("skills.builtIn")}>
        {builtIn.length === 0 && <EmptyState title={t("common.empty")} />}
        {builtIn.length > 0 && builtIn.map((s) => (
          <div key={s.id} style={{ padding: 10, border: "1px solid var(--color-border)", borderRadius: 6, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{s.name} <span style={{ color: "var(--color-text-faint)", fontSize: 13 }}>v{s.version} · {s.category}</span></div>
                <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{s.description}</div>
              </div>
            </div>
          </div>
        ))}
      </Card>
      <Card title={t("skills.yours")}>
        {yours.length === 0 && <EmptyState title={t("common.empty")} />}
        {yours.length > 0 && yours.map((s) => (
          <div key={s.id} style={{ padding: 10, border: "1px solid var(--color-border)", borderRadius: 6, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{s.name} <span style={{ color: "var(--color-text-faint)", fontSize: 13 }}>v{s.version} · {s.category}</span></div>
              <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{s.description}</div>
            </div>
            <Button variant="danger" onClick={() => onDelete(s)}>{t("common.delete")}</Button>
          </div>
        ))}
      </Card>
    </>
  );
}
