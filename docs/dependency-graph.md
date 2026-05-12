# Dependency Graph & Topological Orchestration

The core of SUBSTRAT is its ability to manage complex, non-linear relationships between analog layout modules.

## 1. Graph Structure
Each block is a vertex in a **Directed Acyclic Graph (DAG)**. 
- **Dependencies (Upstream)**: Nodes that must be COMPLETED before the current node can start.
- **Impact (Downstream)**: Nodes that are waiting for the current node to reach the COMPLETED state.

## 2. Real-time Propagation
When a block's status changes to COMPLETED, the orchestration engine perform a topological walk:
1. Identify all direct downstream nodes.
2. For each downstream node, check if *all* its dependencies are now COMPLETED.
3. If true, the node's `executionState` is updated from `BLOCKED` to `READY`.

## 3. Visual Orchestration
The **Control Center** provides a visual representation of this graph.
- **Node Colors**: Represent current stage or health status.
- **Edges**: Represent dependency links.
- **Pulse Effects**: Indicate nodes on the critical path or those currently being executed.

## 4. Circular Dependency Protection
The orchestration engine prevents the creation of circular dependencies during the "Create Block" and "Edit Block" workflows, ensuring the graph remains a valid DAG and avoiding infinite execution locks.
