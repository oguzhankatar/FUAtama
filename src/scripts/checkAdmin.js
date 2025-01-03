const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Personnel = require('../models/Personnel');

async function checkAdmin() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('MongoDB bağlantısı başarılı');

        const adminUser = await Personnel.findOne({ email: 'okatar@firat.edu.tr' });
        
        if (adminUser) {
            console.log('Admin user found:', {
                email: adminUser.email,
                role: adminUser.role,
                active: adminUser.active,
                name: adminUser.name
            });
        } else {
            console.log('Admin user not found');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('MongoDB bağlantısı kapatıldı');
    }
}

checkAdmin();
