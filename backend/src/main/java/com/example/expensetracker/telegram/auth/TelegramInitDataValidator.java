package com.example.expensetracker.telegram.auth;

import com.example.expensetracker.config.TelegramProperties;
import com.example.expensetracker.exception.ApiException;
import com.example.expensetracker.exception.AuthenticationException;
import com.example.expensetracker.exception.ErrorCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.util.HexFormat;
import java.util.TreeMap;
import java.util.stream.Collectors;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

/** Verifies Telegram's raw initData before reading any identity from it. */
@Component
public class TelegramInitDataValidator {
    private final TelegramProperties properties;
    private final ObjectMapper json;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public TelegramInitDataValidator(TelegramProperties properties, ObjectMapper json) {
        this(properties, json, Clock.systemUTC());
    }

    TelegramInitDataValidator(TelegramProperties properties, ObjectMapper json, Clock clock) {
        this.properties = properties;
        this.json = json;
        this.clock = clock;
    }

    public long validate(String initData) {
        if (!properties.isEnabled() || !properties.isMiniAppEnabled() || properties.getBotToken().isBlank()
                || properties.getMiniAppAuthMaxAge() == null || properties.getMiniAppAuthMaxAge().isNegative()
                || properties.getMiniAppAuthMaxAge().isZero()) {
            throw new ApiException(ErrorCode.SERVICE_UNAVAILABLE, "Telegram Mini App sign-in is not enabled on this server");
        }
        try {
            if (initData == null || initData.isBlank() || initData.length() > 16384) throw invalid();
            var fields = new TreeMap<String, String>();
            for (String entry : initData.split("&", -1)) {
                String[] pair = entry.split("=", 2);
                if (pair.length != 2) throw invalid();
                String key = URLDecoder.decode(pair[0], StandardCharsets.UTF_8);
                String value = URLDecoder.decode(pair[1], StandardCharsets.UTF_8);
                if (!key.matches("[a-z_]+") || fields.putIfAbsent(key, value) != null) throw invalid();
            }
            String hash = fields.remove("hash");
            if (hash == null || !hash.matches("[0-9a-fA-F]{64}")) throw invalid();
            String check = fields.entrySet().stream().map(e -> e.getKey() + "=" + e.getValue())
                    .collect(Collectors.joining("\n"));
            byte[] key = hmac("WebAppData".getBytes(StandardCharsets.UTF_8), properties.getBotToken());
            if (!MessageDigest.isEqual(HexFormat.of().parseHex(hash), hmac(key, check))) throw invalid();

            Instant issuedAt = Instant.ofEpochSecond(Long.parseLong(fields.get("auth_date")));
            Instant now = clock.instant();
            if (issuedAt.isAfter(now.plusSeconds(30)) || issuedAt.isBefore(now.minus(properties.getMiniAppAuthMaxAge()))) {
                throw new AuthenticationException(ErrorCode.TOKEN_EXPIRED, "Telegram sign-in expired. Close and reopen the Mini App.");
            }
            var user = json.readTree(fields.get("user"));
            if (user == null || !user.isObject() || !user.path("id").isIntegralNumber()
                    || !user.path("id").canConvertToLong() || user.path("id").longValue() <= 0
                    || user.path("is_bot").asBoolean(false)) throw invalid();
            return user.path("id").longValue();
        } catch (AuthenticationException ex) {
            throw ex;
        } catch (java.io.IOException | IllegalArgumentException | java.time.DateTimeException ex) {
            throw invalid();
        }
    }

    private static byte[] hmac(byte[] key, String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("HMAC-SHA256 is unavailable", ex);
        }
    }

    private static AuthenticationException invalid() {
        return new AuthenticationException("Invalid Telegram sign-in data. Open the Mini App from the Telegram bot.");
    }
}
