package com.example.expensetracker.dto.request;

import jakarta.validation.constraints.*;
import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class UpdateProfileRequest {
    @NotBlank @Size(min = 3, max = 50) @Pattern(regexp = "^[A-Za-z0-9._-]+$")
    private String username;
    @NotBlank @Email @Size(max = 255)
    private String email;
    @Size(max = 120)
    private String fullName;
}
