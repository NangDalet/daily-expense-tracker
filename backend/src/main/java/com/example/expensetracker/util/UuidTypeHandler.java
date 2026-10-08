package com.example.expensetracker.util;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.UUID;

import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.MappedTypes;

/**
 * Reads and writes PostgreSQL {@code uuid} columns.
 * <p>
 * MyBatis ships no handler for {@link UUID}, so without this class every
 * {@code <id property="id" column="id"/>} in a {@code <resultMap>} fails at
 * startup with "No typehandler found for property id", and every {@code #{id}}
 * parameter of a {@code java.util.UUID} argument fails at execution time.
 * <p>
 * It is registered once in
 * {@link com.example.expensetracker.config.MyBatisConfig}, so the mapper XML
 * files stay free of repeated {@code typeHandler} attributes.
 */
@MappedTypes(UUID.class)
public class UuidTypeHandler extends BaseTypeHandler<UUID> {

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, UUID parameter, JdbcType jdbcType)
            throws SQLException {
        ps.setObject(i, parameter);
    }

    @Override
    public UUID getNullableResult(ResultSet rs, String columnName) throws SQLException {
        return rs.getObject(columnName, UUID.class);
    }

    @Override
    public UUID getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        return rs.getObject(columnIndex, UUID.class);
    }

    @Override
    public UUID getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        return cs.getObject(columnIndex, UUID.class);
    }
}
