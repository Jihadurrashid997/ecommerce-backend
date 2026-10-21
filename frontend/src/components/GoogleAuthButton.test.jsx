import React from "react";
import { act, render } from "@testing-library/react";
import GoogleAuthButton from "./GoogleAuthButton";

describe("GoogleAuthButton", () => {
    const originalGoogle = window.google;
    const originalClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

    afterEach(() => {
        if (originalGoogle === undefined) {
            delete window.google;
        } else {
            window.google = originalGoogle;
        }
        if (originalClientId === undefined) {
            delete process.env.REACT_APP_GOOGLE_CLIENT_ID;
        } else {
            process.env.REACT_APP_GOOGLE_CLIENT_ID = originalClientId;
        }
    });

    test("initializes Google Identity Services and forwards the ID token", async () => {
        process.env.REACT_APP_GOOGLE_CLIENT_ID = "google-web-client-id";
        let initialization;
        const renderButton = jest.fn();
        window.google = {
            accounts: {
                id: {
                    initialize: options => {
                        initialization = options;
                    },
                    renderButton
                }
            }
        };
        const onCredential = jest.fn();
        render(<GoogleAuthButton onCredential={onCredential} text="signup_with" />);

        await act(async () => Promise.resolve());

        expect(initialization.client_id).toBe("google-web-client-id");
        expect(renderButton).toHaveBeenCalledWith(
            expect.any(HTMLElement),
            expect.objectContaining({ text: "signup_with" })
        );

        await act(async () => {
            initialization.callback({ credential: "signed-google-id-token" });
        });
        expect(onCredential).toHaveBeenCalledWith("signed-google-id-token");
    });

    test("fits the hosted Google button inside narrow auth forms", async () => {
        process.env.REACT_APP_GOOGLE_CLIENT_ID = "google-web-client-id";
        let buttonContainer;
        window.google = {
            accounts: {
                id: {
                    initialize: jest.fn(),
                    renderButton: container => {
                        buttonContainer = container;
                        const iframe = document.createElement("iframe");
                        container.appendChild(iframe);
                        Object.defineProperty(container.parentElement, "clientWidth", {
                            configurable: true,
                            value: 248
                        });
                        container.getBoundingClientRect = () => ({
                            left: 0,
                            right: 248,
                            width: 248
                        });
                        iframe.getBoundingClientRect = () => ({
                            left: -10,
                            right: 311,
                            width: 321
                        });
                    }
                }
            }
        };

        render(<GoogleAuthButton onCredential={jest.fn()} />);
        await act(async () => Promise.resolve());

        expect(buttonContainer.style.transform).toContain("scaleX(0.772");
    });
});
