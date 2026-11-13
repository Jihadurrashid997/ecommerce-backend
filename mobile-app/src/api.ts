import { create, isAxiosError } from "axios";

const configuredUrl =
    process.env.EXPO_PUBLIC_API_URL ||
    "https://ecommerce-api-9wc9.onrender.com/api";
const normalizedUrl = configuredUrl.replace(/\/+$/, "");

export const api = create({
    baseURL: normalizedUrl.endsWith("/api")
        ? normalizedUrl
        : `${normalizedUrl}/api`,
    timeout: 30000,
    headers: {
        "Content-Type": "application/json"
    }
});

export const getErrorMessage = (
    error: unknown,
    fallback: string
): string => {
    if (isAxiosError(error)) {
        const message = error.response?.data?.message;
        return typeof message === "string" ? message : fallback;
    }
    return error instanceof Error ? error.message : fallback;
};
