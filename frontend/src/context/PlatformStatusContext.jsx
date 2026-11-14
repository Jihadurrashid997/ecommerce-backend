import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState
} from "react";
import api from "../services/api";

const PlatformStatusContext = createContext(null);

export const PlatformStatusProvider = ({ children }) => {
    const [maintenance, setMaintenance] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const refresh = useCallback(async () => {
        try {
            const response = await api.get("/platform/settings");
            setMaintenance(response.data?.maintenance || null);
            setError("");
        } catch (requestError) {
            setError(
                requestError.response?.data?.message ||
                "Platform availability could not be checked."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        const timer = window.setInterval(refresh, 30000);
        const handleFocus = () => refresh();
        window.addEventListener("focus", handleFocus);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener("focus", handleFocus);
        };
    }, [refresh]);

    const value = useMemo(
        () => ({ maintenance, loading, error, refresh }),
        [maintenance, loading, error, refresh]
    );

    return (
        <PlatformStatusContext.Provider value={value}>
            {children}
        </PlatformStatusContext.Provider>
    );
};

export const usePlatformStatus = () => {
    const context = useContext(PlatformStatusContext);
    if (!context) {
        throw new Error("usePlatformStatus must be used within PlatformStatusProvider.");
    }
    return context;
};
