const ensureAuth = (req, res, next) => {
    try {
        if (req.isAuthenticated()) {
            return next();
        }
        console.log('Authentication required, redirecting to login');
        res.redirect('/?error=auth_required');
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.redirect('/?error=auth_error');
    }
};

const ensureGuest = (req, res, next) => {
    try {
        if (req.isAuthenticated()) {
            return res.redirect('/dashboard.html');
        }
        next();
    } catch (error) {
        console.error('Guest middleware error:', error);
        next(error);
    }
};

const ensureFiratEmail = (req, res, next) => {
    try {
        if (!req.user) {
            console.log('No user found in session');
            return res.redirect('/?error=no_user');
        }
        
        if (!req.user.email.endsWith('@firat.edu.tr')) {
            console.log('Non-Firat email detected:', req.user.email);
            req.logout((err) => {
                if (err) {
                    console.error('Logout error:', err);
                }
                res.redirect('/?error=unauthorized_domain');
            });
            return;
        }
        next();
    } catch (error) {
        console.error('Firat email check error:', error);
        res.redirect('/?error=email_check_error');
    }
};

module.exports = {
    ensureAuth,
    ensureGuest,
    ensureFiratEmail
};
