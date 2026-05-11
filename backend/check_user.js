const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

const check = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findById('69ebb648b152a8997a8bd6fe');
    console.log('User:', JSON.stringify(user, null, 2));
    process.exit();
};

check();
