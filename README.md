# Analog Layout Workflow Automation System

A MERN stack application designed to intelligently track, estimate, and manage the workflow of Analog Layout engineers. It features dynamic health calculation, role-based dashboards, bottleneck analytics, and Google OAuth 2.0.

## Features
- **Role-Based Access**: Managers assign and review tasks; Engineers update task status.
- **Intelligent Health Cards**: Blocks are automatically graded as `HEALTHY`, `RISK`, or `CRITICAL` based on time spent, inactivity, and rejections.
- **Workflow State Machine**: Strict status transitions (`NOT_STARTED` -> `IN_PROGRESS` -> `DRC` -> `LVS` -> `REVIEW` -> `COMPLETED`).
- **Audit Timeline**: Visual timeline of all actions performed on a block.
- **System Analytics**: Automatic detection of bottleneck stages across the system.
- **Demo Mode**: One-click generation of diverse demo data to populate the dashboard.

## Tech Stack
- **Frontend**: React (Functional, Hooks), Vite, React Router, Axios, Custom CSS.
- **Backend**: Node.js, Express, MongoDB (Mongoose), Passport.js (Google OAuth2).

## Prerequisites
- Node.js (v18+)
- MongoDB running locally on port `27017`
- A Google Cloud Console project with OAuth credentials configured.

## Setup Instructions

### 1. Backend Configuration
1. Navigate to the `backend` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create or update the `.env` file in the `backend` directory:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/analog-layout
   FRONTEND_URL=http://localhost:5173
   JWT_SECRET=your_jwt_secret_here
   
   # Google OAuth Credentials (Required)
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
   ```
4. Start the backend server:
   ```bash
   node server.js
   # or npm run dev if you install nodemon
   ```

### 2. Frontend Configuration
1. Navigate to the `frontend` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```

### 3. Usage
1. Open `http://localhost:5173` in your browser.
2. Click **Sign in with Google**.
3. *Note: By default, the schema assigns `role: 'Engineer'` to new users. If you wish to test Manager features, manually update your document in MongoDB (`db.users.updateOne({ email: "your@email.com" }, { $set: { role: "Manager" } })`).*
4. As a Manager, click the **Load Demo Data** button (top right) to automatically populate the system with 8 fully tracked blocks in various states of health!
