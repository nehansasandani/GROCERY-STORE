import Employee from '../models/employee.model.js';
import Attendance from '../models/attendance.model.js';
import Salary from '../models/salary.model.js';
import PDFDocument from 'pdfkit';
import fs from 'fs';

// Calculate Salary
export const calculateSalary = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) return res.status(404).json({ error: 'Employee not found' });

        const {
            month,
            year,
            daysWorked,
            overtimePay,
            deductions,
            attendanceDetails
        } = req.body;

        // Check if salary already calculated for this month
        const existingSalary = await Salary.findOne({
            employeeId: employee._id,
            month,
            year
        });

        if (existingSalary) {
            return res.status(400).json({ error: 'Salary already calculated for this month and year' });
        }

        // Get attendance records for calculating salary if no attendance details provided
        let actualDaysWorked = daysWorked;
        if (!actualDaysWorked && !attendanceDetails) {
            const attendanceRecords = await Attendance.find({
                employeeId: req.params.id,
                date: {
                    $gte: new Date(`${year}-${month}-01`),
                    $lt: new Date(month === 12 ? `${year + 1}-1-01` : `${year}-${Number(month) + 1}-01`)
                }
            });

            actualDaysWorked = attendanceRecords.filter(record => record.status === 'Present').length;
        }

        const totalDays = new Date(year, month, 0).getDate();
        const workingDays = totalDays - (totalDays / 7) * 2; // Approximate working days (excluding weekends)

        // Calculate salary components
        const basicSalary = employee.salary;
        const actualOvertimePay = overtimePay || 0;

        // Calculate attendance bonus - 5% if worked more than 15 days
        const bonus = actualDaysWorked > 15 ? basicSalary * 0.05 : 0;

        const etf = basicSalary * 0.03; // 3% of basic salary
        const epf = basicSalary * 0.08; // 8% of basic salary
        const actualDeductions = deductions || 0;

        // Calculate net salary including bonus
        const netSalary = basicSalary + actualOvertimePay + bonus - (etf + epf + actualDeductions);

        // Create new salary record
        const salary = new Salary({
            employeeId: employee._id,
            month,
            year,
            basicSalary,
            overtimePay: actualOvertimePay,
            bonus,
            daysWorked: actualDaysWorked,
            attendanceDetails: attendanceDetails || [],
            etf,
            epf,
            deductions: actualDeductions,
            netSalary,
            status: 'Pending',
            attendanceStatus: actualDaysWorked >= workingDays * 0.9 ? 'Approved' : 'Pending'
        });

        await salary.save();
        res.status(200).json({
            message: "Salary calculated successfully",
            salary
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get All Salaries
export const getAllSalaries = async (req, res) => {
    try {
        const salaries = await Salary.find().populate('employeeId');
        res.status(200).json(salaries);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get Salary by ID
export const getSalaryById = async (req, res) => {
    try {
        const salary = await Salary.findById(req.params.id).populate('employeeId');
        if (!salary) return res.status(404).json({ error: 'Salary record not found' });

        res.status(200).json(salary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get Salaries by Employee ID
export const getSalariesByEmployee = async (req, res) => {
    try {
        const salaries = await Salary.find({ employeeId: req.params.employeeId })
            .populate('employeeId')
            .sort({ year: -1, month: -1 });

        res.status(200).json(salaries);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update Salary
export const updateSalary = async (req, res) => {
    try {
        const {
            basicSalary,
            overtimePay,
            deductions,
            status,
            attendanceStatus,
            daysWorked,
            attendanceDetails
        } = req.body;

        const salary = await Salary.findById(req.params.id);
        if (!salary) return res.status(404).json({ error: 'Salary record not found' });

        // Update fields if provided
        if (basicSalary !== undefined) salary.basicSalary = basicSalary;
        if (overtimePay !== undefined) salary.overtimePay = overtimePay;
        if (deductions !== undefined) salary.deductions = deductions;
        if (status !== undefined) salary.status = status;
        if (attendanceStatus !== undefined) salary.attendanceStatus = attendanceStatus;
        if (daysWorked !== undefined) salary.daysWorked = daysWorked;
        if (attendanceDetails !== undefined) salary.attendanceDetails = attendanceDetails;

        // Calculate bonus based on days worked
        salary.bonus = salary.daysWorked > 15 ? salary.basicSalary * 0.05 : 0;

        // Recalculate ETF, EPF and net salary
        salary.etf = salary.basicSalary * 0.03;
        salary.epf = salary.basicSalary * 0.08;
        salary.netSalary = salary.basicSalary + salary.overtimePay + salary.bonus - (salary.etf + salary.epf + salary.deductions);

        await salary.save();
        res.status(200).json({ message: 'Salary updated successfully', salary });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Approve Salary
export const approveSalary = async (req, res) => {
    try {
        const salary = await Salary.findById(req.params.id);
        if (!salary) return res.status(404).json({ error: 'Salary record not found' });

        salary.status = 'Approved';
        await salary.save();
        res.status(200).json({ message: 'Salary approved successfully', salary });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Approve Attendance Status
export const approveAttendance = async (req, res) => {
    try {
        const salary = await Salary.findById(req.params.id);
        if (!salary) return res.status(404).json({ error: 'Salary record not found' });

        salary.attendanceStatus = 'Approved';
        await salary.save();
        res.status(200).json({ message: 'Attendance status approved successfully', salary });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Export Salary Report as PDF
export const generateSalaryReport = async (req, res) => {
    try {
        const { month, year } = req.query;
        let query = {};

        if (month && year) {
            query = { month: parseInt(month), year: parseInt(year) };
        }

        const salaries = await Salary.find(query).populate('employeeId'); const doc = new PDFDocument({
            margins: {
                top: 50,
                bottom: 50,
                left: 50,
                right: 50
            }
        });
        const fileName = `Salary_Report_${month || 'All'}_${year || 'Years'}.pdf`;
        const filePath = `./reports/${fileName}`;

        // Ensure reports directory exists
        if (!fs.existsSync('./reports')) {
            fs.mkdirSync('./reports', { recursive: true });
        }

        doc.pipe(fs.createWriteStream(filePath));

        // Add QUICK CART header with purple background
        doc.rect(50, 40, doc.page.width - 100, 40).fill('#7c3aed');
        doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold').text('QUICK CART', 50, 50, { align: 'center', width: doc.page.width - 100 });
        doc.moveDown(1.5);

        doc.fillColor('#000000').fontSize(16).font('Helvetica-Bold').text(`Salary Report ${month ? `- ${month}/${year}` : ''}`, { align: 'center' }).moveDown();

        // Draw table outer border - adjust height based on number of rows
        const tableTop = 120;
        const rowHeight = 25;
        doc.rect(50, tableTop, 490, salaries.length * rowHeight + rowHeight).stroke();

        // Draw table header background
        doc.rect(50, tableTop, 490, rowHeight).fillAndStroke('#f0f0f0', '#cccccc');

        // Add headers with better spacing
        doc.fontSize(10).fillColor('#000000');
        doc.font('Helvetica-Bold');
        doc.text('Employee', 55, tableTop + 8, { width: 90, align: 'left' });
        doc.text('Month/Year', 150, tableTop + 8, { width: 65, align: 'center' });
        doc.text('Basic', 220, tableTop + 8, { width: 45, align: 'center' });
        doc.text('OT', 270, tableTop + 8, { width: 35, align: 'center' });
        doc.text('EPF', 310, tableTop + 8, { width: 35, align: 'center' });
        doc.text('ETF', 350, tableTop + 8, { width: 35, align: 'center' }); doc.text('Deduct', 390, tableTop + 8, { width: 45, align: 'center' });
        doc.text('Net', 440, tableTop + 8, { width: 45, align: 'center' });
        doc.text('Status', 490, tableTop + 8, { width: 50, align: 'center' });

        // Reset font to normal
        doc.font('Helvetica');

        let y = tableTop + rowHeight;
        let rowColor = false;

        salaries.forEach((salary, index) => {
            if (y > 700) {
                doc.addPage();
                y = 50;                // Draw table borders and header background on new page
                doc.rect(50, 45, 490, rowHeight).fillAndStroke('#f0f0f0', '#cccccc');// Add headers on new page with better spacing
                doc.fontSize(10).fillColor('#000000');
                doc.font('Helvetica-Bold');
                doc.text('Employee', 55, 45 + 8, { width: 90, align: 'left' });
                doc.text('Month/Year', 150, 45 + 8, { width: 65, align: 'center' });
                doc.text('Basic', 220, 45 + 8, { width: 45, align: 'center' });
                doc.text('OT', 270, 45 + 8, { width: 35, align: 'center' });
                doc.text('EPF', 310, 45 + 8, { width: 35, align: 'center' });
                doc.text('ETF', 350, 45 + 8, { width: 35, align: 'center' });
                doc.text('Deduct', 390, 45 + 8, { width: 45, align: 'center' });
                doc.text('Net', 440, 45 + 8, { width: 45, align: 'center' });
                doc.text('Status', 490, 45 + 8, { width: 50, align: 'center' });

                // Reset font to normal
                doc.font('Helvetica');

                y = 45 + rowHeight;
                rowColor = false;
            }

            // Add alternating row background
            if (rowColor) {
                doc.rect(50, y, 490, rowHeight).fill('#f9f9ff');
            }
            rowColor = !rowColor;

            // Draw data with proper alignment and vertical centering            doc.fillColor('#000000');
            doc.text(salary.employeeId ? salary.employeeId.name.substring(0, 15) : 'Unknown', 55, y + 8, { width: 90, align: 'left' });
            doc.text(`${salary.month}/${salary.year}`, 150, y + 8, { width: 65, align: 'center' });
            doc.text(`$${salary.basicSalary.toFixed(2)}`, 220, y + 8, { width: 45, align: 'right' });
            doc.text(`$${salary.overtimePay.toFixed(2)}`, 270, y + 8, { width: 35, align: 'right' });
            doc.text(`$${salary.epf.toFixed(2)}`, 310, y + 8, { width: 35, align: 'right' });
            doc.text(`$${salary.etf.toFixed(2)}`, 350, y + 8, { width: 35, align: 'right' });
            doc.text(`$${salary.deductions.toFixed(2)}`, 390, y + 8, { width: 45, align: 'right' });
            doc.text(`$${salary.netSalary.toFixed(2)}`, 440, y + 8, { width: 45, align: 'right' });

            // Color-coded status
            const statusColor = salary.status === 'Approved' ? '#4ade80' : '#f87171';
            doc.fillColor(statusColor);
            doc.text(salary.status, 490, y + 8, { width: 50, align: 'center' });
            doc.fillColor('#000000');            // Increase row height for better readability
            y += rowHeight;
        });

        // Add a border at the bottom of the table
        doc.moveTo(50, y).lineTo(540, y).stroke();

        // Add summary information in a styled box
        doc.rect(50, y + 15, 200, 30).fill('#e0e7ff');
        doc.fillColor('#4c1d95').font('Helvetica-Bold');
        doc.text(`Total Employees: ${salaries.length}`, 60, y + 25);

        // Add report generation timestamp with styled footer
        doc.rect(50, doc.page.height - 70, doc.page.width - 100, 30).fill('#f9f9ff');
        doc.fontSize(10).fillColor('#4c1d95');
        doc.text(`Report generated on: ${new Date().toLocaleString()}`, 60, doc.page.height - 60);
        doc.text('© 2025 QUICK CART', doc.page.width - 200, doc.page.height - 60, { align: 'right' });

        doc.end();

        // Return a downloadable URL with the filepath
        const downloadUrl = `/downloads/reports/${fileName}`;
        res.status(200).json({
            message: 'Report generated successfully',
            filePath,
            downloadUrl
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Generate PDF for a single salary record
export const generateSingleSalaryPDF = async (req, res) => {
    try {
        const salaryId = req.params.id;
        const salary = await Salary.findById(salaryId).populate('employeeId');

        if (!salary) {
            return res.status(404).json({ error: 'Salary record not found' });
        }

        const doc = new PDFDocument();
        const fileName = `Salary_${salary.employeeId.name.replace(/\s+/g, '_')}_${salary.month}_${salary.year}.pdf`;
        const filePath = `./reports/${fileName}`;

        // Ensure reports directory exists
        if (!fs.existsSync('./reports')) {
            fs.mkdirSync('./reports');
        }

        doc.pipe(fs.createWriteStream(filePath));

        // Add QUICK CART header
        doc.fontSize(24).font('Helvetica-Bold').text('QUICK CART', { align: 'center' });
        doc.moveDown(0.5);

        // Document title
        doc.fontSize(20).font('Helvetica').text(`Salary Slip`, { align: 'center' });
        doc.moveDown();

        // Employee information section
        doc.fontSize(14).text('Employee Information', { underline: true });
        doc.fontSize(12).text(`Name: ${salary.employeeId.name}`);
        doc.text(`Position: ${salary.employeeId.position}`);
        doc.text(`Status: ${salary.employeeId.status}`);
        doc.moveDown();

        // Salary information section
        doc.fontSize(14).text('Salary Details', { underline: true });
        doc.fontSize(12).text(`Month/Year: ${salary.month}/${salary.year}`);
        doc.text(`Days Worked: ${salary.daysWorked}`);
        doc.moveDown();

        // Salary breakdown table
        doc.fontSize(14).text('Salary Breakdown', { underline: true });
        doc.moveDown(0.5);

        // Create table header
        const startX = 50;
        let currentY = doc.y;

        doc.fontSize(12);
        doc.text('Description', startX, currentY);
        doc.text('Amount ($)', 400, currentY);
        currentY += 20;

        // Add horizontal line
        doc.moveTo(startX, currentY).lineTo(550, currentY).stroke();
        currentY += 15;

        // Add earnings
        doc.text('Basic Salary', startX, currentY);
        doc.text(`${salary.basicSalary.toFixed(2)}`, 400, currentY);
        currentY += 20;

        doc.text('Overtime Pay', startX, currentY);
        doc.text(`${salary.overtimePay.toFixed(2)}`, 400, currentY);
        currentY += 20;

        if (salary.bonus > 0) {
            doc.text('Attendance Bonus', startX, currentY);
            doc.text(`${salary.bonus.toFixed(2)}`, 400, currentY);
            currentY += 20;
        }

        // Add horizontal line
        doc.moveTo(startX, currentY).lineTo(550, currentY).stroke();
        currentY += 15;

        // Add deductions
        doc.text('EPF (8%)', startX, currentY);
        doc.text(`-${salary.epf.toFixed(2)}`, 400, currentY);
        currentY += 20;

        doc.text('ETF (3%)', startX, currentY);
        doc.text(`-${salary.etf.toFixed(2)}`, 400, currentY);
        currentY += 20;

        doc.text('Other Deductions', startX, currentY);
        doc.text(`-${salary.deductions.toFixed(2)}`, 400, currentY);
        currentY += 20;

        // Add horizontal line
        doc.moveTo(startX, currentY).lineTo(550, currentY).stroke();
        currentY += 15;

        // Add net salary
        doc.fontSize(14).fillColor('green');
        doc.text('Net Salary', startX, currentY);
        doc.text(`${salary.netSalary.toFixed(2)}`, 400, currentY);
        currentY += 30;

        // Reset color
        doc.fillColor('black');

        // Add signature lines
        doc.fontSize(12).text('_______________________', 100, currentY + 40);
        doc.text('Employee Signature', 100, currentY + 60);

        doc.text('_______________________', 400, currentY + 40);
        doc.text('Employer Signature', 400, currentY + 60);

        // Add current date
        const date = new Date();
        doc.text(`Generated on: ${date.toLocaleDateString()}`, startX, 700);

        // Finalize the PDF
        doc.end();

        // Return a downloadable URL with the filepath
        const downloadUrl = `/downloads/reports/${fileName}`;
        res.status(200).json({
            message: 'Salary PDF generated successfully',
            filePath,
            downloadUrl,
            employeeName: salary.employeeId.name
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
