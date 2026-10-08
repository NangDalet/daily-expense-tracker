package com.example.expensetracker.util;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.MappedTypes;

/**
 * Maps {@code List<String>} to a delimited {@code VARCHAR} column.
 * <p>
 * Used for {@code users.roles} ("ADMIN,USER") and for the request payloads that
 * store tag lists. Values are trimmed, blank entries are dropped and the
 * separator is escaped by simply rejecting values containing a comma - the
 * application never stores roles or tags that contain one.
 * <p>
 * Registered globally through {@code mybatis.configuration.type-handlers-package}.
 */
@MappedTypes(List.class)
public class StringListTypeHandler extends BaseTypeHandler<List<String>> {

    private static final String DELIMITER = ",";

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, List<String> parameter, JdbcType jdbcType)
            throws SQLException {
        ps.setString(i, String.join(DELIMITER, parameter));
    }

    @Override
    public List<String> getNullableResult(ResultSet rs, String columnName) throws SQLException {
        return parse(rs.getString(columnName));
    }

    @Override
    public List<String> getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        return parse(rs.getString(columnIndex));
    }

    @Override
    public List<String> getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        return parse(cs.getString(columnIndex));
    }

    private List<String> parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return new ArrayList<>();
        }
        List<String> values = new ArrayList<>();
        Arrays.stream(raw.split(DELIMITER))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .forEach(values::add);
        return values;
    }
}
