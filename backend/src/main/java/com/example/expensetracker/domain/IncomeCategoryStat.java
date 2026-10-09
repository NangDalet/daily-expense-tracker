package com.example.expensetracker.domain;

import java.math.BigDecimal;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Projection for {@code IncomeMapper.statsByCategory} (JOIN + GROUP BY). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IncomeCategoryStat {

    private UUID categoryId;

    private String categoryName;

    private String categoryColor;

    private String categoryIcon;

    private String currency;

    private BigDecimal totalAmount;

    private Long incomeCount;

    /** {@code totalAmount / incomeCount}, null when {@code incomeCount} is 0. */
    private BigDecimal averageAmount;

    /**
     * Share of the overall income in percent, computed in SQL with a window
     * function so the frontend does not have to post-process the result set.
     */
    private BigDecimal percentage;
}
