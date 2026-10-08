package com.example.expensetracker.exception;

import lombok.Getter;

/**
 * Generic business exception: an {@link ErrorCode} plus a message, nothing more.
 * <p>
 * Concrete subclasses ({@code ResourceNotFoundException},
 * {@code DuplicateResourceException}, {@code BusinessRuleException},
 * {@code AuthenticationException}) exist for the cases that need to be caught by
 * name; everything else is raised directly as {@code new ApiException(code, msg)}
 * which keeps the call sites short and the error catalogue in one place.
 */
@Getter
public class ApiException extends RuntimeException {

    private final ErrorCode errorCode;

    public ApiException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public ApiException(ErrorCode errorCode, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
    }
}
