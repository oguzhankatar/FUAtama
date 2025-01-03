const Personnel = require('../models/Personnel');

// Rol kontrolü için middleware
const checkRole = (...roles) => {
    return async (req, res, next) => {
        try {
            console.log('Role check middleware - Session:', req.session);
            console.log('Role check middleware - User:', req.user);
            console.log('Required roles:', roles);

            if (!req.isAuthenticated()) {
                console.log('User is not authenticated');
                return res.status(401).json({ error: 'Oturum açmanız gerekiyor' });
            }

            console.log('Looking up personnel with email:', req.user.email);
            const personnel = await Personnel.findOne({ email: req.user.email });
            
            if (!personnel) {
                console.log('Personnel not found for email:', req.user.email);
                return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
            }

            console.log('Found personnel:', {
                email: personnel.email,
                role: personnel.role,
                name: personnel.name
            });

            if (!roles.includes(personnel.role)) {
                console.log('Role check failed. User role:', personnel.role, 'Required roles:', roles);
                return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
            }

            console.log('Role check passed for user:', personnel.email);
            // Personel bilgilerini request nesnesine ekle
            req.personnel = personnel;
            next();
        } catch (error) {
            console.error('Rol kontrolü hatası:', error);
            res.status(500).json({ error: 'Sunucu hatası' });
        }
    };
};

// Yardımcı fonksiyonlar
const isAdmin = checkRole('admin');
const isSorumlu = checkRole('admin', 'sorumlu');
const isGozetmen = checkRole('admin', 'sorumlu', 'gozetmen');

module.exports = {
    checkRole,
    isAdmin,
    isSorumlu,
    isGozetmen
};
