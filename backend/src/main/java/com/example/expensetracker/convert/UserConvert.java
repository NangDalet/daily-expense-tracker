package com.example.expensetracker.convert;

import java.util.List;

import com.example.expensetracker.domain.User;
import com.example.expensetracker.dto.response.UserResponse;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * User &lt;-&gt; DTO conversion. Lives in its own package on purpose: the
 * {@code mapper} package is scanned by {@code @MapperScan} and anything placed
 * there would be registered as an additional MyBatis mapper bean.
 */
@Mapper
public interface UserConvert {

    @Mapping(target = "id", expression = "java(user.getId() == null ? null : user.getId().toString())")
    @Mapping(target = "roles", source = "roles")
    UserResponse toResponse(User user);

    List<UserResponse> toResponseList(List<User> users);
}
