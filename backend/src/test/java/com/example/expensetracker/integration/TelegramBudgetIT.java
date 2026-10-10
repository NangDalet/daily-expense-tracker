package com.example.expensetracker.integration;

import static org.assertj.core.api.Assertions.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import com.example.expensetracker.config.PaginationProperties;
import com.example.expensetracker.config.TelegramProperties;
import com.example.expensetracker.convert.ExpenseConvert;
import com.example.expensetracker.domain.Budget;
import com.example.expensetracker.domain.PaymentMethod;
import com.example.expensetracker.dto.request.ExpenseRequest;
import com.example.expensetracker.exception.ApiException;
import com.example.expensetracker.mapper.*;
import com.example.expensetracker.serviceImpl.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest @ActiveProfiles("test") @Transactional @Tag("integration")
class TelegramBudgetIT extends AbstractPostgresIT {
    @Autowired TelegramMapper telegram;
    @Autowired BudgetMapper budgets;
    @Autowired ExpenseMapper expenses;
    @Autowired CategoryMapper categories;
    @Autowired ExpenseConvert convert;
    @Autowired JdbcTemplate jdbc;
    UUID user;
    TelegramServiceImpl links;
    ExpenseServiceImpl service;
    TelegramProperties properties;
    static final String SECRET = "test-webhook-secret-12345";
    static final String TOKEN = "A".repeat(43);
    @BeforeEach void setUp() {
        user = UUID.randomUUID();
        jdbc.update("INSERT INTO users(id,username,email,password) VALUES (?,?,?,?)", user, "tg-"+user, user+"@example.com", "hash");
        properties = new TelegramProperties();
        properties.setEnabled(true); properties.setBotUsername("test_expense_bot");
        properties.setBotToken("test-only-token"); properties.setWebhookSecret(SECRET);
        links = new TelegramServiceImpl(telegram, properties);
        service = new ExpenseServiceImpl(expenses, categories, convert, new PaginationProperties(),
                new SpendingNotificationServiceImpl(budgets, telegram, properties));
    }
    void connect() {
        telegram.setLink(user, TelegramServiceImpl.hash(TOKEN));
        links.accept(SECRET, 1L, 424242L, 424242L, "private", "/start " + TOKEN);
        telegram.clearPending(user);
    }
    void budget(String currency) {
        budgets.insert(Budget.builder().userId(user).currency(currency).monthlyLimit(new BigDecimal("100"))
                .year(2026).month(10).build());
    }
    void spend(String currency, String amount) {
        service.create(user, ExpenseRequest.builder().currency(currency).amount(new BigDecimal(amount))
                .expenseDate(LocalDate.of(2026,10,9)).paymentMethod(PaymentMethod.CASH).description("Lunch").build());
    }
    int count(String pattern) {
        return jdbc.queryForObject("SELECT count(*) FROM telegram_notifications WHERE user_id=? AND event_key LIKE ?", Integer.class, user, pattern);
    }
    @Test void currenciesStaySeparateAndAlertIsDeduplicatedAtExactThreshold() {
        connect(); budget("USD"); budget("KHR");
        spend("KHR","20"); spend("USD","79.99");
        assertThat(count("budget80:%")).isZero();
        spend("USD","0.01"); spend("USD","5");
        assertThat(count("expense:%")).isEqualTo(4);
        assertThat(count("budget80:%")).isEqualTo(1);
        var usage = budgets.getBudgetUsage(user,2026,10);
        assertThat(usage).filteredOn(x->x.getBudget().getCurrency().equals("USD")).singleElement()
                .satisfies(x->assertThat(x.getSpentAmount()).isEqualByComparingTo("85"));
        assertThat(usage).filteredOn(x->x.getBudget().getCurrency().equals("KHR")).singleElement()
                .satisfies(x->assertThat(x.getSpentAmount()).isEqualByComparingTo("20"));
    }
    @Test void expensesWithoutMatchingBudgetDoNotNotify() {
        connect(); budget("USD"); spend("KHR","10000");
        assertThat(count("%")).isZero();
    }
    @Test void overlappingBudgetsSendOneReceiptAndSeparateAlerts() {
        connect(); budget("USD");
        UUID category=UUID.randomUUID();
        jdbc.update("INSERT INTO categories(id,name,user_id) VALUES (?,?,?)", category, "Food", user);
        budgets.insert(Budget.builder().userId(user).categoryId(category).currency("USD").monthlyLimit(new BigDecimal("100"))
                .year(2026).month(10).build());
        service.create(user, ExpenseRequest.builder().currency("USD").amount(new BigDecimal("80"))
                .categoryId(category.toString()).expenseDate(LocalDate.of(2026,10,9)).paymentMethod(PaymentMethod.CASH).build());
        assertThat(count("expense:%")).isEqualTo(1);
        assertThat(count("budget80:%")).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM telegram_notifications WHERE user_id=? AND status='pending'",Integer.class,user)).isEqualTo(3);
    }
    @Test void unrelatedCurrencySpendingDoesNotTriggerExistingOverBudgetAlerts() {
        connect(); budget("USD");
        jdbc.update("INSERT INTO expenses(user_id,amount,currency,expense_date,payment_method) VALUES (?,?,?,?,?)",
                user,new BigDecimal("90"),"USD",LocalDate.of(2026,10,9),"CASH");
        spend("KHR","20000"); assertThat(count("%")).isZero();
    }
    @Test void webhookRejectsWrongSecretGroupsAndReplay() {
        telegram.setLink(user,TelegramServiceImpl.hash(TOKEN));
        assertThatThrownBy(()->links.accept("bad",1L,424242L,424242L,"private","/start "+TOKEN)).isInstanceOf(ApiException.class);
        links.accept(SECRET,1L,-123L,424242L,"group","/start "+TOKEN);
        assertThat(telegram.find(user).getChatId()).isNull();
        links.accept(SECRET,1L,424242L,424242L,"private","/start "+TOKEN);
        links.accept(SECRET,1L,424242L,424242L,"private","/start "+TOKEN);
        assertThat(telegram.find(user).getChatId()).isEqualTo(424242L);
        assertThat(count("linked:%")).isEqualTo(1);
    }
    @Test void expiredLinksDoNotConnectAndHashesHideTheToken() {
        var link = links.link(user);
        assertThat(link.url()).startsWith("https://t.me/test_expense_bot?start=");
        String token = link.url().substring(link.url().indexOf("start=")+6);
        assertThat(jdbc.queryForObject("SELECT link_hash FROM telegram_connections WHERE user_id=?",String.class,user))
                .isEqualTo(TelegramServiceImpl.hash(token)).isNotEqualTo(token);
        jdbc.update("UPDATE telegram_connections SET link_expires_at=now()-interval '1 second' WHERE user_id=?",user);
        links.accept(SECRET,1L,424242L,424242L,"private","/start "+token);
        assertThat(telegram.find(user).getChatId()).isNull();
    }
    @Test void aTelegramChatCannotBeClaimedByAnotherAppUser() {
        connect();
        UUID other=UUID.randomUUID();
        jdbc.update("INSERT INTO users(id,username,email,password) VALUES (?,?,?,?)",other,"tg-"+other,other+"@example.com","hash");
        telegram.setLink(other,TelegramServiceImpl.hash(TOKEN));
        links.accept(SECRET,2L,424242L,424242L,"private","/start "+TOKEN);
        assertThat(telegram.find(other).getChatId()).isNull();
        assertThat(telegram.find(user).getChatId()).isEqualTo(424242L);
    }
    @Test void deliveryClaimsRetryAndDisconnectWorkAgainstRealSql() {
        connect(); budget("USD"); spend("USD","10");
        var item=telegram.claim();
        assertThat(item).isNotNull(); assertThat(item.getAttempts()).isEqualTo(1);
        assertThat(telegram.claim()).isNull();
        telegram.retry(item.getId());
        assertThat(telegram.claim()).isNull();
        jdbc.update("UPDATE telegram_notifications SET next_attempt_at=now()-interval '1 second' WHERE id=?",item.getId());
        assertThat(telegram.claim().getAttempts()).isEqualTo(2);
        telegram.sent(item.getId()); assertThat(telegram.claim()).isNull();
        spend("USD","10"); links.disconnect(user);
        assertThat(links.status(user).connected()).isFalse();
        assertThat(count("expense:%")).isEqualTo(1);
        assertThat(telegram.claim()).isNull();
    }
}
