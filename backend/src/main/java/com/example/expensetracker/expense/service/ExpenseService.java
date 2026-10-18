package com.example.expensetracker.expense.service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import com.example.expensetracker.expense.model.ExpenseTotal;

import com.example.expensetracker.expense.model.request.ExpenseFilterRequest;
import com.example.expensetracker.expense.model.request.ExpenseRequest;
import com.example.expensetracker.expense.model.request.ExpenseSummaryRequest;
import com.example.expensetracker.common.model.response.ApiResponse;
import com.example.expensetracker.expense.model.response.CategoryStatResponse;
import com.example.expensetracker.expense.model.response.ExpenseResponse;
import com.example.expensetracker.expense.model.response.ExpenseSummaryResponse;

import org.springframework.data.domain.Pageable;

/** Expense use cases. */
public interface ExpenseService {

    List<ExpenseTotal> totals(UUID userId, ExpenseFilterRequest filter);

    ApiResponse<List<ExpenseResponse>> list(UUID userId, ExpenseFilterRequest filter, Pageable pageable);

    ExpenseResponse get(UUID userId, UUID id);

    List<ExpenseResponse> recent(UUID userId, int limit);

    List<ExpenseSummaryResponse> summary(UUID userId, ExpenseSummaryRequest request);

    List<CategoryStatResponse> statsByCategory(UUID userId, LocalDate from, LocalDate to);

    ExpenseResponse create(UUID userId, ExpenseRequest request);

    List<ExpenseResponse> createBatch(UUID userId, List<ExpenseRequest> requests);

    ExpenseResponse update(UUID userId, UUID id, ExpenseRequest request);

    void delete(UUID userId, UUID id);
}
