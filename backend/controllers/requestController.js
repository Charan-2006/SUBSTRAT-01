const Request = require('../models/Request');
const Block = require('../models/Block');
const { createNotification } = require('../utils/notifier');

// @desc    Get all requests
// @route   GET /api/requests
// @access  Private
exports.getRequests = async (req, res, next) => {
    try {
        let query;
        if (req.user.role === 'Manager') {
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
        const request = await Request.create(req.body);

        // Notify managers about new request
        // In a real app we'd find all managers, here we can broadcast or skip for brevity.

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
            // Convert to Block
            const blockData = {
                name: request.title,
                description: request.description,
                complexity: request.priority === 'HIGH' ? 'COMPLEX' : (request.priority === 'LOW' ? 'SIMPLE' : 'MEDIUM'),
                status: request.stage || 'NOT_STARTED',
                createdBy: req.user.id,
                techNode: '7nm', // Default or could add to request model
                assignedEngineer: request.suggestedAssignee
            };
            
            const block = await Block.create(blockData);

            if (block.assignedEngineer) {
                await createNotification({
                    userId: block.assignedEngineer,
                    title: 'New Block Assigned',
                    message: `You have been assigned to newly approved block: ${block.name}`,
                    type: 'ASSIGNMENT'
                });
            }
        }

        // Notify requester
        await createNotification({
            userId: request.requestedBy,
            title: `Request ${status}`,
            message: `Your request "${request.title}" has been ${status.toLowerCase()}.`,
            type: status === 'APPROVED' ? 'STATUS_UPDATE' : 'WARNING'
        });

        res.status(200).json({ success: true, data: request });
    } catch (error) {
        next(error);
    }
};
