package com.example.expensetracker.dto.response;

import java.math.BigDecimal;

import io.swagger.v3.oas.annotations.media.Schema;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** One slice of the {@code /incomes/stats/by-category} aggregation. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "IncomeCategoryStatResponse", description = "Income aggregated per category")
public class IncomeCategoryStatResponse {

    private String categoryId;

    @Schema(example = "Groceries")
    private String categoryName;

    @Schema(example = "#22c55e")
    private String categoryColor;

    @Schema(example = "ShoppingCart")
    private String categoryIcon;

    private String currency;

    private BigDecimal totalAmount;

    private Long incomeCount;

    private BigDecimal averageAmount;

    @Schema(description = "Share of the total income, in percent", example = "31.42")
    private BigDecimal percentage;
}
