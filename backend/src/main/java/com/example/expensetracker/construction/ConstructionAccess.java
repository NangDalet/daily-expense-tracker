package com.example.expensetracker.construction;

import com.example.expensetracker.mapper.ConstructionMapper;
import com.example.expensetracker.mapper.UserMapper;
import com.example.expensetracker.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

@Component("constructionAccess")
@RequiredArgsConstructor
public class ConstructionAccess {
    private final ConstructionMapper mapper;
    private final UserMapper users;
    public boolean allowed(Authentication authentication) {
        return mapper.hasAccess(SecurityUtils.currentUserId(authentication));
    }
    public boolean manager(Authentication authentication) {
        return allowed(authentication) && (superAdmin(authentication)
            || "MANAGER".equals(mapper.accessRole(SecurityUtils.currentUserId(authentication))));
    }
    public java.util.List<java.util.UUID> sites(Authentication authentication) {
        return mapper.foremanSites(SecurityUtils.currentUserId(authentication));
    }
    public ConstructionModels.Access details(Authentication authentication) {
        boolean allowed=allowed(authentication), admin=superAdmin(authentication), manager=manager(authentication);
        return new ConstructionModels.Access(allowed, admin, manager, allowed ? (manager ? "MANAGER" : "FOREMAN") : null,
            allowed && !manager ? sites(authentication) : java.util.List.of());
    }
    public boolean attendance(Authentication authentication, ConstructionRequests.AttendanceRequest request, java.util.UUID id) {
        if(manager(authentication)) return true;
        if(!allowed(authentication) || !sites(authentication).contains(request.projectId())) return false;
        var worker=mapper.worker(request.workerId(),false);
        if(worker==null || !request.projectId().equals(worker.getProjectId())) return false;
        var previous=id==null ? null : mapper.attendanceById(id);
        return id==null || (previous!=null && sites(authentication).contains(previous.getProjectId()));
    }
    public boolean removeAttendance(Authentication authentication, java.util.UUID id) {
        if(manager(authentication)) return true;
        var row=mapper.attendanceById(id);
        return allowed(authentication) && row!=null && sites(authentication).contains(row.getProjectId());
    }
    public boolean superAdmin(Authentication authentication) {
        var user = users.findById(SecurityUtils.currentUserId(authentication));
        return user != null && Boolean.TRUE.equals(user.getEnabled()) && user.getRoles().contains("SUPER_ADMIN");
    }
}
