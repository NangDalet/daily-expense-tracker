package com.example.expensetracker.dto.request;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Admin update of a user. Every field is optional, {@code null} means "leave
 * untouched"; the immutable username is intentionally not editable.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "UpdateUserRequest", description = "Admin user update payload")
public class UpdateUserRequest {

    @Email(message = "email must be a valid address")
    @Size(max = 255, message = "email must not exceed 255 characters")
    private String email;

    @Size(max = 120, message = "fullName must not exceed 120 characters")
    private String fullName;

    @Schema(description = "Replaces the whole role set, e.g. [\"USER\",\"ADMIN\"]",
            example = "[\"USER\"]")
    private List<String> roles;

    @Schema(description = "Disable an account without deleting its history", example = "false")
    private Boolean enabled;
}
