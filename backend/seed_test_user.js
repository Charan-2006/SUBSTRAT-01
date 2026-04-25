const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config({ path: './.env' });

const seedUser = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const userData = {
            googleId: 'test_manager_123',
            email: 'manager@test.com',
            displayName: 'Test Manager',
            role: 'Manager'
        };

        let user = await User.findOne({ googleId: userData.googleId });
        if (!user) {
            user = await User.create(userData);
            console.log('Test Manager created');
        } else {
            user.role = 'Manager';
            await user.save();
            console.log('Test Manager already exists, role ensured');
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: '30d'
        });

        console.log('TOKEN_START');
        console.log(token);
        console.log('TOKEN_END');

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedUser();
