const permissionRoles = {
    overview: ["super_admin", "moderator", "support"],
    users_read: ["super_admin", "support"],
    user_support: ["super_admin", "support"],
    user_moderate: ["super_admin"],
    content_read: ["super_admin", "moderator"],
    content_moderate: ["super_admin", "moderator"],
    reports_read: ["super_admin", "moderator"],
    reports_moderate: ["super_admin", "moderator"],
    communities_read: ["super_admin", "moderator"],
    communities_moderate: ["super_admin", "moderator"],
    audit_read: ["super_admin"],
    settings_write: ["super_admin"],
    announcements_write: ["super_admin"]
};

const requirePermission = permission => (req, res, next) => {
    const allowed = permissionRoles[permission];
    if (!allowed) {
        return res.status(500).json({ success: false, message: "Invalid admin permission." });
    }

    const role = req.user?.adminRole || "super_admin";
    if (!allowed.includes(role)) {
        return res.status(403).json({ success: false, message: "You do not have permission to perform this action." });
    }

    return next();
};

module.exports = { requirePermission };
