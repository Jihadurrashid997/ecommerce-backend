const fs = require("node:fs");
const path = require("node:path");
const {
    createRunOncePlugin,
    withAndroidManifest,
    withDangerousMod,
    withEntitlementsPlist,
    withInfoPlist,
    withMainApplication,
    withXcodeProject
} = require("@expo/config-plugins");

const EXTENSION_NAME = "ScreenShareExtension";

const withAndroidScreenCapture = config => {
    config = withAndroidManifest(config, mod => {
        const permissions = mod.modResults.manifest["uses-permission"] || [];
        const names = new Set(
            permissions.map(permission => permission.$?.["android:name"])
        );

        [
            "android.permission.FOREGROUND_SERVICE",
            "android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION"
        ].forEach(name => {
            if (!names.has(name)) {
                permissions.push({ $: { "android:name": name } });
            }
        });

        mod.modResults.manifest["uses-permission"] = permissions;
        return mod;
    });

    return withMainApplication(config, mod => {
        const importLine =
            "import com.oney.WebRTCModule.WebRTCModuleOptions";
        const initialization =
            "WebRTCModuleOptions.getInstance().enableMediaProjectionService = true";
        let contents = mod.modResults.contents;

        if (!contents.includes(importLine)) {
            const packageLine = contents.match(/^package .+$/m)?.[0];
            if (!packageLine) {
                throw new Error(
                    "Could not configure Android screen capture: MainApplication has no package declaration."
                );
            }
            contents = contents.replace(
                packageLine,
                `${packageLine}\n\n${importLine}`
            );
        }

        if (!contents.includes(initialization)) {
            const onCreate = /override fun onCreate\(\)\s*\{/;
            if (!onCreate.test(contents)) {
                throw new Error(
                    "Could not enable Android screen capture: MainApplication.onCreate() was not found."
                );
            }
            contents = contents.replace(
                onCreate,
                match => `${match}\n    ${initialization}`
            );
        }

        mod.modResults.contents = contents;
        return mod;
    });
};

const withIosScreenCaptureMetadata = (config, options) => {
    config = withInfoPlist(config, mod => {
        mod.modResults.RTCAppGroupIdentifier = options.appGroup;
        mod.modResults.RTCScreensharingExtension =
            options.extensionBundleIdentifier;
        return mod;
    });

    return withEntitlementsPlist(config, mod => {
        const key = "com.apple.security.application-groups";
        const groups = mod.modResults[key] || [];
        if (!groups.includes(options.appGroup)) {
            groups.push(options.appGroup);
        }
        mod.modResults[key] = groups;
        return mod;
    });
};

const withIosScreenCaptureFiles = (config, options) =>
    withDangerousMod(config, [
        "ios",
        async mod => {
            const extensionDirectory = path.join(
                mod.modRequest.platformProjectRoot,
                EXTENSION_NAME
            );
            fs.mkdirSync(extensionDirectory, { recursive: true });

            const source = path.join(
                mod.modRequest.projectRoot,
                "plugins",
                "ios-broadcast",
                "SampleHandler.swift"
            );
            fs.copyFileSync(
                source,
                path.join(extensionDirectory, "SampleHandler.swift")
            );

            const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDisplayName</key>
    <string>Screen Share</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>XPC!</string>
    <key>RTCAppGroupIdentifier</key>
    <string>${options.appGroup}</string>
    <key>NSExtension</key>
    <dict>
        <key>NSExtensionAttributes</key>
        <dict>
            <key>NSExtensionActivationRule</key>
            <dict>
                <key>NSExtensionActivationSupportsReplayKitStreaming</key>
                <true/>
            </dict>
        </dict>
        <key>NSExtensionPointIdentifier</key>
        <string>com.apple.broadcast-services-upload</string>
        <key>NSExtensionPrincipalClass</key>
        <string>$(PRODUCT_MODULE_NAME).SampleHandler</string>
        <key>RPBroadcastProcessMode</key>
        <string>RPBroadcastProcessModeSampleBuffer</string>
    </dict>
</dict>
</plist>
`;
            fs.writeFileSync(
                path.join(extensionDirectory, "Info.plist"),
                infoPlist
            );

            const entitlements = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>${options.appGroup}</string>
    </array>
</dict>
</plist>
`;
            fs.writeFileSync(
                path.join(
                    extensionDirectory,
                    `${EXTENSION_NAME}.entitlements`
                ),
                entitlements
            );

            return mod;
        }
    ]);

const withIosScreenCaptureTarget = (config, options) =>
    withXcodeProject(config, mod => {
        const project = mod.modResults;
        const nativeTargets = project.pbxNativeTargetSection();
        const targetEntry = Object.entries(nativeTargets).find(
            ([key, target]) =>
                !key.endsWith("_comment") &&
                target.name?.replace(/"/g, "") === EXTENSION_NAME
        );
        let targetUuid = targetEntry?.[0];
        let groupUuid = project.findPBXGroupKey({
            name: EXTENSION_NAME
        });

        if (!targetUuid) {
            const target = project.addTarget(
                EXTENSION_NAME,
                "app_extension",
                EXTENSION_NAME,
                options.extensionBundleIdentifier
            );
            targetUuid = target.uuid;
            project.addBuildPhase(
                [],
                "PBXSourcesBuildPhase",
                "Sources",
                targetUuid
            );
            project.addBuildPhase(
                [],
                "PBXFrameworksBuildPhase",
                "Frameworks",
                targetUuid
            );
            project.addBuildPhase(
                [],
                "PBXResourcesBuildPhase",
                "Resources",
                targetUuid
            );

            const group = project.addPbxGroup(
                [],
                EXTENSION_NAME,
                EXTENSION_NAME
            );
            groupUuid = group.uuid;
            const mainGroup = project.getFirstProject().firstProject.mainGroup;
            project.hash.project.objects.PBXGroup[mainGroup].children.push({
                value: groupUuid,
                comment: EXTENSION_NAME
            });
        }

        if (!groupUuid) {
            throw new Error(
                "Could not add the iOS screen-share extension group to Xcode."
            );
        }

        if (!project.hasFile("SampleHandler.swift")) {
            project.addSourceFile(
                "SampleHandler.swift",
                { target: targetUuid },
                groupUuid
            );
        }
        project.addFramework("ReplayKit.framework", {
            target: targetUuid,
            sourceTree: "SDKROOT",
            link: true
        });

        const configurations =
            project.pbxXCBuildConfigurationSection();
        const target = project.pbxNativeTargetSection()[targetUuid];
        const configurationList =
            project.pbxXCConfigurationList()[target.buildConfigurationList];
        const targetConfigIds = new Set(
            configurationList.buildConfigurations.map(
                configuration => configuration.value
            )
        );

        Object.entries(configurations).forEach(([key, configuration]) => {
            if (
                key.endsWith("_comment") ||
                !targetConfigIds.has(key)
            ) {
                return;
            }

            Object.assign(configuration.buildSettings, {
                APPLICATION_EXTENSION_API_ONLY: "YES",
                CODE_SIGN_ENTITLEMENTS:
                    `${EXTENSION_NAME}/${EXTENSION_NAME}.entitlements`,
                INFOPLIST_FILE: `${EXTENSION_NAME}/Info.plist`,
                IPHONEOS_DEPLOYMENT_TARGET: "14.0",
                PRODUCT_BUNDLE_IDENTIFIER:
                    options.extensionBundleIdentifier,
                SKIP_INSTALL: "YES",
                SWIFT_VERSION: "5.0",
                TARGETED_DEVICE_FAMILY: '"1,2"'
            });
        });

        return mod;
    });

const withFullScreenCapture = (config, options = {}) => {
    if (
        !options.appGroup ||
        !options.extensionBundleIdentifier
    ) {
        throw new Error(
            "iOS screen sharing requires an app group and extension bundle identifier."
        );
    }

    config = withAndroidScreenCapture(config);
    config = withIosScreenCaptureMetadata(config, options);
    config = withIosScreenCaptureFiles(config, options);
    config = withIosScreenCaptureTarget(config, options);
    return config;
};

module.exports = createRunOncePlugin(
    withFullScreenCapture,
    "with-full-screen-capture",
    "1.0.0"
);
