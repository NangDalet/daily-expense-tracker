package com.example.expensetracker.service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.example.expensetracker.dto.request.IncomeFilterRequest;
import com.example.expensetracker.dto.request.IncomeRequest;
import com.example.expensetracker.dto.request.IncomeSummaryRequest;
import com.example.expensetracker.dto.response.ApiResponse;
import com.example.expensetracker.dto.response.IncomeCategoryStatResponse;
import com.example.expensetracker.dto.response.IncomeResponse;
import com.example.expensetracker.dto.response.IncomeSummaryResponse;

import org.springframework.data.domain.Pageable;

/** Income use cases. */
public interface IncomeService {

    ApiResponse<List<IncomeResponse>> list(UUID userId, IncomeFilterRequest filter, Pageable pageable);

    IncomeResponse get(UUID userId, UUID id);

    List<IncomeResponse> recent(UUID userId, int limit);

    List<IncomeSummaryResponse> summary(UUID userId, IncomeSummaryRequest request);

    List<IncomeCategoryStatResponse> statsByCategory(UUID userId, LocalDate from, LocalDate to);

    IncomeResponse create(UUID userId, IncomeRequest request);

    IncomeResponse update(UUID userId, UUID id, IncomeRequest request);

    void delete(UUID userId, UUID id);
}
