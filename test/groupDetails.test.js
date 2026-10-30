const assert = require("node:assert/strict");
const test = require("node:test");
const GroupConversation = require("../models/GroupConversation");
const GroupCallKey = require("../models/GroupCallKey");
const LiveLocationShare = require("../models/LiveLocationShare");
const Message = require("../models/Message");
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

const makeGroupListQuery = (groups, pagination) => {
    let skip = 0;
    let limit = groups.length;
    return {
        sort() {
            return this;
        },
        skip(count) {
            skip = count;
            pagination.skip = count;
            return this;
        },
        limit(count) {
            limit = count;
            pagination.limit = count;
            return this;
        },
        populate() {
            return this;
        },
        then(resolve, reject) {
            return Promise.resolve(groups.slice(skip, skip + limit)).then(
                resolve,
                reject
            );
        }
    };
};

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

test("group listing paginates results and calculates unread counts for the current page", async () => {
    const originals = {
        find: GroupConversation.find,
        aggregate: Message.aggregate
    };
    const groups = [
        { _id: GROUP_ID, name: "First", participants: [ADMIN_ID] },
        {
            _id: "507f191e810c19729de860ec",
            name: "Second",
            participants: [ADMIN_ID]
        }
    ];
    const pagination = {};
    let unreadGroupIds;
    GroupConversation.find = filter => {
        assert.deepEqual(filter, { participants: ADMIN_ID });
        return makeGroupListQuery(groups, pagination);
    };
    Message.aggregate = async pipeline => {
        unreadGroupIds = pipeline[0].$match.groupId.$in;
        return [];
    };

    try {
        const response = makeResponse();
        await controller.listGroups(
            {
                user: { id: ADMIN_ID },
                query: { page: "1", limit: "1" }
            },
            response
        );

        assert.equal(response.body.page, 1);
        assert.equal(response.body.limit, 1);
        assert.equal(response.body.hasMore, true);
        assert.deepEqual(pagination, { skip: 0, limit: 2 });
        assert.deepEqual(
            response.body.data.map(group => group._id),
            [GROUP_ID]
        );
        assert.deepEqual(unreadGroupIds, [GROUP_ID]);
    } finally {
        GroupConversation.find = originals.find;
        Message.aggregate = originals.aggregate;
    }
});

test("removing a group member revokes their active live-location shares", async () => {
    const originals = {
        groupFindOne: GroupConversation.findOne,
        groupFindById: GroupConversation.findById,
        keyDelete: GroupCallKey.deleteOne,
        shareFind: LiveLocationShare.find,
        shareDeleteMany: LiveLocationShare.deleteMany
    };
    const group = {
        _id: GROUP_ID,
        name: "Team",
        createdBy: ADMIN_ID,
        admins: [ADMIN_ID],
        participants: [ADMIN_ID, MEMBER_ID],
        async save() {
            return this;
        },
        toObject() {
            return {
                _id: this._id,
                name: this.name,
                createdBy: this.createdBy,
                admins: this.admins,
                participants: this.participants
            };
        }
    };
    let shareFilter;
    let deletedShares;
    GroupConversation.findOne = async () => group;
    GroupConversation.findById = () => makePopulationQuery(group);
    GroupCallKey.deleteOne = async () => ({ deletedCount: 1 });
    LiveLocationShare.find = filter => {
        shareFilter = filter;
        return {
            select() {
                return this;
            },
            lean: async () => [{ _id: "507f191e810c19729de860ed" }]
        };
    };
    LiveLocationShare.deleteMany = async filter => {
        deletedShares = filter;
    };

    try {
        const response = makeResponse();
        await controller.removeGroupMember(
            {
                user: { id: ADMIN_ID },
                params: { groupId: GROUP_ID, userId: MEMBER_ID },
                app: { get: () => null }
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.deepEqual(group.participants, [ADMIN_ID]);
        assert.deepEqual(shareFilter, {
            groupId: GROUP_ID,
            sender: MEMBER_ID
        });
        assert.deepEqual(deletedShares, {
            _id: { $in: ["507f191e810c19729de860ed"] }
        });
    } finally {
        GroupConversation.findOne = originals.groupFindOne;
        GroupConversation.findById = originals.groupFindById;
        GroupCallKey.deleteOne = originals.keyDelete;
        LiveLocationShare.find = originals.shareFind;
        LiveLocationShare.deleteMany = originals.shareDeleteMany;
    }
});
