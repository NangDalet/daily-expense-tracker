package com.example.expensetracker.security;

import java.util.List;
import java.util.UUID;

import com.example.expensetracker.domain.Role;
import com.example.expensetracker.exception.ApiException;
import com.example.expensetracker.exception.ErrorCode;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/** Helpers to read the identity carried by the current JWT. */
public final class SecurityUtils {

    private SecurityUtils() {
    }

    /**
     * The {@code sub} claim holds the user id (see {@link JwtTokenService}).
     * A token with a non-UUID subject is rejected instead of silently ignored.
     */
    public static UUID currentUserId(Jwt jwt) {
        if (jwt == null) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, ErrorCode.UNAUTHORIZED.defaultMessage());
        }
        return parseUuid(jwt.getSubject());
    }

    public static UUID currentUserId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, ErrorCode.UNAUTHORIZED.defaultMessage());
        }
        if (authentication instanceof JwtAuthenticationToken jwtAuthentication) {
            return currentUserId(jwtAuthentication.getToken());
        }
        return parseUuid(authentication.getName());
    }

    /** Reads the user id of the authenticated caller, or {@code null} for anonymous requests. */
    public static UUID currentUserIdOrNull() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        return currentUserId(authentication);
    }

    public static String currentUsername(Jwt jwt) {
        if (jwt == null) {
            return null;
        }
        Object username = jwt.getClaims().get(JwtTokenService.CLAIM_USERNAME);
        return username != null ? String.valueOf(username) : jwt.getSubject();
    }

    /**
     * Effective roles of the token: the {@code roles} claim when present,
     * otherwise the authorities that were derived from {@code scope}.
     */
    public static List<String> currentRoles(Jwt jwt) {
        if (jwt == null) {
            return List.of();
        }
        List<String> roles = jwt.getClaimAsStringList(JwtTokenService.CLAIM_ROLES);
        if (roles != null && !roles.isEmpty()) {
            return roles;
        }
        return authentication() == null
                ? List.of()
                : authentication().getAuthorities().stream()
                        .map(authority -> authority.getAuthority().replaceFirst("^ROLE_", ""))
                        .toList();
    }

    /**
     * The acting administrator. Throws {@code UNAUTHORIZED} for an absent token,
     * consistent with {@link #currentUserId(Jwt)}.
     */
    public static CurrentUser currentUser(Jwt jwt) {
        return new CurrentUser(currentUserId(jwt), Role.highestOf(currentRoles(jwt)));
    }

    /** True for {@code ADMIN} and {@code SUPER_ADMIN} alike. */
    public static boolean isAdmin(Jwt jwt) {
        return Role.highestOf(currentRoles(jwt)).atLeast(Role.ADMIN);
    }

    public static boolean isSuperAdmin(Jwt jwt) {
        return Role.highestOf(currentRoles(jwt)) == Role.SUPER_ADMIN;
    }

    private static Authentication authentication() {
        return SecurityContextHolder.getContext().getAuthentication();
    }

    private static UUID parseUuid(String raw) {
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "Token subject is not a valid user id");
        }
    }
}
