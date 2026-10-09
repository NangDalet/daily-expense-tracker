package com.example.expensetracker.mapper;

import static org.assertj.core.api.Assertions.assertThat;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import com.example.expensetracker.domain.Income;
import com.example.expensetracker.domain.PaymentMethod;
import com.example.expensetracker.dto.request.IncomeFilterRequest;
import com.example.expensetracker.util.UuidTypeHandler;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class IncomeMapperTest {
    private Configuration configuration;

    @BeforeEach
    void parseMapper() throws Exception {
        configuration = new Configuration();
        configuration.getTypeAliasRegistry().registerAliases("com.example.expensetracker.domain");
        configuration.getTypeHandlerRegistry().register(UUID.class, UuidTypeHandler.class);
        try (InputStream input = getClass().getResourceAsStream("/mappers/IncomeMapper.xml")) {
            new XMLMapperBuilder(input, configuration, "mappers/IncomeMapper.xml",
                    configuration.getSqlFragments()).parse();
        }
    }

    private String sql(String statement, Object params) {
        return configuration.getMappedStatement("com.example.expensetracker.mapper.IncomeMapper." + statement)
                .getBoundSql(params).getSql().replaceAll("\\s+", " ").trim();
    }

    @Test
    void listAndCountApplyIdenticalFiltersAndWhitelistSort() {
        Map<String, Object> params = new HashMap<>();
        params.put("userId", UUID.randomUUID());
        params.put("filter", IncomeFilterRequest.builder().search("salary")
                .minAmount(BigDecimal.TEN).paymentMethods(List.of(PaymentMethod.BANK_TRANSFER)).build());
        params.put("offset", 0);
        params.put("limit", 20);
        params.put("sortColumn", "amount; DROP TABLE incomes");
        params.put("sortDirection", "DESC; DROP TABLE incomes");
        String page = sql("findByFilters", params);
        String count = sql("countByFilters", params);
        assertThat(page.substring(page.indexOf("WHERE"), page.indexOf("ORDER BY")).trim())
                .isEqualTo(count.substring(count.indexOf("WHERE")).trim());
        assertThat(page).contains("e.user_id = ?", "ORDER BY e.income_date DESC", "LIMIT ? OFFSET ?")
                .doesNotContain("DROP TABLE");
    }

    @Test
    void replacementAndDeletionScopeWritesToOwner() {
        Income income = Income.builder().id(UUID.randomUUID()).userId(UUID.randomUUID())
                .amount(BigDecimal.TEN).tags(List.of()).build();
        assertThat(sql("update", income)).contains("category_id = ?", "description = ?",
                "receipt_url = ?", "tags = ?", "WHERE id = ? AND user_id = ?");
        assertThat(sql("deleteById", Map.of("id", income.getId(), "userId", income.getUserId())))
                .contains("WHERE id = ? AND user_id = ?");
    }

    @Test
    void aggregationsKeepCurrenciesSeparate() {
        Map<String, Object> params = new HashMap<>();
        params.put("userId", UUID.randomUUID());
        params.put("groupBy", "month");
        assertThat(sql("sumByPeriod", params)).contains("GROUP BY 1, e.currency");
        assertThat(sql("statsByCategory", params))
                .contains("PARTITION BY s.currency", "GROUP BY e.currency, c.id");
    }
}