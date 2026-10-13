package com.example.expensetracker.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

// Real requests commit in their own transactions so rejected writes can be checked after rollback.
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Tag("integration")
class CashApiIT extends AbstractPostgresIT {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    String token;

    @BeforeEach void setUp() throws Exception { token = register(); }

    @Test void tracksTopupsExpensesEditsAndDeletionByCurrency() throws Exception {
        String topup = topup("100", "USD");
        topup("40000", "KHR");
        String expense = spend("30", "USD", true, "CASH", 201);
        spend("10", "USD", false, "CASH", 201);
        spend("4000", "KHR", true, "CASH", 201);
        balance("USD", 100, 30, 70);
        balance("KHR", 40000, 4000, 36000);
        write(put("/api/v1/expenses/" + expense), expenseBody("50", "USD", true, "CASH"), 200);
        balance("USD", 100, 50, 50);
        write(put("/api/v1/expenses/" + expense), expenseBody("8000", "KHR", true, "CASH"), 200);
        balance("USD", 100, 0, 100);
        balance("KHR", 40000, 12000, 28000);
        mvc.perform(delete("/api/v1/expenses/" + expense).header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        balance("KHR", 40000, 4000, 36000);
        write(put("/api/v1/cash/topups/" + topup), topupBody("120", "USD"), 200);
        balance("USD", 120, 0, 120);
        mvc.perform(delete("/api/v1/cash/topups/" + topup).header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        balance("USD", 0, 0, 0);
    }

    @Test void rejectsOverspendingAndRollsBackExpenseAndTopupChanges() throws Exception {
        String topup = topup("100", "USD");
        String expense = spend("80", "USD", true, "CASH", 201);
        spend("21", "USD", true, "CASH", 400);
        spend("1", "KHR", true, "CASH", 400);
        write(put("/api/v1/expenses/" + expense), expenseBody("101", "USD", true, "CASH"), 400);
        write(put("/api/v1/cash/topups/" + topup), topupBody("79", "USD"), 400);
        mvc.perform(delete("/api/v1/cash/topups/" + topup).header("Authorization", "Bearer " + token)).andExpect(status().isBadRequest());
        balance("USD", 100, 80, 20);
        balance("KHR", 0, 0, 0);
        mvc.perform(get("/api/v1/expenses").header("Authorization", "Bearer " + token))
            .andExpect(jsonPath("$.totalElements").value(1));
        write(put("/api/v1/expenses/" + expense), expenseBody("80", "USD", false, "CASH"), 200);
        balance("USD", 100, 0, 100);
    }

    @Test void isolatesUsersAndValidatesRequests() throws Exception {
        String entry = topup("100", "USD");
        String owner = token;
        token = register();
        balance("USD", 0, 0, 0);
        mvc.perform(get("/api/v1/cash/topups").header("Authorization", "Bearer " + token))
            .andExpect(jsonPath("$.totalElements").value(0));
        write(put("/api/v1/cash/topups/" + entry), topupBody("200", "USD"), 404);
        mvc.perform(delete("/api/v1/cash/topups/" + entry).header("Authorization", "Bearer " + token)).andExpect(status().isNotFound());
        write(post("/api/v1/cash/topups"), topupBody("0", "USD"), 400);
        write(post("/api/v1/cash/topups"), topupBody("1.001", "USD"), 400);
        write(post("/api/v1/cash/topups"), topupBody("10", "EUR"), 400);
        write(post("/api/v1/cash/topups"), "{\"amount\":10,\"currency\":\"USD\"}", 400);
        mvc.perform(get("/api/v1/cash/balances")).andExpect(status().isUnauthorized());
        token = owner;
        spend("5", "USD", true, "BANK_TRANSFER", 400);
        balance("USD", 100, 0, 100);
    }

    @Test void serializesConcurrentSpendingToPreventOverdraft() throws Exception {
        topup("100", "USD");
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            Callable<Integer> request = () -> {
                ready.countDown();
                assertThat(start.await(10, TimeUnit.SECONDS)).isTrue();
                return mvc.perform(post("/api/v1/expenses").header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON).content(expenseBody("70", "USD", true, "CASH")))
                    .andReturn().getResponse().getStatus();
            };
            Future<Integer> a = pool.submit(request), b = pool.submit(request);
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            assertThat(java.util.List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS)))
                .containsExactlyInAnyOrder(201, 400);
        }
        balance("USD", 100, 70, 30);
    }

    @Test void pagesTopupHistoryWithoutChangingExpenseOrIncomeTotals() throws Exception {
        for (int i = 0; i < 12; i++) topup("10", "USD");
        mvc.perform(get("/api/v1/cash/topups?page=1&size=10").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(2))
            .andExpect(jsonPath("$.totalElements").value(12)).andExpect(jsonPath("$.totalPages").value(2));
        mvc.perform(get("/api/v1/expenses").header("Authorization", "Bearer " + token)).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/v1/incomes").header("Authorization", "Bearer " + token)).andExpect(jsonPath("$.totalElements").value(0));
        balance("USD", 120, 0, 120);
    }

    @Test void totalsIncludeEveryPaymentMethodRespectFiltersAndIgnorePaging() throws Exception {
        topup("100", "USD");
        spend("5", "USD", true, "CASH", 201);
        spend("7", "USD", false, "E_WALLET", 201);
        spend("4000", "KHR", false, "BANK_TRANSFER", 201);
        mvc.perform(get("/api/v1/expenses/totals?page=1&size=1").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].currency").value("USD"))
            .andExpect(jsonPath("$.data[0].totalAmount").value(12)).andExpect(jsonPath("$.data[0].expenseCount").value(2))
            .andExpect(jsonPath("$.data[1].totalAmount").value(4000)).andExpect(jsonPath("$.data[1].expenseCount").value(1));
        mvc.perform(get("/api/v1/expenses/totals?paymentMethods=CASH").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].totalAmount").value(5))
            .andExpect(jsonPath("$.data[1].totalAmount").value(0));
        mvc.perform(get("/api/v1/expenses/totals?minAmount=7&maxAmount=10&search=7").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].totalAmount").value(7))
            .andExpect(jsonPath("$.data[0].expenseCount").value(1)).andExpect(jsonPath("$.data[1].expenseCount").value(0));
        mvc.perform(get("/api/v1/expenses/totals?fromDate=2026-10-14").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].totalAmount").value(0));
        mvc.perform(get("/api/v1/expenses/totals?fromDate=2026-10-14&toDate=2026-10-13").header("Authorization", "Bearer " + token))
            .andExpect(status().isBadRequest());
        token = register();
        mvc.perform(get("/api/v1/expenses/totals").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].totalAmount").value(0))
            .andExpect(jsonPath("$.data[1].totalAmount").value(0));
        mvc.perform(get("/api/v1/expenses/totals")).andExpect(status().isUnauthorized());
    }

    String register() throws Exception {
        String name = "cash-" + UUID.randomUUID().toString().substring(0, 12);
        MvcResult result = mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
            .content("{\"username\":\"%s\",\"email\":\"%s@example.com\",\"password\":\"S3cret-pass!\"}".formatted(name, name)))
            .andExpect(status().isCreated()).andReturn();
        return data(result).path("accessToken").asText();
    }
    String topup(String amount, String currency) throws Exception {
        return data(write(post("/api/v1/cash/topups"), topupBody(amount, currency), 201)).path("id").asText();
    }
    String topupBody(String amount, String currency) {
        return "{\"amount\":%s,\"currency\":\"%s\",\"topupDate\":\"2026-10-13\",\"note\":\"Bank withdrawal\"}".formatted(amount, currency);
    }
    String spend(String amount, String currency, boolean tracked, String method, int statusCode) throws Exception {
        JsonNode response = data(write(post("/api/v1/expenses"), expenseBody(amount, currency, tracked, method), statusCode));
        if (statusCode == 201) assertThat(response.path("useTopupBalance").asBoolean()).isEqualTo(tracked);
        return response.path("id").asText();
    }
    String expenseBody(String amount, String currency, boolean tracked, String method) {
        return "{\"amount\":%s,\"currency\":\"%s\",\"expenseDate\":\"2026-10-13\",\"paymentMethod\":\"%s\",\"useTopupBalance\":%s}"
            .formatted(amount, currency, method, tracked);
    }
    MvcResult write(MockHttpServletRequestBuilder request, String body, int statusCode) throws Exception {
        return mvc.perform(request.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().is(statusCode)).andReturn();
    }
    JsonNode data(MvcResult result) throws Exception { return json.readTree(result.getResponse().getContentAsString()).path("data"); }
    void balance(String currency, double topups, double spent, double remaining) throws Exception {
        JsonNode balances = data(mvc.perform(get("/api/v1/cash/balances").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andReturn());
        for (JsonNode balance : balances) if (balance.path("currency").asText().equals(currency)) {
            assertThat(balance.path("totalTopups").asDouble()).isEqualTo(topups);
            assertThat(balance.path("totalSpent").asDouble()).isEqualTo(spent);
            assertThat(balance.path("remainingAmount").asDouble()).isEqualTo(remaining);
            return;
        }
        throw new AssertionError("Missing balance for " + currency);
    }
}
