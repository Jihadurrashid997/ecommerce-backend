const AdminAuditLog = require("../models/AdminAuditLog");

exports.writeAuditLog = async (req, entry) => {
    await AdminAuditLog.create({
        admin: req.user.id,
        adminRole: req.user.adminRole || "super_admin",
        action: entry.action,
        targetType: entry.targetType,
        targetId: String(entry.targetId || ""),
        reason: String(entry.reason || "").slice(0, 500),
        details: entry.details || {}
    });
};
