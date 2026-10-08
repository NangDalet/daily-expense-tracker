package com.example.expensetracker.exception;

/** Thrown when a unique constraint would be violated (duplicate username/email/name) -&gt; 409. */
public class DuplicateResourceException extends ApiException {

    public DuplicateResourceException(String message) {
        super(ErrorCode.DUPLICATE_RESOURCE, message);
    }

    public static DuplicateResourceException of(String field, Object value) {
        return new DuplicateResourceException("%s '%s' is already taken".formatted(field, value));
    }
}
