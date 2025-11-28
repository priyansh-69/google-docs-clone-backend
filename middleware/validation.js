const { body, param, validationResult } = require('express-validator');

// Middleware to check validation results
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

// Validation rules for user registration
const registerValidation = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be between 3 and 30 characters'),
    body('email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    validate
];

// Validation rules for user login
const loginValidation = [
    body('email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
    validate
];

// Validation rules for document creation
const createDocumentValidation = [
    body('title')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Title must not exceed 200 characters')
        .escape(),
    body('documentId')
        .notEmpty()
        .withMessage('Document ID is required')
        .isUUID()
        .withMessage('Document ID must be a valid UUID'),
    validate
];

// Validation rules for document title update
const updateDocumentTitleValidation = [
    param('id')
        .notEmpty()
        .withMessage('Document ID is required'),
    body('title')
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Title must be between 1 and 200 characters')
        .escape(),
    validate
];

// Validation rules for AI processing
const aiProcessValidation = [
    body('text')
        .trim()
        .notEmpty()
        .withMessage('Text is required')
        .isLength({ max: 10000 })
        .withMessage('Text must not exceed 10000 characters'),
    body('action')
        .notEmpty()
        .withMessage('Action is required')
        .isIn(['grammar', 'summarize', 'enhance', 'expand', 'simplify'])
        .withMessage('Invalid action type'),
    validate
];

// Validation rules for document ID parameter
const documentIdValidation = [
    param('id')
        .notEmpty()
        .withMessage('Document ID is required'),
    validate
];

module.exports = {
    registerValidation,
    loginValidation,
    createDocumentValidation,
    updateDocumentTitleValidation,
    aiProcessValidation,
    documentIdValidation,
    validate
};
