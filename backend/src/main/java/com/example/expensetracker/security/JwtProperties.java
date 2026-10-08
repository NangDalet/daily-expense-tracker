package com.example.expensetracker.security;

import java.nio.charset.StandardCharsets;
import java.time.Duration;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

/**
 * JWT settings bound from {@code app.security.jwt.*}.
 * <p>
 * Two modes are supported:
 * <ul>
 *   <li><b>Local mode</b> ({@code issuer-uri} empty, the default): the
 *       application signs and validates its own HS256 tokens, which keeps the
 *       stack runnable without any external identity provider.</li>
 *   <li><b>Resource-server mode</b> ({@code issuer-uri} set): tokens are
 *       validated against the provider's JWK set and the local
 *       {@code /auth/login}, {@code /auth/register} and {@code /auth/refresh}
 *       endpoints are disabled.</li>
 * </ul>
 */
@ConfigurationProperties(prefix = "app.security.jwt")
public class JwtProperties {

    /** External OAuth2/OIDC issuer. Empty string or {@code null} selects local mode. */
    private String issuerUri;

    /** Value written to the {@code iss} claim of locally issued tokens. */
    private String issuer = "daily-expense-tracker";

    /** HS256 secret; at least 32 bytes for a 256 bit key. */
    private String secret;

    private Duration accessTokenTtl = Duration.ofMinutes(30);

    private Duration refreshTokenTtl = Duration.ofDays(7);

    /** Tolerance applied to {@code exp}/{@code nbf} validation. */
    private Duration clockSkew = Duration.ofSeconds(60);

    /** {@code true} when tokens are issued by an external identity provider. */
    public boolean usesExternalIssuer() {
        return StringUtils.hasText(issuerUri);
    }

    /** Raw signing key derived from {@link #getSecret()}. */
    public SecretKey secretKey() {
        byte[] keyBytes = secret == null ? new byte[0] : secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalStateException(
                    "app.security.jwt.secret must be at least 32 bytes long for HS256 (got %d)".formatted(keyBytes.length));
        }
        return new SecretKeySpec(keyBytes, "HmacSHA256");
    }

    public String getIssuerUri() {
        return issuerUri;
    }

    public void setIssuerUri(String issuerUri) {
        this.issuerUri = issuerUri;
    }

    public String getIssuer() {
        return issuer;
    }

    public void setIssuer(String issuer) {
        this.issuer = issuer;
    }

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }

    public Duration getAccessTokenTtl() {
        return accessTokenTtl;
    }

    public void setAccessTokenTtl(Duration accessTokenTtl) {
        this.accessTokenTtl = accessTokenTtl;
    }

    public Duration getRefreshTokenTtl() {
        return refreshTokenTtl;
    }

    public void setRefreshTokenTtl(Duration refreshTokenTtl) {
        this.refreshTokenTtl = refreshTokenTtl;
    }

    public Duration getClockSkew() {
        return clockSkew;
    }

    public void setClockSkew(Duration clockSkew) {
        this.clockSkew = clockSkew;
    }
}
