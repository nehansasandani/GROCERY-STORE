import Employee from '../models/employee.model.js';

// Add New Employee
export const addEmployee = async (req, res) => {
    try {
        const { name, position, salary, status } = req.body;

        const newEmployee = new Employee({ name, position, salary, status });
        await newEmployee.save();

        res.status(201).json({ message: 'Employee added successfully', employee: newEmployee });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get All Employees
export const getAllEmployees = async (req, res) => {
    try {
        const employees = await Employee.find();
        res.status(200).json(employees);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get Employee by ID
export const getEmployeeById = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) return res.status(404).json({ error: 'Employee not found' });

        res.status(200).json(employee);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update Employee
export const updateEmployee = async (req, res) => {
    try {
        const { name, position, salary, status } = req.body;

        const employee = await Employee.findById(req.params.id);
        if (!employee) return res.status(404).json({ error: 'Employee not found' });
        
        employee.name = name || employee.name;
        employee.position = position || employee.position;
        employee.salary = salary || employee.salary;
        employee.status = status || employee.status;

        await employee.save();

        res.status(200).json({ message: 'Employee updated successfully', employee });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete Employee
export const deleteEmployee = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) return res.status(404).json({ error: 'Employee not found' });

        await Employee.findByIdAndDelete(req.params.id);

        res.status(200).json({ message: 'Employee deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
