<p align="center">
  <img src="https://img.shields.io/badge/SUBSTRAT-Execution_Intelligence-blueviolet?style=for-the-badge&labelColor=0d1117" alt="SUBSTRAT" />
</p>

<h1 align="center">SUBSTRAT</h1>
<h3 align="center">High-Fidelity Analog Layout Execution Intelligence<br/>& Workflow Orchestration Platform</h3>

<p align="center">
  <img src="https://img.shields.io/badge/React-18.x-61DAFB?style=flat-square&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-20.x-339933?style=flat-square&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/MongoDB-NoSQL-47A248?style=flat-square&logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-REST_API-000000?style=flat-square&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-Build_Engine-646CFF?style=flat-square&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/OAuth_2.0-Google-4285F4?style=flat-square&logo=google&logoColor=white" />
</p>

<p align="center">
  <strong>EPIC Build-A-Thon 2026 — Final Submission</strong>
</p>

---

## 1. Project Title & Team

| | |
| :--- | :--- |
| **Project** | SUBSTRAT — Analog Layout Execution Intelligence |
| **Team Name** | SUBSTRAT |
| **Team Lead** | Charan |
| **Team Members** | Charan |
| **Institution** | — |
| **Event** | EPIC Build-A-Thon 2026 |
| **Track** | Semiconductor Operations & Workflow Orchestration |

---

## 2. Problem Statement

### The Critical Gap in Analog Layout Execution

Modern semiconductor design operates under extreme schedule pressure. While digital flows benefit from mature EDA automation, **analog layout remains a fundamentally human-driven process** where experienced engineers manually route sensitive circuits, verify physical constraints, and iterate through DRC/LVS cycles.

**The systemic failures of current workflow management:**

**Dependency Deadlocks Without Visibility**
Analog blocks rarely exist in isolation. A Bandgap Reference must be completed and verified before the LDO Regulator can finalize its routing; a PLL Core must pass LVS before the Clock Distribution can begin. In practice, these upstream stalls are discovered hours or days late — through Slack messages, stand-up meetings, or when an engineer simply notices their upstream node hasn't moved. By then, cascading delays have already propagated silently across the tapeout graph.

**SLA Blindness**
Managers track estimated hours using spreadsheets that are outdated the moment they're created. There is no mechanism to compare estimated effort against actual elapsed time in real-time, no alerting when a block drifts into variance, and no intelligence to identify which delays are isolated versus which threaten the critical path.

**Verification Fatigue**
Engineers trapped in repeated DRC/LVS failure loops — submitting, failing, reworking, resubmitting — generate no visible signal to management. These "silent cycles" consume expensive engineering bandwidth while the rest of the organization assumes progress is being made.

**Bottleneck Propagation**
A single stalled block at a high fan-out node (e.g., a shared Bandgap) can silently delay 5–10 downstream modules. Without topological analysis of the dependency graph, managers cannot distinguish between a locally delayed block and a systemically dangerous bottleneck threatening the entire tapeout schedule.

### The SUBSTRAT Solution

SUBSTRAT treats every analog layout block as a **node in a dynamic, weighted Directed Acyclic Graph (DAG)**. The platform provides:

- **Autonomous dependency propagation** — completing an upstream block instantly unlocks all downstream nodes without manual coordination.
- **Sub-hour SLA telemetry** — real-time tracking of estimated vs. actual execution with variance detection.
- **Cascading risk intelligence** — quantifying the "blast radius" of any single block delay on the global tapeout schedule.
- **Execution pressure analysis** — weighted scoring that surfaces the most critical nodes requiring immediate engineering focus.

---

## 3. Application Flow

The platform operates through a deterministic orchestration pipeline:

```
Login (Google OAuth)
  │
  ├── Manager Path ──────────────────────────────────────────────────┐
  │   │                                                              │
  │   ├── 1. Access Orchestration Workspace                          │
  │   ├── 2. Create Layout Blocks (name, type, complexity, SLA)      │
  │   ├── 3. Define Topological Dependencies (DAG construction)      │
  │   ├── 4. Assign Engineers (expertise + workload balancing)       │
  │   ├── 5. Monitor Execution Engine (Est. vs Actual, health)       │
  │   ├── 6. Run Strategic Simulations (reassignment impact)         │
  │   ├── 7. Review & Approve/Reject Completed Blocks                │
  │   ├── 8. Escalate Critical Path Bottlenecks                      │
  │   └── 9. Audit Trail (forensic analysis of all mutations)        │
  │                                                                  │
  └── Engineer Path ─────────────────────────────────────────────────┘
      │
      ├── 1. Access Execution Cockpit
      ├── 2. View Assigned Blocks + Priority Recommendations
      ├── 3. Advance Through Verification Stages
      │       NOT_STARTED → IN_PROGRESS → DRC → LVS → REVIEW
      ├── 4. Monitor Stage Telemetry (duration, pressure, SLA)
      ├── 5. Resolve Execution Interruptions (dependency blocks)
      ├── 6. Notify Upstream Owners / Escalate Blockers
      ├── 7. Submit for Technical Review
      └── 8. Completion → Automatic Downstream Propagation
```

---

## 4. Tech Stack Used

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 18 | Component-based orchestration workspace |
| | Vite 8 | High-performance build engine with HMR |
| | React Router v7 | Role-based workspace routing |
| | Axios | HTTP orchestration layer |
| | Lucide React | Premium icon system |
| | Recharts | Execution analytics visualization |
| | React Hot Toast | Real-time feedback notifications |
| **Backend** | Node.js v20 | Asynchronous orchestration server |
| | Express.js v5 | RESTful API routing |
| | MongoDB | Graph-oriented document store |
| | Mongoose v9 | Schema modeling with dependency refs |
| | JWT | Stateless session authentication |
| **Auth** | Google OAuth 2.0 | Enterprise SSO authentication |
| | Passport.js | Strategy-based auth middleware |
| **Intelligence** | `workflowEngine.js` | SLA calculation, health scoring, pressure analysis, bottleneck detection, dependency impact quantification |

---

## 5. UI Screenshots

### Authentication
![Login](docs/screenshots/login.png)
*Google OAuth authentication gateway with secure session management.*

---

### Manager Orchestration Dashboard
![Manager Dashboard](docs/screenshots/manager-dashboard.png)
*Unified command center for global layout oversight, KPI monitoring, and strategic intervention.*

---

### Engineer Execution Workspace
![Engineer Workspace](docs/screenshots/engineer-workspace.png)
*High-fidelity cockpit with workflow stepper, live telemetry, and priority recommendations.*

---

### Execution Engine Console
![Execution Console](docs/screenshots/execution-console.png)
*Precision tracking of Estimated vs. Actual hours with variance outlier detection.*

---

### Priority Engine
![Priority Engine](docs/screenshots/priority-engine.png)
*Weighted intelligence module surfacing the highest-risk nodes for immediate focus.*

---

### Workflow Board & Block Definition
![Workflow Board](docs/screenshots/workflow-board.png)
*Complete block lifecycle view with stage progression and health indicators.*

---

### Dependency Intelligence
![Dependency Intelligence](docs/screenshots/dependency-intelligence.png)
*Topological visualization of upstream/downstream relationships and propagation risk.*

---

### Knowledge Base
![Knowledge Base](docs/screenshots/knowledge-base.png)
*Centralized technical documentation and design constraint repository.*

---

### Technical Review Center
![Reviews](docs/screenshots/reviews.png)
*Approval/Rejection workflow with manager feedback and rejection reason tracking.*

---

### Blocker Resolution System
![Blockers](docs/screenshots/blockers.png)
*Real-time execution interruption detection with forensic resolution intelligence.*

---

### Simulation Workspace
![Simulation Workspace](docs/screenshots/simulation-workspace.png)
*Deterministic simulation engine projecting the impact of strategic changes on the tapeout schedule.*

---

### Audit Trail
![Audit Trail](docs/screenshots/audit-trail.png)
*Complete forensic record of every orchestration mutation — timestamped and attributed.*

---

## 6. Setup Instructions

### Prerequisites
- **Node.js** v16+ (v20 recommended)
- **MongoDB** (local instance or MongoDB Atlas cloud cluster)
- **Google Cloud Console** project with OAuth 2.0 credentials configured

### Step 1 — Clone the Repository
```bash
git clone https://github.com/Charan-2006/SUB.git
cd SUB
```

### Step 2 — Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory (see Section 7 for variables):
```bash
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secret, and Google OAuth credentials
```

Start the orchestration server:
```bash
npm run dev        # Development mode with nodemon
# or
npm start          # Production mode
```

### Step 3 — Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

The application will be available at `http://localhost:5173`.

### Step 4 — Google OAuth Configuration
1. Navigate to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services → Credentials**
4. Create an **OAuth 2.0 Client ID** (Web Application)
5. Add `http://localhost:5000/api/auth/google/callback` as an Authorized Redirect URI
6. Copy the **Client ID** and **Client Secret** into your backend `.env`

### Step 5 — MongoDB Setup
- **Local**: Ensure `mongod` is running on port 27017
- **Atlas**: Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas) and use the provided connection string

---

## 7. Environment Variables

Create a `.env` file in the `backend/` directory with the following configuration:

```env
# Server Configuration
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/substrat

# Authentication
JWT_SECRET=your_secure_jwt_secret_here

# Google OAuth 2.0
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Frontend Origin (CORS)
FRONTEND_URL=http://localhost:5173
```

> ⚠️ **Never commit real credentials.** The `.env` file is excluded via `.gitignore`. A `.env.example` template is provided in the repository.

---

## 8. Features Implemented

### Mandatory Modules

| # | Module | Description |
| :--- | :--- | :--- |
| 1 | **Manager Orchestration Workspace** | Unified command center with KPI monitoring, block creation, engineer assignment, and strategic oversight |
| 2 | **Engineer Execution Workspace** | Focused cockpit with workflow stepper, live telemetry, pressure index, and priority-based task recommendations |
| 3 | **Execution Engine** | High-precision SLA tracking with Estimated vs. Actual hours, variance detection, and health telemetry aggregation |
| 4 | **Priority Engine** | Weighted scoring formula: `(SLA_Drift × 15) + (Cascading_Risk × 20) + (Rejection_Volume × 5)` with dynamic queue reordering |
| 5 | **Dependency Orchestration** | Topological DAG management with automated upstream/downstream propagation and deadlock prevention |
| 6 | **Knowledge Base** | Centralized technical documentation, design constraints, and engineering context repository |
| 7 | **Review Intelligence** | Approval/Rejection workflow with manager feedback, rejection reason tracking, and review latency monitoring |
| 8 | **Blocker Propagation System** | Real-time execution interruption detection with forensic resolution panels and upstream owner notifications |
| 9 | **Audit Trail** | Non-blocking event pipeline capturing every orchestration mutation with full attribution and timestamps |
| 10 | **Simulation Engine** | Deterministic projection of strategy changes (reassignment, deadline shift) on the global tapeout schedule |

### Advanced Orchestration Add-ons

| Feature | Intelligence Layer |
| :--- | :--- |
| **Workflow State Machine** | Deterministic 6-stage lifecycle with verification gate enforcement |
| **Dynamic Health Scoring** | Four-tier classification: HEALTHY → RISK → SEVERE → CRITICAL |
| **SLA Intelligence** | Sub-hour drift detection with automatic escalation triggers |
| **Recovery Projection** | Simulation-based forecasting of project completion after interventions |
| **Cascading Risk Analysis** | Quantification of the "Blast Radius" of any single node delay |
| **Execution Pressure Index** | Real-time workload-vs-complexity evaluation per engineer |
| **Bottleneck Detection** | Identification of high fan-out nodes threatening the critical path |
| **Propagation Risk Tracking** | Normalized 0.0–1.0 score representing downstream dependency weight |

---

## 9. Known Issues / Limitations

| Limitation | Context |
| :--- | :--- |
| **Deterministic Simulation** | Current simulation engine uses fixed projections; stochastic Monte Carlo modeling is planned for v2.0 |
| **No Live EDA Integration** | Status updates are manual; direct API hooks to Cadence Virtuoso / Synopsys IC Validator are on the roadmap |
| **Desktop Optimized** | UI is designed for engineering workstations (1440p+); responsive mobile layouts are not prioritized |
| **No WebSocket Synchronization** | Real-time updates use polling intervals; WebSocket-based live propagation is planned |
| **Graph Scaling** | Dependency visualization is optimized for projects with up to ~200 nodes; larger graphs may require virtualization |

---

## 10. Submission Rules Compliance

| Requirement | Status |
| :--- | :--- |
| Private Repository | ✅ |
| Repository Naming Convention (`TeamName_EPIC`) | ✅ |
| `info@epicallayouts.com` added as collaborator | ✅ |
| README.md completed | ✅ |
| `.env.example` included | ✅ |
| `npm install` supported (backend + frontend) | ✅ |
| `package.json` configured with scripts | ✅ |
| Complete source code included | ✅ |
| No hardcoded credentials | ✅ |
| Documentation in `/docs` directory | ✅ |

---

## 11. Advanced Platform Architecture

### Workflow Lifecycle

SUBSTRAT enforces a strict, deterministic verification lifecycle:

| Stage | Gate Logic | Orchestration Impact |
| :--- | :--- | :--- |
| `NOT_STARTED` | Initialization | DAG node created; SLA target locked; dependency edges registered |
| `READY` | All upstream = COMPLETED | Execution lane unlocked; engineer notification dispatched |
| `IN_PROGRESS` | Active execution | SLA timer active; pressure telemetry broadcasting; stage history recording |
| `DRC` | Design Rule Check | Physical verification gate; failure counter incremented on rejection |
| `LVS` | Layout vs. Schematic | Electrical connectivity verification; netlist consistency check |
| `REVIEW` | Quality gate | Technical sign-off required; peer/manager alignment enforced |
| `COMPLETED` | Terminal state | Downstream propagation triggered; analytics finalized; audit entry created |

### Dependency Graph Intelligence

Each block is a vertex in a **Directed Acyclic Graph**. The orchestration engine performs:
- **Recursive Propagation**: When a block reaches COMPLETED, the engine walks all downstream edges and checks if each child node's dependencies are fully satisfied.
- **Deadlock Prevention**: Circular dependency detection during block creation prevents infinite execution locks.
- **Critical Path Identification**: Nodes with the highest downstream fan-out are flagged as bottleneck candidates.

### Cascading Risk Analysis

The engine computes a **Propagation Risk** score (0.0–1.0) for each node:
```
PropagationRisk = downstream_node_count / total_graph_nodes
```
Nodes with risk > 0.3 are automatically flagged for managerial attention. A stalled Bandgap with 8 downstream dependents scores 0.4 and receives a "High Tapeout Risk" classification.

### Execution Pressure Analysis

Each engineer's workload is evaluated through a composite pressure index:
```
PressureIndex = (active_blocks × 15) + (overdue_blocks × 25) + (blocked_blocks × 10)
```
This drives the **Priority Recommendation Engine**, which surfaces the single most impactful block an engineer should focus on next.

### Review Escalation System

- Reviews pending beyond 4 hours trigger automatic "Review Latency" warnings.
- Blocks rejected more than 2 times enter the **Rejection Loop** detection system.
- Escalated blocks receive visual pulse indicators across all workspace views.

### Recovery Simulation

The simulation engine creates a virtual copy of the orchestration state and applies proposed changes (reassignment, deadline extension, priority override) to project the delta in total estimated tapeout delay.

---

## 12. Folder Structure

```
SUBSTRAT/
├── backend/                    # Orchestration Server
│   ├── config/                 # Database & Passport Configuration
│   │   ├── db.js               # MongoDB Connection Manager
│   │   └── passport.js         # Google OAuth Strategy
│   ├── controllers/            # Core Intelligence Controllers
│   │   ├── authController.js   # Authentication & Session Logic
│   │   └── blockController.js  # Block CRUD + Orchestration Logic
│   ├── models/                 # Mongoose Schemas
│   │   ├── Block.js            # DAG Node Schema (dependencies, SLA, health)
│   │   ├── Log.js              # Audit Trail Event Schema
│   │   ├── User.js             # Engineer/Manager Profile Schema
│   │   └── Request.js          # Operational Request Schema
│   ├── routes/                 # API Endpoints
│   │   ├── auth.js             # OAuth Routes
│   │   ├── blocks.js           # Block Orchestration Routes
│   │   ├── users.js            # Engineer Management Routes
│   │   ├── requests.js         # Request Pipeline Routes
│   │   └── notifications.js    # Notification Dispatch Routes
│   ├── services/               # Background Services
│   │   └── simulationEngine.js # Strategy Simulation Engine
│   ├── .env.example            # Environment Variable Template
│   ├── package.json            # Backend Dependencies
│   └── server.js               # Application Entry Point
│
├── frontend/                   # Execution Workspace (React/Vite)
│   ├── src/
│   │   ├── api/                # Axios Configuration
│   │   ├── components/         # Shared UI Components
│   │   │   ├── Navbar.jsx      # Global Navigation
│   │   │   ├── Sidebar.jsx     # Filter & Navigation Rail
│   │   │   ├── TimelinePanel.jsx  # Block Detail Drawer
│   │   │   └── DependencySelector.jsx  # DAG Edge Builder
│   │   ├── context/            # State Providers
│   │   │   ├── OrchestrationContext.jsx  # Global Workflow State
│   │   │   ├── AuthContext.jsx           # Authentication State
│   │   │   ├── NotificationContext.jsx   # Alert Management
│   │   │   └── ThemeContext.jsx          # UI Theme Provider
│   │   ├── pages/              # Workspace Views
│   │   │   ├── Dashboard.jsx            # Root Orchestration Shell
│   │   │   ├── ManagerDashboard.jsx     # Manager Command Center
│   │   │   ├── EngineerDashboard.jsx    # Engineer Cockpit
│   │   │   ├── ControlCenter.jsx        # Simulation & Strategy
│   │   │   ├── PriorityEngine.jsx       # Weighted Intelligence
│   │   │   ├── ExecutionTab.jsx         # Execution Analytics
│   │   │   ├── AuditTrailTab.jsx        # Forensic Event Log
│   │   │   ├── engineer/               # Engineer Sub-modules
│   │   │   │   ├── EngMyWork.jsx       # Active Assignment View
│   │   │   │   ├── EngBlockers.jsx     # Interruption Resolution
│   │   │   │   ├── EngReviews.jsx      # Review Queue
│   │   │   │   ├── EngExecution.jsx    # Execution Telemetry
│   │   │   │   ├── EngTimeline.jsx     # Stage History
│   │   │   │   ├── EngKnowledge.jsx    # Knowledge Repository
│   │   │   │   └── EngRequests.jsx     # Operational Requests
│   │   │   └── workspace/             # Manager Sub-modules
│   │   │       ├── WorkspaceTab.jsx    # Operations Workspace
│   │   │       ├── KpiStrip.jsx        # KPI Dashboard
│   │   │       ├── WorkflowTable.jsx   # Block Grid View
│   │   │       └── IntelligencePanel.jsx # Health Analytics
│   │   ├── utils/
│   │   │   └── workflowEngine.js  # Core Intelligence Engine
│   │   └── constants/
│   │       └── workflowStates.js  # Stage Definitions
│   ├── package.json
│   └── vite.config.js
│
├── docs/                       # Platform Documentation
│   ├── architecture.md         # System Architecture
│   ├── orchestration-engine.md # Intelligence Engine Docs
│   ├── workflow-system.md      # State Machine Documentation
│   ├── dependency-graph.md     # DAG Management Docs
│   └── screenshots/            # UI Walkthrough Assets
│
├── .env.example                # Root Environment Template
├── .gitignore
└── README.md                   # This Document
```

---

## 13. EPIC Build-A-Thon Alignment

SUBSTRAT was engineered from the ground up to satisfy every core pillar of the EPIC Hackathon challenge:

| EPIC Pillar | SUBSTRAT Implementation |
| :--- | :--- |
| **Workflow Automation** | Autonomous stage propagation; dependency-driven state unlocking; automatic health reclassification on every mutation |
| **Execution Intelligence** | Weighted priority scoring; SLA variance detection; execution pressure telemetry; bottleneck surface analysis |
| **Semiconductor Focus** | Purpose-built for DRC → LVS → REVIEW verification lifecycles; analog block dependency modeling; tapeout risk quantification |
| **Orchestration** | Centralized DAG engine managing inter-connected module states; cascading propagation; simulation-based strategy projection |
| **Engineering Collaboration** | Role-separated workspaces; upstream owner notification; review escalation; operational request pipeline |
| **Verification Lifecycle** | Deterministic 6-stage state machine with gate enforcement; rejection loop detection; verification counter tracking |

---

## 14. Future Roadmap

| Phase | Enhancement | Impact |
| :--- | :--- | :--- |
| **v2.0** | ML-Based Estimation | Neural networks trained on historical layout data to predict "True Completion" ETAs per block type and complexity |
| **v2.1** | EDA Live-Link | Real-time status ingestion from Cadence Virtuoso and Synopsys IC Validator to automate DRC/LVS status updates |
| **v2.2** | WebSocket Synchronization | Zero-polling real-time propagation of state changes across all connected engineer terminals |
| **v3.0** | Predictive Orchestration | Monte Carlo simulation for probabilistic risk assessment and confidence intervals on tapeout schedules |
| **v3.1** | Enterprise Scaling | Multi-project support, cross-team dependency management, and organization-wide execution analytics |

---

<p align="center">
  <strong>SUBSTRAT</strong> brings the power of modern software orchestration to the precision-intensive world of analog semiconductor design.<br/>
  Every layout hour is optimized for the critical path to tapeout.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/EPIC_Build--A--Thon-2026-blueviolet?style=for-the-badge&labelColor=0d1117" />
</p>
