package com.example.expensetracker.wallet;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;
import jakarta.validation.constraints.*;
import lombok.Data;

public final class CashModels {
    private CashModels() {}

    @Data public static class Topup {
        private UUID id, userId;
        private BigDecimal amount;
        private String currency, note;
        private LocalDate topupDate;
        private OffsetDateTime createdAt;
    }

    @Data public static class Balance {
        private String currency;
        private BigDecimal totalTopups, totalSpent, remainingAmount;
    }

    @Data public static class TopupRequest {
        @NotNull @DecimalMin("0.01") @DecimalMax("9999999999999.99") @Digits(integer = 13, fraction = 2)
        private BigDecimal amount;
        @NotNull @Pattern(regexp = "USD|KHR")
        private String currency;
        @NotNull
        private LocalDate topupDate;
        @Size(max = 500)
        private String note;

        @AssertTrue(message = "topupDate must be between 1900 and 2999")
        public boolean isDateInRange() {
            return topupDate == null || (topupDate.getYear() >= 1900 && topupDate.getYear() <= 2999);
        }
    }
}
