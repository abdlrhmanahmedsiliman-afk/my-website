package com.kashf.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.view.KeyEvent;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Kashf Android shell.
 *
 * The whole invoicing app is bundled under assets/www and served through a
 * private https://appassets.androidplatform.net origin. That gives the page a
 * stable, secure origin so localStorage (the app database) persists correctly
 * and the CSP in index.html keeps working. No network permission is requested:
 * every request is answered from the APK assets.
 */
public class MainActivity extends Activity {

    private static final String APP_ORIGIN = "https://appassets.androidplatform.net";
    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final String START_URL = APP_ORIGIN + "/assets/www/index.html";
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int SAVE_FILE_REQUEST = 1002;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private String pendingSaveContent;
    private String pendingSaveName;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.parseColor("#0A1914"));
        getWindow().setNavigationBarColor(Color.parseColor("#0A1914"));

        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        webView.setBackgroundColor(Color.parseColor("#0A1914"));
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri != null && APP_ORIGIN.substring("https://".length()).equals(uri.getHost())) {
                    String path = uri.getPath();
                    if (path != null && path.startsWith("/assets/") && !path.contains("..")) {
                        String assetPath = path.substring("/assets/".length());
                        try {
                            InputStream stream = getAssets().open(assetPath);
                            String mime = mimeTypeFor(assetPath);
                            // Binary assets must not be decoded as UTF-8 text.
                            String encoding = isTextMime(mime) ? "UTF-8" : null;
                            return new WebResourceResponse(mime, encoding, stream);
                        } catch (IOException e) {
                            return new WebResourceResponse("text/plain", "UTF-8", 404,
                                    "Not Found", null, null);
                        }
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleExternalUri(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleExternalUri(Uri.parse(url));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // window.print() is a no-op in a plain WebView. Route it to the
                // Android print service so "Save as PDF" works from the app.
                view.evaluateJavascript(
                        "(function(){if(window.KashfAndroid&&window.KashfAndroid.printPage){" +
                                "window.print=function(){window.KashfAndroid.printPage();};}})();",
                        null);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_CHOOSER_REQUEST);
                    return true;
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
            }
        });

        webView.addJavascriptInterface(new PrintBridge(), "KashfAndroid");

        setContentView(webView);
        webView.loadUrl(START_URL);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (filePathCallback == null) return;
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                ClipData clipData = data.getClipData();
                if (clipData != null) {
                    results = new Uri[clipData.getItemCount()];
                    for (int i = 0; i < clipData.getItemCount(); i++) {
                        results[i] = clipData.getItemAt(i).getUri();
                    }
                } else if (data.getDataString() != null) {
                    results = new Uri[]{Uri.parse(data.getDataString())};
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
            return;
        }

        if (requestCode == SAVE_FILE_REQUEST) {
            if (resultCode == Activity.RESULT_OK && data != null && data.getData() != null
                    && pendingSaveContent != null) {
                try (OutputStream output = getContentResolver().openOutputStream(data.getData())) {
                    if (output != null) {
                        output.write(pendingSaveContent.getBytes(StandardCharsets.UTF_8));
                        output.flush();
                        Toast.makeText(this, "تم حفظ الملف", Toast.LENGTH_SHORT).show();
                    }
                } catch (Exception e) {
                    Toast.makeText(this, "تعذر حفظ الملف", Toast.LENGTH_SHORT).show();
                }
            }
            pendingSaveContent = null;
            pendingSaveName = null;
            return;
        }

        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView != null && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    /**
     * Keep the app origin inside the WebView, but send tel:, mailto:, WhatsApp
     * and normal web links to the matching external app. This keeps the
     * offline app shell intact and still lets "share on WhatsApp" work.
     */
    private boolean handleExternalUri(Uri uri) {
        if (uri == null) return false;
        String scheme = uri.getScheme();
        if (scheme == null) return false;
        if (("http".equals(scheme) || "https".equals(scheme))
                && APP_HOST.equals(uri.getHost())) {
            return false;
        }
        if ("http".equals(scheme) || "https".equals(scheme) || "mailto".equals(scheme)
                || "tel".equals(scheme) || "sms".equals(scheme) || "whatsapp".equals(scheme)) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (Exception e) {
                Toast.makeText(this, "تعذر فتح الرابط", Toast.LENGTH_SHORT).show();
            }
            return true;
        }
        return false;
    }

    private static String mimeTypeFor(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
        if (lower.endsWith(".js")) return "application/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".webmanifest")) return "application/manifest+json";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".ttf")) return "font/ttf";
        if (lower.endsWith(".otf")) return "font/otf";
        if (lower.endsWith(".ico")) return "image/x-icon";
        return "application/octet-stream";
    }

    private static boolean isTextMime(String mime) {
        return mime.startsWith("text/")
                || "application/javascript".equals(mime)
                || "application/json".equals(mime)
                || "application/manifest+json".equals(mime)
                || "image/svg+xml".equals(mime);
    }

    /** Native bridge exposed to the bundled web app as window.KashfAndroid. */
    public class PrintBridge {

        @JavascriptInterface
        public void printPage() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (webView == null) return;
                    PrintManager printManager =
                            (PrintManager) getSystemService(Context.PRINT_SERVICE);
                    if (printManager == null) return;
                    PrintDocumentAdapter adapter =
                            webView.createPrintDocumentAdapter("Kashf Invoice");
                    printManager.print("Kashf Invoice", adapter, null);
                }
            });
        }

        @JavascriptInterface
        public void saveFile(String filename, String mime, String content) {
            pendingSaveContent = content;
            pendingSaveName = filename;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType(mime == null || mime.isEmpty()
                            ? "application/octet-stream" : mime);
                    String safeName = pendingSaveName == null ? "kashf-file"
                            : pendingSaveName.replaceAll("[\\\\/:*?\"<>|]", "-");
                    intent.putExtra(Intent.EXTRA_TITLE, safeName);
                    try {
                        startActivityForResult(intent, SAVE_FILE_REQUEST);
                    } catch (Exception e) {
                        pendingSaveContent = null;
                        pendingSaveName = null;
                        Toast.makeText(MainActivity.this,
                                "تعذر فتح نافذة الحفظ", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public void openExternal(final String url) {
            if (url == null || url.isEmpty()) return;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    handleExternalUri(Uri.parse(url));
                }
            });
        }
    }
}
