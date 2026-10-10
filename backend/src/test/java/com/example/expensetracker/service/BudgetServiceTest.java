package com.example.expensetracker.service;

import static com.example.expensetracker.support.TestFixtures.CATEGORY_ID;
import static com.example.expensetracker.support.TestFixtures.OTHER_USER_ID;
import static com.example.expensetracker.support.TestFixtures.USER_ID;
import static com.example.expensetracker.support.TestFixtures.budget;
import static com.example.expensetracker.support.TestFixtures.category;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import com.example.expensetracker.domain.Budget;
import com.example.expensetracker.domain.BudgetUsage;
import com.example.expensetracker.dto.request.BudgetRequest;
import com.example.expensetracker.dto.response.BudgetResponse;
import com.example.expensetracker.dto.response.BudgetUsageResponse;
import com.example.expensetracker.exception.ApiException;
import com.example.expensetracker.exception.ResourceNotFoundException;
import com.example.expensetracker.mapper.BudgetMapper;
import com.example.expensetracker.mapper.CategoryMapper;
import com.example.expensetracker.service.SpendingNotificationService;
import com.example.expensetracker.serviceImpl.BudgetServiceImpl;
import com.example.expensetracker.support.TestFixtures;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("BudgetService")
class BudgetServiceTest {

    private static final UUID BUDGET_ID = UUID.fromString("55555555-5555-5555-5555-555555555555");

    @Mock
    private BudgetMapper budgetMapper;

    @Mock
    private CategoryMapper categoryMapper;

    @Mock
    private SpendingNotificationService notifications;

    private BudgetService budgetService;

    @BeforeEach
    void setUp() {
        budgetService = new BudgetServiceImpl(budgetMapper, categoryMapper, TestFixtures.budgetConvert(), notifications);
    }

    @Test
    @DisplayName("creates the budget when the period has none yet")
    void createsBudget() {
        when(categoryMapper.findById(CATEGORY_ID)).thenReturn(category(CATEGORY_ID, USER_ID, "Groceries"));
        when(budgetMapper.findByUserIdCategoryAndPeriod(USER_ID, CATEGORY_ID, 2026, 1, "USD")).thenReturn(null);
        when(budgetMapper.insert(any())).thenAnswer(invocation -> {
            invocation.<Budget>getArgument(0).setId(BUDGET_ID);
            return 1;
        });
        when(budgetMapper.findById(BUDGET_ID)).thenReturn(budget(BUDGET_ID, USER_ID, CATEGORY_ID));

        BudgetResponse saved = budgetService.upsert(USER_ID, BudgetRequest.builder()
                .categoryId(CATEGORY_ID.toString())
                .monthlyLimit(new BigDecimal("350.00"))
                .month(1)
                .year(2026)
                .build());

        assertThat(saved.getId()).isEqualTo(BUDGET_ID.toString());
        ArgumentCaptor<Budget> captor = ArgumentCaptor.forClass(Budget.class);
        verify(budgetMapper).insert(captor.capture());
        assertThat(captor.getValue().getMonthlyLimit()).isEqualByComparingTo("350.00");
        assertThat(captor.getValue().getUserId()).isEqualTo(USER_ID);
    }

    @Test
    @DisplayName("updates the limit when the period already has a budget")
    void updatesExistingBudget() {
        Budget existing = budget(BUDGET_ID, USER_ID, null);
        when(budgetMapper.findByUserIdCategoryAndPeriod(USER_ID, null, 2026, 2, "USD")).thenReturn(existing);

        budgetService.upsert(USER_ID, BudgetRequest.builder()
                .monthlyLimit(new BigDecimal("1250.00"))
                .month(2)
                .year(2026)
                .build());

        assertThat(existing.getMonthlyLimit()).isEqualByComparingTo("1250.00");
        verify(budgetMapper, never()).insert(any());
        verify(budgetMapper).update(existing);
    }

    @Test
    @DisplayName("treats a missing categoryId as the overall monthly budget")
    void treatsMissingCategoryAsOverallBudget() {
        when(budgetMapper.findByUserIdCategoryAndPeriod(USER_ID, null, 2026, 1, "USD")).thenReturn(null);
        when(budgetMapper.insert(any())).thenAnswer(invocation -> {
            invocation.<Budget>getArgument(0).setId(BUDGET_ID);
            return 1;
        });
        when(budgetMapper.findById(BUDGET_ID)).thenReturn(budget(BUDGET_ID, USER_ID, null));

        budgetService.upsert(USER_ID, BudgetRequest.builder()
                .monthlyLimit(new BigDecimal("2500.00"))
                .month(1)
                .year(2026)
                .build());

        verify(categoryMapper, never()).findById(any());
        verify(budgetMapper).findByUserIdCategoryAndPeriod(USER_ID, null, 2026, 1, "USD");
    }

    @Test
    @DisplayName("refuses a category owned by another user")
    void refusesForeignCategory() {
        when(categoryMapper.findById(CATEGORY_ID)).thenReturn(category(CATEGORY_ID, OTHER_USER_ID, "Groceries"));

        assertThatThrownBy(() -> budgetService.upsert(USER_ID, BudgetRequest.builder()
                .categoryId(CATEGORY_ID.toString())
                .monthlyLimit(BigDecimal.TEN)
                .month(1)
                .year(2026)
                .build())).isInstanceOf(ResourceNotFoundException.class);
        verify(budgetMapper, never()).insert(any());
    }

    @Test
    @DisplayName("rejects a month that does not exist")
    void rejectsImpossiblePeriod() {
        assertThatThrownBy(() -> budgetService.list(USER_ID, 2026, 13))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("do not form a valid month");
        verify(budgetMapper, never()).findByUserIdAndPeriod(any(), anyInt(), anyInt());
    }

    @Test
    @DisplayName("flags an exceeded budget for the progress bar")
    void flagsExceededBudget() {
        BudgetUsage usage = BudgetUsage.builder()
                .budget(budget(BUDGET_ID, USER_ID, CATEGORY_ID))
                .spentAmount(new BigDecimal("500.00"))
                .expenseCount(12L)
                .remainingAmount(new BigDecimal("-100.00"))
                .usagePercentage(new BigDecimal("125.00"))
                .build();
        when(budgetMapper.getBudgetUsage(USER_ID, 2026, 1)).thenReturn(List.of(usage));

        List<BudgetUsageResponse> responses =
                budgetService.usage(USER_ID, 2026, 1).getData();

        assertThat(responses).hasSize(1);
        assertThat(responses.getFirst().getExceeded()).isTrue();
        assertThat(responses.getFirst().getUsagePercentage()).isEqualByComparingTo("125.00");
        assertThat(responses.getFirst().getRemainingAmount()).isEqualByComparingTo("-100.00");
    }

    @Test
    @DisplayName("does not flag a budget that is still within its limit")
    void doesNotFlagHealthyBudget() {
        BudgetUsage usage = BudgetUsage.builder()
                .budget(budget(BUDGET_ID, USER_ID, CATEGORY_ID))
                .spentAmount(new BigDecimal("100.00"))
                .usagePercentage(new BigDecimal("25.00"))
                .build();
        when(budgetMapper.getBudgetUsage(USER_ID, 2026, 1)).thenReturn(List.of(usage));

        assertThat(budgetService.usage(USER_ID, 2026, 1).getData().getFirst().getExceeded()).isFalse();
    }

    @Test
    @DisplayName("hides budgets of other users behind a 404")
    void hidesForeignBudget() {
        when(budgetMapper.findById(BUDGET_ID)).thenReturn(budget(BUDGET_ID, OTHER_USER_ID, null));

        assertThatThrownBy(() -> budgetService.delete(USER_ID, BUDGET_ID))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(budgetMapper, never()).deleteById(any());
    }

    @Test
    @DisplayName("moves an existing budget to another month")
    void updatesPeriod() {
        Budget existing = budget(BUDGET_ID, USER_ID, CATEGORY_ID);
        when(budgetMapper.findById(BUDGET_ID)).thenReturn(existing, existing);

        budgetService.update(USER_ID, BUDGET_ID, BudgetRequest.builder()
                .monthlyLimit(new BigDecimal("600.00"))
                .month(3)
                .year(2026)
                .build());

        assertThat(existing.getMonth()).isEqualTo(3);
        assertThat(existing.getMonthlyLimit()).isEqualByComparingTo("600.00");
        verify(budgetMapper).update(eq(existing));
    }
}
