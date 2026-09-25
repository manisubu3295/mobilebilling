package com.aadhirai.billing;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * window.print() does nothing inside the Android WebView, so the web app's
 * print preview hands the document HTML here instead. It is loaded into an
 * off-screen WebView and passed to the system print dialog (printer or
 * "Save as PDF").
 */
@CapacitorPlugin(name = "NativePrint")
public class NativePrintPlugin extends Plugin {

    // Held so the WebView isn't garbage-collected while the print job runs.
    private WebView printWebView;

    @PluginMethod
    public void print(PluginCall call) {
        String html = call.getString("html");
        String name = call.getString("name", "Document");
        if (html == null || html.isEmpty()) {
            call.reject("html is required");
            return;
        }

        getActivity().runOnUiThread(() -> {
            WebView webView = new WebView(getActivity());
            webView.getSettings().setJavaScriptEnabled(false);
            webView.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    PrintManager printManager =
                        (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                    PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(name);
                    printManager.print(name, adapter, new PrintAttributes.Builder().build());
                    call.resolve(new JSObject());
                }
            });
            webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
            printWebView = webView;
        });
    }
}
