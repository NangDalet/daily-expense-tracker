package com.example.expensetracker.dto.response;

import java.time.OffsetDateTime;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Error envelope returned by {@code GlobalExceptionHandler}.
 * <pre>
 * {
 *   "code": "VALIDATION_ERROR",
 *   "message": "Request validation failed",
 *   "details": [{ "field": "amount", "message": "must be greater than 0" }],
 *   "timestamp": "2026-01-31T10:15:30Z",
 *   "path": "/api/v1/expenses"
 * }
 * </pre>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "ErrorResponse", description = "Error payload")
public class ErrorResponse {

    @Schema(description = "Stable machine readable error code", example = "VALIDATION_ERROR")
    private String code;

    @Schema(description = "Human readable message", example = "Request validation failed")
    private String message;

    @Schema(description = "Field level details (empty for non-validation failures)")
    private List<ErrorDetail> details;

    @Schema(description = "Server timestamp of the error")
    private OffsetDateTime timestamp;

    @Schema(description = "Request path that failed", example = "/api/v1/expenses")
    private String path;

    /** Field level validation detail. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(name = "ErrorDetail", description = "Single field level validation problem")
    public static class ErrorDetail {

        @Schema(description = "Offending field name", example = "amount")
        private String field;

        @Schema(description = "Problem description", example = "must be greater than 0")
        private String message;

        @Schema(description = "Value that was rejected")
        private Object rejectedValue;
    }
}
