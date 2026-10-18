package com.example.expensetracker.telegram.service;
import java.util.UUID;
import com.example.expensetracker.expense.model.Expense;
public interface SpendingNotificationService {
    void beforeChange(UUID userId);
    void expenseCreated(Expense expense);
    void checkBudgets(UUID userId, int year, int month);
}
