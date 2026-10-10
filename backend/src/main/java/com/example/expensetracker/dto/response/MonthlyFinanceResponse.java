package com.example.expensetracker.dto.response;

import java.math.BigDecimal;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor
public class MonthlyFinanceResponse {
    private String currency;
    private BigDecimal totalIncome;
    private BigDecimal totalExpenses;
    private BigDecimal balance;
    private long incomeCount;
    private long expenseCount;
}
