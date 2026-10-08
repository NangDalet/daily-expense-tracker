package com.example.expensetracker.mapper;

import java.util.List;
import java.util.UUID;

import com.example.expensetracker.domain.User;

import org.apache.ibatis.annotations.Param;

/**
 * User persistence. Every statement is implemented in
 * {@code classpath:mappers/UserMapper.xml} - the project forbids
 * {@code @Select}/{@code @Insert} annotations.
 */
public interface UserMapper {

    /** Inserts the user; {@code id}, {@code createdAt} and {@code updatedAt} are filled by the database. */
    int insert(User user);

    User findByUsername(@Param("username") String username);

    User findByEmail(@Param("email") String email);

    User findById(@Param("id") UUID id);

    /** Updates the mutable columns; never touches {@code username}, {@code createdAt}. */
    int update(User user);

    int deleteById(@Param("id") UUID id);

    /**
     * Admin listing, optionally filtered by a case-insensitive username / email
     * search. Paged with LIMIT/OFFSET so no extra interceptor is required.
     */
    List<User> findAll(@Param("search") String search,
                       @Param("offset") int offset,
                       @Param("limit") int limit);

    long countAll(@Param("search") String search);

    /** Excludes the given id - used to allow a user to keep their own username/email. */
    long countByUsernameExcludingId(@Param("username") String username, @Param("excludingId") UUID excludingId);

    long countByEmailExcludingId(@Param("email") String email, @Param("excludingId") UUID excludingId);

    /**
     * Enabled accounts holding {@code role}, ignoring the one identified by
     * {@code excludingId}. Backs the guard that stops the last super
     * administrator from being demoted, disabled or deleted.
     *
     * @param excludingId the account about to change, so it does not count itself
     */
    long countEnabledByRole(@Param("role") String role, @Param("excludingId") UUID excludingId);
}
