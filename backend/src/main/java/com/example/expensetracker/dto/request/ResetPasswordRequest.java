package com.example.expensetracker.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Super-administrator password reset for an account that cannot be signed into. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "ResetPasswordRequest", description = "Replacement password for an existing account")
public class ResetPasswordRequest {

    @NotBlank(message = "password is required")
    @Size(min = 8, max = 72, message = "password must be between 8 and 72 characters")
    @Schema(example = "S3cret-pass!", requiredMode = Schema.RequiredMode.REQUIRED)
    private String password;
}
