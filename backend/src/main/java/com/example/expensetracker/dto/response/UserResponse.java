package com.example.expensetracker.dto.response;

import java.time.OffsetDateTime;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Public representation of a user - never contains the password hash. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "UserResponse", description = "User profile")
public class UserResponse {

    private String id;

    private String username;

    private String email;

    private String fullName;

    private String avatarUrl;

    @Schema(description = "Authorities without the ROLE_ prefix, e.g. [\"USER\"]")
    private List<String> roles;

    private Boolean enabled;

    private OffsetDateTime createdAt;
}
