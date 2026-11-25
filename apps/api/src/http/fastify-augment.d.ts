import type { FastifyRequest } from "fastify";
import type { AuthContext } from "../authentication/types.js";

declare module "fastify" {
    interface FastifyRequest {
        authContext: AuthContext | null;
        startedAt: number;
    }
}
