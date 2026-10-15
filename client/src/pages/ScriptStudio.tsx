import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, Field, PageHeader, TextArea } from "../components/ui";

/**
 * Script Studio — Phase 1 ships the editor + localStorage persistence.
 * Phase 3 will integrate it with the Projects data model and AI-assisted
 * review (hook scoring, audience engagement, factual claim flagging).
 */
export function ScriptStudioPage() {
  const { t } = useTranslation();
  const [hook, setHook] = useState(localStorage.getItem("abdo.script.hook") ?? "");
  const [body, setBody] = useState(localStorage.getItem("abdo.script.body") ?? "");
  const [outro, setOutro] = useState(localStorage.getItem("abdo.script.outro") ?? "");
  const [saved, setSaved] = useState(false);

  const onSave = () => {
    localStorage.setItem("abdo.script.hook", hook);
    localStorage.setItem("abdo.script.body", body);
    localStorage.setItem("abdo.script.outro", outro);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <PageHeader title={t("scripts.title")} subtitle={t("scripts.subtitle")} action={
        <Button onClick={onSave}>{t("scripts.save")}</Button>
      } />
      {saved && <div role="status" style={{ padding: 10, background: "#ecfdf5", color: "var(--color-success)", borderRadius: 6, marginBottom: 12 }}>{t("scripts.saved")}</div>}
      <Card>
        <Field label={t("scripts.hookLabel")}><TextArea value={hook} onChange={(e) => setHook(e.target.value)} /></Field>
        <Field label={t("scripts.bodyLabel")}><TextArea value={body} onChange={(e) => setBody(e.target.value)} rows={10} /></Field>
        <Field label={t("scripts.outroLabel")}><TextArea value={outro} onChange={(e) => setOutro(e.target.value)} /></Field>
        <div style={{ fontSize: 12, color: "var(--color-text-faint)" }}>{t("scripts.tip")}</div>
      </Card>
    </>
  );
}
