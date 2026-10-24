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
    const [sourceUrl, setSourceUrl] = useState("");
    const [scanCorners, setScanCorners] = useState(null);
    const [draftCorners, setDraftCorners] = useState(null);
    const [scanDimensions, setScanDimensions] = useState(null);
    const [editingCorners, setEditingCorners] = useState(false);
    const [draggingCorner, setDraggingCorner] = useState(null);
    const [filterMode, setFilterMode] = useState("enhanced");
    const [processing, setProcessing] = useState(false);
    const [cameraLoading, setCameraLoading] = useState(false);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const scanCornersRef = useRef(null);
    const userAdjustedCornersRef = useRef(false);

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
        if (!sourceFile) {
            setSourceUrl("");
            return undefined;
        }
        const url = URL.createObjectURL(sourceFile);
        setSourceUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [sourceFile]);

    useEffect(() => {
        if (!sourceFile) return undefined;

        let cancelled = false;
        setProcessing(true);
        setError("");
        setPreview(null);
        processDocumentImage(
            sourceFile,
            filterMode,
            userAdjustedCornersRef.current ? scanCornersRef.current : null
        )
            .then(result => {
                if (cancelled) return;
                const processedFile = result.file || result;
                setPreview(processedFile);
                if (result.corners) {
                    scanCornersRef.current = result.corners;
                    setScanCorners(result.corners);
                    setScanDimensions({ width: result.width, height: result.height });
                }
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
            userAdjustedCornersRef.current = false;
            scanCornersRef.current = null;
            setScanCorners(null);
            setDraftCorners(null);
            setScanDimensions(null);
            setEditingCorners(false);
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
        userAdjustedCornersRef.current = false;
        scanCornersRef.current = null;
        setScanCorners(null);
        setDraftCorners(null);
        setScanDimensions(null);
        setEditingCorners(false);
        setSourceFile(image);
        setError("");
    };

    const updateCorner = (index, event) => {
        if (draggingCorner === null || !scanDimensions) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = Math.max(
            0,
            Math.min(
                scanDimensions.width - 1,
                ((event.clientX - bounds.left) / bounds.width) * scanDimensions.width
            )
        );
        const y = Math.max(
            0,
            Math.min(
                scanDimensions.height - 1,
                ((event.clientY - bounds.top) / bounds.height) * scanDimensions.height
            )
        );
        const middleX = scanDimensions.width / 2;
        const middleY = scanDimensions.height / 2;
        const constrained = {
            x: index === 0 || index === 3 ? Math.min(x, middleX) : Math.max(x, middleX),
            y: index === 0 || index === 1 ? Math.min(y, middleY) : Math.max(y, middleY)
        };
        const next = draftCorners.map((corner, cornerIndex) =>
            cornerIndex === index ? constrained : corner
        );
        setDraftCorners(next);
    };

    const applyCorners = async () => {
        if (!sourceFile || !draftCorners || processing) return;
        setProcessing(true);
        setError("");
        userAdjustedCornersRef.current = true;
        try {
            const result = await processDocumentImage(
                sourceFile,
                filterMode,
                draftCorners
            );
            setPreview(result.file || result);
            if (result.corners) {
                scanCornersRef.current = result.corners;
                setScanCorners(result.corners);
                setScanDimensions({ width: result.width, height: result.height });
            }
            setEditingCorners(false);
        } catch (processingError) {
            setError(
                processingError.message ||
                    "The selected page corners could not be applied."
            );
        } finally {
            setProcessing(false);
        }
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
                    editingCorners && sourceUrl && draftCorners && scanDimensions ? (
                        <div className="messenger-scanner-corner-editor">
                            <img src={sourceUrl} alt="Original page" />
                            <svg
                                viewBox={`0 0 ${scanDimensions.width} ${scanDimensions.height}`}
                                preserveAspectRatio="none"
                                onPointerMove={event => updateCorner(draggingCorner, event)}
                                onPointerUp={() => setDraggingCorner(null)}
                                onPointerCancel={() => setDraggingCorner(null)}
                                aria-label="Drag the four page corners"
                                role="group"
                            >
                                <polygon
                                    points={draftCorners.map(point => `${point.x},${point.y}`).join(" ")}
                                />
                                {draftCorners.map((point, index) => (
                                    <circle
                                        key={index}
                                        cx={point.x}
                                        cy={point.y}
                                        r={Math.max(12, scanDimensions.width * 0.025)}
                                        onPointerDown={event => {
                                            event.preventDefault();
                                            event.currentTarget.ownerSVGElement
                                                ?.setPointerCapture?.(event.pointerId);
                                            setDraggingCorner(index);
                                        }}
                                        aria-label={`Page corner ${index + 1}`}
                                    />
                                ))}
                            </svg>
                        </div>
                    ) : (
                        <img className="messenger-scanner-preview" src={previewUrl} alt="Captured document page" />
                    )
                ) : sourceFile ? (
                    <p className="messenger-scanner-processing" role="status">
                        {processing
                            ? "Finding page corners, straightening, and enhancing text…"
                            : "Preparing preview…"}
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
                        {scanCorners && (
                            <button
                                type="button"
                                aria-pressed={editingCorners}
                                disabled={processing || busy}
                                onClick={() => {
                                    if (!editingCorners) setDraftCorners(scanCorners);
                                    setEditingCorners(value => !value);
                                }}
                            >
                                {editingCorners ? "Back to scan" : "Adjust corners"}
                            </button>
                        )}
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
                                    setScanCorners(null);
                                    setDraftCorners(null);
                                    setScanDimensions(null);
                                    userAdjustedCornersRef.current = false;
                                    scanCornersRef.current = null;
                                    void startCamera();
                                }}
                            >
                                <FaRedo aria-hidden="true" /> Retake
                            </button>
                            <button
                                type="button"
                                disabled={busy || processing || !preview}
                                onClick={
                                    editingCorners
                                        ? applyCorners
                                        : sendScan
                                }
                            >
                                {busy
                                    ? "Sending…"
                                    : processing
                                        ? "Preparing…"
                                        : editingCorners
                                            ? "Apply corners"
                                            : "Confirm and send"}
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
