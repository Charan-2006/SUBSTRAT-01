// @desc    Escalate a block
// @route   PUT /api/blocks/:id/escalate
// @access  Private (Manager only)
exports.escalateBlock = async (req, res, next) => {
    try {
        let block = await Block.findById(req.params.id);

        if (!block) {
            return res.status(404).json({ success: false, message: 'Block not found' });
        }

        if (block.escalated) {
            return res.status(400).json({ success: false, message: 'Block is already escalated' });
        }

        block.escalated = true;
        block.healthStatus = 'CRITICAL';
        block.priority = 10;
        block.bottleneckImpact = (block.bottleneckImpact || 0) + 25;
        
        await block.save();

        if (block.assignedEngineer) {
            await createNotification({
                userId: block.assignedEngineer,
                message: `URGENT: Block ${block.name} has been escalated by management.`,
                type: 'SYSTEM',
                blockId: block._id
            });
        }

        await logAction({
            userId: req.user.id,
            userRole: req.user.role,
            action: 'ESCALATE',
            blockId: block._id,
            previousValue: 'false',
            newValue: 'true',
            message: `Block escalated. Priority increased to 10. Health status updated to CRITICAL.`
        });

        res.status(200).json({ success: true, data: block });
    } catch (error) {
        next(error);
    }
};
