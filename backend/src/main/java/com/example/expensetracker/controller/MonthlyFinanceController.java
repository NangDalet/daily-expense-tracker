package com.example.expensetracker.controller;

import java.time.YearMonth;
import java.util.List;
import com.example.expensetracker.dto.response.ApiResponse;
import com.example.expensetracker.dto.response.MonthlyFinanceResponse;
import com.example.expensetracker.mapper.MonthlyFinanceMapper;
import com.example.expensetracker.security.SecurityUtils;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/reports") @RequiredArgsConstructor @Validated
public class MonthlyFinanceController {
    private final MonthlyFinanceMapper reports;
    @GetMapping("/monthly")
    public ApiResponse<List<MonthlyFinanceResponse>> monthly(@AuthenticationPrincipal Jwt jwt,
            @RequestParam @Min(1900) @Max(2100) int year,
            @RequestParam @Min(1) @Max(12) int month) {
        var period = YearMonth.of(year, month);
        return ApiResponse.of(reports.summary(SecurityUtils.currentUserId(jwt), period.atDay(1), period.atEndOfMonth()));
    }
}
