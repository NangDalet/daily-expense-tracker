package com.example.expensetracker.domain;

import java.math.BigDecimal;
import java.time.LocalDate;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Projection for {@code IncomeMapper.sumByPeriod} - one row per
 * daily / weekly / monthly bucket produced by {@code DATE_TRUNC}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IncomeSummary {

    /** First day of the bucket, truncated according to the requested granularity. */
    private LocalDate periodStart;

    private String currency;

    private BigDecimal totalAmount;

    private Long incomeCount;

    /** Average income of the bucket, null when the bucket has no rows. */
    private BigDecimal averageAmount;
}
