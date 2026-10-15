import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import { Button, Card, ErrorBox, PageHeader, TextArea, TextInput } from "../components/ui";
import type { Project } from "@abdo/shared";

export function ProjectDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await api.get<{ project: Project }>(`/projects/${id}`);
        setProject(res.project);
        setName(res.project.name);
        setDescription(res.project.description ?? "");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load.");
      }
    })();
  }, [id]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      const res = await api.patch<{ project: Project }>(`/projects/${id}`, { name, description: description || undefined });
      setProject(res.project);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (error) return <><PageHeader title="Project" /><ErrorBox message={error} /></>;
  if (!project) return <p>{t("common.loading")}</p>;

  return (
    <>
      <PageHeader title={project.name} action={<Button variant="ghost" onClick={() => navigate("/projects")}>{t("common.back")}</Button>} />
      <Card>
        <form onSubmit={onSave}>
          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--color-text-muted)", fontWeight: 600 }}>Name</span>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--color-text-muted)", fontWeight: 600 }}>Description</span>
            <TextArea value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <Button type="submit" disabled={saving}>{t("common.save")}</Button>
        </form>
      </Card>
    </>
  );
}
