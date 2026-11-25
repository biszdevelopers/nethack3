import { createBrowserRouter } from "react-router";
import { RequireAuth } from "./auth-guard.js";
import { AppShell } from "./app-shell.js";
import { SignInPage } from "../pages/sign-in-page.js";
import { AuthErrorPage } from "../pages/auth-error-page.js";
import { NotFoundPage } from "../pages/not-found-page.js";
import { DashboardPage } from "../pages/dashboard-page.js";
import { CompetitionsPage } from "../pages/competitions-page.js";
import { TeamsPage } from "../pages/teams-page.js";
import { ProjectsPage } from "../pages/projects-page.js";
import { SubmissionsPage } from "../pages/submissions-page.js";
import { JudgingPage } from "../pages/judging-page.js";
import { VotingPage } from "../pages/voting-page.js";
import { OrganizationPage } from "../pages/organization-page.js";
import { NotificationsPage } from "../pages/notifications-page.js";
import { SettingsPage } from "../pages/settings-page.js";

export const router = createBrowserRouter([
    { path: "/sign-in", element: <SignInPage /> },
    { path: "/auth/error", element: <AuthErrorPage /> },
    {
        element: <RequireAuth />,
        children: [
            {
                element: <AppShell />,
                children: [
                    { index: true, element: <DashboardPage /> },
                    { path: "competitions", element: <CompetitionsPage /> },
                    { path: "teams", element: <TeamsPage /> },
                    { path: "projects", element: <ProjectsPage /> },
                    { path: "submissions", element: <SubmissionsPage /> },
                    { path: "judging", element: <JudgingPage /> },
                    { path: "voting", element: <VotingPage /> },
                    { path: "organization", element: <OrganizationPage /> },
                    { path: "notifications", element: <NotificationsPage /> },
                    { path: "settings", element: <SettingsPage /> },
                ],
            },
        ],
    },
    { path: "*", element: <NotFoundPage /> },
]);
