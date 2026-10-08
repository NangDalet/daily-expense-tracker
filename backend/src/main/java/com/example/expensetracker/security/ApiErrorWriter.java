package com.example.expensetracker.security;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.List;

import com.example.expensetracker.dto.response.ErrorResponse;
import com.example.expensetracker.exception.ErrorCode;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Writes the {@link ErrorResponse} envelope straight to the servlet response.
 * <p>
 * Security filters run before {@code @RestControllerAdvice}, therefore 401/403
 * produced by Spring Security have to be rendered here. Keeping the logic in one
 * place guarantees that the shape is identical to the exception handler's.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ApiErrorWriter {

    private final ObjectMapper objectMapper;

    public void write(HttpServletRequest request,
                      HttpServletResponse response,
                      ErrorCode errorCode,
                      String message) throws IOException {
        response.setStatus(errorCode.status().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");

        ErrorResponse body = ErrorResponse.builder()
                .code(errorCode.name())
                .message(message != null ? message : errorCode.defaultMessage())
                .details(List.of())
                .timestamp(OffsetDateTime.now())
                .path(request.getRequestURI())
                .build();

        objectMapper.writeValue(response.getOutputStream(), body);
        log.debug("Wrote {} response for {} {}: {}", response.getStatus(),
                request.getMethod(), request.getRequestURI(), body.getCode());
    }
}
