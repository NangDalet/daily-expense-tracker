package com.example.expensetracker.util;

import java.sql.Array;
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
 * Maps {@code List<String>} to a PostgreSQL {@code text[]} column.
 * <p>
 * MyBatis has no built-in handler for array columns, so the JDBC array API is
 * used explicitly. {@link #getArray(ResultSet, String)} and
 * {@link #getArray(CallableStatement, int)} implement the two directions:
 * reading through the {@code java.sql.Array} returned by the driver and writing
 * through {@code PreparedStatement#setArray}.
 * <p>
 * Registered globally through {@code mybatis.configuration.type-handlers-package}.
 */
@MappedTypes(List.class)
public class StringArrayTypeHandler extends BaseTypeHandler<List<String>> {

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, List<String> parameter, JdbcType jdbcType)
            throws SQLException {
        // An empty array keeps the column non-null and avoids a NULL <> '{}' mismatch
        Array array = ps.getConnection().createArrayOf("text", parameter.toArray(new String[0]));
        try {
            ps.setArray(i, array);
        } finally {
            // pgjdbc keeps the array alive until the statement is executed
            array.free();
        }
    }

    @Override
    public List<String> getNullableResult(ResultSet rs, String columnName) throws SQLException {
        return toList(rs.getArray(columnName));
    }

    @Override
    public List<String> getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        return toList(rs.getArray(columnIndex));
    }

    @Override
    public List<String> getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        return toList(cs.getArray(columnIndex));
    }

    private List<String> toList(Array array) throws SQLException {
        if (array == null) {
            return new ArrayList<>();
        }
        Object raw = array.getArray();
        if (raw instanceof String[] values) {
            return new ArrayList<>(Arrays.asList(values));
        }
        return new ArrayList<>();
    }
}
