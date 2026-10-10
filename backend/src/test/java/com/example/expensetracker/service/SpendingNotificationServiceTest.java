package com.example.expensetracker.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import com.example.expensetracker.config.TelegramProperties;
import com.example.expensetracker.domain.*;
import com.example.expensetracker.mapper.BudgetMapper;
import com.example.expensetracker.mapper.TelegramMapper;
import com.example.expensetracker.mapper.UserMapper;
import com.example.expensetracker.serviceImpl.SpendingNotificationServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class SpendingNotificationServiceTest {
    final UUID user = UUID.randomUUID();
    BudgetMapper budgets;
    TelegramMapper telegram;
    UserMapper users;
    SpendingNotificationServiceImpl service;

    @BeforeEach void setUp() {
        budgets = mock(BudgetMapper.class);
        telegram = mock(TelegramMapper.class);
        users = mock(UserMapper.class);
        when(users.findById(user)).thenReturn(User.builder().id(user).username("nang")
                .fullName("Nang Dalet").build());
        var properties = new TelegramProperties();
        properties.setEnabled(true);
        properties.setBotToken("test-token");
        properties.setBotUsername("test_bot");
        properties.setWebhookSecret("test-webhook-secret-12345");
        service = new SpendingNotificationServiceImpl(budgets, telegram, properties, users);
        var connection = new TelegramConnection();
        connection.setChatId(424242L);
        connection.setEnabled(true);
        when(telegram.find(user)).thenReturn(connection);
    }

    BudgetUsage usage(String currency, String limit, String spent) {
        return BudgetUsage.builder().budget(Budget.builder().id(UUID.randomUUID()).userId(user)
                .currency(currency).monthlyLimit(new BigDecimal(limit)).year(2026).month(10).build())
                .spentAmount(new BigDecimal(spent)).build();
    }

    @Test void receiptShowsMatchingBudgetTotalWithoutMixingCurrencies() {
        when(budgets.getBudgetUsage(user, 2026, 10)).thenReturn(List.of(
                usage("USD", "100", "79.99"), usage("KHR", "10000", "4500")));
        var expense = Expense.builder().id(UUID.randomUUID()).userId(user).currency("USD")
                .amount(new BigDecimal("2")).expenseDate(LocalDate.of(2026, 10, 10))
                .description("Lunch អាហារ").build();
        service.expenseCreated(expense);
        var message = ArgumentCaptor.forClass(String.class);
        verify(telegram).enqueue(eq(user), eq(424242L), eq("expense:" + expense.getId()), message.capture());
        assertThat(message.getValue()).contains("📊 Daily Expense Tracker", "👤 User: Nang Dalet", "✅ Expense Recorded",
                "Amount: USD 2.00", "Lunch អាហារ", "Budget limit: USD 100.00",
                "Total spent: USD 79.99", "Remaining: USD 20.01", "Used: 79.99%")
                .doesNotContain("KHR", "Budget Alert");
        verify(telegram, times(1)).enqueue(any(), anyLong(), anyString(), anyString());
    }

    @Test void thresholdAlertIncludesLimitTotalRemainingAndStableEventKey() {
        var item = usage("USD", "100", "90.48");
        when(budgets.getBudgetUsage(user, 2026, 10)).thenReturn(List.of(item));
        service.checkBudgets(user, 2026, 10);
        var message = ArgumentCaptor.forClass(String.class);
        verify(telegram).enqueue(eq(user), eq(424242L),
                eq("budget80:" + item.getBudget().getId() + ":2026:10:USD"), message.capture());
        assertThat(message.getValue()).contains("👤 User: Nang Dalet", "⚠️ Budget Alert: 80% reached", "Budget: Overall budget",
                "Period: 2026-10", "Budget limit: USD 100.00", "Total spent: USD 90.48",
                "Remaining: USD 9.52", "Used: 90.48%");
    }

    @Test void exceededBudgetShowsPositiveOverageInItsOwnCurrency() {
        when(budgets.getBudgetUsage(user, 2026, 10)).thenReturn(List.of(usage("KHR", "10000", "12500")));
        service.checkBudgets(user, 2026, 10);
        var message = ArgumentCaptor.forClass(String.class);
        verify(telegram).enqueue(eq(user), eq(424242L), startsWith("budget80:"), message.capture());
        assertThat(message.getValue()).contains("Budget limit: KHR 10000.00", "Total spent: KHR 12500.00",
                "Over budget: KHR 2500.00", "Used: 125.00%").doesNotContain("Remaining:", "USD");
    }

    @Test void missingFullNameUsesOnlyTheExpenseOwnersUsername() {
        when(users.findById(user)).thenReturn(User.builder().id(user).username("lyza")
                .fullName("  ").build());
        when(budgets.getBudgetUsage(user, 2026, 10)).thenReturn(List.of(usage("USD", "100", "80")));
        service.checkBudgets(user, 2026, 10);
        var message = ArgumentCaptor.forClass(String.class);
        verify(telegram).enqueue(eq(user), eq(424242L), startsWith("budget80:"), message.capture());
        assertThat(message.getValue()).contains("👤 User: lyza").doesNotContain("Nang Dalet");
    }

    @Test void khmerNameIsPreservedAndKeptOnOneLine() {
        when(users.findById(user)).thenReturn(User.builder().id(user).username("nang")
                .fullName("  ណាង\nដាលែត  ").build());
        when(budgets.getBudgetUsage(user, 2026, 10)).thenReturn(List.of(usage("USD", "100", "80")));
        service.checkBudgets(user, 2026, 10);
        var message = ArgumentCaptor.forClass(String.class);
        verify(telegram).enqueue(eq(user), eq(424242L), startsWith("budget80:"), message.capture());
        assertThat(message.getValue()).contains("👤 User: ណាង ដាលែត\n\n⚠️");
    }
}
