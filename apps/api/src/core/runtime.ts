import type { FastifyInstance } from "fastify";
import { BasisAuthClient } from "../authentication/basis-auth-client.js";
import { BackchannelService } from "../authentication/backchannel-service.js";
import { BearerAuthenticator } from "../authentication/bearer-authenticator.js";
import { LoginService } from "../authentication/login-service.js";
import type { AuthenticationServices } from "../authentication/services.js";
import { SessionService } from "../authentication/session-service.js";
import { TokenService } from "../authentication/token-service.js";
import { UserService } from "../authentication/user-service.js";
import { SmtpMailer, LoggingMailer, type Mailer } from "../infrastructure/email/mailer.js";
import { AuditLogger } from "../infrastructure/audit/audit-logger.js";
import { JobQueue } from "../infrastructure/jobs/job-queue.js";
import { LocalFileStorage } from "../infrastructure/storage/file-storage.js";
import { CapabilityRegistry } from "./capability-registry.js";
import type { CapabilityContext, Services } from "./capability.js";
import { SystemClock, type Clock } from "./clock.js";
import type { Logger } from "./logger.js";
import { capabilities } from "../capabilities/index.js";
import type { AppConfig } from "./configuration.js";
import { DatabaseConnection } from "../infrastructure/database/client.js";
import { OutboxPublisher } from "./outbox.js";
import { createBaseServer, configureServer } from "../http/server.js";
import type { NethackServer } from "../http/types.js";

export interface RuntimeOptions {
    readonly config: AppConfig;
    readonly clock?: Clock;
    readonly fetchImpl?: typeof fetch;
}

/**
 * Composition root. Dependencies are created once and passed explicitly to
 * capabilities; there is no global service locator and no runtime registration.
 */
export class NethackRuntime {
    readonly config: AppConfig;
    readonly clock: Clock;
    readonly app: NethackServer;
    readonly database: DatabaseConnection;
    readonly storage: LocalFileStorage;
    readonly events: OutboxPublisher;
    readonly jobs: JobQueue;
    readonly mailer: Mailer;
    readonly auth: AuthenticationServices;
    readonly audit: AuditLogger;
    readonly services: Services;
    readonly registry: CapabilityRegistry;
    readonly logger: Logger;
    private readonly loggerAdapter: Logger;
    private initialized = false;

    constructor(options: RuntimeOptions) {
        this.config = options.config;
        this.clock = options.clock ?? new SystemClock();
        const base = createBaseServer(this.config);
        this.app = base.app;
        this.loggerAdapter = base.logger;
        this.logger = base.logger;
        this.database = new DatabaseConnection(this.config.database, this.clock);
        this.storage = new LocalFileStorage(this.config.storage);
        this.events = new OutboxPublisher(this.database);
        this.jobs = new JobQueue(this.database);
        this.mailer =
            this.config.smtpUrl === null
                ? new LoggingMailer(this.loggerAdapter)
                : new SmtpMailer(this.config.smtpUrl, this.config.emailFrom);
        this.audit = new AuditLogger(this.config);

        const client = new BasisAuthClient(
            this.config.basisAuth,
            this.config.backchannelMaxTokenAgeSeconds,
            this.loggerAdapter,
        );
        const sessions = new SessionService(
            this.database,
            this.config,
            this.clock,
            this.loggerAdapter,
        );
        const users = new UserService(this.database, this.clock, this.loggerAdapter);
        const login = new LoginService(
            this.config,
            this.database,
            client,
            sessions,
            users,
            this.clock,
            this.loggerAdapter,
        );
        const tokens = new TokenService(
            this.database,
            this.config,
            client,
            this.clock,
            this.loggerAdapter,
        );
        const backchannel = new BackchannelService(
            this.config,
            this.database,
            client,
            sessions,
            this.clock,
            this.loggerAdapter,
            options.fetchImpl ?? fetch,
        );
        const bearer = new BearerAuthenticator(
            this.config,
            this.database,
            client,
            sessions,
            this.loggerAdapter,
        );
        this.auth = {
            client,
            sessions,
            users,
            login,
            tokens,
            backchannel,
            bearer,
        };

        this.services = {
            config: this.config,
            logger: this.loggerAdapter,
            clock: this.clock,
            database: this.database,
            events: this.events,
            jobs: this.jobs,
            storage: this.storage,
            mailer: this.mailer,
            auth: this.auth,
            audit: this.audit,
        };
        this.registry = new CapabilityRegistry(capabilities, this.services);
    }

    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }
        await this.storage.initialize();
        await this.registry.initialize();
        this.initialized = true;
    }

    async initializeHttp(): Promise<void> {
        await this.initialize();
        await configureServer(
            this.app,
            {
                config: this.config,
                logger: this.loggerAdapter,
                clock: this.clock,
                database: this.database,
                auth: this.auth,
            },
            this.registry,
        );
        await this.app.ready();
    }

    capabilityContext(): CapabilityContext {
        return {
            ...this.services,
            contracts: {
                get: <T>(name: string): T => this.registry.getContract<T>(name),
                has: (name: string) => this.registry.hasContract(name),
            },
        };
    }

    async listen(): Promise<void> {
        await this.initializeHttp();
        await this.app.listen({ host: this.config.host, port: this.config.port });
    }

    async close(): Promise<void> {
        await this.registry.shutdown();
        await this.app.close();
        await this.database.close();
    }

    fastify(): FastifyInstance {
        return this.app as unknown as FastifyInstance;
    }
}
