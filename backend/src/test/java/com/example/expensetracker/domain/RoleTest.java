package com.example.expensetracker.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

@DisplayName("Role")
class RoleTest {

    @Nested
    @DisplayName("ranks the tiers in declaration order")
    class Hierarchy {

        @Test
        @DisplayName("orders USER < ADMIN < SUPER_ADMIN")
        void ordersTiers() {
            assertThat(Role.USER.rank()).isLessThan(Role.ADMIN.rank());
            assertThat(Role.ADMIN.rank()).isLessThan(Role.SUPER_ADMIN.rank());
        }

        @Test
        @DisplayName("atLeast includes the role itself")
        void atLeastIsInclusive() {
            assertThat(Role.ADMIN.atLeast(Role.ADMIN)).isTrue();
            assertThat(Role.SUPER_ADMIN.atLeast(Role.ADMIN)).isTrue();
            assertThat(Role.ADMIN.atLeast(Role.SUPER_ADMIN)).isFalse();
            assertThat(Role.USER.atLeast(Role.ADMIN)).isFalse();
        }

        @Test
        @DisplayName("exposes the Spring Security authority spelling")
        void exposesAuthority() {
            assertThat(Role.SUPER_ADMIN.authority()).isEqualTo("ROLE_SUPER_ADMIN");
            assertThat(Role.ADMIN.authority()).isEqualTo("ROLE_ADMIN");
        }
    }

    @Nested
    @DisplayName("parse")
    class Parse {

        @ParameterizedTest
        @CsvSource({
                "SUPER_ADMIN, SUPER_ADMIN",
                "super_admin, SUPER_ADMIN",
                "'  Super_Admin  ', SUPER_ADMIN",
                "ADMIN, ADMIN",
                "user, USER",
        })
        @DisplayName("accepts any casing and surrounding whitespace")
        void normalises(String raw, Role expected) {
            assertThat(Role.parse(raw)).isEqualTo(expected);
        }

        @ParameterizedTest
        @ValueSource(strings = {"", "   ", "wizard", "ROLE_ADMIN", "SUPERADMIN"})
        @DisplayName("returns null for unknown or empty values")
        void rejectsUnknown(String raw) {
            assertThat(Role.parse(raw)).isNull();
        }

        @Test
        @DisplayName("returns null for a missing value")
        void rejectsNull() {
            assertThat(Role.parse(null)).isNull();
        }
    }

    @Nested
    @DisplayName("highestOf")
    class HighestOf {

        @Test
        @DisplayName("picks the most privileged entry")
        void picksMostPrivileged() {
            assertThat(Role.highestOf(List.of("USER", "SUPER_ADMIN", "ADMIN"))).isEqualTo(Role.SUPER_ADMIN);
            assertThat(Role.highestOf(List.of("USER", "ADMIN"))).isEqualTo(Role.ADMIN);
        }

        @Test
        @DisplayName("ignores unknown entries instead of failing")
        void ignoresUnknown() {
            assertThat(Role.highestOf(Arrays.asList("wizard", "ADMIN", null))).isEqualTo(Role.ADMIN);
        }

        @Test
        @DisplayName("defaults to USER so a rank is always available")
        void defaultsToUser() {
            assertThat(Role.highestOf(null)).isEqualTo(Role.USER);
            assertThat(Role.highestOf(Collections.emptyList())).isEqualTo(Role.USER);
            assertThat(Role.highestOf(List.of("wizard"))).isEqualTo(Role.USER);
        }
    }
}
