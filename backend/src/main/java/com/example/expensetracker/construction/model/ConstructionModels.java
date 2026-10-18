package com.example.expensetracker.construction.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Data;

public final class ConstructionModels {
    private ConstructionModels() {}
    @Data public static class Worker {
        private UUID id, projectId;
        private String workerCode, fullName, phone, position, rateType, currency, photoDataUrl, idCardDataUrl;
        private boolean hasIdCard;
        private BigDecimal rate, overtimeRate, hoursPerDay;
        private LocalDate startDate;
        private boolean active;
    }
    @Data public static class Project {
        private UUID id;
        private String name, site, status;
        private LocalDate startDate, endDate;
        private BigDecimal plannedAmount;
        private boolean active;
    }
    @Data public static class Attendance {
        private UUID id, workerId, projectId, payrollId, recordedBy;
        private LocalDate workDate;
        private String kind;
        private BigDecimal workdays, hours, overtimeHours, baseWages, overtime;
    }
    @Data public static class Adjustment {
        private UUID id, workerId, payrollId, createdBy, approvedBy;
        private String kind, reason, status, approvalReason;
        private BigDecimal amount;
        private LocalDate adjustmentDate;
        private OffsetDateTime createdAt, approvedAt;
    }
    @Data public static class Payroll {
        private UUID id, workerId, projectId, createdBy, cancelledBy;
        private String reference, period, currency, workerName, workerCode, rateType, status, cancellationReason;
        private LocalDate fromDate, toDate;
        private BigDecimal rate, workdays, hours, overtimeHours, baseWages, overtime, bonuses, allowances, advances, deductions, netPay, paidAmount;
        private OffsetDateTime createdAt, cancelledAt;
    }
    @Data public static class Payment {
        private UUID id, payrollId, requestKey, processedBy;
        private String reference, method, processorName;
        private LocalDate paymentDate;
        private BigDecimal amount;
        private OffsetDateTime createdAt;
    }
    public record Access(boolean allowed, boolean superAdmin, boolean manager, String constructionRole, java.util.List<UUID> siteIds) {}
    public record Receipt(Payroll payroll, java.util.List<Payment> payments, Project project) {}
    @Data public static class Grant {
        private UUID userId;
        private String username, fullName, constructionRole;
        private boolean enabled, granted, superAdmin;
        private java.util.List<UUID> siteIds;
    }
}
