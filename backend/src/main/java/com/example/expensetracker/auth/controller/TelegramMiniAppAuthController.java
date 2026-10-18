package com.example.expensetracker.auth.controller;

import com.example.expensetracker.auth.model.response.TokenResponse;
import com.example.expensetracker.auth.service.TelegramMiniAppAuthService;
import com.example.expensetracker.common.model.response.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class TelegramMiniAppAuthController {
    private final TelegramMiniAppAuthService service;

    public record TelegramLoginRequest(@NotBlank @Size(max = 16384) String initData) {}

    @PostMapping("/api/v1/auth/telegram")
    public ApiResponse<TokenResponse> login(@Valid @RequestBody TelegramLoginRequest request) {
        return ApiResponse.of(service.login(request.initData()), "Signed in with Telegram");
    }
}
