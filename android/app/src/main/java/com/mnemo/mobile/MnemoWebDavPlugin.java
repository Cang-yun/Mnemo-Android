package com.mnemo.mobile;

import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.concurrent.TimeUnit;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;

@CapacitorPlugin(name = "MnemoWebDav")
public class MnemoWebDavPlugin extends Plugin {
    private static final MediaType OCTET_STREAM = MediaType.parse("application/octet-stream");
    private final OkHttpClient client = new OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build();

    @PluginMethod
    public void request(PluginCall call) {
        String url = call.getString("url");
        String method = call.getString("method", "GET");
        if (url == null || url.length() == 0) {
            call.reject("missing-url");
            return;
        }

        try {
            Request.Builder builder = new Request.Builder().url(url);
            JSObject headers = call.getObject("headers", new JSObject());
            Iterator<String> keys = headers.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                String value = headers.optString(key, null);
                if (value != null) builder.header(key, value);
            }

            String data = call.getString("data");
            boolean dataIsBase64 = Boolean.TRUE.equals(call.getBoolean("dataIsBase64", false));
            RequestBody body = null;
            if (data != null) {
                String contentType = headers.optString("Content-Type", "application/octet-stream");
                MediaType mediaType = MediaType.parse(contentType);
                if (dataIsBase64) {
                    body = RequestBody.create(Base64.decode(data, Base64.DEFAULT), mediaType != null ? mediaType : OCTET_STREAM);
                } else {
                    body = RequestBody.create(data.getBytes(StandardCharsets.UTF_8), mediaType);
                }
            }

            builder.method(method.toUpperCase(), methodAllowsBody(method) ? bodyOrEmpty(body) : null);

            try (Response response = client.newCall(builder.build()).execute()) {
                JSObject result = new JSObject();
                result.put("status", response.code());
                result.put("url", response.request().url().toString());
                result.put("headers", toHeaders(response));

                ResponseBody responseBody = response.body();
                String responseType = call.getString("responseType", "text");
                if (responseBody == null) {
                    result.put("data", "");
                } else if ("arraybuffer".equalsIgnoreCase(responseType) || "blob".equalsIgnoreCase(responseType)) {
                    result.put("data", Base64.encodeToString(responseBody.bytes(), Base64.NO_WRAP));
                } else {
                    result.put("data", responseBody.string());
                }

                call.resolve(result);
            }
        } catch (IOException error) {
            call.reject(error.getMessage(), error);
        } catch (Exception error) {
            call.reject(error.getMessage(), error);
        }
    }

    private boolean methodAllowsBody(String method) {
        String normalized = method == null ? "GET" : method.toUpperCase();
        return normalized.equals("POST") ||
            normalized.equals("PUT") ||
            normalized.equals("PATCH") ||
            normalized.equals("PROPPATCH") ||
            normalized.equals("LOCK") ||
            normalized.equals("UNLOCK");
    }

    private RequestBody bodyOrEmpty(RequestBody body) {
        return body != null ? body : RequestBody.create(new byte[0], OCTET_STREAM);
    }

    private JSObject toHeaders(Response response) {
        JSObject headers = new JSObject();
        for (String name : response.headers().names()) {
            headers.put(name, response.header(name));
        }
        return headers;
    }
}
