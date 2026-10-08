package com.example.expensetracker.service;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

import com.example.expensetracker.convert.UserConvert;
import com.example.expensetracker.domain.Role;
import com.example.expensetracker.domain.User;
import com.example.expensetracker.dto.request.LoginRequest;
import com.example.expensetracker.dto.request.RefreshTokenRequest;
import com.example.expensetracker.dto.request.RegisterRequest;
import com.example.expensetracker.dto.response.TokenResponse;
import com.example.expensetracker.exception.ApiException;
import com.example.expensetracker.exception.AuthenticationException;
import com.example.expensetracker.exception.DuplicateResourceException;
import com.example.expensetracker.exception.ErrorCode;
import com.example.expensetracker.exception.ResourceNotFoundException;
import com.example.expensetracker.mapper.UserMapper;
import com.example.expensetracker.security.JwtProperties;
import com.example.expensetracker.security.JwtTokenService;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Local authentication: registration, login and refresh-token exchange.
 * <p>
 * These endpoints only exist in <em>local</em> mode. As soon as
 * {@code OAUTH_ISSUER_URI} points at a real identity provider the provider owns
 * the credentials and the local flow is disabled with an explicit error instead
 * of silently issuing tokens the resource server would then reject.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserMapper userMapper;
    private final UserConvert userConvert;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final JwtDecoder jwtDecoder;
    private final JwtProperties jwtProperties;
    private final DefaultCategorySeeder defaultCategorySeeder;

    // ===================== Register =====================

    @Transactional
    public TokenResponse register(RegisterRequest request) {
        requireLocalAuthMode();

        String username = request.getUsername().trim();
        String email = request.getEmail().trim().toLowerCase(Locale.ROOT);

        if (userMapper.countByUsernameExcludingId(username, null) > 0) {
            throw DuplicateResourceException.of("username", username);
        }
        if (userMapper.countByEmailExcludingId(email, null) > 0) {
            throw DuplicateResourceException.of("email", email);
        }

        User user = User.builder()
                .username(username)
                .email(email)
                // BCrypt with the default strength 10; the plain password is dropped here
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName() == null || request.getFullName().isBlank()
                        ? username : request.getFullName().trim())
                .roles(List.of(Role.USER.name()))
                .enabled(true)
                .build();

        userMapper.insert(user);
        defaultCategorySeeder.seed(user.getId());

        log.info("Registered user {} (id={})", user.getUsername(), user.getId());
        return issueTokens(userMapper.findById(user.getId()));
    }

    // ===================== Login =====================

    @Transactional(readOnly = true)
    public TokenResponse login(LoginRequest request) {
        requireLocalAuthMode();

        String identifier = request.getUsername().trim();
        // A single field accepts both the username and the e-mail address
        User user = userMapper.findByUsername(identifier);
        if (user == null) {
            user = userMapper.findByEmail(identifier);
        }

        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            // Identical message for "unknown user" and "wrong password" - no user enumeration
            log.info("Failed login attempt for '{}'", identifier);
            throw new AuthenticationException("Invalid username or password");
        }
        if (Boolean.FALSE.equals(user.getEnabled())) {
            throw new AuthenticationException(ErrorCode.FORBIDDEN, "Account is disabled");
        }

        log.info("User {} authenticated", user.getUsername());
        return issueTokens(user);
    }

    // ===================== Refresh =====================

    @Transactional(readOnly = true)
    public TokenResponse refresh(RefreshTokenRequest request) {
        requireLocalAuthMode();

        Jwt jwt;
        try {
            jwt = jwtDecoder.decode(request.getRefreshToken());
        } catch (JwtException ex) {
            throw new AuthenticationException(ErrorCode.TOKEN_EXPIRED, "Refresh token is invalid or expired");
        }

        // A refresh token must not be usable as an access token
        if (!JwtTokenService.TYPE_REFRESH.equals(jwt.getClaimAsString(JwtTokenService.CLAIM_TYPE))) {
            throw new AuthenticationException(ErrorCode.TOKEN_EXPIRED, "Token is not a refresh token");
        }

        UUID userId = parseSubject(jwt);
        User user = userMapper.findById(userId);
        if (user == null) {
            throw ResourceNotFoundException.of("User", userId);
        }
        if (Boolean.FALSE.equals(user.getEnabled())) {
            throw new AuthenticationException(ErrorCode.FORBIDDEN, "Account is disabled");
        }
        return issueTokens(user);
    }

    // ===================== Internals =====================

    private TokenResponse issueTokens(User user) {
        JwtTokenService.IssuedToken accessToken = jwtTokenService.createAccessToken(user);
        JwtTokenService.IssuedToken refreshToken = jwtTokenService.createRefreshToken(user);
        long expiresIn = jwtProperties.getAccessTokenTtl().toSeconds();

        return TokenResponse.builder()
                .accessToken(accessToken.value())
                .refreshToken(refreshToken.value())
                .tokenType("Bearer")
                .expiresIn(expiresIn)
                .user(userConvert.toResponse(user))
                .build();
    }

    private void requireLocalAuthMode() {
        if (jwtProperties.usesExternalIssuer()) {
            throw new ApiException(ErrorCode.SERVICE_UNAVAILABLE,
                    "Local authentication is disabled because OAUTH_ISSUER_URI is configured. "
                            + "Use the identity provider's sign-in flow instead.");
        }
    }

    private UUID parseSubject(Jwt jwt) {
        try {
            return UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw new AuthenticationException(ErrorCode.TOKEN_EXPIRED, "Refresh token subject is invalid");
        }
    }
}
