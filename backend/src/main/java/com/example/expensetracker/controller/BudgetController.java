package com.example.expensetracker.controller;

import java.util.List;
import java.util.UUID;

import com.example.expensetracker.dto.request.BudgetRequest;
import com.example.expensetracker.dto.response.ApiResponse;
import com.example.expensetracker.dto.response.BudgetResponse;
import com.example.expensetracker.dto.response.BudgetUsageResponse;
import com.example.expensetracker.security.SecurityUtils;
import com.example.expensetracker.service.BudgetService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

/** Monthly spending limits. {@code POST} and {@code PUT} are the same convergent upsert. */
@RestController
@RequestMapping("/api/v1/budgets")
@RequiredArgsConstructor
@Tag(name = "Budgets", description = "Monthly limits per category and overall")
public class BudgetController {

    private final BudgetService budgetService;

    @GetMapping
    @Operation(summary = "List budgets of a period",
            description = "`year` and `month` default to the current month. The overall budget "
                    + "(no category) is listed first.")
    public ApiResponse<List<BudgetResponse>> list(@AuthenticationPrincipal Jwt jwt,
                                                 @Parameter(description = "e.g. 2026") @RequestParam(required = false) Integer year,
                                                 @Parameter(description = "1-12") @RequestParam(required = false) Integer month) {
        return budgetService.list(SecurityUtils.currentUserId(jwt), year, month);
    }

    @GetMapping("/usage")
    @Operation(summary = "Budgets with actual spend",
            description = "Each budget joined with the expenses of the same period: spent amount, "
                    + "remaining amount and usage percentage. The progress bars of the UI read this endpoint.")
    public ApiResponse<List<BudgetUsageResponse>> usage(@AuthenticationPrincipal Jwt jwt,
                                                        @RequestParam(required = false) Integer year,
                                                        @RequestParam(required = false) Integer month) {
        return budgetService.usage(SecurityUtils.currentUserId(jwt), year, month);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get one budget", description = "Responses: 200 found, 404 unknown budget")
    public ApiResponse<BudgetResponse> get(@AuthenticationPrincipal Jwt jwt,
                                           @Parameter(description = "Budget id") @PathVariable UUID id) {
        return ApiResponse.of(budgetService.get(SecurityUtils.currentUserId(jwt), id));
    }

    @PostMapping
    @Operation(summary = "Set a monthly limit (upsert)",
            description = "Creates the budget of (user, category, period) or updates it when it already exists. "
                    + "Omit `categoryId` to address the overall monthly budget.")
    public ApiResponse<BudgetResponse> upsert(@AuthenticationPrincipal Jwt jwt,
                                              @Valid @RequestBody BudgetRequest request) {
        return ApiResponse.of(budgetService.upsert(SecurityUtils.currentUserId(jwt), request), "Budget saved");
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a budget",
            description = "Updates the limit and/or the period of an existing budget. "
                    + "The owner and the category of a budget are immutable.")
    public ApiResponse<BudgetResponse> update(@AuthenticationPrincipal Jwt jwt,
                                              @Parameter(description = "Budget id") @PathVariable UUID id,
                                              @Valid @RequestBody BudgetRequest request) {
        return ApiResponse.of(budgetService.update(SecurityUtils.currentUserId(jwt), id, request), "Budget updated");
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a budget", description = "Responses: 200 deleted, 404 unknown budget")
    public ApiResponse<Void> delete(@AuthenticationPrincipal Jwt jwt,
                                    @Parameter(description = "Budget id") @PathVariable UUID id) {
        budgetService.delete(SecurityUtils.currentUserId(jwt), id);
        return ApiResponse.empty("Budget deleted");
    }
}
