const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Personnel = require('../models/Personnel');

async function verifyAdminRole() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('MongoDB bağlantısı başarılı');

        // Find admin user
        const adminUser = await Personnel.findOne({ email: 'okatar@firat.edu.tr' });
        
        if (adminUser) {
            console.log('Admin user details:', {
                email: adminUser.email,
                role: adminUser.role,
                active: adminUser.active,
                name: adminUser.name,
                _id: adminUser._id
            });

            // Ensure role is exactly 'admin'
            if (adminUser.role !== 'admin') {
                console.log('Fixing admin role...');
                adminUser.role = 'admin';
                await adminUser.save();
                console.log('Admin role fixed');
            }
        } else {
            console.log('Creating new admin user...');
            const admin = new Personnel({
                email: 'okatar@firat.edu.tr',
                name: 'okatar',
                role: 'admin',
                active: true
            });
            await admin.save();
            console.log('New admin user created:', admin);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('MongoDB bağlantısı kapatıldı');
    }
}

verifyAdminRole();
