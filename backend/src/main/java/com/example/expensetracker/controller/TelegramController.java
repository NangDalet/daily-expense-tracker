package com.example.expensetracker.controller;
import com.example.expensetracker.dto.response.ApiResponse;
import com.example.expensetracker.security.SecurityUtils;
import com.example.expensetracker.service.TelegramService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
@RestController @RequestMapping("/api/v1/telegram") @RequiredArgsConstructor
public class TelegramController {
    private final TelegramService service;
    @GetMapping public ApiResponse<TelegramService.Status> status(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponse.of(service.status(SecurityUtils.currentUserId(jwt)), "Telegram status");
    }
    @PostMapping("/link") public ApiResponse<TelegramService.Link> link(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponse.of(service.link(SecurityUtils.currentUserId(jwt)), "Open Telegram and press Start");
    }
    @DeleteMapping public ApiResponse<Void> disconnect(@AuthenticationPrincipal Jwt jwt) {
        service.disconnect(SecurityUtils.currentUserId(jwt)); return ApiResponse.of(null, "Telegram disconnected");
    }
    public record Chat(Long id, String type) {}
    public record Sender(Long id) {}
    public record Message(Chat chat, Sender from, String text) {}
    public record Update(Long update_id, Message message) {}
    @PostMapping("/webhook") public void webhook(
            @RequestHeader(value="X-Telegram-Bot-Api-Secret-Token", required=false) String secret,
            @RequestBody Update update) {
        var message = update.message();
        service.accept(secret, update.update_id(),
                message != null && message.chat() != null ? message.chat().id() : null,
                message != null && message.from() != null ? message.from().id() : null,
                message != null && message.chat() != null ? message.chat().type() : null,
                message != null ? message.text() : null);
    }
}
