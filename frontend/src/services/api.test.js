import api, {
    getMessages,
    getSocketBaseUrl,
    getUploadUrl,
    markMessageSeen,
    sendMessage
} from "./api";

describe("API configuration", () => {
    test("uses the configured backend for API, sockets, and uploaded media", () => {
        expect(api.defaults.baseURL).toMatch(/\/api$/);
        expect(getSocketBaseUrl()).not.toMatch(/\/api$/);
        expect(getUploadUrl("/uploads/photo.jpg")).toBe(
            `${getSocketBaseUrl()}/uploads/photo.jpg`
        );
    });

    test("preserves absolute media URLs", () => {
        expect(getUploadUrl("https://cdn.example.com/photo.jpg")).toBe(
            "https://cdn.example.com/photo.jpg"
        );
    });
});

describe("messaging API routes", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("loads conversations from the route implemented by the backend", async () => {
        const get = jest.spyOn(api, "get").mockResolvedValue({});

        await getMessages({ receiverId: "user-123" });

        expect(get).toHaveBeenCalledWith(
            "/messages/conversation/user-123",
            { params: { page: 1, limit: 50 } }
        );
    });

    test("sends and marks messages seen using implemented backend routes", async () => {
        const post = jest.spyOn(api, "post").mockResolvedValue({});
        const put = jest.spyOn(api, "put").mockResolvedValue({});

        await sendMessage({ receiver: "user-123", message: "hello" });
        await markMessageSeen("user-123");

        expect(post).toHaveBeenCalledWith(
            "/messages/send",
            { receiver: "user-123", message: "hello" }
        );
        expect(put).toHaveBeenCalledWith("/messages/seen/user-123");
    });

    test("sends FormData without JSON content type so uploads include the multipart boundary", async () => {
        const originalAdapter = api.defaults.adapter;
        const adapter = jest.fn(async config => ({
            config,
            data: {},
            headers: {},
            status: 200,
            statusText: "OK"
        }));
        api.defaults.adapter = adapter;

        try {
            const formData = new FormData();
            formData.append("receiver", "user-123");
            formData.append(
                "file",
                new Blob(["voice"], { type: "audio/webm" }),
                "voice.webm"
            );

            await api.post("/messages/send", formData);

            const request = adapter.mock.calls[0][0];
            expect(request.data).toBeInstanceOf(FormData);
            expect(request.headers.getContentType()).toBe(false);
            expect(request.headers.toJSON()).not.toHaveProperty("Content-Type");
        } finally {
            api.defaults.adapter = originalAdapter;
        }
    });
});
