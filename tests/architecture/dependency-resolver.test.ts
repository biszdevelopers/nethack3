import { describe, expect, it } from "vitest";
import { resolveCapabilityOrder, CapabilityGraphError } from "../../apps/api/src/core/dependency-resolver.js";

describe("resolveCapabilityOrder", () => {
    it("returns a deterministic topological order", () => {
        const order = resolveCapabilityOrder([
            { id: "identity", dependencies: [] },
            { id: "organizations", dependencies: ["identity"] },
            { id: "competitions", dependencies: ["organizations"] },
            { id: "teams", dependencies: ["competitions", "identity"] },
        ]);
        expect(order).toEqual(["identity", "organizations", "competitions", "teams"]);
    });

    it("keeps independent capabilities in registration order", () => {
        const order = resolveCapabilityOrder([
            { id: "b", dependencies: [] },
            { id: "a", dependencies: [] },
        ]);
        expect(order).toEqual(["b", "a"]);
    });

    it("rejects duplicate capability ids", () => {
        expect(() =>
            resolveCapabilityOrder([
                { id: "identity", dependencies: [] },
                { id: "identity", dependencies: [] },
            ]),
        ).toThrow(CapabilityGraphError);
    });

    it("rejects missing dependencies", () => {
        expect(() =>
            resolveCapabilityOrder([{ id: "teams", dependencies: ["competitions"] }]),
        ).toThrow(/missing "competitions"/);
    });

    it("rejects dependency cycles and reports the members", () => {
        expect(() =>
            resolveCapabilityOrder([
                { id: "a", dependencies: ["b"] },
                { id: "b", dependencies: ["c"] },
                { id: "c", dependencies: ["a"] },
            ]),
        ).toThrow(/cycle among: a, b, c/);
    });

    it("scales linearly for a wide graph", () => {
        const nodes = [
            { id: "root", dependencies: [] },
            ...Array.from({ length: 2000 }, (_, index) => ({
                id: `cap-${index}`,
                dependencies: ["root"],
            })),
        ];
        const order = resolveCapabilityOrder(nodes);
        expect(order).toHaveLength(2001);
        expect(order[0]).toBe("root");
    });
});
