package com.example.expensetracker.exception;

import java.time.OffsetDateTime;
import java.util.List;

import com.example.expensetracker.dto.response.ErrorResponse;
import com.example.expensetracker.dto.response.ErrorResponse.ErrorDetail;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * Single place where every exception becomes the documented error envelope
 * {@code {code, message, details[], timestamp, path}}.
 * <p>
 * Handlers are ordered from the most specific to the most generic, and the
 * catch-all {@code Exception} handler never leaks internals: the exception is
 * logged with its stack trace while the response stays generic.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    // ===================== Business exceptions =====================

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApiException(ApiException ex, HttpServletRequest request) {
        ErrorCode code = ex.getErrorCode();
        if (code.status().is5xxServerError()) {
            log.error("{} on {} {}", code, request.getMethod(), request.getRequestURI(), ex);
        } else {
            log.debug("{} on {} {}: {}", code, request.getMethod(), request.getRequestURI(), ex.getMessage());
        }
        return build(code, ex.getMessage(), List.of(), request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex, HttpServletRequest request) {
        return build(ErrorCode.FORBIDDEN, ex.getMessage(), List.of(), request);
    }

    // ===================== Validation =====================

    /** {@code @Valid @RequestBody} failures - one entry per invalid field. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
                                                                      HttpServletRequest request) {
        List<ErrorDetail> details = ex.getBindingResult().getAllErrors().stream()
                .map(error -> {
                    String field = error instanceof FieldError fieldError ? fieldError.getField() : error.getObjectName();
                    Object rejected = error instanceof FieldError fieldError ? fieldError.getRejectedValue() : null;
                    return detail(field, error.getDefaultMessage(), rejected);
                })
                .toList();
        return build(ErrorCode.VALIDATION_ERROR, ErrorCode.VALIDATION_ERROR.defaultMessage(), details, request);
    }

    /** {@code @Valid @ModelAttribute} failures, e.g. an unparsable filter. */
    @ExceptionHandler(BindException.class)
    public ResponseEntity<ErrorResponse> handleBindException(BindException ex, HttpServletRequest request) {
        List<ErrorDetail> details = ex.getBindingResult().getAllErrors().stream()
                .map(error -> {
                    String field = error instanceof FieldError fieldError ? fieldError.getField() : error.getObjectName();
                    Object rejected = error instanceof FieldError fieldError ? fieldError.getRejectedValue() : null;
                    return detail(field, error.getDefaultMessage(), rejected);
                })
                .toList();
        return build(ErrorCode.VALIDATION_ERROR, "One or more query parameters are invalid", details, request);
    }

    /** Bean Validation on method parameters (path variables, request params). */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(ConstraintViolationException ex,
                                                                    HttpServletRequest request) {
        List<ErrorDetail> details = ex.getConstraintViolations().stream()
                .map(GlobalExceptionHandler::toDetail)
                .toList();
        return build(ErrorCode.VALIDATION_ERROR, ErrorCode.VALIDATION_ERROR.defaultMessage(), details, request);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleNotReadable(HttpMessageNotReadableException ex,
                                                            HttpServletRequest request) {
        log.debug("Unreadable body on {} {}: {}", request.getMethod(), request.getRequestURI(), ex.getMessage());
        return build(ErrorCode.MALFORMED_JSON, "Request body is missing or not valid JSON", List.of(), request);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingParameter(MissingServletRequestParameterException ex,
                                                                HttpServletRequest request) {
        return build(ErrorCode.MISSING_PARAMETER,
                "Required parameter '%s' is missing".formatted(ex.getParameterName()), List.of(), request);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException ex,
                                                            HttpServletRequest request) {
        String expected = ex.getRequiredType() == null ? "the expected type" : ex.getRequiredType().getSimpleName();
        return build(ErrorCode.VALIDATION_ERROR,
                "Parameter '%s' with value '%s' could not be converted to %s"
                        .formatted(ex.getName(), ex.getValue(), expected),
                List.of(), request);
    }

    // ===================== Protocol / persistence =====================

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex,
                                                                  HttpServletRequest request) {
        return build(ErrorCode.METHOD_NOT_ALLOWED, ErrorCode.METHOD_NOT_ALLOWED.defaultMessage(), List.of(), request);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMediaTypeNotSupported(HttpMediaTypeNotSupportedException ex,
                                                                     HttpServletRequest request) {
        return build(ErrorCode.UNSUPPORTED_MEDIA_TYPE, ErrorCode.UNSUPPORTED_MEDIA_TYPE.defaultMessage(), List.of(), request);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResourceFound(NoResourceFoundException ex,
                                                                HttpServletRequest request) {
        return build(ErrorCode.NOT_FOUND, "No handler for %s %s".formatted(request.getMethod(), request.getRequestURI()),
                List.of(), request);
    }

    /**
     * Unique / check constraint violations. The message is intentionally
     * generic so database internals never reach the client.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrity(DataIntegrityViolationException ex,
                                                              HttpServletRequest request) {
        log.warn("Data integrity violation on {} {}: {}", request.getMethod(), request.getRequestURI(), ex.getMessage());
        return build(ErrorCode.CONFLICT,
                "The request conflicts with the current state of the data", List.of(), request);
    }

    // ===================== Fallback =====================

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex, HttpServletRequest request) {
        log.error("Unhandled exception on {} {}", request.getMethod(), request.getRequestURI(), ex);
        return build(ErrorCode.INTERNAL_ERROR, ErrorCode.INTERNAL_ERROR.defaultMessage(), List.of(), request);
    }

    // ===================== Helpers =====================

    private ResponseEntity<ErrorResponse> build(ErrorCode code,
                                                String message,
                                                List<ErrorDetail> details,
                                                HttpServletRequest request) {
        ErrorResponse body = ErrorResponse.builder()
                .code(code.name())
                .message(message == null ? code.defaultMessage() : message)
                .details(details)
                .timestamp(OffsetDateTime.now())
                .path(request == null ? null : request.getRequestURI())
                .build();
        return ResponseEntity.status(code.status()).body(body);
    }

    private static ErrorDetail detail(String field, String message, Object rejectedValue) {
        return ErrorDetail.builder()
                .field(field)
                .message(message)
                .rejectedValue(rejectedValue)
                .build();
    }

    private static ErrorDetail toDetail(ConstraintViolation<?> violation) {
        String path = violation.getPropertyPath().toString();
        // "list.orderBy[0].direction" -> "direction"
        int dot = path.lastIndexOf('.');
        String field = dot >= 0 ? path.substring(dot + 1) : path;
        return ErrorDetail.builder()
                .field(field)
                .message(violation.getMessage())
                .rejectedValue(violation.getInvalidValue())
                .build();
    }
}
