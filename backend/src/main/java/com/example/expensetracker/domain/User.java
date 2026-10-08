package com.example.expensetracker.domain;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Application user. Persisted through MyBatis - this project intentionally
 * uses plain POJOs, there are no JPA annotations anywhere.
 * <p>
 * {@code roles} is stored as a comma separated column and converted to/from
 * {@code List<String>} by {@code com.example.expensetracker.util.StringListTypeHandler}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    private UUID id;

    private String username;

    private String email;

    /** BCrypt hash - never a plain-text password. */
    private String password;

    private String fullName;

    private List<String> roles;

    private Boolean enabled;

    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;
}
