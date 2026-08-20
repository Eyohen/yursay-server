/**
 * Checks req.admin.permissions[resource][action] === true. super_admin
 * bypasses the check entirely. Must run after adminAuth.
 */
const requireAdminPermission = (resource, action) => (req, res, next) => {
  const admin = req.admin;

  if (!admin) {
    return res.status(401).json({ success: false, error: 'Admin authentication required' });
  }

  if (admin.role === 'super_admin') {
    return next();
  }

  const allowed = admin.permissions?.[resource]?.[action];
  if (!allowed) {
    return res.status(403).json({
      success: false,
      error: `Missing permission: ${resource}.${action}`,
    });
  }

  next();
};

module.exports = requireAdminPermission;
