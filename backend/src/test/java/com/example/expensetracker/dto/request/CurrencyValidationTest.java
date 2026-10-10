package com.example.expensetracker.dto.request;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.expensetracker.util.MoneyUtils;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class CurrencyValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    @ParameterizedTest
    @ValueSource(strings = {"USD", "KHR"})
    void acceptsSupportedCurrenciesForExpensesAndIncomes(String currency) {
        var expense = ExpenseRequest.builder().currency(currency).build();
        var income = IncomeRequest.builder().currency(currency).build();

        assertThat(validator.validateProperty(expense, "currency")).isEmpty();
        assertThat(validator.validateProperty(income, "currency")).isEmpty();
        assertThat(MoneyUtils.isSupported(currency)).isTrue();
        assertThat(MoneyUtils.toCurrency(currency).getCurrencyCode()).isEqualTo(currency);
    }

    @ParameterizedTest
    @ValueSource(strings = {"EUR", "GBP", "THB", "JPY", "VND", "CAD", "AUD", "INR", "usd", "khr", "", "dollars"})
    void rejectsOtherCurrencyInputsForExpensesAndIncomes(String currency) {
        var expense = ExpenseRequest.builder().currency(currency).build();
        var income = IncomeRequest.builder().currency(currency).build();

        assertThat(validator.validateProperty(expense, "currency"))
                .extracting(violation -> violation.getMessage()).containsExactly("currency must be USD or KHR");
        assertThat(validator.validateProperty(income, "currency"))
                .extracting(violation -> violation.getMessage()).containsExactly("currency must be USD or KHR");
    }

    @Test
    void defaultsToUsd() {
        assertThat(new ExpenseRequest().getCurrency()).isEqualTo("USD");
        assertThat(new IncomeRequest().getCurrency()).isEqualTo("USD");
        assertThat(ExpenseRequest.builder().build().getCurrency()).isEqualTo("USD");
        assertThat(IncomeRequest.builder().build().getCurrency()).isEqualTo("USD");
    }

    @ParameterizedTest
    @ValueSource(strings = {"EUR", "GBP", "THB", "JPY", "VND", "CAD", "AUD", "INR"})
    void moneyHelpersDoNotSupportOtherCurrencies(String currency) {
        assertThat(MoneyUtils.isSupported(currency)).isFalse();
        assertThat(MoneyUtils.toCurrency(currency).getCurrencyCode()).isEqualTo("USD");
    }
}
