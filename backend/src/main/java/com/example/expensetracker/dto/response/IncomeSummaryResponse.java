package com.example.expensetracker.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

import io.swagger.v3.oas.annotations.media.Schema;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** One bucket of the {@code /incomes/summary} aggregation. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "IncomeSummaryResponse", description = "Income aggregated per day/week/month")
public class IncomeSummaryResponse {

    @Schema(type = "string", format = "date", description = "First day of the bucket")
    private LocalDate periodStart;

    private String currency;

    private BigDecimal totalAmount;

    private Long incomeCount;

    private BigDecimal averageAmount;
}
