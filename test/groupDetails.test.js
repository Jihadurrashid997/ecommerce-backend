const assert = require("node:assert/strict");
const test = require("node:test");
const GroupConversation = require("../models/GroupConversation");
const controller = require("../controllers/groupController");

const ADMIN_ID = "507f1f77bcf86cd799439011";
const MEMBER_ID = "507f191e810c19729de860ea";
const GROUP_ID = "507f191e810c19729de860eb";

const makeResponse = () => ({
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    },
    set(headers) {
        this.headers = { ...this.headers, ...headers };
        return this;
    },
    send(body) {
        this.sent = body;
        return this;
    }
});

const makePopulationQuery = group => ({
    populate() {
        return this;
    },
    then(resolve, reject) {
        return Promise.resolve(group).then(resolve, reject);
    }
});

test("only group admins can update group details", async () => {
    const originalFindOne = GroupConversation.findOne;
    let saved = false;
    GroupConversation.findOne = async () => ({
        admins: [ADMIN_ID],
        participants: [ADMIN_ID, MEMBER_ID],
        async save() {
            saved = true;
        }
    });

    try {
        const response = makeResponse();
        await controller.updateGroupDetails(
            {
                user: { id: MEMBER_ID },
                params: { groupId: GROUP_ID },
                body: { description: "Not allowed" }
            },
            response
        );

        assert.equal(response.statusCode, 403);
        assert.equal(saved, false);
    } finally {
        GroupConversation.findOne = originalFindOne;
    }
});

test("group admins can update descriptions and members receive a protected photo URL", async () => {
    const originals = {
        findOne: GroupConversation.findOne,
        findById: GroupConversation.findById
    };
    const group = {
        _id: GROUP_ID,
        name: "Team",
        description: "",
        groupPhoto: "/uploads/private-group.jpg",
        groupPhotoPublicId: "",
        groupPhotoStorageType: "image",
        groupPhotoType: "image/jpeg",
        admins: [ADMIN_ID],
        participants: [ADMIN_ID, MEMBER_ID],
        async save() {
            return this;
        },
        toObject() {
            return {
                _id: this._id,
                name: this.name,
                description: this.description,
                groupPhoto: this.groupPhoto,
                groupPhotoPublicId: this.groupPhotoPublicId,
                groupPhotoStorageType: this.groupPhotoStorageType,
                groupPhotoType: this.groupPhotoType,
                admins: this.admins,
                participants: this.participants
            };
        }
    };
    GroupConversation.findOne = async () => group;
    GroupConversation.findById = () => makePopulationQuery(group);

    try {
        const response = makeResponse();
        await controller.updateGroupDetails(
            {
                user: { id: ADMIN_ID },
                params: { groupId: GROUP_ID },
                body: { description: "Members only details" },
                app: { get: () => null }
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.equal(group.description, "Members only details");
        assert.equal(
            response.body.data.groupPhoto,
            `/groups/${GROUP_ID}/photo`
        );
        assert.equal(
            Object.hasOwn(response.body.data, "groupPhotoPublicId"),
            false
        );
    } finally {
        GroupConversation.findOne = originals.findOne;
        GroupConversation.findById = originals.findById;
    }
});

test("users who are not group members cannot retrieve its photo", async () => {
    const originalFindOne = GroupConversation.findOne;
    GroupConversation.findOne = () => ({
        select() {
            return Promise.resolve(null);
        }
    });

    try {
        const response = makeResponse();
        await controller.getGroupPhoto(
            {
                user: { id: MEMBER_ID },
                params: { groupId: GROUP_ID }
            },
            response
        );
        assert.equal(response.statusCode, 404);
        assert.equal(response.sent, undefined);
    } finally {
        GroupConversation.findOne = originalFindOne;
    }
});
