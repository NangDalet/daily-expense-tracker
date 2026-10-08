package com.example.expensetracker.mapper;

import java.util.List;
import java.util.UUID;

import com.example.expensetracker.domain.Category;

import org.apache.ibatis.annotations.Param;

/** Category persistence - see {@code mappers/CategoryMapper.xml}. */
public interface CategoryMapper {

    int insert(Category category);

    Category findById(@Param("id") UUID id);

    /** Used to enforce the per-user unique name rule and to feed update forms. */
    Category findByNameAndUserId(@Param("name") String name, @Param("userId") UUID userId);

    List<Category> findAllByUserId(@Param("userId") UUID userId);

    /**
     * Same as {@link #findAllByUserId} but adds {@code expense_count} per row so
     * the UI can show "12 expenses" and warn before a cascading delete.
     */
    List<Category> findAllByUserIdWithExpenseCount(@Param("userId") UUID userId);

    int update(Category category);

    int deleteById(@Param("id") UUID id);

    /** Number of expenses referencing the category - guards the delete operation. */
    long countExpensesByCategoryId(@Param("categoryId") UUID categoryId);

    long countByUserId(@Param("userId") UUID userId);
}
