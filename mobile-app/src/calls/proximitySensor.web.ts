import type { ProximityChangeEvent } from "./proximitySensor";

export const addProximityChangeListener = (
    _listener: (event: ProximityChangeEvent) => void
) => ({ remove: () => undefined });

export const startProximityMonitoring = async () => false;

export const stopProximityMonitoring = async () => undefined;
