package com.example.expensetracker.service;

import java.util.List;
import java.util.UUID;

import com.example.expensetracker.dto.request.CategoryRequest;
import com.example.expensetracker.dto.response.ApiResponse;
import com.example.expensetracker.dto.response.CategoryResponse;

/** Category use cases. */
public interface CategoryService {

    ApiResponse<List<CategoryResponse>> list(UUID userId);

    CategoryResponse get(UUID userId, UUID id);

    CategoryResponse create(UUID userId, CategoryRequest request);

    CategoryResponse update(UUID userId, UUID id, CategoryRequest request);

    void delete(UUID userId, UUID id);
}
