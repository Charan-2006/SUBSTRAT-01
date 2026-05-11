const mongoose = require('mongoose');
const Block = require('./models/Block');
const Request = require('./models/Request');
const dotenv = require('dotenv');

dotenv.config();

const check = async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/substrat');
    const blocks = await Block.find({ name: 'Reassignment' });
    console.log('Blocks named Reassignment:', blocks.length);
    if (blocks.length > 0) {
        console.log('First one:', JSON.stringify(blocks[0], null, 2));
    }
    
    const requests = await Request.find({ type: 'Reassignment' });
    console.log('Requests of type Reassignment:', requests.length);
    
    process.exit();
};

check();
