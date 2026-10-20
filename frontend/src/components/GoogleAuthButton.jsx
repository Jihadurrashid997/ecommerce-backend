import React, { useEffect, useRef, useState } from "react";

const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";
let googleIdentityScriptPromise;

const loadGoogleIdentityScript = () => {
    if (window.google?.accounts?.id) {
        return Promise.resolve();
    }

    if (!googleIdentityScriptPromise) {
        googleIdentityScriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = GOOGLE_IDENTITY_SCRIPT;
            script.async = true;
            script.defer = true;
            script.onload = resolve;
            script.onerror = () => {
                googleIdentityScriptPromise = null;
                reject(new Error("Google Identity Services could not be loaded."));
            };
            document.head.appendChild(script);
        });
    }

    return googleIdentityScriptPromise;
};

const GoogleAuthButton = ({
    onCredential,
    disabled = false,
    text = "signin_with"
}) => {
    const buttonRef = useRef(null);
    const onCredentialRef = useRef(onCredential);
    const [loadError, setLoadError] = useState("");
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

    useEffect(() => {
        onCredentialRef.current = onCredential;
    }, [onCredential]);

    useEffect(() => {
        if (!clientId) {
            setLoadError("Google sign-in is not configured for this site.");
            return undefined;
        }

        let isMounted = true;
        const buttonContainer = buttonRef.current;
        loadGoogleIdentityScript()
            .then(() => {
                if (!isMounted || !buttonContainer) {
                    return;
                }

                window.google.accounts.id.initialize({
                    client_id: clientId,
                    callback: response => {
                        if (response?.credential) {
                            onCredentialRef.current(response.credential);
                        } else {
                            setLoadError("Google did not return a sign-in credential.");
                        }
                    },
                    auto_select: false
                });
                window.google.accounts.id.renderButton(buttonContainer, {
                    type: "standard",
                    theme: "outline",
                    size: "large",
                    text,
                    shape: "rectangular",
                    width: Math.min(
                        300,
                        Math.floor(buttonContainer.clientWidth || 300)
                    )
                });
            })
            .catch(() => {
                if (isMounted) {
                    setLoadError("Google sign-in could not be loaded. Check your connection, refresh the page, and try again.");
                }
            });

        return () => {
            isMounted = false;
            buttonContainer?.replaceChildren();
        };
    }, [clientId, text]);

    return (
        <div className="google-auth-button">
            <div
                ref={buttonRef}
                aria-disabled={disabled}
                style={{
                    minHeight: 40,
                    opacity: disabled ? 0.6 : 1,
                    pointerEvents: disabled ? "none" : "auto"
                }}
            />
            {loadError && (
                <p className="google-auth-button-error" role="status">
                    {loadError}
                </p>
            )}
        </div>
    );
};

export default GoogleAuthButton;
