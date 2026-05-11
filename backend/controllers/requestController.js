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
            query = Request.find().populate('requestedBy', 'displayName email').populate('suggestedAssignee', 'displayName email');
        } else {
            query = Request.find({ requestedBy: req.user.id }).populate('requestedBy', 'displayName email').populate('suggestedAssignee', 'displayName email');
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

        request.status = status;
        await request.save();

        if (status === 'APPROVED') {
            // Handle different request types
            if (request.type === 'Escalation' && request.blockId) {
                const block = await Block.findById(request.blockId);
                if (block) {
                    block.escalationState = 'ESCALATED';
                    block.isEscalated = true;
                    await block.save();
                }
            } else if (request.type === 'Reassignment' && request.blockId && request.suggestedAssignee) {
                const block = await Block.findById(request.blockId);
                if (block) {
                    block.assignedEngineer = request.suggestedAssignee;
                    await block.save();
                }
            } else if (request.type === 'Dependency Unlock' && request.blockId) {
                // Logic to "unlock" or speed up dependencies could go here
                // For now, maybe just log it or mark as priority
                const block = await Block.findById(request.blockId);
                if (block) {
                    block.priorityScore = Math.min(100, (block.priorityScore || 50) + 20);
                    await block.save();
                }
            }
        }

        // Notify requester
        await createNotification({
            userId: request.requestedBy,
            title: `Request ${status}`,
            message: `Your ${request.type} request for "${request.reason.substring(0, 20)}..." has been ${status.toLowerCase()}.`,
            type: status === 'APPROVED' ? 'STATUS_UPDATE' : 'WARNING'
        });

        res.status(200).json({ success: true, data: request });
    } catch (error) {
        next(error);
    }
};
