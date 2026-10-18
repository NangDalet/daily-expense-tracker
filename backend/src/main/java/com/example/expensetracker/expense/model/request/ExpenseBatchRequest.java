package com.example.expensetracker.expense.model.request;

import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Save all items together or roll back the entire batch. */
public record ExpenseBatchRequest(
        @NotNull @Size(min = 1, max = 20) List<@NotNull @Valid ExpenseRequest> expenses) {
}
