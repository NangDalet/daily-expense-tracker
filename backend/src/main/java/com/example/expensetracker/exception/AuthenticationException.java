package com.example.expensetracker.exception;

/** Thrown by the authentication flow when credentials cannot be verified -&gt; 401. */
public class AuthenticationException extends ApiException {

    public AuthenticationException(String message) {
        super(ErrorCode.INVALID_CREDENTIALS, message);
    }

    public AuthenticationException(ErrorCode errorCode, String message) {
        super(errorCode, message);
    }
}
