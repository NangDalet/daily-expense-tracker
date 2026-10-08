package com.example.expensetracker.service;

import static com.example.expensetracker.support.TestFixtures.OTHER_USER_ID;
import static com.example.expensetracker.support.TestFixtures.USER_ID;
import static com.example.expensetracker.support.TestFixtures.user;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.example.expensetracker.domain.Category;
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
import com.example.expensetracker.mapper.CategoryMapper;
import com.example.expensetracker.mapper.UserMapper;
import com.example.expensetracker.security.JwtProperties;
import com.example.expensetracker.security.JwtTokenService;
import com.example.expensetracker.support.TestFixtures;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("AuthService")
class AuthServiceTest {

    private static final String RAW_PASSWORD = "S3cret-pass!";

    /** The hash {@link TestFixtures#user} puts on the user row. */
    private static final String STORED_HASH = "$2a$10$abcdefghijklmnopqrstuv";

    @Mock
    private UserMapper userMapper;

    @Mock
    private CategoryMapper categoryMapper;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtTokenService jwtTokenService;

    @Mock
    private org.springframework.security.oauth2.jwt.JwtDecoder jwtDecoder;

    private JwtProperties jwtProperties;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        jwtProperties = new JwtProperties();
        jwtProperties.setSecret("test-secret-key-that-is-long-enough-for-hs256-algorithm");
        jwtProperties.setIssuer("daily-expense-tracker-test");
        jwtProperties.setAccessTokenTtl(java.time.Duration.ofMinutes(30));

        authService = new AuthService(userMapper, TestFixtures.userConvert(), passwordEncoder,
                jwtTokenService, jwtDecoder, jwtProperties, TestFixtures.defaultCategorySeeder(categoryMapper));

        when(jwtTokenService.createAccessToken(any()))
                .thenReturn(new JwtTokenService.IssuedToken("access.jwt.token", Instant.now().plusSeconds(1800)));
        when(jwtTokenService.createRefreshToken(any()))
                .thenReturn(new JwtTokenService.IssuedToken("refresh.jwt.token", Instant.now().plusSeconds(604800)));
        when(passwordEncoder.encode(anyString())).thenReturn("$2a$10$hashedpasswordvalue000000000000000000000000000000000");
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);
    }

    // ===================== Register =====================

    @Test
    @DisplayName("registers a user, hashes the password and seeds the default categories")
    void registersUser() {
        when(userMapper.insert(any())).thenAnswer(invocation -> {
            invocation.<User>getArgument(0).setId(USER_ID);
            return 1;
        });
        when(userMapper.findById(USER_ID)).thenReturn(user(USER_ID, "dana"));

        TokenResponse response = authService.register(RegisterRequest.builder()
                .username("dana")
                .email("Dana@Example.COM")
                .password(RAW_PASSWORD)
                .fullName("Dana Doe")
                .build());

        assertThat(response.getAccessToken()).isEqualTo("access.jwt.token");
        assertThat(response.getRefreshToken()).isEqualTo("refresh.jwt.token");
        assertThat(response.getTokenType()).isEqualTo("Bearer");
        assertThat(response.getExpiresIn()).isEqualTo(1800L);
        assertThat(response.getUser().getId()).isEqualTo(USER_ID.toString());

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userMapper).insert(captor.capture());
        assertThat(captor.getValue().getPassword()).startsWith("$2a$").isNotEqualTo(RAW_PASSWORD);
        assertThat(captor.getValue().getEmail()).isEqualTo("dana@example.com");
        assertThat(captor.getValue().getRoles()).containsExactly("USER");
        assertThat(captor.getValue().getEnabled()).isTrue();

        // 8 default categories
        verify(categoryMapper, times(8)).insert(any(Category.class));
    }

    @Test
    @DisplayName("falls back to the username when no display name is given")
    void fallsBackToUsername() {
        when(userMapper.insert(any())).thenAnswer(invocation -> {
            invocation.<User>getArgument(0).setId(USER_ID);
            return 1;
        });
        when(userMapper.findById(USER_ID)).thenReturn(user(USER_ID, "dana"));

        authService.register(RegisterRequest.builder()
                .username("dana")
                .email("dana@example.com")
                .password(RAW_PASSWORD)
                .fullName("   ")
                .build());

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userMapper).insert(captor.capture());
        assertThat(captor.getValue().getFullName()).isEqualTo("dana");
    }

    @Test
    @DisplayName("rejects a duplicate username before touching the database")
    void rejectsDuplicateUsername() {
        when(userMapper.countByUsernameExcludingId("dana", null)).thenReturn(1L);

        assertThatThrownBy(() -> authService.register(RegisterRequest.builder()
                .username("dana")
                .email("dana@example.com")
                .password(RAW_PASSWORD)
                .build()))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("username");

        verify(userMapper, never()).insert(any());
    }

    @Test
    @DisplayName("rejects a duplicate e-mail")
    void rejectsDuplicateEmail() {
        when(userMapper.countByEmailExcludingId("dana@example.com", null)).thenReturn(1L);

        assertThatThrownBy(() -> authService.register(RegisterRequest.builder()
                .username("dana")
                .email("dana@example.com")
                .password(RAW_PASSWORD)
                .build()))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("email");
    }

    // ===================== Login =====================

    @Test
    @DisplayName("authenticates by username")
    void logsInWithUsername() {
        when(userMapper.findByUsername("demo")).thenReturn(user(USER_ID, "demo"));

        TokenResponse response = authService.login(LoginRequest.builder()
                .username("demo")
                .password("Demo@123")
                .build());

        assertThat(response.getUser().getUsername()).isEqualTo("demo");
        verify(userMapper, never()).findByEmail(anyString());
    }

    @Test
    @DisplayName("authenticates by e-mail when the username is unknown")
    void logsInWithEmail() {
        when(userMapper.findByEmail("demo@example.com")).thenReturn(user(USER_ID, "demo"));

        assertThat(authService.login(LoginRequest.builder()
                .username("demo@example.com")
                .password("Demo@123")
                .build()).getAccessToken()).isEqualTo("access.jwt.token");
    }

    @Test
    @DisplayName("rejects an unknown user with the same message as a wrong password")
    void rejectsUnknownUser() {
        when(userMapper.findByUsername("ghost")).thenReturn(null);
        when(userMapper.findByEmail("ghost")).thenReturn(null);

        assertThatThrownBy(() -> authService.login(LoginRequest.builder()
                .username("ghost")
                .password("whatever")
                .build()))
                .isInstanceOf(AuthenticationException.class)
                .hasMessage("Invalid username or password");
    }

    @Test
    @DisplayName("rejects a wrong password")
    void rejectsWrongPassword() {
        when(userMapper.findByUsername("demo")).thenReturn(user(USER_ID, "demo"));
        // the raw password is compared against the hash stored on the user row
        when(passwordEncoder.matches("wrong", STORED_HASH)).thenReturn(false);

        assertThatThrownBy(() -> authService.login(LoginRequest.builder()
                .username("demo")
                .password("wrong")
                .build()))
                .isInstanceOf(AuthenticationException.class)
                .hasMessage("Invalid username or password");
    }

    @Test
    @DisplayName("refuses a disabled account with 403")
    void refusesDisabledAccount() {
        User disabled = user(USER_ID, "demo");
        disabled.setEnabled(false);
        when(userMapper.findByUsername("demo")).thenReturn(disabled);

        assertThatThrownBy(() -> authService.login(LoginRequest.builder()
                .username("demo")
                .password("Demo@123")
                .build()))
                .isInstanceOf(AuthenticationException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    // ===================== Refresh =====================

    @Test
    @DisplayName("exchanges a valid refresh token for a new pair")
    void refreshesToken() {
        // the subject of a refresh token is the user id
        when(jwtDecoder.decode("refresh.jwt.token"))
                .thenReturn(refreshJwt(USER_ID.toString(), JwtTokenService.TYPE_REFRESH));
        when(userMapper.findById(USER_ID)).thenReturn(user(USER_ID, "demo"));

        assertThat(authService.refresh(RefreshTokenRequest.builder()
                .refreshToken("refresh.jwt.token")
                .build()).getAccessToken()).isEqualTo("access.jwt.token");
    }

    @Test
    @DisplayName("refuses to use an access token as a refresh token")
    void refusesAccessTokenAsRefreshToken() {
        when(jwtDecoder.decode("access.jwt.token"))
                .thenReturn(refreshJwt(USER_ID.toString(), JwtTokenService.TYPE_ACCESS));

        assertThatThrownBy(() -> authService.refresh(RefreshTokenRequest.builder()
                .refreshToken("access.jwt.token")
                .build()))
                .isInstanceOf(AuthenticationException.class)
                .hasMessageContaining("not a refresh token");
    }

    @Test
    @DisplayName("rejects an expired or tampered refresh token")
    void rejectsInvalidRefreshToken() {
        when(jwtDecoder.decode("garbage"))
                .thenThrow(new org.springframework.security.oauth2.jwt.JwtException("invalid"));

        assertThatThrownBy(() -> authService.refresh(RefreshTokenRequest.builder()
                .refreshToken("garbage")
                .build()))
                .isInstanceOf(AuthenticationException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.TOKEN_EXPIRED);
    }

    @Test
    @DisplayName("reports a refresh token whose user no longer exists")
    void reportsMissingUser() {
        UUID deletedUserId = UUID.randomUUID();
        when(jwtDecoder.decode("refresh.jwt.token"))
                .thenReturn(refreshJwt(deletedUserId.toString(), JwtTokenService.TYPE_REFRESH));
        when(userMapper.findById(deletedUserId)).thenReturn(null);

        assertThatThrownBy(() -> authService.refresh(RefreshTokenRequest.builder()
                .refreshToken("refresh.jwt.token")
                .build())).isInstanceOf(ResourceNotFoundException.class);
    }

    // ===================== External issuer mode =====================

    @Test
    @DisplayName("disables the local flow when an external issuer is configured")
    void disablesLocalFlowInOidcMode() {
        jwtProperties.setIssuerUri("http://localhost:8081/realms/expenses");

        assertThatThrownBy(() -> authService.login(LoginRequest.builder()
                .username("demo")
                .password("Demo@123")
                .build()))
                .isInstanceOf(ApiException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.SERVICE_UNAVAILABLE);
        verify(userMapper, never()).findByUsername(anyString());
    }

    @Test
    @DisplayName("never leaks another user's token on refresh")
    void refreshIsScopedToTheTokenSubject() {
        when(jwtDecoder.decode("refresh.jwt.token"))
                .thenReturn(refreshJwt(OTHER_USER_ID.toString(), JwtTokenService.TYPE_REFRESH));
        when(userMapper.findById(OTHER_USER_ID)).thenReturn(user(OTHER_USER_ID, "other"));

        assertThat(authService.refresh(RefreshTokenRequest.builder()
                .refreshToken("refresh.jwt.token")
                .build()).getUser().getId()).isEqualTo(OTHER_USER_ID.toString());
        verify(userMapper).findById(eq(OTHER_USER_ID));
    }

    @Test
    @DisplayName("keeps the roles of the persisted user in the token response")
    void returnsRoles() {
        User admin = user(USER_ID, "admin");
        admin.setRoles(List.of("ADMIN", "USER"));
        when(userMapper.findByUsername("admin")).thenReturn(admin);

        assertThat(authService.login(LoginRequest.builder()
                .username("admin")
                .password("Admin@123")
                .build()).getUser().getRoles()).containsExactly("ADMIN", "USER");
    }

    private org.springframework.security.oauth2.jwt.Jwt refreshJwt(String subject, String type) {
        return org.springframework.security.oauth2.jwt.Jwt.withTokenValue("refresh.jwt.token")
                .header("alg", "HS256")
                .subject(subject)
                .claim(JwtTokenService.CLAIM_TYPE, type)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(600))
                .build();
    }
}
