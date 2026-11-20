import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";
import { isAxiosError } from "axios";
import { Platform } from "react-native";
import { api } from "../api";

export const SESSION_TOKEN_KEY = "jr-mobile-token";
export const LIVE_LOCATION_TASK = "jr-messenger-live-location";

const ACTIVE_SHARES_KEY = "jr-mobile-live-location-shares";

export interface LiveLocationShare {
    _id: string;
    sender: string;
    recipient: string | null;
    groupId: string | null;
    latitude: number;
    longitude: number;
    expiresAt: string;
    updatedAt: string;
}

interface StoredShare {
    id: string;
    expiresAt: string;
}

interface LocationTaskData {
    locations?: Location.LocationObject[];
}

const readStoredShares = async (): Promise<StoredShare[]> => {
    const raw = await AsyncStorage.getItem(ACTIVE_SHARES_KEY);
    if (!raw) {
        return [];
    }

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            throw new Error("Stored background location shares must be an array.");
        }
        return parsed.filter(
            (share): share is StoredShare =>
                typeof share?.id === "string" &&
                typeof share?.expiresAt === "string" &&
                Number.isFinite(Date.parse(share.expiresAt)) &&
                Date.parse(share.expiresAt) > Date.now()
        );
    } catch (error) {
        await AsyncStorage.removeItem(ACTIVE_SHARES_KEY);
        throw error;
    }
};

const writeStoredShares = async (shares: StoredShare[]) => {
    if (shares.length === 0) {
        await AsyncStorage.removeItem(ACTIVE_SHARES_KEY);
        return;
    }
    await AsyncStorage.setItem(ACTIVE_SHARES_KEY, JSON.stringify(shares));
};

const stopLocationTaskIfIdle = async () => {
    const shares = await readStoredShares();
    if (
        shares.length === 0 &&
        await Location.hasStartedLocationUpdatesAsync(LIVE_LOCATION_TASK)
    ) {
        await Location.stopLocationUpdatesAsync(LIVE_LOCATION_TASK);
    }
};

TaskManager.defineTask<LocationTaskData>(
    LIVE_LOCATION_TASK,
    async ({ data, error }) => {
        if (error) {
            console.error("Background live location task error:", error);
            return;
        }

        const locations = data?.locations || [];
        const location = locations[locations.length - 1];
        if (!location) {
            return;
        }

        const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
        if (!token) {
            await writeStoredShares([]);
            await stopLocationTaskIfIdle();
            return;
        }

        const shares = await readStoredShares();
        const remainingShares: StoredShare[] = [];
        for (const share of shares) {
            if (Date.parse(share.expiresAt) <= Date.now()) {
                continue;
            }
            try {
                await api.patch(
                    `/messages/live-locations/${share.id}`,
                    {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                remainingShares.push(share);
            } catch (updateError) {
                if (
                    isAxiosError(updateError) &&
                    [403, 404].includes(updateError.response?.status || 0)
                ) {
                    continue;
                }
                console.error("Background live location update failed:", updateError);
                remainingShares.push(share);
            }
        }

        await writeStoredShares(remainingShares);
        await stopLocationTaskIfIdle();
    }
);

export const requestBackgroundLocationAccess = async () => {
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (!foreground.granted) {
        throw new Error("Allow location access to share your live location.");
    }

    const background = await Location.requestBackgroundPermissionsAsync();
    if (!background.granted) {
        throw new Error(
            Platform.OS === "ios"
                ? "Choose Always location access in Settings to keep sharing while JR Messenger is in the background."
                : "Allow location access all the time in Settings to keep sharing while JR Messenger is in the background."
        );
    }
};

export const startBackgroundLiveLocation = async (
    recipientId: string,
    durationMinutes: 15 | 60 | 480,
    token: string
) => {
    await requestBackgroundLocationAccess();
    const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
    });
    const response = await api.post(
        "/messages/live-locations",
        {
            recipientId,
            durationMinutes,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
        },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    const share = response.data?.data as LiveLocationShare | undefined;
    if (!share?._id) {
        throw new Error("The server did not start live location sharing.");
    }

    const previousShares = await readStoredShares();
    const nextShares = [
        ...previousShares.filter(item => item.id !== share._id),
        { id: share._id, expiresAt: share.expiresAt }
    ];
    await writeStoredShares(nextShares);

    try {
        if (!await Location.hasStartedLocationUpdatesAsync(LIVE_LOCATION_TASK)) {
            await Location.startLocationUpdatesAsync(LIVE_LOCATION_TASK, {
                accuracy: Location.Accuracy.High,
                timeInterval: 10000,
                distanceInterval: 20,
                deferredUpdatesInterval: 10000,
                deferredUpdatesDistance: 20,
                pausesUpdatesAutomatically: true,
                showsBackgroundLocationIndicator: true,
                ...(Platform.OS === "android"
                    ? {
                          foregroundService: {
                              notificationTitle: "Live location is sharing",
                              notificationBody:
                                  "JR Messenger is updating your location until the share ends.",
                              killServiceOnDestroy: false
                          }
                      }
                    : {})
            });
        }
        return share;
    } catch (error) {
        await writeStoredShares(
            nextShares.filter(item => item.id !== share._id)
        );
        try {
            await api.delete(
                `/messages/live-locations/${share._id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (cleanupError) {
            console.error("Could not roll back failed live location start:", cleanupError);
        }
        throw error;
    }
};

export const stopBackgroundLiveLocation = async (
    shareId: string,
    token: string
) => {
    try {
        await api.delete(
            `/messages/live-locations/${shareId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
    } catch (error) {
        if (!isAxiosError(error) || error.response?.status !== 404) {
            throw error;
        }
    }

    const shares = await readStoredShares();
    await writeStoredShares(shares.filter(item => item.id !== shareId));
    await stopLocationTaskIfIdle();
};

export const stopAllBackgroundLiveLocations = async (token: string) => {
    const shares = await readStoredShares();
    if (await Location.hasStartedLocationUpdatesAsync(LIVE_LOCATION_TASK)) {
        await Location.stopLocationUpdatesAsync(LIVE_LOCATION_TASK);
    }
    await writeStoredShares([]);

    const results = await Promise.allSettled(
        shares.map(share =>
            api.delete(
                `/messages/live-locations/${share.id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            )
        )
    );
    const failed = results.filter(result => result.status === "rejected");
    failed.forEach(result => {
        console.error("Could not stop a background live location:", result.reason);
    });
    if (failed.length > 0) {
        throw new Error("Some live location shares could not be stopped on the server.");
    }
};
