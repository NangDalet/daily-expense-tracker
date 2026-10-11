package com.example.expensetracker.construction;

import static org.assertj.core.api.Assertions.*;
import com.example.expensetracker.util.UuidTypeHandler;
import java.io.InputStream;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ConstructionMapperTest {
    private Configuration configuration;
    @BeforeEach void parseMapper() throws Exception {
        configuration=new Configuration(); configuration.getTypeHandlerRegistry().register(UUID.class,UuidTypeHandler.class);
        try(InputStream stream=getClass().getResourceAsStream("/mappers/ConstructionMapper.xml")) {
            new XMLMapperBuilder(stream,configuration,"mappers/ConstructionMapper.xml",configuration.getSqlFragments()).parse();
        }
    }
    private String sql(String name,Object params) { return configuration.getMappedStatement("com.example.expensetracker.mapper.ConstructionMapper."+name).getBoundSql(params).getSql().replaceAll("\\s+"," ").trim(); }
    @Test void locksWorkerAndPayrollOnlyWhenRequested() {
        assertThat(sql("worker",Map.of("id",UUID.randomUUID(),"lock",true))).endsWith("FOR UPDATE");
        assertThat(sql("payroll",Map.of("id",UUID.randomUUID(),"lock",true))).endsWith("FOR UPDATE");
        assertThat(sql("payroll",Map.of("id",UUID.randomUUID(),"lock",false))).doesNotContain("FOR UPDATE");
    }
    @Test void accessUsesCurrentEnabledAccountAndStoredAssignments() {
        assertThat(sql("hasAccess",UUID.randomUUID())).contains("u.enabled", "SUPER_ADMIN", "construction_access a WHERE a.user_id=u.id");
    }
    @Test void payrollClaimsOnlyEligibleAdjustmentsAndAttendance() {
        var p=new ConstructionModels.Payroll(); p.setId(UUID.randomUUID()); p.setWorkerId(UUID.randomUUID()); p.setProjectId(UUID.randomUUID()); p.setToDate(LocalDate.of(2026,1,7)); p.setFromDate(LocalDate.of(2026,1,1));
        assertThat(sql("claimAdjustments",Map.of("payroll",p))).contains("status='APPROVED'", "payroll_id IS NULL", "adjustment_date <= ?");
        assertThat(sql("claimAttendance",Map.of("payroll",p))).contains("project_id=?", "work_date BETWEEN ? AND ?", "payroll_id IS NULL");
    }
    @Test void reportsBindOptionalWorkerAndProjectFiltersWithoutStringInterpolation() {
        var params=new HashMap<String,Object>(); params.put("from",LocalDate.of(2026,1,1)); params.put("to",LocalDate.of(2026,1,31)); params.put("workerId",null); params.put("projectId",null);
        assertThat(sql("payrolls",params)).contains("from_date <= ? AND to_date >= ?").doesNotContain("AND worker_id=?");
        params.put("workerId",UUID.randomUUID()); params.put("projectId",UUID.randomUUID());
        assertThat(sql("payrolls",params)).contains("AND worker_id=?", "AND project_id=?");
    }
}
