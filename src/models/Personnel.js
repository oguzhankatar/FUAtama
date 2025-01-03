const mongoose = require('mongoose');

const PersonnelSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^[\w-\.]+@firat\.edu\.tr$/, 'Sadece @firat.edu.tr uzantılı e-posta adresleri kabul edilir']
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    role: {
        type: String,
        enum: ['admin', 'sorumlu', 'gozetmen'],
        required: true
    },
    department: {
        type: String,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date
    },
    active: {
        type: Boolean,
        default: true
    },
    pagePermissions: {
        type: [String],
        default: [],
        validate: {
            validator: function(permissions) {
                const validPages = [
                    '/dashboard',
                    '/personnel',
                    '/data',
                    '/gozetmen',
                    '/atama',
                    '/calendar',
                    '/report',
                    '/fakulte',
                    '/viz',
                    '/lctr',
                    '/temp',
                    '/gruplandir',
                    '/otogruplandir',
                    '/sorunlular',
                    '/classReport',
                    '/supervisorReport',
                    '/activePeriod',
                    '/exam-dates'
                ];
                return permissions.every(permission => validPages.includes(permission));
            },
            message: 'Geçersiz sayfa izni'
        }
    }
});

// E-posta adresinden isim oluşturma
PersonnelSchema.pre('save', function(next) {
    if (!this.name && this.email) {
        // E-posta adresinden kullanıcı adını al
        const username = this.email.split('@')[0];
        // Nokta ve tire işaretlerini boşluğa çevir
        this.name = username.replace(/[.-]/g, ' ')
            // Her kelimenin ilk harfini büyük yap
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
    next();
});

module.exports = mongoose.model('Personnel', PersonnelSchema);
