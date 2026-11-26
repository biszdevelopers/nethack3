import { createBrowserRouter } from "react-router";
import { RequireAuth } from "./auth-guard.js";
import { AppShell } from "./app-shell.js";
import { AuthErrorPage } from "../pages/auth-error-page.js";
import { NotFoundPage } from "../pages/not-found-page.js";
import { SignInPage } from "../pages/sign-in-page.js";

export const router = createBrowserRouter([
    { path: "/sign-in", element: <SignInPage /> },
    { path: "/auth/error", element: <AuthErrorPage /> },
    {
        element: <RequireAuth />,
        children: [
            {
                element: <AppShell />,
                children: [
                    {
                        index: true,
                        lazy: async () => {
                            const { DashboardPage } = await import("../pages/dashboard-page.js");
                            return { Component: DashboardPage };
                        },
                    },
                    {
                        path: "competitions",
                        lazy: async () => {
                            const { CompetitionsPage } = await import("../pages/competitions-page.js");
                            return { Component: CompetitionsPage };
                        },
                    },
                    {
                        path: "competitions/manage",
                        lazy: async () => {
                            const { CompetitionAdminPage } = await import(
                                "../capabilities/competitions/pages/competition-admin-page.js"
                            );
                            return { Component: CompetitionAdminPage };
                        },
                    },
                    {
                        path: "competitions/:editionId",
                        lazy: async () => {
                            const { CompetitionDetailPage } = await import(
                                "../capabilities/competitions/pages/competition-detail-page.js"
                            );
                            return { Component: CompetitionDetailPage };
                        },
                    },
                    {
                        path: "teams",
                        lazy: async () => {
                            const { TeamsPage } = await import("../pages/teams-page.js");
                            return { Component: TeamsPage };
                        },
                    },
                    {
                        path: "teams/:teamId",
                        lazy: async () => {
                            const { TeamDetailPage } = await import(
                                "../capabilities/teams/pages/team-detail-page.js"
                            );
                            return { Component: TeamDetailPage };
                        },
                    },
                    {
                        path: "projects",
                        lazy: async () => {
                            const { ProjectsPage } = await import("../pages/projects-page.js");
                            return { Component: ProjectsPage };
                        },
                    },
                    {
                        path: "projects/:projectId",
                        lazy: async () => {
                            const { ProjectDetailPage } = await import(
                                "../capabilities/projects/pages/project-detail-page.js"
                            );
                            return { Component: ProjectDetailPage };
                        },
                    },
                    {
                        path: "submissions",
                        lazy: async () => {
                            const { SubmissionsPage } = await import("../pages/submissions-page.js");
                            return { Component: SubmissionsPage };
                        },
                    },
                    {
                        path: "submissions/:submissionId",
                        lazy: async () => {
                            const { SubmissionDetailPage } = await import(
                                "../capabilities/submissions/pages/submission-detail-page.js"
                            );
                            return { Component: SubmissionDetailPage };
                        },
                    },
                    {
                        path: "judging",
                        lazy: async () => {
                            const { JudgingPage } = await import("../pages/judging-page.js");
                            return { Component: JudgingPage };
                        },
                    },
                    {
                        path: "judging/assignments/:assignmentId",
                        lazy: async () => {
                            const { AssignmentDetailPage } = await import(
                                "../capabilities/judging/pages/assignment-detail-page.js"
                            );
                            return { Component: AssignmentDetailPage };
                        },
                    },
                    {
                        path: "voting",
                        lazy: async () => {
                            const { VotingPage } = await import("../pages/voting-page.js");
                            return { Component: VotingPage };
                        },
                    },
                    {
                        path: "organization",
                        lazy: async () => {
                            const { OrganizationPage } = await import("../pages/organization-page.js");
                            return { Component: OrganizationPage };
                        },
                    },
                    {
                        path: "notifications",
                        lazy: async () => {
                            const { NotificationsPage } = await import("../pages/notifications-page.js");
                            return { Component: NotificationsPage };
                        },
                    },
                    {
                        path: "settings",
                        lazy: async () => {
                            const { SettingsPage } = await import("../pages/settings-page.js");
                            return { Component: SettingsPage };
                        },
                    },
                    {
                        path: "admin",
                        lazy: async () => {
                            const { AdminPage } = await import("../pages/admin-page.js");
                            return { Component: AdminPage };
                        },
                    },
                    ...(import.meta.env.DEV
                        ? [
                              {
                                  path: "lab",
                                  lazy: async () => {
                                      const { LabPage } = await import("../pages/lab-page.js");
                                      return { Component: LabPage };
                                  },
                              },
                          ]
                        : []),
                ],
            },
        ],
    },
    { path: "*", element: <NotFoundPage /> },
]);
