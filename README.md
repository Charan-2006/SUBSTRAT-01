# SUBSTRAT — Analog Layout Workflow Automation System

## 1. Project Title & Team

- **Project Name:** SUBSTRAT
- **Team Name:** SKYHIGH
- **Team Lead:** Charan Annamalai A
- **Team Members:** Charan Annamalai A, Magesh K, Chandrasekar L
- **Institution:** Chennai Institute Of Technology

---

## 2. Problem Statement

Analog layout remains a human-intensive bottleneck in the semiconductor tapeout lifecycle. Traditional tracking methods rely on manual spreadsheets, leading to:
- **Opacity in Verification:** Minimal real-time visibility into DRC/LVS iteration cycles.
- **Workflow Stagnation:** Manual status updates cause significant delays in downstream node activation.
- **Dependency Deadlocks:** Lack of topological intelligence results in critical path failures being discovered too late.
- **Coordination Overhead:** Excessive time spent on manual sync-up meetings rather than layout execution.

SUBSTRAT solves these challenges by treating analog layout as a deterministic orchestration problem, providing real-time telemetry and predictive dependency management.

---

## 3. Application Flow

1. **Enterprise Authentication:** Secure login via Google OAuth 2.0 with role-based access control.
2. **Managerial Oversight:** Centralized command center for global project health and KPI monitoring.
3. **Block Orchestration:** Automated block creation with granular SLA and complexity definitions.
4. **Topological Mapping:** Configuration of inter-block dependencies to build a dynamic execution graph.
5. **Engineer Execution:** Targeted workspace for engineers to advance layouts through verification stages.
6. **Continuous Review:** Integrated approval/rejection pipeline with manager feedback loops.
7. **Bottleneck Intelligence:** Real-time detection of critical path stalls and SLA drift.
8. **Automated Tapeout:** Systemic completion triggers and final sign-off orchestration.

---

## 4. Tech Stack Used

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React v18, Vite, React Router, Axios |
| **Backend** | Node.js v20, Express.js |
| **Database** | MongoDB, Mongoose |
| **Authentication** | Google OAuth 2.0, Passport.js, JWT |
| **UI Components** | Lucide React, CSS Modules |
| **State Management** | React Context API |

---

## 5. UI Screenshots

### Authentication
![Authentication](docs/screenshots/authentication.png)
*Secure enterprise gateway utilizing Google OAuth 2.0 for role-validated sessions.*

### Manager Workspace
![Manager Workspace](docs/screenshots/manager-workspace.png)
*Comprehensive orchestration hub providing real-time telemetry across all active layout projects.*

### Engineer Workspace
![Engineer Workspace](docs/screenshots/engineer-workspace.png)
*Focused execution cockpit designed for high-velocity layout verification and stage progression.*

### Workflow Board & Block Definition
![Workflow Board](docs/screenshots/workflow-board.png)
*Visual block lifecycle management with granular status tracking and health indexing.*

### Execution Console
![Execution Console](docs/screenshots/execution-console.png)
*Precision analytics comparing estimated effort against actual execution hours.*

### Priority Engine
![Priority Engine](docs/screenshots/priority-engine.png)
*Weighted intelligence engine surfacing high-risk blocks requiring immediate engineering focus.*

### Dependency Intelligence
![Dependency Intelligence](docs/screenshots/dependency-intelligence.png)
*Topological visualization of block inter-dependencies and propagation risk analysis.*

### Knowledge Base
![Knowledge Base](docs/screenshots/knowledge-base.png)
*Centralized repository for design constraints, technical specs, and best practices.*

### Review Center
![Review Center](docs/screenshots/review-center.png)
*Structured quality gate for manager approvals, technical feedback, and sign-off.*

### Blocker Resolution System
![Blockers](docs/screenshots/blockers.png)
*Real-time execution interruption tracking and resolution orchestration.*

### Audit Trail
![Audit Trail](docs/screenshots/audit-trail.png)
*Forensic event pipeline capturing every project mutation for complete accountability.*

---

## 6. Setup Instructions

### Prerequisites
- Node.js v20+
- MongoDB instance

### Clone Repository
```bash
git clone https://github.com/Charan-2006/SKYHIGH_EPIC.git
cd SKYHIGH_EPIC
```

### Backend Installation
```bash
cd backend
npm install
cp .env.example .env
# Configure variables in .env
npm start
```

### Frontend Installation
```bash
cd ../frontend
npm install
npm run dev
```

---

## 7. Environment Variables

Create a `.env` file in the `backend` directory based on the `.env.example`. Ensure that real secrets are never committed to version control.

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_signing_key
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
FRONTEND_URL=http://localhost:5173
```

---

## 8. Features Implemented

- **Role-Based Orchestration:** Distinctive workspaces for Managers and Engineers with strict permission gating.
- **Deterministic State Machine:** Six-stage layout lifecycle (NOT_STARTED → DRC → LVS → REVIEW → COMPLETED).
- **Dependency Propagation:** Automatic unlocking of downstream blocks upon upstream verification.
- **Weighted Priority Scoring:** Algorithmic task prioritization based on SLA drift and cascading risk.
- **SLA Telemetry:** Sub-hour drift detection with automated risk reclassification.
- **Knowledge Management:** Integrated repository for project-specific technical documentation.
- **Audit Pipeline:** Immutable event logging for every action taken within the platform.
- **Review Loop:** Technical review system with feedback persistence and rejection cycle tracking.
- **Real-Time Intelligence:** Live health monitoring and bottleneck surface detection.

---

## 9. Known Issues / Limitations

- **Real-Time Sync:** Currently utilizes polling intervals; WebSocket-based bi-directional sync is in the v2.0 roadmap.
- **Notification Simulation:** In-app alerts are deterministic; external SMTP/Slack integration is pending.
- **Data Modeling:** Complex non-linear dependencies are currently approximated via weighted DAG edges.
- **Scaling:** UI virtualization for projects exceeding 500+ concurrent blocks is yet to be optimized.

---

## 10. Submission Rules Compliance

- [x] Private Repository
- [x] README.md completed
- [x] .env.example included
- [x] package.json configured
- [x] All source files included
- [x] Google OAuth integrated
- [x] MongoDB integration completed
- [x] npm install supported
- [x] Demo data generation implemented
