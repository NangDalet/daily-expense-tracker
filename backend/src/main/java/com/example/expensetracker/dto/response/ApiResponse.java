package com.example.expensetracker.dto.response;

import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.http.HttpStatus;

import io.swagger.v3.oas.annotations.media.Schema;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Universal response envelope used by every endpoint.
 * <pre>
 * {
 *   "data": ...,
 *   "page": 0, "size": 20, "totalElements": 137, "totalPages": 7,
 *   "message": "OK", "timestamp": "2026-01-31T10:15:30Z"
 * }
 * </pre>
 * The pagination fields are only populated for paged endpoints; for simple
 * payloads they are {@code null} and omitted by the global Jackson
 * {@code non_null} inclusion rule.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "ApiResponse", description = "Standard response envelope")
public class ApiResponse<T> {

    @Schema(description = "Response payload - an object, an array, or the content of a page")
    private T data;

    @Schema(description = "Zero-based page index, null for non-paged responses", example = "0")
    private Integer page;

    @Schema(description = "Page size", example = "20")
    private Integer size;

    @Schema(description = "Total number of matching rows", example = "137")
    private Long totalElements;

    @Schema(description = "Total number of pages", example = "7")
    private Integer totalPages;

    @Schema(description = "Human readable status message", example = "OK")
    private String message;

    @Schema(description = "Server timestamp of the response")
    private OffsetDateTime timestamp;

    /** Factory for single-object payloads. */
    public static <T> ApiResponse<T> of(T data, String message) {
        return ApiResponse.<T>builder()
                .data(data)
                .message(message)
                .timestamp(OffsetDateTime.now())
                .build();
    }

    public static <T> ApiResponse<T> of(T data) {
        return of(data, HttpStatus.OK.getReasonPhrase());
    }

    public static <T> ApiResponse<Void> empty(String message) {
        return ApiResponse.<Void>builder()
                .message(message)
                .timestamp(OffsetDateTime.now())
                .build();
    }

    /**
     * Factory for paged payloads. {@code content} is copied into {@code data}
     * and the paging metadata is flattened into the envelope so the frontend
     * only ever parses a single shape.
     */
    public static <T> ApiResponse<List<T>> ofPage(List<T> content, int page, int size, long totalElements, String message) {
        int totalPages = size <= 0 ? 0 : (int) Math.ceil((double) totalElements / size);
        return ApiResponse.<List<T>>builder()
                .data(content)
                .page(page)
                .size(size)
                .totalElements(totalElements)
                .totalPages(totalPages)
                .message(message)
                .timestamp(OffsetDateTime.now())
                .build();
    }
}
