package com.example.expensetracker.service;

import static com.example.expensetracker.support.TestFixtures.OTHER_USER_ID;
import static com.example.expensetracker.support.TestFixtures.USER_ID;
import static com.example.expensetracker.support.TestFixtures.pageable;
import static com.example.expensetracker.support.TestFixtures.user;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;

import com.example.expensetracker.config.PaginationProperties;
import com.example.expensetracker.domain.Role;
import com.example.expensetracker.domain.User;
import com.example.expensetracker.dto.request.CreateUserRequest;
import com.example.expensetracker.dto.request.UpdateUserRequest;
import com.example.expensetracker.dto.response.ApiResponse;
import com.example.expensetracker.exception.ApiException;
import com.example.expensetracker.exception.BusinessRuleException;
import com.example.expensetracker.exception.DuplicateResourceException;
import com.example.expensetracker.exception.ResourceNotFoundException;
import com.example.expensetracker.mapper.CategoryMapper;
import com.example.expensetracker.mapper.UserMapper;
import com.example.expensetracker.security.CurrentUser;
import com.example.expensetracker.serviceImpl.UserServiceImpl;
import com.example.expensetracker.support.TestFixtures;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserService")
class UserServiceTest {

    private static final UUID TARGET_ID = UUID.fromString("66666666-6666-6666-6666-666666666666");
    private static final String RAW_PASSWORD = "S3cret-pass!";
    private static final String HASHED_PASSWORD = "$2a$10$hashedpasswordvalue000000000000000000000000000000000";

    private static final CurrentUser ADMIN = new CurrentUser(USER_ID, Role.ADMIN);
    private static final CurrentUser SUPER_ADMIN = new CurrentUser(USER_ID, Role.SUPER_ADMIN);

    @Mock
    private UserMapper userMapper;

    @Mock
    private CategoryMapper categoryMapper;

    @Mock
    private PasswordEncoder passwordEncoder;

    private UserService userService;

    @BeforeEach
    void setUp() {
        userService = new UserServiceImpl(userMapper, TestFixtures.userConvert(), new PaginationProperties(),
                passwordEncoder, TestFixtures.defaultCategorySeeder(categoryMapper));
    }

    // ===================== Listing =====================

    @Test
    @DisplayName("returns a paged envelope for the admin listing")
    void listsUsers() {
        when(userMapper.countAll("da")).thenReturn(21L);
        when(userMapper.findAll("da", 0, 20)).thenReturn(List.of(user(USER_ID, "dana")));

        ApiResponse<List<com.example.expensetracker.dto.response.UserResponse>> response =
                userService.list("  da  ", pageable(0, 20));

        assertThat(response.getData()).hasSize(1);
        assertThat(response.getTotalElements()).isEqualTo(21L);
        assertThat(response.getTotalPages()).isEqualTo(2);
        // the search term is trimmed before it reaches SQL
        verify(userMapper).findAll("da", 0, 20);
    }

    @Test
    @DisplayName("turns a blank search term into a full listing")
    void blankSearchListsEverything() {
        when(userMapper.countAll(null)).thenReturn(0L);

        assertThat(userService.list("   ", pageable(0, 20)).getData()).isEmpty();
        verify(userMapper).countAll(null);
    }

    @Test
    @DisplayName("reports an unknown account as not found")
    void reportsUnknownAccount() {
        when(userMapper.findById(any())).thenReturn(null);

        assertThatThrownBy(() -> userService.get(UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(userMapper, never()).deleteById(any());
    }

    // ===================== Update =====================

    @Test
    @DisplayName("normalises the e-mail to lower case and rejects duplicates")
    void rejectsDuplicateEmail() {
        when(userMapper.findById(TARGET_ID)).thenReturn(user(TARGET_ID, "dana"));
        when(userMapper.countByEmailExcludingId("taken@example.com", TARGET_ID)).thenReturn(1L);

        assertThatThrownBy(() -> userService.update(TARGET_ID, UpdateUserRequest.builder()
                .email("TAKEN@Example.com")
                .build(), ADMIN))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("taken@example.com");
    }

    @Test
    @DisplayName("keeps only known roles, including the new super admin tier")
    void normalisesRoles() {
        User target = user(TARGET_ID, "dana");
        when(userMapper.findById(TARGET_ID)).thenReturn(target, target);

        userService.update(TARGET_ID, UpdateUserRequest.builder()
                .roles(List.of("super_admin", "admin", "user"))
                .build(), SUPER_ADMIN);

        assertThat(target.getRoles()).containsExactly("SUPER_ADMIN", "ADMIN", "USER");
    }

    @Test
    @DisplayName("falls back to USER when every requested role is unknown")
    void fallsBackToUserRole() {
        User target = user(TARGET_ID, "dana");
        when(userMapper.findById(TARGET_ID)).thenReturn(target, target);

        userService.update(TARGET_ID, UpdateUserRequest.builder().roles(List.of("wizard")).build(), ADMIN);

        assertThat(target.getRoles()).containsExactly("USER");
    }

    @Test
    @DisplayName("leaves untouched fields alone")
    void keepsUntouchedFields() {
        User target = user(TARGET_ID, "dana");
        when(userMapper.findById(TARGET_ID)).thenReturn(target, target);

        userService.update(TARGET_ID, UpdateUserRequest.builder().fullName("Dana D.").build(), ADMIN);

        assertThat(target.getEmail()).isEqualTo("dana@example.com");
        assertThat(target.getFullName()).isEqualTo("Dana D.");
        assertThat(target.getEnabled()).isTrue();
    }

    // ===================== Rank rules =====================

    @Nested
    @DisplayName("manages every account below the caller's own tier")
    class RankRules {

        @Test
        @DisplayName("a super administrator may modify another super administrator")
        void superAdminModifiesPeerSuperAdmin() {
            // otherwise a rogue super administrator could never be demoted
            User peer = user(TARGET_ID, "other-root", Role.SUPER_ADMIN);
            when(userMapper.findById(TARGET_ID)).thenReturn(peer, peer);
            when(userMapper.countEnabledByRole(Role.SUPER_ADMIN.name(), TARGET_ID)).thenReturn(1L);

            userService.update(TARGET_ID, UpdateUserRequest.builder()
                    .roles(List.of("ADMIN", "USER"))
                    .build(), SUPER_ADMIN);

            assertThat(peer.getRoles()).containsExactly("ADMIN", "USER");
        }

        @Test
        @DisplayName("an administrator may not modify a super administrator")
        void adminCannotModifySuperAdmin() {
            when(userMapper.findById(TARGET_ID)).thenReturn(user(TARGET_ID, "root", Role.SUPER_ADMIN));

            assertThatThrownBy(() -> userService.update(TARGET_ID,
                    UpdateUserRequest.builder().fullName("Owned").build(), ADMIN))
                    .isInstanceOf(ApiException.class)
                    .hasMessageContaining("Cannot modify an account holding the SUPER_ADMIN role");
            verify(userMapper, never()).update(any());
        }

        @Test
        @DisplayName("an administrator may not modify a peer administrator")
        void adminCannotModifyPeerAdmin() {
            when(userMapper.findById(TARGET_ID)).thenReturn(user(TARGET_ID, "peer", Role.ADMIN));

            assertThatThrownBy(() -> userService.update(TARGET_ID,
                    UpdateUserRequest.builder().fullName("Owned").build(), ADMIN))
                    .isInstanceOf(ApiException.class);
            verify(userMapper, never()).update(any());
        }

        @Test
        @DisplayName("a super administrator may modify an administrator")
        void superAdminModifiesAdmin() {
            User target = user(TARGET_ID, "peer", Role.ADMIN);
            when(userMapper.findById(TARGET_ID)).thenReturn(target, target);

            userService.update(TARGET_ID, UpdateUserRequest.builder().fullName("Managed").build(), SUPER_ADMIN);

            assertThat(target.getFullName()).isEqualTo("Managed");
            verify(userMapper).update(target);
        }

        @Test
        @DisplayName("an administrator cannot mint a super administrator")
        void adminCannotGrantSuperAdmin() {
            User target = user(TARGET_ID, "dana");
            when(userMapper.findById(TARGET_ID)).thenReturn(target);

            assertThatThrownBy(() -> userService.update(TARGET_ID,
                    UpdateUserRequest.builder().roles(List.of("SUPER_ADMIN")).build(), ADMIN))
                    .isInstanceOf(ApiException.class)
                    .hasMessageContaining("cannot grant the SUPER_ADMIN role");
            verify(userMapper, never()).update(any());
        }

        @Test
        @DisplayName("an administrator cannot promote themselves")
        void adminCannotSelfPromote() {
            when(userMapper.findById(USER_ID)).thenReturn(user(USER_ID, "self", Role.ADMIN));

            assertThatThrownBy(() -> userService.update(USER_ID,
                    UpdateUserRequest.builder().roles(List.of("SUPER_ADMIN", "USER")).build(), ADMIN))
                    .isInstanceOf(ApiException.class)
                    .hasMessageContaining("cannot grant the SUPER_ADMIN role");
            verify(userMapper, never()).update(any());
        }

        @Test
        @DisplayName("an administrator may still edit their own e-mail and name")
        void adminMayEditOwnProfile() {
            User self = user(USER_ID, "self", Role.ADMIN);
            when(userMapper.findById(USER_ID)).thenReturn(self, self);

            userService.update(USER_ID, UpdateUserRequest.builder()
                    .email("New@Example.com")
                    .fullName("New Name")
                    .build(), ADMIN);

            assertThat(self.getEmail()).isEqualTo("new@example.com");
            assertThat(self.getFullName()).isEqualTo("New Name");
        }

        @Test
        @DisplayName("an administrator may demote themselves")
        void adminMaySelfDemote() {
            User self = user(USER_ID, "self", Role.ADMIN);
            when(userMapper.findById(USER_ID)).thenReturn(self, self);

            userService.update(USER_ID, UpdateUserRequest.builder().roles(List.of("USER")).build(), ADMIN);

            assertThat(self.getRoles()).containsExactly("USER");
        }

        @Test
        @DisplayName("an administrator cannot disable their own account")
        void adminCannotSelfDisable() {
            when(userMapper.findById(USER_ID)).thenReturn(user(USER_ID, "self", Role.ADMIN));

            assertThatThrownBy(() -> userService.update(USER_ID,
                    UpdateUserRequest.builder().enabled(false).build(), ADMIN))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("cannot disable your own account");
            verify(userMapper, never()).update(any());
        }

        @Test
        @DisplayName("an administrator cannot delete another administrator")
        void adminCannotDeletePeerAdmin() {
            when(userMapper.findById(TARGET_ID)).thenReturn(user(TARGET_ID, "peer", Role.ADMIN));

            assertThatThrownBy(() -> userService.delete(TARGET_ID, ADMIN))
                    .isInstanceOf(ApiException.class);
            verify(userMapper, never()).deleteById(any());
        }

        @Test
        @DisplayName("a super administrator can delete an administrator")
        void superAdminDeletesAdmin() {
            User target = user(TARGET_ID, "peer", Role.ADMIN);
            when(userMapper.findById(TARGET_ID)).thenReturn(target);

            userService.delete(TARGET_ID, SUPER_ADMIN);

            verify(userMapper).deleteById(TARGET_ID);
        }
    }

    // ===================== Last super administrator =====================

    @Nested
    @DisplayName("protects the last super administrator")
    class LastSuperAdmin {

        @Test
        @DisplayName("cannot be demoted when nobody else holds the role")
        void refusesToDemoteLastSuperAdmin() {
            User root = user(TARGET_ID, "root", Role.SUPER_ADMIN);
            when(userMapper.findById(TARGET_ID)).thenReturn(root);
            when(userMapper.countEnabledByRole(Role.SUPER_ADMIN.name(), TARGET_ID)).thenReturn(0L);

            assertThatThrownBy(() -> userService.update(TARGET_ID,
                    UpdateUserRequest.builder().roles(List.of("ADMIN", "USER")).build(), SUPER_ADMIN))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("last super administrator cannot be modified");
            verify(userMapper, never()).update(any());
        }

        @Test
        @DisplayName("may be demoted once a second one exists")
        void allowsDemotionWhenAnotherRemains() {
            User root = user(TARGET_ID, "root", Role.SUPER_ADMIN);
            when(userMapper.findById(TARGET_ID)).thenReturn(root, root);
            when(userMapper.countEnabledByRole(Role.SUPER_ADMIN.name(), TARGET_ID)).thenReturn(1L);

            userService.update(TARGET_ID, UpdateUserRequest.builder().roles(List.of("USER")).build(), SUPER_ADMIN);

            assertThat(root.getRoles()).containsExactly("USER");
        }

        @Test
        @DisplayName("cannot be disabled when nobody else holds the role")
        void refusesToDisableLastSuperAdmin() {
            User root = user(TARGET_ID, "root", Role.SUPER_ADMIN);
            when(userMapper.findById(TARGET_ID)).thenReturn(root);
            when(userMapper.countEnabledByRole(Role.SUPER_ADMIN.name(), TARGET_ID)).thenReturn(0L);

            assertThatThrownBy(() -> userService.update(TARGET_ID,
                    UpdateUserRequest.builder().enabled(false).build(), SUPER_ADMIN))
                    .isInstanceOf(BusinessRuleException.class);
            verify(userMapper, never()).update(any());
        }

        @Test
        @DisplayName("cannot be deleted when nobody else holds the role")
        void refusesToDeleteLastSuperAdmin() {
            User root = user(TARGET_ID, "root", Role.SUPER_ADMIN);
            when(userMapper.findById(TARGET_ID)).thenReturn(root);
            when(userMapper.countEnabledByRole(Role.SUPER_ADMIN.name(), TARGET_ID)).thenReturn(0L);

            assertThatThrownBy(() -> userService.delete(TARGET_ID, SUPER_ADMIN))
                    .isInstanceOf(BusinessRuleException.class);
            verify(userMapper, never()).deleteById(any());
        }

        @Test
        @DisplayName("demotion is blocked when the same request also disables the account")
        void refusesCombinedDemoteAndDisable() {
            User root = user(TARGET_ID, "root", Role.SUPER_ADMIN);
            when(userMapper.findById(TARGET_ID)).thenReturn(root);
            when(userMapper.countEnabledByRole(Role.SUPER_ADMIN.name(), TARGET_ID)).thenReturn(0L);

            assertThatThrownBy(() -> userService.update(TARGET_ID, UpdateUserRequest.builder()
                    .roles(List.of("USER"))
                    .enabled(false)
                    .build(), SUPER_ADMIN))
                    .isInstanceOf(BusinessRuleException.class);
        }

        @Test
        @DisplayName("is not consulted for accounts that never held the role")
        void ignoresRegularUsers() {
            User target = user(TARGET_ID, "dana");
            when(userMapper.findById(TARGET_ID)).thenReturn(target, target);

            userService.update(TARGET_ID, UpdateUserRequest.builder().enabled(false).build(), ADMIN);

            assertThat(target.getEnabled()).isFalse();
            verify(userMapper, never()).countEnabledByRole(anyString(), any());
        }
    }

    // ===================== Create =====================

    @Test
    @DisplayName("a super administrator creates an account with the chosen roles")
    void superAdminCreatesUser() {
        when(userMapper.countByUsernameExcludingId("dana", null)).thenReturn(0L);
        when(userMapper.countByEmailExcludingId("dana@example.com", null)).thenReturn(0L);
        when(passwordEncoder.encode(RAW_PASSWORD)).thenReturn(HASHED_PASSWORD);
        when(userMapper.insert(any())).thenAnswer(invocation -> {
            invocation.<User>getArgument(0).setId(TARGET_ID);
            return 1;
        });
        when(userMapper.findById(TARGET_ID)).thenReturn(user(TARGET_ID, "dana", List.of("ADMIN", "USER")));

        userService.create(CreateUserRequest.builder()
                .username("dana")
                .email("Dana@Example.com")
                .password(RAW_PASSWORD)
                .roles(List.of("ADMIN"))
                .build(), SUPER_ADMIN);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userMapper).insert(captor.capture());
        assertThat(captor.getValue().getEmail()).isEqualTo("dana@example.com");
        assertThat(captor.getValue().getPassword()).isEqualTo(HASHED_PASSWORD).isNotEqualTo(RAW_PASSWORD);
        assertThat(captor.getValue().getRoles()).containsExactly("ADMIN");
        assertThat(captor.getValue().getEnabled()).isTrue();
        // the new account gets the starter categories like a self-registered one
        verify(categoryMapper, times(8)).insert(any());
    }

    @Test
    @DisplayName("an administrator cannot create accounts")
    void adminCannotCreateUser() {
        assertThatThrownBy(() -> userService.create(CreateUserRequest.builder()
                .username("dana")
                .email("dana@example.com")
                .password(RAW_PASSWORD)
                .build(), ADMIN))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("requires the super administrator role");
        verify(userMapper, never()).insert(any());
    }

    @Test
    @DisplayName("rejects a duplicate username before inserting")
    void rejectsDuplicateUsernameOnCreate() {
        when(userMapper.countByUsernameExcludingId("dana", null)).thenReturn(1L);

        assertThatThrownBy(() -> userService.create(CreateUserRequest.builder()
                .username("dana")
                .email("dana@example.com")
                .password(RAW_PASSWORD)
                .build(), SUPER_ADMIN))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("username");
        verify(userMapper, never()).insert(any());
    }

    // ===================== Password reset =====================

    @Test
    @DisplayName("a super administrator replaces the stored hash only")
    void resetsPassword() {
        User target = user(TARGET_ID, "dana");
        when(userMapper.findById(TARGET_ID)).thenReturn(target);
        when(passwordEncoder.encode(RAW_PASSWORD)).thenReturn(HASHED_PASSWORD);

        userService.resetPassword(TARGET_ID, RAW_PASSWORD, SUPER_ADMIN);

        assertThat(target.getPassword()).isEqualTo(HASHED_PASSWORD);
        verify(userMapper).update(target);
        verify(userMapper, never()).deleteById(any());
    }

    @Test
    @DisplayName("an administrator cannot reset passwords")
    void adminCannotResetPassword() {
        assertThatThrownBy(() -> userService.resetPassword(TARGET_ID, RAW_PASSWORD, ADMIN))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("requires the super administrator role");
        verify(userMapper, never()).findById(any());
        verify(passwordEncoder, never()).encode(anyString());
    }

    // ===================== Delete =====================

    @Test
    @DisplayName("refuses to let an administrator delete their own account")
    void refusesSelfDeletion() {
        // delete(id, actor) - the self check happens before the lookup
        assertThatThrownBy(() -> userService.delete(USER_ID, ADMIN))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("cannot delete their own account");
        verify(userMapper, never()).findById(any());
        verify(userMapper, never()).deleteById(any());
    }

    @Test
    @DisplayName("deletes a regular account")
    void deletesOtherAccount() {
        when(userMapper.findById(TARGET_ID)).thenReturn(user(TARGET_ID, "dana"));

        userService.delete(TARGET_ID, ADMIN);

        verify(userMapper).deleteById(TARGET_ID);
    }
}
