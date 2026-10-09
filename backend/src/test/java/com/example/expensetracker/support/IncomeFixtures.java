package com.example.expensetracker.support;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import com.example.expensetracker.convert.CategoryConvertImpl;
import com.example.expensetracker.convert.IncomeConvert;
import com.example.expensetracker.convert.IncomeConvertImpl;
import com.example.expensetracker.domain.Income;
import com.example.expensetracker.domain.PaymentMethod;
import org.springframework.test.util.ReflectionTestUtils;

public final class IncomeFixtures {
    private IncomeFixtures() {}

    public static IncomeConvert incomeConvert() {
        IncomeConvertImpl convert = new IncomeConvertImpl();
        ReflectionTestUtils.setField(convert, "categoryConvert", new CategoryConvertImpl());
        return convert;
    }

    public static Income income(UUID id, UUID userId, BigDecimal amount) {
        return Income.builder().id(id).userId(userId).amount(amount).currency("USD")
                .description("Monthly salary").incomeDate(LocalDate.of(2026, 1, 15))
                .paymentMethod(PaymentMethod.CREDIT_CARD).tags(List.of("test"))
                .createdAt(OffsetDateTime.parse("2026-01-15T10:00:00Z"))
                .updatedAt(OffsetDateTime.parse("2026-01-15T10:00:00Z")).build();
    }
}