package com.bulkrenamer.app;

import android.Manifest;
import android.content.ContentUris;
import android.database.Cursor;
import android.net.Uri;
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
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
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
                args.add(mimeTypes.getString(i));
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
