const readBlobArrayBuffer = blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () =>
        reject(reader.error || new Error("Could not read the PDF attachment."));
    reader.readAsArrayBuffer(blob);
});

export const assertValidPdfBlob = async blob => {
    if (!blob || blob.size < 10) {
        throw new Error("The PDF attachment is empty or incomplete.");
    }

    const header = new Uint8Array(await readBlobArrayBuffer(blob.slice(0, 1024)));
    const signature = String.fromCharCode(...header);
    if (!signature.includes("%PDF-")) {
        throw new Error("The downloaded attachment is not a valid PDF.");
    }

    return blob;
};
