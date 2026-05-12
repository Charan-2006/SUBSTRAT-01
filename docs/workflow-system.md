# Workflow System: Deterministic State Transitions

SUBSTRAT enforces a deterministic state machine for analog layout execution to ensure data integrity and auditability.

## 1. Lifecycle Stages
1. **NOT_STARTED**: Node initialized in the orchestration graph.
2. **READY**: All upstream dependencies are COMPLETED. Node is ready for execution.
3. **IN_PROGRESS**: Active layout execution. SLA timer is active.
4. **DRC (Design Rule Check)**: Physical verification stage.
5. **LVS (Layout vs. Schematic)**: Electrical connectivity verification stage.
6. **REVIEW**: Technical sign-off by a Peer or Manager.
7. **COMPLETED**: Node is finalized and unblocks downstream dependencies.

## 2. Transition Rules
- A node cannot move to **IN_PROGRESS** if its status is **BLOCKED** by upstream dependencies.
- Moving from **REVIEW** to **IN_PROGRESS** (Rejection) triggers an audit log and resets the current stage timer.
- Moving to **COMPLETED** triggers a recursive check of all downstream nodes to update their `isBlocked` status.

## 3. SLA Monitoring
The system calculates `elapsedHours` by summing the durations of all previous stages + the active time in the current stage. This is compared against the `slaTargetHours` defined during the initialization of the block.

## 4. Escalation System
When a workflow is escalated:
- The `escalated` flag is set to `true`.
- The node is moved to the **Critical Execution Queue**.
- A high-priority notification is dispatched to the manager's dashboard.
- The node receives a visual pulse in all topological views.
