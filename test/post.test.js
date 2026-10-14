const assert = require("node:assert/strict");
const test = require("node:test");
const Post = require("../models/Post");
const { forgotPassword } = require("../controllers/authController");

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

test("forgot password reports missing SMTP configuration instead of claiming a code was sent", async () => {
    const names = [
        "EMAIL_HOST",
        "EMAIL_USER",
        "EMAIL_PASS"
    ];
    const previous = Object.fromEntries(
        names.map(name => [name, process.env[name]])
    );
    names.forEach(name => { process.env[name] = ""; });

    const response = {
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
    };

    try {
        await forgotPassword(
            { body: { email: "person@example.com" } },
            response
        );

        assert.equal(response.statusCode, 503);
        assert.match(response.body.message, /email is not configured/i);
    } finally {
        names.forEach(name => {
            if (previous[name] === undefined) {
                delete process.env[name];
            } else {
                process.env[name] = previous[name];
            }
        });
    }
});
