import {
    AnnouncementsApi,
    CompetitionsApi,
    FilesApi,
    NotificationsApi,
    ParticipantsApi,
    ProjectsApi,
    SubmissionsApi,
    TeamsApi,
} from "@nethack/api-client";
import { apiClient } from "./api.js";

export const resources = {
    competitions: new CompetitionsApi(apiClient),
    participants: new ParticipantsApi(apiClient),
    teams: new TeamsApi(apiClient),
    projects: new ProjectsApi(apiClient),
    files: new FilesApi(apiClient),
    submissions: new SubmissionsApi(apiClient),
    announcements: new AnnouncementsApi(apiClient),
    notifications: new NotificationsApi(apiClient),
};
