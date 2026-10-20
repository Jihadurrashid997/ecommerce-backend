import {
    getQueuedMessages,
    queueMessage,
    removeQueuedMessage
} from "./messageOutbox";

const USER_ID = "user-1";

beforeEach(() => {
    window.localStorage.clear();
});

test("queues messages per account and removes a delivered message", () => {
    const message = {
        clientMessageId: "message-1",
        targetId: "recipient-1",
        text: "queued text"
    };

    queueMessage(USER_ID, message);
    expect(getQueuedMessages(USER_ID)).toEqual([message]);
    expect(getQueuedMessages("user-2")).toEqual([]);

    removeQueuedMessage(USER_ID, message.clientMessageId);
    expect(getQueuedMessages(USER_ID)).toEqual([]);
});

test("does not add the same client message twice", () => {
    const message = { clientMessageId: "message-1", text: "queued text" };
    queueMessage(USER_ID, message);
    queueMessage(USER_ID, message);

    expect(getQueuedMessages(USER_ID)).toEqual([message]);
});
