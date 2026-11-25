import type { FastifyInstance } from "fastify";
import type { NethackServer } from "../http/types.js";
import type { Clock } from "./clock.js";
import type { AppConfig } from "./configuration.js";
import type { Logger } from "./logger.js";
import type { DatabaseConnection, DatabaseSession } from "../infrastructure/database/client.js";
import type { Mailer } from "../infrastructure/email/mailer.js";
import type { FileStorage } from "../infrastructure/storage/file-storage.js";
import type { JobQueue } from "../infrastructure/jobs/job-queue.js";
import type { AuthenticationServices } from "../authentication/services.js";
import type { OutboxPublisher } from "./outbox.js";

export interface Services {
    readonly config: AppConfig;
    readonly logger: Logger;
    readonly clock: Clock;
    readonly database: DatabaseConnection;
    readonly events: OutboxPublisher;
    readonly jobs: JobQueue;
    readonly storage: FileStorage;
    readonly mailer: Mailer;
    readonly auth: AuthenticationServices;
}

export interface ContractAccess {
    get<T>(name: string): T;
    has(name: string): boolean;
}

export interface CapabilityContext extends Services {
    readonly contracts: ContractAccess;
}

export interface EventSubscription {
    readonly eventType: string;
    readonly handle: (payload: Record<string, unknown>, session: DatabaseSession) => Promise<void>;
}

export interface JobSubscription {
    readonly kind: string;
    readonly handle: (payload: Record<string, unknown>, session: DatabaseSession) => Promise<void>;
}

export interface CapabilityInstance {
    readonly contracts?: Readonly<Record<string, unknown>>;
    readonly registerRoutes?: (app: NethackServer, context: CapabilityContext) => Promise<void>;
    readonly events?: readonly EventSubscription[];
    readonly jobs?: readonly JobSubscription[];
    readonly shutdown?: () => Promise<void>;
}

export interface CapabilityDefinition {
    readonly id: string;
    readonly version: string;
    readonly dependencies: readonly string[];
    readonly register: (context: CapabilityContext) => Promise<CapabilityInstance>;
}

export interface InitializedCapability {
    readonly definition: CapabilityDefinition;
    readonly instance: CapabilityInstance;
}
