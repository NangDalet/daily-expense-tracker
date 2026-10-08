package com.example.expensetracker.exception;

import org.springframework.http.HttpStatus;

/**
 * Stable, machine-readable error codes returned as {@code {"code": "..."}} in
 * every error payload. The frontend switches on these values, so the string
 * constants must not change without a coordinated release.
 */
public enum ErrorCode {

    VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "Request validation failed"),
    MALFORMED_JSON(HttpStatus.BAD_REQUEST, "Request body is not valid JSON"),
    MISSING_PARAMETER(HttpStatus.BAD_REQUEST, "Required parameter is missing"),
    UNSUPPORTED_MEDIA_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Unsupported content type"),

    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "Authentication is required"),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "Invalid username or password"),
    TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "Token has expired"),
    FORBIDDEN(HttpStatus.FORBIDDEN, "You do not have permission to perform this action"),

    NOT_FOUND(HttpStatus.NOT_FOUND, "Resource not found"),
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "HTTP method is not supported"),

    CONFLICT(HttpStatus.CONFLICT, "Resource already exists"),
    DUPLICATE_RESOURCE(HttpStatus.CONFLICT, "A resource with the same unique value already exists"),

    BUSINESS_RULE_VIOLATION(HttpStatus.UNPROCESSABLE_ENTITY, "Business rule violation"),

    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Unexpected internal error"),
    DATABASE_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Database error"),
    SERVICE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "Service is temporarily unavailable");

    private final HttpStatus status;
    private final String defaultMessage;

    ErrorCode(HttpStatus status, String defaultMessage) {
        this.status = status;
        this.defaultMessage = defaultMessage;
    }

    public HttpStatus status() {
        return status;
    }

    public String defaultMessage() {
        return defaultMessage;
    }
}
