package com.example.expensetracker.dto.response;

import java.math.BigDecimal;

import io.swagger.v3.oas.annotations.media.Schema;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** A budget together with the actual spend of the same period. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "BudgetUsageResponse", description = "Budget with actual usage")
public class BudgetUsageResponse {

    private BudgetResponse budget;

    @Schema(description = "Amount actually spent in the budget period")
    private BigDecimal spentAmount;

    private Long expenseCount;

    @Schema(description = "monthlyLimit - spentAmount, negative when exceeded")
    private BigDecimal remainingAmount;

    @Schema(description = "spentAmount / monthlyLimit * 100, rounded to 2 decimals")
    private BigDecimal usagePercentage;

    @Schema(description = "Convenience flag so the UI does not have to compare numbers", example = "true")
    private Boolean exceeded;
}
