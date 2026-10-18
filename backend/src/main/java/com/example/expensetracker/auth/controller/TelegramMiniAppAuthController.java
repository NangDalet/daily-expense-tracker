package com.example.expensetracker.auth.controller;

import com.example.expensetracker.auth.model.response.TokenResponse;
import com.example.expensetracker.auth.model.request.LoginRequest;
import com.example.expensetracker.auth.model.request.RegisterRequest;
import com.example.expensetracker.auth.service.TelegramMiniAppAuthService;
import com.example.expensetracker.common.model.response.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.http.HttpStatus;

@RestController
@RequiredArgsConstructor
public class TelegramMiniAppAuthController {
    private final TelegramMiniAppAuthService service;

    public record TelegramLoginRequest(@NotBlank @Size(max = 16384) String initData) {}
    public record LinkedLoginRequest(@NotNull @Valid LoginRequest credentials,
            @NotBlank @Size(max = 16384) String initData) {}
    public record LinkedRegistrationRequest(@NotNull @Valid RegisterRequest account,
            @NotBlank @Size(max = 16384) String initData) {}

    @PostMapping("/api/v1/auth/telegram")
    public ApiResponse<TokenResponse> login(@Valid @RequestBody TelegramLoginRequest request) {
        return ApiResponse.of(service.login(request.initData()), "Signed in with Telegram");
    }

    @PostMapping("/api/v1/auth/telegram/login")
    public ApiResponse<TokenResponse> loginAndConnect(@Valid @RequestBody LinkedLoginRequest request) {
        return ApiResponse.of(service.loginAndConnect(request.credentials(), request.initData()), "Signed in and connected to Telegram");
    }

    @PostMapping("/api/v1/auth/telegram/register")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<TokenResponse> registerAndConnect(@Valid @RequestBody LinkedRegistrationRequest request) {
        return ApiResponse.of(service.registerAndConnect(request.account(), request.initData()), "Account created and connected to Telegram");
    }
}
