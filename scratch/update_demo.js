const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'backend', 'controllers', 'blockController.js');
let content = fs.readFileSync(filePath, 'utf8');

const newLoadDemoData = `// @desc    Load demo data
// @route   POST /api/blocks/demo
// @access  Private (Manager only)
exports.loadDemoData = async (req, res, next) => {
    try {
        const AuditLog = require('../models/AuditLog');
        const User = require('../models/User');
        const Block = require('../models/Block');
        const workflowService = require('../services/workflowService');
        
        // 1. Wipe existing data
        await Block.deleteMany({});
        await AuditLog.deleteMany({});

        // 2. Get users for assignment
        const engineers = await User.find({ role: 'Engineer' });
        const manager = await User.findOne({ role: 'Manager' });
        const creatorId = manager ? manager._id : req.user.id;

        const distribution = [
            { status: 'NOT_STARTED', count: 1 },
            { status: 'IN_PROGRESS', count: 2 },
            { status: 'DRC', count: 2 },
            { status: 'LVS', count: 1 },
            { status: 'REVIEW', count: 1 },
            { status: 'COMPLETED', count: 1 }
        ];

        const targetHealths = [
            'HEALTHY', 'HEALTHY', 'HEALTHY', 'HEALTHY', 
            'AT_RISK', 'AT_RISK', 
            'CRITICAL', 'CRITICAL'
        ];
        
        for (let i = targetHealths.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [targetHealths[i], targetHealths[j]] = [targetHealths[j], targetHealths[i]];
        }

        const blockNames = [
            'Bandgap_Ref', 'LDO_Regulator', 'PLL_Core', 'SRAM_Array', 
            'ADC_SAR', 'DAC_IDAC', 'Bias_Gen', 'Level_Shifter',
            'Input_Buffer', 'Output_Stage', 'Charge_Pump', 'POR_Circuit'
        ];

        const workflow = workflowService.WORKFLOW_ORDER;
        const now = new Date();
        const hour = 60 * 60 * 1000;

        let nameIdx = 0;
        let blocksCreated = [];

        for (const item of distribution) {
            for (let c = 0; c < item.count; c++) {
                const name = blockNames[nameIdx % blockNames.length];
                const targetHealth = targetHealths[nameIdx]; 
                nameIdx++;

                const complexity = ['SIMPLE', 'MEDIUM', 'COMPLEX'][Math.floor(Math.random() * 3)];
                const techNode = ['12nm', '7nm', '28nm'][Math.floor(Math.random() * 3)];
                const assignedEng = engineers.length > 0 ? engineers[nameIdx % engineers.length] : null;

                let expectedDurationHours = 8;
                if (item.status === 'IN_PROGRESS') expectedDurationHours = Math.floor(Math.random() * 8) + 4; // 4-12h
                else if (item.status === 'DRC') expectedDurationHours = Math.floor(Math.random() * 8) + 6; // 6-14h
                else if (item.status === 'LVS') expectedDurationHours = Math.floor(Math.random() * 6) + 4; // 4-10h
                else if (item.status === 'REVIEW') expectedDurationHours = Math.floor(Math.random() * 3) + 1; // 1-4h

                let actualDurationHours = expectedDurationHours;
                if (item.status !== 'NOT_STARTED' && item.status !== 'COMPLETED') {
                    if (targetHealth === 'HEALTHY') actualDurationHours = expectedDurationHours - (Math.random() * 1);
                    else if (targetHealth === 'AT_RISK') actualDurationHours = expectedDurationHours * (1.1 + Math.random() * 0.15);
                    else if (targetHealth === 'CRITICAL') actualDurationHours = expectedDurationHours * (1.25 + Math.random() * 0.35);
                }
                
                // Truncate to 1 decimal place
                actualDurationHours = Math.round(actualDurationHours * 10) / 10;

                let rejectionCount = 0;
                if (targetHealth === 'AT_RISK') rejectionCount = Math.random() > 0.5 ? 1 : 0;
                if (targetHealth === 'CRITICAL') rejectionCount = Math.random() > 0.5 ? 2 : 1;
                if (item.status === 'NOT_STARTED' || item.status === 'COMPLETED') rejectionCount = 0;

                const healthStatus = targetHealth === 'AT_RISK' ? 'RISK' : (targetHealth === 'CRITICAL' ? 'CRITICAL' : 'HEALTHY');

                let block = new Block({
                    name,
                    complexity,
                    techNode,
                    status: item.status,
                    createdBy: creatorId,
                    assignedEngineer: item.status !== 'NOT_STARTED' ? (assignedEng ? assignedEng._id : null) : null,
                    rejectionCount,
                    expectedDurationHours,
                    actualDurationHours,
                    estimatedHours: expectedDurationHours * 4, // Roughly overall estimate
                    stageStartTime: new Date(now.getTime() - (actualDurationHours * hour)),
                    healthStatus: (item.status !== 'NOT_STARTED' && item.status !== 'COMPLETED') ? healthStatus : 'HEALTHY',
                    stageHistory: [],
                    totalTimeSpent: actualDurationHours,
                    dependencies: []
                });
                
                await block.save();
                blocksCreated.push(block);

                if (item.status === 'COMPLETED') {
                     await AuditLog.create({
                        userId: creatorId,
                        userRole: 'Manager',
                        action: 'APPROVE',
                        blockId: block._id,
                        previousValue: 'REVIEW',
                        newValue: 'COMPLETED',
                        message: \`Block approved by manager.\`,
                        timestamp: now
                    });
                }
            }
        }
        
        // --- Dependency Seeding ---
        const getBlockByName = (name) => blocksCreated.find(b => b.name === name);
        
        const adcSAR = getBlockByName('ADC_SAR');
        const pllCore = getBlockByName('PLL_Core');
        const sramArray = getBlockByName('SRAM_Array');
        const biasGen = getBlockByName('Bias_Gen');
        const dacIDAC = getBlockByName('DAC_IDAC');
        const ldoReg = getBlockByName('LDO_Regulator');
        
        if (adcSAR && pllCore) { 
            adcSAR.dependencies.push(pllCore._id); 
            await adcSAR.save(); 
            pllCore.blockedBy = adcSAR._id;
            await pllCore.save();
        }
        if (sramArray && biasGen) { 
            sramArray.dependencies.push(biasGen._id); 
            await sramArray.save(); 
            biasGen.blockedBy = sramArray._id;
            await biasGen.save();
        }
        if (dacIDAC && ldoReg) { 
            dacIDAC.dependencies.push(ldoReg._id); 
            await dacIDAC.save(); 
            ldoReg.blockedBy = dacIDAC._id;
            await ldoReg.save();
        }

        res.status(200).json({ success: true, message: 'Realistic demo data loaded successfully' });
    } catch (error) {
        next(error);
    }
};`;

const regex = /\/\/ @desc    Load demo data[\s\S]*?(?=\/\/ @desc    Get global audit logs)/;
content = content.replace(regex, newLoadDemoData + '\n');
fs.writeFileSync(filePath, content);
console.log('Successfully updated loadDemoData');
