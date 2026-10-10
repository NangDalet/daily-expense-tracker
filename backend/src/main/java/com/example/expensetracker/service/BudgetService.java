package com.example.expensetracker.service;

import java.util.List;
import java.util.UUID;

import com.example.expensetracker.dto.request.BudgetRequest;
import com.example.expensetracker.dto.response.ApiResponse;
import com.example.expensetracker.dto.response.BudgetResponse;
import com.example.expensetracker.dto.response.BudgetUsageResponse;

/** Budget use cases. */
public interface BudgetService {

    ApiResponse<List<BudgetResponse>> list(UUID userId, Integer year, Integer month);

    ApiResponse<List<BudgetUsageResponse>> usage(UUID userId, Integer year, Integer month);

    BudgetResponse get(UUID userId, UUID id);

    BudgetResponse upsert(UUID userId, BudgetRequest request);

    BudgetResponse update(UUID userId, UUID id, BudgetRequest request);

    void delete(UUID userId, UUID id);
}
