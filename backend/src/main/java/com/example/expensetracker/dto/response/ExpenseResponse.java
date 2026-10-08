package com.example.expensetracker.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** A single expense with its nested category. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "ExpenseResponse", description = "An expense record")
public class ExpenseResponse {

    private String id;

    @Schema(example = "42.75")
    private BigDecimal amount;

    @Schema(example = "USD")
    private String currency;

    private String description;

    @Schema(type = "string", format = "date", example = "2026-01-30")
    private LocalDate expenseDate;

    @Schema(example = "CREDIT_CARD")
    private String paymentMethod;

    private String categoryId;

    @Schema(description = "Denormalised category, null when the expense has no category")
    private CategoryResponse category;

    private String userId;

    private String receiptUrl;

    private List<String> tags;

    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;
}
