function doPost(event) {
    try {
        const payload = JSON.parse(event.postData.contents || "{}");
        const expectedSecret = PropertiesService
            .getScriptProperties()
            .getProperty("GMAIL_RELAY_SECRET");

        if (!expectedSecret || payload.secret !== expectedSecret) {
            return jsonResponse({ success: false, message: "Unauthorized." });
        }

        if (
            typeof payload.to !== "string" ||
            typeof payload.subject !== "string" ||
            typeof payload.text !== "string" ||
            typeof payload.html !== "string"
        ) {
            return jsonResponse({ success: false, message: "Invalid email payload." });
        }

        const inlineImages = {};
        (payload.attachments || []).forEach(attachment => {
            if (
                typeof attachment.content_id !== "string" ||
                !/^[a-zA-Z0-9._-]+$/.test(attachment.content_id) ||
                typeof attachment.filename !== "string" ||
                typeof attachment.content !== "string"
            ) {
                throw new Error("Invalid inline image.");
            }

            inlineImages[attachment.content_id] = Utilities.newBlob(
                Utilities.base64Decode(attachment.content),
                "image/png",
                attachment.filename
            );
        });

        GmailApp.sendEmail(payload.to, payload.subject, payload.text, {
            htmlBody: payload.html,
            inlineImages,
            name: "E Top"
        });

        return jsonResponse({ success: true });
    } catch (error) {
        console.error("Gmail email relay failed:", error);
        return jsonResponse({ success: false, message: "Email delivery failed." });
    }
}

function jsonResponse(payload) {
    return ContentService
        .createTextOutput(JSON.stringify(payload))
        .setMimeType(ContentService.MimeType.JSON);
}
