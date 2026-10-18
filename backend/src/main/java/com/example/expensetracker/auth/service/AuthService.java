package com.example.expensetracker.auth.service;

import com.example.expensetracker.auth.model.request.LoginRequest;
import com.example.expensetracker.auth.model.request.RefreshTokenRequest;
import com.example.expensetracker.auth.model.request.RegisterRequest;
import com.example.expensetracker.auth.model.response.TokenResponse;

/** Auth use cases. */
public interface AuthService {

    void verifyPassword(java.util.UUID userId, String password);

    TokenResponse register(RegisterRequest request);

    TokenResponse login(LoginRequest request);

    TokenResponse refresh(RefreshTokenRequest request);
}
