const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const Story = require("../models/Story");
const User = require("../models/User");
const mediaStorage = require("../services/mediaStorage");

const USER_ID = "507f1f77bcf86cd799439011";
const FOLLOWER_ID = "507f191e810c19729de860ea";
const STORY_ID = "507f191e810c19729de860eb";
const originalFindById = User.findById;
const originalFind = User.find;
const originalFindOne = Story.findOne;
const originalStoryFind = Story.find;
const originalUpdateOne = Story.updateOne;
const originalDeleteFile = mediaStorage.deleteFile;

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

const makeStory = ({ audience = "followers", viewers = [] } = {}) => ({
    _id: new mongoose.Types.ObjectId(STORY_ID),
    owner: {
        _id: new mongoose.Types.ObjectId(USER_ID),
        name: "Owner",
        blockedUsers: []
    },
    audience,
    viewers,
    expiresAt: new Date(Date.now() + 60_000),
    toObject() {
        return this;
    }
});

test.afterEach(() => {
    User.findById = originalFindById;
    User.find = originalFind;
    Story.findOne = originalFindOne;
    Story.find = originalStoryFind;
    Story.updateOne = originalUpdateOne;
    mediaStorage.deleteFile = originalDeleteFile;
});

test("status requires text or media and defaults to follower-only for 24 hours", () => {
    const empty = new Story({
        owner: USER_ID,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
    assert.ok(empty.validateSync());

    const story = new Story({
        owner: USER_ID,
        text: "Hello",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
    assert.equal(story.validateSync(), undefined);
    assert.equal(story.audience, "followers");
});

test("a follower may view a follower-only status and gets one view record", async () => {
    const story = makeStory();
    let updateFilter;
    User.findById = id => ({
        select: () => ({
            lean: async () => String(id) === USER_ID
                ? { following: [], blockedUsers: [] }
                : { following: [new mongoose.Types.ObjectId(USER_ID)], blockedUsers: [] }
        })
    });
    Story.findOne = () => ({
        populate: async () => story
    });
    Story.updateOne = async filter => {
        updateFilter = filter;
    };

    const res = makeResponse();
    await require("../controllers/storyController").markStoryViewed(
        {
            params: { id: STORY_ID },
            user: { id: FOLLOWER_ID }
        },
        res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.viewersCount, 1);
    assert.equal(String(updateFilter._id), STORY_ID);
});

test("a non-follower cannot view a follower-only status", async () => {
    const story = makeStory();
    User.findById = id => ({
        select: () => ({
            lean: async () => String(id) === USER_ID
                ? { following: [], blockedUsers: [] }
                : { following: [], blockedUsers: [] }
        })
    });
    Story.findOne = () => ({
        populate: async () => story
    });
    Story.updateOne = async () => {
        throw new Error("A private story must not record this viewer.");
    };

    const res = makeResponse();
    await require("../controllers/storyController").markStoryViewed(
        {
            params: { id: STORY_ID },
            user: { id: FOLLOWER_ID }
        },
        res
    );

    assert.equal(res.statusCode, 404);
});

test("public statuses can be viewed without following the owner", async () => {
    const story = makeStory({ audience: "public" });
    User.findById = () => ({
        select: () => ({
            lean: async () => ({ following: [], blockedUsers: [] })
        })
    });
    Story.findOne = () => ({
        populate: async () => story
    });
    Story.updateOne = async () => {};

    const res = makeResponse();
    await require("../controllers/storyController").markStoryViewed(
        {
            params: { id: STORY_ID },
            user: { id: FOLLOWER_ID }
        },
        res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.viewedByMe, true);
});

test("expired statuses remain queued for cleanup when media deletion fails", async () => {
    const story = {
        media: {
            url: "https://media.example.com/status.mp4",
            publicId: "status-media",
            type: "video"
        },
        deleted: false,
        async deleteOne() {
            this.deleted = true;
        }
    };
    Story.find = () => ({
        sort() {
            return this;
        },
        limit: async () => [story]
    });
    mediaStorage.deleteFile = async () => false;

    const { purgeExpiredStories } = require("../services/storyCleanup");
    assert.equal(await purgeExpiredStories(), 0);
    assert.equal(story.deleted, false);

    mediaStorage.deleteFile = async () => true;
    assert.equal(await purgeExpiredStories(), 1);
    assert.equal(story.deleted, true);
});
