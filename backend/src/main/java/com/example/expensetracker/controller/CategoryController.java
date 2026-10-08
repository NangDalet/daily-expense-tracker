package com.example.expensetracker.controller;

import java.util.List;
import java.util.UUID;

import com.example.expensetracker.dto.request.CategoryRequest;
import com.example.expensetracker.dto.response.ApiResponse;
import com.example.expensetracker.dto.response.CategoryResponse;
import com.example.expensetracker.security.SecurityUtils;
import com.example.expensetracker.service.CategoryService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

/** Category CRUD, scoped to the authenticated user. */
@RestController
@RequestMapping("/api/v1/categories")
@RequiredArgsConstructor
@Tag(name = "Categories", description = "Spending categories of the current user")
public class CategoryController {

    private final CategoryService categoryService;

    @GetMapping
    @Operation(summary = "List categories",
            description = "Returns the categories of the caller including the number of linked expenses.")
    public ApiResponse<List<CategoryResponse>> list(@AuthenticationPrincipal Jwt jwt) {
        return categoryService.list(SecurityUtils.currentUserId(jwt));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get one category", description = "Responses: 200 found, 404 unknown category")
    public ApiResponse<CategoryResponse> get(@AuthenticationPrincipal Jwt jwt,
                                             @Parameter(description = "Category id") @PathVariable UUID id) {
        return ApiResponse.of(categoryService.get(SecurityUtils.currentUserId(jwt), id));
    }

    @PostMapping
    @Operation(summary = "Create a category",
            description = "Responses: 201 created, 400 validation error, 409 name already used by this user")
    public ResponseEntity<ApiResponse<CategoryResponse>> create(@AuthenticationPrincipal Jwt jwt,
                                                                 @Valid @RequestBody CategoryRequest request) {
        CategoryResponse created = categoryService.create(SecurityUtils.currentUserId(jwt), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(created, "Category created"));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a category",
            description = "Responses: 200 updated, 400 validation error, 404 unknown category, 409 name already used")
    public ApiResponse<CategoryResponse> update(@AuthenticationPrincipal Jwt jwt,
                                                @PathVariable UUID id,
                                                @Valid @RequestBody CategoryRequest request) {
        return ApiResponse.of(categoryService.update(SecurityUtils.currentUserId(jwt), id, request), "Category updated");
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a category",
            description = "Refused with 422 when expenses are still assigned to the category, so historical data "
                    + "is never silently orphaned.")
    public ApiResponse<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        categoryService.delete(SecurityUtils.currentUserId(jwt), id);
        return ApiResponse.empty("Category deleted");
    }
}
