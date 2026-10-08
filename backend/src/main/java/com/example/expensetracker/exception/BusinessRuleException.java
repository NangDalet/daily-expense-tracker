package com.example.expensetracker.exception;

/**
 * A domain invariant was violated even though the request was syntactically
 * valid, e.g. deleting a category that still has expenses attached, or updating
 * a budget for a period that does not exist. Rendered as HTTP 422.
 */
public class BusinessRuleException extends ApiException {

    public BusinessRuleException(String message) {
        super(ErrorCode.BUSINESS_RULE_VIOLATION, message);
    }
}
