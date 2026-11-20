import React, { useEffect, useState } from "react";
import axios from "axios";
import api from "../services/api";
import "../styles/AdminControl.css";

const SECTIONS = [
    ["app", "Entire E Top"],
    ["home", "Home"],
    ["reels", "Reels"],
    ["messenger", "Messenger"],
    ["shop", "Shop"],
    ["profile", "Profile"],
    ["community", "Community"]
];

const DEFAULT_MESSAGE = "This section is temporarily unavailable while we make updates.";

const formatBytes = bytes => {
    const size = Number(bytes);
    if (!Number.isFinite(size) || size <= 0) return "0 MB";
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const getSha256 = async file => {
    const bytes = await file.arrayBuffer();
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
        .map(value => value.toString(16).padStart(2, "0"))
        .join("");
};

const PlatformUpdates = () => {
    const [maintenance, setMaintenance] = useState(null);
    const [release, setRelease] = useState(null);
    const [versionName, setVersionName] = useState("");
    const [versionCode, setVersionCode] = useState("");
    const [releaseNotes, setReleaseNotes] = useState("");
    const [forceUpdate, setForceUpdate] = useState(false);
    const [apk, setApk] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState("");
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            api.get("/platform/settings"),
            api.get("/platform/android-release/latest").catch(requestError => {
                if (requestError.response?.status === 404) return null;
                throw requestError;
            })
        ])
            .then(([settingsResponse, releaseResponse]) => {
                if (cancelled) return;
                setMaintenance(settingsResponse.data.maintenance || {});
                const currentRelease = releaseResponse?.data?.release || null;
                setRelease(currentRelease);
                if (currentRelease) {
                    setVersionName(currentRelease.versionName);
                    setVersionCode(String(Number(currentRelease.versionCode) + 1));
                } else {
                    setVersionName("1.0.1");
                    setVersionCode("2");
                }
            })
            .catch(requestError => {
                if (!cancelled) {
                    setError(requestError.response?.data?.message || "Could not load app update settings.");
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, []);

    const saveMaintenance = async section => {
        const value = maintenance?.[section] || {};
        try {
            setBusy(`maintenance:${section}`);
            setError("");
            setNotice("");
            const response = await api.patch("/admin/platform/maintenance", {
                section,
                enabled: value.enabled === true,
                message: (value.message || DEFAULT_MESSAGE).trim()
            });
            setMaintenance(response.data.maintenance || {});
            setNotice(`${SECTIONS.find(([key]) => key === section)?.[1]} availability saved.`);
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Could not save availability settings.");
        } finally {
            setBusy("");
        }
    };

    const publishRelease = async event => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!apk) {
            setError("Select the signed APK file to publish.");
            return;
        }
        if (!apk.name.toLowerCase().endsWith(".apk") || apk.size > 500 * 1024 * 1024) {
            setError("Choose an APK file no larger than 500 MB.");
            return;
        }
        if (
            !Number.isSafeInteger(Number(versionCode)) ||
            Number(versionCode) < 1 ||
            (release && Number(versionCode) <= Number(release.versionCode))
        ) {
            setError("Enter a version code higher than the currently published release.");
            return;
        }

        try {
            setBusy("release");
            setUploadProgress(0);
            setError("");
            setNotice("");
            const header = new Uint8Array(await apk.slice(0, 4).arrayBuffer());
            if (header[0] !== 0x50 || header[1] !== 0x4b || header[2] !== 0x03 || header[3] !== 0x04) {
                throw new Error("The selected file is not a valid APK archive.");
            }

            const [sha256, signatureResponse] = await Promise.all([
                getSha256(apk),
                api.post("/admin/android-release/upload-signature")
            ]);
            const upload = signatureResponse.data.upload;
            const cloudData = new FormData();
            cloudData.append("file", apk);
            cloudData.append("api_key", upload.apiKey);
            cloudData.append("timestamp", String(upload.timestamp));
            cloudData.append("folder", upload.folder);
            cloudData.append("public_id", upload.publicId);
            cloudData.append("signature", upload.signature);

            const cloudResponse = await axios.post(upload.uploadUrl, cloudData, {
                timeout: 15 * 60 * 1000,
                onUploadProgress: progress => {
                    if (progress.total) {
                        setUploadProgress(Math.round((progress.loaded / progress.total) * 100));
                    }
                }
            });

            const response = await api.post("/admin/android-release", {
                versionName: versionName.trim(),
                versionCode,
                releaseNotes: releaseNotes.trim(),
                forceUpdate,
                publicId: cloudResponse.data.public_id,
                fileUrl: cloudResponse.data.secure_url,
                fileSize: cloudResponse.data.bytes,
                sha256
            });
            setRelease(response.data.release || null);
            setVersionCode(String(Number(response.data.release?.versionCode || versionCode) + 1));
            setApk(null);
            setReleaseNotes("");
            form.reset();
            setNotice("Android update published. Installed E Top apps can download it now.");
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Could not publish the Android update.");
        } finally {
            setBusy("");
        }
    };

    if (loading) return <p className="ac-note">Loading app update settings...</p>;

    return (
        <section className="ac-shop-settings">
            <h3>App availability</h3>
            <p className="ac-note">Put any section into maintenance while you work on updates. Admin accounts keep access.</p>
            {error && <p className="ac-note error" role="alert">{error}</p>}
            {notice && <p className="ac-note" role="status">{notice}</p>}

            <div className="platform-maintenance-controls">
                {SECTIONS.map(([key, title]) => {
                    const value = maintenance?.[key] || {
                        enabled: false,
                        message: DEFAULT_MESSAGE
                    };
                    return (
                        <div className="platform-maintenance-control" key={key}>
                            <label className="ac-setting-row">
                                <span>
                                    <b>{title}</b>
                                    <small>Show a maintenance screen to users.</small>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={value.enabled === true}
                                    disabled={Boolean(busy)}
                                    onChange={event => setMaintenance(previous => ({
                                        ...previous,
                                        [key]: {
                                            ...value,
                                            enabled: event.target.checked
                                        }
                                    }))}
                                />
                            </label>
                            <label className="platform-maintenance-message">
                                Maintenance message
                                <textarea
                                    value={value.message || DEFAULT_MESSAGE}
                                    maxLength={500}
                                    rows={2}
                                    disabled={Boolean(busy)}
                                    onChange={event => setMaintenance(previous => ({
                                        ...previous,
                                        [key]: {
                                            ...value,
                                            message: event.target.value
                                        }
                                    }))}
                                />
                            </label>
                            <button
                                type="button"
                                disabled={Boolean(busy)}
                                onClick={() => saveMaintenance(key)}
                            >
                                {busy === `maintenance:${key}` ? "Saving..." : "Save"}
                            </button>
                        </div>
                    );
                })}
            </div>

            <h3>Android APK update</h3>
            <p className="ac-note">
                Upload an APK signed with the same Android release key as the installed app. Android may ask users to allow E Top to install updates.
            </p>
            {release && (
                <p className="ac-note">
                    Current release: <b>{release.versionName}</b> · {formatBytes(release.fileSize)}
                </p>
            )}
            <form className="platform-release-form" onSubmit={publishRelease}>
                <label>
                    Version name
                    <input
                        value={versionName}
                        onChange={event => setVersionName(event.target.value)}
                        maxLength={40}
                        pattern="[0-9A-Za-z][0-9A-Za-z.+_-]{0,39}"
                        required
                        disabled={Boolean(busy)}
                    />
                </label>
                <label>
                    Version code
                    <input
                        type="number"
                        value={versionCode}
                        onChange={event => setVersionCode(event.target.value)}
                        min="1"
                        step="1"
                        required
                        disabled={Boolean(busy)}
                    />
                </label>
                <label>
                    Release notes
                    <textarea
                        value={releaseNotes}
                        onChange={event => setReleaseNotes(event.target.value)}
                        maxLength={2000}
                        rows={3}
                        disabled={Boolean(busy)}
                    />
                </label>
                <label>
                    Signed APK (max 500 MB)
                    <input
                        type="file"
                        accept=".apk,application/vnd.android.package-archive"
                        onChange={event => setApk(event.target.files?.[0] || null)}
                        required
                        disabled={Boolean(busy)}
                    />
                    {apk && <small>{apk.name} · {formatBytes(apk.size)}</small>}
                </label>
                <label className="ac-setting-row">
                    <span>
                        <b>Require this update</b>
                        <small>Users must install this release before continuing to use the app.</small>
                    </span>
                    <input
                        type="checkbox"
                        checked={forceUpdate}
                        onChange={event => setForceUpdate(event.target.checked)}
                        disabled={Boolean(busy)}
                    />
                </label>
                {busy === "release" && (
                    <div className="platform-upload-progress" role="status">
                        <progress value={uploadProgress} max="100" />
                        <span>Uploading APK: {uploadProgress}%</span>
                    </div>
                )}
                <button type="submit" disabled={Boolean(busy)}>
                    {busy === "release" ? "Publishing..." : "Publish Android update"}
                </button>
            </form>
        </section>
    );
};

export default PlatformUpdates;
