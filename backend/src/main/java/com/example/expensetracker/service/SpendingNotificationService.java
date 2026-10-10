package com.example.expensetracker.service;
import java.util.UUID;
import com.example.expensetracker.domain.Expense;
public interface SpendingNotificationService {
    void beforeChange(UUID userId);
    void expenseCreated(Expense expense);
    void checkBudgets(UUID userId, int year, int month);
}
