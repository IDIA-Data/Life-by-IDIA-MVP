# Android Setup (Capacitor 8)

After `npx cap add android`:

## 1. Set SDK versions in `android/variables.gradle`:
```gradle
minSdkVersion = 26
compileSdkVersion = 36
targetSdkVersion = 36
```

## 2. Gradle JDK: Use `jbr-21` in Android Studio settings.

## 3. Enable Kotlin in `android/build.gradle` (project-level):
```gradle
buildscript {
    dependencies {
        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.24'
    }
}
```

## 4. Apply Kotlin in `android/app/build.gradle`:
```gradle
apply plugin: 'kotlin-android'
```
Add to dependencies:
```gradle
implementation "androidx.health.connect:connect-client:1.1.0-alpha10"
implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3"
```

## 5. Copy plugin:
```bash
mkdir -p android/app/src/main/java/com/idia/life/plugins/health
cp native/android/IDIAHealthPlugin.kt android/app/src/main/java/com/idia/life/plugins/health/
```

## 6. Register in `MainActivity.java`:
```java
import com.idia.life.plugins.health.IDIAHealthPlugin;
public class MainActivity extends BridgeActivity {
    @Override protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(IDIAHealthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
```

## 7. AndroidManifest.xml - add before `<application>`:
```xml
<uses-permission android:name="android.permission.health.READ_STEPS" />
<uses-permission android:name="android.permission.health.READ_HEART_RATE" />
<uses-permission android:name="android.permission.health.READ_ACTIVE_CALORIES_BURNED" />
<uses-permission android:name="android.permission.health.READ_SLEEP" />
<uses-permission android:name="android.permission.health.READ_DISTANCE" />
<uses-permission android:name="android.permission.health.READ_WEIGHT" />
<uses-permission android:name="android.permission.health.READ_HEIGHT" />
<queries><package android:name="com.google.android.apps.healthdata" /></queries>
```
Add to `<application>` tag: `android:usesCleartextTraffic="true"`

Add inside `<application>`:
```xml
<activity-alias android:name="HealthConnectPermissionRationale" android:exported="true" android:targetActivity=".MainActivity">
    <intent-filter><action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" /></intent-filter>
</activity-alias>
<activity-alias android:name="ViewPermissionUsageActivity" android:exported="true" android:targetActivity=".MainActivity" android:permission="android.permission.START_VIEW_PERMISSION_USAGE">
    <intent-filter><action android:name="android.intent.action.VIEW_PERMISSION_USAGE" /><category android:name="android.intent.category.HEALTH_PERMISSIONS" /></intent-filter>
</activity-alias>
```

## 8. Build: `npm run cap:sync && npm run cap:open:android`