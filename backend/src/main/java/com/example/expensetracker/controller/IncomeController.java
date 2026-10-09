package com.example.expensetracker.controller;

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
import com.example.expensetracker.security.SecurityUtils;
import com.example.expensetracker.service.IncomeService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

/**
 * Income endpoints. The caller is always derived from the JWT, never from a
 * request parameter, which is what keeps the data tenant safe.
 */
@RestController
@RequestMapping("/api/v1/incomes")
@RequiredArgsConstructor
@Tag(name = "Income", description = "Create, filter and aggregate incomes")
public class IncomeController {

    private final IncomeService incomeService;

    @GetMapping
    @Operation(summary = "List incomes",
            description = """
                    Paged, filtered and sorted listing. All filters are optional and are combined with AND.

                    | Parameter | Example | Notes |
                    |---|---|---|
                    | `categoryId` | `6f1c...` | single category |
                    | `fromDate` / `toDate` | `2026-01-01` | inclusive range on `incomeDate` |
                    | `minAmount` / `maxAmount` | `10.00` | inclusive range on `amount` |
                    | `search` | `grocery` | case-insensitive match on description and amount |
                    | `paymentMethods` | `CASH,E_WALLET` | repeatable or comma separated |
                    | `page` / `size` | `0` / `20` | `size` is capped at 100 |
                    | `sort` | `amount,desc` | `incomeDate, amount, description, paymentMethod, currency, createdAt, updatedAt, category` |
                    """)
    public ApiResponse<List<IncomeResponse>> list(
            @AuthenticationPrincipal Jwt jwt,
            @Parameter(description = "Filter criteria, all optional")
            @Valid @ModelAttribute IncomeFilterRequest filter,
            @PageableDefault(size = 20, sort = "incomeDate", direction = Sort.Direction.DESC) Pageable pageable) {
        return incomeService.list(SecurityUtils.currentUserId(jwt), filter, pageable);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get one income", description = "Responses: 200 found, 404 unknown or not owned by the caller")
    public ApiResponse<IncomeResponse> get(@AuthenticationPrincipal Jwt jwt,
                                            @Parameter(description = "Income id") @PathVariable UUID id) {
        return ApiResponse.of(incomeService.get(SecurityUtils.currentUserId(jwt), id));
    }

    @PostMapping
    @Operation(summary = "Create an income",
            description = "Responses: 201 created, 400 validation error, 404 unknown category")
    public ResponseEntity<ApiResponse<IncomeResponse>> create(@AuthenticationPrincipal Jwt jwt,
                                                              @Valid @RequestBody IncomeRequest request) {
        IncomeResponse created = incomeService.create(SecurityUtils.currentUserId(jwt), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(created, "Income created"));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Replace an income",
            description = "Full replacement (PUT). An omitted `categoryId` detaches the income from its category. "
                    + "Responses: 200 updated, 400 validation error, 404 unknown income")
    public ApiResponse<IncomeResponse> update(@AuthenticationPrincipal Jwt jwt,
                                               @PathVariable UUID id,
                                               @Valid @RequestBody IncomeRequest request) {
        return ApiResponse.of(incomeService.update(SecurityUtils.currentUserId(jwt), id, request),
                "Income updated");
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete an income", description = "Responses: 200 deleted, 404 unknown income")
    public ApiResponse<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        incomeService.delete(SecurityUtils.currentUserId(jwt), id);
        return ApiResponse.empty("Income deleted");
    }

    @GetMapping("/summary")
    @Operation(summary = "Income per day, week or month",
            description = "Aggregates separately for each currency with DATE_TRUNC. Use `groupBy=daily|weekly|monthly`; "
                    + "`from`/`to` default to the whole history. Example: `/incomes/summary?groupBy=daily&from=2026-01-01`.")
    public ApiResponse<List<IncomeSummaryResponse>> summary(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @ModelAttribute IncomeSummaryRequest request) {
        return ApiResponse.of(incomeService.summary(SecurityUtils.currentUserId(jwt), request), "Summary retrieved");
    }

    @GetMapping("/stats/by-category")
    @Operation(summary = "Income per category",
            description = "Total, average, income count and percentage share per category and currency, "
                    + "including the share of uncategorised incomes.")
    public ApiResponse<List<IncomeCategoryStatResponse>> statsByCategory(
            @AuthenticationPrincipal Jwt jwt,
            @Parameter(description = "Inclusive lower bound, defaults to the beginning of time")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @Parameter(description = "Inclusive upper bound, defaults to the whole history")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ApiResponse.of(incomeService.statsByCategory(SecurityUtils.currentUserId(jwt), from, to),
                "Category statistics retrieved");
    }

    @GetMapping("/recent")
    @Operation(summary = "Most recent incomes",
            description = "Used by the dashboard. `limit` is clamped between 1 and 50.")
    public ApiResponse<List<IncomeResponse>> recent(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "5") int limit) {
        return ApiResponse.of(incomeService.recent(SecurityUtils.currentUserId(jwt), limit), "Recent incomes retrieved");
    }
}
