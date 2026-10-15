import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { SignInPage } from "./pages/SignIn";
import { SignUpPage } from "./pages/SignUp";
import { HomePage } from "./pages/Home";
import { AssistantPage } from "./pages/Assistant";
import { ProjectsPage } from "./pages/Projects";
import { ProjectDetailPage } from "./pages/ProjectDetail";
import { ProvidersPage } from "./pages/Providers";
import { SkillsPage } from "./pages/Skills";
import { ResearchPage } from "./pages/Research";
import { ScriptStudioPage } from "./pages/ScriptStudio";
import { SettingsPage } from "./pages/Settings";
import { UsagePage } from "./pages/Usage";
import { WorkflowsPage } from "./pages/Workflows";
import { ScriptsPage } from "./pages/Scripts";
import { ToolsPage } from "./pages/Tools";
import { CommunityPage } from "./pages/Community";
import { HelpPage } from "./pages/Help";
import { PasswordResetPage } from "./pages/PasswordReset";
import { YoutubePage } from "./pages/Youtube";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/reset-password" element={<PasswordResetPage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/workflows" element={<WorkflowsPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/research" element={<ResearchPage />} />
        <Route path="/youtube" element={<YoutubePage />} />
        <Route path="/script-studio" element={<ScriptStudioPage />} />
        <Route path="/scripts" element={<ScriptsPage />} />
        <Route path="/tools" element={<ToolsPage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/usage" element={<UsagePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
