const express = require('express');
const router = express.Router();
const passport = require('passport');

// Google OAuth routes
router.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/',
        successRedirect: '/dashboard'
    })
);

// Logout route
router.get('/auth/logout', (req, res) => {
    req.logout(() => {
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destruction error:', err);
            }
            res.clearCookie('excel-to-mongodb.sid');
            res.redirect('/');
        });
    });
});

// Force refresh route
router.get('/auth/refresh', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Session refresh error:', err);
        }
        res.clearCookie('excel-to-mongodb.sid');
        res.redirect('/auth/google');
    });
});

module.exports = router;
