package com.example.expensetracker.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.example.expensetracker.support.TelegramInitDataFixtures;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = {"app.telegram.enabled=true", "app.telegram.mini-app-enabled=true",
        "app.telegram.bot-token=" + TelegramInitDataFixtures.BOT_TOKEN, "debug=false"})
@AutoConfigureMockMvc @ActiveProfiles("test") @Transactional @Tag("integration")
class TelegramMiniAppAuthIT extends AbstractPostgresIT {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired JwtDecoder decoder;
    private UUID owner;
    private static final long TELEGRAM_ID = 987654321012L;

    @BeforeEach void seed() {
        owner = UUID.randomUUID();
        jdbc.update("INSERT INTO users(id,username,email,password,roles,enabled) VALUES (?,?,?,'unusable-test-password','USER',true)",
                owner, "mini-" + owner, owner + "@example.com");
        jdbc.update("INSERT INTO telegram_connections(user_id,chat_id,enabled) VALUES (?,?,true)", owner, TELEGRAM_ID);
    }

    String signed(long id, Instant timestamp) {
        return TelegramInitDataFixtures.sign(Map.of("auth_date", Long.toString(timestamp.getEpochSecond()),
                "user", "{\"id\":" + id + ",\"username\":\"root\"}"));
    }

    @Test void signsIntoTheLinkedAccountAndPreservesActualRoles() throws Exception {
        String response = mvc.perform(post("/api/v1/auth/telegram").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("initData", signed(TELEGRAM_ID, Instant.now()), "userId", UUID.randomUUID(), "roles", new String[]{"SUPER_ADMIN"}))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.user.id").value(owner.toString()))
                .andExpect(jsonPath("$.data.user.roles[0]").value("USER")).andReturn().getResponse().getContentAsString();
        var tokens = json.readTree(response).path("data");
        String access = tokens.path("accessToken").asText();
        assertThat(decoder.decode(access).getSubject()).isEqualTo(owner.toString());
        mvc.perform(get("/api/v1/profile").header("Authorization", "Bearer " + access))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value(owner.toString()));
        mvc.perform(get("/api/v1/users").header("Authorization", "Bearer " + access)).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("refreshToken", tokens.path("refreshToken").asText()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.user.id").value(owner.toString()));
    }

    @Test void rejectsTamperingExpiredAndUnlinkedIdentities() throws Exception {
        for (String data : new String[]{signed(TELEGRAM_ID, Instant.now()).replace("987654321012", "987654321013"),
                signed(TELEGRAM_ID, Instant.now().minusSeconds(360))}) {
            mvc.perform(post("/api/v1/auth/telegram").contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(Map.of("initData", data)))).andExpect(status().isUnauthorized());
        }
        mvc.perform(post("/api/v1/auth/telegram").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("initData", signed(TELEGRAM_ID + 1, Instant.now())))))
                .andExpect(status().isForbidden());
    }

    @Test void rejectsDisabledAccountsAndDisconnectedLinks() throws Exception {
        jdbc.update("UPDATE users SET enabled=false WHERE id=?", owner);
        mvc.perform(post("/api/v1/auth/telegram").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("initData", signed(TELEGRAM_ID, Instant.now()))))).andExpect(status().isForbidden());
        jdbc.update("UPDATE users SET enabled=true WHERE id=?", owner);
        jdbc.update("UPDATE telegram_connections SET enabled=false WHERE user_id=?", owner);
        mvc.perform(post("/api/v1/auth/telegram").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("initData", signed(TELEGRAM_ID, Instant.now()))))).andExpect(status().isForbidden());
    }

    @Test void rejectsEmptyRequestsAndKeepsExistingApisProtected() throws Exception {
        mvc.perform(post("/api/v1/auth/telegram").contentType(MediaType.APPLICATION_JSON).content("{\"initData\":\"\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/profile")).andExpect(status().isUnauthorized());
    }
}
