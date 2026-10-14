package com.example.expensetracker.construction;

import static com.example.expensetracker.construction.ConstructionModels.*;
import static com.example.expensetracker.construction.ConstructionRequests.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import com.example.expensetracker.mapper.ConstructionMapper;
import com.example.expensetracker.mapper.UserMapper;
import com.example.expensetracker.exception.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ConstructionServiceTest {
    private final ConstructionMapper mapper=mock(ConstructionMapper.class);
    private final ConstructionService service=new ConstructionService(mapper,mock(UserMapper.class),
        new com.example.expensetracker.storage.PhotoStorage(new com.example.expensetracker.storage.R2Properties(),
            new org.springframework.beans.factory.support.DefaultListableBeanFactory().getBeanProvider(software.amazon.awssdk.services.s3.S3Client.class)));
    private final UUID workerId=UUID.randomUUID(), projectId=UUID.randomUUID(), actor=UUID.randomUUID(), payrollId=UUID.randomUUID();
    private Worker worker;
    private final LocalDate date=LocalDate.of(2026,1,1);
    private static BigDecimal n(String value) { return new BigDecimal(value); }
    @BeforeEach void setup() {
        worker=new Worker(); worker.setId(workerId); worker.setActive(true); worker.setStartDate(date); worker.setRateType("DAILY");
        worker.setRate(n("20")); worker.setOvertimeRate(n("4")); worker.setHoursPerDay(n("8")); worker.setCurrency("KHR"); worker.setWorkerCode("CW01"); worker.setFullName("Worker");
        when(mapper.worker(workerId,true)).thenReturn(worker);
        Project project=new Project(); project.setId(projectId); project.setActive(true); when(mapper.project(projectId)).thenReturn(project);
    }
    @Test void omittedPhotoPreservesExistingPhotoAndEmptyPhotoRemovesIt() {
        worker.setPhotoDataUrl("saved-photo");
        WorkerRequest omitted = new WorkerRequest("CW01", "Worker", null, "Worker", "DAILY", n("20"), n("4"), n("8"), "KHR", date, true, null, null, null);
        assertThat(service.saveWorker(workerId, omitted).getPhotoDataUrl()).isEqualTo("saved-photo");
        WorkerRequest removed = new WorkerRequest("CW01", "Worker", null, "Worker", "DAILY", n("20"), n("4"), n("8"), "KHR", date, true, "", null, null);
        assertThat(service.saveWorker(workerId, removed).getPhotoDataUrl()).isNull();
        verify(mapper, times(2)).updateWorker(worker);
    }
    @Test void automaticallyCalculatesDailyAndHourlyOvertimeIgnoringSubmittedRate() {
        for (String basis : List.of("DAILY", "HOURLY")) {
            var request = new WorkerRequest("CW01", "Worker", null, "Worker", basis, n("60000"), n("0"), n("8"), "KHR", date, true, null, null, null);
            var saved = service.saveWorker(workerId, request);
            assertThat(saved.getOvertimeRate()).isEqualByComparingTo(basis.equals("DAILY") ? "11250" : "90000");
            assertThat(saved.getPosition()).isEqualTo("Worker");
        }
        assertThat(WageCalculator.overtimeRate("DAILY", n("100"), n("7"), n("999"))).isEqualByComparingTo("21.43");
        assertThat(WageCalculator.overtimeRate("HOURLY", n("0.01"), n("8"), n("0"))).isEqualByComparingTo("0.02");
    }
    @Test void fixedWagesKeepAgreedOvertimeAndWorkerPositionCannotAssignAccountRoles() {
        var request = new WorkerRequest("CW01", "Worker", null, "Worker", "FIXED", n("60000"), n("2000"), n("8"), "KHR", date, true, null, null, null);
        assertThat(service.saveWorker(workerId, request).getOvertimeRate()).isEqualByComparingTo("2000");
        for (String position : List.of("Construction Foreman", "Site Supervisor", "Construction Site Manager")) {
            var invalid = new WorkerRequest("CW01", "Worker", null, position, "DAILY", n("60000"), n("0"), n("8"), "KHR", date, true, null, null, null);
            assertThatThrownBy(() -> service.saveWorker(null, invalid)).hasMessageContaining("Worker position");
        }
        verify(mapper, never()).insertWorker(any());
    }
    @Test void rejectsCalculatedOvertimeBeyondDatabasePrecisionBeforeWriting() {
        var request = new WorkerRequest("CW01", "Worker", null, "Worker", "DAILY", n("99999999999999.99"), n("0"), n("0.01"), "KHR", date, true, null, null, null);
        assertThatThrownBy(() -> service.saveWorker(null, request)).hasMessageContaining("too large");
        verify(mapper, never()).insertWorker(any());
    }
    private Attendance attendance() {
        Attendance a=new Attendance(); a.setWorkerId(workerId); a.setProjectId(projectId); a.setWorkdays(n("1.5")); a.setHours(n("12"));
        a.setOvertimeHours(n("2")); a.setBaseWages(n("30")); a.setOvertime(n("8")); return a;
    }
    private WorkerRequest workerRequest(UUID site, String card) {
        return new WorkerRequest("CW01", "Worker", null, "Worker", "DAILY", n("20"), n("4"), n("8"), "KHR", date, true, null, site, card);
    }
    @Test void workersCanBeAssignedToSitesAndOmittedFieldsPreserveTheirDocuments() {
        worker.setIdCardDataUrl("saved-card");
        var updated = service.saveWorker(workerId, workerRequest(projectId, null));
        assertThat(updated.getProjectId()).isEqualTo(projectId);
        assertThat(updated.getIdCardDataUrl()).isEqualTo("saved-card");
        assertThat(updated.isHasIdCard()).isTrue();
        updated = service.saveWorker(workerId, workerRequest(null, ""));
        assertThat(updated.getProjectId()).isEqualTo(projectId);
        assertThat(updated.getIdCardDataUrl()).isNull();
        assertThat(updated.isHasIdCard()).isFalse();
    }
    @Test void rejectsMissingAndInactiveSitesBeforeSavingAWorker() {
        assertThatThrownBy(() -> service.saveWorker(null, workerRequest(UUID.randomUUID(), null))).hasMessageContaining("not found");
        mapper.project(projectId).setActive(false);
        assertThatThrownBy(() -> service.saveWorker(null, workerRequest(projectId, null))).hasMessageContaining("active site");
        verify(mapper, never()).insertWorker(any());
        worker.setProjectId(projectId);
        assertThat(service.saveWorker(workerId, workerRequest(projectId, null)).getProjectId()).isEqualTo(projectId);
    }
    private Payroll payroll() {
        Payroll p=new Payroll(); p.setId(payrollId); p.setWorkerId(workerId); p.setNetPay(n("100")); p.setPaidAmount(n("40")); p.setStatus("PARTIALLY_PAID"); p.setFromDate(date);
        when(mapper.payroll(payrollId,false)).thenReturn(p); when(mapper.payroll(payrollId,true)).thenReturn(p); return p;
    }
    @Test void halfDayAndOvertimeUseDecimalRates() {
        Attendance a=service.saveAttendance(null,new AttendanceRequest(workerId,projectId,date,"HALF",null,n("1.25")),actor);
        assertThat(a.getWorkdays()).isEqualByComparingTo("0.5"); assertThat(a.getHours()).isEqualByComparingTo("4");
        assertThat(a.getBaseWages()).isEqualByComparingTo("10"); assertThat(a.getOvertime()).isEqualByComparingTo("5");
    }
    @Test void dailyHourlyWorkDoesNotRoundDayFractionBeforeComputingWages() {
        worker.setHoursPerDay(n("7")); worker.setRate(n("100"));
        var a=service.saveAttendance(null,new AttendanceRequest(workerId,projectId,date,"HOURLY",n("1"),n("0")),actor);
        assertThat(a.getBaseWages()).isEqualByComparingTo("14.29");
    }
    @Test void hourlyRatePaysHoursAndFullDayUsesConfiguredHours() {
        worker.setRateType("HOURLY"); worker.setRate(n("3.5"));
        var a=service.saveAttendance(null,new AttendanceRequest(workerId,projectId,date,"FULL",null,n("0")),actor);
        assertThat(a.getBaseWages()).isEqualByComparingTo("28");
    }
    @Test void rejectsInvalidHoursAndLockedAttendance() {
        assertThatThrownBy(()->service.saveAttendance(null,new AttendanceRequest(workerId,projectId,date,"HOURLY",n("9"),n("0")),actor)).isInstanceOf(ApiException.class);
        when(mapper.overlaps(workerId,projectId,date,date)).thenReturn(1);
        assertThatThrownBy(()->service.saveAttendance(null,new AttendanceRequest(workerId,projectId,date,"FULL",null,n("0")),actor)).hasMessageContaining("payroll");
        verify(mapper,never()).insertAttendance(any());
    }
    @Test void payrollUsesOnlyApprovedUnallocatedAdjustmentsThroughEndDate() {
        PayrollRequest r=new PayrollRequest(workerId,projectId,date,date.plusDays(6),"WEEKLY");
        when(mapper.attendance(workerId,projectId,r.fromDate(),r.toDate())).thenReturn(List.of(attendance()));
        Adjustment advance=new Adjustment(); advance.setKind("ADVANCE"); advance.setStatus("APPROVED"); advance.setAmount(n("10")); advance.setAdjustmentDate(date.minusDays(1));
        Adjustment pending=new Adjustment(); pending.setKind("DEDUCTION"); pending.setStatus("PENDING"); pending.setAmount(n("999")); pending.setAdjustmentDate(date);
        Adjustment future=new Adjustment(); future.setKind("DEDUCTION"); future.setStatus("APPROVED"); future.setAmount(n("999")); future.setAdjustmentDate(date.plusMonths(1));
        when(mapper.adjustments(workerId)).thenReturn(List.of(advance,pending,future));
        var p=service.prepare(r); assertThat(p.getNetPay()).isEqualByComparingTo("28"); assertThat(p.getAdvances()).isEqualByComparingTo("10");
        verify(mapper,never()).claimAttendance(any());
    }
    @Test void customPeriodPaysRecordedWorkAcrossAnArbitraryDateRange() {
        PayrollRequest request=new PayrollRequest(workerId,projectId,date,date.plusDays(9),"CUSTOM");
        Attendance first=attendance(), last=attendance();
        first.setWorkDate(date); last.setWorkDate(date.plusDays(9));
        when(mapper.attendance(workerId,projectId,request.fromDate(),request.toDate())).thenReturn(List.of(first,last));
        when(mapper.adjustments(workerId)).thenReturn(List.of());
        Payroll result=service.prepare(request);
        assertThat(result.getPeriod()).isEqualTo("CUSTOM");
        assertThat(result.getWorkdays()).isEqualByComparingTo("3");
        assertThat(result.getBaseWages()).isEqualByComparingTo("60");
        assertThat(result.getNetPay()).isEqualByComparingTo("76");
        verify(mapper,never()).insertPayroll(any());
    }
    @Test void fixedPayrollUsesFixedRateOnceAndIncludesEveryFormulaTerm() {
        worker.setRateType("FIXED"); worker.setRate(n("200")); Payroll p=new Payroll();
        List<Adjustment> rows=List.of("BONUS","ALLOWANCE","ADVANCE","DEDUCTION").stream().map(kind->{ var a=new Adjustment(); a.setKind(kind); a.setAmount(switch(kind) { case "BONUS" -> n("20"); case "ALLOWANCE" -> n("15"); case "ADVANCE" -> n("30"); default -> n("5"); }); return a; }).toList();
        WageCalculator.calculate(p,worker,List.of(attendance(),attendance()),rows);
        assertThat(p.getBaseWages()).isEqualByComparingTo("200"); assertThat(p.getNetPay()).isEqualByComparingTo("216");
    }
    @Test void rejectsOverlappingPeriodsBeforeAnyWrites() {
        when(mapper.overlaps(workerId,projectId,date,date.plusDays(6))).thenReturn(1);
        assertThatThrownBy(()->service.createPayroll(new PayrollRequest(workerId,projectId,date,date.plusDays(6),"WEEKLY"),actor)).hasMessageContaining("overlapping");
        verify(mapper,never()).insertPayroll(any());
    }
    @Test void partialPaymentCompletesPayrollAndRetryIsIdempotent() {
        Payroll p=payroll(); UUID requestKey=UUID.randomUUID(); Payment saved=new Payment(); saved.setPayrollId(payrollId); saved.setRequestKey(requestKey); saved.setAmount(n("60")); saved.setMethod("CASH"); saved.setPaymentDate(date);
        when(mapper.paymentByKey(requestKey)).thenReturn(null,saved,saved);
        var request=new PaymentRequest(requestKey,date,n("60"),"CASH");
        assertThat(service.pay(payrollId,request,actor)).isSameAs(saved); assertThat(p.getPaidAmount()).isEqualByComparingTo("100"); assertThat(p.getStatus()).isEqualTo("PAID");
        assertThat(service.pay(payrollId,request,actor)).isSameAs(saved); verify(mapper,times(1)).insertPayment(any());
    }
    @Test void paymentCannotExceedBalanceAndUsedKeyCannotChangeDetails() {
        payroll(); UUID key=UUID.randomUUID();
        assertThatThrownBy(()->service.pay(payrollId,new PaymentRequest(key,date,n("61"),"CASH"),actor)).hasMessageContaining("remaining balance");
        Payment saved=new Payment(); saved.setPayrollId(payrollId); saved.setAmount(n("5")); saved.setMethod("CASH"); saved.setPaymentDate(date); when(mapper.paymentByKey(key)).thenReturn(saved);
        assertThatThrownBy(()->service.pay(payrollId,new PaymentRequest(key,date,n("6"),"CASH"),actor)).hasMessageContaining("different details"); verify(mapper,never()).insertPayment(any());
    }
    @Test void paidPayrollCannotBeCancelledAndUnpaidCancellationReleasesRecords() {
        Payroll p=payroll(); assertThatThrownBy(()->service.cancel(payrollId,"Mistake",actor)).hasMessageContaining("unpaid");
        p.setPaidAmount(n("0")); p.setStatus("PENDING"); service.cancel(payrollId,"Correction",actor);
        verify(mapper).releaseAttendance(payrollId); verify(mapper).releaseAdjustments(payrollId); assertThat(p.getCancelledBy()).isEqualTo(actor);
    }
    @Test void approvalCannotBeChangedOnceReviewed() {
        UUID id=UUID.randomUUID(); Adjustment a=new Adjustment(); a.setWorkerId(workerId); a.setStatus("APPROVED"); when(mapper.adjustment(id)).thenReturn(a);
        assertThatThrownBy(()->service.approve(id,new ApprovalRequest(false,"Changed mind"),actor)).hasMessageContaining("once"); verify(mapper,never()).approveAdjustment(any());
    }
}
