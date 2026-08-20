const { validationResult, body, param } = require('express-validator');

// Middleware to check validation results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

const EXPERIENCE_TAGS = [
  'Delivery', 'Quality', 'Authenticity', 'Communication', 'Speed',
  'Value for Money', 'As Advertised', 'Would Buy Again', 'Packaging', 'Customer Service'
];

// Common validation rules
const validations = {
  // Auth validations
  register: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and number'),
    body('accountType')
      .custom((value, { req }) => {
        const accountType = value || req.body.userType || req.body.accountType;
        if (!['personal', 'business'].includes(accountType)) {
          throw new Error('Account type must be personal or business');
        }
        return true;
      }),
    body()
      .custom((_, { req }) => {
        const accountType = req.body.accountType || req.body.userType;
        const fullName = req.body.fullName?.trim();
        const firstName = req.body.firstName?.trim();
        const businessName = (req.body.businessName || req.body.companyName || req.body.company || '').trim();
        const contactName = (req.body.contactName || req.body.fullName || '').trim();

        if (accountType === 'personal' && !fullName && !firstName) {
          throw new Error('Personal sign up requires fullName or firstName');
        }

        if (accountType === 'business' && !businessName) {
          throw new Error('Business sign up requires businessName');
        }

        if (accountType === 'business' && !contactName) {
          throw new Error('Business sign up requires contactName');
        }

        return true;
      })
  ],

  login: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],

  forgotPassword: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required')
  ],

  resetPassword: [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and number')
  ],

  changePassword: [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('New password must contain uppercase, lowercase, and number')
  ],

  personalProfile: [
    body('firstName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('First name must be 1-100 characters'),
    body('lastName')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Last name must be 100 characters or fewer'),
    body('displayName')
      .optional()
      .trim()
      .isLength({ max: 150 })
      .withMessage('Display name must be 150 characters or fewer'),
    body('headline')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Headline must be 200 characters or fewer'),
    body('bio')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('Bio must be less than 2000 characters'),
    body('website')
      .optional({ values: 'falsy' })
      .isURL()
      .withMessage('Website must be a valid URL')
  ],

  businessProfile: [
    body('businessName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 255 })
      .withMessage('Business name must be 2-255 characters'),
    body('contactName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 200 })
      .withMessage('Contact name must be 2-200 characters'),
    body('businessType')
      .optional()
      .isIn(['startup', 'sme', 'enterprise', 'agency', 'nonprofit', 'other'])
      .withMessage('Invalid business type'),
    body('industry')
      .optional()
      .trim()
      .isLength({ max: 150 })
      .withMessage('Industry must be 150 characters or fewer'),
    body('description')
      .optional()
      .isLength({ max: 3000 })
      .withMessage('Description must be less than 3000 characters'),
    body('website')
      .optional({ values: 'falsy' })
      .isURL()
      .withMessage('Website must be a valid URL')
  ],

  // Vendor listing validations
  vendor: [
    body('name')
      .trim()
      .isLength({ min: 2, max: 255 })
      .withMessage('Business name must be 2-255 characters'),
    body('categoryId')
      .optional({ values: 'falsy' })
      .isUUID()
      .withMessage('Invalid category ID'),
    body('cityId')
      .optional({ values: 'falsy' })
      .isUUID()
      .withMessage('Invalid city ID'),
    body('primaryPlatform')
      .optional({ values: 'falsy' })
      .isIn(['instagram', 'tiktok', 'facebook', 'whatsapp', 'twitter', 'other'])
      .withMessage('Invalid platform'),
    body('handle')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ max: 100 })
      .withMessage('Handle must be 100 characters or fewer'),
    body('description')
      .optional({ values: 'falsy' })
      .isLength({ max: 3000 })
      .withMessage('Description must be less than 3000 characters')
  ],

  // Review validations
  review: [
    body('vendorId')
      .isUUID()
      .withMessage('Invalid vendor ID'),
    body('rating')
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
    body('content')
      .trim()
      .isLength({ min: 20, max: 2000 })
      .withMessage('Review must be between 20 and 2000 characters'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array')
      .custom((tags) => tags.every((t) => EXPERIENCE_TAGS.includes(t)))
      .withMessage('Tags must be from the supported experience tag list'),
    body('isAnonymous')
      .optional()
      .isBoolean()
      .withMessage('isAnonymous must be a boolean')
  ],

  reviewResponse: [
    body('response')
      .trim()
      .isLength({ min: 1, max: 2000 })
      .withMessage('Response must be between 1 and 2000 characters')
  ],

  reviewFlag: [
    body('reason')
      .trim()
      .isLength({ min: 3, max: 255 })
      .withMessage('Flag reason must be between 3 and 255 characters')
  ],

  fraudReport: [
    body('reasonTag')
      .trim()
      .isLength({ min: 3, max: 100 })
      .withMessage('Reason must be between 3 and 100 characters'),
    body('description')
      .optional({ values: 'falsy' })
      .isLength({ max: 1000 })
      .withMessage('Description must be less than 1000 characters')
  ],

  adminLogin: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],

  // UUID param validation
  uuidParam: (paramName = 'id') => [
    param(paramName)
      .isUUID()
      .withMessage(`Invalid ${paramName}`)
  ]
};

module.exports = {
  validate,
  validations
};
