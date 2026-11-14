package com.etop.app;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.database.Cursor;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.InputStream;
import java.security.MessageDigest;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private static final String PREFERENCES = "etop_app_updates";
    private static final String DOWNLOAD_ID = "download_id";
    private static final String DOWNLOAD_SHA256 = "download_sha256";

    @PluginMethod
    public void downloadApk(PluginCall call) {
        String url = call.getString("url");
        String sha256 = call.getString("sha256", "");
        Uri uri;
        try {
            uri = Uri.parse(url);
        } catch (Exception error) {
            call.reject("The update download URL is invalid.");
            return;
        }

        if (url == null || !"https".equalsIgnoreCase(uri.getScheme())) {
            call.reject("Android updates must use a secure HTTPS download URL.");
            return;
        }
        if (!sha256.matches("(?i)[a-f0-9]{64}")) {
            call.reject("The Android update checksum is invalid.");
            return;
        }

        DownloadManager manager = (DownloadManager) getContext()
            .getSystemService(Context.DOWNLOAD_SERVICE);
        android.content.SharedPreferences preferences = getContext()
            .getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
        long previousId = preferences.getLong(DOWNLOAD_ID, -1);
        if (previousId >= 0) {
            manager.remove(previousId);
        }
        DownloadManager.Request request = new DownloadManager.Request(uri)
            .setTitle("E Top update")
            .setDescription("Downloading the latest E Top app.")
            .setMimeType("application/vnd.android.package-archive")
            .setNotificationVisibility(
                DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
            )
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(false)
            .setDestinationInExternalFilesDir(
                getContext(),
                Environment.DIRECTORY_DOWNLOADS,
                "etop-update-" + System.currentTimeMillis() + ".apk"
            );
        long id = manager.enqueue(request);
        preferences.edit()
            .putLong(DOWNLOAD_ID, id)
            .putString(DOWNLOAD_SHA256, sha256.toLowerCase())
            .apply();

        JSObject result = new JSObject();
        result.put("downloadId", id);
        call.resolve(result);
    }

    @PluginMethod
    public void getPendingDownload(PluginCall call) {
        String expectedSha256 = call.getString("sha256", "");
        android.content.SharedPreferences preferences = getContext()
            .getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
        long id = preferences.getLong(DOWNLOAD_ID, -1);
        String storedSha256 = preferences.getString(DOWNLOAD_SHA256, "");
        if (!storedSha256.equalsIgnoreCase(expectedSha256)) {
            DownloadManager manager = (DownloadManager) getContext()
                .getSystemService(Context.DOWNLOAD_SERVICE);
            if (id >= 0) manager.remove(id);
            preferences.edit()
                .remove(DOWNLOAD_ID)
                .remove(DOWNLOAD_SHA256)
                .apply();
            id = -1;
        }
        JSObject result = new JSObject();
        result.put("downloadId", id);
        call.resolve(result);
    }

    @PluginMethod
    public void getDownloadProgress(PluginCall call) {
        long id = call.getLong("downloadId", -1L);
        if (id < 0) {
            call.reject("The Android download ID is invalid.");
            return;
        }

        DownloadManager manager = (DownloadManager) getContext()
            .getSystemService(Context.DOWNLOAD_SERVICE);
        Cursor cursor = manager.query(new DownloadManager.Query().setFilterById(id));
        if (cursor == null) {
            call.reject("Could not check the Android download.");
            return;
        }

        try {
            if (!cursor.moveToFirst()) {
                call.reject("The Android download was not found.");
                return;
            }

            int status = cursor.getInt(
                cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)
            );
            int downloaded = cursor.getInt(
                cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)
            );
            int total = cursor.getInt(
                cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)
            );
            int reason = cursor.getInt(
                cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)
            );

            JSObject result = new JSObject();
            result.put("status", statusName(status));
            result.put("bytesDownloaded", downloaded);
            result.put("totalBytes", total);
            result.put("reason", reason);
            call.resolve(result);
        } finally {
            cursor.close();
        }
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        long id = call.getLong("downloadId", -1L);
        String expectedSha256 = call.getString("sha256", "");
        if (id < 0 || !expectedSha256.matches("(?i)[a-f0-9]{64}")) {
            call.reject("The Android update information is invalid.");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent settingsIntent = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                getContext().startActivity(settingsIntent);
            } catch (Exception error) {
                call.reject("Could not open Android install permission settings.");
                return;
            }
            JSObject result = new JSObject();
            result.put("permissionRequired", true);
            call.resolve(result);
            return;
        }

        DownloadManager manager = (DownloadManager) getContext()
            .getSystemService(Context.DOWNLOAD_SERVICE);
        Uri apkUri = manager.getUriForDownloadedFile(id);
        if (apkUri == null) {
            call.reject("The Android update has not finished downloading.");
            return;
        }

        try {
            String actualSha256 = sha256(apkUri);
            if (!MessageDigest.isEqual(
                actualSha256.toLowerCase().getBytes(),
                expectedSha256.toLowerCase().getBytes()
            )) {
                call.reject("The downloaded APK failed its integrity check. Download it again.");
                return;
            }
        } catch (Exception error) {
            call.reject("Could not verify the downloaded APK.");
            return;
        }

        Intent installIntent = new Intent(Intent.ACTION_VIEW);
        installIntent.setDataAndType(
            apkUri,
            "application/vnd.android.package-archive"
        );
        installIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION
        );
        try {
            getContext().startActivity(installIntent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Android could not open the package installer.");
        }
    }

    private String sha256(Uri uri) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
            if (input == null) {
                throw new IllegalStateException("Could not read the downloaded APK.");
            }
            byte[] buffer = new byte[64 * 1024];
            int count;
            while ((count = input.read(buffer)) != -1) {
                digest.update(buffer, 0, count);
            }
        }

        StringBuilder result = new StringBuilder();
        for (byte value : digest.digest()) {
            result.append(String.format("%02x", value & 0xff));
        }
        return result.toString();
    }

    private String statusName(int status) {
        if (status == DownloadManager.STATUS_PENDING) return "pending";
        if (status == DownloadManager.STATUS_RUNNING) return "running";
        if (status == DownloadManager.STATUS_PAUSED) return "paused";
        if (status == DownloadManager.STATUS_SUCCESSFUL) return "successful";
        if (status == DownloadManager.STATUS_FAILED) return "failed";
        return "unknown";
    }
}
