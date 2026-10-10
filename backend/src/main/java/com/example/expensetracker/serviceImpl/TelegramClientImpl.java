package com.example.expensetracker.serviceImpl;
import java.time.Duration;
import java.net.http.HttpClient;
import java.util.Map;
import java.util.List;
import com.example.expensetracker.config.TelegramProperties;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import com.example.expensetracker.service.TelegramClient;
import lombok.RequiredArgsConstructor;
@Service @RequiredArgsConstructor
public class TelegramClientImpl implements TelegramClient {
    private final TelegramProperties properties;
    private final RestClient client = RestClient.builder().requestFactory(factory()).build();
    private static JdkClientHttpRequestFactory factory() {
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
        factory.setReadTimeout(Duration.ofSeconds(10)); return factory;
    }
    private record Result(boolean ok) {}
    private record UpdatesResult(boolean ok, List<Update> result) {}
    @Override public List<Update> updates(long offset) {
        UpdatesResult response = client.get()
                .uri("https://api.telegram.org/bot" + properties.getBotToken()
                        + "/getUpdates?offset=" + offset + "&limit=100&timeout=0&allowed_updates=%5B%22message%22%5D")
                .retrieve().body(UpdatesResult.class);
        if (response == null || !response.ok() || response.result() == null)
            throw new IllegalStateException("Telegram update retrieval failed");
        return response.result();
    }
    @Override public void send(long chatId, String message) {
        Result response = client.post().uri("https://api.telegram.org/bot" + properties.getBotToken() + "/sendMessage")
                .body(Map.of("chat_id", chatId, "text", message)).retrieve().body(Result.class);
        if (response == null || !response.ok()) throw new IllegalStateException("Telegram delivery failed");
    }
}
