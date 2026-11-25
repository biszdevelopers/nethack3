export interface CapabilityGraphNode {
    readonly id: string;
    readonly dependencies: readonly string[];
}

export class CapabilityGraphError extends Error {
    readonly problems: readonly string[];

    constructor(problems: readonly string[]) {
        super(`Invalid capability graph: ${problems.join("; ")}`);
        this.name = "CapabilityGraphError";
        this.problems = problems;
    }
}

/**
 * Topological resolution over the statically registered capability graph.
 * Kahn's algorithm: time O(V + E), auxiliary space O(V + E). The input array
 * order breaks ties so initialization is deterministic. Cycles and missing
 * dependencies are reported together instead of failing on the first one.
 */
export function resolveCapabilityOrder(
    nodes: readonly CapabilityGraphNode[],
): readonly string[] {
    const problems: string[] = [];
    const byId = new Map<string, CapabilityGraphNode>();

    for (const node of nodes) {
        if (byId.has(node.id)) {
            problems.push(`duplicate capability id "${node.id}"`);
            continue;
        }
        byId.set(node.id, node);
    }

    for (const node of nodes) {
        for (const dependency of node.dependencies) {
            if (!byId.has(dependency)) {
                problems.push(`capability "${node.id}" depends on missing "${dependency}"`);
            }
        }
    }

    if (problems.length > 0) {
        throw new CapabilityGraphError(problems);
    }

    const dependents = new Map<string, string[]>();
    const indegree = new Map<string, number>();
    for (const node of nodes) {
        indegree.set(node.id, 0);
        dependents.set(node.id, []);
    }
    for (const node of nodes) {
        for (const dependency of node.dependencies) {
            indegree.set(node.id, (indegree.get(node.id) ?? 0) + 1);
            dependents.get(dependency)?.push(node.id);
        }
    }

    const queue: string[] = nodes
        .filter((node) => (indegree.get(node.id) ?? 0) === 0)
        .map((node) => node.id);
    const order: string[] = [];
    let head = 0;

    while (head < queue.length) {
        const id = queue[head];
        head += 1;
        if (id === undefined) {
            break;
        }
        order.push(id);
        for (const dependent of dependents.get(id) ?? []) {
            const remaining = (indegree.get(dependent) ?? 0) - 1;
            indegree.set(dependent, remaining);
            if (remaining === 0) {
                queue.push(dependent);
            }
        }
    }

    if (order.length !== nodes.length) {
        const unresolved = nodes
            .filter((node) => !order.includes(node.id))
            .map((node) => node.id);
        throw new CapabilityGraphError([`dependency cycle among: ${unresolved.join(", ")}`]);
    }

    return order;
}
