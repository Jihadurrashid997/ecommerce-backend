const assert = require("node:assert/strict");
const test = require("node:test");
const Post = require("../models/Post");

const makePost = fields => new Post({
    author: "507f1f77bcf86cd799439011",
    kind: "post",
    caption: "A thoughtful moment",
    media: [],
    ...fields
});

test("a text-only post is valid", () => {
    assert.equal(makePost().validateSync(), undefined);
});

test("an empty post is rejected", () => {
    const error = makePost({ caption: "" }).validateSync();

    assert.ok(error);
    assert.match(error.errors.media.message, /caption or media/);
});

test("a photo post remains valid", () => {
    const post = makePost({
        caption: "",
        media: [{
            url: "https://cdn.example.com/photo.jpg",
            type: "image"
        }]
    });

    assert.equal(post.validateSync(), undefined);
});

test("a reel still requires video media", () => {
    const error = makePost({
        kind: "reel",
        caption: "A reel without a video"
    }).validateSync();

    assert.ok(error);
    assert.match(error.errors.media.message, /caption or media/);
});
