package com.example.expensetracker.telegram.mapper;
import java.util.UUID;
import com.example.expensetracker.telegram.model.TelegramConnection;
import com.example.expensetracker.telegram.model.TelegramNotification;
import org.apache.ibatis.annotations.Param;
public interface TelegramMapper {
    UUID findUserIdByChatId(@Param("chatId") long chatId);
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
