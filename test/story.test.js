const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const Story = require("../models/Story");
const User = require("../models/User");
const mediaStorage = require("../services/mediaStorage");
const { voteStoryPoll } = require("../controllers/storyController");

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

const makeStory = ({ audience = "followers", viewers = [], poll } = {}) => ({
    _id: new mongoose.Types.ObjectId(STORY_ID),
    owner: {
        _id: new mongoose.Types.ObjectId(USER_ID),
        name: "Owner",
        blockedUsers: []
    },
    audience,
    viewers,
    poll,
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

test("photo stories accept only bounded soundtrack segments", () => {
    const story = new Story({
        owner: USER_ID,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        media: { url: "https://media.example.com/photo.jpg", type: "image" },
        audio: {
            url: "https://media.example.com/audio.mp3",
            type: "audio",
            title: "Original track",
            startSeconds: 4,
            durationSeconds: 15
        }
    });
    assert.equal(story.validateSync(), undefined);

    story.audio.durationSeconds = 16;
    assert.ok(story.validateSync());
});

test("Story polls require two to four non-empty options", () => {
    const story = new Story({
        owner: USER_ID,
        text: "Vote",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        poll: {
            question: "Pick one",
            options: [{ text: "A" }, { text: "B" }]
        }
    });
    assert.equal(story.validateSync(), undefined);
    story.poll.options = [{ text: "Only one" }];
    assert.ok(story.validateSync());
});

test("a Story poll accepts one vote from an authorized viewer", async () => {
    const story = makeStory({
        audience: "public",
        poll: {
            question: "Pick one",
            options: [{ text: "A" }, { text: "B" }],
            votes: []
        }
    });
    let updateFilter;
    Story.findOne = async () => story;
    Story.updateOne = async (filter, update) => {
        updateFilter = filter;
        return { modifiedCount: 1 };
    };
    const response = makeResponse();
    await voteStoryPoll({
        user: { id: USER_ID },
        params: { id: STORY_ID },
        body: { optionIndex: 1 }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data.poll.myVote, 1);
    assert.equal(response.body.data.poll.options[1].votes, 1);
    assert.deepEqual(updateFilter["poll.votes.user"], { $ne: USER_ID });
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

test("a blocked account cannot view a public status directly", async () => {
    const story = makeStory({ audience: "public" });
    User.findById = id => ({
        select: () => ({
            lean: async () => String(id) === USER_ID
                ? { following: [], blockedUsers: [new mongoose.Types.ObjectId(FOLLOWER_ID)] }
                : { following: [], blockedUsers: [] }
        })
    });
    Story.findOne = () => ({
        populate: async () => story
    });
    Story.updateOne = async () => {
        throw new Error("Blocked viewers must not be recorded.");
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

test("expired statuses remain queued for cleanup when media deletion fails", async () => {
    const story = {
        media: {
            url: "https://media.example.com/status.mp4",
            publicId: "status-media",
            type: "video"
        },
        audio: {
            url: "https://media.example.com/status.mp3",
            publicId: "status-audio",
            type: "audio"
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
    const deletedMedia = [];
    mediaStorage.deleteFile = async media => {
        deletedMedia.push(media);
        return deletedMedia.length > 2;
    };

    const { purgeExpiredStories } = require("../services/storyCleanup");
    assert.equal(await purgeExpiredStories(), 0);
    assert.equal(story.deleted, false);

    mediaStorage.deleteFile = async () => true;
    assert.equal(await purgeExpiredStories(), 1);
    assert.equal(story.deleted, true);
    assert.ok(deletedMedia.some(media => media.type === "audio"));
});
