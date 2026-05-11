const mongoose = require('mongoose');
const Request = require('./models/Request');
const dotenv = require('dotenv');

dotenv.config();

const check = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const requests = await Request.find();
    console.log('Total requests:', requests.length);
    if (requests.length > 0) {
        console.log('Types:', [...new Set(requests.map(r => r.type))]);
    }
    process.exit();
};

check();
