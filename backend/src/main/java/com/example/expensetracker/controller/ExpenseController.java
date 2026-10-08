package com.example.expensetracker.controller;

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
import com.example.expensetracker.security.SecurityUtils;
import com.example.expensetracker.service.ExpenseService;

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
 * Expense endpoints. The caller is always derived from the JWT, never from a
 * request parameter, which is what keeps the data tenant safe.
 */
@RestController
@RequestMapping("/api/v1/expenses")
@RequiredArgsConstructor
@Tag(name = "Expenses", description = "Create, filter and aggregate expenses")
public class ExpenseController {

    private final ExpenseService expenseService;

    @GetMapping
    @Operation(summary = "List expenses",
            description = """
                    Paged, filtered and sorted listing. All filters are optional and are combined with AND.

                    | Parameter | Example | Notes |
                    |---|---|---|
                    | `categoryId` | `6f1c...` | single category |
                    | `fromDate` / `toDate` | `2026-01-01` | inclusive range on `expenseDate` |
                    | `minAmount` / `maxAmount` | `10.00` | inclusive range on `amount` |
                    | `search` | `grocery` | case-insensitive match on description and amount |
                    | `paymentMethods` | `CASH,E_WALLET` | repeatable or comma separated |
                    | `page` / `size` | `0` / `20` | `size` is capped at 100 |
                    | `sort` | `amount,desc` | `expenseDate, amount, description, paymentMethod, currency, createdAt, updatedAt, category` |
                    """)
    public ApiResponse<List<ExpenseResponse>> list(
            @AuthenticationPrincipal Jwt jwt,
            @Parameter(description = "Filter criteria, all optional")
            @Valid @ModelAttribute ExpenseFilterRequest filter,
            @PageableDefault(size = 20, sort = "expenseDate", direction = Sort.Direction.DESC) Pageable pageable) {
        return expenseService.list(SecurityUtils.currentUserId(jwt), filter, pageable);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get one expense", description = "Responses: 200 found, 404 unknown or not owned by the caller")
    public ApiResponse<ExpenseResponse> get(@AuthenticationPrincipal Jwt jwt,
                                            @Parameter(description = "Expense id") @PathVariable UUID id) {
        return ApiResponse.of(expenseService.get(SecurityUtils.currentUserId(jwt), id));
    }

    @PostMapping
    @Operation(summary = "Create an expense",
            description = "Responses: 201 created, 400 validation error, 404 unknown category")
    public ResponseEntity<ApiResponse<ExpenseResponse>> create(@AuthenticationPrincipal Jwt jwt,
                                                              @Valid @RequestBody ExpenseRequest request) {
        ExpenseResponse created = expenseService.create(SecurityUtils.currentUserId(jwt), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(created, "Expense created"));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Replace an expense",
            description = "Full replacement (PUT). An omitted `categoryId` detaches the expense from its category. "
                    + "Responses: 200 updated, 400 validation error, 404 unknown expense")
    public ApiResponse<ExpenseResponse> update(@AuthenticationPrincipal Jwt jwt,
                                               @PathVariable UUID id,
                                               @Valid @RequestBody ExpenseRequest request) {
        return ApiResponse.of(expenseService.update(SecurityUtils.currentUserId(jwt), id, request),
                "Expense updated");
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete an expense", description = "Responses: 200 deleted, 404 unknown expense")
    public ApiResponse<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        expenseService.delete(SecurityUtils.currentUserId(jwt), id);
        return ApiResponse.empty("Expense deleted");
    }

    @GetMapping("/summary")
    @Operation(summary = "Spend per day, week or month",
            description = "Aggregates with DATE_TRUNC. Use `groupBy=daily|weekly|monthly`; "
                    + "`from`/`to` default to the whole history. Example: `/expenses/summary?groupBy=daily&from=2026-01-01`.")
    public ApiResponse<List<ExpenseSummaryResponse>> summary(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @ModelAttribute ExpenseSummaryRequest request) {
        return ApiResponse.of(expenseService.summary(SecurityUtils.currentUserId(jwt), request), "Summary retrieved");
    }

    @GetMapping("/stats/by-category")
    @Operation(summary = "Spend per category",
            description = "Total, average, expense count and percentage share per category, "
                    + "including the share of uncategorised expenses.")
    public ApiResponse<List<CategoryStatResponse>> statsByCategory(
            @AuthenticationPrincipal Jwt jwt,
            @Parameter(description = "Inclusive lower bound, defaults to the beginning of time")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @Parameter(description = "Inclusive upper bound, defaults to today")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ApiResponse.of(expenseService.statsByCategory(SecurityUtils.currentUserId(jwt), from, to),
                "Category statistics retrieved");
    }

    @GetMapping("/recent")
    @Operation(summary = "Most recent expenses",
            description = "Used by the dashboard. `limit` is clamped between 1 and 50.")
    public ApiResponse<List<ExpenseResponse>> recent(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "5") int limit) {
        return ApiResponse.of(expenseService.recent(SecurityUtils.currentUserId(jwt), limit), "Recent expenses retrieved");
    }
}
