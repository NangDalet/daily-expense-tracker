package com.example.expensetracker.service;

import java.util.List;
import java.util.UUID;

import com.example.expensetracker.dto.request.CreateUserRequest;
import com.example.expensetracker.dto.request.UpdateUserRequest;
import com.example.expensetracker.dto.response.ApiResponse;
import com.example.expensetracker.dto.response.UserResponse;
import com.example.expensetracker.security.CurrentUser;

import org.springframework.data.domain.Pageable;

/** User use cases. */
public interface UserService {

    ApiResponse<List<UserResponse>> list(String search, Pageable pageable);

    UserResponse get(UUID id);

    UserResponse create(CreateUserRequest request, CurrentUser actor);

    UserResponse update(UUID id, UpdateUserRequest request, CurrentUser actor);

    void resetPassword(UUID id, String rawPassword, CurrentUser actor);

    void delete(UUID id, CurrentUser actor);
}
