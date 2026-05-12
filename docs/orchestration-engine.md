# Orchestration Engine: Core Intelligence

The SUBSTRAT Orchestration Engine is the centralized logic layer that governs the movement of layout blocks through the verification lifecycle.

## 1. Pressure Index Calculation
The engine evaluates the "Execution Pressure" of each node to assist in prioritization.
- **SLA Overrun**: Direct impact on score. Blocks exceeding their target hours are prioritized.
- **Rejection history**: High rejection counts indicate technical debt or spec misalignment, increasing pressure.
- **Propagation Risk**: Calculated by counting all downstream nodes. Stalling a high-propagation node (like a Bandgap) has a severe impact on the aggregate score.

## 2. Autonomous Health Detection
The engine categorizes nodes into four health states:
- **HEALTHY**: Operating within SLA; no blocking dependencies.
- **RISK**: Approaching SLA target or experiencing minor delays.
- **SEVERE**: SLA breached; manual intervention recommended.
- **CRITICAL**: Significant SLA breach or repeated iterative failure.

## 3. Propagation Risk
Propagation risk is a normalized value (0.0 to 1.0) representing how much of the global workflow depends on a single node. The engine recursively traverses the dependency graph to identify "Bottleneck Nodes" that require immediate management focus.

## 4. Simulation Logic
The simulation engine uses the same `workflowEngine` logic to project future states. When a manager "Runs Simulation," the system creates a virtual copy of the orchestration state and applies the proposed changes (e.g., reassignment) to calculate the delta in total project delay.
