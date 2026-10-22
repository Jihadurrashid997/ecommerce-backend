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
        const fitButton = () => {
            const iframe = buttonContainer?.querySelector("iframe");
            const wrapper = buttonContainer?.parentElement;

            if (!iframe || !wrapper) {
                return;
            }

            buttonContainer.style.transform = "none";
            const frameBounds = iframe.getBoundingClientRect();
            const containerBounds = buttonContainer.getBoundingClientRect();
            const availableWidth = wrapper.clientWidth;

            if (!frameBounds.width || !containerBounds.width || !availableWidth) {
                return;
            }

            const scale = Math.min(1, availableWidth / frameBounds.width);
            const containerCenter = containerBounds.left + containerBounds.width / 2;
            const frameCenter = frameBounds.left + frameBounds.width / 2;
            const offset = (containerCenter - frameCenter) * scale;

            buttonContainer.style.transformOrigin = "center";
            buttonContainer.style.transform = `translateX(${offset}px) scaleX(${scale})`;
        };
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
                // Google renders its hosted iframe wider than the requested width on small screens.
                fitButton();
            })
            .catch(() => {
                if (isMounted) {
                    setLoadError("Google sign-in could not be loaded. Check your connection, refresh the page, and try again.");
                }
            });

        const wrapper = buttonContainer?.parentElement;
        const resizeObserver = typeof ResizeObserver !== "undefined" && wrapper
            ? new ResizeObserver(fitButton)
            : null;
        resizeObserver?.observe(wrapper);
        window.addEventListener("resize", fitButton);

        const mutationObserver = typeof MutationObserver !== "undefined" && buttonContainer
            ? new MutationObserver(fitButton)
            : null;
        mutationObserver?.observe(buttonContainer, { childList: true, subtree: true });

        return () => {
            isMounted = false;
            resizeObserver?.disconnect();
            mutationObserver?.disconnect();
            window.removeEventListener("resize", fitButton);
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
