package com.example.expensetracker.util;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Currency;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/** Small helpers for handling monetary amounts consistently. */
public final class MoneyUtils {

    /** Money is always stored with 2 decimal places (NUMERIC(15,2)). */
    public static final int SCALE = 2;

    private static final Pattern ISO_CODE = Pattern.compile("^[A-Z]{3}$");

    public static final String SUPPORTED_CURRENCY_PATTERN = "^(USD|KHR)$";

    private static final Set<String> SUPPORTED_CURRENCIES = Set.of("USD", "KHR");

    private MoneyUtils() {
    }

    /** Normalises a raw amount to the DB scale using HALF_UP rounding. */
    public static BigDecimal normalize(BigDecimal amount) {
        if (amount == null) {
            return null;
        }
        return amount.setScale(SCALE, RoundingMode.HALF_UP);
    }

    /** {@code true} when the amount is strictly greater than zero. */
    public static boolean isPositive(BigDecimal amount) {
        return amount != null && amount.compareTo(BigDecimal.ZERO) > 0;
    }

    /** {@code true} when the code is a well-formed ISO-4217 alphabetic code. */
    public static boolean isValidIsoCode(String currency) {
        return currency != null && ISO_CODE.matcher(currency.toUpperCase(Locale.ROOT)).matches();
    }

    /** {@code true} when the currency is USD or KHR. */
    public static boolean isSupported(String currency) {
        return currency != null && SUPPORTED_CURRENCIES.contains(currency.toUpperCase(Locale.ROOT));
    }

    /** Falls back to USD when the currency is unsupported. */
    public static Currency toCurrency(String code) {
        if (!isSupported(code)) {
            return Currency.getInstance("USD");
        }
        try {
            return Currency.getInstance(code.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return Currency.getInstance("USD");
        }
    }
}
