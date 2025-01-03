const Personnel = require('../models/Personnel');

const hasPagePermission = (requiredPage) => {
    return async (req, res, next) => {
        try {
            if (!req.isAuthenticated()) {
                return res.status(401).json({ error: 'Oturum açmanız gerekiyor' });
            }

            const personnel = await Personnel.findOne({ email: req.user.email });
            
            if (!personnel) {
                return res.status(404).json({ error: 'Personel kaydı bulunamadı' });
            }

            // Admin her sayfaya erişebilir
            if (personnel.role === 'admin') {
                return next();
            }

            // Kullanıcının sayfa izinlerini kontrol et
            if (!personnel.pagePermissions.includes(requiredPage)) {
                return res.status(403).json({ 
                    error: 'Bu sayfaya erişim yetkiniz bulunmamaktadır'
                });
            }

            next();
        } catch (error) {
            console.error('Sayfa yetki kontrolü hatası:', error);
            res.status(500).json({ error: 'Yetki kontrolü sırasında bir hata oluştu' });
        }
    };
};

module.exports = { hasPagePermission };
