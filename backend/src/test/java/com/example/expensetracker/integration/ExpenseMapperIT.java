package com.example.expensetracker.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.example.expensetracker.domain.Budget;
import com.example.expensetracker.domain.BudgetUsage;
import com.example.expensetracker.domain.Category;
import com.example.expensetracker.domain.CategoryStat;
import com.example.expensetracker.domain.Expense;
import com.example.expensetracker.domain.ExpenseSummary;
import com.example.expensetracker.domain.PaymentMethod;
import com.example.expensetracker.domain.User;
import com.example.expensetracker.dto.request.ExpenseFilterRequest;
import com.example.expensetracker.mapper.BudgetMapper;
import com.example.expensetracker.mapper.CategoryMapper;
import com.example.expensetracker.mapper.ExpenseMapper;
import com.example.expensetracker.mapper.UserMapper;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * Verifies the XML mappers against a real PostgreSQL 16 database. This is where
 * the dynamic SQL, the {@code <resultMap>} associations, the PostgreSQL specific
 * types ({@code uuid}, {@code timestamptz}, {@code text[]}, {@code numeric}) and
 * the DATE_TRUNC / LATERAL joins are actually proven to work.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
@Transactional
@Tag("integration")
class ExpenseMapperIT extends AbstractPostgresIT {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private CategoryMapper categoryMapper;

    @Autowired
    private ExpenseMapper expenseMapper;

    @Autowired
    private BudgetMapper budgetMapper;

    private UUID userId;
    private UUID otherUserId;
    private UUID groceriesId;
    private UUID diningId;

    @BeforeEach
    void setUp() {
        userId = insertUser("mapper-it");
        otherUserId = insertUser("mapper-it-other");

        groceriesId = insertCategory("Groceries");
        diningId = insertCategory("Dining");
    }

    // ===================== UserMapper =====================

    @Test
    @DisplayName("inserts a user and reads the roles back as a List<String>")
    void insertsAndReadsUser() {
        User stored = userMapper.findByUsername("mapper-it");

        assertThat(stored.getId()).isEqualTo(userId);
        assertThat(stored.getRoles()).containsExactly("USER");
        assertThat(stored.getEnabled()).isTrue();
        assertThat(stored.getCreatedAt()).isNotNull();
        assertThat(stored.getUpdatedAt()).isNotNull();
    }

    @Test
    @DisplayName("finds a user by e-mail case-insensitively and updates it")
    void updatesUser() {
        User stored = userMapper.findByEmail("MAPPER-IT@EXAMPLE.COM");
        assertThat(stored).isNotNull();

        stored.setFullName("Updated Name");
        stored.setRoles(List.of("USER", "ADMIN"));
        assertThat(userMapper.update(stored)).isEqualTo(1);

        User reloaded = userMapper.findById(userId);
        assertThat(reloaded.getFullName()).isEqualTo("Updated Name");
        assertThat(reloaded.getRoles()).containsExactly("USER", "ADMIN");
    }

    @Test
    @DisplayName("pages the admin listing together with its count")
    void pagesUsers() {
        long total = userMapper.countAll("mapper-it");
        List<User> page = userMapper.findAll("mapper-it", 0, 10);

        assertThat(total).isPositive();
        assertThat(page).hasSize((int) total);
        assertThat(userMapper.findAll("no-such-user", 0, 10)).isEmpty();
        assertThat(userMapper.countAll("no-such-user")).isZero();
    }

    @Test
    @DisplayName("counts enabled accounts holding a role, ignoring the excluded one")
    void countsEnabledByRole() {
        // the V3 migration seeds exactly one enabled super administrator
        assertThat(userMapper.countEnabledByRole("SUPER_ADMIN", null)).isEqualTo(1);

        // promote the test account, then it counts as a second super admin
        User stored = userMapper.findById(userId);
        stored.setRoles(List.of("SUPER_ADMIN", "ADMIN", "USER"));
        userMapper.update(stored);
        assertThat(userMapper.countEnabledByRole("SUPER_ADMIN", null)).isEqualTo(2);
        // excluding it leaves only the seeded account
        assertThat(userMapper.countEnabledByRole("SUPER_ADMIN", userId)).isEqualTo(1);

        // a disabled account no longer protects the installation
        stored.setEnabled(false);
        userMapper.update(stored);
        assertThat(userMapper.countEnabledByRole("SUPER_ADMIN", null)).isEqualTo(1);
    }

    @Test
    @DisplayName("matches a role exactly, not as a prefix of another")
    void countsRoleExactly() {
        User stored = userMapper.findById(userId);
        stored.setRoles(List.of("USER"));
        userMapper.update(stored);

        // 'USER' must not be found inside a longer role name
        assertThat(userMapper.countEnabledByRole("USE", null)).isZero();
        assertThat(userMapper.countEnabledByRole("USER", userId)).isZero();
    }

    @Test
    @DisplayName("seeds the super administrator account from the V3 migration")
    void seedsSuperAdmin() {
        User root = userMapper.findByUsername("root");

        assertThat(root).isNotNull();
        assertThat(root.getRoles()).contains("SUPER_ADMIN", "ADMIN", "USER");
        assertThat(root.getEnabled()).isTrue();
        // and it got the starter categories like every other account
        assertThat(categoryMapper.findAllByUserId(root.getId())).hasSize(8);
    }

    // ===================== CategoryMapper =====================

    @Test
    @DisplayName("counts the expenses of a category in a single query")
    void countsExpensesPerCategory() {
        insertExpense(new BigDecimal("10.00"), LocalDate.of(2026, 3, 1), groceriesId, PaymentMethod.CASH);
        insertExpense(new BigDecimal("20.00"), LocalDate.of(2026, 3, 2), groceriesId, PaymentMethod.CASH);
        insertExpense(new BigDecimal("30.00"), LocalDate.of(2026, 3, 3), diningId, PaymentMethod.E_WALLET);

        List<Category> categories = categoryMapper.findAllByUserIdWithExpenseCount(userId);

        assertThat(categories).hasSize(2);
        assertThat(categories).filteredOn(c -> "Groceries".equals(c.getName()))
                .singleElement()
                .extracting(Category::getExpenseCount)
                .isEqualTo(2L);
        assertThat(categoryMapper.countExpensesByCategoryId(diningId)).isEqualTo(1L);
    }

    @Test
    @DisplayName("finds a category by name regardless of case")
    void findsCategoryByNameIgnoringCase() {
        assertThat(categoryMapper.findByNameAndUserId("gRoCeRiEs", userId)).isNotNull();
        assertThat(categoryMapper.findByNameAndUserId("Groceries", otherUserId)).isNull();
    }

    // ===================== ExpenseMapper =====================

    @Test
    @DisplayName("round-trips the text[] tag column")
    void roundTripsTags() {
        UUID id = insertExpense(new BigDecimal("42.00"), LocalDate.of(2026, 3, 5), groceriesId,
                PaymentMethod.CREDIT_CARD, List.of("weekly", "food"));

        Expense stored = expenseMapper.findById(id);

        assertThat(stored.getTags()).containsExactly("weekly", "food");
    }

    @Test
    @DisplayName("stores an empty tag list as an empty array, never NULL")
    void storesEmptyTags() {
        UUID id = insertExpense(new BigDecimal("1.00"), LocalDate.of(2026, 3, 5), groceriesId,
                PaymentMethod.CASH, List.of());

        assertThat(expenseMapper.findById(id).getTags()).isEmpty();
    }

    @Test
    @DisplayName("populates the nested category through the association mapping")
    void mapsNestedCategory() {
        UUID id = insertExpense(new BigDecimal("15.50"), LocalDate.of(2026, 3, 6), diningId, PaymentMethod.DEBIT_CARD);

        Expense stored = expenseMapper.findByIdAndUserId(id, userId);

        assertThat(stored.getCategory()).isNotNull();
        assertThat(stored.getCategory().getName()).isEqualTo("Dining");
        assertThat(stored.getCategory().getColorHex()).isEqualTo("#f59e0b");
        assertThat(stored.getCategory().getIconName()).isEqualTo("UtensilsCrossed");
    }

    @Test
    @DisplayName("leaves the nested category null for an uncategorised expense")
    void leavesCategoryNull() {
        UUID id = insertExpense(new BigDecimal("5.00"), LocalDate.of(2026, 3, 6), null, PaymentMethod.OTHER);

        Expense stored = expenseMapper.findById(id);

        assertThat(stored.getCategoryId()).isNull();
        assertThat(stored.getCategory()).isNull();
    }

    @Test
    @DisplayName("applies every dynamic filter of findByFilters / countByFilters")
    void appliesDynamicFilters() {
        UUID groceries = groceriesId;
        insertExpense(new BigDecimal("15.00"), LocalDate.of(2026, 1, 10), groceries, PaymentMethod.CASH);
        insertExpense(new BigDecimal("25.00"), LocalDate.of(2026, 1, 20), groceries, PaymentMethod.CREDIT_CARD);
        insertExpense(new BigDecimal("35.00"), LocalDate.of(2026, 2, 5), diningId, PaymentMethod.E_WALLET);
        insertExpense(new BigDecimal("45.00"), LocalDate.of(2026, 2, 15), diningId, PaymentMethod.CASH);

        // <if> on fromDate
        assertThat(count(null, null, LocalDate.of(2026, 2, 1), null, null, null)).isEqualTo(2);
        // <if> on minAmount / maxAmount
        assertThat(count(null, null, null, new BigDecimal("20"), new BigDecimal("40"), null)).isEqualTo(2);
        // <if> on categoryId (cast from the String filter value)
        assertThat(count(groceries, null, null, null, null, null)).isEqualTo(2);
        // <if> + <foreach> on the payment method list
        assertThat(count(null, null, null, null, null,
                List.of(PaymentMethod.CASH, PaymentMethod.CREDIT_CARD))).isEqualTo(3);
        // <if> on search, no match here
        assertThat(count(null, "January", null, null, null, null)).isZero();
        // all predicates combined with AND
        assertThat(count(groceries, null, LocalDate.of(2026, 1, 1), new BigDecimal("20"), new BigDecimal("40"),
                List.of(PaymentMethod.CREDIT_CARD))).isEqualTo(1);
        // no predicate at all
        assertThat(count(null, null, null, null, null, null)).isEqualTo(4);
    }

    @Test
    @DisplayName("searches the description case-insensitively")
    void searchesDescription() {
        Expense expense = Expense.builder()
                .amount(new BigDecimal("9.99"))
                .currency("USD")
                .description("Weekly GROCERIES run")
                .expenseDate(LocalDate.of(2026, 3, 1))
                .paymentMethod(PaymentMethod.CASH)
                .categoryId(groceriesId)
                .userId(userId)
                .tags(List.of())
                .build();
        expenseMapper.insert(expense);

        assertThat(count(null, "groceries", null, null, null, null)).isEqualTo(1);
    }

    @Test
    @DisplayName("never returns the expenses of another user")
    void enforcesTenantBoundary() {
        UUID foreign = insertExpenseFor(otherUserId, new BigDecimal("99.00"), LocalDate.of(2026, 3, 1), groceriesId);

        assertThat(expenseMapper.findByIdAndUserId(foreign, userId)).isNull();
        assertThat(count(null, null, null, null, null, null)).isZero();
        assertThat(expenseMapper.findByFilters(otherUserId, new ExpenseFilterRequest(), 0, 10,
                "expenseDate", "DESC")).hasSize(1);
    }

    @Test
    @DisplayName("paginates and sorts with a whitelisted column")
    void paginatesAndSorts() {
        insertExpense(new BigDecimal("30.00"), LocalDate.of(2026, 1, 3), groceriesId, PaymentMethod.CASH);
        insertExpense(new BigDecimal("10.00"), LocalDate.of(2026, 1, 1), groceriesId, PaymentMethod.CASH);
        insertExpense(new BigDecimal("20.00"), LocalDate.of(2026, 1, 2), groceriesId, PaymentMethod.CASH);

        List<Expense> ascending = expenseMapper.findByFilters(userId, new ExpenseFilterRequest(), 0, 10,
                "amount", "ASC");
        assertThat(ascending).extracting(Expense::getAmount)
                .containsExactly(new BigDecimal("10.00"), new BigDecimal("20.00"), new BigDecimal("30.00"));

        List<Expense> firstPage = expenseMapper.findByFilters(userId, new ExpenseFilterRequest(), 0, 2,
                "amount", "ASC");
        List<Expense> secondPage = expenseMapper.findByFilters(userId, new ExpenseFilterRequest(), 2, 2,
                "amount", "ASC");
        assertThat(firstPage).hasSize(2);
        assertThat(secondPage).hasSize(1);
        assertThat(firstPage).doesNotContainAnyElementsOf(secondPage);
    }

    @Test
    @DisplayName("falls back to expenseDate for an unknown sort column")
    void unknownSortColumnFallsBack() {
        insertExpense(new BigDecimal("30.00"), LocalDate.of(2026, 1, 3), groceriesId, PaymentMethod.CASH);
        insertExpense(new BigDecimal("10.00"), LocalDate.of(2026, 1, 1), groceriesId, PaymentMethod.CASH);

        // the malicious column name is replaced by the default, the direction is kept
        List<Expense> sorted = expenseMapper.findByFilters(userId, new ExpenseFilterRequest(), 0, 10,
                "amount; DROP TABLE expenses", "ASC");

        assertThat(sorted).extracting(Expense::getExpenseDate)
                .containsExactly(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 3));
    }

    @Test
    @DisplayName("aggregates per day, week and month with DATE_TRUNC")
    void aggregatesByPeriod() {
        // two expenses on the same day so the daily bucket has to aggregate them
        insertExpense(new BigDecimal("10.00"), LocalDate.of(2026, 1, 5), groceriesId, PaymentMethod.CASH);
        insertExpense(new BigDecimal("20.00"), LocalDate.of(2026, 1, 5), groceriesId, PaymentMethod.CASH);
        insertExpense(new BigDecimal("30.00"), LocalDate.of(2026, 2, 2), diningId, PaymentMethod.CASH);

        List<ExpenseSummary> daily = expenseMapper.sumByPeriod(userId, "day",
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31), null, null);
        assertThat(daily).hasSize(1);
        assertThat(daily.getFirst().getPeriodStart()).isEqualTo(LocalDate.of(2026, 1, 5));
        assertThat(daily.getFirst().getTotalAmount()).isEqualByComparingTo("30.00");
        assertThat(daily.getFirst().getExpenseCount()).isEqualTo(2L);
        assertThat(daily.getFirst().getAverageAmount()).isEqualByComparingTo("15.00");

        List<ExpenseSummary> monthly = expenseMapper.sumByPeriod(userId, "month",
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 2, 28), null, null);
        assertThat(monthly).extracting(ExpenseSummary::getPeriodStart)
                .containsExactly(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 2, 1));

        // the <choose> branch for week granularity
        assertThat(expenseMapper.sumByPeriod(userId, "week", LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 2, 28), null, null)).isNotEmpty();
    }

    @Test
    @DisplayName("restricts the aggregation by payment method")
    void aggregatesWithPaymentMethodFilter() {
        insertExpense(new BigDecimal("10.00"), LocalDate.of(2026, 1, 5), groceriesId, PaymentMethod.CASH);
        insertExpense(new BigDecimal("20.00"), LocalDate.of(2026, 1, 6), groceriesId, PaymentMethod.E_WALLET);

        List<ExpenseSummary> cashOnly = expenseMapper.sumByPeriod(userId, "month",
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31), null, PaymentMethod.CASH);

        assertThat(cashOnly).singleElement()
                .satisfies(summary -> assertThat(summary.getTotalAmount()).isEqualByComparingTo("10.00"));
    }

    @Test
    @DisplayName("computes per-category totals and percentage shares")
    void computesCategoryStats() {
        insertExpense(new BigDecimal("75.00"), LocalDate.of(2026, 1, 5), groceriesId, PaymentMethod.CASH);
        insertExpense(new BigDecimal("25.00"), LocalDate.of(2026, 1, 6), diningId, PaymentMethod.CASH);

        List<CategoryStat> stats = expenseMapper.statsByCategory(userId,
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31));

        assertThat(stats).hasSize(2);
        assertThat(stats.getFirst().getCategoryName()).isEqualTo("Groceries");
        assertThat(stats.getFirst().getTotalAmount()).isEqualByComparingTo("75.00");
        assertThat(stats.getFirst().getPercentage()).isEqualByComparingTo("75.00");
        assertThat(stats.get(1).getPercentage()).isEqualByComparingTo("25.00");
        assertThat(stats.get(1).getAverageAmount()).isEqualByComparingTo("25.00");
    }

    @Test
    @DisplayName("groups uncategorised expenses under a synthetic row")
    void groupsUncategorisedExpenses() {
        insertExpense(new BigDecimal("10.00"), LocalDate.of(2026, 1, 5), null, PaymentMethod.OTHER);

        List<CategoryStat> stats = expenseMapper.statsByCategory(userId, null, null);

        assertThat(stats).singleElement().satisfies(stat -> {
            assertThat(stat.getCategoryName()).isEqualTo("Uncategorised");
            assertThat(stat.getPercentage()).isEqualByComparingTo("100.00");
        });
    }

    @Test
    @DisplayName("returns the newest expenses for the dashboard")
    void returnsRecentExpenses() {
        insertExpense(new BigDecimal("10.00"), LocalDate.of(2026, 1, 1), groceriesId, PaymentMethod.CASH);
        insertExpense(new BigDecimal("20.00"), LocalDate.of(2026, 3, 1), groceriesId, PaymentMethod.CASH);
        insertExpense(new BigDecimal("30.00"), LocalDate.of(2026, 2, 1), groceriesId, PaymentMethod.CASH);

        List<Expense> recent = expenseMapper.findRecentByUserId(userId, 2);

        assertThat(recent).hasSize(2);
        assertThat(recent.getFirst().getExpenseDate()).isEqualTo(LocalDate.of(2026, 3, 1));
    }

    @Test
    @DisplayName("updates only the non-null columns and clears the category on demand")
    void updatesExpense() {
        UUID id = insertExpense(new BigDecimal("10.00"), LocalDate.of(2026, 1, 1), groceriesId,
                PaymentMethod.CASH, List.of("a", "b"));

        Expense changes = new Expense();
        changes.setId(id);
        changes.setAmount(new BigDecimal("99.99"));
        assertThat(expenseMapper.update(changes)).isEqualTo(1);

        Expense stored = expenseMapper.findById(id);
        assertThat(stored.getAmount()).isEqualByComparingTo("99.99");
        // untouched columns keep their value
        assertThat(stored.getTags()).containsExactly("a", "b");
        assertThat(stored.getCategoryId()).isEqualTo(groceriesId);
        // the trigger refreshed updated_at; now() is transaction scoped, so the
        // value is identical to created_at inside one test transaction
        assertThat(stored.getUpdatedAt()).isAfterOrEqualTo(stored.getCreatedAt());

        assertThat(expenseMapper.detachCategory(id, userId)).isEqualTo(1);
        assertThat(expenseMapper.findById(id).getCategoryId()).isNull();
    }

    // ===================== BudgetMapper =====================

    @Test
    @DisplayName("joins budgets with the actual spend of the same period")
    void computesBudgetUsage() {
        insertExpense(new BigDecimal("30.00"), LocalDate.of(2026, 1, 5), groceriesId, PaymentMethod.CASH);
        insertExpense(new BigDecimal("20.00"), LocalDate.of(2026, 1, 6), groceriesId, PaymentMethod.CASH);
        // outside the budget period
        insertExpense(new BigDecimal("500.00"), LocalDate.of(2026, 2, 6), groceriesId, PaymentMethod.CASH);

        budgetMapper.insert(Budget.builder()
                .userId(userId)
                .categoryId(groceriesId)
                .monthlyLimit(new BigDecimal("100.00"))
                .month(1)
                .year(2026)
                .build());
        budgetMapper.insert(Budget.builder()
                .userId(userId)
                .categoryId(null)
                .monthlyLimit(new BigDecimal("200.00"))
                .month(1)
                .year(2026)
                .build());

        List<BudgetUsage> usages = budgetMapper.getBudgetUsage(userId, 2026, 1);

        assertThat(usages).hasSize(2);
        // the overall budget is listed first
        BudgetUsage overall = usages.getFirst();
        assertThat(overall.getBudget().getCategoryId()).isNull();
        assertThat(overall.getSpentAmount()).isEqualByComparingTo("50.00");
        assertThat(overall.getUsagePercentage()).isEqualByComparingTo("25.00");
        assertThat(overall.getRemainingAmount()).isEqualByComparingTo("150.00");

        BudgetUsage perCategory = usages.get(1);
        assertThat(perCategory.getBudget().getCategory().getName()).isEqualTo("Groceries");
        assertThat(perCategory.getSpentAmount()).isEqualByComparingTo("50.00");
        assertThat(perCategory.getExpenseCount()).isEqualTo(2L);
    }

    @Test
    @DisplayName("returns a zero-usage row for a budget without any expense")
    void returnsZeroUsageBudget() {
        budgetMapper.insert(Budget.builder()
                .userId(userId)
                .categoryId(diningId)
                .monthlyLimit(new BigDecimal("80.00"))
                .month(5)
                .year(2026)
                .build());

        List<BudgetUsage> usages = budgetMapper.getBudgetUsage(userId, 2026, 5);

        assertThat(usages).singleElement().satisfies(usage -> {
            assertThat(usage.getSpentAmount()).isEqualByComparingTo("0");
            assertThat(usage.getUsagePercentage()).isEqualByComparingTo("0.00");
            assertThat(usage.getRemainingAmount()).isEqualByComparingTo("80.00");
        });
    }

    @Test
    @DisplayName("finds the overall budget and a category budget separately")
    void findsBudgetByPeriod() {
        budgetMapper.insert(Budget.builder().userId(userId).categoryId(null)
                .monthlyLimit(new BigDecimal("200.00")).month(1).year(2026).build());
        budgetMapper.insert(Budget.builder().userId(userId).categoryId(groceriesId)
                .monthlyLimit(new BigDecimal("100.00")).month(1).year(2026).build());

        assertThat(budgetMapper.findByUserIdCategoryAndPeriod(userId, null, 2026, 1)).isNotNull();
        assertThat(budgetMapper.findByUserIdCategoryAndPeriod(userId, groceriesId, 2026, 1)).isNotNull();
        assertThat(budgetMapper.findByUserIdCategoryAndPeriod(userId, diningId, 2026, 1)).isNull();
        assertThat(budgetMapper.findByUserIdAndPeriod(userId, 2026, 1)).hasSize(2);
    }

    @Test
    @DisplayName("deletes a budget and a category cleanly")
    void deletesRows() {
        budgetMapper.insert(Budget.builder().userId(userId).categoryId(diningId)
                .monthlyLimit(new BigDecimal("50.00")).month(4).year(2026).build());
        assertThat(budgetMapper.findByUserIdAndPeriod(userId, 2026, 4)).hasSize(1);

        assertThat(budgetMapper.deleteById(budgetMapper.findByUserIdAndPeriod(userId, 2026, 4)
                .getFirst().getId())).isEqualTo(1);

        // deleting a category with expenses keeps them but un-categorises them
        UUID expenseId = insertExpense(new BigDecimal("11.00"), LocalDate.of(2026, 1, 1), diningId,
                PaymentMethod.CASH);
        assertThat(categoryMapper.deleteById(diningId)).isEqualTo(1);
        assertThat(expenseMapper.findById(expenseId)).isNotNull();
        assertThat(expenseMapper.findById(expenseId).getCategoryId()).isNull();
    }

    // ===================== helpers =====================

    private long count(UUID categoryId, String search, LocalDate from, BigDecimal min, BigDecimal max,
                       List<PaymentMethod> methods) {
        ExpenseFilterRequest filter = ExpenseFilterRequest.builder()
                .categoryId(categoryId == null ? null : categoryId.toString())
                .search(search)
                .fromDate(from)
                .toDate(null)
                .minAmount(min)
                .maxAmount(max)
                .paymentMethods(methods)
                .build();
        return expenseMapper.countByFilters(userId, filter);
    }

    private UUID insertUser(String username) {
        User user = User.builder()
                .username(username)
                .email(username + "@example.com")
                .password("$2a$10$abcdefghijklmnopqrstuv")
                .fullName(username)
                .roles(List.of("USER"))
                .enabled(true)
                .build();
        userMapper.insert(user);
        return user.getId();
    }

    private UUID insertCategory(String name) {
        Category category = Category.builder()
                .name(name)
                .description(name + " description")
                .iconName("Groceries".equals(name) ? "ShoppingCart" : "UtensilsCrossed")
                .colorHex("Groceries".equals(name) ? "#22c55e" : "#f59e0b")
                .userId(userId)
                .build();
        categoryMapper.insert(category);
        return category.getId();
    }

    private UUID insertExpense(BigDecimal amount, LocalDate date, UUID categoryId, PaymentMethod method) {
        return insertExpense(amount, date, categoryId, method, List.of());
    }

    private UUID insertExpense(BigDecimal amount, LocalDate date, UUID categoryId, PaymentMethod method,
                               List<String> tags) {
        return insertExpenseFor(userId, amount, date, categoryId, method, tags);
    }

    private UUID insertExpenseFor(UUID ownerId, BigDecimal amount, LocalDate date, UUID categoryId) {
        return insertExpenseFor(ownerId, amount, date, categoryId, PaymentMethod.CASH, List.of());
    }

    private UUID insertExpenseFor(UUID ownerId, BigDecimal amount, LocalDate date, UUID categoryId,
                                  PaymentMethod method) {
        return insertExpenseFor(ownerId, amount, date, categoryId, method, List.of());
    }

    private UUID insertExpenseFor(UUID ownerId, BigDecimal amount, LocalDate date, UUID categoryId,
                                  PaymentMethod method, List<String> tags) {
        Expense expense = Expense.builder()
                .amount(amount)
                .currency("USD")
                .description("Expense on " + date)
                .expenseDate(date)
                .paymentMethod(method)
                .categoryId(categoryId)
                .userId(ownerId)
                .tags(tags)
                .build();
        expenseMapper.insert(expense);
        return expense.getId();
    }
}
