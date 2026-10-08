package com.example.expensetracker.service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.example.expensetracker.config.PaginationProperties;
import com.example.expensetracker.convert.ExpenseConvert;
import com.example.expensetracker.domain.Expense;
import com.example.expensetracker.dto.request.ExpenseFilterRequest;
import com.example.expensetracker.dto.request.ExpenseRequest;
import com.example.expensetracker.dto.request.ExpenseSummaryRequest;
import com.example.expensetracker.dto.response.ApiResponse;
import com.example.expensetracker.dto.response.CategoryStatResponse;
import com.example.expensetracker.dto.response.ExpenseResponse;
import com.example.expensetracker.dto.response.ExpenseSummaryResponse;
import com.example.expensetracker.exception.ApiException;
import com.example.expensetracker.exception.ErrorCode;
import com.example.expensetracker.exception.ResourceNotFoundException;
import com.example.expensetracker.mapper.CategoryMapper;
import com.example.expensetracker.mapper.ExpenseMapper;
import com.example.expensetracker.util.MoneyUtils;

import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Expense use cases.
 * <p>
 * Every method receives the caller's {@code userId} from the JWT, never from the
 * request payload - that is the multi-tenant boundary of the whole application.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ExpenseService {

    private final ExpenseMapper expenseMapper;
    private final CategoryMapper categoryMapper;
    private final ExpenseConvert expenseConvert;
    private final PaginationProperties paginationProperties;

    // ===================== Reads =====================

    /**
     * Paged, filtered and sorted listing.
     * <p>
     * The count query reuses the exact same {@code <sql>} fragment as the page
     * query, so {@code totalElements} can never disagree with the content.
     */
    @Transactional(readOnly = true)
    public ApiResponse<List<ExpenseResponse>> list(UUID userId, ExpenseFilterRequest filter, Pageable pageable) {
        Pageable safePageable = paginationProperties.sanitize(pageable);
        ExpenseFilterRequest safeFilter = validateFilter(userId, filter);

        long total = expenseMapper.countByFilters(userId, safeFilter);
        if (total == 0) {
            return ApiResponse.ofPage(List.of(), safePageable.getPageNumber(), safePageable.getPageSize(), 0,
                    "No expenses found");
        }

        List<Expense> expenses = expenseMapper.findByFilters(
                userId,
                safeFilter,
                (int) safePageable.getOffset(),
                safePageable.getPageSize(),
                PaginationProperties.toSortColumn(safePageable.getSort()),
                PaginationProperties.toSortDirection(safePageable.getSort()));

        return ApiResponse.ofPage(expenseConvert.toResponseList(expenses),
                safePageable.getPageNumber(), safePageable.getPageSize(), total, "Expenses retrieved");
    }

    @Transactional(readOnly = true)
    public ExpenseResponse get(UUID userId, UUID id) {
        return expenseConvert.toResponse(requireOwned(userId, id));
    }

    @Transactional(readOnly = true)
    public List<ExpenseResponse> recent(UUID userId, int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 50);
        return expenseConvert.toResponseList(expenseMapper.findRecentByUserId(userId, safeLimit));
    }

    // ===================== Aggregations =====================

    @Transactional(readOnly = true)
    public List<ExpenseSummaryResponse> summary(UUID userId, ExpenseSummaryRequest request) {
        return expenseConvert.toSummaryResponseList(expenseMapper.sumByPeriod(
                userId,
                request.getGroupBy().sqlUnit(),
                request.getFrom(),
                request.getTo(),
                parseUuid(request.getCategoryId(), "categoryId"),
                request.getPaymentMethod()));
    }

    @Transactional(readOnly = true)
    public List<CategoryStatResponse> statsByCategory(UUID userId, LocalDate from, LocalDate to) {
        requireValidRange(from, to);
        return expenseConvert.toStatResponseList(expenseMapper.statsByCategory(userId, from, to));
    }

    // ===================== Writes =====================

    @Transactional
    public ExpenseResponse create(UUID userId, ExpenseRequest request) {
        Expense expense = expenseConvert.toDomain(request);
        expense.setUserId(userId);
        expense.setCategoryId(resolveCategory(userId, request.getCategoryId()));

        int inserted = expenseMapper.insert(expense);
        log.info("Created expense {} for user {} ({} {})", expense.getId(), userId, expense.getAmount(), expense.getCurrency());

        if (inserted == 0) {
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "Expense could not be created");
        }
        // Re-read so the response carries generated timestamps and the nested category
        return expenseConvert.toResponse(expenseMapper.findByIdAndUserId(expense.getId(), userId));
    }

    @Transactional
    public ExpenseResponse update(UUID userId, UUID id, ExpenseRequest request) {
        Expense existing = requireOwned(userId, id);

        Expense changes = expenseConvert.toDomain(request);
        changes.setId(id);
        changes.setUserId(userId);
        changes.setCategoryId(resolveCategory(userId, request.getCategoryId()));

        expenseMapper.update(changes);

        // The dynamic UPDATE skips null category_id (a null in the payload means
        // "leave the category untouched" for a PATCH-like client), therefore an
        // explicit detach is issued only when the category really has to be cleared.
        if (changes.getCategoryId() == null && existing.getCategoryId() != null) {
            expenseMapper.detachCategory(id, userId);
        }

        log.info("Updated expense {} for user {}", id, userId);
        return expenseConvert.toResponse(expenseMapper.findByIdAndUserId(id, userId));
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        requireOwned(userId, id);
        expenseMapper.deleteById(id);
        log.info("Deleted expense {} for user {}", id, userId);
    }

    // ===================== Internals =====================

    /** Loads an expense and fails with 404 when it does not exist or belongs to another user. */
    private Expense requireOwned(UUID userId, UUID id) {
        Expense expense = expenseMapper.findByIdAndUserId(id, userId);
        if (expense == null) {
            // Same response for "missing" and "not yours" so ids cannot be probed
            throw ResourceNotFoundException.of("Expense", id);
        }
        return expense;
    }

    /**
     * Rejects unknown categories. A category owned by somebody else is reported
     * as not found instead of forbidden, which avoids leaking its existence.
     */
    private UUID resolveCategory(UUID userId, String rawCategoryId) {
        UUID categoryId = parseUuid(rawCategoryId, "categoryId");
        if (categoryId == null) {
            return null;
        }
        var category = categoryMapper.findById(categoryId);
        if (category == null || !userId.equals(category.getUserId())) {
            throw ResourceNotFoundException.of("Category", categoryId);
        }
        return categoryId;
    }

    private ExpenseFilterRequest validateFilter(UUID userId, ExpenseFilterRequest filter) {
        ExpenseFilterRequest safeFilter = filter == null ? new ExpenseFilterRequest() : filter;
        requireValidRange(safeFilter.getFromDate(), safeFilter.getToDate());
        if (MoneyUtils.isPositive(safeFilter.getMinAmount()) && MoneyUtils.isPositive(safeFilter.getMaxAmount())
                && safeFilter.getMaxAmount().compareTo(safeFilter.getMinAmount()) < 0) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "maxAmount must be greater than or equal to minAmount");
        }
        // A filter for somebody else's category would silently return an empty page
        resolveCategory(userId, safeFilter.getCategoryId());
        return safeFilter;
    }

    private void requireValidRange(LocalDate from, LocalDate to) {
        if (from != null && to != null && to.isBefore(from)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "'to' must not be earlier than 'from'");
        }
    }

    private UUID parseUuid(String raw, String field) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(raw.trim());
        } catch (IllegalArgumentException ex) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, field + " must be a valid UUID");
        }
    }
}
