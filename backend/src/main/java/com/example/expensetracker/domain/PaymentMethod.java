package com.example.expensetracker.domain;

/**
 * Ways money can leave an account. The {@link #name()} values are constrained
 * by {@code ck_expenses_payment_method} in V1__init_schema.sql, so renaming an
 * enum constant requires a matching migration.
 */
public enum PaymentMethod {

    CASH,
    CREDIT_CARD,
    DEBIT_CARD,
    BANK_TRANSFER,
    E_WALLET,
    OTHER
}
