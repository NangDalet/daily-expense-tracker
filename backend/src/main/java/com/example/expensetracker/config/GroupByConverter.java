package com.example.expensetracker.config;

import com.example.expensetracker.dto.request.ExpenseSummaryRequest;

import org.springframework.core.convert.converter.Converter;
import org.springframework.stereotype.Component;

/**
 * Lenient {@code String -> GroupBy} conversion for the query parameter binding
 * of {@code ExpenseFilterRequest} / {@code ExpenseSummaryRequest}.
 * <p>
 * Spring's default enum converter is case sensitive, which would turn
 * {@code ?groupBy=daily} into a 400. Being lenient here keeps the documented
 * API contract; an unknown value falls back to {@code DAILY} instead of
 * failing, so a typo can never produce a 500.
 * <p>
 * Registered as a plain {@link Converter} bean, which Boot adds to the
 * application's conversion service automatically.
 */
@Component
public class GroupByConverter implements Converter<String, ExpenseSummaryRequest.GroupBy> {

    @Override
    public ExpenseSummaryRequest.GroupBy convert(String source) {
        return ExpenseSummaryRequest.GroupBy.from(source);
    }
}
