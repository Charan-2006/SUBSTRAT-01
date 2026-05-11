const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Block = require('./models/Block');

dotenv.config({ path: path.join(__dirname, '.env') });

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/substrat');
        const blocks = await Block.find({}, 'name status rejectionCount');
        console.log('--- BLOCKS STATUS ---');
        blocks.forEach(b => {
            console.log(`${b.name}: ${b.status} (Rejections: ${b.rejectionCount})`);
        });
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

check();
