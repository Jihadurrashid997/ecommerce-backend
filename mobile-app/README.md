# JR Messenger mobile

This React Native companion app uses the ecommerce backend's existing account
login, Messenger contacts, direct-call signaling, WebRTC calls, and live-location
sharing. It supports background location updates, voice/video calls, and
full-device screen sharing on Android and iOS; it is not a mobile port of the
ecommerce storefront.

Incoming calls use the native CallKit (iOS) and Core-Telecom (Android) screens,
including while the app is backgrounded or terminated. Native calls require
iOS 16.4 or later and Android 8 (API 26) or later, plus a custom development or
production build; Expo Go is not supported.

The in-call **Speaker** button manually switches between the earpiece and
loudspeaker during voice and video calls; this does not depend on a proximity
sensor. Voice calls route to the earpiece when connected, and video calls start
on speaker. Front-camera video is rendered without mirroring in both the local
preview and the remote view.

Direct-contact live-location sharing also runs as a native background location
task while the operating system allows it. Starting a share requests foreground
and background ("Always" / "Allow all the time") location permission. Android
shows an ongoing location notification while sharing. The share stops when its
selected duration expires or the user stops it. iOS and Android may stop
continuous updates if the user force-quits/terminates the app; the server keeps
only the last point until the share expires.

## Development

Install dependencies with `npm ci`, then run `npm start` to start Metro. A
development build is required because the app uses native WebRTC and screen
capture modules; Expo Go cannot provide these native modules.

Set `EXPO_PUBLIC_API_URL` to the backend API URL when it differs from the
default `https://ecommerce-api-9wc9.onrender.com/api`. Set
`EXPO_PUBLIC_SOCKET_URL` only when the Socket.IO server is hosted at a different
origin from the API.

## Native builds

- **Android:** install the Android SDK and use `npm run android`. Android
  prompts the user to approve screen capture and shows the system's active
  screen-sharing indicator. Configure `ANDROID_GOOGLE_SERVICES_FILE` to point
  to the Firebase `google-services.json` before building to enable FCM call
  pushes; keep that file out of source control.
- **iOS:** on macOS with Xcode, use `npm run ios`. Before generating or building
  the native project, set `IOS_BUNDLE_ID` and `IOS_APP_GROUP` to identifiers
  registered for your Apple Developer team. The app group must be enabled for
  both the app and the ReplayKit broadcast extension, and the provisioning
  profiles must include that capability. The app group defaults in
  `app.config.js` are placeholders and are not provisioned identifiers.

iOS screen sharing uses ReplayKit. The user must start the broadcast in the
system picker and can stop it from the system screen-recording controls. The
captured display is sent as video; this implementation does not capture device
audio.

Generated `android/` and `ios/` directories are ignored by Git and can be
recreated with Expo prebuild after changing native configuration.

## Background call push credentials

The app registers its APNs VoIP or FCM token with the authenticated device
session. The backend then sends native pushes only when that mobile app session
is not foregrounded. Configure these deployment secrets on the backend; never
commit them:

- **Android:** `FCM_SERVICE_ACCOUNT_JSON`, containing the Firebase service
  account JSON for the same project as `google-services.json`.
- **iOS:** `APNS_AUTH_KEY` (the `.p8` key contents), `APNS_KEY_ID`,
  `APNS_TEAM_ID`, and `APNS_BUNDLE_ID`. Set `APNS_PRODUCTION=false` for
  development/sandbox builds and `true` for TestFlight/App Store builds.

After changing native configuration, run `npx expo prebuild` and rebuild both
platforms. Validate calls and live location on physical devices in foreground
and background, with location permission set to Always / Allow all the time.
Push delivery requires the matching Apple/Firebase credentials and is not
available in Expo Go. Background location also requires a development or
production build.
