import { NativeModule, requireNativeModule } from "expo";

export interface ProximityChangeEvent {
    near: boolean;
}

interface ProximitySensorEvents {
    [eventName: string]: (...args: any[]) => void;
    onProximityChanged: (event: ProximityChangeEvent) => void;
}

declare class ProximitySensorModule extends NativeModule<ProximitySensorEvents> {
    start(): Promise<boolean>;
    stop(): Promise<void>;
}

const proximitySensor =
    requireNativeModule<ProximitySensorModule>("CallProximity");

export const addProximityChangeListener = (
    listener: (event: ProximityChangeEvent) => void
) => proximitySensor.addListener("onProximityChanged", listener);

export const startProximityMonitoring = () => proximitySensor.start();

export const stopProximityMonitoring = () => proximitySensor.stop();
