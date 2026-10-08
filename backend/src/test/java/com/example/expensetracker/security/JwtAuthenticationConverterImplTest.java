package com.example.expensetracker.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * The claim mapping is the most security critical piece of glue in the project:
 * it decides which {@code hasRole(...)} checks succeed, so it is covered by
 * dedicated unit tests instead of only through the filter chain.
 */
@DisplayName("JWT claim mapping")
class JwtAuthenticationConverterImplTest {

    private final JwtAuthenticationConverterImpl converter = new JwtAuthenticationConverterImpl();

    @Test
    @DisplayName("maps the roles array claim and prefixes it with ROLE_")
    void mapsRolesArray() {
        Jwt jwt = jwt(Map.of("roles", List.of("USER", "ADMIN")), null, null);

        List<String> authorities = authoritiesOf(converter.convert(jwt));

        assertThat(authorities).containsExactly("ROLE_USER", "ROLE_ADMIN");
    }

    @Test
    @DisplayName("does not prefix a claim that already carries the ROLE_ prefix")
    void keepsExistingPrefix() {
        Jwt jwt = jwt(Map.of("roles", List.of("ROLE_ADMIN")), null, null);

        assertThat(authoritiesOf(converter.convert(jwt))).containsExactly("ROLE_ADMIN");
    }

    @Test
    @DisplayName("falls back to the Keycloak realm_access.roles claim")
    void mapsRealmAccessRoles() {
        Jwt jwt = jwt(null, Map.of("roles", List.of("USER", "ADMIN")), null);

        assertThat(authoritiesOf(converter.convert(jwt))).containsExactly("ROLE_USER", "ROLE_ADMIN");
    }

    @Test
    @DisplayName("falls back to the OAuth2 scope claim when no roles claim is present")
    void mapsScopeClaim() {
        Jwt jwt = jwt(null, null, "USER ADMIN");

        assertThat(authoritiesOf(converter.convert(jwt)))
                .containsExactlyInAnyOrder("SCOPE_USER", "SCOPE_ADMIN");
    }

    @Test
    @DisplayName("prefers the roles claim over the scope claim")
    void rolesWinOverScope() {
        Jwt jwt = jwt(Map.of("roles", List.of("USER")), null, "SOMETHING_ELSE");

        assertThat(authoritiesOf(converter.convert(jwt))).containsExactly("ROLE_USER");
    }

    @Test
    @DisplayName("ignores blank and null role entries")
    void ignoresBlankRoles() {
        Jwt jwt = jwt(Map.of("roles", java.util.Arrays.asList("USER", null, "  ", "")), null, null);

        assertThat(authoritiesOf(converter.convert(jwt))).containsExactly("ROLE_USER");
    }

    @Test
    @DisplayName("tolerates a realm_access claim of an unexpected shape")
    void toleratesUnexpectedRealmAccess() {
        Jwt jwt = jwt(null, Map.of("unexpected", "shape"), null);

        AbstractAuthenticationToken token = converter.convert(jwt);

        assertThat(token.getAuthorities()).isEmpty();
        assertThat(token.getName()).isEqualTo("user-id");
    }

    @Test
    @DisplayName("uses the sub claim as the principal name")
    void usesSubjectAsPrincipal() {
        Jwt jwt = jwt(Map.of("roles", List.of("USER")), null, null);

        assertThat(converter.convert(jwt).getName()).isEqualTo("user-id");
    }

    @Test
    @DisplayName("resolves the user id from the subject claim")
    void resolvesUserId() {
        String uuid = "11111111-1111-1111-1111-111111111111";
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .subject(uuid)
                .claim("roles", List.of("USER"))
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(1800))
                .build();

        assertThat(SecurityUtils.currentUserId(jwt)).hasToString(uuid);
    }

    @Test
    @DisplayName("rejects a token whose subject is not a user id")
    void rejectsNonUuidSubject() {
        Jwt jwt = Jwt.withTokenValue("t")
                .header("alg", "HS256")
                .subject("not-a-uuid")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .build();

        assertThat(SecurityUtils.currentUserIdOrNull()).isNull();
        org.assertj.core.api.Assertions
                .assertThatThrownBy(() -> SecurityUtils.currentUserId(jwt))
                .isInstanceOf(com.example.expensetracker.exception.ApiException.class);
    }

    // ===================== helpers =====================

    private List<String> authoritiesOf(AbstractAuthenticationToken token) {
        return token.getAuthorities().stream().map(GrantedAuthority::getAuthority).toList();
    }

    private Jwt jwt(Map<String, Object> claims, Map<String, Object> realmAccess, String scope) {
        Jwt.Builder builder = Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .subject("user-id")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(1800));
        if (claims != null) {
            claims.forEach(builder::claim);
        }
        if (realmAccess != null) {
            builder.claim("realm_access", realmAccess);
        }
        if (scope != null) {
            builder.claim("scope", scope);
        }
        return builder.build();
    }
}
