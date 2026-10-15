import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  PageHeader,
  TextArea,
  TextInput,
} from "../components/ui";
import type { Project } from "@abdo/shared";
import { Link } from "react-router-dom";

export function ProjectsPage() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const load = async () => {
    setError(null);
    try {
      const res = await api.get<{ projects: Project[] }>("/projects");
      setProjects(res.projects);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load projects.");
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post<{ project: Project }>("/projects", { name, description: description || undefined });
      setName("");
      setDescription("");
      setCreating(false);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create project.");
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm(t("common.delete") + "?")) return;
    try {
      await api.del(`/projects/${id}`);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete.");
    }
  };

  return (
    <>
      <PageHeader title={t("projects.title")} subtitle={t("projects.subtitle")} action={
        <Button onClick={() => setCreating((c) => !c)}>{creating ? t("common.cancel") : t("projects.newProject")}</Button>
      } />
      {error && <ErrorBox message={error} />}
      {creating && (
        <Card>
          <form onSubmit={onCreate}>
            <Field label={t("projects.nameLabel")}>
              <TextInput value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
            </Field>
            <Field label={t("projects.descriptionLabel")}>
              <TextArea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
            </Field>
            <Button type="submit">{t("common.create")}</Button>
          </form>
        </Card>
      )}
      {projects && projects.length === 0 && (
        <EmptyState title={t("common.empty")} body={t("projects.emptyHint")} />
      )}
      {projects && projects.length > 0 && (
        <Card>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {projects.map((p) => (
              <li key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>
                <div>
                  <Link to={`/projects/${p.id}`} style={{ fontWeight: 600 }}>{p.name}</Link>
                  {p.description && <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{p.description}</div>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Link to={`/projects/${p.id}`}><Button variant="ghost">{t("projects.openProject")}</Button></Link>
                  <Button variant="danger" onClick={() => onDelete(p.id)}>{t("common.delete")}</Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
