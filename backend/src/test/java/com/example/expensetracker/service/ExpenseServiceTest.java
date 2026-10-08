package com.example.expensetracker.service;

import static com.example.expensetracker.support.TestFixtures.CATEGORY_ID;
import static com.example.expensetracker.support.TestFixtures.EXPENSE_ID;
import static com.example.expensetracker.support.TestFixtures.OTHER_USER_ID;
import static com.example.expensetracker.support.TestFixtures.USER_ID;
import static com.example.expensetracker.support.TestFixtures.expense;
import static com.example.expensetracker.support.TestFixtures.pageable;
import static com.example.expensetracker.support.TestFixtures.pageableSorted;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.example.expensetracker.config.PaginationProperties;
import com.example.expensetracker.domain.Expense;
import com.example.expensetracker.domain.PaymentMethod;
import com.example.expensetracker.dto.request.ExpenseFilterRequest;
import com.example.expensetracker.dto.request.ExpenseRequest;
import com.example.expensetracker.dto.request.ExpenseSummaryRequest;
import com.example.expensetracker.dto.response.ApiResponse;
import com.example.expensetracker.dto.response.ExpenseResponse;
import com.example.expensetracker.exception.ApiException;
import com.example.expensetracker.exception.ErrorCode;
import com.example.expensetracker.exception.ResourceNotFoundException;
import com.example.expensetracker.mapper.CategoryMapper;
import com.example.expensetracker.mapper.ExpenseMapper;
import com.example.expensetracker.support.TestFixtures;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;

@ExtendWith(MockitoExtension.class)
@DisplayName("ExpenseService")
class ExpenseServiceTest {

    @Mock
    private ExpenseMapper expenseMapper;

    @Mock
    private CategoryMapper categoryMapper;

    private PaginationProperties paginationProperties;
    private ExpenseService expenseService;

    @BeforeEach
    void setUp() {
        paginationProperties = new PaginationProperties();
        expenseService = new ExpenseService(expenseMapper, categoryMapper, TestFixtures.expenseConvert(),
                paginationProperties);
    }

    @Nested
    @DisplayName("list")
    class Listing {

        @Test
        @DisplayName("returns the page envelope and maps the entities")
        void returnsPageEnvelope() {
            when(expenseMapper.countByFilters(eq(USER_ID), any())).thenReturn(42L);
            when(expenseMapper.findByFilters(eq(USER_ID), any(), eq(0), eq(20), anyString(), anyString()))
                    .thenReturn(List.of(expense(EXPENSE_ID, USER_ID, new BigDecimal("12.34"))));

            ApiResponse<List<ExpenseResponse>> response =
                    expenseService.list(USER_ID, new ExpenseFilterRequest(), pageable(0, 20));

            assertThat(response.getData()).hasSize(1);
            assertThat(response.getData().getFirst().getId()).isEqualTo(EXPENSE_ID.toString());
            assertThat(response.getData().getFirst().getAmount()).isEqualByComparingTo("12.34");
            assertThat(response.getData().getFirst().getPaymentMethod()).isEqualTo("CREDIT_CARD");
            assertThat(response.getTotalElements()).isEqualTo(42L);
            assertThat(response.getPage()).isZero();
            assertThat(response.getSize()).isEqualTo(20);
            assertThat(response.getTotalPages()).isEqualTo(3);
            assertThat(response.getTimestamp()).isNotNull();
        }

        @Test
        @DisplayName("short-circuits when nothing matches instead of running the page query")
        void shortCircuitsOnEmptyResult() {
            when(expenseMapper.countByFilters(eq(USER_ID), any())).thenReturn(0L);

            ApiResponse<List<ExpenseResponse>> response =
                    expenseService.list(USER_ID, new ExpenseFilterRequest(), pageable(3, 20));

            assertThat(response.getData()).isEmpty();
            assertThat(response.getTotalElements()).isZero();
            assertThat(response.getTotalPages()).isZero();
            assertThat(response.getPage()).isEqualTo(3);
            verify(expenseMapper, never()).findByFilters(any(), any(), anyInt(), anyInt(), anyString(), anyString());
        }

        @Test
        @DisplayName("translates the Pageable into whitelisted sort tokens")
        void mapsSortWhitelist() {
            when(expenseMapper.countByFilters(eq(USER_ID), any())).thenReturn(1L);
            when(expenseMapper.findByFilters(any(), any(), anyInt(), anyInt(), anyString(), anyString()))
                    .thenReturn(List.of());

            expenseService.list(USER_ID, new ExpenseFilterRequest(),
                    pageableSorted("amount", Sort.Direction.ASC));

            verify(expenseMapper).findByFilters(eq(USER_ID), any(), eq(0), eq(20), eq("amount"), eq("ASC"));
        }

        @Test
        @DisplayName("falls back to the default sort for an unknown column")
        void fallsBackToDefaultSort() {
            when(expenseMapper.countByFilters(eq(USER_ID), any())).thenReturn(1L);
            when(expenseMapper.findByFilters(any(), any(), anyInt(), anyInt(), anyString(), anyString()))
                    .thenReturn(List.of());

            expenseService.list(USER_ID, new ExpenseFilterRequest(),
                    pageableSorted("; DROP TABLE expenses", Sort.Direction.DESC));

            verify(expenseMapper).findByFilters(eq(USER_ID), any(), eq(0), eq(20), eq("expenseDate"), eq("DESC"));
        }

        @Test
        @DisplayName("clamps an oversized page size to the configured maximum")
        void clampsPageSize() {
            when(expenseMapper.countByFilters(eq(USER_ID), any())).thenReturn(1L);
            when(expenseMapper.findByFilters(any(), any(), anyInt(), anyInt(), anyString(), anyString()))
                    .thenReturn(List.of());

            expenseService.list(USER_ID, new ExpenseFilterRequest(), pageable(0, 5_000));

            verify(expenseMapper).findByFilters(eq(USER_ID), any(), eq(0),
                    eq(paginationProperties.getMaxSize()), eq("expenseDate"), eq("DESC"));
        }

        @Test
        @DisplayName("passes the filter object through to both the page and the count query")
        void passesFilterToBothQueries() {
            ExpenseFilterRequest filter = ExpenseFilterRequest.builder()
                    .search("grocery")
                    .paymentMethods(List.of(PaymentMethod.CASH, PaymentMethod.E_WALLET))
                    .build();
            when(expenseMapper.countByFilters(eq(USER_ID), any())).thenReturn(0L);

            expenseService.list(USER_ID, filter, pageable(0, 20));

            ArgumentCaptor<ExpenseFilterRequest> captor = ArgumentCaptor.forClass(ExpenseFilterRequest.class);
            verify(expenseMapper).countByFilters(eq(USER_ID), captor.capture());
            assertThat(captor.getValue().getPaymentMethods())
                    .containsExactly(PaymentMethod.CASH, PaymentMethod.E_WALLET);
        }

        @Test
        @DisplayName("rejects an inverted amount range")
        void rejectsInvertedAmountRange() {
            ExpenseFilterRequest filter = ExpenseFilterRequest.builder()
                    .minAmount(new BigDecimal("100"))
                    .maxAmount(new BigDecimal("10"))
                    .build();

            assertThatThrownBy(() -> expenseService.list(USER_ID, filter, pageable(0, 20)))
                    .isInstanceOf(ApiException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.VALIDATION_ERROR);
            verify(expenseMapper, never()).countByFilters(any(), any());
        }

        @Test
        @DisplayName("rejects an inverted date range")
        void rejectsInvertedDateRange() {
            ExpenseFilterRequest filter = ExpenseFilterRequest.builder()
                    .fromDate(LocalDate.of(2026, 2, 1))
                    .toDate(LocalDate.of(2026, 1, 1))
                    .build();

            assertThatThrownBy(() -> expenseService.list(USER_ID, filter, pageable(0, 20)))
                    .isInstanceOf(ApiException.class)
                    .hasMessageContaining("'to' must not be earlier than 'from'");
        }

        @Test
        @DisplayName("rejects a categoryId that is not a UUID")
        void rejectsMalformedCategoryId() {
            ExpenseFilterRequest filter = ExpenseFilterRequest.builder().categoryId("not-a-uuid").build();

            assertThatThrownBy(() -> expenseService.list(USER_ID, filter, pageable(0, 20)))
                    .isInstanceOf(ApiException.class)
                    .hasMessageContaining("categoryId must be a valid UUID");
        }

        @Test
        @DisplayName("rejects a filter pointing at a category of another user")
        void rejectsForeignCategoryFilter() {
            ExpenseFilterRequest filter = ExpenseFilterRequest.builder().categoryId(CATEGORY_ID.toString()).build();
            when(categoryMapper.findById(CATEGORY_ID))
                    .thenReturn(TestFixtures.category(CATEGORY_ID, OTHER_USER_ID, "Groceries"));

            assertThatThrownBy(() -> expenseService.list(USER_ID, filter, pageable(0, 20)))
                    .isInstanceOf(ResourceNotFoundException.class);
            verify(expenseMapper, never()).countByFilters(any(), any());
        }
    }

    @Nested
    @DisplayName("get / delete")
    class SingleItem {

        @Test
        @DisplayName("returns the expense with its nested category")
        void returnsNestedCategory() {
            Expense stored = expense(EXPENSE_ID, USER_ID, new BigDecimal("9.99"));
            stored.setCategory(TestFixtures.category(CATEGORY_ID, USER_ID, "Groceries"));
            when(expenseMapper.findByIdAndUserId(EXPENSE_ID, USER_ID)).thenReturn(stored);

            ExpenseResponse response = expenseService.get(USER_ID, EXPENSE_ID);

            assertThat(response.getCategory()).isNotNull();
            assertThat(response.getCategory().getName()).isEqualTo("Groceries");
            assertThat(response.getCategory().getId()).isEqualTo(CATEGORY_ID.toString());
        }

        @Test
        @DisplayName("hides the existence of an expense owned by somebody else behind a 404")
        void hidesForeignExpense() {
            when(expenseMapper.findByIdAndUserId(EXPENSE_ID, OTHER_USER_ID)).thenReturn(null);

            assertThatThrownBy(() -> expenseService.get(OTHER_USER_ID, EXPENSE_ID))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Expense not found");
        }

        @Test
        @DisplayName("deletes an owned expense")
        void deletesOwnedExpense() {
            when(expenseMapper.findByIdAndUserId(EXPENSE_ID, USER_ID))
                    .thenReturn(expense(EXPENSE_ID, USER_ID, BigDecimal.ONE));

            expenseService.delete(USER_ID, EXPENSE_ID);

            verify(expenseMapper).deleteById(EXPENSE_ID);
        }

        @Test
        @DisplayName("never deletes an expense of another user")
        void refusesForeignDelete() {
            when(expenseMapper.findByIdAndUserId(EXPENSE_ID, OTHER_USER_ID)).thenReturn(null);

            assertThatThrownBy(() -> expenseService.delete(OTHER_USER_ID, EXPENSE_ID))
                    .isInstanceOf(ResourceNotFoundException.class);
            verify(expenseMapper, never()).deleteById(any());
        }
    }

    @Nested
    @DisplayName("create")
    class Create {

        private ExpenseRequest request;

        @BeforeEach
        void setUpRequest() {
            request = ExpenseRequest.builder()
                    .amount(new BigDecimal("42.755"))
                    .currency("USD")
                    .description("Weekly groceries run")
                    .expenseDate(LocalDate.of(2026, 1, 30))
                    .paymentMethod(PaymentMethod.DEBIT_CARD)
                    .categoryId(CATEGORY_ID.toString())
                    .tags(List.of(" weekly ", "weekly", "food"))
                    .build();
        }

        @Test
        @DisplayName("normalises the amount, de-duplicates tags and stamps the owner from the JWT")
        void normalisesPayload() {
            when(categoryMapper.findById(CATEGORY_ID))
                    .thenReturn(TestFixtures.category(CATEGORY_ID, USER_ID, "Groceries"));
            when(expenseMapper.insert(any())).thenAnswer(invocation -> {
                Expense inserted = invocation.getArgument(0);
                inserted.setId(EXPENSE_ID);
                return 1;
            });
            when(expenseMapper.findByIdAndUserId(EXPENSE_ID, USER_ID))
                    .thenReturn(expense(EXPENSE_ID, USER_ID, new BigDecimal("42.76")));

            expenseService.create(USER_ID, request);

            ArgumentCaptor<Expense> captor = ArgumentCaptor.forClass(Expense.class);
            verify(expenseMapper).insert(captor.capture());
            assertThat(captor.getValue().getAmount()).isEqualByComparingTo("42.76");
            assertThat(captor.getValue().getTags()).containsExactly("weekly", "food");
            assertThat(captor.getValue().getUserId()).isEqualTo(USER_ID);
        }

        @Test
        @DisplayName("accepts an expense without a category")
        void acceptsNoCategory() {
            request.setCategoryId(null);
            when(expenseMapper.insert(any())).thenAnswer(invocation -> {
                invocation.<Expense>getArgument(0).setId(EXPENSE_ID);
                return 1;
            });
            when(expenseMapper.findByIdAndUserId(EXPENSE_ID, USER_ID))
                    .thenReturn(expense(EXPENSE_ID, USER_ID, BigDecimal.TEN));

            assertThat(expenseService.create(USER_ID, request).getCategoryId()).isNull();
            verify(categoryMapper, never()).findById(any());
        }

        @Test
        @DisplayName("refuses a category owned by another user")
        void refusesForeignCategory() {
            when(categoryMapper.findById(CATEGORY_ID))
                    .thenReturn(TestFixtures.category(CATEGORY_ID, OTHER_USER_ID, "Groceries"));

            assertThatThrownBy(() -> expenseService.create(USER_ID, request))
                    .isInstanceOf(ResourceNotFoundException.class);
            verify(expenseMapper, never()).insert(any());
        }
    }

    @Nested
    @DisplayName("update")
    class Update {

        @Test
        @DisplayName("issues an explicit detach when the category is removed")
        void detachesCategoryWhenCleared() {
            Expense stored = expense(EXPENSE_ID, USER_ID, BigDecimal.ONE);
            stored.setCategoryId(CATEGORY_ID);
            when(expenseMapper.findByIdAndUserId(EXPENSE_ID, USER_ID)).thenReturn(stored);

            expenseService.update(USER_ID, EXPENSE_ID, ExpenseRequest.builder()
                    .amount(BigDecimal.TEN)
                    .expenseDate(LocalDate.of(2026, 2, 1))
                    .paymentMethod(PaymentMethod.CASH)
                    .build());

            verify(expenseMapper).detachCategory(EXPENSE_ID, USER_ID);
        }

        @Test
        @DisplayName("keeps the category when the payload does not change it")
        void keepsCategoryWhenUnchanged() {
            Expense stored = expense(EXPENSE_ID, USER_ID, BigDecimal.ONE);
            stored.setCategoryId(CATEGORY_ID);
            when(expenseMapper.findByIdAndUserId(EXPENSE_ID, USER_ID)).thenReturn(stored);
            when(categoryMapper.findById(CATEGORY_ID))
                    .thenReturn(TestFixtures.category(CATEGORY_ID, USER_ID, "Groceries"));

            expenseService.update(USER_ID, EXPENSE_ID, ExpenseRequest.builder()
                    .amount(BigDecimal.TEN)
                    .expenseDate(LocalDate.of(2026, 2, 1))
                    .paymentMethod(PaymentMethod.CASH)
                    .categoryId(CATEGORY_ID.toString())
                    .build());

            verify(expenseMapper, never()).detachCategory(any(), any());
        }

        @Test
        @DisplayName("fails with 404 for an unknown expense")
        void failsForUnknownExpense() {
            when(expenseMapper.findByIdAndUserId(EXPENSE_ID, OTHER_USER_ID)).thenReturn(null);

            assertThatThrownBy(() -> expenseService.update(OTHER_USER_ID, EXPENSE_ID, ExpenseRequest.builder()
                    .amount(BigDecimal.ONE)
                    .expenseDate(LocalDate.of(2026, 1, 1))
                    .paymentMethod(PaymentMethod.CASH)
                    .build())).isInstanceOf(ResourceNotFoundException.class);
        }
    }

    @Nested
    @DisplayName("aggregations")
    class Aggregations {

        @Test
        @DisplayName("passes the whitelisted truncation unit to the mapper")
        void passesGroupByUnit() {
            when(expenseMapper.sumByPeriod(any(), any(), any(), any(), any(), any())).thenReturn(List.of());

            expenseService.summary(USER_ID, ExpenseSummaryRequest.builder()
                    .groupBy(ExpenseSummaryRequest.GroupBy.WEEKLY)
                    .from(LocalDate.of(2026, 1, 1))
                    .to(LocalDate.of(2026, 1, 31))
                    .build());

            verify(expenseMapper).sumByPeriod(USER_ID, "week", LocalDate.of(2026, 1, 1),
                    LocalDate.of(2026, 1, 31), null, null);
        }

        @Test
        @DisplayName("rejects an inverted aggregation range")
        void rejectsInvertedRange() {
            assertThatThrownBy(() -> expenseService.statsByCategory(USER_ID,
                    LocalDate.of(2026, 3, 1), LocalDate.of(2026, 1, 1)))
                    .isInstanceOf(ApiException.class);
        }

        @Test
        @DisplayName("clamps the recent limit to a sane window")
        void clampsRecentLimit() {
            when(expenseMapper.findRecentByUserId(USER_ID, 50)).thenReturn(List.of());

            expenseService.recent(USER_ID, 500);

            verify(expenseMapper).findRecentByUserId(USER_ID, 50);
        }
    }

    @Test
    @DisplayName("a null filter is treated as an empty filter")
    void toleratesNullFilter() {
        when(expenseMapper.countByFilters(eq(USER_ID), any())).thenReturn(0L);

        assertThat(expenseService.list(USER_ID, null, pageable(0, 20)).getTotalElements()).isZero();
    }
}
