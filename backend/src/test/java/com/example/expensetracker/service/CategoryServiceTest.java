package com.example.expensetracker.service;

import static com.example.expensetracker.support.TestFixtures.CATEGORY_ID;
import static com.example.expensetracker.support.TestFixtures.OTHER_USER_ID;
import static com.example.expensetracker.support.TestFixtures.USER_ID;
import static com.example.expensetracker.support.TestFixtures.category;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;

import com.example.expensetracker.domain.Category;
import com.example.expensetracker.dto.request.CategoryRequest;
import com.example.expensetracker.dto.response.ApiResponse;
import com.example.expensetracker.dto.response.CategoryResponse;
import com.example.expensetracker.exception.BusinessRuleException;
import com.example.expensetracker.exception.DuplicateResourceException;
import com.example.expensetracker.exception.ResourceNotFoundException;
import com.example.expensetracker.mapper.CategoryMapper;
import com.example.expensetracker.support.TestFixtures;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("CategoryService")
class CategoryServiceTest {

    @Mock
    private CategoryMapper categoryMapper;

    private CategoryService categoryService;

    @BeforeEach
    void setUp() {
        categoryService = new CategoryService(categoryMapper, TestFixtures.categoryConvert());
    }

    @Test
    @DisplayName("lists the categories with their expense counts")
    void listsWithExpenseCount() {
        Category withExpenses = category(CATEGORY_ID, USER_ID, "Groceries");
        withExpenses.setExpenseCount(7L);
        when(categoryMapper.findAllByUserIdWithExpenseCount(USER_ID)).thenReturn(List.of(withExpenses));

        ApiResponse<List<CategoryResponse>> response = categoryService.list(USER_ID);

        assertThat(response.getData()).hasSize(1);
        assertThat(response.getData().getFirst().getExpenseCount()).isEqualTo(7L);
        assertThat(response.getData().getFirst().getColorHex()).isEqualTo("#22c55e");
    }

    @Test
    @DisplayName("creates a category owned by the caller")
    void createsCategory() {
        when(categoryMapper.findByNameAndUserId("Groceries", USER_ID)).thenReturn(null);
        when(categoryMapper.insert(any())).thenAnswer(invocation -> {
            invocation.<Category>getArgument(0).setId(CATEGORY_ID);
            return 1;
        });
        when(categoryMapper.findById(CATEGORY_ID)).thenReturn(category(CATEGORY_ID, USER_ID, "Groceries"));

        CategoryRequest request = CategoryRequest.builder()
                .name("  Groceries  ")
                .description("Supermarket")
                .iconName("ShoppingCart")
                .colorHex("#22c55e")
                .build();

        CategoryResponse created = categoryService.create(USER_ID, request);

        assertThat(created.getId()).isEqualTo(CATEGORY_ID.toString());
        ArgumentCaptor<Category> captor = ArgumentCaptor.forClass(Category.class);
        verify(categoryMapper).insert(captor.capture());
        assertThat(captor.getValue().getName()).isEqualTo("Groceries");
        assertThat(captor.getValue().getUserId()).isEqualTo(USER_ID);
    }

    @Test
    @DisplayName("rejects a duplicate name regardless of letter case")
    void rejectsDuplicateName() {
        when(categoryMapper.findByNameAndUserId("groceries", USER_ID))
                .thenReturn(category(CATEGORY_ID, USER_ID, "Groceries"));

        assertThatThrownBy(() -> categoryService.create(USER_ID, CategoryRequest.builder()
                .name("groceries")
                .build()))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("groceries");
        verify(categoryMapper, never()).insert(any());
    }

    @Test
    @DisplayName("allows renaming a category to its own name")
    void allowsKeepingOwnName() {
        when(categoryMapper.findById(CATEGORY_ID)).thenReturn(category(CATEGORY_ID, USER_ID, "Groceries"));
        when(categoryMapper.findByNameAndUserId("Groceries", USER_ID))
                .thenReturn(category(CATEGORY_ID, USER_ID, "Groceries"));
        when(categoryMapper.findById(CATEGORY_ID)).thenReturn(category(CATEGORY_ID, USER_ID, "Groceries"));

        categoryService.update(USER_ID, CATEGORY_ID, CategoryRequest.builder()
                .name("Groceries")
                .iconName("ShoppingBasket")
                .build());

        verify(categoryMapper).update(any());
    }

    @Test
    @DisplayName("refuses to delete a category that still has expenses")
    void refusesDeleteWithExpenses() {
        when(categoryMapper.findById(CATEGORY_ID)).thenReturn(category(CATEGORY_ID, USER_ID, "Groceries"));
        when(categoryMapper.countExpensesByCategoryId(CATEGORY_ID)).thenReturn(4L);

        assertThatThrownBy(() -> categoryService.delete(USER_ID, CATEGORY_ID))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("4 expense(s)");
        verify(categoryMapper, never()).deleteById(any());
    }

    @Test
    @DisplayName("deletes an unused category")
    void deletesUnusedCategory() {
        when(categoryMapper.findById(CATEGORY_ID)).thenReturn(category(CATEGORY_ID, USER_ID, "Groceries"));
        when(categoryMapper.countExpensesByCategoryId(CATEGORY_ID)).thenReturn(0L);

        categoryService.delete(USER_ID, CATEGORY_ID);

        verify(categoryMapper).deleteById(CATEGORY_ID);
    }

    @Test
    @DisplayName("hides categories of other users behind a 404")
    void hidesForeignCategory() {
        when(categoryMapper.findById(CATEGORY_ID)).thenReturn(category(CATEGORY_ID, OTHER_USER_ID, "Groceries"));

        assertThatThrownBy(() -> categoryService.get(USER_ID, CATEGORY_ID))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Category not found");
    }

    @Test
    @DisplayName("reports an unknown category as not found")
    void reportsUnknownCategory() {
        when(categoryMapper.findById(any())).thenReturn(null);

        assertThatThrownBy(() -> categoryService.delete(USER_ID, UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(categoryMapper, never()).deleteById(any(UUID.class));
    }

    @Test
    @DisplayName("never lets one user read the categories of another")
    void enforcesOwnership() {
        when(categoryMapper.findById(CATEGORY_ID)).thenReturn(category(CATEGORY_ID, OTHER_USER_ID, "Groceries"));

        // the caller is USER_ID but the category belongs to OTHER_USER_ID
        assertThatThrownBy(() -> categoryService.update(USER_ID, CATEGORY_ID, CategoryRequest.builder()
                .name("Stolen")
                .build())).isInstanceOf(ResourceNotFoundException.class);
        verify(categoryMapper, never()).update(any());
        verify(categoryMapper, never()).findByNameAndUserId(anyString(), eq(USER_ID));
    }
}
