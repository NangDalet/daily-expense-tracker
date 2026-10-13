package com.example.expensetracker.domain;

import java.math.BigDecimal;
import lombok.Data;

/** Totals of matching expenses in their original currency, independent of pagination. */
@Data
public class ExpenseTotal {
    private String currency;
    private BigDecimal totalAmount;
    private long expenseCount;
}
