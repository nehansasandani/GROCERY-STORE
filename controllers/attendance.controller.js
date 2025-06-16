import Attendance from '../models/attendance.model.js';
import Employee from '../models/employee.model.js';

//  Add Attendance Record
export const markAttendance = async (req, res) => {
    try {
        const { employeeId, date, status } = req.body;

        // Check if employee exists
        const employee = await Employee.findById(employeeId);
        if (!employee) return res.status(404).json({ error: 'Employee not found' });

        // Check if attendance for this date already exists
        const existingRecord = await Attendance.findOne({ employeeId, date });
        if (existingRecord) return res.status(400).json({ error: 'Attendance already marked for this date' });

        // Save attendance record
        const attendance = new Attendance({ employeeId, date, status });
        await attendance.save();

        res.status(201).json({ message: 'Attendance recorded successfully', attendance });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

//  Get Attendance Records of an Employee
export const getAttendanceByEmployee = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const attendanceRecords = await Attendance.find({ employeeId });

        if (!attendanceRecords.length) return res.status(404).json({ error: 'No attendance records found' });

        res.status(200).json(attendanceRecords);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

//  Update Attendance Record
export const updateAttendance = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const attendance = await Attendance.findById(id);
        if (!attendance) return res.status(404).json({ error: 'Attendance record not found' });

        attendance.status = status;
        await attendance.save();

        res.status(200).json({ message: 'Attendance updated successfully', attendance });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

//  Delete Attendance Record
export const deleteAttendance = async (req, res) => {
    try {
        const { id } = req.params;

        const attendance = await Attendance.findById(id);
        if (!attendance) return res.status(404).json({ error: 'Attendance record not found' });

        await Attendance.findByIdAndDelete(id);

        res.status(200).json({ message: 'Attendance record deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
