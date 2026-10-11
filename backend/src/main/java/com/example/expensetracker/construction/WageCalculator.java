package com.example.expensetracker.construction;

import static com.example.expensetracker.construction.ConstructionModels.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/** Decimal-only arithmetic; attendance contains the rates agreed on its work date. */
public final class WageCalculator {
    private WageCalculator() {}
    public static BigDecimal money(BigDecimal value) { return value.setScale(2, RoundingMode.HALF_UP); }
    public static void calculate(Payroll payroll, Worker worker, List<Attendance> attendance, List<Adjustment> adjustments) {
        BigDecimal days=BigDecimal.ZERO, hours=BigDecimal.ZERO, otHours=BigDecimal.ZERO, base=BigDecimal.ZERO, overtime=BigDecimal.ZERO;
        for (var row : attendance) {
            days=days.add(row.getWorkdays()); hours=hours.add(row.getHours()); otHours=otHours.add(row.getOvertimeHours());
            base=base.add(row.getBaseWages()); overtime=overtime.add(row.getOvertime());
        }
        if (worker.getRateType().equals("FIXED")) base=worker.getRate();
        BigDecimal bonus=BigDecimal.ZERO, allowance=BigDecimal.ZERO, advance=BigDecimal.ZERO, deduction=BigDecimal.ZERO;
        for (var row : adjustments) {
            switch(row.getKind()) {
                case "BONUS" -> bonus=bonus.add(row.getAmount());
                case "ALLOWANCE" -> allowance=allowance.add(row.getAmount());
                case "ADVANCE" -> advance=advance.add(row.getAmount());
                case "DEDUCTION" -> deduction=deduction.add(row.getAmount());
                default -> throw new IllegalArgumentException("Unknown adjustment kind");
            }
        }
        payroll.setWorkdays(days); payroll.setHours(hours); payroll.setOvertimeHours(otHours);
        payroll.setBaseWages(money(base)); payroll.setOvertime(money(overtime)); payroll.setBonuses(money(bonus));
        payroll.setAllowances(money(allowance)); payroll.setAdvances(money(advance)); payroll.setDeductions(money(deduction));
        payroll.setNetPay(money(base.add(overtime).add(bonus).add(allowance).subtract(advance).subtract(deduction)));
    }
}
