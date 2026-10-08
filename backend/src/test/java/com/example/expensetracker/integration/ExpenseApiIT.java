package com.example.expensetracker.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import com.example.expensetracker.domain.User;
import com.example.expensetracker.mapper.UserMapper;
import com.example.expensetracker.security.JwtTokenService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

/**
 * End-to-end HTTP test of the whole stack: real filters, real JWT signing and
 * verification, real mappers, real PostgreSQL. It covers the contract the
 * frontend depends on - the response envelope, the error envelope and the
 * authorisation rules.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@Tag("integration")
class ExpenseApiIT extends AbstractPostgresIT {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private JwtTokenService jwtTokenService;

    private String userToken;
    private String adminToken;

    @BeforeEach
    void setUp() throws Exception {
        userToken = registerAndLogin("api-it-user");
        adminToken = tokenFor(register("api-it-admin", List.of("ADMIN", "USER")));
    }

    // ===================== Public endpoints =====================

    @Test
    @DisplayName("registers a user and returns a usable token pair")
    void registersAndReturnsTokens() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"brand-new","email":"brand-new@example.com","password":"S3cret-pass!","fullName":"Brand New"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.refreshToken").isNotEmpty())
                .andExpect(jsonPath("$.data.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.data.user.username").value("brand-new"))
                .andExpect(jsonPath("$.data.user.password").doesNotExist())
                .andReturn();

        // the returned token really is accepted by the resource server
        String accessToken = json(result).path("data").path("accessToken").asText();
        mockMvc.perform(get("/api/v1/categories").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(8));
    }

    @Test
    @DisplayName("rejects a weak registration payload with the documented error envelope")
    void reportsValidationErrors() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"x","email":"not-an-email","password":"short"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("Request validation failed"))
                .andExpect(jsonPath("$.path").value("/api/v1/auth/register"))
                .andExpect(jsonPath("$.timestamp").isNotEmpty())
                .andExpect(jsonPath("$.details.length()").value(org.hamcrest.Matchers.greaterThan(0)))
                .andExpect(jsonPath("$.details[0].field").isNotEmpty());
    }

    @Test
    @DisplayName("rejects wrong credentials with 401")
    void rejectsWrongCredentials() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"api-it-user","password":"nope"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    // ===================== Protected endpoints =====================

    @Test
    @DisplayName("answers with a JSON 401 when the token is missing")
    void rejectsAnonymousRequests() throws Exception {
        mockMvc.perform(get("/api/v1/expenses"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.path").value("/api/v1/expenses"));
    }

    @Test
    @DisplayName("answers with a JSON 401 when the token is garbage")
    void rejectsGarbageToken() throws Exception {
        mockMvc.perform(get("/api/v1/expenses").header("Authorization", "Bearer not.a.jwt"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("answers with a JSON 403 when a normal user hits the admin API")
    void rejectsAdminApiForNormalUser() throws Exception {
        mockMvc.perform(get("/api/v1/users").header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    @DisplayName("lets an administrator list the users")
    void allowsAdminApi() throws Exception {
        mockMvc.perform(get("/api/v1/users").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.totalElements").isNumber());
    }

    // ===================== Expense lifecycle =====================

    @Test
    @DisplayName("creates, reads, filters, updates and deletes an expense")
    void runsExpenseLifecycle() throws Exception {
        String categoryId = groceriesCategoryId();

        MvcResult created = mockMvc.perform(post("/api/v1/expenses")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "amount": 42.755,
                                  "currency": "USD",
                                  "description": "Weekly groceries run",
                                  "expenseDate": "%s",
                                  "paymentMethod": "CREDIT_CARD",
                                  "categoryId": "%s",
                                  "tags": ["weekly", "food", "weekly"]
                                }
                                """.formatted("2026-01-15", categoryId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.amount").value(42.76))
                .andExpect(jsonPath("$.data.paymentMethod").value("CREDIT_CARD"))
                .andExpect(jsonPath("$.data.category.name").value("Groceries"))
                .andExpect(jsonPath("$.data.tags.length()").value(2))
                .andExpect(jsonPath("$.message").value("Expense created"))
                .andReturn();

        String expenseId = json(created).path("data").path("id").asText();

        // read back
        mockMvc.perform(get("/api/v1/expenses/" + expenseId)
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(expenseId))
                .andExpect(jsonPath("$.data.category.colorHex").value("#22c55e"));

        // the dynamic filter: category + date range + amount range + payment methods + search
        mockMvc.perform(get("/api/v1/expenses")
                        .header("Authorization", "Bearer " + userToken)
                        .param("categoryId", categoryId)
                        .param("fromDate", "2026-01-01")
                        .param("toDate", "2026-01-31")
                        .param("minAmount", "40")
                        .param("maxAmount", "50")
                        .param("search", "groceries")
                        .param("paymentMethods", "CREDIT_CARD,E_WALLET")
                        .param("page", "0")
                        .param("size", "10")
                        .param("sort", "amount,desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.totalPages").value(1));

        // a filter that matches nothing still answers 200 with an empty page
        mockMvc.perform(get("/api/v1/expenses")
                        .header("Authorization", "Bearer " + userToken)
                        .param("search", "nothing-matches-this"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0))
                .andExpect(jsonPath("$.totalElements").value(0));

        // aggregations
        mockMvc.perform(get("/api/v1/expenses/summary")
                        .header("Authorization", "Bearer " + userToken)
                        .param("groupBy", "daily")
                        .param("from", "2026-01-01")
                        .param("to", "2026-01-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].periodStart").value("2026-01-15"))
                .andExpect(jsonPath("$.data[0].totalAmount").value(42.76))
                .andExpect(jsonPath("$.data[0].expenseCount").value(1));

        mockMvc.perform(get("/api/v1/expenses/stats/by-category")
                        .header("Authorization", "Bearer " + userToken)
                        .param("from", "2026-01-01")
                        .param("to", "2026-01-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].categoryName").value("Groceries"))
                .andExpect(jsonPath("$.data[0].percentage").value(100.0));

        // update
        mockMvc.perform(put("/api/v1/expenses/" + expenseId)
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "amount": 50.00,
                                  "currency": "EUR",
                                  "description": "Corrected amount",
                                  "expenseDate": "2026-01-16",
                                  "paymentMethod": "CASH"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.amount").value(50.0))
                .andExpect(jsonPath("$.data.currency").value("EUR"))
                .andExpect(jsonPath("$.data.category").doesNotExist());

        // delete
        mockMvc.perform(delete("/api/v1/expenses/" + expenseId)
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Expense deleted"));

        mockMvc.perform(get("/api/v1/expenses/" + expenseId)
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    @DisplayName("rejects an amount of zero and a non-ISO currency")
    void reportsInvalidExpensePayload() throws Exception {
        mockMvc.perform(post("/api/v1/expenses")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount": 0, "currency": "dollars", "expenseDate": "2026-01-01", "paymentMethod": "CASH"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    @DisplayName("refuses to delete a category that still has expenses")
    void refusesCategoryDeleteWithExpenses() throws Exception {
        String categoryId = groceriesCategoryId();
        mockMvc.perform(post("/api/v1/expenses")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount": 12.00, "expenseDate": "2026-01-10", "paymentMethod": "CASH", "categoryId": "%s"}
                                """.formatted(categoryId)))
                .andExpect(status().isCreated());

        mockMvc.perform(delete("/api/v1/categories/" + categoryId)
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("BUSINESS_RULE_VIOLATION"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("1 expense(s)")));
    }

    @Test
    @DisplayName("hides the expenses of another user behind a 404")
    void isolatesTenants() throws Exception {
        String categoryId = groceriesCategoryId();
        MvcResult created = mockMvc.perform(post("/api/v1/expenses")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount": 12.00, "expenseDate": "2026-01-10", "paymentMethod": "CASH", "categoryId": "%s"}
                                """.formatted(categoryId)))
                .andReturn();
        String expenseId = json(created).path("data").path("id").asText();

        String otherToken = tokenFor(register("api-it-tenant", List.of("USER")));

        mockMvc.perform(get("/api/v1/expenses/" + expenseId).header("Authorization", "Bearer " + otherToken))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/expenses").header("Authorization", "Bearer " + otherToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    // ===================== Budgets =====================

    @Test
    @DisplayName("upserts a budget and reports its usage")
    void upsertsBudgetAndReportsUsage() throws Exception {
        String categoryId = groceriesCategoryId();

        mockMvc.perform(post("/api/v1/budgets")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"categoryId": "%s", "monthlyLimit": 200.00, "month": 1, "year": 2026}
                                """.formatted(categoryId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.monthlyLimit").value(200.0))
                .andExpect(jsonPath("$.data.category.name").value("Groceries"));

        // the same call again updates instead of failing on the unique constraint
        mockMvc.perform(post("/api/v1/budgets")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"categoryId": "%s", "monthlyLimit": 250.00, "month": 1, "year": 2026}
                                """.formatted(categoryId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.monthlyLimit").value(250.0));

        mockMvc.perform(get("/api/v1/budgets/usage")
                        .header("Authorization", "Bearer " + userToken)
                        .param("year", "2026")
                        .param("month", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].budget.monthlyLimit").value(250.0))
                .andExpect(jsonPath("$.data[0].spentAmount").value(0))
                .andExpect(jsonPath("$.data[0].exceeded").value(false));
    }

    @Test
    @DisplayName("rejects an impossible month")
    void rejectsImpossibleMonth() throws Exception {
        mockMvc.perform(post("/api/v1/budgets")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"monthlyLimit": 100.00, "month": 13, "year": 2026}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    // ===================== OpenAPI =====================

    @Test
    @DisplayName("publishes the OpenAPI document and the Swagger UI")
    void publishesOpenApi() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/expenses']").exists())
                .andExpect(jsonPath("$.components.securitySchemes.bearerAuth.scheme").value("bearer"));
    }

    // ===================== helpers =====================

    private JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    /**
     * The category list is ordered by name, so the id is looked up by name instead
     * of by position to keep the assertions independent of that ordering.
     */
    private String groceriesCategoryId() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/categories")
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode categories = json(result).path("data");
        for (JsonNode category : categories) {
            if ("Groceries".equals(category.path("name").asText())) {
                return category.path("id").asText();
            }
        }
        throw new AssertionError("Groceries category not found in " + categories);
    }

    private String registerAndLogin(String username) throws Exception {
        User user = register(username, List.of("USER"));
        return tokenFor(user);
    }

    private User register(String username, List<String> roles) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"%s","email":"%s@example.com","password":"S3cret-pass!"}
                                """.formatted(username, username)))
                .andExpect(status().isCreated())
                .andReturn();
        assertThat(json(result).path("data").path("accessToken").asText()).isNotBlank();

        User user = userMapper.findByUsername(username);
        // registration always assigns USER; the roles requested here are only used
        // to sign a token that carries the authorities the test needs
        user.setRoles(roles);
        return user;
    }

    /** Signs a token with the real encoder, exactly like /auth/login does. */
    private String tokenFor(User user) {
        return jwtTokenService.createAccessToken(user).value();
    }
}
