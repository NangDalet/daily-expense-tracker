package com.example.expensetracker.auth.service;

import com.example.expensetracker.auth.model.response.TokenResponse;
import com.example.expensetracker.auth.model.request.LoginRequest;
import com.example.expensetracker.auth.model.request.RegisterRequest;
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
import org.springframework.dao.DuplicateKeyException;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TelegramMiniAppAuthService {
    private final TelegramInitDataValidator validator;
    private final TelegramMapper telegram;
    private final UserMapper users;
    private final UserConvert convert;
    private final JwtTokenService tokens;
    private final JwtProperties jwtProperties;
    private final AuthService authService;

    @Transactional(readOnly = true)
    public TokenResponse login(String initData) {
        if (jwtProperties.usesExternalIssuer()) {
            throw new ApiException(ErrorCode.SERVICE_UNAVAILABLE, "Telegram sign-in requires local JWT authentication");
        }
        long telegramUserId = validator.validate(initData);
        var userId = telegram.findUserIdByChatId(telegramUserId);
        if (userId == null) {
            throw new AuthenticationException(ErrorCode.FORBIDDEN,
                    "Sign in once to connect this Telegram account automatically. Future Mini App launches will sign you in.");
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

    @Transactional
    public TokenResponse loginAndConnect(LoginRequest credentials, String initData) {
        long telegramId = validator.validate(initData);
        TokenResponse session = authService.login(credentials);
        connectAccount(UUID.fromString(session.getUser().getId()), telegramId);
        return session;
    }

    @Transactional
    public TokenResponse registerAndConnect(RegisterRequest account, String initData) {
        long telegramId = validator.validate(initData);
        TokenResponse session = authService.register(account);
        connectAccount(UUID.fromString(session.getUser().getId()), telegramId);
        return session;
    }

    private void connectAccount(UUID userId, long telegramId) {
        // Serialize competing links to the same application account.
        if (telegram.lockUser(userId) == null) throw new AuthenticationException("Account is unavailable");
        var user = users.findById(userId);
        if (user == null || !Boolean.TRUE.equals(user.getEnabled())) {
            throw new AuthenticationException(ErrorCode.FORBIDDEN, "Account is unavailable or disabled");
        }
        var existing = telegram.find(userId);
        if (existing != null && existing.getChatId() != null && existing.getChatId() != telegramId) {
            throw new ApiException(ErrorCode.CONFLICT,
                    "This account is connected to another Telegram account. Disconnect it from Telegram settings first.");
        }
        var owner = telegram.findOwnerByChatId(telegramId);
        if (owner != null && !owner.equals(userId)) throw alreadyConnected();
        try {
            // A conditional upsert and the unique chat ID also protect against concurrent bot links.
            if (telegram.connectMiniApp(userId, telegramId) != 1) throw alreadyConnected();
        } catch (DuplicateKeyException ex) {
            throw alreadyConnected();
        }
        if (existing == null || existing.getChatId() == null || !Boolean.TRUE.equals(existing.getEnabled())) {
            telegram.clearPending(userId);
        }
    }

    private static ApiException alreadyConnected() {
        return new ApiException(ErrorCode.CONFLICT,
                "This Telegram account is already connected to another account. Sign in with that account or disconnect the existing link first.");
    }
}
