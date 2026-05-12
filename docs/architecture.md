# System Architecture: SUBSTRAT

## 1. Overview
SUBSTRAT is built on a **Decoupled Orchestration Architecture**. The system separates the "State Tracking" (Database/Backend) from the "Intelligence Engine" (Frontend Logic), allowing for highly reactive UI updates while maintaining a consistent source of truth.

## 2. Component Diagram
- **Data Layer (MongoDB)**: Stores persistent states for Blocks, Audit Logs, and User Requests.
- **Service Layer (Express/Node)**: Handles state mutations, authentication, and role-based access control.
- **Intelligence Layer (`workflowEngine.js`)**: A centralized JavaScript utility library that calculates SLA drift, health scores, and dependency propagation risks in real-time.
- **Presentation Layer (React)**: Role-specific workspaces (Manager vs. Engineer) that consume the `OrchestrationContext`.

## 3. Data Flow
1. **Mutation**: User performs an action (e.g., "Advance Stage").
2. **Persistence**: API call updates MongoDB.
3. **Synchronization**: `OrchestrationContext` polls or receives a WebSocket update.
4. **Intelligence Execution**: `workflowEngine` re-evaluates the health of the entire dependency graph based on the single mutation.
5. **UI Propagation**: Workspaces update visually (e.g., a node turns red in the Control Center).

## 4. Security
- **JWT Authentication**: Secure stateless sessions.
- **RBAC (Role Based Access Control)**: Strict separation between Managerial actions (simulation, assignment) and Engineering actions (execution).
