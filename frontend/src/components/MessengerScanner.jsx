import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaCamera, FaRedo, FaTimes, FaUpload } from "react-icons/fa";
import { processDocumentImage } from "./MessengerDocumentImage";
import "./MessengerScanner.css";

const MAX_SCAN_SIZE = 10 * 1024 * 1024;
const MAX_CAPTURE_DIMENSION = 1800;

const stopStream = stream => {
    stream?.getTracks().forEach(track => track.stop());
};

const MessengerScanner = ({ onClose, onSend }) => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [preview, setPreview] = useState(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [sourceFile, setSourceFile] = useState(null);
    const [filterMode, setFilterMode] = useState("enhanced");
    const [processing, setProcessing] = useState(false);
    const [cameraLoading, setCameraLoading] = useState(false);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const releaseCamera = useCallback(() => {
        stopStream(streamRef.current);
        streamRef.current = null;
        setStream(null);
    }, []);

    const startCamera = useCallback(async () => {
        setError("");
        if (!navigator.mediaDevices?.getUserMedia) {
            setError("Camera access is unavailable. Choose an image to scan instead.");
            return;
        }

        setCameraLoading(true);
        try {
            const cameraStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: { ideal: "environment" } }
            });
            streamRef.current = cameraStream;
            setStream(cameraStream);
        } catch (cameraError) {
            console.warn("Messenger scanner camera unavailable:", cameraError);
            setError("Camera permission was denied or no camera is available. Choose an image to scan instead.");
        } finally {
            setCameraLoading(false);
        }
    }, []);

    useEffect(() => {
        return () => {
            stopStream(streamRef.current);
            streamRef.current = null;
        };
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        if (video && stream) {
            video.srcObject = stream;
            video.play().catch(() => {
                setError("Press play on the camera preview or choose an image instead.");
            });
        }
        return () => {
            if (video?.srcObject === stream) {
                video.srcObject = null;
            }
        };
    }, [stream]);

    useEffect(() => {
        if (!preview) {
            setPreviewUrl("");
            return undefined;
        }
        const url = URL.createObjectURL(preview);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [preview]);

    useEffect(() => {
        if (!sourceFile) return undefined;

        let cancelled = false;
        setProcessing(true);
        setError("");
        setPreview(null);
        processDocumentImage(sourceFile, filterMode)
            .then(processedFile => {
                if (!cancelled) setPreview(processedFile);
            })
            .catch(processingError => {
                if (!cancelled) {
                    setError(
                        processingError.message ||
                            "The document image could not be prepared."
                    );
                }
            })
            .finally(() => {
                if (!cancelled) setProcessing(false);
            });

        return () => {
            cancelled = true;
        };
    }, [sourceFile, filterMode]);

    useEffect(() => {
        const handleEscape = event => {
            if (event.key === "Escape" && !busy) onClose();
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [busy, onClose]);

    const captureImage = () => {
        const video = videoRef.current;
        if (!video?.videoWidth || !video.videoHeight) {
            setError("The camera is not ready yet. Try again in a moment.");
            return;
        }

        const scale = Math.min(
            1,
            MAX_CAPTURE_DIMENSION / Math.max(video.videoWidth, video.videoHeight)
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        const context = canvas.getContext("2d");
        if (!context) {
            setError("This browser could not prepare the scanned image.");
            return;
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
            if (!blob) {
                setError("The image could not be captured. Please try again.");
                return;
            }
            if (blob.size > MAX_SCAN_SIZE) {
                setError("The scanned image is too large to send (10MB maximum).");
                return;
            }
            setSourceFile(new File([blob], `messenger-capture-${Date.now()}.jpg`, {
                type: "image/jpeg"
            }));
            releaseCamera();
            setError("");
        }, "image/jpeg", 0.86);
    };

    const selectImage = event => {
        const image = event.target.files?.[0];
        event.target.value = "";
        if (!image) return;
        if (!image.type.startsWith("image/")) {
            setError("Choose an image file to scan.");
            return;
        }
        if (image.size > MAX_SCAN_SIZE) {
            setError("The image is too large to send (10MB maximum).");
            return;
        }
        releaseCamera();
        setSourceFile(image);
        setError("");
    };

    const sendScan = async () => {
        if (!preview || busy) return;
        setBusy(true);
        setError("");
        try {
            await onSend(preview);
            onClose();
        } catch (sendError) {
            setError(sendError.message || "The scanned image could not be sent.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            className="messenger-scanner-overlay"
            onMouseDown={event => {
                if (event.target === event.currentTarget && !busy) onClose();
            }}
        >
            <section
                className="messenger-scanner"
                role="dialog"
                aria-modal="true"
                aria-labelledby="messenger-scanner-title"
            >
                <header>
                    <h2 id="messenger-scanner-title">Scan a document</h2>
                    <button type="button" aria-label="Close scanner" onClick={onClose} disabled={busy}>
                        <FaTimes />
                    </button>
                </header>
                <p>Capture a page or choose an existing image. Nothing is sent until you confirm.</p>
                {previewUrl ? (
                    <img className="messenger-scanner-preview" src={previewUrl} alt="Captured document page" />
                ) : sourceFile ? (
                    <p className="messenger-scanner-processing" role="status">
                        {processing ? "Detecting page edges and enhancing text…" : "Preparing preview…"}
                    </p>
                ) : (
                    <>
                        <video
                            ref={videoRef}
                            className="messenger-scanner-camera"
                            autoPlay
                            muted
                            playsInline
                            aria-label="Camera preview"
                            style={{ display: stream ? "block" : "none" }}
                        />
                        {!stream && (
                            <p className="messenger-scanner-processing">
                                Choose a photo to scan automatically, or open the camera.
                            </p>
                        )}
                    </>
                )}
                {sourceFile && (
                    <div className="messenger-scanner-filters" aria-label="Scan enhancement">
                        <button
                            type="button"
                            aria-pressed={filterMode === "enhanced"}
                            disabled={processing || busy}
                            onClick={() => setFilterMode("enhanced")}
                        >
                            Auto enhance
                        </button>
                        <button
                            type="button"
                            aria-pressed={filterMode === "original"}
                            disabled={processing || busy}
                            onClick={() => setFilterMode("original")}
                        >
                            Original
                        </button>
                    </div>
                )}
                {error && <p className="messenger-scanner-error" role="alert">{error}</p>}
                <label className="messenger-scanner-file">
                    <FaUpload aria-hidden="true" />
                    Choose image
                    <input type="file" accept="image/*" onChange={selectImage} />
                </label>
                <footer>
                    {sourceFile ? (
                        <>
                            <button
                                type="button"
                                className="messenger-scanner-secondary"
                                disabled={busy}
                                onClick={() => {
                                    setSourceFile(null);
                                    setPreview(null);
                                    void startCamera();
                                }}
                            >
                                <FaRedo aria-hidden="true" /> Retake
                            </button>
                            <button
                                type="button"
                                disabled={busy || processing || !preview}
                                onClick={sendScan}
                            >
                                {busy ? "Sending…" : processing ? "Preparing…" : "Confirm and send"}
                            </button>
                        </>
                    ) : (
                        stream ? (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={captureImage}
                            >
                                <FaCamera aria-hidden="true" /> Capture page
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled={cameraLoading || busy}
                                onClick={startCamera}
                            >
                                <FaCamera aria-hidden="true" />
                                {cameraLoading ? "Opening camera…" : "Open camera"}
                            </button>
                        )
                    )}
                </footer>
            </section>
        </div>
    );
};

export default MessengerScanner;
