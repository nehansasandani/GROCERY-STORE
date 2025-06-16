import Report from '../models/report.model.js';
import Employee from '../models/employee.model.js';
import Salary from '../models/salary.model.js';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// 📌 Generate Salary Report (Export to PDF)
export const generateSalaryReport = async (req, res) => {
    try {
        const employees = await Employee.find();
        const salaries = await Salary.find();

        if (!employees.length || !salaries.length) {
            return res.status(404).json({ message: 'No salary data found!' });
        }

        // 📌 Generate PDF
        const doc = new PDFDocument();
        const filePath = path.join('reports', `salary_report_${Date.now()}.pdf`);
        const writeStream = fs.createWriteStream(filePath);

        doc.pipe(writeStream);
        doc.fontSize(18).text('Employee Salary Report', { align: 'center' });
        doc.moveDown();

        employees.forEach(emp => {
            const salary = salaries.find(sal => sal.employeeId.toString() === emp._id.toString());
            if (salary) {
                doc.fontSize(12).text(`Employee: ${emp.name}`);
                doc.text(`Position: ${emp.position}`);
                doc.text(`Basic Salary: $${salary.basicSalary}`);
                doc.text(`Overtime: $${salary.overtime}`);
                doc.text(`Deductions: $${salary.deductions}`);
                doc.text(`Net Salary: $${salary.netSalary}`);
                doc.moveDown();
            }
        });

        doc.end();

        writeStream.on('finish', async () => {
            const newReport = new Report({
                reportType: 'Salary Report',
                fileUrl: filePath,
            });
            await newReport.save();
            res.status(200).json({ message: 'Salary report generated successfully!', fileUrl: filePath });
        });
    } catch (error) {
        res.status(500).json({ message: 'Error generating report', error });
    }
};
