package com.example.expensetracker.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Monthly spending limit.
 * <p>
 * A {@code null} {@code categoryId} represents the user's overall budget for
 * the month; otherwise the limit applies to a single category. The pair
 * (user, category, month, year) is unique - see
 * {@code uq_budgets_user_category_period}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Budget {

    private UUID id;

    private UUID userId;

    private UUID categoryId;

    /** Nested projection - populated by {@code getBudgetUsage}. */
    private Category category;

    private BigDecimal monthlyLimit;

    /** 1-12 */
    private Integer month;

    private Integer year;

    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;
}
