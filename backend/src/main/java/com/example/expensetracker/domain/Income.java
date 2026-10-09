package com.example.expensetracker.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A single income row.
 * <p>
 * {@code category} is never populated by plain CRUD statements - it is filled in
 * by the {@code findById} / {@code findByFilters} statements through the
 * nested {@code <association>} declared in IncomeMapper.xml.
 * <p>
 * {@code tags} is a {@code text[]} column handled by
 * {@code com.example.expensetracker.util.StringArrayTypeHandler}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Income {

    private UUID id;

    private BigDecimal amount;

    private String currency;

    private String description;

    private LocalDate incomeDate;

    private PaymentMethod paymentMethod;

    private UUID categoryId;

    /** Nested projection - populated by the JOIN based statements only. */
    private Category category;

    private UUID userId;

    private String receiptUrl;

    private List<String> tags;

    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;
}
