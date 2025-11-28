const rateLimit = require('express-rate-limit');

const isTest = process.env.NODE_ENV === 'test';

// Helper to create limiter that does nothing in test
const createLimiter = (options) => {
    if (isTest) {
        return (req, res, next) => next();
    }
    return rateLimit(options);
};

// General API rate limiter
const apiLimiter = createLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Strict rate limiter for auth routes
const authLimiter = createLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 requests per windowMs (increased for better UX)
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// AI endpoint rate limiter
const aiLimiter = createLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 AI requests per minute
    message: 'Too many AI requests, please slow down.',
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    apiLimiter,
    authLimiter,
    aiLimiter
};
