const Story = require("../models/Story");
const mediaStorage = require("./mediaStorage");

let cleanupRunning = false;

exports.purgeExpiredStories = async () => {
    if (cleanupRunning) {
        return 0;
    }
    cleanupRunning = true;

    try {
        let deletedCount = 0;
        const expired = await Story.find({
            expiresAt: { $lte: new Date() }
        })
            .sort({ expiresAt: 1 })
            .limit(50);

        for (const story of expired) {
            if (
                story.media?.url &&
                !await mediaStorage.deleteFile(story.media)
            ) {
                continue;
            }
            await story.deleteOne();
            deletedCount += 1;
        }

        return deletedCount;
    } finally {
        cleanupRunning = false;
    }
};
