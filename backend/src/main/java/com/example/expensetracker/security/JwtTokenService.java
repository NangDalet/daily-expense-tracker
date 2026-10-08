package com.example.expensetracker.security;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.example.expensetracker.domain.Role;
import com.example.expensetracker.domain.User;

import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Issues locally signed JWTs for the {@code /api/v1/auth/*} endpoints.
 * <p>
 * Claim layout (deliberately compatible with the common providers so the
 * frontend and Swagger work unchanged when {@code OAUTH_ISSUER_URI} is set):
 * <pre>
 * access : iss, sub(userId), typ=access, username, email, name, roles[], scope, iat, exp, jti
 * refresh: iss, sub(userId), typ=refresh, username, iat, exp, jti
 * </pre>
 * {@code sub} carries the user id because that is what
 * {@code JwtRoleConverter} and {@code SecurityUtils.currentUserId} expect.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JwtTokenService {

    /** Marker claim that separates the two token types issued by this service. */
    public static final String CLAIM_TYPE = "typ";
    public static final String CLAIM_USERNAME = "username";
    public static final String CLAIM_EMAIL = "email";
    public static final String CLAIM_NAME = "name";
    public static final String CLAIM_ROLES = "roles";

    public static final String TYPE_ACCESS = "access";
    public static final String TYPE_REFRESH = "refresh";

    private final JwtEncoder jwtEncoder;
    private final JwtProperties jwtProperties;

    /** Result of issuing one token - the caller decides which fields to expose. */
    public record IssuedToken(String value, Instant expiresAt) {
    }

    public IssuedToken createAccessToken(User user) {
        Instant now = Instant.now();
        Instant expiry = now.plus(jwtProperties.getAccessTokenTtl());
        List<String> roles = normalizeRoles(user.getRoles());

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(jwtProperties.getIssuer())
                .subject(user.getId().toString())
                .issuedAt(now)
                .expiresAt(expiry)
                .id(UUID.randomUUID().toString())
                .claim(CLAIM_TYPE, TYPE_ACCESS)
                .claim(CLAIM_USERNAME, user.getUsername())
                .claim(CLAIM_EMAIL, user.getEmail())
                .claim(CLAIM_NAME, user.getFullName())
                // Array claim - the primary source of authorities...
                .claim(CLAIM_ROLES, roles)
                // ...plus the OAuth2 standard space delimited scope as a fallback
                .claim("scope", String.join(" ", roles))
                .build();

        log.debug("Issued access token for user {} valid until {}", user.getId(), expiry);
        return new IssuedToken(encode(claims), expiry);
    }

    public IssuedToken createRefreshToken(User user) {
        Instant now = Instant.now();
        Instant expiry = now.plus(jwtProperties.getRefreshTokenTtl());

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(jwtProperties.getIssuer())
                .subject(user.getId().toString())
                .issuedAt(now)
                .expiresAt(expiry)
                .id(UUID.randomUUID().toString())
                .claim(CLAIM_TYPE, TYPE_REFRESH)
                .claim(CLAIM_USERNAME, user.getUsername())
                .build();

        log.debug("Issued refresh token for user {} valid until {}", user.getId(), expiry);
        return new IssuedToken(encode(claims), expiry);
    }

    private String encode(JwtClaimsSet claims) {
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).type("JWT").build();
        return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    /** Never issue a token without a role; an authenticated but authority-less user would be useless. */
    private List<String> normalizeRoles(List<String> roles) {
        if (roles == null || roles.isEmpty()) {
            return List.of(Role.USER.name());
        }
        return roles.stream()
                .filter(role -> role != null && !role.isBlank())
                .map(String::trim)
                .distinct()
                .toList();
    }
}
