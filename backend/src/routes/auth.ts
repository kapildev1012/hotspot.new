import express from 'express';
import {
    changePassword,
    forgotPassword,
    getProfile,
    login,
    logout,
    refreshToken,
    register,
    resetPassword,
    updateProfile,
} from '../controllers/authController.js';
import {
    authenticate,
    authRateLimit,
    logAuthEvent
} from '../middleware/auth.js';

const router = express.Router();

// Public routes (no authentication required)
router.post('/register', authRateLimit, logAuthEvent('REGISTER'), register);
router.post('/login', authRateLimit, logAuthEvent('LOGIN'), login);
router.post('/refresh-token', authRateLimit, refreshToken);
router.post('/forgot-password', authRateLimit, logAuthEvent('FORGOT_PASSWORD'), forgotPassword);
router.put('/reset-password/:token', authRateLimit, logAuthEvent('RESET_PASSWORD'), resetPassword);

// Protected routes (authentication required)
router.use(authenticate); // All routes below this middleware require authentication

router.post('/logout', logAuthEvent('LOGOUT'), logout);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);

export default router;