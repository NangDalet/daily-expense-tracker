package com.example.expensetracker.domain;

import java.math.BigDecimal;
import java.time.LocalDate;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Projection for {@code ExpenseMapper.sumByPeriod} - one row per
 * daily / weekly / monthly bucket produced by {@code DATE_TRUNC}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExpenseSummary {

    /** First day of the bucket, truncated according to the requested granularity. */
    private LocalDate periodStart;

    private BigDecimal totalAmount;

    private Long expenseCount;

    /** Average expense of the bucket, null when the bucket has no rows. */
    private BigDecimal averageAmount;
}
