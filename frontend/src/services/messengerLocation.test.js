import {
    createLocationMessage,
    parseLocationMessage
} from "./messengerLocation";

test("location pins are rounded and can be parsed into a safe map link", () => {
    const message = createLocationMessage(23.7807123, 90.4071128);

    expect(message).toBe("📍 Approximate location\n23.7807,90.4071");
    expect(parseLocationMessage(message)).toEqual({
        latitude: 23.7807,
        longitude: 90.4071,
        comment: "",
        mapUrl: "https://www.google.com/maps?q=23.7807,90.4071",
        mapEmbedUrl:
            "https://maps.google.com/maps?q=23.7807,90.4071&z=15&output=embed"
    });
});

test("location pins preserve an optional trimmed comment", () => {
    const message = createLocationMessage(
        23.7807123,
        90.4071128,
        "  Meet me here  "
    );

    expect(message).toBe(
        "📍 Approximate location\n23.7807,90.4071\nMeet me here"
    );
    expect(parseLocationMessage(message).comment).toBe("Meet me here");
});

test("location pins reject invalid coordinates and malformed message text", () => {
    expect(() => createLocationMessage(91, 0)).toThrow("valid location");
    expect(() => createLocationMessage(0, Infinity)).toThrow("valid location");
    expect(parseLocationMessage("📍 Approximate location\n91,0")).toBeNull();
    expect(parseLocationMessage("https://example.com")).toBeNull();
});
