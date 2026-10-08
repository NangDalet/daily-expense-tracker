package com.example.expensetracker.security;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;

/**
 * Turns a validated {@link Jwt} into a Spring {@code Authentication}.
 * <p>
 * Authority resolution order:
 * <ol>
 *   <li>the {@code roles} claim when it is a JSON array (Keycloak, Auth0 custom claim, our own tokens)</li>
 *   <li>the {@code realm_access.roles} claim (Keycloak realm roles)</li>
 *   <li>the OAuth2 {@code scope}/{@code scp} claim, space delimited</li>
 * </ol>
 * Every value is prefixed with {@code ROLE_} so {@code hasRole('ADMIN')} and
 * {@code hasAuthority('ROLE_ADMIN')} work. Values that already carry a prefix,
 * such as Keycloak's {@code ROLE_ADMIN}, are not prefixed twice.
 */
public class JwtAuthenticationConverterImpl
        implements Converter<Jwt, org.springframework.security.authentication.AbstractAuthenticationToken> {

    private final Converter<Jwt, Collection<GrantedAuthority>> authoritiesConverter = new AuthorityConverter();

    @Override
    public JwtAuthenticationToken convert(Jwt jwt) {
        return new JwtAuthenticationToken(jwt, authoritiesConverter.convert(jwt), jwt.getSubject());
    }

    /** Claim extraction, kept separate so it can be unit tested on its own. */
    static final class AuthorityConverter implements Converter<Jwt, Collection<GrantedAuthority>> {

        private static final String ROLES = "roles";
        private static final String REALM_ACCESS = "realm_access";
        private static final String PREFIX = "ROLE_";

        private final JwtGrantedAuthoritiesConverter scopeConverter = new JwtGrantedAuthoritiesConverter();

        @Override
        public Collection<GrantedAuthority> convert(Jwt jwt) {
            Set<GrantedAuthority> authorities = new LinkedHashSet<>();

            addAll(authorities, jwt.getClaimAsStringList(ROLES));
            addRealmRoles(authorities, jwt);

            if (authorities.isEmpty()) {
                // Fall back to the OAuth2 standard scope claim
                Collection<GrantedAuthority> fromScope = scopeConverter.convert(jwt);
                if (fromScope != null) {
                    authorities.addAll(fromScope);
                }
            }
            return authorities;
        }

        @SuppressWarnings("unchecked")
        private void addRealmRoles(Set<GrantedAuthority> authorities, Jwt jwt) {
            Object realmAccess = jwt.getClaims().get(REALM_ACCESS);
            if (realmAccess instanceof java.util.Map<?, ?> map) {
                Object roles = map.get(ROLES);
                if (roles instanceof List<?> roleList) {
                    roleList.stream()
                            .map(String::valueOf)
                            .forEach(role -> authorities.add(toAuthority(role)));
                }
            }
        }

        private void addAll(Set<GrantedAuthority> authorities, List<String> roles) {
            if (roles != null) {
                roles.stream()
                        .filter(role -> role != null && !role.isBlank())
                        .map(String::trim)
                        .forEach(role -> authorities.add(toAuthority(role)));
            }
        }

        private GrantedAuthority toAuthority(String role) {
            String normalized = role.startsWith(PREFIX) ? role : PREFIX + role;
            return new SimpleGrantedAuthority(normalized);
        }
    }
}
