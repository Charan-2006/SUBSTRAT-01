const mongoose = require('mongoose');
const User = require('./backend/models/User');
require('dotenv').config({ path: './backend/.env' });

async function checkUsers() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');
        const users = await User.find({});
        console.log('Total Users:', users.length);
        users.forEach(u => {
            console.log(`- ${u.displayName} (${u.email}) Role: ${u.role}`);
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkUsers();
