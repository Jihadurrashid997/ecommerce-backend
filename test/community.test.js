const assert = require("node:assert/strict");
const test = require("node:test");
const Community = require("../models/Community");
const Post = require("../models/Post");
const communityController = require("../controllers/communityController");
const postController = require("../controllers/postController");

const CREATOR_ID = "507f1f77bcf86cd799439011";
const MEMBER_ID = "507f191e810c19729de860ea";
const COMMUNITY_ID = "507f191e810c19729de860eb";
const OTHER_ADMIN_ID = "507f191e810c19729de860ec";
const THIRD_ADMIN_ID = "507f191e810c19729de860ed";

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

test("communities require a name and support public/private visibility", () => {
    const community = new Community({
        name: "Dhaka Photography",
        privacy: "private",
        createdBy: CREATOR_ID,
        admins: [CREATOR_ID],
        members: [CREATOR_ID]
    });

    assert.equal(community.validateSync(), undefined);
    assert.equal(
        new Community({
            name: "x",
            privacy: "unlisted",
            createdBy: CREATOR_ID
        }).validateSync().errors.privacy.kind,
        "enum"
    );
});

test("public community members can publish a community post", () => {
    const post = new Post({
        author: MEMBER_ID,
        community: COMMUNITY_ID,
        kind: "post",
        caption: "A community update",
        media: []
    });

    assert.equal(post.validateSync(), undefined);
    assert.equal(String(post.community), COMMUNITY_ID);
});

test("shared post detail returns a shaped public post", async () => {
    const originalFindById = Post.findById;
    const post = {
        _id: "507f1f77bcf86cd799439012",
        author: { _id: CREATOR_ID, name: "Creator" },
        caption: "A shareable update",
        media: [],
        likes: [MEMBER_ID],
        comments: [{}],
        createdAt: new Date()
    };
    Post.findById = () => ({
        populate() {
            return this;
        },
        lean: async () => post
    });

    try {
        const response = makeResponse();
        await postController.getPost({
            params: { id: post._id },
            user: { id: MEMBER_ID }
        }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.data._id, post._id);
        assert.equal(response.body.data.likeCount, 1);
        assert.equal(response.body.data.commentCount, 1);
        assert.equal(response.body.data.likedByMe, true);
        assert.equal(response.body.data.likes, undefined);
    } finally {
        Post.findById = originalFindById;
    }
});

test("shared post detail does not expose private community posts to non-members", async () => {
    const originalFindById = Post.findById;
    const originalCommunityFindById = Community.findById;
    const post = {
        _id: "507f1f77bcf86cd799439012",
        author: { _id: CREATOR_ID, name: "Creator" },
        community: COMMUNITY_ID,
        caption: "Members only",
        media: [],
        likes: [],
        comments: []
    };
    Post.findById = () => ({
        populate() {
            return this;
        },
        lean: async () => post
    });
    Community.findById = () => ({
        select() {
            return this;
        },
        lean: async () => ({ privacy: "private", members: [CREATOR_ID] })
    });

    try {
        const response = makeResponse();
        await postController.getPost({
            params: { id: post._id },
            user: { id: MEMBER_ID }
        }, response);

        assert.equal(response.statusCode, 404);
        assert.equal(response.body.message, "Post not found.");
    } finally {
        Post.findById = originalFindById;
        Community.findById = originalCommunityFindById;
    }
});

test("private community join requests stay pending until an admin approves", async () => {
    const originalFindById = Community.findById;
    const community = {
        privacy: "private",
        members: [CREATOR_ID],
        admins: [CREATOR_ID],
        pendingRequests: [],
        save: async () => {}
    };
    community.members.addToSet = value => {
        if (!community.members.some(item => String(item) === String(value))) {
            community.members.push(value);
        }
    };
    community.pendingRequests.pull = value => {
        const index = community.pendingRequests.findIndex(
            item => String(item) === String(value)
        );
        if (index >= 0) community.pendingRequests.splice(index, 1);
    };
    const response = makeResponse();
    Community.findById = async () => community;

    try {
        await communityController.joinCommunity(
            {
                params: { id: COMMUNITY_ID },
                user: { id: MEMBER_ID }
            },
            response
        );

        assert.equal(response.body.membershipStatus, "requested");
        assert.equal(community.members.length, 1);
        assert.equal(String(community.members[0]), CREATOR_ID);
        assert.equal(community.pendingRequests.length, 1);
        assert.equal(String(community.pendingRequests[0]), MEMBER_ID);
    } finally {
        Community.findById = originalFindById;
    }
});

test("community admins cannot approve requests or remove fellow admins", async () => {
    const originalFindById = Community.findById;
    const community = {
        createdBy: CREATOR_ID,
        admins: [CREATOR_ID, OTHER_ADMIN_ID, THIRD_ADMIN_ID],
        members: [CREATOR_ID, MEMBER_ID, OTHER_ADMIN_ID, THIRD_ADMIN_ID],
        pendingRequests: [COMMUNITY_ID],
        save: async () => {
            throw new Error("A non-owner admin must not change admin roles.");
        }
    };
    community.members.pull = () => {
        throw new Error("A non-owner admin must not remove another admin.");
    };
    community.admins.pull = () => {
        throw new Error("A non-owner admin must not remove another admin.");
    };
    community.pendingRequests.pull = () => {
        throw new Error("A non-owner admin must not approve requests.");
    };
    community.members.addToSet = () => {
        throw new Error("A non-owner admin must not approve requests.");
    };
    Community.findById = async () => community;

    try {
        const approvalResponse = makeResponse();
        await communityController.approveJoinRequest(
            {
                params: { id: COMMUNITY_ID, userId: COMMUNITY_ID },
                user: { id: MEMBER_ID }
            },
            approvalResponse
        );

        assert.equal(approvalResponse.statusCode, 403);

        const removalResponse = makeResponse();
        await communityController.removeMember(
            {
                params: { id: COMMUNITY_ID, userId: THIRD_ADMIN_ID },
                user: { id: OTHER_ADMIN_ID }
            },
            removalResponse
        );

        assert.equal(removalResponse.statusCode, 403);
    } finally {
        Community.findById = originalFindById;
    }
});

test("non-members cannot load private community posts", async () => {
    const originalFindById = Community.findById;
    const originalPostFind = Post.find;
    const response = makeResponse();
    let postQueryStarted = false;

    Community.findById = () => ({
        select: () => ({
            lean: async () => ({
                privacy: "private",
                members: [CREATOR_ID]
            })
        })
    });
    Post.find = () => {
        postQueryStarted = true;
        throw new Error("Private post query must not run for non-members.");
    };

    try {
        await postController.getCommunityPosts(
            {
                params: { communityId: COMMUNITY_ID },
                user: { id: MEMBER_ID },
                query: {}
            },
            response
        );

        assert.equal(response.statusCode, 404);
        assert.equal(postQueryStarted, false);
    } finally {
        Community.findById = originalFindById;
        Post.find = originalPostFind;
    }
});

test("private community posts stay out of the global feed", async () => {
    const originalPostFind = Post.find;
    const response = makeResponse();
    let selectedFilter;
    Post.find = filter => {
        selectedFilter = filter;
        return {
            sort() { return this; },
            limit() { return this; },
            populate() { return this; },
            lean: async () => []
        };
    };

    try {
        await postController.getFeed(
            {
                query: {},
                user: { id: MEMBER_ID }
            },
            response
        );

        assert.deepEqual(selectedFilter, {
            kind: "post",
            community: null
        });
        assert.deepEqual(response.body.data, []);
    } finally {
        Post.find = originalPostFind;
    }
});

test("non-members cannot create posts inside a community", async () => {
    const originalFindOne = Community.findOne;
    const response = makeResponse();
    Community.findOne = () => ({
        select: async () => null
    });

    try {
        await postController.createPost(
            {
                params: { communityId: COMMUNITY_ID },
                body: { caption: "Should not publish" },
                files: [],
                user: { id: MEMBER_ID }
            },
            response
        );

        assert.equal(response.statusCode, 403);
        assert.match(response.body.message, /join the community/i);
    } finally {
        Community.findOne = originalFindOne;
    }
});
