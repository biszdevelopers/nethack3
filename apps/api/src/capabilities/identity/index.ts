import type { CapabilityDefinition } from "../../core/capability.js";
import { registerIdentityRoutes } from "./http/identity-routes.js";

export const identityCapability: CapabilityDefinition = {
    id: "identity",
    version: "1.0.0",
    dependencies: [],
    async register(context) {
        return {
            registerRoutes: async (app) => {
                await registerIdentityRoutes(app, context);
            },
        };
    },
};
