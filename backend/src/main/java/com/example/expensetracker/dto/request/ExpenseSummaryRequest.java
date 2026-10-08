package com.example.expensetracker.dto.request;

import java.time.LocalDate;

import com.example.expensetracker.domain.PaymentMethod;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Query parameters of {@code GET /api/v1/expenses/summary}. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "ExpenseSummaryRequest", description = "Aggregation parameters")
public class ExpenseSummaryRequest {

    @NotNull(message = "groupBy is required")
    @Builder.Default
    @Schema(description = "Truncation applied by DATE_TRUNC", example = "daily", requiredMode = Schema.RequiredMode.REQUIRED)
    private GroupBy groupBy = GroupBy.DAILY;

    @Schema(type = "string", format = "date", example = "2026-01-01")
    private LocalDate from;

    @Schema(type = "string", format = "date", example = "2026-01-31")
    private LocalDate to;

    @Schema(description = "Optional category restriction", example = "3f1b...-...")
    private String categoryId;

    @Schema(description = "Optional payment method restriction", example = "CASH")
    private PaymentMethod paymentMethod;

    /** Truncation units supported by PostgreSQL's {@code DATE_TRUNC}. */
    public enum GroupBy {

        DAILY("day"),
        WEEKLY("week"),
        MONTHLY("month");

        private final String sqlUnit;

        GroupBy(String sqlUnit) {
            this.sqlUnit = sqlUnit;
        }

        public String sqlUnit() {
            return sqlUnit;
        }

        /**
         * Lenient parser used by Spring's {@code StringToEnumConverterFactory}.
         * Accepts {@code daily}, {@code DAILY} and {@code day} and maps anything
         * unknown to {@link #DAILY} so a bad query parameter never causes a 500.
         */
        public static GroupBy from(String raw) {
            if (raw == null || raw.isBlank()) {
                return DAILY;
            }
            String normalized = raw.trim().toLowerCase();
            return switch (normalized) {
                case "day", "daily" -> DAILY;
                case "week", "weekly" -> WEEKLY;
                case "month", "monthly" -> MONTHLY;
                default -> DAILY;
            };
        }
    }

    @AssertTrue(message = "'to' must not be earlier than 'from'")
    public boolean isRangeValid() {
        return from == null || to == null || !to.isBefore(from);
    }
}
