package com.example.expensetracker.service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.example.expensetracker.dto.request.ExpenseFilterRequest;
import com.example.expensetracker.dto.request.ExpenseRequest;
import com.example.expensetracker.dto.request.ExpenseSummaryRequest;
import com.example.expensetracker.dto.response.ApiResponse;
import com.example.expensetracker.dto.response.CategoryStatResponse;
import com.example.expensetracker.dto.response.ExpenseResponse;
import com.example.expensetracker.dto.response.ExpenseSummaryResponse;

import org.springframework.data.domain.Pageable;

/** Expense use cases. */
public interface ExpenseService {

    ApiResponse<List<ExpenseResponse>> list(UUID userId, ExpenseFilterRequest filter, Pageable pageable);

    ExpenseResponse get(UUID userId, UUID id);

    List<ExpenseResponse> recent(UUID userId, int limit);

    List<ExpenseSummaryResponse> summary(UUID userId, ExpenseSummaryRequest request);

    List<CategoryStatResponse> statsByCategory(UUID userId, LocalDate from, LocalDate to);

    ExpenseResponse create(UUID userId, ExpenseRequest request);

    ExpenseResponse update(UUID userId, UUID id, ExpenseRequest request);

    void delete(UUID userId, UUID id);
}
