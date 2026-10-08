package com.example.expensetracker.domain;

import java.math.BigDecimal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Projection for {@code BudgetMapper.getBudgetUsage} - a budget joined with the
 * actual spend of the same user/category/period.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BudgetUsage {

    private Budget budget;

    private BigDecimal spentAmount;

    private Long expenseCount;

    /** {@code monthlyLimit - spentAmount}; negative when the budget is exceeded. */
    private BigDecimal remainingAmount;

    /**
     * {@code spentAmount / monthlyLimit * 100}, rounded to 2 decimals.
     * Callers can use it directly as a progress-bar percentage.
     */
    private BigDecimal usagePercentage;
}
