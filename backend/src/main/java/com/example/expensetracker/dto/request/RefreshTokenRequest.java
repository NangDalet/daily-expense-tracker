package com.example.expensetracker.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Exchanges a refresh token for a fresh token pair. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "RefreshTokenRequest", description = "Refresh token exchange")
public class RefreshTokenRequest {

    @NotBlank(message = "refreshToken is required")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private String refreshToken;
}
