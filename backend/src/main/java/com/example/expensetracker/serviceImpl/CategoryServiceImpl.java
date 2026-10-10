package com.example.expensetracker.serviceImpl;

import java.util.List;
import java.util.UUID;

import com.example.expensetracker.convert.CategoryConvert;
import com.example.expensetracker.domain.Category;
import com.example.expensetracker.dto.request.CategoryRequest;
import com.example.expensetracker.dto.response.ApiResponse;
import com.example.expensetracker.dto.response.CategoryResponse;
import com.example.expensetracker.exception.BusinessRuleException;
import com.example.expensetracker.exception.DuplicateResourceException;
import com.example.expensetracker.exception.ResourceNotFoundException;
import com.example.expensetracker.mapper.CategoryMapper;
import com.example.expensetracker.service.CategoryService;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/** Category use cases, always scoped to the owning user. */
@Service
@RequiredArgsConstructor
@Slf4j
public class CategoryServiceImpl implements CategoryService {

    private final CategoryMapper categoryMapper;
    private final CategoryConvert categoryConvert;

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<CategoryResponse>> list(UUID userId) {
        List<Category> categories = categoryMapper.findAllByUserIdWithExpenseCount(userId);
        return ApiResponse.of(categoryConvert.toResponseList(categories), "Categories retrieved");
    }

    @Override
    @Transactional(readOnly = true)
    public CategoryResponse get(UUID userId, UUID id) {
        return categoryConvert.toResponse(requireOwned(userId, id));
    }

    @Override
    @Transactional
    public CategoryResponse create(UUID userId, CategoryRequest request) {
        requireNameAvailable(userId, request.getName(), null);

        Category category = Category.builder()
                .name(request.getName().trim())
                .description(request.getDescription())
                .iconName(request.getIconName())
                .colorHex(request.getColorHex())
                .userId(userId)
                .build();

        categoryMapper.insert(category);
        log.info("Created category '{}' ({}) for user {}", category.getName(), category.getId(), userId);
        return categoryConvert.toResponse(categoryMapper.findById(category.getId()));
    }

    @Override
    @Transactional
    public CategoryResponse update(UUID userId, UUID id, CategoryRequest request) {
        Category existing = requireOwned(userId, id);
        requireNameAvailable(userId, request.getName(), id);

        existing.setName(request.getName().trim());
        existing.setDescription(request.getDescription());
        existing.setIconName(request.getIconName());
        existing.setColorHex(request.getColorHex());

        categoryMapper.update(existing);
        log.info("Updated category {} for user {}", id, userId);
        return categoryConvert.toResponse(categoryMapper.findById(id));
    }

    /**
     * Deleting a category that still has expenses is refused: the expenses would
     * silently become "Uncategorised" and the user would lose the breakdown.
     * The explicit message lets the UI explain what to do instead.
     */
    @Override
    @Transactional
    public void delete(UUID userId, UUID id) {
        requireOwned(userId, id);
        long expenseCount = categoryMapper.countExpensesByCategoryId(id);
        if (expenseCount > 0) {
            throw new BusinessRuleException(
                    "Category still has %d expense(s). Reassign or delete them first.".formatted(expenseCount));
        }
        categoryMapper.deleteById(id);
        log.info("Deleted category {} for user {}", id, userId);
    }

    // ===================== Internals =====================

    private Category requireOwned(UUID userId, UUID id) {
        Category category = categoryMapper.findById(id);
        if (category == null || !userId.equals(category.getUserId())) {
            throw ResourceNotFoundException.of("Category", id);
        }
        return category;
    }

    /** Mirrors the {@code uq_categories_user_name} constraint with a friendly error. */
    private void requireNameAvailable(UUID userId, String name, UUID excludingId) {
        if (name == null || name.isBlank()) {
            return;
        }
        Category existing = categoryMapper.findByNameAndUserId(name.trim(), userId);
        if (existing != null && !existing.getId().equals(excludingId)) {
            throw DuplicateResourceException.of("Category name", name.trim());
        }
    }
}
