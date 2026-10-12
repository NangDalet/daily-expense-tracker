package com.example.expensetracker.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.InputStream;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.UUID;
import com.example.expensetracker.dto.response.CategoryStatResponse;
import com.example.expensetracker.dto.response.ExpenseSummaryResponse;
import com.example.expensetracker.util.UuidTypeHandler;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.Test;

class CurrencyMapperTest {
    @Test
    void reportingQueriesBindTheSharedFixedRate() throws Exception {
        Configuration configuration = new Configuration();
        configuration.getTypeAliasRegistry().registerAliases("com.example.expensetracker.domain");
        configuration.getTypeHandlerRegistry().register(UUID.class, UuidTypeHandler.class);
        for (String mapper : new String[] {"ExpenseMapper", "BudgetMapper"}) {
            String resource = "mappers/" + mapper + ".xml";
            try (InputStream input = getClass().getResourceAsStream("/" + resource)) {
                new XMLMapperBuilder(input, configuration, resource, configuration.getSqlFragments()).parse();
            }
        }
        var params = new HashMap<String, Object>();
        params.put("userId", UUID.randomUUID());
        params.put("groupBy", "month");
        params.put("year", 2026);
        params.put("month", 10);
        for (String statement : new String[] {"ExpenseMapper.sumByPeriod", "ExpenseMapper.statsByCategory", "BudgetMapper.getBudgetUsage"}) {
            var bound = configuration.getMappedStatement("com.example.expensetracker.mapper." + statement).getBoundSql(params);
            assertThat(bound.getAdditionalParameter("khrPerUsd")).isEqualTo(new BigDecimal("4000"));
            assertThat(bound.getParameterMappings()).anyMatch(mapping -> mapping.getProperty().equals("khrPerUsd"));
            assertThat(bound.getSql()).contains("CASE", "e.amount / ?");
        }
        assertThat(ExpenseSummaryResponse.builder().build().getCurrency()).isEqualTo("USD");
        assertThat(CategoryStatResponse.builder().build().getCurrency()).isEqualTo("USD");
    }
}
