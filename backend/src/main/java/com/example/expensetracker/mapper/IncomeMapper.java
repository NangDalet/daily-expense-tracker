package com.example.expensetracker.mapper;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.example.expensetracker.domain.IncomeCategoryStat;
import com.example.expensetracker.domain.Income;
import com.example.expensetracker.domain.IncomeSummary;
import com.example.expensetracker.domain.PaymentMethod;
import com.example.expensetracker.dto.request.IncomeFilterRequest;

import org.apache.ibatis.annotations.Param;

/**
 * Income persistence - see {@code mappers/IncomeMapper.xml}.
 * <p>
 * The two list statements ({@link #findByFilters} / {@link #countByFilters})
 * share an identical {@code <sql id="filterClauses">} fragment so the paged
 * result and the total count can never drift apart.
 */
public interface IncomeMapper {

    int insert(Income income);

    /** Loads the income including its nested category through a LEFT JOIN. */
    Income findById(@Param("id") UUID id);

    /** Ownership-scoped variant - the only variant the service layer uses. */
    Income findByIdAndUserId(@Param("id") UUID id, @Param("userId") UUID userId);

    int update(Income income);

    int deleteById(@Param("id") UUID id, @Param("userId") UUID userId);



    /**
     * Dynamic, fully paged and sorted list. {@code sortColumn} is mapped through
     * a {@code <choose>} whitelist inside the XML, so it can never be injected.
     */
    List<Income> findByFilters(@Param("userId") UUID userId,
                                @Param("filter") IncomeFilterRequest filter,
                                @Param("offset") int offset,
                                @Param("limit") int limit,
                                @Param("sortColumn") String sortColumn,
                                @Param("sortDirection") String sortDirection);

    long countByFilters(@Param("userId") UUID userId,
                        @Param("filter") IncomeFilterRequest filter);

    /**
     * Aggregates income per day / week / month using {@code DATE_TRUNC}. The
     * granularity is whitelisted with {@code <choose>} and interpolated as
     * {@code DATE_TRUNC('day', income_date)}.
     */
    List<IncomeSummary> sumByPeriod(@Param("userId") UUID userId,
                                     @Param("groupBy") String groupBy,
                                     @Param("from") LocalDate from,
                                     @Param("to") LocalDate to,
                                     @Param("categoryId") UUID categoryId,
                                     @Param("paymentMethod") PaymentMethod paymentMethod);

    /** Income per category with percentage share, computed in a single pass. */
    List<IncomeCategoryStat> statsByCategory(@Param("userId") UUID userId,
                                       @Param("from") LocalDate from,
                                       @Param("to") LocalDate to);

    /** Most recent incomes for the dashboard "Recent activity" list. */
    List<Income> findRecentByUserId(@Param("userId") UUID userId, @Param("limit") int limit);
}
