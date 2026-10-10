package com.example.expensetracker.dto.response;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

import io.swagger.v3.oas.annotations.media.Schema;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** A monthly spending limit. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "BudgetResponse", description = "Monthly spending limit")
public class BudgetResponse {

    private String id;

    @Schema(description = "Null for the overall budget of the month")
    private String categoryId;

    private CategoryResponse category;

    private String currency;

    private BigDecimal monthlyLimit;

    @Schema(description = "1-12", example = "1")
    private Integer month;

    private Integer year;

    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;
}
