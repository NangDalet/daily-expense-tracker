package com.example.expensetracker.mapper;
import java.util.UUID;
import com.example.expensetracker.domain.TelegramConnection;
import com.example.expensetracker.domain.TelegramNotification;
import org.apache.ibatis.annotations.Param;
public interface TelegramMapper {
    TelegramConnection find(@Param("userId") UUID userId);
    UUID lockUser(@Param("userId") UUID userId);
    int setLink(@Param("userId") UUID userId, @Param("hash") String hash);
    TelegramConnection connect(@Param("hash") String hash, @Param("chatId") long chatId);
    int disconnect(@Param("userId") UUID userId);
    int clearPending(@Param("userId") UUID userId);
    int enqueue(@Param("userId") UUID userId, @Param("chatId") long chatId,
                @Param("eventKey") String eventKey, @Param("message") String message);
    TelegramNotification claim();
    int sent(@Param("id") UUID id);
    int retry(@Param("id") UUID id);
}
