package com.example.expensetracker.integration;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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

/** No enclosing test transaction: verify rollback through subsequent HTTP reads. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Tag("integration")
class ExpenseBatchApiIT extends AbstractPostgresIT {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    private String authorization;

    @BeforeEach
    void register() throws Exception {
        String username = "batch-" + java.util.UUID.randomUUID().toString().substring(0, 8);
        var result = mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + username + "\",\"email\":\"" + username
                        + "@example.com\",\"password\":\"S3cret-pass!\"}"))
                .andExpect(status().isCreated()).andReturn();
        authorization = "Bearer " + json.readTree(result.getResponse().getContentAsString())
                .path("data").path("accessToken").asText();
    }

    @Test
    void savesBothBreakfastItems() throws Exception {
        mvc.perform(post("/api/v1/expenses/batch").header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON).content("{\"expenses\":[" + item("Sandwich", "2.50", "")
                        + "," + item("Coffee", "1.25", "") + "]}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].description").value("Sandwich"))
                .andExpect(jsonPath("$.data[1].amount").value(1.25));
        mvc.perform(get("/api/v1/expenses/totals").header("Authorization", authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].totalAmount").value(3.75));
    }

    @Test
    void missingCategoryOnSecondItemRollsBackFirst() throws Exception {
        mvc.perform(post("/api/v1/expenses/batch").header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON).content("{\"expenses\":[" + item("Sandwich", "2.50", "")
                        + "," + item("Coffee", "1.25", ",\"categoryId\":\"569ce194-fb27-4c74-8c9a-87cdb274cca7\"") + "]}"))
                .andExpect(status().isNotFound());
        expectNoExpenses();
    }

    @Test
    void combinedTopupSpendingCannotOverdrawBalance() throws Exception {
        mvc.perform(post("/api/v1/cash/topups").header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"amount\":3,\"currency\":\"USD\",\"topupDate\":\"2026-10-14\"}"))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/v1/expenses/batch").header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON).content("{\"expenses\":[" + item("Sandwich", "2.50", ",\"useTopupBalance\":true")
                        + "," + item("Coffee", "1.25", ",\"useTopupBalance\":true") + "]}"))
                .andExpect(status().isBadRequest());
        expectNoExpenses();
        mvc.perform(get("/api/v1/cash/balances").header("Authorization", authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].remainingAmount").value(3));
    }

    @Test
    void rejectsEmptyBatchAndInvalidNestedAmount() throws Exception {
        mvc.perform(post("/api/v1/expenses/batch").header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON).content("{\"expenses\":[]}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/expenses/batch").header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON).content("{\"expenses\":[" + item("Coffee", "0", "") + "]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details[0].field").value("expenses[0].amount"));
        expectNoExpenses();
    }

    private void expectNoExpenses() throws Exception {
        mvc.perform(get("/api/v1/expenses").header("Authorization", authorization))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
    }

    private String item(String name, String amount, String extra) {
        return "{\"description\":\"" + name + "\",\"amount\":" + amount
                + ",\"currency\":\"USD\",\"expenseDate\":\"2026-10-14\",\"paymentMethod\":\"CASH\"" + extra + "}";
    }
}
