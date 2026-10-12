package com.example.expensetracker.service;

import com.example.expensetracker.dto.request.LoginRequest;
import com.example.expensetracker.dto.request.RefreshTokenRequest;
import com.example.expensetracker.dto.request.RegisterRequest;
import com.example.expensetracker.dto.response.TokenResponse;

/** Auth use cases. */
public interface AuthService {

    void verifyPassword(java.util.UUID userId, String password);

    TokenResponse register(RegisterRequest request);

    TokenResponse login(LoginRequest request);

    TokenResponse refresh(RefreshTokenRequest request);
}
