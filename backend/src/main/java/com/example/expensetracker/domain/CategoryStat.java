package com.example.expensetracker.domain;

import java.math.BigDecimal;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Projection for {@code ExpenseMapper.statsByCategory} (JOIN + GROUP BY). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CategoryStat {

    private UUID categoryId;

    private String categoryName;

    private String categoryColor;

    private String categoryIcon;

    private BigDecimal totalAmount;

    private Long expenseCount;

    /** {@code totalAmount / expenseCount}, null when {@code expenseCount} is 0. */
    private BigDecimal averageAmount;

    /**
     * Share of the overall spend in percent, computed in SQL with a window
     * function so the frontend does not have to post-process the result set.
     */
    private BigDecimal percentage;
}
