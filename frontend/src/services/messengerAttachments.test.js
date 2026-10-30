import { assertValidPdfBlob } from "./messengerAttachments";

describe("PDF attachment validation", () => {
    test("accepts a non-empty PDF with a PDF signature", async () => {
        const pdf = new Blob(["%PDF-1.7\n1 0 obj\n%%EOF"]);

        await expect(assertValidPdfBlob(pdf)).resolves.toBe(pdf);
    });

    test("rejects an empty attachment before download", async () => {
        await expect(assertValidPdfBlob(new Blob([]))).rejects.toThrow(
            "The PDF attachment is empty or incomplete."
        );
    });

    test("rejects a response that is not a PDF", async () => {
        await expect(assertValidPdfBlob(new Blob(["not a PDF file"]))).rejects.toThrow(
            "The downloaded attachment is not a valid PDF."
        );
    });
});
