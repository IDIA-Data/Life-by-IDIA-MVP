# Android Setup (Capacitor 8)

After running `npx cap add android`, follow these one-time setup steps to enable Health Connect, NFC, and OAuth deep links.

## 1. Set SDK versions in `android/variables.gradle`

```gradle
ext {
    minSdkVersion = 26
    compileSdkVersion = 36
    targetSdkVersion = 36
    androidxActivityVersion = '1.11.0'
    androidxAppCompatVersion = '1.7.1'
    androidxCoordinatorLayoutVersion = '1.3.0'
    androidxCoreVersion = '1.17.0'
    androidxFragmentVersion = '1.8.9'
    coreSplashScreenVersion = '1.0.1'
    androidxWebkitVersion = '1.15.0'
    junitVersion = '4.13.2'
    androidxJunitVersion = '1.3.0'
    androidxEspressoCoreVersion = '3.7.0'
    cordovaAndroidVersion = '12.0.1'
}
```

## 2. Gradle JDK
Use `jbr-21` (or any JDK 21+). Set in Android Studio: File → Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK.

## 3. Enable Kotlin in `android/build.gradle` (project level)

```gradle
buildscript {
    dependencies {
        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.24'
    }
}
```

## 4. Apply Kotlin and add dependencies in `android/app/build.gradle`

```gradle
apply plugin: 'kotlin-android'

dependencies {
    // Health Connect
    implementation "androidx.health.connect:connect-client:1.1.0-alpha10"
    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3"
}
```

## 5. Copy plugin files

```bash
mkdir -p android/app/src/main/java/com/idia/life/plugins/health
mkdir -p android/app/src/main/java/com/idia/life/plugins/nfc

cp native/android/IDIAHealthPlugin.kt android/app/src/main/java/com/idia/life/plugins/health/
cp native/android/IDIANFCPlugin.kt    android/app/src/main/java/com/idia/life/plugins/nfc/
```

## 6. Replace MainActivity

Capacitor generates `MainActivity.java` by default. Replace it with our Kotlin version that registers both plugins and handles `idialife://` deep links.

```bash
# Delete the auto-generated Java MainActivity
rm android/app/src/main/java/com/idia/life/MainActivity.java

# Copy our Kotlin version
cp native/android/MainActivity.kt android/app/src/main/java/com/idia/life/
```

## 7. Update AndroidManifest.xml

Open `android/app/src/main/AndroidManifest.xml` and add the following.

### Top-level permissions (before `<application>`)

```xml
<!-- NFC -->
<uses-permission android:name="android.permission.NFC" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-feature android:name="android.hardware.nfc" android:required="true" />

<!-- Health Connect -->
<uses-permission android:name="android.permission.health.READ_STEPS" />
<uses-permission android:name="android.permission.health.READ_HEART_RATE" />
<uses-permission android:name="android.permission.health.READ_ACTIVE_CALORIES_BURNED" />
<uses-permission android:name="android.permission.health.READ_SLEEP" />
<uses-permission android:name="android.permission.health.READ_DISTANCE" />
<uses-permission android:name="android.permission.health.READ_WEIGHT" />
<uses-permission android:name="android.permission.health.READ_HEIGHT" />

<queries>
    <package android:name="com.google.android.apps.healthdata" />
</queries>
```

### Add `usesCleartextTraffic` to the `<application>` tag

```xml
<application
    android:usesCleartextTraffic="true"
    ...>
```

### Inside `<application>` add Health Connect activity-aliases

```xml
<activity-alias
    android:name="HealthConnectPermissionRationale"
    android:exported="true"
    android:targetActivity=".MainActivity">
    <intent-filter>
        <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />
    </intent-filter>
</activity-alias>

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

### Add deep link intent-filter inside the MainActivity `<activity>` block

```xml
<activity android:name=".MainActivity" ...>
    <!-- Existing MAIN/LAUNCHER intent-filter -->
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>

    <!-- NEW: idialife:// scheme for OAuth callbacks and ACA handshakes -->
    <intent-filter android:autoVerify="false">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="idialife" />
    </intent-filter>
</activity>
```

## 8. Create `android/local.properties`

This file is machine-specific and must NOT be committed.

```
sdk.dir=C:/Users/YourName/AppData/Local/Android/Sdk
```

(Adjust the path to your Android SDK location.)

## 9. Verify and run

```bash
npm run build
npx cap sync
npx cap run android
```

If you get build errors, check:
- `MainActivity.java` is deleted (only `.kt` should exist)
- compileSdk is 36, not 35
- Kotlin classpath is in the project-level `build.gradle`
- Plugin files are in the correct package directories

## 10. Supabase Dashboard configuration

For OAuth to work, the Supabase dashboard must have these in **Authentication → URL Configuration → Redirect URLs**:

- `idialife://auth-callback`
- `idialife://update-password`
- `https://localhost`
- `http://localhost:8080`
