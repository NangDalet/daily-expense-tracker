package com.example.expensetracker.construction;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import jakarta.validation.constraints.*;

public final class ConstructionRequests {
    private ConstructionRequests() {}
    public record WorkerRequest(
        @NotBlank @Size(max=40) String workerCode, @NotBlank @Size(max=120) String fullName,
        @Size(max=40) String phone, @NotBlank @Size(max=80) String position,
        @NotNull @Pattern(regexp="DAILY|HOURLY|FIXED") String rateType,
        @NotNull @DecimalMin("0.01") @Digits(integer=14, fraction=2) BigDecimal rate,
        @NotNull @DecimalMin("0") @Digits(integer=14, fraction=2) BigDecimal overtimeRate,
        @NotNull @DecimalMin("0.01") @DecimalMax("24") @Digits(integer=2, fraction=2) BigDecimal hoursPerDay,
        @NotNull @Pattern(regexp="KHR", message="Construction payments use KHR only") String currency, @NotNull LocalDate startDate, boolean active,
        @Size(max=350000) String photoDataUrl, UUID projectId,
        @Size(max=2000000) String idCardDataUrl) {}
    public record ProjectRequest(@NotBlank @Size(max=120) String name, @NotBlank @Size(max=160) String site, boolean active,
        LocalDate startDate, LocalDate endDate,
        @DecimalMin("0") @Digits(integer=14,fraction=2) BigDecimal plannedAmount) {}
    public record AttendanceRequest(@NotNull UUID workerId, @NotNull UUID projectId, @NotNull LocalDate workDate,
        @NotNull @Pattern(regexp="FULL|HALF|HOURLY") String kind,
        @DecimalMin("0.01") @DecimalMax("24") @Digits(integer=2,fraction=2) BigDecimal hours,
        @NotNull @DecimalMin("0") @DecimalMax("24") @Digits(integer=2,fraction=2) BigDecimal overtimeHours) {}
    public record AdjustmentRequest(@NotNull UUID workerId, @NotNull @Pattern(regexp="ADVANCE|DEDUCTION|BONUS|ALLOWANCE") String kind,
        @NotNull @DecimalMin("0.01") @Digits(integer=14,fraction=2) BigDecimal amount,
        @NotNull LocalDate adjustmentDate, @NotBlank @Size(max=255) String reason) {}
    public record ApprovalRequest(boolean approved, @NotBlank @Size(max=255) String reason) {}
    public record PayrollRequest(@NotNull UUID workerId, @NotNull UUID projectId, @NotNull LocalDate fromDate,
        @NotNull LocalDate toDate, @NotNull @Pattern(regexp="CUSTOM|DAILY|WEEKLY|BIWEEKLY|MONTHLY") String period) {}
    public record PaymentRequest(@NotNull UUID requestKey, @NotNull LocalDate paymentDate,
        @NotNull @DecimalMin("0.01") @Digits(integer=14,fraction=2) BigDecimal amount,
        @NotNull @Pattern(regexp="CASH|BANK_TRANSFER|QR") String method) {}
    public record CancelRequest(@NotBlank @Size(max=255) String reason) {}
    public record GrantRequest(boolean granted, @Pattern(regexp="MANAGER|FOREMAN") String constructionRole,
        @Size(max=100) java.util.List<@NotNull UUID> siteIds) {}
}
