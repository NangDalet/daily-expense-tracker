package com.example.expensetracker.auth.service;

import com.example.expensetracker.auth.model.response.TokenResponse;
import com.example.expensetracker.exception.ApiException;
import com.example.expensetracker.exception.AuthenticationException;
import com.example.expensetracker.exception.ErrorCode;
import com.example.expensetracker.security.JwtProperties;
import com.example.expensetracker.security.JwtTokenService;
import com.example.expensetracker.telegram.auth.TelegramInitDataValidator;
import com.example.expensetracker.telegram.mapper.TelegramMapper;
import com.example.expensetracker.user.convert.UserConvert;
import com.example.expensetracker.user.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TelegramMiniAppAuthService {
    private final TelegramInitDataValidator validator;
    private final TelegramMapper telegram;
    private final UserMapper users;
    private final UserConvert convert;
    private final JwtTokenService tokens;
    private final JwtProperties jwtProperties;

    @Transactional(readOnly = true)
    public TokenResponse login(String initData) {
        if (jwtProperties.usesExternalIssuer()) {
            throw new ApiException(ErrorCode.SERVICE_UNAVAILABLE, "Telegram sign-in requires local JWT authentication");
        }
        long telegramUserId = validator.validate(initData);
        var userId = telegram.findUserIdByChatId(telegramUserId);
        if (userId == null) {
            throw new AuthenticationException(ErrorCode.FORBIDDEN,
                    "Connect Telegram to your expense-tracker account first. Sign in, open Telegram alerts, and press Connect Telegram.");
        }
        var user = users.findById(userId);
        if (user == null || !Boolean.TRUE.equals(user.getEnabled())) {
            throw new AuthenticationException(ErrorCode.FORBIDDEN, "Account is unavailable or disabled");
        }
        return TokenResponse.builder()
                .accessToken(tokens.createAccessToken(user).value())
                .refreshToken(tokens.createRefreshToken(user).value())
                .tokenType("Bearer").expiresIn(jwtProperties.getAccessTokenTtl().toSeconds())
                .user(convert.toResponse(user)).build();
    }
}
