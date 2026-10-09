package com.example.expensetracker.config;

import com.example.expensetracker.dto.request.IncomeSummaryRequest;

import org.springframework.core.convert.converter.Converter;
import org.springframework.stereotype.Component;

/**
 * Lenient {@code String -> GroupBy} conversion for the query parameter binding
 * of {@code IncomeFilterRequest} / {@code IncomeSummaryRequest}.
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
public class IncomeGroupByConverter implements Converter<String, IncomeSummaryRequest.GroupBy> {

    @Override
    public IncomeSummaryRequest.GroupBy convert(String source) {
        return IncomeSummaryRequest.GroupBy.from(source);
    }
}
