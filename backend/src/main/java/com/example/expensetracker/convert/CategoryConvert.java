package com.example.expensetracker.convert;

import java.util.List;

import com.example.expensetracker.domain.Category;
import com.example.expensetracker.dto.response.CategoryResponse;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * Category &lt;-&gt; DTO conversion.
 * <p>
 * A single method serves both the CRUD responses and the nested
 * {@code category} object of an expense: the {@code expenseCount} field is only
 * populated by the JOIN based list query and stays {@code null} elsewhere.
 */
@Mapper
public interface CategoryConvert {

    @Mapping(target = "id", expression = "java(category.getId() == null ? null : category.getId().toString())")
    @Mapping(target = "userId",
            expression = "java(category.getUserId() == null ? null : category.getUserId().toString())")
    CategoryResponse toResponse(Category category);

    List<CategoryResponse> toResponseList(List<Category> categories);
}
