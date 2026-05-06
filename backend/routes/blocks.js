const express = require('express');
const {
    createBlock,
    getBlocks,
    assignEngineer,
    updateStatus,
    reviewBlock,
    getBlockLogs,
    loadDemoData,
    resetDataset,
    getAnalytics,
    getGlobalLogs
} = require('../controllers/blockController');

const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

const router = express.Router();

// Apply protection to all routes
router.use(protect);

// @route   POST /api/blocks
// @desc    Create a new block (Manager only)
router.post('/', authorize('Manager'), createBlock);

// @route   GET /api/blocks
// @desc    Get blocks (Manager and Engineer)
router.get('/', getBlocks);

// @route   GET /api/blocks/analytics
// @desc    Get system analytics
router.get('/analytics', getAnalytics);

// @route   POST /api/blocks/demo
// @desc    Load demo data (Manager only)
router.post('/demo', authorize('Manager'), loadDemoData);

// @route   DELETE /api/blocks/reset
// @desc    Reset all blocks and logs (Manager only)
router.delete('/reset', authorize('Manager'), resetDataset);

// @route   PUT /api/blocks/:id/assign
// @desc    Assign engineer to a block (Manager only)
router.put('/:id/assign', authorize('Manager'), assignEngineer);

// @route   PUT /api/blocks/:id/status
// @desc    Update block status (Engineer only)
router.put('/:id/status', authorize('Engineer'), updateStatus);

// @route   PUT /api/blocks/:id/review
// @desc    Approve or reject a block (Manager only)
router.put('/:id/review', authorize('Manager'), reviewBlock);

// @route   GET /api/blocks/:id/logs
// @desc    Get audit logs for a specific block
router.get('/:id/logs', getBlockLogs);

// @route   GET /api/blocks/logs/all
// @desc    Get global audit logs (Manager only)
router.get('/logs/all', authorize('Manager'), getGlobalLogs);

module.exports = router;
