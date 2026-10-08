package com.example.expensetracker.security;

import java.io.IOException;

import com.example.expensetracker.exception.ErrorCode;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;

/**
 * Renders a JSON 401 for anonymous or invalid-token requests so the frontend
 * axios interceptor can reliably react to it.
 * <p>
 * {@code BearerTokenAuthenticationEntryPoint} is bypassed on purpose: it would
 * answer with an empty body and the RFC 6750 {@code WWW-Authenticate} header,
 * neither of which the typed error envelope of this API provides.
 */
@Component
@RequiredArgsConstructor
public class JsonAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ApiErrorWriter errorWriter;

    @Override
    public void commence(HttpServletRequest request,
                         HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        String message = authException != null && authException.getMessage() != null
                ? authException.getMessage()
                : ErrorCode.UNAUTHORIZED.defaultMessage();
        errorWriter.write(request, response, ErrorCode.UNAUTHORIZED, message);
    }
}
