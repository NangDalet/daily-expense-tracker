package com.example.expensetracker.telegram.auth;

import static org.assertj.core.api.Assertions.*;
import com.example.expensetracker.config.TelegramProperties;
import com.example.expensetracker.exception.ApiException;
import com.example.expensetracker.exception.AuthenticationException;
import com.example.expensetracker.exception.ErrorCode;
import com.example.expensetracker.support.TelegramInitDataFixtures;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class TelegramInitDataValidatorTest {
    private static final Instant NOW = Instant.parse("2026-10-18T04:00:00Z");
    private TelegramProperties properties;
    private TelegramInitDataValidator validator;

    @BeforeEach void setup() {
        properties = new TelegramProperties();
        properties.setEnabled(true); properties.setMiniAppEnabled(true);
        properties.setBotToken(TelegramInitDataFixtures.BOT_TOKEN);
        validator = new TelegramInitDataValidator(properties, new ObjectMapper(), Clock.fixed(NOW, ZoneOffset.UTC));
    }

    String signed(long timestamp, String user) {
        return TelegramInitDataFixtures.sign(Map.of("auth_date", Long.toString(timestamp), "user", user));
    }

    @Test void authenticatesLargeIdsAndEscapedUnicodeWithAdditionalSignedFields() {
        String data = TelegramInitDataFixtures.sign(Map.of("user", "{\"id\":987654321012,\"first_name\":\"សុខ + & =\"}",
                "auth_date", Long.toString(NOW.getEpochSecond()), "query_id", "AA+abc/==", "signature", "example-signature"));
        assertThat(validator.validate(data)).isEqualTo(987654321012L);
    }

    @Test void rejectsTamperedIdentityAndWrongBot() {
        String valid = signed(NOW.getEpochSecond(), "{\"id\":12345}");
        assertThatThrownBy(() -> validator.validate(valid.replace("12345", "67890"))).isInstanceOf(AuthenticationException.class);
        String otherBot = TelegramInitDataFixtures.sign(Map.of("auth_date", Long.toString(NOW.getEpochSecond()), "user", "{\"id\":12345}"), "another-bot-token");
        assertThatThrownBy(() -> validator.validate(otherBot)).isInstanceOf(AuthenticationException.class);
    }

    @Test void rejectsExpiredAndFutureData() {
        for (long time : new long[] { NOW.minusSeconds(301).getEpochSecond(), NOW.plusSeconds(31).getEpochSecond() }) {
            assertThatThrownBy(() -> validator.validate(signed(time, "{\"id\":12345}")))
                    .isInstanceOfSatisfying(AuthenticationException.class, ex -> assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.TOKEN_EXPIRED));
        }
    }

    @ParameterizedTest @ValueSource(strings = {"{}", "{\"id\":0}", "{\"id\":-1}", "{\"id\":1.5}", "{\"id\":\"123\"}", "{\"id\":12,\"is_bot\":true}", "[]", "broken"})
    void rejectsInvalidUserIdentities(String user) {
        assertThatThrownBy(() -> validator.validate(signed(NOW.getEpochSecond(), user))).isInstanceOf(AuthenticationException.class);
    }

    @ParameterizedTest @ValueSource(strings = {"", "hash=bad", "user=%xx&auth_date=123&hash=bad", "query_id"})
    void rejectsMalformedData(String data) {
        assertThatThrownBy(() -> validator.validate(data)).isInstanceOf(AuthenticationException.class);
    }

    @Test void rejectsDuplicateKeysEvenIfTheOriginalSignatureIsValid() {
        String data = signed(NOW.getEpochSecond(), "{\"id\":12345}");
        assertThatThrownBy(() -> validator.validate(data + "&user=%7B%22id%22%3A67890%7D")).isInstanceOf(AuthenticationException.class);
        assertThatThrownBy(() -> validator.validate(data + "&%75ser=%7B%22id%22%3A12345%7D")).isInstanceOf(AuthenticationException.class);
    }

    @Test void rejectsMissingTimestampAndExcessivelyLargeData() {
        assertThatThrownBy(() -> validator.validate(TelegramInitDataFixtures.sign(Map.of("user", "{\"id\":12345}"))))
                .isInstanceOf(AuthenticationException.class);
        assertThatThrownBy(() -> validator.validate("x".repeat(16385))).isInstanceOf(AuthenticationException.class);
    }

    @Test void failsClosedWhenDisabledOrTokenIsMissing() {
        properties.setMiniAppEnabled(false);
        assertThatThrownBy(() -> validator.validate("anything")).isInstanceOf(ApiException.class);
        properties.setMiniAppEnabled(true); properties.setBotToken("");
        assertThatThrownBy(() -> validator.validate("anything")).isInstanceOf(ApiException.class);
    }
}
