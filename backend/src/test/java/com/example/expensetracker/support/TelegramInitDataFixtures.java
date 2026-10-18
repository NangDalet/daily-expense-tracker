package com.example.expensetracker.support;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public final class TelegramInitDataFixtures {
    public static final String BOT_TOKEN = "123456789:mini-app-test-token-not-a-real-credential";
    private TelegramInitDataFixtures() {}

    public static String sign(Map<String, String> values) {
        return sign(values, BOT_TOKEN);
    }

    public static String sign(Map<String, String> values, String botToken) {
        try {
            var sorted = new TreeMap<>(values);
            String data = sorted.entrySet().stream().map(e -> e.getKey() + "=" + e.getValue()).collect(Collectors.joining("\n"));
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec("WebAppData".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] key = mac.doFinal(botToken.getBytes(StandardCharsets.UTF_8));
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            sorted.put("hash", HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8))));
            return sorted.entrySet().stream().map(e -> URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8)
                    + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8)).collect(Collectors.joining("&"));
        } catch (java.security.GeneralSecurityException ex) { throw new IllegalStateException(ex); }
    }
}
