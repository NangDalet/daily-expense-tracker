package com.example.expensetracker.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
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

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@Tag("integration")
class IncomeApiIT extends AbstractPostgresIT {
    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    private String token;
    private String otherToken;

    @BeforeEach
    void registerUsers() throws Exception {
        token = register("income-api-user");
        otherToken = register("income-api-other");
    }

    private String register(String name) throws Exception {
        MvcResult result = mvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"username":"%s","email":"%s@example.com","password":"S3cret-pass!"}
                    """.formatted(name, name))).andExpect(status().isCreated()).andReturn();
        return data(result).path("accessToken").asText();
    }

    private JsonNode data(MvcResult result) throws Exception {
        return json.readTree(result.getResponse().getContentAsString()).path("data");
    }

    private String create(String currency, String amount) throws Exception {
        MvcResult result = mvc.perform(post("/api/v1/incomes")
                .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"amount":%s,"currency":"%s","description":"Salary","incomeDate":"2026-01-15",
                     "paymentMethod":"BANK_TRANSFER","tags":["salary"],"receiptUrl":"https://example.com/pay-slip"}
                    """.formatted(amount, currency)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.id").isNotEmpty())
                .andExpect(jsonPath("$.data.incomeDate").value("2026-01-15")).andReturn();
        return data(result).path("id").asText();
    }

    @Test
    void createsListsReplacesAndDeletesIncomeWithoutAffectingExpenses() throws Exception {
        String id = create("USD", "2500");
        mvc.perform(get("/api/v1/incomes").header("Authorization", "Bearer " + token)
                .param("search", "salary").param("paymentMethods", "BANK_TRANSFER")
                .param("sort", "incomeDate,asc"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.data[0].amount").value(2500));
        mvc.perform(put("/api/v1/incomes/" + id).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("""
                    {"amount":2600,"incomeDate":"2026-01-16","paymentMethod":"CASH"}
                    """)).andExpect(status().isOk()).andExpect(jsonPath("$.data.amount").value(2600))
                .andExpect(jsonPath("$.data.description").doesNotExist())
                .andExpect(jsonPath("$.data.receiptUrl").doesNotExist())
                .andExpect(jsonPath("$.data.tags").isEmpty());
        mvc.perform(get("/api/v1/expenses").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(delete("/api/v1/incomes/" + id).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/incomes/" + id).header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void scopesIncomeReadsAndWritesToTheSignedInUser() throws Exception {
        String id = create("USD", "2500");
        String authorization = "Bearer " + otherToken;
        mvc.perform(get("/api/v1/incomes").header("Authorization", authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/v1/incomes/" + id).header("Authorization", authorization))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/v1/incomes/" + id).header("Authorization", authorization))
                .andExpect(status().isNotFound());
        mvc.perform(put("/api/v1/incomes/" + id).header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON).content("""
                    {"amount":1,"incomeDate":"2026-01-15","paymentMethod":"CASH"}
                    """)).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/incomes/recent").header("Authorization", authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
    }

    @Test
    void summariesAndCategoryStatsKeepCurrenciesSeparate() throws Exception {
        create("USD", "2500");
        create("EUR", "1000");
        create("USD", "500");
        MvcResult result = mvc.perform(get("/api/v1/incomes/summary")
                .header("Authorization", "Bearer " + token).param("groupBy", "monthly")
                .param("from", "2026-01-01").param("to", "2026-01-31"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(2)).andReturn();
        for (JsonNode row : data(result)) {
            assertThat(row.path("periodStart").asText()).isEqualTo("2026-01-01");
            assertThat(row.path("totalAmount").decimalValue()).isEqualByComparingTo(
                    row.path("currency").asText().equals("USD") ? "3000" : "1000");
        }
        mvc.perform(get("/api/v1/incomes/stats/by-category").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].percentage").value(100));
    }

    @Test
    void validatesIncomeAndRequiresAuthentication() throws Exception {
        mvc.perform(get("/api/v1/incomes")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/incomes").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("""
                    {"amount":0,"incomeDate":"2026-01-15","paymentMethod":"CASH"}
                    """)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mvc.perform(get("/api/v1/incomes").header("Authorization", "Bearer " + token)
                .param("minAmount", "10").param("maxAmount", "0"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/incomes").header("Authorization", "Bearer " + token)
                .param("categoryId", "invalid")).andExpect(status().isBadRequest());
    }
}