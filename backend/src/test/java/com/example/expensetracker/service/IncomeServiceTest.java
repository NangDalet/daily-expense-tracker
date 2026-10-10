package com.example.expensetracker.service;

import static com.example.expensetracker.support.TestFixtures.CATEGORY_ID;
import static com.example.expensetracker.support.TestFixtures.EXPENSE_ID;
import static com.example.expensetracker.support.TestFixtures.OTHER_USER_ID;
import static com.example.expensetracker.support.TestFixtures.USER_ID;
import static com.example.expensetracker.support.IncomeFixtures.income;
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
import com.example.expensetracker.domain.Income;
import com.example.expensetracker.domain.PaymentMethod;
import com.example.expensetracker.dto.request.IncomeFilterRequest;
import com.example.expensetracker.dto.request.IncomeRequest;
import com.example.expensetracker.dto.request.IncomeSummaryRequest;
import com.example.expensetracker.dto.response.ApiResponse;
import com.example.expensetracker.dto.response.IncomeResponse;
import com.example.expensetracker.exception.ApiException;
import com.example.expensetracker.exception.ErrorCode;
import com.example.expensetracker.exception.ResourceNotFoundException;
import com.example.expensetracker.mapper.CategoryMapper;
import com.example.expensetracker.mapper.IncomeMapper;
import com.example.expensetracker.serviceImpl.IncomeServiceImpl;
import com.example.expensetracker.support.TestFixtures;
import com.example.expensetracker.support.IncomeFixtures;

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
@DisplayName("IncomeService")
class IncomeServiceTest {

    @Mock
    private IncomeMapper incomeMapper;

    @Mock
    private CategoryMapper categoryMapper;

    private PaginationProperties paginationProperties;
    private IncomeService incomeService;

    @BeforeEach
    void setUp() {
        paginationProperties = new PaginationProperties();
        incomeService = new IncomeServiceImpl(incomeMapper, categoryMapper, IncomeFixtures.incomeConvert(),
                paginationProperties);
    }

    @Nested
    @DisplayName("list")
    class Listing {

        @Test
        @DisplayName("returns the page envelope and maps the entities")
        void returnsPageEnvelope() {
            when(incomeMapper.countByFilters(eq(USER_ID), any())).thenReturn(42L);
            when(incomeMapper.findByFilters(eq(USER_ID), any(), eq(0), eq(20), anyString(), anyString()))
                    .thenReturn(List.of(income(EXPENSE_ID, USER_ID, new BigDecimal("12.34"))));

            ApiResponse<List<IncomeResponse>> response =
                    incomeService.list(USER_ID, new IncomeFilterRequest(), pageable(0, 20));

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
            when(incomeMapper.countByFilters(eq(USER_ID), any())).thenReturn(0L);

            ApiResponse<List<IncomeResponse>> response =
                    incomeService.list(USER_ID, new IncomeFilterRequest(), pageable(3, 20));

            assertThat(response.getData()).isEmpty();
            assertThat(response.getTotalElements()).isZero();
            assertThat(response.getTotalPages()).isZero();
            assertThat(response.getPage()).isEqualTo(3);
            verify(incomeMapper, never()).findByFilters(any(), any(), anyInt(), anyInt(), anyString(), anyString());
        }

        @Test
        @DisplayName("translates the Pageable into whitelisted sort tokens")
        void mapsSortWhitelist() {
            when(incomeMapper.countByFilters(eq(USER_ID), any())).thenReturn(1L);
            when(incomeMapper.findByFilters(any(), any(), anyInt(), anyInt(), anyString(), anyString()))
                    .thenReturn(List.of());

            incomeService.list(USER_ID, new IncomeFilterRequest(),
                    pageableSorted("amount", Sort.Direction.ASC));

            verify(incomeMapper).findByFilters(eq(USER_ID), any(), eq(0), eq(20), eq("amount"), eq("ASC"));
        }

        @Test
        @DisplayName("falls back to the default sort for an unknown column")
        void fallsBackToDefaultSort() {
            when(incomeMapper.countByFilters(eq(USER_ID), any())).thenReturn(1L);
            when(incomeMapper.findByFilters(any(), any(), anyInt(), anyInt(), anyString(), anyString()))
                    .thenReturn(List.of());

            incomeService.list(USER_ID, new IncomeFilterRequest(),
                    pageableSorted("; DROP TABLE incomes", Sort.Direction.DESC));

            verify(incomeMapper).findByFilters(eq(USER_ID), any(), eq(0), eq(20), eq("incomeDate"), eq("DESC"));
        }

        @Test
        @DisplayName("clamps an oversized page size to the configured maximum")
        void clampsPageSize() {
            when(incomeMapper.countByFilters(eq(USER_ID), any())).thenReturn(1L);
            when(incomeMapper.findByFilters(any(), any(), anyInt(), anyInt(), anyString(), anyString()))
                    .thenReturn(List.of());

            incomeService.list(USER_ID, new IncomeFilterRequest(), pageable(0, 5_000));

            verify(incomeMapper).findByFilters(eq(USER_ID), any(), eq(0),
                    eq(paginationProperties.getMaxSize()), eq("incomeDate"), eq("DESC"));
        }

        @Test
        @DisplayName("passes the filter object through to both the page and the count query")
        void passesFilterToBothQueries() {
            IncomeFilterRequest filter = IncomeFilterRequest.builder()
                    .search("grocery")
                    .paymentMethods(List.of(PaymentMethod.CASH, PaymentMethod.E_WALLET))
                    .build();
            when(incomeMapper.countByFilters(eq(USER_ID), any())).thenReturn(0L);

            incomeService.list(USER_ID, filter, pageable(0, 20));

            ArgumentCaptor<IncomeFilterRequest> captor = ArgumentCaptor.forClass(IncomeFilterRequest.class);
            verify(incomeMapper).countByFilters(eq(USER_ID), captor.capture());
            assertThat(captor.getValue().getPaymentMethods())
                    .containsExactly(PaymentMethod.CASH, PaymentMethod.E_WALLET);
        }

        @Test
        @DisplayName("rejects an inverted amount range")
        void rejectsInvertedAmountRange() {
            IncomeFilterRequest filter = IncomeFilterRequest.builder()
                    .minAmount(new BigDecimal("100"))
                    .maxAmount(new BigDecimal("10"))
                    .build();

            assertThatThrownBy(() -> incomeService.list(USER_ID, filter, pageable(0, 20)))
                    .isInstanceOf(ApiException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.VALIDATION_ERROR);
            verify(incomeMapper, never()).countByFilters(any(), any());
        }

        @Test
        @DisplayName("rejects an inverted date range")
        void rejectsInvertedDateRange() {
            IncomeFilterRequest filter = IncomeFilterRequest.builder()
                    .fromDate(LocalDate.of(2026, 2, 1))
                    .toDate(LocalDate.of(2026, 1, 1))
                    .build();

            assertThatThrownBy(() -> incomeService.list(USER_ID, filter, pageable(0, 20)))
                    .isInstanceOf(ApiException.class)
                    .hasMessageContaining("'to' must not be earlier than 'from'");
        }

        @Test
        @DisplayName("rejects a categoryId that is not a UUID")
        void rejectsMalformedCategoryId() {
            IncomeFilterRequest filter = IncomeFilterRequest.builder().categoryId("not-a-uuid").build();

            assertThatThrownBy(() -> incomeService.list(USER_ID, filter, pageable(0, 20)))
                    .isInstanceOf(ApiException.class)
                    .hasMessageContaining("categoryId must be a valid UUID");
        }

        @Test
        @DisplayName("rejects a filter pointing at a category of another user")
        void rejectsForeignCategoryFilter() {
            IncomeFilterRequest filter = IncomeFilterRequest.builder().categoryId(CATEGORY_ID.toString()).build();
            when(categoryMapper.findById(CATEGORY_ID))
                    .thenReturn(TestFixtures.category(CATEGORY_ID, OTHER_USER_ID, "Groceries"));

            assertThatThrownBy(() -> incomeService.list(USER_ID, filter, pageable(0, 20)))
                    .isInstanceOf(ResourceNotFoundException.class);
            verify(incomeMapper, never()).countByFilters(any(), any());
        }
    }

    @Nested
    @DisplayName("get / delete")
    class SingleItem {

        @Test
        @DisplayName("returns the income with its nested category")
        void returnsNestedCategory() {
            Income stored = income(EXPENSE_ID, USER_ID, new BigDecimal("9.99"));
            stored.setCategory(TestFixtures.category(CATEGORY_ID, USER_ID, "Groceries"));
            when(incomeMapper.findByIdAndUserId(EXPENSE_ID, USER_ID)).thenReturn(stored);

            IncomeResponse response = incomeService.get(USER_ID, EXPENSE_ID);

            assertThat(response.getCategory()).isNotNull();
            assertThat(response.getCategory().getName()).isEqualTo("Groceries");
            assertThat(response.getCategory().getId()).isEqualTo(CATEGORY_ID.toString());
        }

        @Test
        @DisplayName("hides the existence of an income owned by somebody else behind a 404")
        void hidesForeignIncome() {
            when(incomeMapper.findByIdAndUserId(EXPENSE_ID, OTHER_USER_ID)).thenReturn(null);

            assertThatThrownBy(() -> incomeService.get(OTHER_USER_ID, EXPENSE_ID))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Income not found");
        }

        @Test
        @DisplayName("deletes an owned income")
        void deletesOwnedIncome() {
            when(incomeMapper.findByIdAndUserId(EXPENSE_ID, USER_ID))
                    .thenReturn(income(EXPENSE_ID, USER_ID, BigDecimal.ONE));

            incomeService.delete(USER_ID, EXPENSE_ID);

            verify(incomeMapper).deleteById(EXPENSE_ID, USER_ID);
        }

        @Test
        @DisplayName("never deletes an income of another user")
        void refusesForeignDelete() {
            when(incomeMapper.findByIdAndUserId(EXPENSE_ID, OTHER_USER_ID)).thenReturn(null);

            assertThatThrownBy(() -> incomeService.delete(OTHER_USER_ID, EXPENSE_ID))
                    .isInstanceOf(ResourceNotFoundException.class);
            verify(incomeMapper, never()).deleteById(any(), any());
        }
    }

    @Nested
    @DisplayName("create")
    class Create {

        private IncomeRequest request;

        @BeforeEach
        void setUpRequest() {
            request = IncomeRequest.builder()
                    .amount(new BigDecimal("42.755"))
                    .currency("USD")
                    .description("Weekly groceries run")
                    .incomeDate(LocalDate.of(2026, 1, 30))
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
            when(incomeMapper.insert(any())).thenAnswer(invocation -> {
                Income inserted = invocation.getArgument(0);
                inserted.setId(EXPENSE_ID);
                return 1;
            });
            when(incomeMapper.findByIdAndUserId(EXPENSE_ID, USER_ID))
                    .thenReturn(income(EXPENSE_ID, USER_ID, new BigDecimal("42.76")));

            incomeService.create(USER_ID, request);

            ArgumentCaptor<Income> captor = ArgumentCaptor.forClass(Income.class);
            verify(incomeMapper).insert(captor.capture());
            assertThat(captor.getValue().getAmount()).isEqualByComparingTo("42.76");
            assertThat(captor.getValue().getTags()).containsExactly("weekly", "food");
            assertThat(captor.getValue().getUserId()).isEqualTo(USER_ID);
        }

        @Test
        @DisplayName("accepts an income without a category")
        void acceptsNoCategory() {
            request.setCategoryId(null);
            when(incomeMapper.insert(any())).thenAnswer(invocation -> {
                invocation.<Income>getArgument(0).setId(EXPENSE_ID);
                return 1;
            });
            when(incomeMapper.findByIdAndUserId(EXPENSE_ID, USER_ID))
                    .thenReturn(income(EXPENSE_ID, USER_ID, BigDecimal.TEN));

            assertThat(incomeService.create(USER_ID, request).getCategoryId()).isNull();
            verify(categoryMapper, never()).findById(any());
        }

        @Test
        @DisplayName("refuses a category owned by another user")
        void refusesForeignCategory() {
            when(categoryMapper.findById(CATEGORY_ID))
                    .thenReturn(TestFixtures.category(CATEGORY_ID, OTHER_USER_ID, "Groceries"));

            assertThatThrownBy(() -> incomeService.create(USER_ID, request))
                    .isInstanceOf(ResourceNotFoundException.class);
            verify(incomeMapper, never()).insert(any());
        }
    }

    @Nested
    @DisplayName("update")
    class Update {

        @Test
        @DisplayName("clears category and optional fields on replacement")
        void detachesCategoryWhenCleared() {
            Income stored = income(EXPENSE_ID, USER_ID, BigDecimal.ONE);
            stored.setCategoryId(CATEGORY_ID);
            when(incomeMapper.findByIdAndUserId(EXPENSE_ID, USER_ID)).thenReturn(stored);

            incomeService.update(USER_ID, EXPENSE_ID, IncomeRequest.builder()
                    .amount(BigDecimal.TEN)
                    .incomeDate(LocalDate.of(2026, 2, 1))
                    .paymentMethod(PaymentMethod.CASH)
                    .build());

            ArgumentCaptor<Income> captor = ArgumentCaptor.forClass(Income.class);
            verify(incomeMapper).update(captor.capture());
            assertThat(captor.getValue().getCategoryId()).isNull();
            assertThat(captor.getValue().getDescription()).isNull();
            assertThat(captor.getValue().getReceiptUrl()).isNull();
            assertThat(captor.getValue().getTags()).isEmpty();
        }

        @Test
        @DisplayName("keeps the category when the payload does not change it")
        void keepsCategoryWhenUnchanged() {
            Income stored = income(EXPENSE_ID, USER_ID, BigDecimal.ONE);
            stored.setCategoryId(CATEGORY_ID);
            when(incomeMapper.findByIdAndUserId(EXPENSE_ID, USER_ID)).thenReturn(stored);
            when(categoryMapper.findById(CATEGORY_ID))
                    .thenReturn(TestFixtures.category(CATEGORY_ID, USER_ID, "Groceries"));

            incomeService.update(USER_ID, EXPENSE_ID, IncomeRequest.builder()
                    .amount(BigDecimal.TEN)
                    .incomeDate(LocalDate.of(2026, 2, 1))
                    .paymentMethod(PaymentMethod.CASH)
                    .categoryId(CATEGORY_ID.toString())
                    .build());

            ArgumentCaptor<Income> captor = ArgumentCaptor.forClass(Income.class);
            verify(incomeMapper).update(captor.capture());
            assertThat(captor.getValue().getCategoryId()).isEqualTo(CATEGORY_ID);
        }

        @Test
        @DisplayName("fails with 404 for an unknown income")
        void failsForUnknownIncome() {
            when(incomeMapper.findByIdAndUserId(EXPENSE_ID, OTHER_USER_ID)).thenReturn(null);

            assertThatThrownBy(() -> incomeService.update(OTHER_USER_ID, EXPENSE_ID, IncomeRequest.builder()
                    .amount(BigDecimal.ONE)
                    .incomeDate(LocalDate.of(2026, 1, 1))
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
            when(incomeMapper.sumByPeriod(any(), any(), any(), any(), any(), any())).thenReturn(List.of());

            incomeService.summary(USER_ID, IncomeSummaryRequest.builder()
                    .groupBy(IncomeSummaryRequest.GroupBy.WEEKLY)
                    .from(LocalDate.of(2026, 1, 1))
                    .to(LocalDate.of(2026, 1, 31))
                    .build());

            verify(incomeMapper).sumByPeriod(USER_ID, "week", LocalDate.of(2026, 1, 1),
                    LocalDate.of(2026, 1, 31), null, null);
        }

        @Test
        @DisplayName("rejects an inverted aggregation range")
        void rejectsInvertedRange() {
            assertThatThrownBy(() -> incomeService.statsByCategory(USER_ID,
                    LocalDate.of(2026, 3, 1), LocalDate.of(2026, 1, 1)))
                    .isInstanceOf(ApiException.class);
        }

        @Test
        @DisplayName("clamps the recent limit to a sane window")
        void clampsRecentLimit() {
            when(incomeMapper.findRecentByUserId(USER_ID, 50)).thenReturn(List.of());

            incomeService.recent(USER_ID, 500);

            verify(incomeMapper).findRecentByUserId(USER_ID, 50);
        }
    }

    @Test
    @DisplayName("a null filter is treated as an empty filter")
    void toleratesNullFilter() {
        when(incomeMapper.countByFilters(eq(USER_ID), any())).thenReturn(0L);

        assertThat(incomeService.list(USER_ID, null, pageable(0, 20)).getTotalElements()).isZero();
    }
}
