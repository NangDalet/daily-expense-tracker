package com.example.expensetracker.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** OAuth2 token pair returned by {@code /api/v1/auth/login} and {@code /refresh}. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "TokenResponse", description = "Issued OAuth2 tokens")
public class TokenResponse {

    @Schema(description = "JWT access token - send as `Authorization: Bearer <token>`")
    private String accessToken;

    @Schema(description = "JWT refresh token, only accepted by /auth/refresh")
    private String refreshToken;

    @Schema(description = "Always `Bearer`", example = "Bearer")
    private String tokenType;

    @Schema(description = "Access token lifetime in seconds", example = "1800")
    private Long expiresIn;

    @Schema(description = "Profile of the authenticated user")
    private UserResponse user;
}
