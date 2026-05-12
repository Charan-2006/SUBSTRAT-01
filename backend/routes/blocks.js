const express = require('express');
const {
    createBlock,
    getBlocks,
    assignEngineer,
    unassignEngineer,
    updateStatus,
    reviewBlock,
    getBlockLogs,
    loadDemoData,
    resetDataset,
    getAnalytics,
    getGlobalLogs,
    escalateBlock,
    resumeWorkflow,
    updateBlock,
    deleteBlock,
    releaseBlock
} = require('../controllers/blockController');

const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

const router = express.Router();

// Apply protection to all routes
router.use(protect);

// ──────────────────────────────────────────────
// STATIC routes MUST be registered before :id
// to prevent Express from matching "demo", "reset",
// "analytics", "logs" as a MongoDB ObjectId.
// ──────────────────────────────────────────────

// @route   POST /api/blocks/demo
// @desc    Load demo data (Manager only)
router.post('/demo', authorize('Manager'), loadDemoData);

// @route   DELETE /api/blocks/reset
// @desc    Reset all blocks and logs (Manager only)
router.delete('/reset', authorize('Manager'), resetDataset);

// @route   GET /api/blocks/analytics
// @desc    Get system analytics
router.get('/analytics', getAnalytics);

// @route   GET /api/blocks/logs/all
// @desc    Get global audit logs (Manager only)
router.get('/logs/all', authorize('Manager'), getGlobalLogs);

// @route   POST /api/blocks
// @desc    Create a new block (Manager only)
router.post('/', authorize('Manager'), createBlock);

// @route   GET /api/blocks
// @desc    Get blocks (Manager and Engineer)
router.get('/', getBlocks);

// ──────────────────────────────────────────────
// PARAMETERIZED routes (:id) below
// ──────────────────────────────────────────────

// @route   PUT /api/blocks/:id
// @desc    Update a block (Manager only)
router.put('/:id', authorize('Manager'), updateBlock);

// @route   DELETE /api/blocks/:id
// @desc    Delete a block (Manager only)
router.delete('/:id', authorize('Manager'), deleteBlock);

// @route   PUT /api/blocks/:id/assign
// @desc    Assign engineer to a block (Manager only)
router.put('/:id/assign', authorize('Manager'), assignEngineer);

// @route   DELETE /api/blocks/:id/assign
// @desc    Remove engineer assignment (Manager only)
router.delete('/:id/assign', authorize('Manager'), unassignEngineer);

// @route   PUT /api/blocks/:id/status
// @desc    Update block status (Engineer only)
router.put('/:id/status', authorize('Engineer'), updateStatus);

// @route   POST /api/blocks/:id/resume
// @desc    Resume workflow execution (Engineer only)
router.post('/:id/resume', authorize('Engineer'), resumeWorkflow);

// @route   PUT /api/blocks/:id/review
// @desc    Approve or reject a block (Manager only)
router.put('/:id/review', authorize('Manager'), reviewBlock);

// @route   PUT /api/blocks/:id/escalate
// @desc    Escalate a block (Manager only)
router.put('/:id/escalate', authorize('Manager'), escalateBlock);

// @route   PUT /api/blocks/:id/release
// @desc    Release a block to tapeout/archived state (Manager only)
router.put('/:id/release', authorize('Manager'), releaseBlock);

// @route   GET /api/blocks/:id/logs
// @desc    Get audit logs for a specific block
router.get('/:id/logs', getBlockLogs);

module.exports = router;
