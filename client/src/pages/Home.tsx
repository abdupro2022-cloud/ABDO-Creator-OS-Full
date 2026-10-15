import { useTranslation } from "react-i18next";
import { Card, PageHeader } from "../components/ui";
import { Link } from "react-router-dom";

export function HomePage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t("home.title")} subtitle={t("home.subtitle")} />
      <Card title={t("home.quickStart")}>
        <ol style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.9 }}>
          <li><Link to="/providers">{t("home.stepProviders")}</Link></li>
          <li><Link to="/assistant">{t("home.stepAssistant")}</Link></li>
          <li><Link to="/skills">{t("home.stepSkills")}</Link></li>
        </ol>
      </Card>
    </>
  );
}
