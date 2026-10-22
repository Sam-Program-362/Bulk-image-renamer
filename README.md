# Bulk Rename — Mass File & Image Renamer

Bulk-rename hundreds of images and videos with live preview. One codebase,
two targets:

- **Web** — React + Vite + Tailwind, runs entirely in the browser.
- **Android app** — the same web app packaged with [Capacitor](https://capacitorjs.com),
  plus a native feature the web can't offer: **searching media already on
  your device by title**.

Files are never uploaded anywhere — everything happens on your device.

## Features

- 7 rename modes: sequential numbering, prefix/suffix, find & replace
  (incl. regex), date/time, case conversion, remove characters, templates
- Live preview of every new name, duplicate-name detection, ZIP export
  (or download files individually)
- **Android only — Search on this device:** find photos and videos anywhere
  on the phone by title / file name (`IMG_…`, `paris trip`, …), filter by
  type — All media, Images, GIF, JPG, PNG, WEBP, Videos, MP4 — preview them
  in a grid, select any of them, and drop them straight into the rename queue.

## Web

```bash
npm install
npm run dev      # develop
npm run build    # production build into dist/
```

## Android

The Android project lives in [`android/`](android) in this same repo
(Capacitor workspace — web sources in `src/` are the single source of truth).

```bash
npm install
npm run android:sync   # build web app + copy it into android/
npm run android:open   # open in Android Studio, or:
npm run android:run    # sync + run on a connected device/emulator
```

Or build an APK from the command line:

```bash
npm run android:sync
cd android && ./gradlew assembleDebug assembleRelease
# APKs land in android/app/build/outputs/apk/{debug,release}/
```

### How device search works

A small native Capacitor plugin,
[`DeviceMediaPlugin.java`](android/app/src/main/java/com/bulkrenamer/app/DeviceMediaPlugin.java),
queries Android's `MediaStore` (images + videos, matched against the
`TITLE`/`DISPLAY_NAME` columns). Runtime permissions
(`READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO`, partial "selected photos" access
on Android 14+, `READ_EXTERNAL_STORAGE` on older versions) are requested
only when you first search. Selected items are copied to the app-private
cache, loaded into the existing rename queue, and exported with new names
as a ZIP — originals on the device are never modified.

## CI & APK releases

- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — typecheck + web
  build on every push/PR.
- [`.github/workflows/android.yml`](.github/workflows/android.yml) — builds
  **debug and release APKs** on every push to `main`, on PRs, and on manual
  dispatch; APKs are uploaded as workflow artifacts
  (`bulk-rename-apks`).

To publish an installable release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Tagging `v*` also creates a **GitHub Release** with both APKs attached.

### Signing the release APK

Without signing secrets, CI signs the release APK with the debug key —
installable for testing, but not suitable for the Play Store or updates.
For a properly signed release, create a keystore and add these repository
secrets (Settings → Secrets and variables → Actions):

| Secret | Content |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 release.keystore` output |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | key alias |
| `ANDROID_KEY_PASSWORD` | key password |

CI detects them automatically; `android/app/build.gradle` picks them up
via environment variables.

## Project layout

```
src/                    Web app (shared by web + Android)
  components/           UI (incl. DeviceSearch.tsx — Android-only panel)
  hooks/useFileRenamer.ts
  native/deviceMedia.ts Typed bridge to the native plugin
  utils/renameEngine.ts Rename rules
android/                Capacitor Android project
  app/src/main/java/com/bulkrenamer/app/
    MainActivity.java        registers the plugin
    DeviceMediaPlugin.java   MediaStore search + file staging
capacitor.config.ts
.github/workflows/      CI (web) + Android APK build/release
```
