package com.example.expensetracker.wallet.controller;

import com.example.expensetracker.wallet.model.CashModels.*;
import com.example.expensetracker.wallet.service.CashService;
import com.example.expensetracker.common.model.response.ApiResponse;
import com.example.expensetracker.security.SecurityUtils;
import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/v1/cash")
@RequiredArgsConstructor
@Tag(name = "Cash balance", description = "Personal cash withdrawals, top-ups and remaining balance")
public class CashController {
    private final CashService service;

    @GetMapping("/balances")
    public ApiResponse<List<Balance>> balances(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponse.of(service.balances(SecurityUtils.currentUserId(jwt)));
    }

    @GetMapping("/topups")
    public ApiResponse<List<Topup>> topups(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return service.topups(SecurityUtils.currentUserId(jwt), page, size);
    }

    @PostMapping("/topups")
    public ResponseEntity<ApiResponse<Topup>> create(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody TopupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
                ApiResponse.of(service.save(SecurityUtils.currentUserId(jwt), null, request), "Top-up added"));
    }

    @PutMapping("/topups/{id}")
    public ApiResponse<Topup> update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
            @Valid @RequestBody TopupRequest request) {
        return ApiResponse.of(service.save(SecurityUtils.currentUserId(jwt), id, request), "Top-up updated");
    }

    @DeleteMapping("/topups/{id}")
    public ApiResponse<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.delete(SecurityUtils.currentUserId(jwt), id);
        return ApiResponse.empty("Top-up deleted");
    }
}
