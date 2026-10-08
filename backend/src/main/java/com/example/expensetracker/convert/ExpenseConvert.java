package com.example.expensetracker.convert;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import com.example.expensetracker.domain.CategoryStat;
import com.example.expensetracker.domain.Expense;
import com.example.expensetracker.domain.ExpenseSummary;
import com.example.expensetracker.dto.request.ExpenseRequest;
import com.example.expensetracker.dto.response.CategoryStatResponse;
import com.example.expensetracker.dto.response.ExpenseResponse;
import com.example.expensetracker.dto.response.ExpenseSummaryResponse;
import com.example.expensetracker.util.MoneyUtils;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

/** Expense &lt;-&gt; DTO conversion, including the aggregation projections. */
@Mapper(uses = CategoryConvert.class)
public interface ExpenseConvert {

    // ===================== Domain -> DTO =====================

    @Mapping(target = "id", expression = "java(expense.getId() == null ? null : expense.getId().toString())")
    @Mapping(target = "categoryId",
            expression = "java(expense.getCategoryId() == null ? null : expense.getCategoryId().toString())")
    @Mapping(target = "userId",
            expression = "java(expense.getUserId() == null ? null : expense.getUserId().toString())")
    @Mapping(target = "paymentMethod", expression = "java(expense.getPaymentMethod() == null ? null : expense.getPaymentMethod().name())")
    @Mapping(target = "category", source = "category")
    ExpenseResponse toResponse(Expense expense);

    List<ExpenseResponse> toResponseList(List<Expense> expenses);

    /** All four fields share their name with the projection, so no mapping is needed. */
    ExpenseSummaryResponse toSummaryResponse(ExpenseSummary summary);

    List<ExpenseSummaryResponse> toSummaryResponseList(List<ExpenseSummary> summaries);

    @Mapping(target = "categoryId",
            expression = "java(stat.getCategoryId() == null ? null : stat.getCategoryId().toString())")
    CategoryStatResponse toStatResponse(CategoryStat stat);

    List<CategoryStatResponse> toStatResponseList(List<CategoryStat> stats);

    // ===================== DTO -> Domain =====================

    /**
     * Builds the entity for both create and update (the API exposes PUT, so the
     * request is a full replacement). The owning {@code userId} is taken from the
     * JWT by the caller and can therefore never be spoofed through the payload.
     */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "userId", ignore = true)
    @Mapping(target = "category", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "categoryId", source = "categoryId", qualifiedByName = "toUuid")
    @Mapping(target = "amount", source = "amount", qualifiedByName = "normalizeAmount")
    @Mapping(target = "tags", source = "tags", qualifiedByName = "normalizeTags")
    Expense toDomain(ExpenseRequest request);

    // ===================== Qualifiers & helpers =====================

    @Named("toUuid")
    default UUID toUuid(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return UUID.fromString(raw);
    }

    @Named("normalizeAmount")
    default BigDecimal normalizeAmount(BigDecimal amount) {
        return MoneyUtils.normalize(amount);
    }

    /** Empty lists become null so the dynamic UPDATE keeps the column untouched. */
    @Named("normalizeTags")
    default List<String> normalizeTags(List<String> tags) {
        if (tags == null) {
            return null;
        }
        return tags.stream()
                .filter(tag -> tag != null && !tag.isBlank())
                .map(String::trim)
                .distinct()
                .toList();
    }
}
