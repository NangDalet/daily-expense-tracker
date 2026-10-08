package com.example.expensetracker.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Self-service registration payload. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "RegisterRequest", description = "New account")
public class RegisterRequest {

    @NotBlank(message = "username is required")
    @Size(min = 3, max = 50, message = "username must be between 3 and 50 characters")
    @Pattern(regexp = "^[A-Za-z0-9._-]+$", message = "username may only contain letters, digits, dot, underscore and dash")
    @Schema(example = "dana", requiredMode = Schema.RequiredMode.REQUIRED)
    private String username;

    @NotBlank(message = "email is required")
    @Email(message = "email must be a valid address")
    @Size(max = 255, message = "email must not exceed 255 characters")
    @Schema(example = "dana@example.com", requiredMode = Schema.RequiredMode.REQUIRED)
    private String email;

    @NotBlank(message = "password is required")
    @Size(min = 8, max = 72, message = "password must be between 8 and 72 characters")
    @Schema(example = "S3cret-pass!", requiredMode = Schema.RequiredMode.REQUIRED)
    private String password;

    @Size(max = 120, message = "fullName must not exceed 120 characters")
    @Schema(example = "Dana Doe")
    private String fullName;
}
