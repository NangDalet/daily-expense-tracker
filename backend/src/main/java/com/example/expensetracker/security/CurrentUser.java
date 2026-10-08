package com.example.expensetracker.security;

import java.util.UUID;

import com.example.expensetracker.domain.Role;

/**
 * The acting administrator of the current request, reduced to the two facts the
 * authorisation rules need: who they are and how privileged they are.
 * <p>
 * Built from the JWT by {@link SecurityUtils#currentUser}. The tier is taken
 * from the token rather than re-read from the database so that a demotion takes
 * effect when the token is refreshed instead of at the next page reload.
 *
 * @param id          the user id, taken from the {@code sub} claim
 * @param highestRole the most privileged authority in the token
 */
public record CurrentUser(UUID id, Role highestRole) {

    public int rank() {
        return highestRole.rank();
    }

    public boolean isSelf(UUID otherUserId) {
        return otherUserId != null && otherUserId.equals(id);
    }

    public boolean isSuperAdmin() {
        return highestRole == Role.SUPER_ADMIN;
    }
}
