package com.example.expensetracker.controller;

import com.example.expensetracker.construction.ConstructionAccess;
import com.example.expensetracker.exception.ApiException;
import com.example.expensetracker.exception.ErrorCode;
import com.example.expensetracker.mapper.ConstructionMapper;
import com.example.expensetracker.mapper.UserMapper;
import com.example.expensetracker.security.SecurityUtils;
import com.example.expensetracker.storage.PhotoStorage;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController @RequestMapping("/api/v1/media") @RequiredArgsConstructor
public class MediaController {
    private final PhotoStorage storage;
    private final UserMapper users;
    private final ConstructionMapper construction;
    private final ConstructionAccess access;

    @GetMapping("/profiles/{userId}/{fileId}.jpg")
    public ResponseEntity<byte[]> profile(@PathVariable UUID userId, @PathVariable UUID fileId, Authentication auth) {
        if (!userId.equals(SecurityUtils.currentUserId(auth))) throw missing();
        var user = users.findById(userId);
        String reference = PhotoStorage.URL_PREFIX + "profiles/" + userId + "/" + fileId + ".jpg";
        if (user == null || !Boolean.TRUE.equals(user.getEnabled()) || !reference.equals(user.getAvatarUrl())) throw missing();
        return image(reference);
    }

    @GetMapping("/workers/{workerId}/{kind}/{fileId}.jpg")
    public ResponseEntity<byte[]> worker(@PathVariable UUID workerId, @PathVariable String kind,
            @PathVariable UUID fileId, Authentication auth) {
        if (!"photos".equals(kind) && !"id-cards".equals(kind)) throw missing();
        if (!access.allowed(auth)) throw missing();
        var worker = construction.worker(workerId, false);
        if (worker == null) throw missing();
        if (!access.manager(auth) && ("id-cards".equals(kind) || !access.sites(auth).contains(worker.getProjectId()))) throw missing();
        String reference = PhotoStorage.URL_PREFIX + "workers/" + workerId + "/" + kind + "/" + fileId + ".jpg";
        String saved = "photos".equals(kind) ? worker.getPhotoDataUrl() : worker.getIdCardDataUrl();
        if (!reference.equals(saved)) throw missing();
        return image(reference);
    }

    private ResponseEntity<byte[]> image(String reference) {
        return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG)
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .header("X-Content-Type-Options", "nosniff")
                .body(storage.read(reference));
    }
    private static ApiException missing() { return new ApiException(ErrorCode.NOT_FOUND, "Photo not found"); }
}
