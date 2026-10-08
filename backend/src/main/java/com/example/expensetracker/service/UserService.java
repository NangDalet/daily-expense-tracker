package com.example.expensetracker.service;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

import com.example.expensetracker.config.PaginationProperties;
import com.example.expensetracker.convert.UserConvert;
import com.example.expensetracker.domain.Role;
import com.example.expensetracker.domain.User;
import com.example.expensetracker.dto.request.CreateUserRequest;
import com.example.expensetracker.dto.request.UpdateUserRequest;
import com.example.expensetracker.dto.response.ApiResponse;
import com.example.expensetracker.dto.response.UserResponse;
import com.example.expensetracker.exception.ApiException;
import com.example.expensetracker.exception.BusinessRuleException;
import com.example.expensetracker.exception.DuplicateResourceException;
import com.example.expensetracker.exception.ErrorCode;
import com.example.expensetracker.exception.ResourceNotFoundException;
import com.example.expensetracker.mapper.UserMapper;
import com.example.expensetracker.security.CurrentUser;

import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Administrative user management.
 * <p>
 * Authorisation is rank based rather than role-equality based, which is what
 * makes a super administrator able to handle every account. The rules are:
 * <ol>
 *   <li>an {@code ADMIN} may only manage accounts below their own tier, so
 *       neither a peer administrator nor a super administrator can be touched by
 *       one - a {@code SUPER_ADMIN} is checked against nothing and can handle
 *       every account, including a peer super administrator;</li>
 *   <li>nobody may grant a role above their own tier, so an {@code ADMIN} can
 *       never mint a super administrator;</li>
 *   <li>the last enabled super administrator cannot be demoted, disabled or
 *       deleted, otherwise the installation would be unadministrable;</li>
 *   <li>an actor may always fix their own e-mail and display name, but cannot
 *       delete or disable their own account.</li>
 * </ol>
 * The entry points still require {@code ADMIN} via {@code @PreAuthorize}; the
 * rules here are the second line of defence and are also what the tests cover.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserMapper userMapper;
    private final UserConvert userConvert;
    private final PaginationProperties paginationProperties;
    private final PasswordEncoder passwordEncoder;
    private final DefaultCategorySeeder defaultCategorySeeder;

    // ===================== Read =====================

    @Transactional(readOnly = true)
    public ApiResponse<List<UserResponse>> list(String search, Pageable pageable) {
        Pageable safePageable = paginationProperties.sanitize(pageable);
        String normalizedSearch = search == null || search.isBlank() ? null : search.trim();

        long total = userMapper.countAll(normalizedSearch);
        if (total == 0) {
            return ApiResponse.ofPage(List.of(), safePageable.getPageNumber(), safePageable.getPageSize(), 0,
                    "No users found");
        }
        List<User> users = userMapper.findAll(normalizedSearch,
                (int) safePageable.getOffset(), safePageable.getPageSize());
        return ApiResponse.ofPage(userConvert.toResponseList(users),
                safePageable.getPageNumber(), safePageable.getPageSize(), total, "Users retrieved");
    }

    @Transactional(readOnly = true)
    public UserResponse get(UUID id) {
        return userConvert.toResponse(requireExisting(id));
    }

    // ===================== Create =====================

    /**
     * Creates an account with an explicit role set. Reserved for super
     * administrators, because it is the only path that can mint a privileged
     * account in one call.
     */
    @Transactional
    public UserResponse create(CreateUserRequest request, CurrentUser actor) {
        requireSuperAdmin(actor);

        String username = request.getUsername().trim();
        String email = request.getEmail().trim().toLowerCase(Locale.ROOT);
        if (userMapper.countByUsernameExcludingId(username, null) > 0) {
            throw DuplicateResourceException.of("username", username);
        }
        if (userMapper.countByEmailExcludingId(email, null) > 0) {
            throw DuplicateResourceException.of("email", email);
        }

        List<String> roles = normalizeRoles(request.getRoles());
        requireGrantable(actor, roles);

        User user = User.builder()
                .username(username)
                .email(email)
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName() == null || request.getFullName().isBlank()
                        ? username : request.getFullName().trim())
                .roles(roles)
                .enabled(request.getEnabled() == null || request.getEnabled())
                .build();

        userMapper.insert(user);
        defaultCategorySeeder.seed(user.getId());

        log.info("Super administrator {} created user {} with roles {}", actor.id(), username, roles);
        return userConvert.toResponse(requireExisting(user.getId()));
    }

    // ===================== Update =====================

    @Transactional
    public UserResponse update(UUID id, UpdateUserRequest request, CurrentUser actor) {
        User user = requireExisting(id);
        boolean self = actor.isSelf(id);
        if (!self) {
            requireManages(actor, user, "modify");
        }
        // Captured before any mutation, because the guard below has to reason
        // about the role the account holds *today*.
        Role previousRole = Role.highestOf(user.getRoles());

        if (request.getEmail() != null) {
            String email = request.getEmail().trim().toLowerCase(Locale.ROOT);
            if (userMapper.countByEmailExcludingId(email, id) > 0) {
                throw DuplicateResourceException.of("email", email);
            }
            user.setEmail(email);
        }
        if (request.getFullName() != null) {
            user.setFullName(request.getFullName().trim());
        }

        List<String> roles = null;
        if (request.getRoles() != null) {
            roles = normalizeRoles(request.getRoles());
            // Rejects an actor promoting anybody - including themselves - above
            // their own tier.
            requireGrantable(actor, roles);
            user.setRoles(roles);
        }

        if (request.getEnabled() != null) {
            if (self && Boolean.FALSE.equals(request.getEnabled())) {
                throw new BusinessRuleException("You cannot disable your own account");
            }
            user.setEnabled(request.getEnabled());
        }

        // Evaluated once the pending changes are known, so demoting and
        // disabling in the same request cannot slip past the guard.
        if (roles != null || request.getEnabled() != null) {
            requireNotLastSuperAdmin(previousRole, id, roles, !Boolean.FALSE.equals(user.getEnabled()), "modified");
        }

        userMapper.update(user);
        log.info("User {} updated by {} ({})", id, actor.id(), actor.highestRole());
        return userConvert.toResponse(requireExisting(id));
    }

    /** Replacing a password, for accounts that can no longer be signed into. */
    @Transactional
    public void resetPassword(UUID id, String rawPassword, CurrentUser actor) {
        requireSuperAdmin(actor);
        User user = requireExisting(id);
        requireManages(actor, user, "reset the password of");

        // Only the hash is persisted; the plain text stops here.
        user.setPassword(passwordEncoder.encode(rawPassword));
        userMapper.update(user);
        log.info("Password of user {} reset by {} ({})", id, actor.id(), actor.highestRole());
    }

    // ===================== Delete =====================

    /** Deleting an account cascades to its categories, expenses and budgets. */
    @Transactional
    public void delete(UUID id, CurrentUser actor) {
        if (actor.isSelf(id)) {
            throw new BusinessRuleException("An administrator cannot delete their own account");
        }
        User user = requireExisting(id);
        requireManages(actor, user, "delete");
        requireNotLastSuperAdmin(Role.highestOf(user.getRoles()), id, null, false, "deleted");

        userMapper.deleteById(id);
        log.info("User {} deleted by {} ({})", id, actor.id(), actor.highestRole());
    }

    // ===================== Authorisation rules =====================

    /** Guards the two operations only a super administrator may perform. */
    private void requireSuperAdmin(CurrentUser actor) {
        if (!actor.isSuperAdmin()) {
            throw new ApiException(ErrorCode.FORBIDDEN, "This action requires the super administrator role");
        }
    }

    /**
     * An {@code ADMIN} may only act on accounts below their own tier, so they can
     * never touch a peer administrator or a super administrator.
     * <p>
     * A {@code SUPER_ADMIN} outranks every tier and is therefore allowed through.
     * That includes peer super administrators, which is deliberate: managing
     * <em>every</em> account is the point of the role, and it is the only way a
     * rogue or unreachable super administrator can ever be demoted or removed.
     * The self rules in {@link #delete} and {@link #update} still apply to a
     * super administrator acting on their own account.
     */
    private void requireManages(CurrentUser actor, User target, String action) {
        if (actor.isSuperAdmin()) {
            return;
        }
        Role targetRole = Role.highestOf(target.getRoles());
        if (targetRole.rank() >= actor.rank()) {
            // Phrased without an article so it reads correctly for every tier.
            throw new ApiException(ErrorCode.FORBIDDEN,
                    "Cannot " + action + " an account holding the " + targetRole + " role (you are "
                            + actor.highestRole() + ")");
        }
    }

    /**
     * Nobody may hand out a role above their own tier. Because an actor's tier
     * is read from their own roles, this also blocks self-promotion.
     */
    private void requireGrantable(CurrentUser actor, List<String> roles) {
        for (String name : roles) {
            Role role = Role.parse(name);
            if (role != null && role.rank() > actor.rank()) {
                throw new ApiException(ErrorCode.FORBIDDEN,
                        "You cannot grant the " + role + " role");
            }
        }
    }

    /**
     * Keeps at least one enabled super administrator in existence. Only
     * evaluated for accounts that actually hold the role today, and only when
     * the pending change would take it away or disable the account.
     *
     * @param previousRole the role the account holds before this request
     * @param pendingRoles the role set being written, or {@code null} if unchanged
     * @param stillEnabled the enabled flag the row will end up with
     */
    private void requireNotLastSuperAdmin(Role previousRole, UUID id, List<String> pendingRoles,
                                          boolean stillEnabled, String action) {
        if (previousRole != Role.SUPER_ADMIN) {
            return;
        }
        if (stillEnabled && (pendingRoles == null || pendingRoles.contains(Role.SUPER_ADMIN.name()))) {
            return;
        }
        // The account being changed never counts itself, so "0 remaining" means
        // this is the last one standing.
        if (userMapper.countEnabledByRole(Role.SUPER_ADMIN.name(), id) == 0) {
            throw new BusinessRuleException("The last super administrator cannot be " + action);
        }
    }

    // ===================== Internals =====================

    private User requireExisting(UUID id) {
        User user = userMapper.findById(id);
        if (user == null) {
            throw ResourceNotFoundException.of("User", id);
        }
        return user;
    }

    /**
     * Keeps only known roles, upper-cases them and always leaves at least
     * {@code USER}. Unknown entries are dropped rather than rejected so a client
     * sending a stale role list still gets a sane result.
     */
    private List<String> normalizeRoles(List<String> roles) {
        if (roles == null || roles.isEmpty()) {
            return List.of(Role.USER.name());
        }
        List<String> valid = roles.stream()
                .filter(role -> role != null && !role.isBlank())
                .map(role -> role.trim().toUpperCase(Locale.ROOT))
                .map(Role::parse)
                .filter(role -> role != null)
                .map(Enum::name)
                .distinct()
                .toList();
        return valid.isEmpty() ? List.of(Role.USER.name()) : valid;
    }
}
