package com.example.expensetracker.domain;

import java.util.List;
import java.util.Locale;

/**
 * Roles recognised by the application, ordered from least to most privileged.
 * <p>
 * The values are stored verbatim in the {@code users.roles} column and are
 * turned into Spring authorities by {@code JwtAuthenticationConverter}
 * (prefixed with {@code ROLE_}).
 * <p>
 * The declaration order <em>is</em> the privilege order: {@link #rank()} is the
 * ordinal, so {@code USER < ADMIN < SUPER_ADMIN}. Every authorisation decision
 * that involves two different accounts is expressed with ranks rather than with
 * role equality, which is what lets a super administrator manage every account
 * while an administrator can only manage accounts below their own tier.
 */
public enum Role {

    /** Regular account: manages only its own expenses, categories and budgets. */
    USER,

    /** May list, edit, disable and delete accounts ranked below {@link #ADMIN}. */
    ADMIN,

    /** May manage every account, including other administrators. */
    SUPER_ADMIN;

    /** {@code ROLE_ADMIN} - the representation Spring Security expects. */
    public String authority() {
        return "ROLE_" + name();
    }

    /** Privilege level; higher outranks lower. */
    public int rank() {
        return ordinal();
    }

    public boolean atLeast(Role other) {
        return rank() >= other.rank();
    }

    /**
     * Lenient lookup used for the free-text role lists that arrive over the wire.
     *
     * @return the matching role, or {@code null} when the value is blank or
     *         unknown - callers decide whether to reject or to drop it.
     */
    public static Role parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    /**
     * Most privileged role held by the given authority names. Unknown entries are
     * ignored and an empty or {@code null} list resolves to {@link #USER}, so a
     * caller can always rely on getting a rank back.
     */
    public static Role highestOf(List<String> roles) {
        Role highest = USER;
        if (roles != null) {
            for (String raw : roles) {
                Role candidate = parse(raw);
                if (candidate != null && candidate.rank() > highest.rank()) {
                    highest = candidate;
                }
            }
        }
        return highest;
    }
}
