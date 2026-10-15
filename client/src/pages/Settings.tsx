import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import { Button, Card, ErrorBox, Field, PageHeader, TextArea, TextInput } from "../components/ui";

interface Memory { id: string; text: string; createdAt: string; }

export function SettingsPage() {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<string>("{}");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [newMemory, setNewMemory] = useState("");
  const [user, setUser] = useState<{ id: string; email: string; displayName: string | null; role: "user" | "admin" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.get<{ user: { id: string; email: string; displayName: string | null; role: "user" | "admin" } }>("/auth/me");
        setUser(me.user);
        const prefs = await api.get<{ preferences: Record<string, unknown>; memories: Memory[] }>("/preferences");
        setPreferences(JSON.stringify(prefs.preferences, null, 2));
        setMemories(prefs.memories);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load.");
      }
    })();
  }, []);

  const save = async () => {
    setError(null); setInfo(null);
    let prefs: unknown;
    try { prefs = JSON.parse(preferences); } catch {
      setError("Preferences must be valid JSON.");
      return;
    }
    try {
      await api.put("/preferences", { preferences: prefs as Record<string, unknown>, memories });
      setInfo("Saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed.");
    }
  };

  const addMemory = () => {
    if (!newMemory.trim()) return;
    setMemories((m) => [...m, { id: `m-${Date.now()}`, text: newMemory.trim(), createdAt: new Date().toISOString() }]);
    setNewMemory("");
  };

  const removeMemory = (id: string) => setMemories((m) => m.filter((x) => x.id !== id));

  return (
    <>
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />
      {error && <ErrorBox message={error} />}
      {info && <div role="status" style={{ padding: 10, background: "#ecfdf5", color: "var(--color-success)", borderRadius: 6, marginBottom: 12 }}>{info}</div>}
      <Card title={t("settings.account")}>
        {user && (
          <div>
            <div><strong>{user.email}</strong> {user.displayName ? `(${user.displayName})` : ""}</div>
            <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Role: {user.role}</div>
          </div>
        )}
      </Card>
      <Card title={t("settings.preferences")}>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{t("settings.preferencesHint")}</p>
        <Field label="JSON">
          <TextArea value={preferences} onChange={(e) => setPreferences(e.target.value)} rows={6} style={{ fontFamily: "monospace" }} />
        </Field>
      </Card>
      <Card title={t("settings.memories")}>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{t("settings.memoryHint")}</p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {memories.map((m) => (
            <li key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 6, borderBottom: "1px solid var(--color-border)" }}>
              <span>{m.text}</span>
              <Button variant="danger" onClick={() => removeMemory(m.id)}>{t("common.delete")}</Button>
            </li>
          ))}
        </ul>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <TextInput value={newMemory} onChange={(e) => setNewMemory(e.target.value)} placeholder="e.g. I write in British English" />
          <Button onClick={addMemory}>{t("settings.addMemory")}</Button>
        </div>
      </Card>
      <Button onClick={save}>{t("settings.savePreferences")}</Button>
    </>
  );
}
