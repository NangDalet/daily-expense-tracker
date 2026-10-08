package com.example.expensetracker.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

import io.swagger.v3.oas.annotations.media.Schema;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** One bucket of the {@code /expenses/summary} aggregation. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "ExpenseSummaryResponse", description = "Spend aggregated per day/week/month")
public class ExpenseSummaryResponse {

    @Schema(type = "string", format = "date", description = "First day of the bucket")
    private LocalDate periodStart;

    private BigDecimal totalAmount;

    private Long expenseCount;

    private BigDecimal averageAmount;
}
