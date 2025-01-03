require('dotenv').config();

module.exports = {
    google: {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/auth/google/callback',
        allowedDomains: ['firat.edu.tr'], // Only allow firat.edu.tr email addresses
        scope: ['profile', 'email']
    },
    session: {
        name: 'excel-to-mongodb.sid',
        secret: process.env.SESSION_SECRET || '1345',
        resave: true,
        saveUninitialized: true,
        rolling: true,
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
    }
};
