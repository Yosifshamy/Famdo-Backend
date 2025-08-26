const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

const router = express.Router();

// Debug route to check environment variables
router.get('/debug', (req, res) => {
  res.json({
    message: 'Debug info',
    env: {
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      clientIdLength: process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.length : 0,
      callbackURL: "/api/auth/google/callback",
      fullCallbackURL: `${req.protocol}://${req.get('host')}/api/auth/google/callback`,
      frontendUrl: process.env.FRONTEND_URL
    }
  });
});

// Configure Google OAuth Strategy with better error handling
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/api/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('Google OAuth callback received for:', profile.emails[0].value);

    // Check if user already exists
    let user = await User.findOne({
      $or: [
        { googleId: profile.id },
        { email: profile.emails[0].value }
      ]
    });

    if (user) {
      console.log('Existing user found:', user.email);
      // User exists, update googleId if not set
      if (!user.googleId) {
        user.googleId = profile.id;
        user.displayName = profile.displayName;
        user.avatar = profile.photos[0]?.value;
        await user.save();
      }
      return done(null, user);
    }

    console.log('Creating new user for:', profile.emails[0].value);
    // Create new user
    user = await User.create({
      googleId: profile.id,
      email: profile.emails[0].value,
      username: profile.emails[0].value.split('@')[0] + '_' + Date.now(),
      passwordHash: 'google-oauth',
      displayName: profile.displayName,
      avatar: profile.photos[0]?.value
    });

    console.log('New user created:', user.email);
    return done(null, user);
  } catch (error) {
    console.error('Google OAuth strategy error:', error);
    return done(error, null);
  }
}));

// Google OAuth routes with better error handling
router.get('/google', (req, res, next) => {
  console.log('Google OAuth route hit');
  console.log('Environment check:', {
    hasClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET
  });
  next();
}, passport.authenticate('google', {
  scope: ['profile', 'email']
}));

router.get('/google/callback', (req, res, next) => {
  console.log('Google callback route hit');
  console.log('Query params:', req.query);
  console.log('Full URL:', req.url);
  next();
}, passport.authenticate('google', {
  session: false,
  failureRedirect: '/auth/google/error'
}), (req, res) => {
  try {
    console.log('Google callback success, user:', req.user ? req.user.email : 'No user');

    if (!req.user) {
      throw new Error('No user returned from Google OAuth');
    }

    // Generate JWT token
    const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Prepare user data
    const userData = {
      id: req.user._id,
      email: req.user.email,
      username: req.user.username,
      displayName: req.user.displayName,
      avatar: req.user.avatar
    };

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify(userData))}`;

    console.log('Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Error in Google callback:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/login?error=auth_callback_failed`);
  }
});

// Error route
router.get('/google/error', (req, res) => {
  console.log('Google OAuth error route hit');
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  res.redirect(`${frontendUrl}/login?error=google_oauth_failed`);
});

// Test route
router.get('/test', (req, res) => {
  res.json({
    message: 'Auth routes are working!',
    env: {
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      frontendUrl: process.env.FRONTEND_URL
    }
  });
});

// Your existing routes...
router.post('/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    if (!email || !username || !password) return res.status(400).json({ error: 'Email & username & password required' });

    // Check if email exists with Google OAuth
    const googleUser = await User.findOne({
      email,
      passwordHash: 'google-oauth'
    });

    if (googleUser) {
      return res.status(409).json({
        error: 'This email is already registered with Google. Please use "Continue with Google" to login.'
      });
    }

    // Check for other existing users
    const exists = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (exists) {
      if (exists.email === email) {
        return res.status(409).json({ error: 'Email already in use' });
      } else {
        return res.status(409).json({ error: 'Username already in use' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, username, passwordHash });
    return res.status(201).json({ id: user._id, email: user.email });
  } catch (e) {
    console.error('Registration error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    if (user.passwordHash === 'google-oauth') {
      return res.status(401).json({
        error: 'This account uses Google login. Please use "Continue with Google" to login.'
      });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: { id: user._id, email: user.email, username: user.username } });
  } catch (e) {
    console.error('Login error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;