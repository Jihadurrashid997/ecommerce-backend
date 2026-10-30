const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const Message = require("../models/Message");
const MessageRequest = require("../models/MessageRequest");
const User = require("../models/User");
const UserReport = require("../models/UserReport");
const controller = require("../controllers/messageRequestController");

const SENDER_ID = "507f1f77bcf86cd799439011";
const RECIPIENT_ID = "507f191e810c19729de860ea";
const REQUEST_ID = "507f191e810c19729de860eb";

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

const makeSession = () => ({
    async withTransaction(callback) {
        return callback();
    },
    async endSession() {}
});

const makeQuery = value => ({
    session() {
        return this;
    },
    lean() {
        return Promise.resolve(value);
    },
    then(resolve, reject) {
        return Promise.resolve(value).then(resolve, reject);
    }
});

const setup = () => {
    const originals = {
        startSession: mongoose.startSession,
        userFindById: User.findById,
        userFindOneAndUpdate: User.findOneAndUpdate,
        messageExists: Message.exists,
        messageRequestExists: MessageRequest.exists,
        messageRequestCreate: MessageRequest.create,
        messageRequestFindOneAndUpdate: MessageRequest.findOneAndUpdate,
        messageRequestFindOne: MessageRequest.findOne,
        messageCreate: Message.create,
        userReportCreate: UserReport.create
    };
    const userDocuments = {
        [SENDER_ID]: {
            _id: SENDER_ID,
            accountVisibility: "public",
            following: [],
            blockedUsers: []
        },
        [RECIPIENT_ID]: {
            _id: RECIPIENT_ID,
            accountVisibility: "private",
            following: [],
            blockedUsers: []
        }
    };

    mongoose.startSession = async () => makeSession();
    User.findById = id => ({
        select() {
            return this;
        },
        session() {
            return this;
        },
        lean: async () => userDocuments[String(id)] || null
    });
    User.findOneAndUpdate = async () => ({ _id: SENDER_ID });
    Message.exists = () => makeQuery(null);
    MessageRequest.exists = () => makeQuery(null);
    MessageRequest.create = async ([document]) => [{
        _id: REQUEST_ID,
        status: "pending",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        ...document
    }];
    MessageRequest.findOneAndUpdate = () => makeQuery(null);
    MessageRequest.findOne = () => ({
        select: async () => null
    });
    Message.create = async ([document]) => [{
        _id: "507f191e810c19729de860ec",
        ...document,
        toObject() {
            return { ...this };
        }
    }];
    UserReport.create = async document => document;

    return {
        userDocuments,
        restore() {
            mongoose.startSession = originals.startSession;
            User.findById = originals.userFindById;
            User.findOneAndUpdate = originals.userFindOneAndUpdate;
            Message.exists = originals.messageExists;
            MessageRequest.exists = originals.messageRequestExists;
            MessageRequest.create = originals.messageRequestCreate;
            MessageRequest.findOneAndUpdate = originals.messageRequestFindOneAndUpdate;
            MessageRequest.findOne = originals.messageRequestFindOne;
            Message.create = originals.messageCreate;
            UserReport.create = originals.userReportCreate;
        }
    };
};

const createRequest = (response, body = { message: "Hello" }) =>
    controller.createMessageRequest(
        {
            user: { id: SENDER_ID },
            body: { receiver: RECIPIENT_ID, ...body }
        },
        response
    );

test("Message Requests are stored separately and do not create conversation messages", async () => {
    const state = setup();
    let storedDocument;
    let createdMessage = false;
    MessageRequest.create = async ([document]) => {
        storedDocument = document;
        return [{
            _id: REQUEST_ID,
            status: "pending",
            createdAt: new Date(),
            ...document
        }];
    };
    Message.create = async () => {
        createdMessage = true;
        return [];
    };

    try {
        const response = makeResponse();
        await createRequest(response);

        assert.equal(response.statusCode, 201);
        assert.equal(response.body.data.status, "pending");
        assert.equal(storedDocument.sender, SENDER_ID);
        assert.equal(storedDocument.recipient, RECIPIENT_ID);
        assert.equal(storedDocument.message, "Hello");
        assert.equal(createdMessage, false);
    } finally {
        state.restore();
    }
});

test("duplicate pending Message Requests are rejected without another database write", async () => {
    const state = setup();
    let createCalls = 0;
    MessageRequest.exists = filter => makeQuery(
        filter.status === "pending" ? { _id: REQUEST_ID } : null
    );
    MessageRequest.create = async () => {
        createCalls += 1;
        return [];
    };

    try {
        const response = makeResponse();
        await createRequest(response);
        assert.equal(response.statusCode, 409);
        assert.equal(createCalls, 0);
    } finally {
        state.restore();
    }
});

test("a block added during request creation is rechecked before storage", async () => {
    const state = setup();
    let createCalls = 0;
    MessageRequest.exists = filter => {
        if (filter.status === "deleted") {
            state.userDocuments[RECIPIENT_ID].blockedUsers.push(SENDER_ID);
        }
        return makeQuery(null);
    };
    MessageRequest.create = async () => {
        createCalls += 1;
        return [];
    };

    try {
        const response = makeResponse();
        await createRequest(response);
        assert.equal(response.statusCode, 409);
        assert.equal(createCalls, 0);
    } finally {
        state.restore();
    }
});

test("deleted requests enforce the configured sender-recipient cooldown", async () => {
    const state = setup();
    let createCalls = 0;
    MessageRequest.exists = filter => makeQuery(
        filter.status === "deleted" ? { _id: REQUEST_ID } : null
    );
    MessageRequest.create = async () => {
        createCalls += 1;
        return [];
    };

    try {
        const response = makeResponse();
        await createRequest(response);
        assert.equal(response.statusCode, 429);
        assert.equal(createCalls, 0);
    } finally {
        state.restore();
    }
});

test("the configured daily limit blocks a sixth request attempt", async () => {
    const state = setup();
    const originalLimit = process.env.MESSENGER_MESSAGE_REQUESTS_PER_24H;
    process.env.MESSENGER_MESSAGE_REQUESTS_PER_24H = "5";
    User.findOneAndUpdate = async () => null;
    let createCalls = 0;
    MessageRequest.create = async () => {
        createCalls += 1;
        return [];
    };

    try {
        const response = makeResponse();
        await createRequest(response);
        assert.equal(response.statusCode, 429);
        assert.equal(createCalls, 0);
    } finally {
        if (originalLimit === undefined) {
            delete process.env.MESSENGER_MESSAGE_REQUESTS_PER_24H;
        } else {
            process.env.MESSENGER_MESSAGE_REQUESTS_PER_24H = originalLimit;
        }
        state.restore();
    }
});

test("acceptance promotes request content and attachments into the existing Message model", async () => {
    const state = setup();
    const originalRequest = {
        _id: REQUEST_ID,
        sender: SENDER_ID,
        recipient: RECIPIENT_ID,
        message: "Original request text",
        isEncrypted: false,
        fileUrl: "https://media.example/request.jpg",
        fileName: "photo.jpg",
        fileType: "image/jpeg",
        filePublicId: "media-id",
        fileStorageType: "image",
        fileDeliveryType: "authenticated",
        createdAt: new Date("2026-01-01T00:00:00.000Z")
    };
    let promotedMessage;
    MessageRequest.findOneAndUpdate = () => makeQuery(originalRequest);
    Message.create = async ([document]) => {
        promotedMessage = document;
        return [{
            _id: "507f191e810c19729de860ec",
            ...document,
            toObject() {
                return { ...this };
            }
        }];
    };

    try {
        const response = makeResponse();
        await controller.acceptMessageRequest(
            {
                params: { id: REQUEST_ID },
                user: { id: RECIPIENT_ID },
                app: { get: () => null }
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.equal(promotedMessage.message, "Original request text");
        assert.equal(promotedMessage.fileUrl, originalRequest.fileUrl);
        assert.equal(promotedMessage.fileName, originalRequest.fileName);
        assert.equal(promotedMessage.fileType, originalRequest.fileType);
        assert.equal(promotedMessage.filePublicId, originalRequest.filePublicId);
        assert.equal(
            promotedMessage.fileDeliveryType,
            originalRequest.fileDeliveryType
        );
        assert.equal(promotedMessage.createdAt, originalRequest.createdAt);
    } finally {
        state.restore();
    }
});

test("deleting a Message Request is recipient-scoped and does not notify the sender", async () => {
    const state = setup();
    const previousRequest = {
        _id: REQUEST_ID,
        recipient: RECIPIENT_ID,
        fileUrl: "",
        filePublicId: ""
    };
    let query;
    MessageRequest.findOneAndUpdate = (filter, update) => {
        query = { filter, update };
        return Promise.resolve(previousRequest);
    };
    const emitted = [];

    try {
        const response = makeResponse();
        await controller.deleteMessageRequest(
            {
                params: { id: REQUEST_ID },
                user: { id: RECIPIENT_ID },
                app: {
                    get: () => ({
                        emit: (...args) => emitted.push(args)
                    })
                }
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.equal(query.filter.recipient, RECIPIENT_ID);
        assert.equal(query.filter.status, "pending");
        assert.equal(query.update.$set.status, "deleted");
        assert.equal(query.update.$set.deletedAt instanceof Date, true);
        assert.equal(emitted.length, 0);
    } finally {
        state.restore();
    }
});

test("only the recipient can report a pending Message Request", async () => {
    const state = setup();
    let report;
    MessageRequest.findOne = () => ({
        select: async () => ({
            _id: REQUEST_ID,
            sender: SENDER_ID
        })
    });
    UserReport.create = async document => {
        report = document;
    };

    try {
        const response = makeResponse();
        await controller.reportMessageRequest(
            {
                params: { id: REQUEST_ID },
                user: { id: RECIPIENT_ID },
                body: { reason: "Spam" }
            },
            response
        );
        assert.equal(response.statusCode, 201);
        assert.equal(report.reporter, RECIPIENT_ID);
        assert.equal(report.reportedUser, SENDER_ID);
        assert.equal(report.messageRequest, REQUEST_ID);

        const denied = makeResponse();
        MessageRequest.findOne = () => ({
            select: async () => null
        });
        await controller.reportMessageRequest(
            {
                params: { id: REQUEST_ID },
                user: { id: SENDER_ID },
                body: {}
            },
            denied
        );
        assert.equal(denied.statusCode, 404);
    } finally {
        state.restore();
    }
});

test("message request models enforce pending-pair uniqueness and report uniqueness", () => {
    const pendingIndex = MessageRequest.schema.indexes().find(
        ([keys, options]) =>
            keys.sender === 1 &&
            keys.recipient === 1 &&
            options.unique === true
    );
    const reportIndex = UserReport.schema.indexes().find(
        ([keys, options]) =>
            keys.reporter === 1 &&
            keys.messageRequest === 1 &&
            options.unique === true
    );

    assert.equal(pendingIndex[1].partialFilterExpression.status, "pending");
    assert.equal(reportIndex[1].unique, true);
});
