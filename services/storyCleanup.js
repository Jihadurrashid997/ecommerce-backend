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
            const mediaFiles = [story.media, story.audio].filter(media => media?.url);
            const allMediaDeleted = await Promise.all(
                mediaFiles.map(media => mediaStorage.deleteFile(media))
            );
            if (allMediaDeleted.some(deleted => !deleted)) {
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
