const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Personnel = require('../models/Personnel');

const adminEmail = process.argv[2];

if (!adminEmail || !adminEmail.endsWith('@firat.edu.tr')) {
    console.error('Lütfen geçerli bir @firat.edu.tr e-posta adresi girin.');
    process.exit(1);
}

async function createAdmin() {
    let connection;
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/excel-to-mongodb';
        console.log('Connecting to MongoDB...', mongoUri);
        
        connection = await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('MongoDB bağlantısı başarılı');

        // Mevcut admin kontrolü
        const existingAdmin = await Personnel.findOne({ role: 'admin' });
        if (existingAdmin) {
            console.log('Sistemde zaten bir admin kullanıcı mevcut:', existingAdmin.email);
            process.exit(0);
        }

        // Yeni admin oluştur
        const admin = new Personnel({
            email: adminEmail,
            name: adminEmail.split('@')[0],
            role: 'admin',
            active: true
        });

        await admin.save();
        console.log('Admin kullanıcı başarıyla oluşturuldu:', admin.email);
        process.exit(0);
    } catch (error) {
        console.error('Hata detayı:', error);
        process.exit(1);
    } finally {
        if (connection) {
            try {
                await mongoose.disconnect();
                console.log('MongoDB bağlantısı kapatıldı');
            } catch (error) {
                console.error('Bağlantı kapatma hatası:', error);
            }
        }
    }
}

// Script'i çalıştır
createAdmin().catch(error => {
    console.error('Beklenmeyen hata:', error);
    process.exit(1);
});

// Kullanım:
// node createAdmin.js admin@firat.edu.tr
