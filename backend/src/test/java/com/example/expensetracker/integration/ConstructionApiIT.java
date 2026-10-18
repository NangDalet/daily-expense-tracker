package com.example.expensetracker.integration;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional @Tag("integration")
class ConstructionApiIT extends AbstractPostgresIT {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    private JsonNode data(MvcResult result) throws Exception { return json.readTree(result.getResponse().getContentAsString()).path("data"); }
    private JsonNode postData(String path,String body,String token) throws Exception {
        return data(mvc.perform(post("/api/v1/construction"+path).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk()).andReturn());
    }
    @Test void automaticOvertimePersistsAndRateUpdatesPreserveRecordedAttendance() throws Exception {
        String token=data(mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"username\":\"root\",\"password\":\"Root@123\"}")).andExpect(status().isOk()).andReturn()).path("accessToken").asText();
        String body="""
            {"workerCode":"AUTO-OT","fullName":"Worker","position":"Worker","rateType":"DAILY","rate":60000,"overtimeRate":0,"hoursPerDay":8,"currency":"KHR","startDate":"2026-01-01","active":true}
            """;
        JsonNode saved=postData("/workers",body,token);
        String id=saved.path("id").asText();
        org.assertj.core.api.Assertions.assertThat(saved.path("overtimeRate").decimalValue()).isEqualByComparingTo("11250");
        org.assertj.core.api.Assertions.assertThat(jdbc.queryForObject("SELECT overtime_rate FROM construction_workers WHERE id=?",java.math.BigDecimal.class,UUID.fromString(id))).isEqualByComparingTo("11250");
        String site=postData("/projects","{\"name\":\"OT site\",\"status\":\"ACTIVE\",\"site\":\"A1\",\"active\":true}",token).path("id").asText();
        String attendanceBody="{\"workerId\":\"%s\",\"projectId\":\"%s\",\"workDate\":\"2026-01-01\",\"kind\":\"FULL\",\"overtimeHours\":2}".formatted(id,site);
        JsonNode attendance=postData("/attendance",attendanceBody,token);
        org.assertj.core.api.Assertions.assertThat(attendance.path("overtime").decimalValue()).isEqualByComparingTo("22500");
        mvc.perform(put("/api/v1/construction/workers/"+id).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
            .content(body.replace("60000","80000"))).andExpect(status().isOk()).andExpect(jsonPath("$.data.overtimeRate").value(15000));
        org.assertj.core.api.Assertions.assertThat(jdbc.queryForObject("SELECT overtime FROM construction_attendance WHERE id=?",java.math.BigDecimal.class,UUID.fromString(attendance.path("id").asText()))).isEqualByComparingTo("22500");
        JsonNode next=postData("/attendance",attendanceBody.replace("2026-01-01","2026-01-02"),token);
        org.assertj.core.api.Assertions.assertThat(next.path("overtime").decimalValue()).isEqualByComparingTo("30000");
        mvc.perform(post("/api/v1/construction/workers").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
            .content(body.replace("Worker\",\"rateType","Construction Foreman\",\"rateType"))).andExpect(status().isUnprocessableEntity());
    }
    @Test void projectPlanningPersistsValidatesAndClearsOptionalFields() throws Exception {
        String token=data(mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"username\":\"root\",\"password\":\"Root@123\"}")).andExpect(status().isOk()).andReturn()).path("accessToken").asText();
        String body="""
            {"name":"Planned site","status":"ACTIVE","site":"A1","active":true,"startDate":"2026-10-11","endDate":"2026-11-10","plannedAmount":1250000.50}
            """;
        JsonNode created=postData("/projects",body,token);
        String id=created.path("id").asText();
        mvc.perform(get("/api/v1/construction/projects").header("Authorization","Bearer "+token)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data[?(@.id == '"+id+"')].startDate").value(org.hamcrest.Matchers.hasItem("2026-10-11")))
            .andExpect(jsonPath("$.data[?(@.id == '"+id+"')].plannedAmount").value(org.hamcrest.Matchers.hasItem(1250000.50)));
        for(String invalid:java.util.List.of(body.replace("2026-11-10","2026-10-10"),body.replace("\"2026-11-10\"","null")))
            mvc.perform(post("/api/v1/construction/projects").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(invalid))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(post("/api/v1/construction/projects").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
            .content(body.replace("1250000.50","-1"))).andExpect(status().isBadRequest());
        mvc.perform(put("/api/v1/construction/projects/"+id).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
            .content(body.replace("1250000.50","2500000"))).andExpect(status().isOk()).andExpect(jsonPath("$.data.plannedAmount").value(2500000));
        mvc.perform(put("/api/v1/construction/projects/"+id).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Planned site\",\"status\":\"ACTIVE\",\"site\":\"A1\",\"active\":true}")).andExpect(status().isOk());
        org.assertj.core.api.Assertions.assertThat(jdbc.queryForMap("SELECT start_date,end_date,planned_amount FROM construction_projects WHERE id=?",UUID.fromString(id)).values())
            .containsOnlyNulls();
    }
    @Test void managersDelegateOnlyForemanAttendanceAtAssignedSites() throws Exception {
        String root=data(mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"username\":\"root\",\"password\":\"Root@123\"}")).andExpect(status().isOk()).andReturn()).path("accessToken").asText();
        String managerBody="""
            {"username":"site-manager","email":"site-manager@example.com","password":"Manager-pass-123!","roles":["USER"],"constructionRole":"MANAGER"}
            """;
        String managerId=data(mvc.perform(post("/api/v1/users").header("Authorization","Bearer "+root).contentType(MediaType.APPLICATION_JSON)
            .content(managerBody)).andExpect(status().isCreated()).andReturn()).path("id").asText();
        String manager=data(mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"username\":\"site-manager\",\"password\":\"Manager-pass-123!\"}")).andExpect(status().isOk()).andReturn()).path("accessToken").asText();
        mvc.perform(get("/api/v1/construction/access").header("Authorization","Bearer "+manager)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.manager").value(true)).andExpect(jsonPath("$.data.superAdmin").value(false));
        mvc.perform(post("/api/v1/users").header("Authorization","Bearer "+manager).contentType(MediaType.APPLICATION_JSON).content(managerBody)).andExpect(status().isForbidden());
        JsonNode registered=data(mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
            .content("{\"username\":\"site-foreman\",\"email\":\"site-foreman@example.com\",\"password\":\"Foreman-pass-123!\"}")).andExpect(status().isCreated()).andReturn());
        String foreman=registered.path("accessToken").asText(), foremanId=registered.path("user").path("id").asText();
        String site=postData("/projects","{\"name\":\"Assigned project\",\"status\":\"ACTIVE\",\"site\":\"A1\",\"active\":true,\"plannedAmount\":100000}",manager).path("id").asText();
        String otherSite=postData("/projects","{\"name\":\"Other project\",\"status\":\"ACTIVE\",\"site\":\"B2\",\"active\":true}",manager).path("id").asText();
        String assignment="{\"granted\":true,\"constructionRole\":\"FOREMAN\",\"siteIds\":[\"%s\"]}".formatted(site);
        mvc.perform(put("/api/v1/construction/grants/"+foremanId).header("Authorization","Bearer "+manager).contentType(MediaType.APPLICATION_JSON)
            .content("{\"granted\":true,\"constructionRole\":\"FOREMAN\",\"siteIds\":[]}")).andExpect(status().isUnprocessableEntity());
        mvc.perform(put("/api/v1/construction/grants/"+foremanId).header("Authorization","Bearer "+manager).contentType(MediaType.APPLICATION_JSON).content(assignment)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/construction/projects").header("Authorization","Bearer "+foreman)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data[0].plannedAmount").doesNotExist());
        mvc.perform(put("/api/v1/construction/grants/"+foremanId).header("Authorization","Bearer "+manager).contentType(MediaType.APPLICATION_JSON)
            .content("{\"granted\":true,\"constructionRole\":\"MANAGER\"}")).andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/construction/grants/"+managerId).header("Authorization","Bearer "+manager).contentType(MediaType.APPLICATION_JSON).content(assignment)).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/construction/grants").header("Authorization","Bearer "+manager)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data[?(@.userId == '"+foremanId+"')].siteIds[0]").value(org.hamcrest.Matchers.hasItem(site)));
        String workerBody="""
            {"workerCode":"FOREMAN-A1","fullName":"Assigned worker","position":"Worker","rateType":"DAILY","rate":40000,"overtimeRate":5000,"hoursPerDay":8,"currency":"KHR","startDate":"2026-01-01","active":true,"projectId":"%s"}
            """.formatted(site);
        String worker=postData("/workers",workerBody,manager).path("id").asText();
        String otherWorker=postData("/workers",workerBody.replace("FOREMAN-A1","FOREMAN-B2").replace(site,otherSite),manager).path("id").asText();
        mvc.perform(get("/api/v1/construction/workers").header("Authorization","Bearer "+foreman)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.length()").value(1)).andExpect(jsonPath("$.data[0].id").value(worker)).andExpect(jsonPath("$.data[0].rate").doesNotExist());
        mvc.perform(get("/api/v1/construction/projects").header("Authorization","Bearer "+foreman)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.length()").value(1)).andExpect(jsonPath("$.data[0].id").value(site));
        String attendance="{\"workerId\":\"%s\",\"projectId\":\"%s\",\"workDate\":\"2026-01-01\",\"kind\":\"FULL\",\"overtimeHours\":1}".formatted(worker,site);
        JsonNode row=postData("/attendance",attendance,foreman);
        String attendanceId=row.path("id").asText();
        org.assertj.core.api.Assertions.assertThat(row.path("baseWages").isNull() || row.path("baseWages").isMissingNode()).isTrue();
        org.assertj.core.api.Assertions.assertThat(jdbc.queryForObject("SELECT base_wages FROM construction_attendance WHERE id=?",java.math.BigDecimal.class,UUID.fromString(attendanceId))).isEqualByComparingTo("40000");
        mvc.perform(put("/api/v1/construction/attendance/"+attendanceId).header("Authorization","Bearer "+foreman).contentType(MediaType.APPLICATION_JSON)
            .content(attendance.replace("FULL","HALF"))).andExpect(status().isOk()).andExpect(jsonPath("$.data.hours").value(4));
        String foreignAttendance=postData("/attendance",attendance.replace(worker,otherWorker).replace(site,otherSite),manager).path("id").asText();
        mvc.perform(get("/api/v1/construction/attendance").param("from","2026-01-01").param("to","2026-01-31").header("Authorization","Bearer "+foreman))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(1)).andExpect(jsonPath("$.data[0].baseWages").doesNotExist());
        mvc.perform(post("/api/v1/construction/attendance").header("Authorization","Bearer "+foreman).contentType(MediaType.APPLICATION_JSON)
            .content(attendance.replace(site,otherSite))).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/construction/attendance").header("Authorization","Bearer "+foreman).contentType(MediaType.APPLICATION_JSON)
            .content(attendance.replace(worker,otherWorker))).andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/construction/attendance/"+foreignAttendance).header("Authorization","Bearer "+foreman)).andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/construction/attendance/"+foreignAttendance).header("Authorization","Bearer "+foreman).contentType(MediaType.APPLICATION_JSON).content(attendance)).andExpect(status().isForbidden());
        for(String path:java.util.List.of("/grants","/workers/"+worker,"/adjustments","/payrolls?from=2026-01-01&to=2026-01-31"))
            mvc.perform(get("/api/v1/construction"+path).header("Authorization","Bearer "+foreman)).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/construction/workers").header("Authorization","Bearer "+foreman).contentType(MediaType.APPLICATION_JSON).content(workerBody)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/construction/attendance/"+attendanceId).header("Authorization","Bearer "+foreman)).andExpect(status().isOk());
        mvc.perform(put("/api/v1/construction/grants/"+foremanId).header("Authorization","Bearer "+manager).contentType(MediaType.APPLICATION_JSON)
            .content(assignment.replace(site,otherSite))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/construction/workers").header("Authorization","Bearer "+foreman)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.length()").value(1)).andExpect(jsonPath("$.data[0].id").value(otherWorker));
        mvc.perform(post("/api/v1/construction/attendance").header("Authorization","Bearer "+foreman).contentType(MediaType.APPLICATION_JSON)
            .content(attendance)).andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/construction/grants/"+foremanId).header("Authorization","Bearer "+manager).contentType(MediaType.APPLICATION_JSON)
            .content("{\"granted\":false,\"constructionRole\":\"FOREMAN\"}")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/construction/workers").header("Authorization","Bearer "+foreman)).andExpect(status().isForbidden());
        org.assertj.core.api.Assertions.assertThat(jdbc.queryForObject("SELECT count(*) FROM construction_foreman_sites WHERE user_id=?",Integer.class,UUID.fromString(foremanId))).isZero();
    }
    @Test void workerLegacyPhotosArePreservedButNewUploadsRequireR2() throws Exception {
        String root=data(mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"root\",\"password\":\"Root@123\"}")).andExpect(status().isOk()).andReturn()).path("accessToken").asText();
        var bytes=new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(16,12,java.awt.image.BufferedImage.TYPE_INT_RGB),"png",bytes);
        var request=json.createObjectNode();
        request.put("workerCode","photo-test").put("fullName","Photo worker").put("position","Worker").put("rateType","DAILY").put("rate",40000).put("overtimeRate",0).put("hoursPerDay",8).put("currency","KHR").put("startDate","2026-01-01").put("active",true);
        JsonNode saved=postData("/workers",request.toString(),root);
        String id=saved.path("id").asText(), photo="data:image/png;base64,"+java.util.Base64.getEncoder().encodeToString(bytes.toByteArray());
        jdbc.update("UPDATE construction_workers SET photo_data_url=? WHERE id=?",photo,UUID.fromString(id));
        org.assertj.core.api.Assertions.assertThat(jdbc.queryForObject("SELECT photo_data_url FROM construction_workers WHERE id=?",String.class,UUID.fromString(id))).isEqualTo(photo);
        mvc.perform(get("/api/v1/construction/workers").header("Authorization","Bearer "+root)).andExpect(status().isOk()).andExpect(jsonPath("$.data[?(@.id == '"+id+"')].photoDataUrl").value(org.hamcrest.Matchers.hasItem(photo)));
        request.remove("photoDataUrl");
        mvc.perform(put("/api/v1/construction/workers/"+id).header("Authorization","Bearer "+root).contentType(MediaType.APPLICATION_JSON).content(request.toString())).andExpect(status().isOk()).andExpect(jsonPath("$.data.photoDataUrl").value(photo));
        request.put("photoDataUrl","data:image/jpeg;base64,aGVsbG8=");
        mvc.perform(put("/api/v1/construction/workers/"+id).header("Authorization","Bearer "+root).contentType(MediaType.APPLICATION_JSON).content(request.toString())).andExpect(status().isUnprocessableEntity());
        org.assertj.core.api.Assertions.assertThat(jdbc.queryForObject("SELECT photo_data_url FROM construction_workers WHERE id=?",String.class,UUID.fromString(id))).isEqualTo(photo);
        bytes.reset();
        javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(24,18,java.awt.image.BufferedImage.TYPE_INT_RGB),"png",bytes);
        request.put("photoDataUrl","data:image/png;base64,"+java.util.Base64.getEncoder().encodeToString(bytes.toByteArray()));
        mvc.perform(put("/api/v1/construction/workers/"+id).header("Authorization","Bearer "+root).contentType(MediaType.APPLICATION_JSON).content(request.toString())).andExpect(status().isServiceUnavailable());
        org.assertj.core.api.Assertions.assertThat(jdbc.queryForObject("SELECT photo_data_url FROM construction_workers WHERE id=?",String.class,UUID.fromString(id))).isEqualTo(photo);
        request.put("photoDataUrl","");
        mvc.perform(put("/api/v1/construction/workers/"+id).header("Authorization","Bearer "+root).contentType(MediaType.APPLICATION_JSON).content(request.toString())).andExpect(status().isOk()).andExpect(jsonPath("$.data.photoDataUrl").doesNotExist());
        org.assertj.core.api.Assertions.assertThat(jdbc.queryForObject("SELECT photo_data_url FROM construction_workers WHERE id=?",String.class,UUID.fromString(id))).isNull();
    }
    @Test void assignedSitesAndLegacyIdCardsPersistWithCardsOnlyLoadedForWorkerDetails() throws Exception {
        String token = data(mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"username\":\"root\",\"password\":\"Root@123\"}")).andExpect(status().isOk()).andReturn()).path("accessToken").asText();
        JsonNode site = postData("/projects", "{\"name\":\"Project A\",\"status\":\"ACTIVE\",\"site\":\"A1\",\"active\":true}", token);
        var bytes = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(1200,800,java.awt.image.BufferedImage.TYPE_INT_RGB),"png",bytes);
        var request = json.createObjectNode();
        request.put("workerCode","ID-CARD-01").put("fullName","Site worker").put("position","Worker").put("rateType","DAILY")
            .put("rate",40000).put("overtimeRate",0).put("hoursPerDay",8).put("currency","KHR").put("startDate","2026-01-01")
            .put("active",true).put("projectId",site.path("id").asText());
        JsonNode saved = postData("/workers",request.toString(),token);
        String id = saved.path("id").asText(), card = "data:image/png;base64,"+java.util.Base64.getEncoder().encodeToString(bytes.toByteArray());
        // Legacy embedded cards remain readable; new uploads are covered by R2PhotoApiIT.
        jdbc.update("UPDATE construction_workers SET id_card_data_url=? WHERE id=?",card,UUID.fromString(id));
        org.assertj.core.api.Assertions.assertThat(saved.path("projectId").asText()).isEqualTo(site.path("id").asText());
        org.assertj.core.api.Assertions.assertThat(jdbc.queryForObject("SELECT id_card_data_url FROM construction_workers WHERE id=?",String.class,UUID.fromString(id))).isEqualTo(card);
        mvc.perform(get("/api/v1/construction/workers").header("Authorization","Bearer "+token)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data[?(@.id == '"+id+"')].hasIdCard").value(org.hamcrest.Matchers.hasItem(true)))
            .andExpect(jsonPath("$.data[?(@.id == '"+id+"')].idCardDataUrl").isEmpty());
        mvc.perform(get("/api/v1/construction/workers/"+id).header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$.data.idCardDataUrl").value(card));
        request.remove("idCardDataUrl"); request.remove("projectId");
        mvc.perform(put("/api/v1/construction/workers/"+id).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(request.toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.idCardDataUrl").value(card)).andExpect(jsonPath("$.data.projectId").value(site.path("id").asText()));
        request.put("idCardDataUrl","data:image/jpeg;base64,aGVsbG8=");
        mvc.perform(put("/api/v1/construction/workers/"+id).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(request.toString())).andExpect(status().isUnprocessableEntity());
        request.put("idCardDataUrl","");
        mvc.perform(put("/api/v1/construction/workers/"+id).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(request.toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.idCardDataUrl").doesNotExist()).andExpect(jsonPath("$.data.hasIdCard").value(false));
    }
    @Test void assignmentAttendancePayrollPartialPaymentsCancellationAndRevocation() throws Exception {
        String root=data(mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"root\",\"password\":\"Root@123\"}")).andExpect(status().isOk()).andReturn()).path("accessToken").asText();
        JsonNode registered=data(mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"construction-test\",\"email\":\"construction@example.com\",\"password\":\"S3cret-pass!\"}")).andExpect(status().isCreated()).andReturn());
        String token=registered.path("accessToken").asText(), userId=registered.path("user").path("id").asText();
        mvc.perform(get("/api/v1/construction/workers").header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/construction/grants").header("Authorization","Bearer "+root)).andExpect(status().isOk()).andExpect(jsonPath("$.data[0].userId").exists());
        mvc.perform(put("/api/v1/construction/grants/"+userId).header("Authorization","Bearer "+root).contentType(MediaType.APPLICATION_JSON).content("{\"granted\":true}")).andExpect(status().isOk());
        mvc.perform(put("/api/v1/construction/grants/"+userId).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content("{\"granted\":true}")).andExpect(status().isForbidden());
        String worker=postData("/workers","""
            {"workerCode":"CW01","fullName":"Worker","position":"Worker","rateType":"DAILY","rate":20,"overtimeRate":4,"hoursPerDay":8,"currency":"KHR","startDate":"2026-01-01","active":true}
            """,token).path("id").asText();
        String project=postData("/projects","{\"name\":\"House\",\"status\":\"ACTIVE\",\"site\":\"Site 1\",\"active\":true}",token).path("id").asText();
        String attendanceBody="{\"workerId\":\"%s\",\"projectId\":\"%s\",\"workDate\":\"2026-01-01\",\"kind\":\"HALF\",\"overtimeHours\":2}".formatted(worker,project);
        String attendanceId=postData("/attendance",attendanceBody,token).path("id").asText();
        String adjustment=postData("/adjustments","{\"workerId\":\"%s\",\"kind\":\"ADVANCE\",\"amount\":5,\"adjustmentDate\":\"2026-01-01\",\"reason\":\"Food\"}".formatted(worker),token).path("id").asText();
        mvc.perform(put("/api/v1/construction/adjustments/"+adjustment+"/approval").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content("{\"approved\":true,\"reason\":\"Confirmed\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.data.approvedBy").value(userId));
        String payrollBody="{\"workerId\":\"%s\",\"projectId\":\"%s\",\"fromDate\":\"2026-01-01\",\"toDate\":\"2026-01-07\",\"period\":\"WEEKLY\"}".formatted(worker,project);
        JsonNode payroll=postData("/payrolls",payrollBody,token);
        org.assertj.core.api.Assertions.assertThat(payroll.path("netPay").decimalValue()).isEqualByComparingTo("12.5");
        String payrollId=payroll.path("id").asText();
        mvc.perform(post("/api/v1/construction/payrolls").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(payrollBody)).andExpect(status().isConflict());
        mvc.perform(delete("/api/v1/construction/attendance/"+attendanceId).header("Authorization","Bearer "+token)).andExpect(status().isUnprocessableEntity());
        String payment="{\"requestKey\":\"%s\",\"paymentDate\":\"2026-01-07\",\"amount\":5,\"method\":\"CASH\"}".formatted(UUID.randomUUID());
        String paymentPath="/payrolls/"+payrollId+"/payments"; postData(paymentPath,payment,token); postData(paymentPath,payment,token);
        mvc.perform(get("/api/v1/construction"+paymentPath).header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(1));
        mvc.perform(get("/api/v1/construction/payrolls/"+payrollId).header("Authorization","Bearer "+token)).andExpect(jsonPath("$.data.paidAmount").value(5)).andExpect(jsonPath("$.data.status").value("PARTIALLY_PAID"));
        mvc.perform(post("/api/v1/construction/payrolls/"+payrollId+"/cancel").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Mistake\"}")).andExpect(status().isUnprocessableEntity());
        mvc.perform(put("/api/v1/construction/grants/"+userId).header("Authorization","Bearer "+root).contentType(MediaType.APPLICATION_JSON).content("{\"granted\":false}")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/construction/payrolls/"+payrollId).header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/users/"+userId).header("Authorization","Bearer "+root)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/users/"+userId).header("Authorization","Bearer "+root)).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/users").param("search","construction-test").header("Authorization","Bearer "+root)).andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(0));
        mvc.perform(get("/api/v1/construction/workers").header("Authorization","Bearer "+root)).andExpect(status().isOk()).andExpect(jsonPath("$.data[0].id").value(worker));
        mvc.perform(get("/api/v1/construction/payrolls/"+payrollId+"/receipt").header("Authorization","Bearer "+root)).andExpect(status().isOk()).andExpect(jsonPath("$.data.payments[0].processorName").value("construction-test"));
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"construction-test\",\"password\":\"S3cret-pass!\"}")).andExpect(status().isForbidden());
        org.assertj.core.api.Assertions.assertThat(jdbc.queryForObject("SELECT archived AND NOT enabled FROM users WHERE id=?",Boolean.class,UUID.fromString(userId))).isTrue();
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> jdbc.update("UPDATE construction_payrolls SET currency='USD' WHERE id=?", UUID.fromString(payrollId)))
            .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    @Test void customPayrollPaysOnlyNonConsecutiveWorkedDaysAndPreventsDuplicates() throws Exception {
        String root=data(mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"root\",\"password\":\"Root@123\"}")).andExpect(status().isOk()).andReturn()).path("accessToken").asText();
        String worker=postData("/workers","""
            {"workerCode":"CUSTOM01","fullName":"Custom worker","position":"Worker","rateType":"DAILY","rate":20000,"overtimeRate":4000,"hoursPerDay":8,"currency":"KHR","startDate":"2026-01-01","active":true}
            """,root).path("id").asText();
        String project=postData("/projects","{\"name\":\"Custom project\",\"status\":\"ACTIVE\",\"site\":\"Site\",\"active\":true}",root).path("id").asText();
        for(String date : java.util.List.of("2026-01-01","2026-01-04","2026-01-10")) {
            String kind=date.endsWith("04") ? "HALF" : "FULL";
            postData("/attendance","{\"workerId\":\"%s\",\"projectId\":\"%s\",\"workDate\":\"%s\",\"kind\":\"%s\",\"overtimeHours\":0}".formatted(worker,project,date,kind),root);
        }
        String request="{\"workerId\":\"%s\",\"projectId\":\"%s\",\"fromDate\":\"2026-01-01\",\"toDate\":\"2026-01-10\",\"period\":\"CUSTOM\"}".formatted(worker,project);
        JsonNode preview=postData("/payrolls/preview",request,root);
        org.assertj.core.api.Assertions.assertThat(preview.path("workdays").decimalValue()).isEqualByComparingTo("2.5");
        org.assertj.core.api.Assertions.assertThat(preview.path("netPay").decimalValue()).isEqualByComparingTo("50000");
        JsonNode payroll=postData("/payrolls",request,root);
        org.assertj.core.api.Assertions.assertThat(payroll.path("period").asText()).isEqualTo("CUSTOM");
        mvc.perform(post("/api/v1/construction/payrolls").header("Authorization","Bearer "+root).contentType(MediaType.APPLICATION_JSON).content(request)).andExpect(status().isConflict());
        String payrollId=payroll.path("id").asText();
        postData("/payrolls/"+payrollId+"/payments","{\"requestKey\":\"%s\",\"paymentDate\":\"2026-01-10\",\"amount\":50000,\"method\":\"CASH\"}".formatted(UUID.randomUUID()),root);
        mvc.perform(get("/api/v1/construction/payrolls/"+payrollId).header("Authorization","Bearer "+root)).andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("PAID")).andExpect(jsonPath("$.data.paidAmount").value(50000));
    }

    @Test void rejectsNonKhrWorkersAtApiAndDatabaseBoundaries() throws Exception {
        String root=data(mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"root\",\"password\":\"Root@123\"}")).andExpect(status().isOk()).andReturn()).path("accessToken").asText();
        mvc.perform(post("/api/v1/construction/workers").header("Authorization","Bearer "+root).contentType(MediaType.APPLICATION_JSON).content("""
            {"workerCode":"USD-test","fullName":"Invalid currency","position":"Worker","rateType":"DAILY","rate":20,"overtimeRate":4,"hoursPerDay":8,"currency":"USD","startDate":"2026-01-01","active":true}
            """)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> jdbc.update("""
            INSERT INTO construction_workers(id,worker_code,full_name,position,rate_type,rate,overtime_rate,hours_per_day,currency,start_date)
            VALUES (?,'USD-test','Invalid currency','Mason','DAILY',20,4,8,'USD','2026-01-01')
            """, UUID.randomUUID())).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
}
