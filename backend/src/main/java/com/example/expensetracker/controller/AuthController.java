package com.example.expensetracker.controller;

import com.example.expensetracker.dto.request.LoginRequest;
import com.example.expensetracker.dto.request.RefreshTokenRequest;
import com.example.expensetracker.dto.request.RegisterRequest;
import com.example.expensetracker.dto.response.ApiResponse;
import com.example.expensetracker.dto.response.TokenResponse;
import com.example.expensetracker.service.AuthService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

/** Local authentication endpoints - the only public part of the API. */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Register, login and token refresh")
@SecurityRequirements
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    @Operation(summary = "Create an account",
            description = "Registers a new user, seeds the default categories and returns a token pair. "
                    + "Responses: 201 created, 409 username/e-mail already taken.")
    public ResponseEntity<ApiResponse<TokenResponse>> register(@Valid @RequestBody RegisterRequest request) {
        TokenResponse tokens = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.of(tokens, "Account created"));
    }

    @PostMapping("/login")
    @Operation(summary = "Exchange credentials for tokens",
            description = "Accepts a username or an e-mail address and returns an access token "
                    + "(default 30 min) plus a refresh token (default 7 days). "
                    + "Responses: 200 authenticated, 401 invalid credentials, 403 account disabled.")
    public ApiResponse<TokenResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.of(authService.login(request), "Authenticated");
    }

    @PostMapping("/refresh")
    @Operation(summary = "Refresh an access token",
            description = "Validates a refresh token and issues a new token pair. "
                    + "Responses: 200 refreshed, 401 invalid or expired refresh token.")
    public ApiResponse<TokenResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return ApiResponse.of(authService.refresh(request), "Token refreshed");
    }
}
