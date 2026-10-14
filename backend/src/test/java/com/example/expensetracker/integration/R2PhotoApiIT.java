package com.example.expensetracker.integration;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

/** Real PostgreSQL/transactions/access checks with an isolated in-memory S3 transport. */
@SpringBootTest(properties = {"app.r2.enabled=true", "app.r2.bucket=test-photos", "debug=false"})
@AutoConfigureMockMvc @ActiveProfiles("test") @Tag("integration")
class R2PhotoApiIT extends AbstractPostgresIT {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
    @MockBean S3Client r2;
    private final Map<String, byte[]> objects = new ConcurrentHashMap<>();
    private UUID owner, foreman, outsider, site;
    private String photo;

    @BeforeEach void setup() throws Exception {
        owner = UUID.randomUUID(); foreman = UUID.randomUUID(); outsider = UUID.randomUUID(); site = UUID.randomUUID();
        new org.springframework.transaction.support.TransactionTemplate(transactions).executeWithoutResult(status -> {
        for (var id : new UUID[]{owner, foreman, outsider}) jdbc.update(
                "INSERT INTO users(id,username,email,password,roles,enabled) VALUES (?,?,?,?,?,true)",
                id, "r2-" + id, id + "@example.com", "hash", id.equals(owner) ? "SUPER_ADMIN,USER" : "USER");
        jdbc.update("INSERT INTO construction_projects(id,name,site,active,status) VALUES (?,?,?,true,'ACTIVE')", site, "Site-" + site, "A");
        jdbc.update("INSERT INTO construction_access(user_id,granted_by,construction_role) VALUES (?,?,'FOREMAN')", foreman, owner);
        jdbc.update("INSERT INTO construction_foreman_sites(user_id,project_id) VALUES (?,?)", foreman, site);
        });
        var buffer = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB), "png", buffer);
        photo = "data:image/png;base64," + Base64.getEncoder().encodeToString(buffer.toByteArray());
        when(r2.putObject(any(PutObjectRequest.class), any(RequestBody.class))).thenAnswer(invocation -> {
            PutObjectRequest request = invocation.getArgument(0);
            RequestBody body = invocation.getArgument(1);
            try (var stream = body.contentStreamProvider().newStream()) { objects.put(request.key(), stream.readAllBytes()); }
            return PutObjectResponse.builder().build();
        });
        when(r2.getObjectAsBytes(any(GetObjectRequest.class))).thenAnswer(invocation -> {
            GetObjectRequest request = invocation.getArgument(0);
            var bytes = objects.get(request.key());
            if (bytes == null) throw NoSuchKeyException.builder().statusCode(404).build();
            return ResponseBytes.fromByteArray(GetObjectResponse.builder().contentType("image/jpeg").build(), bytes);
        });
        when(r2.deleteObject(any(DeleteObjectRequest.class))).thenAnswer(invocation -> {
            DeleteObjectRequest request = invocation.getArgument(0);
            objects.remove(request.key());
            return DeleteObjectResponse.builder().build();
        });
    }
    private RequestPostProcessor as(UUID user) {
        return jwt().jwt(token -> token.subject(user.toString()))
                .authorities(new SimpleGrantedAuthority(user.equals(owner) ? "ROLE_SUPER_ADMIN" : "ROLE_USER"));
    }
    private JsonNode data(MvcResult result) throws Exception { return json.readTree(result.getResponse().getContentAsString()).path("data"); }
    private String uploadProfile() throws Exception {
        return data(mvc.perform(put("/api/v1/profile/photo").with(as(owner)).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("imageData", photo))))
                .andExpect(status().isOk()).andReturn()).path("avatarUrl").asText();
    }

    @Test void profileImagesStoreReferencesAndRequireTheirOwner() throws Exception {
        String reference = uploadProfile();
        assertThat(reference).startsWith("/api/v1/media/profiles/" + owner);
        assertThat(jdbc.queryForObject("SELECT avatar_url FROM users WHERE id=?", String.class, owner)).isEqualTo(reference);
        assertThat(objects).hasSize(1);
        mvc.perform(get(reference).with(as(owner))).andExpect(status().isOk()).andExpect(content().contentType(MediaType.IMAGE_JPEG));
        mvc.perform(get(reference).with(as(outsider))).andExpect(status().isNotFound());
        mvc.perform(get(reference)).andExpect(status().isUnauthorized());
        String next = uploadProfile();
        assertThat(next).isNotEqualTo(reference);
        assertThat(objects).hasSize(1);
        mvc.perform(get(reference).with(as(owner))).andExpect(status().isNotFound());
        mvc.perform(delete("/api/v1/profile/photo").with(as(owner))).andExpect(status().isOk());
        assertThat(objects).isEmpty();
        mvc.perform(get(next).with(as(owner))).andExpect(status().isNotFound());
    }

    private Map<String, Object> workerBody(String code) {
        return new java.util.HashMap<>(Map.ofEntries(Map.entry("workerCode", code), Map.entry("fullName", "Worker"),
                Map.entry("position", "Worker"), Map.entry("rateType", "DAILY"), Map.entry("rate", 60000),
                Map.entry("overtimeRate", 0), Map.entry("hoursPerDay", 8), Map.entry("currency", "KHR"),
                Map.entry("startDate", "2026-10-14"), Map.entry("active", true), Map.entry("projectId", site.toString()),
                Map.entry("photoDataUrl", photo), Map.entry("idCardDataUrl", photo)));
    }

    @Test void workerPhotoAndIdCardReadsFollowSiteAndManagerPermissions() throws Exception {
        var body = workerBody("CW-" + site);
        var saved = data(mvc.perform(post("/api/v1/construction/workers").with(as(owner)).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body))).andExpect(status().isOk()).andReturn());
        String photoUrl = saved.path("photoDataUrl").asText(), cardUrl = saved.path("idCardDataUrl").asText();
        assertThat(photoUrl).startsWith("/api/v1/media/workers/");
        assertThat(objects).hasSize(2);
        mvc.perform(get(photoUrl).with(as(owner))).andExpect(status().isOk());
        mvc.perform(get(photoUrl).with(as(foreman))).andExpect(status().isOk());
        mvc.perform(get(cardUrl).with(as(owner))).andExpect(status().isOk());
        mvc.perform(get(cardUrl).with(as(foreman))).andExpect(status().isNotFound());
        mvc.perform(get(photoUrl).with(as(outsider))).andExpect(status().isNotFound());
        body.put("photoDataUrl", photoUrl); body.put("idCardDataUrl", cardUrl);
        mvc.perform(put("/api/v1/construction/workers/" + saved.path("id").asText()).with(as(owner))
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andExpect(status().isOk());
        assertThat(objects).hasSize(2);
        verify(r2, times(2)).putObject(any(PutObjectRequest.class), any(RequestBody.class));
        new org.springframework.transaction.support.TransactionTemplate(transactions).executeWithoutResult(status ->
            jdbc.update("DELETE FROM construction_foreman_sites WHERE user_id=?", foreman));
        mvc.perform(get(photoUrl).with(as(foreman))).andExpect(status().isNotFound());
    }

    @Test void databaseFailureRollsBackAndRemovesBothUploadedWorkerObjects() throws Exception {
        var body = workerBody("duplicate-" + site.toString().substring(0, 8));
        mvc.perform(post("/api/v1/construction/workers").with(as(owner)).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body))).andExpect(status().isOk());
        var existingKeys = java.util.Set.copyOf(objects.keySet());
        // Duplicate worker code fails at the database after both uploads.
        mvc.perform(post("/api/v1/construction/workers").with(as(owner)).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body))).andExpect(status().isConflict());
        assertThat(objects.keySet()).containsExactlyInAnyOrderElementsOf(existingKeys);
    }

    @Test void failedStorageKeepsTheExistingProfilePhoto() throws Exception {
        String reference = uploadProfile();
        when(r2.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenThrow(SdkClientException.create("Upload failed"));
        mvc.perform(put("/api/v1/profile/photo").with(as(owner)).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("imageData", photo)))).andExpect(status().isServiceUnavailable());
        assertThat(jdbc.queryForObject("SELECT avatar_url FROM users WHERE id=?", String.class, owner)).isEqualTo(reference);
        assertThat(objects).hasSize(1);
    }
}
