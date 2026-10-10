package com.example.expensetracker.controller;

import com.example.expensetracker.dto.request.UpdateProfileRequest;
import com.example.expensetracker.dto.response.ApiResponse;
import com.example.expensetracker.dto.response.UserResponse;
import com.example.expensetracker.security.SecurityUtils;
import com.example.expensetracker.serviceImpl.ProfileServiceImpl;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/profile") @RequiredArgsConstructor
public class ProfileController {
    private final ProfileServiceImpl profiles;
    public record PhotoRequest(@NotBlank @Size(max = 350_000) String imageData) {}

    @GetMapping public ApiResponse<UserResponse> get(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponse.of(profiles.get(SecurityUtils.currentUserId(jwt)));
    }
    @PutMapping public ApiResponse<UserResponse> update(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody UpdateProfileRequest request) {
        return ApiResponse.of(profiles.update(SecurityUtils.currentUserId(jwt), request), "Profile saved");
    }
    @PutMapping("/photo") public ApiResponse<UserResponse> photo(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody PhotoRequest request) {
        return ApiResponse.of(profiles.photo(SecurityUtils.currentUserId(jwt), request.imageData()), "Profile photo saved");
    }
    @DeleteMapping("/photo") public ApiResponse<UserResponse> removePhoto(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponse.of(profiles.removePhoto(SecurityUtils.currentUserId(jwt)), "Profile photo removed");
    }
}
