package com.example.expensetracker.construction;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.example.expensetracker.domain.User;
import com.example.expensetracker.mapper.ConstructionMapper;
import com.example.expensetracker.mapper.UserMapper;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

class ConstructionAccessTest {
    @Test void rereadsAssignmentAndEnabledSuperAdminStatusOnEveryRequest() {
        var mapper=mock(ConstructionMapper.class); var users=mock(UserMapper.class); var access=new ConstructionAccess(mapper,users);
        var id=UUID.randomUUID(); var auth=new UsernamePasswordAuthenticationToken(id.toString(),null,List.of());
        when(mapper.hasAccess(id)).thenReturn(true,false); assertThat(access.allowed(auth)).isTrue(); assertThat(access.allowed(auth)).isFalse();
        var user=User.builder().roles(List.of("SUPER_ADMIN")).enabled(true).build(); when(users.findById(id)).thenReturn(user);
        assertThat(access.superAdmin(auth)).isTrue(); user.setEnabled(false); assertThat(access.superAdmin(auth)).isFalse();
        user.setEnabled(true); user.setRoles(List.of("ADMIN")); assertThat(access.superAdmin(auth)).isFalse();
    }
}
