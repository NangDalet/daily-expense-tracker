package com.example.expensetracker.dto.request;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.example.expensetracker.domain.PaymentMethod;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Dynamic filter criteria for {@code GET /api/v1/incomes}.
 * <p>
 * Bound from the query string through Spring's {@code @ModelAttribute} binding,
 * every single field is optional and each one maps to a {@code <if>} test in
 * {@code IncomeMapper.xml#findByFilters}. Note that the owning {@code userId} is
 * <strong>not</strong> part of this object - it always comes from the JWT, so a
 * caller can never widen the query by adding a parameter.
 * <p>
 * Paging and sorting are handled separately by Spring's {@code Pageable}
 * argument resolver ({@code page}, {@code size}, {@code sort=amount,desc}).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "IncomeFilter", description = "Query parameters of the income list endpoint")
public class IncomeFilterRequest {

    @Schema(description = "Restrict to a single category", example = "3f1b...-...")
    private String categoryId;

    @Schema(type = "string", format = "date", description = "Inclusive lower bound of incomeDate")
    private LocalDate fromDate;

    @Schema(type = "string", format = "date", description = "Inclusive upper bound of incomeDate")
    private LocalDate toDate;

    @DecimalMin(value = "0.0", message = "minAmount must not be negative")
    @Schema(description = "Inclusive lower bound of amount", example = "10.00")
    private BigDecimal minAmount;

    @DecimalMin(value = "0.0", message = "maxAmount must not be negative")
    @Schema(description = "Inclusive upper bound of amount", example = "500.00")
    private BigDecimal maxAmount;

    @Size(max = 120, message = "search must not exceed 120 characters")
    @Schema(description = "Case-insensitive match against description and amount",
            example = "grocery")
    private String search;

    @Schema(description = "Repeatable or comma separated, e.g. ?paymentMethods=CASH&paymentMethods=E_WALLET")
    private List<PaymentMethod> paymentMethods;
}
