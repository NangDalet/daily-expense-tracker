package com.example.expensetracker.dto.request;

import java.math.BigDecimal;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Create / update payload for a monthly budget. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "BudgetRequest", description = "Budget create/update payload")
public class BudgetRequest {

    @Schema(description = "Null creates/updates the overall budget for the period")
    @Size(max = 36, message = "categoryId must be a valid UUID")
    private String categoryId;

    @NotNull(message = "monthlyLimit is required")
    @DecimalMin(value = "0.01", message = "monthlyLimit must be greater than 0")
    @DecimalMax(value = "9999999999999.99", message = "monthlyLimit exceeds the maximum supported value")
    @Schema(example = "400.00", requiredMode = Schema.RequiredMode.REQUIRED)
    private BigDecimal monthlyLimit;

    @NotNull(message = "month is required")
    @Min(value = 1, message = "month must be between 1 and 12")
    @Max(value = 12, message = "month must be between 1 and 12")
    @Schema(example = "1", requiredMode = Schema.RequiredMode.REQUIRED)
    private Integer month;

    @NotNull(message = "year is required")
    @Min(value = 2000, message = "year must be between 2000 and 2100")
    @Max(value = 2100, message = "year must be between 2000 and 2100")
    @Schema(example = "2026", requiredMode = Schema.RequiredMode.REQUIRED)
    private Integer year;
}
