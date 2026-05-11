const mongoose = require('mongoose');
const Block = require('./models/Block');
require('dotenv').config();

const checkDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const count = await Block.countDocuments();
        const latest = await Block.findOne().sort({ createdAt: -1 });
        console.log(`Total blocks: ${count}`);
        console.log(`Latest block: ${latest ? latest.name : 'None'}`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkDB();
