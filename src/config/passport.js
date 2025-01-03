const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const config = require('./auth');

passport.serializeUser((user, done) => {
    console.log('Serializing user:', user);
    done(null, user);
});

passport.deserializeUser(async (user, done) => {
    try {
        console.log('Deserializing user:', user);
        const Personnel = require('../models/Personnel');
        const personnel = await Personnel.findOne({ email: user.email });
        
        if (!personnel) {
            console.log('Personnel not found during deserialization');
            return done(null, false);
        }

        const refreshedUser = {
            ...user,
            role: personnel.role,
            displayName: personnel.name
        };

        console.log('Refreshed user:', refreshedUser);
        done(null, refreshedUser);
    } catch (error) {
        console.error('Deserialization error:', error);
        done(error);
    }
});

passport.use(new GoogleStrategy({
    clientID: config.google.clientID,
    clientSecret: config.google.clientSecret,
    callbackURL: config.google.callbackURL,
    proxy: true,
    passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
    console.log('Google Strategy Callback');
    console.log('Profile:', {
        id: profile.id,
        displayName: profile.displayName,
        emails: profile.emails,
        provider: profile.provider
    });
    try {
        console.log('Google OAuth callback received for profile:', profile.id);
        
        if (!profile.emails || profile.emails.length === 0) {
            console.error('No email found in Google profile');
            return done(null, false, { message: 'No email found in Google profile' });
        }

        const email = profile.emails[0].value;
        console.log('User email:', email);
        
        // Check if email is from firat.edu.tr domain
        if (!email.endsWith('@firat.edu.tr')) {
            console.log('Non-Firat email attempted login:', email);
            return done(null, false, { message: 'Only @firat.edu.tr email addresses are allowed' });
        }

        // Personnel modelini kullanarak kullanıcıyı kontrol et
        const Personnel = require('../models/Personnel');
        let personnel = await Personnel.findOne({ email });

        if (!personnel) {
            // İlk giriş yapan kullanıcıyı gozetmen olarak kaydet
            personnel = new Personnel({
                email,
                name: profile.displayName || email.split('@')[0],
                role: 'gozetmen'
            });
            await personnel.save();
            console.log('New personnel created:', personnel.email);
        }

        if (!personnel.active) {
            console.log('Inactive personnel attempted login:', email);
            return done(null, false, { message: 'Your account is inactive' });
        }

        // Update lastLogin
        personnel.lastLogin = new Date();
        await personnel.save();

        console.log('Personnel from database:', {
            email: personnel.email,
            name: personnel.name,
            role: personnel.role,
            active: personnel.active
        });

        const user = {
            googleId: profile.id,
            displayName: personnel.name,
            email: email,
            image: profile.photos ? profile.photos[0].value : null,
            role: personnel.role
        };

        console.log('Created user object:', user);
        console.log('User authenticated successfully:', user.displayName, 'with role:', user.role);
        return done(null, user);
    } catch (error) {
        console.error('Authentication error:', error);
        return done(error);
    }
}));

module.exports = passport;
