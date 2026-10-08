package com.example.expensetracker.controller;

import java.util.List;
import java.util.UUID;

import com.example.expensetracker.dto.request.CreateUserRequest;
import com.example.expensetracker.dto.request.ResetPasswordRequest;
import com.example.expensetracker.dto.request.UpdateUserRequest;
import com.example.expensetracker.dto.response.ApiResponse;
import com.example.expensetracker.dto.response.UserResponse;
import com.example.expensetracker.security.CurrentUser;
import com.example.expensetracker.security.SecurityUtils;
import com.example.expensetracker.service.UserService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

/**
 * Administrative user management.
 * <p>
 * The {@code ADMIN} requirement is declared twice on purpose: as a URL rule in
 * {@code SecurityConfig} (so the requirement is visible next to the rest of the
 * filter chain) and as a class-level {@code @PreAuthorize} (so it still holds if
 * the method is ever reached through another mapping).
 * <p>
 * Reading requires {@code ADMIN}; creating accounts and resetting passwords
 * require {@code SUPER_ADMIN}. Beyond that, {@code UserService} enforces the
 * rank rules - an administrator can only manage accounts below their own tier,
 * while a super administrator can manage every account.
 */
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "Users (admin)", description = "Administrative user management")
@PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
public class UserController {

    private final UserService userService;

    @GetMapping
    @Operation(summary = "List users",
            description = "Paged listing with an optional case-insensitive `search` over username, e-mail and name.")
    public ApiResponse<List<UserResponse>> list(
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return userService.list(search, pageable);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get one user", description = "Responses: 200 found, 404 unknown user")
    public ApiResponse<UserResponse> get(@Parameter(description = "User id") @PathVariable UUID id) {
        return ApiResponse.of(userService.get(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Create a user",
            description = "Super administrators only. Creates the account with the given roles and seeds its "
                    + "default categories. Responses: 201 created, 400 validation error, 403 caller is not a "
                    + "super administrator, 409 username/e-mail already taken.")
    public ResponseEntity<ApiResponse<UserResponse>> create(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateUserRequest request) {
        UserResponse created = userService.create(request, currentUser(jwt));
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.of(created, "User created"));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a user",
            description = "Changes e-mail, display name, roles and the enabled flag. Null fields stay untouched. "
                    + "An administrator may only manage accounts below their own tier, and nobody can be granted "
                    + "a role above the caller's. "
                    + "Responses: 200 updated, 400 validation error, 403 target outranks the caller, "
                    + "404 unknown user, 409 e-mail already taken, 422 the last super administrator.")
    public ApiResponse<UserResponse> update(@AuthenticationPrincipal Jwt jwt,
                                            @Parameter(description = "User id") @PathVariable UUID id,
                                            @Valid @RequestBody UpdateUserRequest request) {
        return ApiResponse.of(userService.update(id, request, currentUser(jwt)), "User updated");
    }

    @PutMapping("/{id}/password")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Reset a user's password",
            description = "Super administrators only. Replaces the stored BCrypt hash so an account that cannot "
                    + "be signed into can be recovered. Responses: 200 reset, 400 validation error, "
                    + "403 caller is not a super administrator or target outranks the caller, 404 unknown user.")
    public ApiResponse<Void> resetPassword(@AuthenticationPrincipal Jwt jwt,
                                           @Parameter(description = "User id") @PathVariable UUID id,
                                           @Valid @RequestBody ResetPasswordRequest request) {
        userService.resetPassword(id, request.getPassword(), currentUser(jwt));
        return ApiResponse.empty("Password updated");
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a user",
            description = "Cascades to the categories, expenses and budgets of the account. "
                    + "Nobody can delete their own account (422), and an administrator cannot delete another "
                    + "administrator (403).")
    public ApiResponse<Void> delete(@AuthenticationPrincipal Jwt jwt,
                                    @Parameter(description = "User id") @PathVariable UUID id) {
        userService.delete(id, currentUser(jwt));
        return ApiResponse.empty("User deleted");
    }

    private CurrentUser currentUser(Jwt jwt) {
        return SecurityUtils.currentUser(jwt);
    }
}
