import { identityCapability } from "./identity/index.js";
import type { CapabilityDefinition } from "../core/capability.js";

export const capabilities = [identityCapability] satisfies readonly CapabilityDefinition[];
