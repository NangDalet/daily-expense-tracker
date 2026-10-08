package com.example.expensetracker.mapper;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.example.expensetracker.domain.CategoryStat;
import com.example.expensetracker.domain.Expense;
import com.example.expensetracker.domain.ExpenseSummary;
import com.example.expensetracker.domain.PaymentMethod;
import com.example.expensetracker.dto.request.ExpenseFilterRequest;

import org.apache.ibatis.annotations.Param;

/**
 * Expense persistence - see {@code mappers/ExpenseMapper.xml}.
 * <p>
 * The two list statements ({@link #findByFilters} / {@link #countByFilters})
 * share an identical {@code <sql id="filterClauses">} fragment so the paged
 * result and the total count can never drift apart.
 */
public interface ExpenseMapper {

    int insert(Expense expense);

    /** Loads the expense including its nested category through a LEFT JOIN. */
    Expense findById(@Param("id") UUID id);

    /** Ownership-scoped variant - the only variant the service layer uses. */
    Expense findByIdAndUserId(@Param("id") UUID id, @Param("userId") UUID userId);

    int update(Expense expense);

    int deleteById(@Param("id") UUID id);

    /**
     * Clears {@code category_id}. Kept as a dedicated statement because the
     * dynamic {@link #update} can only assign a value, never NULL.
     */
    int detachCategory(@Param("id") UUID id, @Param("userId") UUID userId);

    /**
     * Dynamic, fully paged and sorted list. {@code sortColumn} is mapped through
     * a {@code <choose>} whitelist inside the XML, so it can never be injected.
     */
    List<Expense> findByFilters(@Param("userId") UUID userId,
                                @Param("filter") ExpenseFilterRequest filter,
                                @Param("offset") int offset,
                                @Param("limit") int limit,
                                @Param("sortColumn") String sortColumn,
                                @Param("sortDirection") String sortDirection);

    long countByFilters(@Param("userId") UUID userId,
                        @Param("filter") ExpenseFilterRequest filter);

    /**
     * Aggregates spend per day / week / month using {@code DATE_TRUNC}. The
     * granularity is whitelisted with {@code <choose>} and interpolated as
     * {@code DATE_TRUNC('day', expense_date)}.
     */
    List<ExpenseSummary> sumByPeriod(@Param("userId") UUID userId,
                                     @Param("groupBy") String groupBy,
                                     @Param("from") LocalDate from,
                                     @Param("to") LocalDate to,
                                     @Param("categoryId") UUID categoryId,
                                     @Param("paymentMethod") PaymentMethod paymentMethod);

    /** Spend per category with percentage share, computed in a single pass. */
    List<CategoryStat> statsByCategory(@Param("userId") UUID userId,
                                       @Param("from") LocalDate from,
                                       @Param("to") LocalDate to);

    /** Most recent expenses for the dashboard "Recent activity" list. */
    List<Expense> findRecentByUserId(@Param("userId") UUID userId, @Param("limit") int limit);
}
