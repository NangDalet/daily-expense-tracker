package com.example.expensetracker.mapper;

import com.example.expensetracker.construction.ConstructionModels.*;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ConstructionMapper {
    boolean hasAccess(UUID userId);
    String accessRole(UUID userId);
    UUID lockAccessTarget(UUID userId);
    List<UUID> foremanSites(UUID userId);
    void clearForemanSites(UUID userId);
    void addForemanSite(@Param("userId") UUID userId, @Param("projectId") UUID projectId);
    void grantRole(@Param("userId") UUID userId, @Param("actor") UUID actor, @Param("role") String role);
    void roleHistory(@Param("userId") UUID userId, @Param("actor") UUID actor, @Param("granted") boolean granted,
        @Param("role") String role, @Param("siteIds") List<UUID> siteIds);
    List<Grant> grants();
    void grant(@Param("userId") UUID userId, @Param("actor") UUID actor);
    void revoke(UUID userId);
    void accessHistory(@Param("userId") UUID userId, @Param("actor") UUID actor, @Param("granted") boolean granted);
    List<Worker> workers();
    Worker worker(@Param("id") UUID id, @Param("lock") boolean lock);
    void insertWorker(Worker worker);
    void updateWorker(Worker worker);
    void transferWorkers(@Param("workerIds") List<UUID> workerIds, @Param("projectId") UUID projectId);
    void activateWorkers(List<UUID> workerIds);
    void deactivateProjectWorkers(UUID projectId);
    boolean hasAttendance(UUID workerId);
    boolean attendanceBefore(@Param("workerId") UUID workerId, @Param("startDate") LocalDate startDate);
    List<Project> projects();
    Project project(UUID id);
    void insertProject(Project project);
    void updateProject(Project project);
    List<Attendance> attendance(@Param("workerId") UUID workerId, @Param("projectId") UUID projectId,
        @Param("from") LocalDate from, @Param("to") LocalDate to);
    Attendance attendanceById(UUID id);
    void insertAttendance(Attendance attendance);
    void updateAttendance(Attendance attendance);
    void deleteAttendance(UUID id);
    List<Adjustment> adjustments(UUID workerId);
    Adjustment adjustment(UUID id);
    void insertAdjustment(Adjustment adjustment);
    void approveAdjustment(Adjustment adjustment);
    List<Payroll> payrolls(@Param("workerId") UUID workerId, @Param("projectId") UUID projectId,
        @Param("from") LocalDate from, @Param("to") LocalDate to);
    Payroll payroll(@Param("id") UUID id, @Param("lock") boolean lock);
    int overlaps(@Param("workerId") UUID workerId, @Param("projectId") UUID projectId,
        @Param("from") LocalDate from, @Param("to") LocalDate to);
    void insertPayroll(Payroll payroll);
    void claimAttendance(@Param("payroll") Payroll payroll);
    void claimAdjustments(@Param("payroll") Payroll payroll);
    void updatePayroll(Payroll payroll);
    void releaseAttendance(UUID payrollId);
    void releaseAdjustments(UUID payrollId);
    List<Payment> payments(UUID payrollId);
    Payment paymentByKey(UUID requestKey);
    void insertPayment(Payment payment);
}
