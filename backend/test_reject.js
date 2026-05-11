const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Block = require('./models/Block');

dotenv.config({ path: path.join(__dirname, '.env') });

async function reject() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const block = await Block.findOne({ name: 'Band' });
        if (!block) {
            console.log('Block Band not found');
            return;
        }
        
        console.log(`Current Status: ${block.status}, Rejections: ${block.rejectionCount}`);
        
        block.status = 'IN_PROGRESS';
        block.rejectionCount += 1;
        await block.save();
        
        console.log(`Updated Status: ${block.status}, Rejections: ${block.rejectionCount}`);
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

reject();
