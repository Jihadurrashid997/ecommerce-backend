const assert = require("node:assert/strict");
const test = require("node:test");
const GroupConversation = require("../models/GroupConversation");
const Message = require("../models/Message");
const controller = require("../controllers/messageController");

const USER_ID = "507f1f77bcf86cd799439011";
const GROUP_ID = "507f191e810c19729de860ea";
const MESSAGE_ID = "507f191e810c19729de860eb";

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

const makeMessage = () => ({
    _id: MESSAGE_ID,
    sender: USER_ID,
    receiver: null,
    groupId: GROUP_ID,
    message: "📍 Approximate location\n23.7807,90.4071",
    type: "location",
    isEncrypted: false,
    isDeleted: false,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    fileUrl: "",
    filePublicId: "",
    reactions: [],
    async save() {}
});

test("location messages cannot be edited", async () => {
    const originals = {
        findById: Message.findById,
        groupExists: GroupConversation.exists
    };
    const message = makeMessage();
    Message.findById = async () => message;
    GroupConversation.exists = async () => true;

    try {
        const response = makeResponse();
        await controller.editMessage(
            {
                user: { id: USER_ID },
                params: { id: MESSAGE_ID },
                body: { message: "Changed coordinates" }
            },
            response
        );

        assert.equal(response.statusCode, 400);
        assert.match(response.body.message, /cannot be edited/i);
        assert.equal(message.message, "📍 Approximate location\n23.7807,90.4071");
    } finally {
        Message.findById = originals.findById;
        GroupConversation.exists = originals.groupExists;
    }
});

test("location messages can be deleted for everyone after the normal time limit", async () => {
    const originals = {
        findById: Message.findById,
        groupExists: GroupConversation.exists,
        groupFindById: GroupConversation.findById
    };
    const message = makeMessage();
    let findByIdCalls = 0;
    Message.findById = () => {
        findByIdCalls += 1;
        if (findByIdCalls === 1) {
            return Promise.resolve(message);
        }
        return {
            populate() {
                return this;
            },
            then(resolve, reject) {
                return Promise.resolve(message).then(resolve, reject);
            }
        };
    };
    GroupConversation.exists = async () => true;
    GroupConversation.findById = async () => null;

    try {
        const response = makeResponse();
        await controller.deleteMessage(
            {
                user: { id: USER_ID },
                params: { id: MESSAGE_ID },
                body: { deleteFor: "everyone" },
                app: { get: () => null }
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.equal(message.isDeleted, true);
    } finally {
        Message.findById = originals.findById;
        GroupConversation.exists = originals.groupExists;
        GroupConversation.findById = originals.groupFindById;
    }
});
