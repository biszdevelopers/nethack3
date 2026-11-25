import { identityCapability } from "./identity/index.js";
import { organizationsCapability } from "./organizations/index.js";
import { competitionsCapability } from "./competitions/index.js";
import { participantsCapability } from "./participants/index.js";
import { teamsCapability } from "./teams/index.js";
import { projectsCapability } from "./projects/index.js";
import { filesCapability } from "./files/index.js";
import { submissionsCapability } from "./submissions/index.js";
import { judgingCapability } from "./judging/index.js";
import { votingCapability } from "./voting/index.js";
import { announcementsCapability } from "./announcements/index.js";
import { notificationsCapability } from "./notifications/index.js";
import { administrationCapability } from "./administration/index.js";
import type { CapabilityDefinition } from "../core/capability.js";

export const capabilities = [
    identityCapability,
    organizationsCapability,
    competitionsCapability,
    participantsCapability,
    teamsCapability,
    projectsCapability,
    filesCapability,
    submissionsCapability,
    judgingCapability,
    votingCapability,
    announcementsCapability,
    notificationsCapability,
    administrationCapability,
] satisfies readonly CapabilityDefinition[];
