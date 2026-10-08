package com.example.expensetracker.support;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.example.expensetracker.convert.BudgetConvert;
import com.example.expensetracker.convert.BudgetConvertImpl;
import com.example.expensetracker.convert.CategoryConvert;
import com.example.expensetracker.convert.CategoryConvertImpl;
import com.example.expensetracker.convert.ExpenseConvert;
import com.example.expensetracker.convert.ExpenseConvertImpl;
import com.example.expensetracker.convert.UserConvert;
import com.example.expensetracker.convert.UserConvertImpl;
import com.example.expensetracker.domain.Budget;
import com.example.expensetracker.domain.Category;
import com.example.expensetracker.domain.Expense;
import com.example.expensetracker.domain.PaymentMethod;
import com.example.expensetracker.domain.Role;
import com.example.expensetracker.domain.User;
import com.example.expensetracker.mapper.CategoryMapper;
import com.example.expensetracker.service.DefaultCategorySeeder;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Shared fixtures for the unit tests.
 * <p>
 * The MapStruct implementations are used for real (instead of mocks) so the
 * tests also assert the actual DTO mapping; only their collaborators have to be
 * injected, which {@link ReflectionTestUtils} does without a Spring context.
 */
public final class TestFixtures {

    public static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    public static final UUID OTHER_USER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    public static final UUID CATEGORY_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
    public static final UUID EXPENSE_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");

    private TestFixtures() {
    }

    // ===================== Real MapStruct implementations =====================

    public static CategoryConvert categoryConvert() {
        return new CategoryConvertImpl();
    }

    public static ExpenseConvert expenseConvert() {
        ExpenseConvertImpl convert = new ExpenseConvertImpl();
        ReflectionTestUtils.setField(convert, "categoryConvert", new CategoryConvertImpl());
        return convert;
    }

    public static BudgetConvert budgetConvert() {
        BudgetConvertImpl convert = new BudgetConvertImpl();
        ReflectionTestUtils.setField(convert, "categoryConvert", new CategoryConvertImpl());
        return convert;
    }

    public static UserConvert userConvert() {
        return new UserConvertImpl();
    }

    /** Real seeder over a mock mapper, so the test can count the inserts. */
    public static DefaultCategorySeeder defaultCategorySeeder(CategoryMapper categoryMapper) {
        return new DefaultCategorySeeder(categoryMapper);
    }

    // ===================== Domain builders =====================

    public static User user(UUID id, String username) {
        return user(id, username, Role.USER);
    }

    /** Account whose highest role is {@code role}. */
    public static User user(UUID id, String username, Role role) {
        return user(id, username, List.of(Role.USER.name(), role.name()));
    }

    public static User user(UUID id, String username, List<String> roles) {
        return User.builder()
                .id(id)
                .username(username)
                .email(username + "@example.com")
                .password("$2a$10$abcdefghijklmnopqrstuv")
                .fullName("Test User")
                .roles(roles)
                .enabled(true)
                .createdAt(OffsetDateTime.parse("2026-01-01T10:00:00Z"))
                .updatedAt(OffsetDateTime.parse("2026-01-01T10:00:00Z"))
                .build();
    }

    public static Category category(UUID id, UUID userId, String name) {
        return Category.builder()
                .id(id)
                .name(name)
                .description(name + " description")
                .iconName("Tag")
                .colorHex("#22c55e")
                .userId(userId)
                .createdAt(OffsetDateTime.parse("2026-01-01T10:00:00Z"))
                .updatedAt(OffsetDateTime.parse("2026-01-01T10:00:00Z"))
                .build();
    }

    public static Expense expense(UUID id, UUID userId, BigDecimal amount) {
        return Expense.builder()
                .id(id)
                .amount(amount)
                .currency("USD")
                .description("Test expense")
                .expenseDate(LocalDate.of(2026, 1, 15))
                .paymentMethod(PaymentMethod.CREDIT_CARD)
                .userId(userId)
                .tags(List.of("test"))
                .createdAt(OffsetDateTime.parse("2026-01-15T10:00:00Z"))
                .updatedAt(OffsetDateTime.parse("2026-01-15T10:00:00Z"))
                .build();
    }

    public static Budget budget(UUID id, UUID userId, UUID categoryId) {
        return Budget.builder()
                .id(id)
                .userId(userId)
                .categoryId(categoryId)
                .monthlyLimit(new BigDecimal("400.00"))
                .month(1)
                .year(2026)
                .build();
    }

    // ===================== Pageable helpers =====================

    public static Pageable pageable(int page, int size) {
        return PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "expenseDate"));
    }

    public static Pageable pageableSorted(String property, Sort.Direction direction) {
        return PageRequest.of(0, 20, Sort.by(direction, property));
    }
}
