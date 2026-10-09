package com.example.expensetracker.convert;

import java.math.BigDecimal;
import java.util.List;


import com.example.expensetracker.domain.IncomeCategoryStat;
import com.example.expensetracker.domain.Income;
import com.example.expensetracker.domain.IncomeSummary;
import com.example.expensetracker.dto.request.IncomeRequest;
import com.example.expensetracker.dto.response.IncomeCategoryStatResponse;
import com.example.expensetracker.dto.response.IncomeResponse;
import com.example.expensetracker.dto.response.IncomeSummaryResponse;
import com.example.expensetracker.util.MoneyUtils;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

/** Income &lt;-&gt; DTO conversion, including the aggregation projections. */
@Mapper(uses = CategoryConvert.class)
public interface IncomeConvert {

    // ===================== Domain -> DTO =====================

    @Mapping(target = "id", expression = "java(income.getId() == null ? null : income.getId().toString())")
    @Mapping(target = "categoryId",
            expression = "java(income.getCategoryId() == null ? null : income.getCategoryId().toString())")
    @Mapping(target = "userId",
            expression = "java(income.getUserId() == null ? null : income.getUserId().toString())")
    @Mapping(target = "paymentMethod", expression = "java(income.getPaymentMethod() == null ? null : income.getPaymentMethod().name())")
    @Mapping(target = "category", source = "category")
    IncomeResponse toResponse(Income income);

    List<IncomeResponse> toResponseList(List<Income> incomes);

    /** All four fields share their name with the projection, so no mapping is needed. */
    IncomeSummaryResponse toSummaryResponse(IncomeSummary summary);

    List<IncomeSummaryResponse> toSummaryResponseList(List<IncomeSummary> summaries);

    @Mapping(target = "categoryId",
            expression = "java(stat.getCategoryId() == null ? null : stat.getCategoryId().toString())")
    IncomeCategoryStatResponse toStatResponse(IncomeCategoryStat stat);

    List<IncomeCategoryStatResponse> toStatResponseList(List<IncomeCategoryStat> stats);

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
    @Mapping(target = "categoryId", ignore = true)
    @Mapping(target = "amount", source = "amount", qualifiedByName = "normalizeAmount")
    @Mapping(target = "tags", source = "tags", qualifiedByName = "normalizeTags")
    Income toDomain(IncomeRequest request);

    // ===================== Qualifiers & helpers =====================

    @Named("normalizeAmount")
    default BigDecimal normalizeAmount(BigDecimal amount) {
        return MoneyUtils.normalize(amount);
    }

    /** Missing tags represent an empty list for a full replacement. */
    @Named("normalizeTags")
    default List<String> normalizeTags(List<String> tags) {
        if (tags == null) {
            return List.of();
        }
        return tags.stream()
                .filter(tag -> tag != null && !tag.isBlank())
                .map(String::trim)
                .distinct()
                .toList();
    }
}
