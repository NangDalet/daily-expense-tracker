package com.example.expensetracker.construction;

import static com.example.expensetracker.construction.ConstructionModels.*;
import static com.example.expensetracker.construction.ConstructionRequests.*;
import static com.example.expensetracker.construction.WageCalculator.money;
import com.example.expensetracker.exception.ApiException;
import com.example.expensetracker.exception.ErrorCode;
import com.example.expensetracker.mapper.ConstructionMapper;
import com.example.expensetracker.mapper.UserMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class ConstructionService {
    private final ConstructionMapper mapper;
    private final UserMapper users;
    private static ApiException rule(String message) { return new ApiException(ErrorCode.BUSINESS_RULE_VIOLATION, message); }
    private static <T> T found(T value) { if(value==null) throw new ApiException(ErrorCode.NOT_FOUND,"Construction record not found"); return value; }
    private Worker worker(UUID id) { return found(mapper.worker(id,true)); }
    public List<Worker> workers() { return mapper.workers(); }
    public Worker workerDetails(UUID id) { return found(mapper.worker(id,false)); }
    public List<Project> projects() { return mapper.projects(); }
    public List<Grant> grants() { return mapper.grants(); }
    public List<Grant> grants(boolean superAdmin) {
        return mapper.grants().stream().filter(g -> superAdmin || (!g.isSuperAdmin() && !"MANAGER".equals(g.getConstructionRole())))
            .peek(g -> g.setSiteIds(mapper.foremanSites(g.getUserId()))).toList();
    }
    public void assign(UUID id, GrantRequest request, UUID actor, boolean superAdmin) {
        if(mapper.lockAccessTarget(id)==null) throw new ApiException(ErrorCode.NOT_FOUND,"User not found");
        var target=found(users.findById(id));
        String role=request.constructionRole()==null ? (superAdmin ? "MANAGER" : "FOREMAN") : request.constructionRole();
        String existing=mapper.accessRole(id);
        if(!superAdmin && (id.equals(actor) || !"FOREMAN".equals(role) || "MANAGER".equals(existing) || target.getRoles().contains("SUPER_ADMIN")))
            throw new ApiException(ErrorCode.FORBIDDEN,"Site managers can only assign construction foremen");
        var sites=request.siteIds()==null ? List.<UUID>of() : request.siteIds().stream().distinct().toList();
        if(request.granted() && "FOREMAN".equals(role)) {
            if(sites.isEmpty()) throw rule("Choose at least one site for the foreman");
            for(UUID site:sites) if(!found(mapper.project(site)).isActive()) throw rule("Choose an active site for the foreman");
        } else sites=List.of();
        if(request.granted()) mapper.grantRole(id,actor,role); else mapper.revoke(id);
        mapper.clearForemanSites(id);
        for(UUID site:sites) mapper.addForemanSite(id,site);
        mapper.roleHistory(id,actor,request.granted(),role,sites);
    }
    public void grant(UUID id, boolean granted, UUID actor) {
        if(users.findById(id)==null) throw new ApiException(ErrorCode.NOT_FOUND,"User not found");
        if(granted) mapper.grant(id,actor); else mapper.revoke(id);
        mapper.accessHistory(id,actor,granted);
    }
    public Worker saveWorker(UUID id, WorkerRequest r) {
        if (!"Worker".equals(r.position())) throw rule("Worker records must use the Worker position. Assign account roles separately.");
        var overtimeRate = WageCalculator.overtimeRate(r.rateType(), r.rate(), r.hoursPerDay(), r.overtimeRate());
        if (overtimeRate.compareTo(new java.math.BigDecimal("99999999999999.99")) > 0)
            throw rule("Calculated overtime rate is too large. Check the wage and regular hours.");
        String photo = WorkerPhoto.normalize(r.photoDataUrl());
        String idCard = WorkerPhoto.normalizeIdCard(r.idCardDataUrl());
        Worker w = id==null ? new Worker() : worker(id);
        if(r.projectId()!=null) {
            Project assigned = found(mapper.project(r.projectId()));
            if(!assigned.isActive() && !r.projectId().equals(w.getProjectId())) throw rule("Choose an active site for this worker");
            w.setProjectId(r.projectId());
        }
        if(id!=null && !w.getCurrency().equals(r.currency())) throw rule("Currency cannot change; create a separate worker account for another currency");
        if(id!=null && !w.getRateType().equals(r.rateType()) && mapper.hasAttendance(id)) throw rule("Wage basis cannot change after attendance is recorded; create a separate worker account for a different wage basis");
        if(id!=null && mapper.attendanceBefore(id,r.startDate())) throw rule("Start date cannot move after existing attendance");
        w.setId(id==null ? UUID.randomUUID() : id); w.setWorkerCode(r.workerCode().trim()); w.setFullName(r.fullName().trim());
        w.setPhone(r.phone()); w.setPosition(r.position().trim()); w.setRateType(r.rateType()); w.setRate(r.rate());
        w.setOvertimeRate(overtimeRate); w.setHoursPerDay(r.hoursPerDay()); w.setCurrency(r.currency());
        w.setStartDate(r.startDate()); w.setActive(r.active());
        // Omitted photos preserve existing uploads; an empty string removes one.
        if(r.photoDataUrl()!=null) w.setPhotoDataUrl(photo);
        if(r.idCardDataUrl()!=null) w.setIdCardDataUrl(idCard);
        w.setHasIdCard(w.getIdCardDataUrl()!=null);
        if(id==null) mapper.insertWorker(w); else mapper.updateWorker(w);
        return w;
    }
    public Project saveProject(UUID id, ProjectRequest r) {
        if(r.startDate()!=null || r.endDate()!=null) dateRange(r.startDate(),r.endDate());
        Project p=id==null ? new Project() : found(mapper.project(id)); p.setId(id==null ? UUID.randomUUID() : id);
        p.setName(r.name().trim()); p.setSite(r.site().trim()); p.setActive(r.active());
        p.setStartDate(r.startDate()); p.setEndDate(r.endDate()); p.setPlannedAmount(r.plannedAmount());
        if(id==null) mapper.insertProject(p); else mapper.updateProject(p); return p;
    }
    public static void dateRange(LocalDate from, LocalDate to) {
        if(from==null || to==null || from.isAfter(to)) throw rule("Select a valid date range");
    }
    public List<Attendance> attendance(UUID workerId, UUID projectId, LocalDate from, LocalDate to) {
        dateRange(from,to); return mapper.attendance(workerId,projectId,from,to);
    }
    public Attendance saveAttendance(UUID id, AttendanceRequest r, UUID actor) {
        Worker w=worker(r.workerId());
        if(!w.isActive()) throw rule("Activate the worker before recording attendance");
        if(!found(mapper.project(r.projectId())).isActive()) throw rule("Project is inactive");
        if(r.workDate().isBefore(w.getStartDate()) || r.workDate().isAfter(LocalDate.now(java.time.ZoneId.of("Asia/Bangkok")))) throw rule("Attendance must be between the worker start date and today");
        Attendance a=id==null ? new Attendance() : found(mapper.attendanceById(id));
        if(id!=null && (!a.getWorkerId().equals(r.workerId()) || a.getPayrollId()!=null)) throw rule("Payroll attendance is locked and the worker cannot be changed");
        if(mapper.overlaps(w.getId(),r.projectId(),r.workDate(),r.workDate())>0) throw rule("This work date already belongs to a payroll; cancel the unpaid payroll before changing attendance");
        BigDecimal h=switch(r.kind()) { case "FULL" -> w.getHoursPerDay(); case "HALF" -> w.getHoursPerDay().divide(new BigDecimal("2")); default -> r.hours(); };
        if(h==null || h.signum()<=0 || h.compareTo(w.getHoursPerDay())>0 || h.add(r.overtimeHours()).compareTo(new BigDecimal("24"))>0) throw rule("Regular hours must fit one workday and total hours must not exceed 24");
        BigDecimal days=h.divide(w.getHoursPerDay(),4,RoundingMode.HALF_UP);
        BigDecimal base=switch(w.getRateType()) { case "DAILY" -> w.getRate().multiply(h).divide(w.getHoursPerDay(),8,RoundingMode.HALF_UP); case "HOURLY" -> w.getRate().multiply(h); default -> BigDecimal.ZERO; };
        a.setId(id==null ? UUID.randomUUID() : id); a.setWorkerId(w.getId()); a.setProjectId(r.projectId());
        a.setWorkDate(r.workDate()); a.setKind(r.kind()); a.setHours(h); a.setWorkdays(days); a.setOvertimeHours(r.overtimeHours());
        a.setBaseWages(money(base)); a.setOvertime(money(w.getOvertimeRate().multiply(r.overtimeHours()))); a.setRecordedBy(actor);
        if(id==null) mapper.insertAttendance(a); else mapper.updateAttendance(a); return a;
    }
    public void deleteAttendance(UUID id) {
        Attendance initial=found(mapper.attendanceById(id)); worker(initial.getWorkerId());
        Attendance a=found(mapper.attendanceById(id));
        if(a.getPayrollId()!=null) throw rule("Attendance belongs to a payroll and is locked"); mapper.deleteAttendance(id);
    }
    public List<Adjustment> adjustments(UUID workerId) { return mapper.adjustments(workerId); }
    public Adjustment createAdjustment(AdjustmentRequest r, UUID actor) {
        Worker w=worker(r.workerId()); if(!w.isActive()) throw rule("Worker is inactive");
        if(r.adjustmentDate().isBefore(w.getStartDate())) throw rule("Adjustment cannot precede the worker start date");
        Adjustment a=new Adjustment(); a.setId(UUID.randomUUID()); a.setWorkerId(w.getId()); a.setKind(r.kind());
        a.setAmount(r.amount()); a.setAdjustmentDate(r.adjustmentDate()); a.setReason(r.reason().trim()); a.setCreatedBy(actor);
        mapper.insertAdjustment(a); return mapper.adjustment(a.getId());
    }
    public Adjustment approve(UUID id, ApprovalRequest r, UUID actor) {
        Adjustment initial=found(mapper.adjustment(id)); worker(initial.getWorkerId());
        Adjustment a=found(mapper.adjustment(id)); if(!"PENDING".equals(a.getStatus())) throw rule("An adjustment can only be approved or rejected once");
        a.setStatus(r.approved() ? "APPROVED" : "REJECTED"); a.setApprovedBy(actor); a.setApprovalReason(r.reason().trim());
        mapper.approveAdjustment(a); return mapper.adjustment(id);
    }
    public List<Payroll> payrolls(UUID workerId, UUID projectId, LocalDate from, LocalDate to) {
        dateRange(from,to); return mapper.payrolls(workerId,projectId,from,to);
    }
    public Payroll payroll(UUID id) { return found(mapper.payroll(id,false)); }
    public List<Payment> payments(UUID id) { payroll(id); return mapper.payments(id); }
    @Transactional(readOnly=true, isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public Receipt receipt(UUID id) {
        Payroll p=payroll(id);
        return new Receipt(p,mapper.payments(id),found(mapper.project(p.getProjectId())));
    }
    public Payroll prepare(PayrollRequest r) {
        Worker w=worker(r.workerId()); dateRange(r.fromDate(),r.toDate());
        if(!w.isActive() || !found(mapper.project(r.projectId())).isActive()) throw rule("Worker and project must be active");
        if(r.fromDate().isBefore(w.getStartDate())) throw rule("Payroll cannot precede the worker start date");
        long days=ChronoUnit.DAYS.between(r.fromDate(),r.toDate())+1;
        boolean valid=switch(r.period()) { case "CUSTOM" -> true; case "DAILY" -> days==1; case "WEEKLY" -> days==7; case "BIWEEKLY" -> days==14; case "MONTHLY" -> r.toDate().equals(r.fromDate().plusMonths(1).minusDays(1)); default -> false; };
        if(!valid) throw rule("Dates must match the chosen payment period (1, 7, 14 days, or one calendar month)");
        if(mapper.overlaps(w.getId(),r.projectId(),r.fromDate(),r.toDate())>0) throw new ApiException(ErrorCode.CONFLICT,"An overlapping payroll already exists for this worker and project");
        var rows=mapper.attendance(w.getId(),r.projectId(),r.fromDate(),r.toDate()).stream().filter(a->a.getPayrollId()==null).toList();
        if(rows.isEmpty()) throw rule("Record attendance before preparing payroll");
        var adjustments=mapper.adjustments(w.getId()).stream().filter(a->"APPROVED".equals(a.getStatus()) && a.getPayrollId()==null && !a.getAdjustmentDate().isAfter(r.toDate())).toList();
        Payroll p=new Payroll(); p.setWorkerId(w.getId()); p.setProjectId(r.projectId()); p.setFromDate(r.fromDate()); p.setToDate(r.toDate());
        p.setPeriod(r.period()); p.setCurrency(w.getCurrency()); p.setWorkerName(w.getFullName()); p.setWorkerCode(w.getWorkerCode()); p.setRateType(w.getRateType()); p.setRate(w.getRate());
        WageCalculator.calculate(p,w,rows,adjustments);
        if(p.getNetPay().signum()<0) throw rule("Advances and deductions exceed wages; use a longer payroll period or add an approved allowance");
        p.setPaidAmount(money(BigDecimal.ZERO)); p.setStatus(p.getNetPay().signum()==0 ? "PAID" : "PENDING"); return p;
    }
    public Payroll createPayroll(PayrollRequest r, UUID actor) {
        Payroll p=prepare(r); p.setId(UUID.randomUUID()); p.setReference("CW-"+p.getId()); p.setCreatedBy(actor);
        mapper.insertPayroll(p); mapper.claimAttendance(p); mapper.claimAdjustments(p); return payroll(p.getId());
    }
    public Payment pay(UUID id, PaymentRequest r, UUID actor) {
        Payroll initial=payroll(id); worker(initial.getWorkerId()); Payroll p=found(mapper.payroll(id,true));
        Payment existing=mapper.paymentByKey(r.requestKey());
        if(existing!=null) {
            if(!existing.getPayrollId().equals(id) || existing.getAmount().compareTo(r.amount())!=0 || !existing.getMethod().equals(r.method()) || !existing.getPaymentDate().equals(r.paymentDate())) throw new ApiException(ErrorCode.CONFLICT,"Payment request key was already used with different details");
            return existing;
        }
        if("CANCELLED".equals(p.getStatus()) || "PAID".equals(p.getStatus())) throw rule("Payroll is cancelled or fully paid");
        if(r.paymentDate().isBefore(p.getFromDate()) || r.paymentDate().isAfter(LocalDate.now(java.time.ZoneId.of("Asia/Bangkok")))) throw rule("Payment date must be between the payroll start and today");
        if(r.amount().compareTo(p.getNetPay().subtract(p.getPaidAmount()))>0) throw rule("Payment exceeds the remaining balance");
        Payment payment=new Payment(); payment.setId(UUID.randomUUID()); payment.setPayrollId(id); payment.setReference("CWP-"+payment.getId());
        payment.setRequestKey(r.requestKey()); payment.setAmount(r.amount()); payment.setPaymentDate(r.paymentDate()); payment.setMethod(r.method()); payment.setProcessedBy(actor);
        mapper.insertPayment(payment); p.setPaidAmount(money(p.getPaidAmount().add(r.amount())));
        p.setStatus(p.getPaidAmount().compareTo(p.getNetPay())==0 ? "PAID" : "PARTIALLY_PAID"); mapper.updatePayroll(p); return mapper.paymentByKey(r.requestKey());
    }
    public Payroll cancel(UUID id, String reason, UUID actor) {
        Payroll initial=payroll(id); worker(initial.getWorkerId()); Payroll p=found(mapper.payroll(id,true));
        if(p.getPaidAmount().signum()>0 || "CANCELLED".equals(p.getStatus())) throw rule("Only an unpaid, uncancelled payroll can be cancelled");
        p.setStatus("CANCELLED"); p.setCancelledBy(actor); p.setCancelledAt(OffsetDateTime.now()); p.setCancellationReason(reason.trim());
        mapper.updatePayroll(p); mapper.releaseAttendance(id); mapper.releaseAdjustments(id); return payroll(id);
    }
}
