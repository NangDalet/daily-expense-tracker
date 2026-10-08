package com.example.expensetracker.convert;

import java.util.List;

import com.example.expensetracker.domain.Budget;
import com.example.expensetracker.domain.BudgetUsage;
import com.example.expensetracker.dto.request.BudgetRequest;
import com.example.expensetracker.dto.response.BudgetResponse;
import com.example.expensetracker.dto.response.BudgetUsageResponse;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

/** Budget &lt;-&gt; DTO conversion, including the usage projection. */
@Mapper(uses = CategoryConvert.class)
public interface BudgetConvert {

    @Mapping(target = "id", expression = "java(budget.getId() == null ? null : budget.getId().toString())")
    @Mapping(target = "categoryId",
            expression = "java(budget.getCategoryId() == null ? null : budget.getCategoryId().toString())")
    @Mapping(target = "category", source = "category")
    BudgetResponse toResponse(Budget budget);

    List<BudgetResponse> toResponseList(List<Budget> budgets);

    @Mapping(target = "budget", source = "budget")
    @Mapping(target = "exceeded", expression = "java(isExceeded(usage))")
    BudgetUsageResponse toUsageResponse(BudgetUsage usage);

    List<BudgetUsageResponse> toUsageResponseList(List<BudgetUsage> usages);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "userId", ignore = true)
    @Mapping(target = "category", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "categoryId", source = "categoryId", qualifiedByName = "toUuid")
    Budget toDomain(BudgetRequest request);

    @Named("toUuid")
    default java.util.UUID toUuid(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return java.util.UUID.fromString(raw);
    }

    /**
     * A budget is exceeded when the spend of the period is strictly above the
     * limit. Derived from the two amounts rather than from the percentage
     * because the percentage is {@code null} whenever the limit is zero, and a
     * zero limit with any spend at all has to be reported as exceeded.
     */
    default boolean isExceeded(BudgetUsage usage) {
        return usage != null
                && usage.getBudget() != null
                && usage.getBudget().getMonthlyLimit() != null
                && usage.getSpentAmount() != null
                && usage.getSpentAmount().compareTo(usage.getBudget().getMonthlyLimit()) > 0;
    }
}
