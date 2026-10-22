package com.bulkrenamer.app;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.app.RecoverableSecurityException;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Intent;
import android.content.IntentSender;
import android.database.Cursor;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import android.os.Build;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * DeviceMedia — searches the on-device media library (MediaStore) by title /
 * file name, across images (JPG, PNG, GIF, WEBP, HEIC, …) and videos
 * (MP4, MOV, MKV, WEBM, …), and stages selected items into the app cache so
 * the web layer can load them as regular {@link java.io.File}-backed blobs
 * and feed them into the existing bulk-rename pipeline.
 *
 * Nothing ever leaves the device: queries run against the local MediaStore
 * and staged copies live in the app-private cache directory.
 */
// One alias per permission string: Capacitor treats every string under a
// single alias as "all must be granted", which breaks across API levels
// (READ_MEDIA_VISUAL_USER_SELECTED only exists on 34+, READ_EXTERNAL_STORAGE
// is gone on 33+). Splitting them lets us check/request per SDK level.
@CapacitorPlugin(
    name = "DeviceMedia",
    permissions = {
        @Permission(alias = "images", strings = { Manifest.permission.READ_MEDIA_IMAGES }),
        @Permission(alias = "video", strings = { Manifest.permission.READ_MEDIA_VIDEO }),
        @Permission(alias = "partial", strings = { Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED }),
        @Permission(alias = "legacy", strings = { Manifest.permission.READ_EXTERNAL_STORAGE })
    }
)
public class DeviceMediaPlugin extends Plugin {

    private static final String[] PROJECTION = {
        MediaStore.Files.FileColumns._ID,
        MediaStore.Files.FileColumns.DISPLAY_NAME,
        MediaStore.Files.FileColumns.TITLE,
        MediaStore.Files.FileColumns.MIME_TYPE,
        MediaStore.Files.FileColumns.SIZE,
        MediaStore.Files.FileColumns.DATE_MODIFIED,
        MediaStore.Files.FileColumns.MEDIA_TYPE,
        MediaStore.Files.FileColumns.WIDTH,
        MediaStore.Files.FileColumns.HEIGHT,
        MediaStore.Files.FileColumns.DURATION
    };

    private static final int REQ_CONSENT = 4471;

    // State for an operation paused waiting for the system consent dialog
    // (Android 10+ requires user approval to modify/delete media owned by
    // other apps). Only one such operation can be in flight at a time.
    private PluginCall pendingCall;
    private String pendingAction; // "rename" | "delete" | "moveDelete"
    private long pendingId;
    private String pendingNewName;
    private JSObject pendingExtra;

    private void requestConsent(PendingIntent intent, PluginCall call, String action,
                                long id, String newName, JSObject extra) {
        if (pendingCall != null) {
            call.reject("Another operation is already waiting for your approval.");
            return;
        }
        pendingCall = call;
        pendingAction = action;
        pendingId = id;
        pendingNewName = newName;
        pendingExtra = extra;
        try {
            getActivity().startIntentSenderForResult(
                intent.getIntentSender(), REQ_CONSENT, null, 0, 0, 0);
        } catch (IntentSender.SendIntentException e) {
            clearPending();
            call.reject("Could not open the approval dialog: " + e.getMessage());
        }
    }

    private void clearPending() {
        pendingCall = null;
        pendingAction = null;
        pendingNewName = null;
        pendingExtra = null;
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_CONSENT || pendingCall == null) return;

        PluginCall call = pendingCall;
        String action = pendingAction;
        long id = pendingId;
        String newName = pendingNewName;
        JSObject extra = pendingExtra;
        clearPending();

        if (resultCode != Activity.RESULT_OK) {
            if ("moveDelete".equals(action) && extra != null) {
                // Copy already succeeded — report it, original kept.
                extra.put("moved", false);
                extra.put("warning", "Copied, but the original was kept (approval denied).");
                call.resolve(extra);
            } else {
                call.reject("Approval denied — the file was not changed.");
            }
            return;
        }

        switch (action) {
            case "rename":
                doRename(call, id, newName, true);
                break;
            case "delete":
                doDelete(call, id, true);
                break;
            case "moveDelete":
                finishMove(call, id, extra);
                break;
            default:
                call.reject("Unknown pending operation");
        }
    }

    /** Route a SecurityException to the right consent dialog (API 29/30+). */
    private boolean handleSecurity(SecurityException e, PluginCall call, String action,
                                   long id, String newName, JSObject extra) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) { // 30+
                Uri uri = uriFor(id);
                PendingIntent pi = "rename".equals(action)
                    ? MediaStore.createWriteRequest(getContext().getContentResolver(), Collections.singletonList(uri))
                    : MediaStore.createDeleteRequest(getContext().getContentResolver(), Collections.singletonList(uri));
                requestConsent(pi, call, action, id, newName, extra);
                return true;
            }
            if (Build.VERSION.SDK_INT == Build.VERSION_CODES.Q // 29
                    && e instanceof RecoverableSecurityException) {
                requestConsent(((RecoverableSecurityException) e).getUserAction().getActionIntent(),
                    call, action, id, newName, extra);
                return true;
            }
        } catch (Exception ignored) {
            // fall through to rejection
        }
        return false;
    }

    private Uri uriFor(long id) {
        return ContentUris.withAppendedId(MediaStore.Files.getContentUri("external"), id);
    }

    // ------------------------------------------------------------------ API

    /** Any usable media access for this SDK level (partial access counts). */
    private boolean hasMediaPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) { // 34+
            return getPermissionState("images") == PermissionState.GRANTED
                || getPermissionState("video") == PermissionState.GRANTED
                || getPermissionState("partial") == PermissionState.GRANTED;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) { // 33
            return getPermissionState("images") == PermissionState.GRANTED
                || getPermissionState("video") == PermissionState.GRANTED;
        }
        return getPermissionState("legacy") == PermissionState.GRANTED;
    }

    @PluginMethod
    public void search(PluginCall call) {
        if (hasMediaPermission()) {
            runSearch(call);
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            requestPermissionForAliases(new String[]{"images", "video", "partial"}, call, "searchWithPermission");
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissionForAliases(new String[]{"images", "video"}, call, "searchWithPermission");
        } else {
            requestPermissionForAlias("legacy", call, "searchWithPermission");
        }
    }

    @PermissionCallback
    private void searchWithPermission(PluginCall call) {
        if (hasMediaPermission()) {
            runSearch(call);
        } else {
            call.reject("Media permission denied. Grant photo/video access in system settings to search this device.");
        }
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasMediaPermission());
        call.resolve(result);
    }

    /** Full details for one item (info view). */
    @PluginMethod
    public void getDetails(PluginCall call) {
        String idStr = call.getString("id");
        if (idStr == null) { call.reject("Missing id"); return; }
        long id = Long.parseLong(idStr);
        Uri uri = uriFor(id);

        List<String> cols = new ArrayList<>();
        Collections.addAll(cols,
            MediaStore.Files.FileColumns.DISPLAY_NAME,
            MediaStore.Files.FileColumns.TITLE,
            MediaStore.Files.FileColumns.MIME_TYPE,
            MediaStore.Files.FileColumns.SIZE,
            MediaStore.Files.FileColumns.DATE_ADDED,
            MediaStore.Files.FileColumns.DATE_MODIFIED,
            MediaStore.Files.FileColumns.MEDIA_TYPE,
            MediaStore.Files.FileColumns.WIDTH,
            MediaStore.Files.FileColumns.HEIGHT,
            MediaStore.Files.FileColumns.DURATION,
            MediaStore.Files.FileColumns.BUCKET_DISPLAY_NAME,
            MediaStore.Files.FileColumns.DATA);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            cols.add(MediaStore.Files.FileColumns.RELATIVE_PATH);
        }

        try (Cursor c = getContext().getContentResolver().query(
                uri, cols.toArray(new String[0]), null, null, null)) {
            if (c == null || !c.moveToFirst()) { call.reject("File not found"); return; }
            JSObject item = new JSObject();
            item.put("id", idStr);
            item.put("displayName", getStr(c, MediaStore.Files.FileColumns.DISPLAY_NAME));
            item.put("title", getStr(c, MediaStore.Files.FileColumns.TITLE));
            item.put("mimeType", getStr(c, MediaStore.Files.FileColumns.MIME_TYPE));
            item.put("size", getLong(c, MediaStore.Files.FileColumns.SIZE));
            item.put("dateAdded", getLong(c, MediaStore.Files.FileColumns.DATE_ADDED) * 1000L);
            item.put("dateModified", getLong(c, MediaStore.Files.FileColumns.DATE_MODIFIED) * 1000L);
            item.put("kind", getInt(c, MediaStore.Files.FileColumns.MEDIA_TYPE)
                == MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO ? "video" : "image");
            item.put("uri", uri.toString());
            item.put("album", getStr(c, MediaStore.Files.FileColumns.BUCKET_DISPLAY_NAME));
            item.put("path", getStr(c, MediaStore.Files.FileColumns.DATA));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                item.put("relativePath", getStr(c, MediaStore.Files.FileColumns.RELATIVE_PATH));
            }
            int w = getInt(c, MediaStore.Files.FileColumns.WIDTH);
            int h = getInt(c, MediaStore.Files.FileColumns.HEIGHT);
            long dur = getLong(c, MediaStore.Files.FileColumns.DURATION);
            if (w > 0) item.put("width", w);
            if (h > 0) item.put("height", h);
            if (dur > 0) item.put("duration", dur);
            call.resolve(item);
        } catch (Exception e) {
            call.reject("Could not read file info: " + e.getMessage(), e);
        }
    }

    /** Opens the item in another app (gallery / video player chooser). */
    @PluginMethod
    public void openWith(PluginCall call) {
        String idStr = call.getString("id");
        if (idStr == null) { call.reject("Missing id"); return; }
        long id = Long.parseLong(idStr);
        Uri uri = uriFor(id);
        String mime = "*/*";
        try (Cursor c = getContext().getContentResolver().query(
                uri, new String[]{MediaStore.Files.FileColumns.MIME_TYPE}, null, null, null)) {
            if (c != null && c.moveToFirst() && c.getString(0) != null) mime = c.getString(0);
        } catch (Exception ignored) {}

        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, mime);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            getActivity().startActivity(Intent.createChooser(intent, "Open with"));
            call.resolve();
        } catch (Exception e) {
            call.reject("No app can open this file: " + e.getMessage());
        }
    }

    /** Single rename, in place, via MediaStore DISPLAY_NAME. */
    @PluginMethod
    public void renameItem(PluginCall call) {
        String idStr = call.getString("id");
        String newName = call.getString("newName");
        if (idStr == null || newName == null || newName.trim().isEmpty()) {
            call.reject("Missing id or newName");
            return;
        }
        doRename(call, Long.parseLong(idStr), newName.trim(), false);
    }

    private void doRename(PluginCall call, long id, String newName, boolean afterConsent) {
        Uri uri = uriFor(id);
        try {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Files.FileColumns.DISPLAY_NAME, newName);
            int dot = newName.lastIndexOf('.');
            values.put(MediaStore.Files.FileColumns.TITLE, dot > 0 ? newName.substring(0, dot) : newName);
            int rows = getContext().getContentResolver().update(uri, values, null, null);
            if (rows > 0) {
                JSObject result = new JSObject();
                result.put("id", String.valueOf(id));
                result.put("displayName", newName);
                call.resolve(result);
            } else if (!afterConsent && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                requestConsent(
                    MediaStore.createWriteRequest(getContext().getContentResolver(),
                        Collections.singletonList(uri)),
                    call, "rename", id, newName, null);
            } else {
                call.reject("Could not rename this file.");
            }
        } catch (SecurityException e) {
            if (afterConsent || !handleSecurity(e, call, "rename", id, newName, null)) {
                call.reject("Rename not allowed for this file: " + e.getMessage());
            }
        } catch (Exception e) {
            call.reject("Rename failed: " + e.getMessage(), e);
        }
    }

    /** Delete one item from the device (with consent flow when required). */
    @PluginMethod
    public void deleteItem(PluginCall call) {
        String idStr = call.getString("id");
        if (idStr == null) { call.reject("Missing id"); return; }
        doDelete(call, Long.parseLong(idStr), false);
    }

    private void doDelete(PluginCall call, long id, boolean afterConsent) {
        Uri uri = uriFor(id);
        try {
            int rows = getContext().getContentResolver().delete(uri, null, null);
            if (rows > 0) {
                JSObject result = new JSObject();
                result.put("id", String.valueOf(id));
                result.put("deleted", true);
                call.resolve(result);
            } else if (!afterConsent && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                requestConsent(
                    MediaStore.createDeleteRequest(getContext().getContentResolver(),
                        Collections.singletonList(uri)),
                    call, "delete", id, null, null);
            } else {
                call.reject("Could not delete this file.");
            }
        } catch (SecurityException e) {
            if (afterConsent || !handleSecurity(e, call, "delete", id, null, null)) {
                call.reject("Delete not allowed for this file: " + e.getMessage());
            }
        } catch (Exception e) {
            call.reject("Delete failed: " + e.getMessage(), e);
        }
    }

    /**
     * Copy (or move, = copy + delete original) one item to a destination
     * album: "library" (Pictures/Movies › Bulk Rename), "download"
     * (Download › Bulk Rename) or "same" (the folder it already lives in).
     */
    @PluginMethod
    public void copyItem(PluginCall call) {
        String idStr = call.getString("id");
        if (idStr == null) { call.reject("Missing id"); return; }
        long id = Long.parseLong(idStr);
        String destination = call.getString("destination", "library");
        boolean move = Boolean.TRUE.equals(call.getBoolean("move", false));

        new Thread(() -> doCopy(call, id, destination, move)).start();
    }

    private void doCopy(PluginCall call, long id, String destination, boolean move) {
        Uri source = uriFor(id);
        try {
            // --- read source metadata
            String displayName = "media_" + id;
            String mime = null;
            int mediaType = MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE;
            String relativePath = null;
            String dataPath = null;
            List<String> cols = new ArrayList<>();
            Collections.addAll(cols,
                MediaStore.Files.FileColumns.DISPLAY_NAME,
                MediaStore.Files.FileColumns.MIME_TYPE,
                MediaStore.Files.FileColumns.MEDIA_TYPE,
                MediaStore.Files.FileColumns.DATA);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                cols.add(MediaStore.Files.FileColumns.RELATIVE_PATH);
            }
            try (Cursor c = getContext().getContentResolver().query(
                    source, cols.toArray(new String[0]), null, null, null)) {
                if (c == null || !c.moveToFirst()) { call.reject("File not found"); return; }
                String dn = getStr(c, MediaStore.Files.FileColumns.DISPLAY_NAME);
                if (dn != null && !dn.isEmpty()) displayName = dn;
                mime = getStr(c, MediaStore.Files.FileColumns.MIME_TYPE);
                mediaType = getInt(c, MediaStore.Files.FileColumns.MEDIA_TYPE);
                dataPath = getStr(c, MediaStore.Files.FileColumns.DATA);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    relativePath = getStr(c, MediaStore.Files.FileColumns.RELATIVE_PATH);
                }
            }
            boolean isVideo = mediaType == MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO;

            long newId;
            String newName = displayName;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // --- scoped storage: insert into the right collection
                String rel;
                switch (destination) {
                    case "download":
                        rel = Environment.DIRECTORY_DOWNLOADS + "/Bulk Rename/";
                        break;
                    case "same":
                        rel = (relativePath != null && !relativePath.isEmpty())
                            ? (relativePath.endsWith("/") ? relativePath : relativePath + "/")
                            : (isVideo ? Environment.DIRECTORY_MOVIES + "/" : Environment.DIRECTORY_PICTURES + "/");
                        break;
                    default: // library
                        rel = (isVideo ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_PICTURES)
                            + "/Bulk Rename/";
                }

                Uri collection = isVideo
                    ? MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                    : MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);

                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, displayName);
                if (mime != null) values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, rel);
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                Uri newUri = getContext().getContentResolver().insert(collection, values);
                if (newUri == null) { call.reject("Could not create the copy."); return; }

                try (InputStream in = getContext().getContentResolver().openInputStream(source);
                     OutputStream out = getContext().getContentResolver().openOutputStream(newUri, "w")) {
                    if (in == null || out == null) throw new Exception("Could not open file streams");
                    copyStream(in, out);
                } catch (Exception copyError) {
                    getContext().getContentResolver().delete(newUri, null, null);
                    call.reject("Copy failed: " + copyError.getMessage());
                    return;
                }

                ContentValues done = new ContentValues();
                done.put(MediaStore.MediaColumns.IS_PENDING, 0);
                getContext().getContentResolver().update(newUri, done, null, null);
                newId = ContentUris.parseId(newUri);
                String created = queryDisplayName(newUri);
                if (created != null) newName = created;
            } else {
                // --- legacy (API < 29): copy the underlying file, then rescan
                if (dataPath == null) { call.reject("Copy is not supported for this file on this Android version."); return; }
                File srcFile = new File(dataPath);
                File destDir;
                switch (destination) {
                    case "download":
                        destDir = new File(Environment.getExternalStoragePublicDirectory(
                            Environment.DIRECTORY_DOWNLOADS), "Bulk Rename");
                        break;
                    case "same":
                        destDir = srcFile.getParentFile();
                        break;
                    default:
                        destDir = new File(Environment.getExternalStoragePublicDirectory(
                            isVideo ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_PICTURES),
                            "Bulk Rename");
                }
                if (destDir == null || (!destDir.exists() && !destDir.mkdirs())) {
                    call.reject("Could not create the destination folder.");
                    return;
                }
                File destFile = uniqueFile(destDir, displayName);
                try (InputStream in = new FileInputStream(srcFile);
                     OutputStream out = new FileOutputStream(destFile)) {
                    copyStream(in, out);
                }
                newName = destFile.getName();
                MediaScannerConnection.scanFile(getContext(),
                    new String[]{destFile.getAbsolutePath()}, null, null);
                newId = -1;
            }

            JSObject result = new JSObject();
            result.put("copied", true);
            result.put("moved", false);
            result.put("destination", destination);
            JSObject item = new JSObject();
            item.put("id", String.valueOf(newId));
            item.put("displayName", newName);
            result.put("item", item);

            if (!move) {
                call.resolve(result);
                return;
            }

            // Move = delete the original now that the copy exists.
            try {
                int rows = getContext().getContentResolver().delete(source, null, null);
                if (rows > 0) {
                    result.put("moved", true);
                    call.resolve(result);
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    requestConsent(
                        MediaStore.createDeleteRequest(getContext().getContentResolver(),
                            Collections.singletonList(source)),
                        call, "moveDelete", id, null, result);
                } else {
                    result.put("warning", "Copied, but the original could not be removed.");
                    call.resolve(result);
                }
            } catch (SecurityException e) {
                if (!handleSecurity(e, call, "moveDelete", id, null, result)) {
                    result.put("warning", "Copied, but the original could not be removed.");
                    call.resolve(result);
                }
            }
        } catch (Exception e) {
            call.reject("Copy failed: " + e.getMessage(), e);
        }
    }

    /** Second half of a move, after the user approved deleting the original. */
    private void finishMove(PluginCall call, long originalId, JSObject result) {
        if (result == null) result = new JSObject();
        try {
            int rows = getContext().getContentResolver().delete(uriFor(originalId), null, null);
            result.put("moved", rows > 0);
            if (rows == 0) result.put("warning", "Copied, but the original could not be removed.");
        } catch (Exception e) {
            result.put("moved", false);
            result.put("warning", "Copied, but the original could not be removed.");
        }
        call.resolve(result);
    }

    private void copyStream(InputStream in, OutputStream out) throws Exception {
        byte[] buffer = new byte[64 * 1024];
        int read;
        while ((read = in.read(buffer)) != -1) {
            out.write(buffer, 0, read);
        }
        out.flush();
    }

    private File uniqueFile(File dir, String name) {
        File f = new File(dir, name);
        if (!f.exists()) return f;
        int dot = name.lastIndexOf('.');
        String base = dot > 0 ? name.substring(0, dot) : name;
        String ext = dot > 0 ? name.substring(dot) : "";
        int n = 1;
        while (f.exists()) {
            f = new File(dir, base + " (" + n + ")" + ext);
            n++;
        }
        return f;
    }

    private String queryDisplayName(Uri uri) {
        try (Cursor c = getContext().getContentResolver().query(
                uri, new String[]{MediaStore.Files.FileColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) {}
        return null;
    }

    private String getStr(Cursor c, String column) {
        int i = c.getColumnIndex(column);
        return (i >= 0 && !c.isNull(i)) ? c.getString(i) : null;
    }

    private long getLong(Cursor c, String column) {
        int i = c.getColumnIndex(column);
        return i >= 0 ? c.getLong(i) : 0;
    }

    private int getInt(Cursor c, String column) {
        int i = c.getColumnIndex(column);
        return i >= 0 ? c.getInt(i) : 0;
    }

    /**
     * Copies the given MediaStore ids into the app cache and returns file
     * paths the WebView can fetch (via Capacitor.convertFileSrc) so the
     * items become ordinary web Files in the rename queue.
     */
    @PluginMethod
    public void stageFiles(PluginCall call) {
        JSArray ids = call.getArray("ids");
        if (ids == null || ids.length() == 0) {
            call.reject("No media ids provided");
            return;
        }

        new Thread(() -> {
            try {
                File dir = new File(getContext().getCacheDir(), "device-media");
                if (!dir.exists() && !dir.mkdirs()) {
                    call.reject("Could not create staging directory");
                    return;
                }
                // Clear stale staged copies from a previous batch.
                File[] stale = dir.listFiles();
                if (stale != null) {
                    for (File f : stale) f.delete();
                }

                JSArray staged = new JSArray();
                for (int i = 0; i < ids.length(); i++) {
                    long id = ids.getLong(i);
                    Uri uri = ContentUris.withAppendedId(
                        MediaStore.Files.getContentUri("external"), id);

                    String name = "media_" + id;
                    String mime = null;
                    try (Cursor c = getContext().getContentResolver().query(
                            uri, new String[]{
                                MediaStore.Files.FileColumns.DISPLAY_NAME,
                                MediaStore.Files.FileColumns.MIME_TYPE},
                            null, null, null)) {
                        if (c != null && c.moveToFirst()) {
                            String display = c.getString(0);
                            if (display != null && !display.isEmpty()) name = display;
                            mime = c.getString(1);
                        }
                    }

                    File out = new File(dir, name);
                    // Avoid clobbering duplicates that share a display name.
                    if (out.exists()) {
                        out = new File(dir, id + "_" + name);
                    }

                    try (InputStream in = getContext().getContentResolver().openInputStream(uri);
                         OutputStream os = new FileOutputStream(out)) {
                        if (in == null) continue;
                        byte[] buffer = new byte[64 * 1024];
                        int read;
                        while ((read = in.read(buffer)) != -1) {
                            os.write(buffer, 0, read);
                        }
                    }

                    JSObject item = new JSObject();
                    item.put("id", String.valueOf(id));
                    item.put("name", out.getName());
                    item.put("originalName", name);
                    item.put("mimeType", mime != null ? mime : "");
                    item.put("size", out.length());
                    item.put("path", out.getAbsolutePath());
                    staged.put(item);
                }

                JSObject result = new JSObject();
                result.put("files", staged);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Failed to load selected media: " + e.getMessage(), e);
            }
        }).start();
    }

    // ------------------------------------------------------------- internals

    private void runSearch(PluginCall call) {
        String query = call.getString("query", "");
        int limit = call.getInt("limit", 200);
        JSArray mimeTypes = call.getArray("mimeTypes");

        Uri collection = MediaStore.Files.getContentUri("external");

        List<String> selectionParts = new ArrayList<>();
        List<String> args = new ArrayList<>();

        // Media only (images + videos), never audio/documents.
        selectionParts.add("(" + MediaStore.Files.FileColumns.MEDIA_TYPE + " IN (?, ?))");
        args.add(String.valueOf(MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE));
        args.add(String.valueOf(MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO));

        if (query != null && !query.trim().isEmpty()) {
            // Search by title *or* file name, case-insensitive (SQLite LIKE).
            selectionParts.add("(" + MediaStore.Files.FileColumns.DISPLAY_NAME + " LIKE ?"
                + " OR " + MediaStore.Files.FileColumns.TITLE + " LIKE ?)");
            String like = "%" + query.trim() + "%";
            args.add(like);
            args.add(like);
        }

        if (mimeTypes != null && mimeTypes.length() > 0) {
            StringBuilder placeholders = new StringBuilder();
            for (int i = 0; i < mimeTypes.length(); i++) {
                if (i > 0) placeholders.append(", ");
                placeholders.append("?");
                String mime = mimeTypes.optString(i, "");
                if (!mime.isEmpty()) args.add(mime);
            }
            selectionParts.add(MediaStore.Files.FileColumns.MIME_TYPE + " IN (" + placeholders + ")");
        }

        String selection = String.join(" AND ", selectionParts);
        String sortOrder = MediaStore.Files.FileColumns.DATE_MODIFIED + " DESC";

        JSArray items = new JSArray();
        try (Cursor cursor = getContext().getContentResolver().query(
                collection, PROJECTION, selection,
                args.toArray(new String[0]), sortOrder)) {
            if (cursor != null) {
                int idCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID);
                int nameCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DISPLAY_NAME);
                int titleCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.TITLE);
                int mimeCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.MIME_TYPE);
                int sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.SIZE);
                int dateCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DATE_MODIFIED);
                int typeCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.MEDIA_TYPE);
                int widthCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.WIDTH);
                int heightCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.HEIGHT);
                int durationCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DURATION);

                while (cursor.moveToNext() && items.length() < limit) {
                    long id = cursor.getLong(idCol);
                    Uri uri = ContentUris.withAppendedId(collection, id);
                    String mime = cursor.getString(mimeCol);
                    int mediaType = cursor.getInt(typeCol);

                    JSObject item = new JSObject();
                    item.put("id", String.valueOf(id));
                    item.put("title", cursor.getString(titleCol));
                    item.put("displayName", cursor.getString(nameCol));
                    item.put("mimeType", mime);
                    item.put("size", cursor.getLong(sizeCol));
                    // MediaStore stores seconds; JS wants milliseconds.
                    item.put("dateModified", cursor.getLong(dateCol) * 1000L);
                    item.put("kind", mediaType == MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO
                        ? "video" : "image");
                    item.put("uri", uri.toString());
                    if (!cursor.isNull(widthCol)) item.put("width", cursor.getInt(widthCol));
                    if (!cursor.isNull(heightCol)) item.put("height", cursor.getInt(heightCol));
                    if (!cursor.isNull(durationCol)) item.put("duration", cursor.getLong(durationCol));
                    items.put(item);
                }
            }
        } catch (Exception e) {
            call.reject("Media search failed: " + e.getMessage(), e);
            return;
        }

        JSObject result = new JSObject();
        result.put("items", items);
        result.put("count", items.length());
        call.resolve(result);
    }
}
