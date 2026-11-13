const appGroup =
    process.env.IOS_APP_GROUP ||
    "group.com.ecommercebackend.messenger";

module.exports = ({ config }) => ({
    ...config,
    name: "JR Messenger",
    slug: "jr-messenger-mobile",
    scheme: "jrmessenger",
    ios: {
        ...config.ios,
        bundleIdentifier:
            process.env.IOS_BUNDLE_ID ||
            "com.ecommercebackend.messenger",
        deploymentTarget: "14.0",
        infoPlist: {
            ...config.ios?.infoPlist,
            RTCAppGroupIdentifier: appGroup,
            RTCScreensharingExtension:
                `${process.env.IOS_BUNDLE_ID || "com.ecommercebackend.messenger"}.broadcast`,
            NSCameraUsageDescription:
                "Camera access lets you share video during calls.",
            NSMicrophoneUsageDescription:
                "Microphone access lets you talk during calls."
        }
    },
    android: {
        ...config.android,
        package:
            process.env.ANDROID_PACKAGE ||
            "com.ecommercebackend.messenger",
        permissions: [
            ...(config.android?.permissions || []),
            "android.permission.CAMERA",
            "android.permission.RECORD_AUDIO",
            "android.permission.FOREGROUND_SERVICE",
            "android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION"
        ]
    },
    plugins: [
        ...(config.plugins || []),
        [
            "@config-plugins/react-native-webrtc",
            {
                cameraPermission:
                    "Allow JR Messenger to use your camera during calls.",
                microphonePermission:
                    "Allow JR Messenger to use your microphone during calls."
            }
        ],
        "expo-secure-store",
        [
            "./plugins/withFullScreenCapture",
            {
                appGroup,
                extensionBundleIdentifier:
                    `${process.env.IOS_BUNDLE_ID || "com.ecommercebackend.messenger"}.broadcast`
            }
        ]
    ]
});
