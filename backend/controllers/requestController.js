const Request = require('../models/Request');
const Block = require('../models/Block');
const { createNotification } = require('../utils/notifier');

// @desc    Get all requests
// @route   GET /api/requests
// @access  Private
exports.getRequests = async (req, res, next) => {
    try {
        let query;
        if (req.user.role && req.user.role.toUpperCase() === 'MANAGER') {
            query = Request.find()
                .populate('requestedBy', 'displayName email')
                .populate('suggestedAssignee', 'displayName email')
                .populate('blockId', 'name status healthStatus');
        } else {
            query = Request.find({ requestedBy: req.user.id })
                .populate('requestedBy', 'displayName email')
                .populate('suggestedAssignee', 'displayName email')
                .populate('blockId', 'name status healthStatus');
        }
        
        const requests = await query.sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: requests.length, data: requests });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new request
// @route   POST /api/requests
// @access  Private
exports.createRequest = async (req, res, next) => {
    try {
        req.body.requestedBy = req.user.id;
        
        // Fallback for legacy 'title' requirement if model hasn't reloaded or for better indexing
        if (!req.body.title && req.body.type) {
            req.body.title = req.body.type;
        }

        const request = await Request.create(req.body);

        // Notify managers about new request
        const User = require('../models/User');
        const managers = await User.find({ 
            role: { $regex: /^manager$/i } 
        });
        
        for (const manager of managers) {
            await createNotification({
                userId: manager._id,
                title: 'New Operational Request',
                message: `${req.user.displayName} has submitted a ${request.type} request.`,
                type: 'SYSTEM'
            });
        }

        res.status(201).json({ success: true, data: request });
    } catch (error) {
        next(error);
    }
};

// @desc    Update request status
// @route   PUT /api/requests/:id/status
// @access  Private (Manager only)
exports.updateRequestStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const validStatuses = ['APPROVED', 'REJECTED'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const request = await Request.findById(req.params.id);

        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        if (request.status !== 'PENDING') {
            return res.status(400).json({ success: false, message: 'Only PENDING requests can be updated' });
        }

        const oldStatus = request.status;
        request.status = status;
        await request.save();

        // 0. Audit Log the status change (Manager decision)
        try {
            const { logAction } = require('../utils/logger');
            await logAction({
                userId: req.user.id,
                userRole: req.user.role,
                action: status === 'APPROVED' ? 'APPROVE' : 'REJECT',
                blockId: request.blockId,
                previousValue: oldStatus,
                newValue: status,
                message: `${request.type} request was ${status.toLowerCase()}. Justification provided: "${request.reason}"`
            });
        } catch (err) {
            console.error('[Audit] Failed to log request status update:', err);
        }

        if (status === 'APPROVED') {
            // Determine type with fallback for legacy data/unloaded schemas
            const type = request.type || request.title;
            const blockId = request.blockId;

            console.log(`[DEBUG] Approving ${type} request. BlockID: ${blockId}`);

            if (type === 'Escalation' && blockId) {
                const block = await Block.findById(blockId);
                if (block) {
                    block.escalationState = 'ESCALATED';
                    block.isEscalated = true;
                    await block.save();
                }
            } else if (type === 'Reassignment' && blockId) {
                console.log('[DEBUG] Executing In-Place Reassignment for block:', blockId);
                const block = await Block.findById(blockId);
                if (block) {
                    const previousEngineer = block.assignedEngineer;
                    
                    // Reset block for reassignment
                    block.isReassigned = true;
                    block.status = 'NOT_STARTED';
                    block.assignedEngineer = undefined;
                    block.progress = 0;
                    block.isExecuting = false;
                    block.executionState = 'NOT_STARTED';
                    
                    await block.save();
                }
            } else if (type === 'Dependency Unlock' && blockId) {
                const block = await Block.findById(blockId);
                if (block) {
                    block.priorityScore = Math.min(100, (block.priorityScore || 50) + 20);
                    await block.save();
                }
            }
        }

        // Notify requester (Engineer)
        await createNotification({
            userId: request.requestedBy,
            message: `REQUEST ${status}: Your ${request.type || request.title} request has been ${status.toLowerCase()} by management.`,
            type: status === 'APPROVED' ? 'APPROVAL' : 'REJECTION',
            severity: status === 'APPROVED' ? 'medium' : 'high',
            blockId: request.blockId
        });

        res.status(200).json({ success: true, data: request });
    } catch (error) {
        next(error);
    }
};
