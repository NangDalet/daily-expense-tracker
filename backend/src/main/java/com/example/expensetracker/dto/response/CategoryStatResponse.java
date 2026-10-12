package com.example.expensetracker.dto.response;

import java.math.BigDecimal;

import io.swagger.v3.oas.annotations.media.Schema;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** One slice of the {@code /expenses/stats/by-category} aggregation. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "CategoryStatResponse", description = "Spend aggregated per category")
public class CategoryStatResponse {

    @Builder.Default
    @Schema(description = "Totals include USD and KHR converted at 1 USD = 4000 KHR")
    private String currency = "USD";

    private String categoryId;

    @Schema(example = "Groceries")
    private String categoryName;

    @Schema(example = "#22c55e")
    private String categoryColor;

    @Schema(example = "ShoppingCart")
    private String categoryIcon;

    private BigDecimal totalAmount;

    private Long expenseCount;

    private BigDecimal averageAmount;

    @Schema(description = "Share of the total spend, in percent", example = "31.42")
    private BigDecimal percentage;
}
