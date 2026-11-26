import type { FastifyInstance } from "fastify";
import type {
    CapabilityContext,
    CapabilityDefinition,
    CapabilityInstance,
    ContractAccess,
    EventSubscription,
    InitializedCapability,
    JobSubscription,
    Services,
} from "./capability.js";
import { resolveCapabilityOrder } from "./dependency-resolver.js";
import { InternalError } from "./errors.js";

export class CapabilityRegistry {
    private readonly definitions: readonly CapabilityDefinition[];
    private readonly services: Services;
    private readonly instances = new Map<string, CapabilityInstance>();
    private readonly contracts = new Map<string, unknown>();
    private readonly eventSubscriptions: EventSubscription[] = [];
    private readonly jobHandlers = new Map<string, JobSubscription["handle"]>();
    private initialized = false;

    constructor(definitions: readonly CapabilityDefinition[], services: Services) {
        this.definitions = definitions;
        this.services = services;
    }

    async initialize(): Promise<void> {
        if (this.initialized) {
            throw new InternalError("The capability registry is already initialized.");
        }
        const order = resolveCapabilityOrder(
            this.definitions.map((definition) => ({
                id: definition.id,
                dependencies: definition.dependencies,
            })),
        );
        const byId = new Map(this.definitions.map((definition) => [definition.id, definition]));

        const access: ContractAccess = {
            get: <T>(name: string): T => {
                if (!this.contracts.has(name)) {
                    throw new InternalError(`Capability contract "${name}" is not registered.`);
                }
                return this.contracts.get(name) as T;
            },
            has: (name: string) => this.contracts.has(name),
        };

        const context: CapabilityContext = { ...this.services, contracts: access };

        for (const id of order) {
            const definition = byId.get(id);
            if (definition === undefined) {
                throw new InternalError(`Resolved capability "${id}" is not registered.`);
            }
            const instance = await definition.register(context);
            for (const name of Object.keys(instance.contracts ?? {})) {
                if (this.contracts.has(name)) {
                    throw new InternalError(`Duplicate capability contract "${name}".`);
                }
            }
            for (const [name, contract] of Object.entries(instance.contracts ?? {})) {
                this.contracts.set(name, contract);
            }
            this.eventSubscriptions.push(...(instance.events ?? []));
            for (const job of instance.jobs ?? []) {
                if (this.jobHandlers.has(job.kind)) {
                    throw new InternalError(`Duplicate job handler for "${job.kind}".`);
                }
                this.jobHandlers.set(job.kind, job.handle);
            }
            this.instances.set(id, instance);
        }

        this.initialized = true;
    }

    async registerRoutes(app: FastifyInstance): Promise<void> {
        if (!this.initialized) {
            throw new InternalError(
                "Capabilities must be initialized before routes are registered.",
            );
        }
        const context: CapabilityContext = {
            ...this.services,
            contracts: {
                get: <T>(name: string): T => this.contracts.get(name) as T,
                has: (name: string) => this.contracts.has(name),
            },
        };
        for (const definition of this.definitions) {
            const instance = this.instances.get(definition.id);
            if (instance?.registerRoutes !== undefined) {
                await instance.registerRoutes(app, context);
            }
        }
    }

    list(): readonly InitializedCapability[] {
        return this.definitions
            .map((definition) => {
                const instance = this.instances.get(definition.id);
                return instance === undefined ? null : { definition, instance };
            })
            .filter((entry): entry is InitializedCapability => entry !== null);
    }

    getEventSubscriptions(): readonly EventSubscription[] {
        return this.eventSubscriptions;
    }

    getJobHandler(kind: string): JobSubscription["handle"] | undefined {
        return this.jobHandlers.get(kind);
    }

    hasContract(name: string): boolean {
        return this.contracts.has(name);
    }

    getContract<T>(name: string): T {
        if (!this.contracts.has(name)) {
            throw new InternalError(`Capability contract "${name}" is not registered.`);
        }
        return this.contracts.get(name) as T;
    }

    async shutdown(): Promise<void> {
        const order = [...this.instances.keys()].reverse();
        for (const id of order) {
            await this.instances.get(id)?.shutdown?.();
        }
        this.instances.clear();
        this.contracts.clear();
    }
}
