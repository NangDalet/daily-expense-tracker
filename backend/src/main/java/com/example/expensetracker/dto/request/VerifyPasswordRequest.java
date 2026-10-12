package com.example.expensetracker.dto.request;

import jakarta.validation.constraints.NotBlank;

/** Password confirmation for the authenticated account. */
public record VerifyPasswordRequest(@NotBlank(message = "password is required") String password) {
    @Override
    public String toString() {
        return "VerifyPasswordRequest[password=REDACTED]";
    }
}
