package com.example.expensetracker.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Local (username + password) login. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "LoginRequest", description = "Credentials for /auth/login")
public class LoginRequest {

    @NotBlank(message = "username is required")
    @Schema(description = "Username or e-mail address", example = "demo", requiredMode = Schema.RequiredMode.REQUIRED)
    private String username;

    @NotBlank(message = "password is required")
    @Schema(example = "Demo@123", requiredMode = Schema.RequiredMode.REQUIRED)
    private String password;
}
