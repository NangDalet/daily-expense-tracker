package com.example.expensetracker.dto.request;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.example.expensetracker.domain.PaymentMethod;
import com.example.expensetracker.util.MoneyUtils;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Create / update payload for an income. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "IncomeRequest", description = "Income create/update payload")
public class IncomeRequest {

    @NotNull(message = "amount is required")
    @DecimalMin(value = "0.01", message = "amount must be greater than 0")
    @DecimalMax(value = "9999999999999.99", message = "amount exceeds the maximum supported value")
    @Schema(example = "42.75", requiredMode = Schema.RequiredMode.REQUIRED)
    private BigDecimal amount;

    @Pattern(regexp = MoneyUtils.SUPPORTED_CURRENCY_PATTERN, message = "currency must be USD or KHR")
    @Builder.Default
    @Schema(example = "USD", allowableValues = {"USD", "KHR"})
    private String currency = "USD";

    @Size(max = 500, message = "description must not exceed 500 characters")
    @Schema(example = "Monthly salary")
    private String description;

    @NotNull(message = "incomeDate is required")
    @Schema(type = "string", format = "date", example = "2026-01-30", requiredMode = Schema.RequiredMode.REQUIRED)
    private LocalDate incomeDate;

    @NotNull(message = "paymentMethod is required")
    @Schema(description = "CASH, CREDIT_CARD, DEBIT_CARD, BANK_TRANSFER, E_WALLET, OTHER",
            example = "CREDIT_CARD", requiredMode = Schema.RequiredMode.REQUIRED)
    private PaymentMethod paymentMethod;

    @Schema(description = "Optional - incomes may exist without a category")
    private String categoryId;

    @Size(max = 500, message = "receiptUrl must not exceed 500 characters")
    @Schema(example = "https://receipts.example.com/2026/01/receipt-42.pdf")
    private String receiptUrl;

    @Size(max = 20, message = "at most 20 tags are allowed")
    @Schema(description = "Free-form labels, stored as a text[] column")
    private List<@Size(max = 40, message = "each tag must not exceed 40 characters") String> tags;
}
