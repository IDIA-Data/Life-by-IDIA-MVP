# Android Hardware Permissions — Required Manifest Additions

After running `npx cap add android`, open `android/app/src/main/AndroidManifest.xml` and
ensure the following `<uses-permission>` and `<uses-feature>` entries exist inside the
`<manifest>` root (above the `<application>` tag).

```xml
<!-- ── Hardware Permissions exposed in Settings → Privacy ── -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />

<!-- NFC -->
<uses-permission android:name="android.permission.NFC" />
<uses-feature android:name="android.hardware.nfc" android:required="false" />

<!-- Bluetooth (API 31+) -->
<uses-permission android:name="android.permission.BLUETOOTH_SCAN"
    android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<!-- Legacy fallback for API < 31 -->
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />

<!-- Health Connect -->
<uses-permission android:name="android.permission.health.READ_STEPS" />
<uses-permission android:name="android.permission.health.READ_HEART_RATE" />
<uses-permission android:name="android.permission.health.READ_SLEEP" />
<uses-permission android:name="android.permission.health.READ_DISTANCE" />
<uses-permission android:name="android.permission.health.READ_ACTIVE_CALORIES_BURNED" />
<uses-permission android:name="android.permission.health.READ_OXYGEN_SATURATION" />
<uses-permission android:name="android.permission.health.READ_BLOOD_PRESSURE" />
<uses-permission android:name="android.permission.health.READ_RESPIRATORY_RATE" />
<uses-permission android:name="android.permission.health.READ_BODY_TEMPERATURE" />
<uses-permission android:name="android.permission.health.READ_HYDRATION" />

<!-- Health Connect rationale activity (Android 14+ requires intent filter) -->
<queries>
    <package android:name="com.google.android.apps.healthdata" />
</queries>
```

Health Connect also requires a rationale activity declared inside `<application>`:

```xml
<activity-alias
    android:name="ViewPermissionUsageActivity"
    android:exported="true"
    android:targetActivity=".MainActivity"
    android:permission="android.permission.START_VIEW_PERMISSION_USAGE">
    <intent-filter>
        <action android:name="android.intent.action.VIEW_PERMISSION_USAGE" />
        <category android:name="android.intent.category.HEALTH_PERMISSIONS" />
    </intent-filter>
</activity-alias>
```

After editing the manifest, run:

```bash
npx cap sync android
```

---

## Deep-Link Intent Filter (OAuth callback, ACA handshake, payments)

`MainActivity.kt` routes `idialife://` URIs (auth-callback, update-password,
aca-handshake) and `ethereum:` payment URIs to the JS layer, but Android needs
an explicit `<intent-filter>` so the OS actually delivers those URLs.

Add inside `<application>` in `android/app/src/main/AndroidManifest.xml`,
on the existing `.MainActivity` activity (do **not** create a second activity):

```xml
<activity
    android:name=".MainActivity"
    android:exported="true"
    android:launchMode="singleTask">

    <!-- existing LAUNCHER intent-filter stays here -->

    <!-- IDIA custom-scheme deep links -->
    <intent-filter android:autoVerify="false">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="idialife" android:host="auth-callback" />
        <data android:scheme="idialife" android:host="update-password" />
        <data android:scheme="idialife" android:host="aca-handshake" />
        <data android:scheme="idialife" android:host="pay" />
    </intent-filter>

    <!-- EIP-681 payment URIs (NFC tap-to-pay fallback) -->
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="ethereum" />
    </intent-filter>
</activity>
```

## Google Sign-In (native)

Capacitor config registers `@codetrix-studio/capacitor-google-auth` with the
Google web client ID `349472255801-...`. Android also needs an **Android OAuth
client** (type "Android") in the same GCP project, with the app's package
`com.idia.life` and the release SHA-1 fingerprint. The native plugin
auto-discovers it at runtime — no extra manifest entries required.

After editing the manifest run:

```bash
npx cap sync android
```
