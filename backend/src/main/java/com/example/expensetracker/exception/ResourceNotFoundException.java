package com.example.expensetracker.exception;

/** Thrown when an entity does not exist (or is not visible to the caller) -&gt; 404. */
public class ResourceNotFoundException extends ApiException {

    public ResourceNotFoundException(String message) {
        super(ErrorCode.NOT_FOUND, message);
    }

    /** Convenience factory: {@code Expense not found: 0f3c...}. */
    public static ResourceNotFoundException of(String resource, Object id) {
        return new ResourceNotFoundException("%s not found: %s".formatted(resource, id));
    }

    public static ResourceNotFoundException ofResource(String resource) {
        return new ResourceNotFoundException("%s not found".formatted(resource));
    }
}
