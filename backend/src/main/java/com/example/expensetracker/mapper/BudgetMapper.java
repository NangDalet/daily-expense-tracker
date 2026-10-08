package com.example.expensetracker.mapper;

import java.util.List;
import java.util.UUID;

import com.example.expensetracker.domain.Budget;
import com.example.expensetracker.domain.BudgetUsage;

import org.apache.ibatis.annotations.Param;

/** Budget persistence - see {@code mappers/BudgetMapper.xml}. */
public interface BudgetMapper {

    int insert(Budget budget);

    Budget findById(@Param("id") UUID id);

    /** All budgets of a user for one calendar month, category included. */
    List<Budget> findByUserIdAndPeriod(@Param("userId") UUID userId,
                                      @Param("year") int year,
                                      @Param("month") int month);

    /**
     * Looks up the single budget for a user/category/period. Handles the
     * {@code category_id IS NULL} "overall budget" case through {@code <choose>}.
     */
    Budget findByUserIdCategoryAndPeriod(@Param("userId") UUID userId,
                                        @Param("categoryId") UUID categoryId,
                                        @Param("year") int year,
                                        @Param("month") int month);

    int update(Budget budget);

    int deleteById(@Param("id") UUID id);

    /**
     * Budgets joined with the actual spend of the same period. The aggregation
     * runs in a {@code LEFT JOIN LATERAL} so a budget without expenses still
     * returns a row and the per-category restriction is expressed once.
     */
    List<BudgetUsage> getBudgetUsage(@Param("userId") UUID userId,
                                     @Param("year") int year,
                                     @Param("month") int month);
}
