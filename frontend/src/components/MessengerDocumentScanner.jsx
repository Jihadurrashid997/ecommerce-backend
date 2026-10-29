import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    FaCamera,
    FaCheck,
    FaRedo,
    FaTimes,
    FaUndo
} from "react-icons/fa";
import {
    analyzeDocumentImage,
    detectDocumentCorners,
    getDefaultDocumentCorners,
    processDocumentImage
} from "../services/documentScanner";

const MAX_CAMERA_DIMENSION = 2200;
const FILTERS = [
    { id: "original", label: "Original" },
    { id: "enhanced", label: "Enhanced color" },
    { id: "grayscale", label: "Grayscale" },
    { id: "document", label: "Black & white" }
];

const loadImage = file => new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("The captured photo could not be opened."));
    };
    image.src = objectUrl;
});

const MessengerDocumentScanner = ({ onClose, onSend }) => {
    const videoRef = useRef(null);
    const imageRef = useRef(null);
    const streamRef = useRef(null);
    const sourceUrlRef = useRef("");
    const previewUrlRef = useRef("");
    const processingIdRef = useRef(0);
    const dragIndexRef = useRef(null);
    const [stage, setStage] = useState("camera");
    const [cameraRetry, setCameraRetry] = useState(0);
    const [cameraError, setCameraError] = useState("");
    const [cameraNote, setCameraNote] = useState("");
    const [sourceFile, setSourceFile] = useState(null);
    const [sourceDimensions, setSourceDimensions] = useState({ width: 0, height: 0 });
    const [corners, setCorners] = useState(getDefaultDocumentCorners);
    const [quality, setQuality] = useState(null);
    const [filter, setFilter] = useState("enhanced");
    const [rotation, setRotation] = useState(0);
    const [scanFile, setScanFile] = useState(null);
    const [scanUrl, setScanUrl] = useState("");
    const [processing, setProcessing] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");

    const stopCamera = useCallback(() => {
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
    }, []);

    useEffect(() => {
        let cancelled = false;
        const startCamera = async () => {
            if (!navigator.mediaDevices?.getUserMedia) {
                setCameraError("This browser cannot access a camera. Use a modern browser over HTTPS.");
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: {
                        facingMode: { ideal: "environment" },
                        width: { ideal: 1920, max: 3840 },
                        height: { ideal: 1080, max: 2160 }
                    }
                });
                if (cancelled) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play().catch(() => {});
                }

                const track = stream.getVideoTracks()[0];
                const capabilities = track?.getCapabilities?.() || {};
                const advanced = {};
                if (capabilities.focusMode?.includes("continuous")) {
                    advanced.focusMode = "continuous";
                }
                if (capabilities.exposureMode?.includes("continuous")) {
                    advanced.exposureMode = "continuous";
                } else if (capabilities.exposureMode?.includes("auto")) {
                    advanced.exposureMode = "auto";
                }
                if (capabilities.whiteBalanceMode?.includes("continuous")) {
                    advanced.whiteBalanceMode = "continuous";
                } else if (capabilities.whiteBalanceMode?.includes("auto")) {
                    advanced.whiteBalanceMode = "auto";
                }
                if (Object.keys(advanced).length) {
                    try {
                        await track.applyConstraints({ advanced: [advanced] });
                        setCameraNote("Camera focus and exposure are set to automatic where supported.");
                    } catch (_constraintError) {
                        setCameraNote("Camera uses its default focus and exposure controls.");
                    }
                } else {
                    setCameraNote("Camera uses its default focus, exposure, and white balance.");
                }
            } catch (cameraRequestError) {
                if (!cancelled) {
                    setCameraError(
                        cameraRequestError.name === "NotAllowedError"
                            ? "Camera permission was denied. Allow camera access in your browser and retry."
                            : "Could not start the camera. Check that it is connected and not being used by another app."
                    );
                }
            }
        };
        startCamera();

        return () => {
            cancelled = true;
            stopCamera();
        };
    }, [cameraRetry, stopCamera]);

    useEffect(() => {
        if (stage === "camera" && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.play().catch(() => {});
        }
    }, [stage]);

    useEffect(() => () => {
        processingIdRef.current += 1;
        if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    }, []);

    const capturePhoto = async () => {
        const video = videoRef.current;
        if (!video?.videoWidth || !video?.videoHeight) {
            setError("Wait for the camera preview to become ready.");
            return;
        }
        setError("");
        const scale = Math.min(
            1,
            MAX_CAMERA_DIMENSION / Math.max(video.videoWidth, video.videoHeight)
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const photo = await new Promise(resolve =>
            canvas.toBlob(blob => resolve(blob), "image/jpeg", 0.96)
        );
        if (!photo) {
            setError("Could not capture the camera photo.");
            return;
        }

        const file = new File([photo], `camera-photo-${Date.now()}.jpg`, {
            type: "image/jpeg",
            lastModified: Date.now()
        });
        try {
            const { image, objectUrl } = await loadImage(file);
            stopCamera();
            if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
            sourceUrlRef.current = objectUrl;
            imageRef.current = image;
            setSourceFile(file);
            setSourceDimensions({
                width: image.naturalWidth,
                height: image.naturalHeight
            });

            const analysisCanvas = document.createElement("canvas");
            const analysisScale = Math.min(
                1,
                640 / Math.max(image.naturalWidth, image.naturalHeight)
            );
            analysisCanvas.width = Math.round(image.naturalWidth * analysisScale);
            analysisCanvas.height = Math.round(image.naturalHeight * analysisScale);
            const analysisContext = analysisCanvas.getContext("2d", {
                willReadFrequently: true
            });
            analysisContext.drawImage(image, 0, 0, analysisCanvas.width, analysisCanvas.height);
            const imageData = analysisContext.getImageData(
                0,
                0,
                analysisCanvas.width,
                analysisCanvas.height
            );
            setQuality(analyzeDocumentImage(imageData));
            setCorners(detectDocumentCorners(imageData));
            setFilter("enhanced");
            setRotation(0);
            setStage("crop");
        } catch (captureError) {
            setError(captureError.message || "Could not prepare the captured photo.");
        }
    };

    const processScan = useCallback(async () => {
        if (!imageRef.current) return;
        const processingId = processingIdRef.current + 1;
        processingIdRef.current = processingId;
        setProcessing(true);
        setError("");
        try {
            const file = await processDocumentImage(
                imageRef.current,
                corners,
                filter,
                rotation
            );
            if (processingIdRef.current !== processingId) return;
            const url = URL.createObjectURL(file);
            if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
            previewUrlRef.current = url;
            setScanFile(file);
            setScanUrl(url);
        } catch (processingError) {
            if (processingIdRef.current === processingId) {
                setError(processingError.message || "Could not process this scan.");
            }
        } finally {
            if (processingIdRef.current === processingId) {
                setProcessing(false);
            }
        }
    }, [corners, filter, rotation]);

    useEffect(() => {
        if (stage === "preview") processScan();
    }, [stage, processScan]);

    const choosePhoto = async event => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            setError("Choose an image file.");
            return;
        }
        try {
            const { image, objectUrl } = await loadImage(file);
            stopCamera();
            if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
            sourceUrlRef.current = objectUrl;
            imageRef.current = image;
            setSourceFile(file);
            setSourceDimensions({ width: image.naturalWidth, height: image.naturalHeight });
            const analysisCanvas = document.createElement("canvas");
            const scale = Math.min(
                1,
                640 / Math.max(image.naturalWidth, image.naturalHeight)
            );
            analysisCanvas.width = Math.round(image.naturalWidth * scale);
            analysisCanvas.height = Math.round(image.naturalHeight * scale);
            const context = analysisCanvas.getContext("2d", { willReadFrequently: true });
            context.drawImage(image, 0, 0, analysisCanvas.width, analysisCanvas.height);
            const imageData = context.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height);
            setQuality(analyzeDocumentImage(imageData));
            setCorners(detectDocumentCorners(imageData));
            setStage("crop");
            setError("");
        } catch (photoError) {
            setError(photoError.message || "Could not open this photo.");
        }
    };

    const updateCorner = (event, index) => {
        if (dragIndexRef.current !== index) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = Math.max(0.01, Math.min(0.99, (event.clientX - bounds.left) / bounds.width));
        const y = Math.max(0.01, Math.min(0.99, (event.clientY - bounds.top) / bounds.height));
        setCorners(previous => previous.map((point, pointIndex) =>
            pointIndex === index ? { x, y } : point
        ));
    };

    const sendScan = async () => {
        if (!scanFile || processing || sending) return;
        setSending(true);
        setError("");
        try {
            await onSend(scanFile);
            onClose();
        } catch (sendError) {
            setError(
                sendError.response?.data?.message ||
                sendError.message ||
                "Could not send this scan."
            );
            setSending(false);
        }
    };

    const updateFilter = value => {
        setScanFile(null);
        setScanUrl("");
        setFilter(value);
    };

    const updateRotation = amount => {
        setScanFile(null);
        setScanUrl("");
        setRotation(value => (value + amount + 360) % 360);
    };

    return (
        <div
            className="document-scanner-overlay"
            role="presentation"
            onMouseDown={event => {
                if (event.target === event.currentTarget && !sending) onClose();
            }}
        >
            <section
                className={`document-scanner document-scanner--${stage}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="document-scanner-title"
            >
                <header className="document-scanner-header">
                    <div className="document-scanner-heading">
                        <span className="document-scanner-kicker">MESSENGER SCANNER</span>
                        <h2 id="document-scanner-title">
                            {stage === "camera" ? "Scan document" : stage === "crop" ? "Adjust document" : "Review scan"}
                        </h2>
                    </div>
                    <button
                        type="button"
                        aria-label="Close document scanner"
                        onClick={onClose}
                        disabled={sending}
                    >
                        <FaTimes />
                    </button>
                </header>

                <div className="document-scanner-body">
                    {stage === "camera" && (
                        <>
                            {cameraError ? (
                                <div className="document-scanner-camera-error" role="alert">
                                    <p>{cameraError}</p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCameraError("");
                                            setCameraRetry(value => value + 1);
                                        }}
                                    >
                                        Retry camera
                                    </button>
                                    <label className="document-scanner-secondary-button">
                                        Choose one photo
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            onChange={choosePhoto}
                                        />
                                    </label>
                                </div>
                            ) : (
                                <div className="document-scanner-camera-frame document-scanner-viewfinder">
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        muted
                                        playsInline
                                        aria-label="Document scanner camera preview"
                                    />
                                    <div className="document-scanner-live-label">
                                        <span /> LIVE SCAN
                                    </div>
                                    <div className="document-scanner-frame-guide" aria-hidden="true">
                                        <i />
                                        <i />
                                        <i />
                                        <i />
                                    </div>
                                    <p className="document-scanner-camera-hint">
                                        Align the page inside the frame
                                    </p>
                                </div>
                            )}
                            {cameraNote && <p className="document-scanner-camera-note">{cameraNote}</p>}
                        </>
                    )}

                    {(stage === "crop" || stage === "preview") && sourceFile && (
                        <>
                            {stage === "crop" ? (
                                <>
                                    <div className="document-scanner-crop">
                                        <img
                                            src={sourceUrlRef.current}
                                            alt="Captured document with adjustable crop corners"
                                        />
                                        <svg
                                            className="document-scanner-corners"
                                            viewBox={`0 0 ${sourceDimensions.width} ${sourceDimensions.height}`}
                                            preserveAspectRatio="none"
                                            onPointerMove={event => {
                                                if (dragIndexRef.current !== null) {
                                                    updateCorner(event, dragIndexRef.current);
                                                }
                                            }}
                                            onPointerUp={() => { dragIndexRef.current = null; }}
                                            onPointerCancel={() => { dragIndexRef.current = null; }}
                                            onLostPointerCapture={() => { dragIndexRef.current = null; }}
                                        >
                                            <polygon
                                                points={corners.map(point =>
                                                    `${point.x * sourceDimensions.width},${point.y * sourceDimensions.height}`
                                                ).join(" ")}
                                            />
                                            {corners.map((point, index) => (
                                                <circle
                                                    key={index}
                                                    cx={point.x * sourceDimensions.width}
                                                    cy={point.y * sourceDimensions.height}
                                                    r={Math.max(sourceDimensions.width * 0.025, 18)}
                                                    onPointerDown={event => {
                                                        event.currentTarget.setPointerCapture(event.pointerId);
                                                        dragIndexRef.current = index;
                                                        updateCorner(event, index);
                                                    }}
                                                    aria-label={`Adjust document corner ${index + 1}`}
                                                />
                                            ))}
                                        </svg>
                                    </div>
                                    <p className="document-scanner-note">
                                        Drag all four corner handles to fit the page edges. Auto-detection is a starting point; check the crop before sending.
                                    </p>
                                    {quality?.warnings?.length > 0 && (
                                        <ul className="document-scanner-warnings" role="status">
                                            {quality.warnings.map(warning => <li key={warning}>{warning}</li>)}
                                        </ul>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="document-scanner-result">
                                        {processing ? (
                                            <p role="status">Processing scan…</p>
                                        ) : scanUrl ? (
                                            <img src={scanUrl} alt="Processed document scan preview" />
                                        ) : (
                                            <p role="status">Preparing scan preview…</p>
                                        )}
                                    </div>
                                    <div className="document-scanner-filters" aria-label="Scan filter">
                                        {FILTERS.map(option => (
                                            <button
                                                type="button"
                                                key={option.id}
                                                aria-pressed={filter === option.id}
                                                onClick={() => updateFilter(option.id)}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="document-scanner-note">
                                        {sourceFile.size > 0
                                            ? `Original photo captured at ${sourceDimensions.width} × ${sourceDimensions.height}; the scan is optimized for Messenger.`
                                            : ""}
                                    </p>
                                </>
                            )}
                        </>
                    )}

                    {error && <p className="document-scanner-error" role="alert">{error}</p>}
                </div>

                <footer className="document-scanner-footer">
                    {stage === "camera" && (
                        <>
                            {!cameraError && (
                                <label className="document-scanner-gallery-button document-scanner-secondary-button">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={choosePhoto}
                                    />
                                    Choose photo
                                </label>
                            )}
                            {!cameraError && (
                                <label className="document-scanner-shutter-wrap">
                                    <span>Capture one page</span>
                                    <button
                                        className="document-scanner-shutter"
                                        type="button"
                                        onClick={capturePhoto}
                                        aria-label="Capture one document photo"
                                    >
                                        <FaCamera />
                                    </button>
                                </label>
                            )}
                        </>
                    )}
                    {stage === "crop" && (
                        <>
                            <button
                                className="document-scanner-secondary-button"
                                type="button"
                                onClick={() => {
                                    setSourceFile(null);
                                    setCameraError("");
                                    setCameraRetry(value => value + 1);
                                    setStage("camera");
                                    setError("");
                                }}
                            >
                                Retake photo
                            </button>
                            <button
                                className="document-scanner-primary"
                                type="button"
                                onClick={() => {
                                    setScanFile(null);
                                    setScanUrl("");
                                    setFilter("enhanced");
                                    setRotation(0);
                                    setStage("preview");
                                }}
                            >
                                Preview scan
                            </button>
                        </>
                    )}
                    {stage === "preview" && (
                        <>
                            <div className="document-scanner-rotate">
                                <button
                                    type="button"
                                    aria-label="Rotate scan left"
                                    onClick={() => updateRotation(-90)}
                                >
                                    <FaUndo />
                                </button>
                                <button
                                    type="button"
                                    aria-label="Rotate scan right"
                                    onClick={() => updateRotation(90)}
                                >
                                    <FaRedo />
                                </button>
                            </div>
                            <button
                                className="document-scanner-secondary-button"
                                type="button"
                                disabled={sending}
                                onClick={() => {
                                    setStage("crop");
                                    setError("");
                                }}
                            >
                                Adjust corners
                            </button>
                            <button
                                className="document-scanner-primary"
                                type="button"
                                disabled={!scanFile || processing || sending}
                                onClick={sendScan}
                            >
                                <FaCheck /> {sending ? "Sending…" : "Send one scan"}
                            </button>
                        </>
                    )}
                </footer>
            </section>
        </div>
    );
};

export default MessengerDocumentScanner;
