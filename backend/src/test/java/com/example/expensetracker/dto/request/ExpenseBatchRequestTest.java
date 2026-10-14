package com.example.expensetracker.dto.request;

import static org.assertj.core.api.Assertions.assertThat;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import com.example.expensetracker.domain.PaymentMethod;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class ExpenseBatchRequestTest {
    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll static void setup() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }
    @AfterAll static void close() { factory.close(); }

    @Test void acceptsOneThroughTwentyValidItems() {
        assertThat(validator.validate(new ExpenseBatchRequest(List.of(item())))).isEmpty();
        assertThat(validator.validate(new ExpenseBatchRequest(Collections.nCopies(20, item())))).isEmpty();
    }

    @Test void rejectsMissingEmptyOversizedAndNullItemBatches() {
        assertThat(validator.validate(new ExpenseBatchRequest(null))).isNotEmpty();
        assertThat(validator.validate(new ExpenseBatchRequest(List.of()))).isNotEmpty();
        assertThat(validator.validate(new ExpenseBatchRequest(Collections.nCopies(21, item())))).isNotEmpty();
        assertThat(validator.validate(new ExpenseBatchRequest(Arrays.asList(item(), null)))).isNotEmpty();
    }

    @Test void validatesAmountsAndRequiredFieldsInsideEachItem() {
        var invalid = item();
        invalid.setAmount(BigDecimal.ZERO);
        invalid.setExpenseDate(null);
        assertThat(validator.validate(new ExpenseBatchRequest(List.of(item(), invalid))))
                .extracting(violation -> violation.getPropertyPath().toString())
                .containsExactlyInAnyOrder("expenses[1].amount", "expenses[1].expenseDate");
    }

    private ExpenseRequest item() {
        return ExpenseRequest.builder().amount(new BigDecimal("2.50")).currency("USD")
                .description("Sandwich").expenseDate(LocalDate.of(2026, 10, 14))
                .paymentMethod(PaymentMethod.CASH).build();
    }
}
