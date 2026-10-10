package com.example.expensetracker.serviceImpl;

import java.util.Locale;
import java.util.UUID;
import com.example.expensetracker.convert.UserConvert;
import com.example.expensetracker.domain.User;
import com.example.expensetracker.dto.request.UpdateProfileRequest;
import com.example.expensetracker.dto.response.UserResponse;
import com.example.expensetracker.exception.DuplicateResourceException;
import com.example.expensetracker.exception.ResourceNotFoundException;
import com.example.expensetracker.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class ProfileServiceImpl {
    private final UserMapper users;
    private final UserConvert convert;
    private final ProfilePhotoProcessor photos;

    @Transactional(readOnly = true)
    public UserResponse get(UUID userId) { return convert.toResponse(existing(userId)); }

    @Transactional
    public UserResponse update(UUID userId, UpdateProfileRequest request) {
        existing(userId);
        String username = request.getUsername().trim(), email = request.getEmail().trim().toLowerCase(Locale.ROOT);
        if (users.countByUsernameExcludingId(username, userId) > 0) throw DuplicateResourceException.of("username", username);
        if (users.countByEmailExcludingId(email, userId) > 0) throw DuplicateResourceException.of("email", email);
        users.updateProfile(User.builder().id(userId).username(username).email(email)
                .fullName(request.getFullName() == null ? null : request.getFullName().strip()).build());
        return get(userId);
    }

    @Transactional
    public UserResponse photo(UUID userId, String dataUrl) {
        existing(userId);
        users.updateAvatar(userId, photos.normalize(dataUrl));
        return get(userId);
    }

    @Transactional
    public UserResponse removePhoto(UUID userId) {
        existing(userId);
        users.updateAvatar(userId, null);
        return get(userId);
    }

    private User existing(UUID userId) {
        var user = users.findById(userId);
        if (user == null) throw ResourceNotFoundException.of("User", userId);
        return user;
    }
}
