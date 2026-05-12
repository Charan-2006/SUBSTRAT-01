# SUBSTRAT
### High-Fidelity Analog Layout Execution Intelligence & Workflow Orchestration

[![Status](https://img.shields.io/badge/Status-EPIC_Submission_Ready-blueviolet?style=for-the-badge)](https://github.com/Charan-2006/SUB)
[![Tech](https://img.shields.io/badge/Stack-MERN_Orchestration-orange?style=for-the-badge)](https://github.com/Charan-2006/SUB)
[![Domain](https://img.shields.io/badge/Domain-Semiconductor_Operations-red?style=for-the-badge)](https://github.com/Charan-2006/SUB)

**SUBSTRAT** is an enterprise-grade execution intelligence platform designed to eliminate the "black box" of analog layout development. By treating semiconductor workflows as a dynamic, weighted dependency graph, SUBSTRAT provides mission-critical visibility, autonomous bottleneck detection, and predictive risk orchestration for high-velocity tapeout schedules.

---

## 💎 Platform Vision
Traditional semiconductor workflow tracking relies on static spreadsheets and manual synchronization, leading to catastrophic "hidden" delays in the critical path. **SUBSTRAT** transforms this into a high-fidelity execution environment where dependencies propagate automatically, SLAs are monitored with sub-hour precision, and engineering resources are managed through a weighted intelligence engine.

---

## 🏗 Core Platform Modules

### 👑 Manager Orchestration Workspace
The command center for operational leaders. Features a unified interface for global layout oversight, resource allocation, and strategic intervention.
- **Orchestration Intelligence**: Real-time visualization of the entire block lifecycle.
- **Command Control**: Direct execution override, priority escalation, and cross-team reassignment.

### 🛠 Engineer Execution Workspace
A high-fidelity cockpit designed for layout verification and physical execution.
- **Workflow Stepper**: A deterministic transition system (DRC → LVS → REVIEW) that ensures all verification gates are satisfied before progression.
- **Live Telemetry**: Sub-second tracking of stage duration, pressure index, and technical constraints.

### 🚀 Execution Engine
The backend logic layer that handles high-concurrency state mutations and ensures data integrity across thousands of orchestration events.
- **SLA Precision**: Tracks "Estimated vs. Actual" hours with variance detection and outlier reporting.
- **Health Telemetry**: Aggregates pressure, delay, and failure data into a unified node health score.

### ⚖️ Priority Engine
A weighted intelligence module that identifies where engineering focus is required most.
- **Scoring Formula**: `(SLA_Drift * 15) + (Cascading_Risk * 20) + (Rejection_Volume * 5)`.
- **Dynamic Reordering**: Automatically re-prioritizes the execution queue based on real-time tapeout risk.

### 🕸 Dependency Orchestration System
Manages the complex topological relationships between analog modules (e.g., LDOs, Bandgaps, ADCs).
- **Automated Propagation**: Completing an upstream block instantly triggers the "READY" state for all downstream nodes.
- **Deadlock Detection**: Identifies circular dependencies and critical path bottlenecks before they stall execution.

---

## 🔄 Workflow Lifecycle
SUBSTRAT enforces a strict verification lifecycle to maintain the highest standards of layout integrity.

| Stage | Logic Gate | Orchestration Impact |
| :--- | :--- | :--- |
| **NOT_STARTED** | Initialization | Graph node created; SLA target locked. |
| **READY** | Dependency Check | Upstream nodes COMPLETED; Execution Lane unlocked. |
| **IN_PROGRESS** | Active Execution | SLA timer active; Pressure telemetry broadcasting. |
| **DRC / LVS** | Physical Verification | Verification counters incremented; Failure loops monitored. |
| **REVIEW** | Quality Gate | Technical sign-off required; Peer/Manager alignment. |
| **COMPLETED** | Terminal State | Downstream propagation triggered; Analytics finalized. |

---

## 🧠 Intelligent Orchestration Features

*   **Execution Pressure Analysis**: Real-time evaluation of engineer workload vs. complexity, predicting burnout or slippage.
*   **Cascading Risk Analysis**: Quantifies the "Blast Radius" of a single block delay on the entire chip timeline.
*   **Blocker Propagation**: Autonomous detection of upstream stalls, instantly flagging downstream nodes with "Dependency Interruption."
*   **Review Intelligence**: Monitors review latency to prevent "Approval Bottlenecks" from stalling the verification cycle.
*   **Recovery Projection**: Simulation-based forecasting of project completion after re-assignment or escalation.

---

## 🛠 Technical Architecture

### **Frontend Architecture**
- **Orchestration Context**: A centralized state provider managing the global dependency graph and real-time telemetry updates.
- **Dynamic Grid Engine**: High-performance layout system for managing dense workflow data without performance degradation.
- **Telemetry Hooks**: Custom React hooks for calculating live SLA drift and health scores on-the-fly.

### **Backend & Services**
- **Decoupled Workflow Service**: Separate controllers for Block mutations, Audit logging, and Operational requests.
- **Audit Trail Pipeline**: A non-blocking logging system that captures every orchestration event for forensic analysis.
- **Simulation Engine**: A deterministic model that projects the impact of strategy changes on the global timeline.

### **Data Intelligence**
- **Graph-Oriented Schemas**: MongoDB implementation designed for recursive dependency traversal and complex status propagation.
- **Telemetry Indexing**: Optimized indexing for real-time aggregation of execution metrics.

---

## 🎨 Design System
- **Rich Aesthetics**: A premium, "Dark Mode" engineering interface built with a custom-tuned CSS design system.
- **Micro-Animations**: Purpose-built transitions for state changes (e.g., "Pulse" for critical blocks, "Slide" for resolution panels).
- **High-Contrast Data Viz**: Visual clarity for complex metrics like Pressure Index and Propagation Risk.

---

## 📂 Folder Structure
```text
SUBSTRAT/
├── backend/                # Orchestration Server (Node/Express)
│   ├── config/             # DB & Auth Configuration
│   ├── controllers/        # Core Intelligence Controllers
│   ├── models/             # Mongoose Schemas (DAG Nodes, Logs)
│   ├── routes/             # API Orchestration Endpoints
│   └── services/           # Background Simulation & Telemetry
├── frontend/               # Execution Workspace (React/Vite)
│   ├── src/
│   │   ├── components/     # High-Fidelity UI Components
│   │   ├── context/        # Orchestration & Notification Providers
│   │   ├── pages/          # Manager/Engineer Workspaces
│   │   ├── utils/          # Workflow Engine (Intelligence Logic)
│   │   └── constants/      # Status Definitions & SLA Targets
└── docs/                   # Platform Documentation
    └── screenshots/        # Visual Walkthrough Assets
```

---

## 🚀 Setup & Installation

### 1. Repository Setup
```bash
git clone https://github.com/Charan-2006/SUB.git
cd SUB
```

### 2. Backend Initialization
```bash
cd backend
npm install
# Configure .env with MONGODB_URI & JWT_SECRET
npm run dev
```

### 3. Frontend Initialization
```bash
cd frontend
npm install
npm run dev
```

---

## 📸 Platform Walkthrough

| Module | Interface |
| :--- | :--- |
| **Login Cockpit** | ![Login](docs/screenshots/login.png) |
| **Manager Orchestration Dashboard** | ![Manager](docs/screenshots/manager_dashboard.png) |
| **Engineer Execution Workspace** | ![Engineer](docs/screenshots/engineer_workspace.png) |
| **Execution Engine Console** | ![Execution](docs/screenshots/execution_engine.png) |
| **Priority Intelligence** | ![Priority](docs/screenshots/priority_engine.png) |
| **Dependency Propagation Map** | ![Dependencies](docs/screenshots/dependencies.png) |
| **Knowledge Repository** | ![Knowledge](docs/screenshots/knowledge_base.png) |
| **Technical Review Center** | ![Reviews](docs/screenshots/reviews.png) |
| **Interruption Resolution** | ![Blockers](docs/screenshots/blockers.png) |
| **Simulation Workspace** | ![Simulation](docs/screenshots/simulation_workspace.png) |

---

## 🏅 EPIC Build-A-Thon Alignment
SUBSTRAT was engineered from the ground up to satisfy the core pillars of the **EPIC Hackathon**:
- **Workflow Automation**: Autonomous stage propagation and dependency unlocking.
- **Orchestration**: A centralized brain managing thousands of inter-connected module states.
- **Execution Intelligence**: Predictive risk scoring and SLA telemetry.
- **Semiconductor Focus**: Purpose-built for DRC/LVS/Layout lifecycles.

---

## 🔮 Future Roadmap
- **ML-Driven Scheduling**: Neural networks trained on historical layout cycles to predict "True Completion" ETAs.
- **EDA Live-Link**: Real-time status ingestion from Cadence Virtuoso and Synopsys IC Validator.
- **Resource Balancer**: AI-assisted workload distribution based on engineer domain expertise and historical velocity.

---

## 📝 Known Limitations
- Graph visualization is optimized for desktop engineering workstations (1440p+).
- Current simulation logic is deterministic; stochastic modeling is planned for v2.0.

---

## 🏆 Final Submission
**SUBSTRAT** brings the power of modern software orchestration to the high-precision world of analog semiconductor design. By eliminating manual silos and providing deep execution intelligence, we ensure that every hour spent on layout is optimized for the critical path to tapeout.
