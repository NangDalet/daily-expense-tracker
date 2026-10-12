package com.example.expensetracker.serviceImpl;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;
import com.example.expensetracker.config.TelegramProperties;
import com.example.expensetracker.domain.Expense;
import com.example.expensetracker.domain.BudgetUsage;
import com.example.expensetracker.mapper.BudgetMapper;
import com.example.expensetracker.mapper.TelegramMapper;
import com.example.expensetracker.mapper.UserMapper;
import com.example.expensetracker.service.SpendingNotificationService;
import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;
@Service @RequiredArgsConstructor
public class SpendingNotificationServiceImpl implements SpendingNotificationService {
    private final BudgetMapper budgets;
    private final TelegramMapper telegram;
    private final TelegramProperties properties;
    private final UserMapper users;
    @Override public void beforeChange(UUID userId) {
        // Serialize concurrent expense/budget writes before they read monthly usage.
        if (properties.isConfigured()) telegram.lockUser(userId);
    }
    @Override public void expenseCreated(Expense expense) {
        if (!properties.isConfigured()) return;
        var connection = telegram.find(expense.getUserId());
        if (connection == null || connection.getChatId() == null || !Boolean.TRUE.equals(connection.getEnabled())) return;
        var usage = budgets.getBudgetUsage(expense.getUserId(), expense.getExpenseDate().getYear(), expense.getExpenseDate().getMonthValue());
        var matching = usage.stream().filter(item -> item.getBudget().getCurrency().equals(expense.getCurrency())
                && (item.getBudget().getCategoryId() == null || item.getBudget().getCategoryId().equals(expense.getCategoryId()))).toList();
        // Spending notifications are threshold alerts, not per-expense receipts.
        for (var item : matching) alert(expense.getUserId(), connection.getChatId(), item);
    }
    @Override public void checkBudgets(UUID userId, int year, int month) {
        if (!properties.isConfigured()) return;
        var connection = telegram.find(userId);
        if (connection == null || connection.getChatId() == null || !Boolean.TRUE.equals(connection.getEnabled())) return;
        for (var item : budgets.getBudgetUsage(userId, year, month)) alert(userId, connection.getChatId(), item);
    }
    private void alert(UUID userId, long chatId, BudgetUsage item) {
        var budget = item.getBudget();
        if (budget.getMonthlyLimit().signum() <= 0
                || item.getSpentAmount().compareTo(budget.getMonthlyLimit().multiply(new BigDecimal("0.80"))) < 0) return;
        String key = "budget80:" + budget.getId() + ":" + budget.getYear() + ":" + budget.getMonth() + ":" + budget.getCurrency();
        telegram.enqueue(userId, chatId, key, "📊 Daily Expense Tracker\n\n"
                + recipient(userId) + "\n\n⚠️ Budget Alert: 80% reached\n\n" + budgetDetails(item)
                + "\n\n🔔 Review your spending to stay within your budget.");
    }
    private String budgetDetails(BudgetUsage item) {
        var budget = item.getBudget();
        String name = budget.getCategory() == null ? "Overall budget" : truncate(budget.getCategory().getName());
        var remaining = budget.getMonthlyLimit().subtract(item.getSpentAmount());
        var percentage = item.getSpentAmount().multiply(new BigDecimal("100"))
                .divide(budget.getMonthlyLimit(), 2, RoundingMode.HALF_UP);
        return "🎯 Budget: " + name
                + "\n📅 Period: " + budget.getYear() + "-" + String.format("%02d", budget.getMonth())
                + "\n💰 Budget limit: " + money(budget.getCurrency(), budget.getMonthlyLimit())
                + "\n📈 Total spent: " + money(budget.getCurrency(), item.getSpentAmount())
                + (remaining.signum() < 0 ? "\n🚨 Over budget: " : "\n💵 Remaining: ")
                + money(budget.getCurrency(), remaining.abs())
                + "\n📊 Used: " + percentage.toPlainString() + "%";
    }
    private String money(String currency, BigDecimal amount) {
        return currency + " " + amount.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }
    private String recipient(UUID userId) {
        var user = users.findById(userId);
        String name = user == null ? null : user.getFullName();
        if (name == null || name.isBlank()) name = user == null ? null : user.getUsername();
        if (name == null || name.isBlank()) name = "Account holder";
        return "👤 User: " + truncate(name.replaceAll("\\s+", " ").strip());
    }
    private String truncate(String text) { return text == null ? "" : text.codePoints().limit(500).collect(StringBuilder::new, StringBuilder::appendCodePoint, StringBuilder::append).toString(); }
}
