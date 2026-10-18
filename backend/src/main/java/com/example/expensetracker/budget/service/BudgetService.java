package com.example.expensetracker.budget.service;

import java.util.List;
import java.util.UUID;

import com.example.expensetracker.budget.model.request.BudgetRequest;
import com.example.expensetracker.common.model.response.ApiResponse;
import com.example.expensetracker.budget.model.response.BudgetResponse;
import com.example.expensetracker.budget.model.response.BudgetUsageResponse;

/** Budget use cases. */
public interface BudgetService {

    ApiResponse<List<BudgetResponse>> list(UUID userId, Integer year, Integer month);

    ApiResponse<List<BudgetUsageResponse>> usage(UUID userId, Integer year, Integer month);

    BudgetResponse get(UUID userId, UUID id);

    BudgetResponse upsert(UUID userId, BudgetRequest request);

    BudgetResponse update(UUID userId, UUID id, BudgetRequest request);

    void delete(UUID userId, UUID id);
}
