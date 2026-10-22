const assert = require("node:assert/strict");
const test = require("node:test");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ShopNotification = require("../models/ShopNotification");
const auth = require("../middleware/auth");
const sellerController = require("../controllers/sellerController");
const adminController = require("../controllers/adminController");

const makeResponse = () => ({
    statusCode: 200,
    body: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    }
});

test("seller application validates acceptance before saving", async () => {
    const originalFindById = User.findById;
    let databaseCalled = false;
    User.findById = () => {
        databaseCalled = true;
        throw new Error("Invalid applications must not be saved.");
    };

    try {
        const response = makeResponse();
        await sellerController.submitSellerApplication(
            {
                user: { id: "507f1f77bcf86cd799439011" },
                body: {
                    displayName: "Good Store",
                    contact: "01700000000",
                    termsAccepted: false
                }
            },
            response
        );

        assert.equal(response.statusCode, 400);
        assert.equal(databaseCalled, false);
    } finally {
        User.findById = originalFindById;
    }
});

test("seller application submission queues admin review without granting seller role", async () => {
    const originalFindById = User.findById;
    const originalFind = User.find;
    const originalBulkWrite = ShopNotification.bulkWrite;
    const user = {
        _id: "507f1f77bcf86cd799439011",
        role: "customer",
        sellerApplication: { status: "not_submitted" },
        save: async () => {}
    };
    let writes = [];
    User.findById = () => ({
        select: async () => user
    });
    User.find = () => ({
        select() {
            return this;
        },
        lean: async () => [{ _id: "507f1f77bcf86cd799439012" }]
    });
    ShopNotification.bulkWrite = async operations => {
        writes.push(...operations);
    };

    try {
        const response = makeResponse();
        await sellerController.submitSellerApplication(
            {
                user: { id: user._id },
                body: {
                    displayName: "Good Store",
                    contact: "01700000000",
                    businessName: "",
                    address: "",
                    termsAccepted: true
                }
            },
            response
        );

        assert.equal(response.statusCode, 202);
        assert.equal(user.role, "customer");
        assert.equal(user.sellerApplication.status, "pending_review");
        assert.equal(user.sellerApplication.displayName, "Good Store");
        assert.ok(user.sellerApplication.termsAcceptedAt instanceof Date);
        assert.equal(writes.length, 2);
        assert.ok(writes.every(operation =>
            operation.updateOne.update.$setOnInsert.type === "seller_application"
        ));
    } finally {
        User.findById = originalFindById;
        User.find = originalFind;
        ShopNotification.bulkWrite = originalBulkWrite;
    }
});

test("pending seller applicants are denied protected seller routes", async () => {
    const originalFindById = User.findById;
    const originalSecret = process.env.JWT_SECRET;
    const userId = "507f1f77bcf86cd799439011";
    process.env.JWT_SECRET = "seller-role-test-secret";
    auth.invalidate(userId);
    User.findById = () => ({
        select() {
            return this;
        },
        lean: async () => ({
            role: "customer",
            isSuspended: false,
            suspendedReason: ""
        })
    });

    try {
        const response = makeResponse();
        let nextCalled = false;
        await auth(["seller"])(
            {
                header: () => `Bearer ${jwt.sign({ id: userId }, process.env.JWT_SECRET)}`
            },
            response,
            () => {
                nextCalled = true;
            }
        );

        assert.equal(response.statusCode, 403);
        assert.equal(response.body.message, "Access Denied");
        assert.equal(nextCalled, false);
    } finally {
        User.findById = originalFindById;
        auth.invalidate(userId);
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
    }
});

test("admin approval atomically grants seller role only to pending applicants", async () => {
    const originalFindOneAndUpdate = User.findOneAndUpdate;
    const originalFind = User.find;
    const originalBulkWrite = ShopNotification.bulkWrite;
    const userId = "507f1f77bcf86cd799439011";
    let filter;
    let update;
    User.findOneAndUpdate = (nextFilter, nextUpdate) => {
        filter = nextFilter;
        update = nextUpdate;
        return {
            select: async () => ({ _id: userId, role: "seller" })
        };
    };
    User.find = () => ({
        select() {
            return this;
        },
        lean: async () => [{ _id: userId }]
    });
    ShopNotification.bulkWrite = async () => ({});

    try {
        const response = makeResponse();
        await adminController.reviewSellerApplication(
            {
                params: { userId },
                body: { status: "approved", reviewNote: "" },
                user: { id: "507f1f77bcf86cd799439012" }
            },
            response
        );

        assert.deepEqual(filter, {
            _id: userId,
            "sellerApplication.status": "pending_review"
        });
        assert.equal(update.$set.role, "seller");
        assert.equal(update.$set["sellerApplication.status"], "approved");
        assert.equal(response.body.success, true);
    } finally {
        User.findOneAndUpdate = originalFindOneAndUpdate;
        User.find = originalFind;
        ShopNotification.bulkWrite = originalBulkWrite;
    }
});

test("admin cannot reject an application without a meaningful review note", async () => {
    const originalFindOneAndUpdate = User.findOneAndUpdate;
    let databaseCalled = false;
    User.findOneAndUpdate = () => {
        databaseCalled = true;
        throw new Error("Invalid review must not be saved.");
    };

    try {
        const response = makeResponse();
        await adminController.reviewSellerApplication(
            {
                params: { userId: "507f1f77bcf86cd799439011" },
                body: { status: "rejected", reviewNote: " " },
                user: { id: "507f1f77bcf86cd799439012" }
            },
            response
        );

        assert.equal(response.statusCode, 400);
        assert.equal(databaseCalled, false);
    } finally {
        User.findOneAndUpdate = originalFindOneAndUpdate;
    }
});
