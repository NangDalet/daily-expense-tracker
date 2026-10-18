package com.example.expensetracker.construction.controller;

import com.example.expensetracker.construction.auth.ConstructionAccess;
import com.example.expensetracker.construction.service.ConstructionService;
import com.example.expensetracker.construction.model.ConstructionModels.*;
import com.example.expensetracker.construction.model.ConstructionRequests.*;
import com.example.expensetracker.common.model.response.ApiResponse;
import com.example.expensetracker.security.SecurityUtils;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/construction")
@RequiredArgsConstructor
@PreAuthorize("@constructionAccess.manager(authentication)")
public class ConstructionController {
    private final ConstructionService service;
    private final ConstructionAccess access;
    private static UUID actor(Authentication auth) { return SecurityUtils.currentUserId(auth); }
    @GetMapping("/access") @PreAuthorize("isAuthenticated()")
    public ApiResponse<Access> access(Authentication auth) { return ApiResponse.of(access.details(auth)); }
    @GetMapping("/grants")
    public ApiResponse<List<Grant>> grants(Authentication auth) { return ApiResponse.of(service.grants(access.superAdmin(auth))); }
    @PutMapping("/grants/{id}")
    public ApiResponse<Void> grant(@PathVariable UUID id, @Valid @RequestBody GrantRequest r, Authentication auth) { service.assign(id,r,actor(auth),access.superAdmin(auth)); return ApiResponse.empty("Access updated"); }
    @GetMapping("/workers") @PreAuthorize("@constructionAccess.allowed(authentication)")
    public ApiResponse<List<Worker>> workers(Authentication auth) {
        var rows=service.workers();
        if(!access.manager(auth)) { var sites=access.sites(auth); rows=rows.stream().filter(w -> sites.contains(w.getProjectId())).peek(w -> {
            w.setRate(null); w.setOvertimeRate(null); w.setIdCardDataUrl(null); w.setHasIdCard(false);
        }).toList(); }
        return ApiResponse.of(rows);
    }
    @GetMapping("/workers/{id}") public ApiResponse<Worker> worker(@PathVariable UUID id) { return ApiResponse.of(service.workerDetails(id)); }
    @PostMapping("/workers") public ApiResponse<Worker> createWorker(@Valid @RequestBody WorkerRequest r) { return ApiResponse.of(service.saveWorker(null,r)); }
    @PutMapping("/workers/{id}") public ApiResponse<Worker> updateWorker(@PathVariable UUID id,@Valid @RequestBody WorkerRequest r) { return ApiResponse.of(service.saveWorker(id,r)); }
    @GetMapping("/projects") @PreAuthorize("@constructionAccess.allowed(authentication)")
    public ApiResponse<List<Project>> projects(Authentication auth) {
        var rows=service.projects();
        if(!access.manager(auth)) { var sites=access.sites(auth); rows=rows.stream().filter(p -> sites.contains(p.getId())).peek(p -> p.setPlannedAmount(null)).toList(); }
        return ApiResponse.of(rows);
    }
    @PostMapping("/projects") public ApiResponse<Project> createProject(@Valid @RequestBody ProjectRequest r) { return ApiResponse.of(service.saveProject(null,r)); }
    @PutMapping("/projects/{id}") public ApiResponse<Project> updateProject(@PathVariable UUID id,@Valid @RequestBody ProjectRequest r) { return ApiResponse.of(service.saveProject(id,r)); }
    @PostMapping("/projects/{id}/transfer-workers") public ApiResponse<Void> transferWorkers(@PathVariable UUID id,@Valid @RequestBody TransferWorkersRequest r) { service.transferWorkers(id,r); return ApiResponse.empty("Workers transferred"); }
    @GetMapping("/attendance") @PreAuthorize("@constructionAccess.allowed(authentication)")
    public ApiResponse<List<Attendance>> attendance(@RequestParam(required=false) UUID workerId,@RequestParam(required=false) UUID projectId,@RequestParam LocalDate from,@RequestParam LocalDate to,Authentication auth) {
        var rows=service.attendance(workerId,projectId,from,to);
        if(!access.manager(auth)) { var sites=access.sites(auth); rows=rows.stream().filter(a -> sites.contains(a.getProjectId())).peek(a -> { a.setBaseWages(null); a.setOvertime(null); }).toList(); }
        return ApiResponse.of(rows);
    }
    @PostMapping("/attendance") @PreAuthorize("@constructionAccess.attendance(authentication,#r,null)")
    public ApiResponse<Attendance> createAttendance(@Valid @RequestBody AttendanceRequest r,Authentication auth) { return ApiResponse.of(attendanceResponse(service.saveAttendance(null,r,actor(auth)),auth)); }
    @PutMapping("/attendance/{id}") @PreAuthorize("@constructionAccess.attendance(authentication,#r,#id)")
    public ApiResponse<Attendance> updateAttendance(@PathVariable UUID id,@Valid @RequestBody AttendanceRequest r,Authentication auth) { return ApiResponse.of(attendanceResponse(service.saveAttendance(id,r,actor(auth)),auth)); }
    @DeleteMapping("/attendance/{id}") @PreAuthorize("@constructionAccess.removeAttendance(authentication,#id)")
    public ApiResponse<Void> deleteAttendance(@PathVariable UUID id) { service.deleteAttendance(id); return ApiResponse.empty("Attendance removed"); }
    private Attendance attendanceResponse(Attendance row,Authentication auth) {
        if(!access.manager(auth)) { row.setBaseWages(null); row.setOvertime(null); }
        return row;
    }
    @GetMapping("/adjustments") public ApiResponse<List<Adjustment>> adjustments(@RequestParam(required=false) UUID workerId) { return ApiResponse.of(service.adjustments(workerId)); }
    @PostMapping("/adjustments") public ApiResponse<Adjustment> adjustment(@Valid @RequestBody AdjustmentRequest r,Authentication auth) { return ApiResponse.of(service.createAdjustment(r,actor(auth))); }
    @PutMapping("/adjustments/{id}/approval") public ApiResponse<Adjustment> approve(@PathVariable UUID id,@Valid @RequestBody ApprovalRequest r,Authentication auth) { return ApiResponse.of(service.approve(id,r,actor(auth))); }
    @GetMapping("/payrolls") public ApiResponse<List<Payroll>> payrolls(@RequestParam(required=false) UUID workerId,@RequestParam(required=false) UUID projectId,@RequestParam LocalDate from,@RequestParam LocalDate to) { return ApiResponse.of(service.payrolls(workerId,projectId,from,to)); }
    @GetMapping("/payrolls/{id}") public ApiResponse<Payroll> payroll(@PathVariable UUID id) { return ApiResponse.of(service.payroll(id)); }
    @GetMapping("/payrolls/{id}/receipt") public ApiResponse<Receipt> receipt(@PathVariable UUID id) { return ApiResponse.of(service.receipt(id)); }
    @PostMapping("/payrolls/preview") public ApiResponse<Payroll> preview(@Valid @RequestBody PayrollRequest r) { return ApiResponse.of(service.prepare(r)); }
    @PostMapping("/payrolls") public ApiResponse<Payroll> createPayroll(@Valid @RequestBody PayrollRequest r,Authentication auth) { return ApiResponse.of(service.createPayroll(r,actor(auth))); }
    @PostMapping("/payrolls/{id}/cancel") public ApiResponse<Payroll> cancel(@PathVariable UUID id,@Valid @RequestBody CancelRequest r,Authentication auth) { return ApiResponse.of(service.cancel(id,r.reason(),actor(auth))); }
    @GetMapping("/payrolls/{id}/payments") public ApiResponse<List<Payment>> payments(@PathVariable UUID id) { return ApiResponse.of(service.payments(id)); }
    @PostMapping("/payrolls/{id}/payments") public ApiResponse<Payment> pay(@PathVariable UUID id,@Valid @RequestBody PaymentRequest r,Authentication auth) { return ApiResponse.of(service.pay(id,r,actor(auth))); }
}
