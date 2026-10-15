import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import { Button, Card, EmptyState, ErrorBox, Field, PageHeader, Select, TextArea, TextInput } from "../components/ui";
import type { SkillDefinition } from "@abdo/shared";

interface PublishRow {
  id: string;
  skillId: string;
  publisherId: string;
  title: string;
  description: string;
  state: "draft" | "pending_review" | "published" | "rejected" | "removed";
  moderatorId: string | null;
  moderationNotes: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export function CommunityPage() {
  const { t } = useTranslation();
  const [skills, setSkills] = useState<SkillDefinition[] | null>(null);
  const [mine, setMine] = useState<PublishRow[] | null>(null);
  const [browse, setBrowse] = useState<PublishRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [skillId, setSkillId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const load = async () => {
    setError(null);
    try {
      const [s, m, b] = await Promise.all([
        api.get<{ skills: SkillDefinition[] }>("/skills"),
        api.get<{ publishes: PublishRow[] }>("/community/mine"),
        api.get<{ publishes: PublishRow[] }>("/community/publishes?state=published"),
      ]);
      setSkills(s.skills.filter((x) => !x.builtIn));
      setMine(m.publishes);
      setBrowse(b.publishes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load.");
    }
  };
  useEffect(() => { void load(); }, []);

  const onPublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      await api.post("/community/publishes", { skillId, title, description });
      setSkillId(""); setTitle(""); setDescription("");
      setInfo("Submitted for review.");
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Publish failed.");
    }
  };

  return (
    <>
      <PageHeader title={t("community.title")} subtitle={t("community.subtitle")} />
      {error && <ErrorBox message={error} />}
      {info && <div role="status" style={{ padding: 10, background: "#ecfdf5", color: "var(--color-success)", borderRadius: 6, marginBottom: 12 }}>{info}</div>}
      <Card title="Publish a Skill">
        {skills && skills.length === 0 && <EmptyState title="You don't own any Skills yet." body="Create one in the Skills page first." />}
        {skills && skills.length > 0 && (
          <form onSubmit={onPublish}>
            <Field label="Skill">
              <Select value={skillId} onChange={(e) => setSkillId(e.target.value)} required>
                <option value="">—</option>
                {skills.map((s) => <option key={s.id} value={s.id}>{s.name} (v{s.version})</option>)}
              </Select>
            </Field>
            <Field label="Title"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} /></Field>
            <Field label="Description"><TextArea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} /></Field>
            <Button type="submit">{t("common.submit")}</Button>
          </form>
        )}
      </Card>
      <Card title="Your submissions">
        {mine && mine.length === 0 && <EmptyState title={t("common.empty")} />}
        {mine && mine.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {mine.map((p) => <li key={p.id} style={{ padding: 10, border: "1px solid var(--color-border)", borderRadius: 6, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{p.title}</div>
                  <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{p.description}</div>
                  {p.moderationNotes && <div style={{ fontSize: 12, color: "var(--color-text-faint)", marginTop: 4 }}>Moderator: {p.moderationNotes}</div>}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-text-faint)" }}>{p.state}</div>
              </div>
            </li>)}
          </ul>
        )}
      </Card>
      <Card title="Published">
        {browse && browse.length === 0 && <EmptyState title={t("common.empty")} />}
        {browse && browse.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {browse.map((p) => <li key={p.id} style={{ padding: 10, border: "1px solid var(--color-border)", borderRadius: 6, marginBottom: 8 }}>
              <div style={{ fontWeight: 600 }}>{p.title}</div>
              <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{p.description}</div>
            </li>)}
          </ul>
        )}
      </Card>
    </>
  );
}
