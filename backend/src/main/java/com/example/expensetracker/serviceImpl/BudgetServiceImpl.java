package com.example.expensetracker.serviceImpl;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

import com.example.expensetracker.convert.BudgetConvert;
import com.example.expensetracker.domain.Budget;
import com.example.expensetracker.domain.BudgetUsage;
import com.example.expensetracker.domain.Category;
import com.example.expensetracker.dto.request.BudgetRequest;
import com.example.expensetracker.dto.response.ApiResponse;
import com.example.expensetracker.dto.response.BudgetResponse;
import com.example.expensetracker.dto.response.BudgetUsageResponse;
import com.example.expensetracker.exception.ApiException;
import com.example.expensetracker.exception.ErrorCode;
import com.example.expensetracker.exception.ResourceNotFoundException;
import com.example.expensetracker.mapper.BudgetMapper;
import com.example.expensetracker.mapper.CategoryMapper;
import com.example.expensetracker.service.BudgetService;
import com.example.expensetracker.service.SpendingNotificationService;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/** Budget use cases. A budget belongs to one user, one month and optionally one category. */
@Service
@RequiredArgsConstructor
@Slf4j
public class BudgetServiceImpl implements BudgetService {

    private final BudgetMapper budgetMapper;
    private final CategoryMapper categoryMapper;
    private final BudgetConvert budgetConvert;
    private final SpendingNotificationService notifications;

    /** All budgets of a period. Defaults to the current month. */
    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<BudgetResponse>> list(UUID userId, Integer year, Integer month) {
        YearMonth period = resolvePeriod(year, month);
        List<Budget> budgets = budgetMapper.findByUserIdAndPeriod(userId, period.getYear(), period.getMonthValue());
        return ApiResponse.of(budgetConvert.toResponseList(budgets),
                "Budgets for %s retrieved".formatted(period));
    }

    /** Budgets of a period enriched with the actual spend, ordered for progress bars. */
    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<BudgetUsageResponse>> usage(UUID userId, Integer year, Integer month) {
        YearMonth period = resolvePeriod(year, month);
        List<BudgetUsage> usages =
                budgetMapper.getBudgetUsage(userId, period.getYear(), period.getMonthValue());
        return ApiResponse.of(budgetConvert.toUsageResponseList(usages),
                "Budget usage for %s retrieved".formatted(period));
    }

    @Override
    @Transactional(readOnly = true)
    public BudgetResponse get(UUID userId, UUID id) {
        return budgetConvert.toResponse(requireOwned(userId, id));
    }

    /**
     * Creates or updates the budget of (user, category, period, currency) - a convergent
     * upsert, which is what the "set monthly limit" dialog in the UI needs.
     * A {@code null} {@code categoryId} addresses the overall monthly budget.
     */
    @Override
    @Transactional
    public BudgetResponse upsert(UUID userId, BudgetRequest request) {
        UUID categoryId = resolveCategory(userId, request.getCategoryId());
        YearMonth period = YearMonth.of(request.getYear(), request.getMonth());

        notifications.beforeChange(userId);
        Budget budget = budgetMapper.findByUserIdCategoryAndPeriod(
                userId, categoryId, period.getYear(), period.getMonthValue(), request.getCurrency());

        if (budget == null) {
            budget = Budget.builder()
                    .userId(userId)
                    .categoryId(categoryId)
                    .currency(request.getCurrency())
                    .monthlyLimit(request.getMonthlyLimit())
                    .month(period.getMonthValue())
                    .year(period.getYear())
                    .build();
            budgetMapper.insert(budget);
            log.info("Created {} budget {} for user {}", categoryId == null ? "overall" : categoryId,
                    budget.getId(), userId);
        } else {
            budget.setMonthlyLimit(request.getMonthlyLimit());
            budgetMapper.update(budget);
            log.info("Updated budget {} for user {}", budget.getId(), userId);
        }

        notifications.checkBudgets(userId, period.getYear(), period.getMonthValue());
        return budgetConvert.toResponse(budgetMapper.findById(budget.getId()));
    }

    /**
     * Updates an existing budget by id. The currency, period and limit are the only
     * mutable fields - the owner and the category of a budget never change.
     * Moving a budget onto a period that already has one fails with the unique
     * constraint, which surfaces as a 409.
     */
    @Override
    @Transactional
    public BudgetResponse update(UUID userId, UUID id, BudgetRequest request) {
        notifications.beforeChange(userId);
        Budget budget = requireOwned(userId, id);
        if (request.getMonthlyLimit() != null) {
            budget.setMonthlyLimit(request.getMonthlyLimit());
        }
        if (request.getYear() != null) {
            budget.setYear(request.getYear());
        }
        if (request.getMonth() != null) {
            budget.setMonth(request.getMonth());
        }

        budget.setCurrency(request.getCurrency());
        budgetMapper.update(budget);
        notifications.checkBudgets(userId, budget.getYear(), budget.getMonth());
        log.info("Updated budget {} of user {}", id, userId);
        return budgetConvert.toResponse(budgetMapper.findById(id));
    }

    @Override
    @Transactional
    public void delete(UUID userId, UUID id) {
        notifications.beforeChange(userId);
        requireOwned(userId, id);
        budgetMapper.deleteById(id);
        log.info("Deleted budget {} for user {}", id, userId);
    }

    // ===================== Internals =====================

    private Budget requireOwned(UUID userId, UUID id) {
        Budget budget = budgetMapper.findById(id);
        if (budget == null || !userId.equals(budget.getUserId())) {
            throw ResourceNotFoundException.of("Budget", id);
        }
        return budget;
    }

    private UUID resolveCategory(UUID userId, String rawCategoryId) {
        if (rawCategoryId == null || rawCategoryId.isBlank()) {
            return null;
        }
        UUID categoryId;
        try {
            categoryId = UUID.fromString(rawCategoryId.trim());
        } catch (IllegalArgumentException ex) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "categoryId must be a valid UUID");
        }
        Category category = categoryMapper.findById(categoryId);
        if (category == null || !userId.equals(category.getUserId())) {
            throw ResourceNotFoundException.of("Category", categoryId);
        }
        return categoryId;
    }

    private YearMonth resolvePeriod(Integer year, Integer month) {
        int resolvedYear = year != null ? year : LocalDate.now().getYear();
        int resolvedMonth = month != null ? month : LocalDate.now().getMonthValue();
        try {
            return YearMonth.of(resolvedYear, resolvedMonth);
        } catch (java.time.DateTimeException ex) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR,
                    "year=%d and month=%d do not form a valid month".formatted(resolvedYear, resolvedMonth));
        }
    }
}
