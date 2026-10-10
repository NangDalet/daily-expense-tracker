package com.example.expensetracker.integration;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.UUID;
import javax.imageio.ImageIO;
import com.example.expensetracker.mapper.UserMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional @Tag("integration")
class ProfileMonthlyIT extends AbstractPostgresIT {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserMapper users;
    UUID owner, other;
    @BeforeEach void setup() {
        owner = UUID.randomUUID(); other = UUID.randomUUID();
        for (var id : new UUID[]{owner, other}) jdbc.update(
                "INSERT INTO users(id,username,email,password,full_name,roles,enabled) VALUES (?,?,?,?,?,'USER',true)",
                id, "user-" + id, id + "@example.com", "unchanged-hash", "Original name");
    }
    RequestPostProcessor as(UUID id) {
        return jwt().jwt(token -> token.subject(id.toString())).authorities(new SimpleGrantedAuthority("ROLE_USER"));
    }
    @Test void profileWritesOnlyOwnAllowedFieldsAndDoesNotEscalatePrivileges() throws Exception {
        mvc.perform(put("/api/v1/profile").with(as(owner)).contentType(MediaType.APPLICATION_JSON).content("""
            {"username":"new-username","email":"new@example.com","fullName":"ឈ្មោះថ្មី",
             "roles":["SUPER_ADMIN"],"enabled":false,"id":"%s"}
            """.formatted(other))).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(owner.toString()))
                .andExpect(jsonPath("$.data.fullName").value("ឈ្មោះថ្មី"))
                .andExpect(jsonPath("$.data.roles[0]").value("USER"));
        var updated = users.findById(owner);
        assertThat(updated.getEnabled()).isTrue();
        assertThat(updated.getPassword()).isEqualTo("unchanged-hash");
        assertThat(users.findById(other).getFullName()).isEqualTo("Original name");
        mvc.perform(get("/api/v1/profile").with(as(other))).andExpect(jsonPath("$.data.id").value(other.toString()));
        mvc.perform(get("/api/v1/profile")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/v1/users/" + other).with(as(owner)).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
    }
    @Test void duplicateIdentityAndInvalidFieldsLeaveTheProfileUntouched() throws Exception {
        String before = users.findById(owner).getUsername();
        mvc.perform(put("/api/v1/profile").with(as(owner)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"user-%s\",\"email\":\"mine@example.com\",\"fullName\":\"Mine\"}".formatted(other)))
                .andExpect(status().isConflict());
        mvc.perform(put("/api/v1/profile").with(as(owner)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"valid-user\",\"email\":\"%s@example.com\"}".formatted(other)))
                .andExpect(status().isConflict());
        mvc.perform(put("/api/v1/profile").with(as(owner)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"!\",\"email\":\"invalid\"}"))
                .andExpect(status().isBadRequest());
        assertThat(users.findById(owner).getUsername()).isEqualTo(before);
    }
    @Test void profilePhotosPersistForTheirOwnerAndCanBeRemoved() throws Exception {
        var output = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB), "png", output);
        String image = "data:image/png;base64," + Base64.getEncoder().encodeToString(output.toByteArray());
        mvc.perform(put("/api/v1/profile/photo").with(as(owner)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"imageData\":\"" + image + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.avatarUrl").isString());
        assertThat(users.findById(owner).getAvatarUrl()).startsWith("data:image/jpeg;base64,");
        assertThat(users.findById(other).getAvatarUrl()).isNull();
        mvc.perform(put("/api/v1/profile/photo").with(as(owner)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"imageData\":\"data:image/svg+xml;base64,PHN2Zz4=\"}"))
                .andExpect(status().isBadRequest());
        assertThat(users.findById(owner).getAvatarUrl()).isNotNull();
        mvc.perform(delete("/api/v1/profile/photo").with(as(owner))).andExpect(status().isOk());
        assertThat(users.findById(owner).getAvatarUrl()).isNull();
    }
    void entry(String table, String currency, String amount, String date, UUID id) {
        String dateColumn = table.equals("incomes") ? "income_date" : "expense_date";
        jdbc.update("INSERT INTO " + table + "(user_id,amount,currency," + dateColumn + ",payment_method) VALUES (?,?::numeric,?,?::date,'CASH')", id, amount, currency, date);
    }
    @Test void monthlyTotalsIncludeWholeMonthAndKeepCurrenciesAndOwnersSeparate() throws Exception {
        entry("incomes", "USD", "1000.10", "2026-10-01", owner);
        entry("incomes", "USD", "0.20", "2026-10-31", owner);
        entry("expenses", "USD", "88.48", "2026-10-31", owner);
        entry("incomes", "KHR", "10000", "2026-10-10", owner);
        entry("expenses", "KHR", "4500", "2026-10-10", owner);
        entry("expenses", "USD", "999", "2026-09-30", owner);
        entry("expenses", "USD", "999", "2026-11-01", owner);
        entry("incomes", "USD", "10000", "2026-10-10", other);
        mvc.perform(get("/api/v1/reports/monthly").with(as(owner)).param("year", "2026").param("month", "10"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].currency").value("KHR"))
                .andExpect(jsonPath("$.data[0].balance").value(5500))
                .andExpect(jsonPath("$.data[1].totalIncome").value(1000.30))
                .andExpect(jsonPath("$.data[1].totalExpenses").value(88.48))
                .andExpect(jsonPath("$.data[1].balance").value(911.82))
                .andExpect(jsonPath("$.data[1].incomeCount").value(2));
        mvc.perform(get("/api/v1/reports/monthly").with(as(owner)).param("year", "2026").param("month", "5"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
    }
    @Test void reportSupportsOneSidedMonthsAndValidatesDatesAndAuthentication() throws Exception {
        entry("expenses", "USD", "15.25", "2024-02-29", owner);
        mvc.perform(get("/api/v1/reports/monthly").with(as(owner)).param("year", "2024").param("month", "2"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].totalIncome").value(0))
                .andExpect(jsonPath("$.data[0].balance").value(-15.25));
        mvc.perform(get("/api/v1/reports/monthly").with(as(owner)).param("year", "2026").param("month", "13"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/reports/monthly").param("year", "2026").param("month", "10"))
                .andExpect(status().isUnauthorized());
    }
}
