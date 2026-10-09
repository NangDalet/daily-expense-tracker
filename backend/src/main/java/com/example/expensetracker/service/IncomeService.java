package com.example.expensetracker.service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.example.expensetracker.config.PaginationProperties;
import com.example.expensetracker.convert.IncomeConvert;
import com.example.expensetracker.domain.Income;
import com.example.expensetracker.dto.request.IncomeFilterRequest;
import com.example.expensetracker.dto.request.IncomeRequest;
import com.example.expensetracker.dto.request.IncomeSummaryRequest;
import com.example.expensetracker.dto.response.ApiResponse;
import com.example.expensetracker.dto.response.IncomeCategoryStatResponse;
import com.example.expensetracker.dto.response.IncomeResponse;
import com.example.expensetracker.dto.response.IncomeSummaryResponse;
import com.example.expensetracker.exception.ApiException;
import com.example.expensetracker.exception.ErrorCode;
import com.example.expensetracker.exception.ResourceNotFoundException;
import com.example.expensetracker.mapper.CategoryMapper;
import com.example.expensetracker.mapper.IncomeMapper;
import com.example.expensetracker.util.MoneyUtils;

import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Income use cases.
 * <p>
 * Every method receives the caller's {@code userId} from the JWT, never from the
 * request payload - that is the multi-tenant boundary of the whole application.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class IncomeService {

    private final IncomeMapper incomeMapper;
    private final CategoryMapper categoryMapper;
    private final IncomeConvert incomeConvert;
    private final PaginationProperties paginationProperties;

    // ===================== Reads =====================

    /**
     * Paged, filtered and sorted listing.
     * <p>
     * The count query reuses the exact same {@code <sql>} fragment as the page
     * query, so {@code totalElements} can never disagree with the content.
     */
    @Transactional(readOnly = true)
    public ApiResponse<List<IncomeResponse>> list(UUID userId, IncomeFilterRequest filter, Pageable pageable) {
        Pageable safePageable = paginationProperties.sanitize(pageable);
        IncomeFilterRequest safeFilter = validateFilter(userId, filter);

        long total = incomeMapper.countByFilters(userId, safeFilter);
        if (total == 0) {
            return ApiResponse.ofPage(List.of(), safePageable.getPageNumber(), safePageable.getPageSize(), 0,
                    "No incomes found");
        }

        String sortColumn = PaginationProperties.toSortColumn(safePageable.getSort());
        if ("expenseDate".equals(sortColumn)) {
            sortColumn = "incomeDate";
        }
        List<Income> incomes = incomeMapper.findByFilters(
                userId,
                safeFilter,
                (int) safePageable.getOffset(),
                safePageable.getPageSize(),
                sortColumn,
                PaginationProperties.toSortDirection(safePageable.getSort()));

        return ApiResponse.ofPage(incomeConvert.toResponseList(incomes),
                safePageable.getPageNumber(), safePageable.getPageSize(), total, "Income retrieved");
    }

    @Transactional(readOnly = true)
    public IncomeResponse get(UUID userId, UUID id) {
        return incomeConvert.toResponse(requireOwned(userId, id));
    }

    @Transactional(readOnly = true)
    public List<IncomeResponse> recent(UUID userId, int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 50);
        return incomeConvert.toResponseList(incomeMapper.findRecentByUserId(userId, safeLimit));
    }

    // ===================== Aggregations =====================

    @Transactional(readOnly = true)
    public List<IncomeSummaryResponse> summary(UUID userId, IncomeSummaryRequest request) {
        requireValidRange(request.getFrom(), request.getTo());
        return incomeConvert.toSummaryResponseList(incomeMapper.sumByPeriod(
                userId,
                request.getGroupBy().sqlUnit(),
                request.getFrom(),
                request.getTo(),
                resolveCategory(userId, request.getCategoryId()),
                request.getPaymentMethod()));
    }

    @Transactional(readOnly = true)
    public List<IncomeCategoryStatResponse> statsByCategory(UUID userId, LocalDate from, LocalDate to) {
        requireValidRange(from, to);
        return incomeConvert.toStatResponseList(incomeMapper.statsByCategory(userId, from, to));
    }

    // ===================== Writes =====================

    @Transactional
    public IncomeResponse create(UUID userId, IncomeRequest request) {
        Income income = incomeConvert.toDomain(request);
        income.setUserId(userId);
        income.setCategoryId(resolveCategory(userId, request.getCategoryId()));

        int inserted = incomeMapper.insert(income);
        log.info("Created income {} for user {} ({} {})", income.getId(), userId, income.getAmount(), income.getCurrency());

        if (inserted == 0) {
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "Income could not be created");
        }
        // Re-read so the response carries generated timestamps and the nested category
        return incomeConvert.toResponse(incomeMapper.findByIdAndUserId(income.getId(), userId));
    }

    @Transactional
    public IncomeResponse update(UUID userId, UUID id, IncomeRequest request) {
        requireOwned(userId, id);

        Income changes = incomeConvert.toDomain(request);
        changes.setId(id);
        changes.setUserId(userId);
        changes.setCategoryId(resolveCategory(userId, request.getCategoryId()));

        incomeMapper.update(changes);

        log.info("Updated income {} for user {}", id, userId);
        return incomeConvert.toResponse(incomeMapper.findByIdAndUserId(id, userId));
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        requireOwned(userId, id);
        incomeMapper.deleteById(id, userId);
        log.info("Deleted income {} for user {}", id, userId);
    }

    // ===================== Internals =====================

    /** Loads an income and fails with 404 when it does not exist or belongs to another user. */
    private Income requireOwned(UUID userId, UUID id) {
        Income income = incomeMapper.findByIdAndUserId(id, userId);
        if (income == null) {
            // Same response for "missing" and "not yours" so ids cannot be probed
            throw ResourceNotFoundException.of("Income", id);
        }
        return income;
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

    private IncomeFilterRequest validateFilter(UUID userId, IncomeFilterRequest filter) {
        IncomeFilterRequest safeFilter = filter == null ? new IncomeFilterRequest() : filter;
        requireValidRange(safeFilter.getFromDate(), safeFilter.getToDate());
        if (safeFilter.getMinAmount() != null && safeFilter.getMaxAmount() != null
                && safeFilter.getMaxAmount().compareTo(safeFilter.getMinAmount()) < 0) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "maxAmount must be greater than or equal to minAmount");
        }
        // A filter for somebody else's category would silently return an empty page
        UUID categoryId = resolveCategory(userId, safeFilter.getCategoryId());
        safeFilter.setCategoryId(categoryId == null ? null : categoryId.toString());
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
