// server.js - Backend Hospital Management System (Simple Version)
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// ==================== CONFIGURATION ====================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://your-username:your-password@cluster.mongodb.net/hospital?retryWrites=true&w=majority';

// ==================== MONGODB CONNECTION ====================
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.log('❌ MongoDB Connection Error:', err));

// ==================== SCHEMAS & MODELS ====================

// User Schema (simple, no password hashing)
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Plain text password
  role: { type: String, required: true, enum: ['admin', 'doctor', 'lab', 'pharmacy', 'reception', 'cashier'] },
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// Patient Schema
const patientSchema = new mongoose.Schema({
  patientId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  dob: { type: Date, required: true },
  birthplace: { type: String, required: true },
  phone: { type: String },
  address: { type: String },
  responsible: { type: String },
  pediatric: { type: Boolean, default: false },
  emergency: { type: Boolean, default: false },
  bloodType: { type: String },
  allergies: [String],
  registrationDate: { type: Date, default: Date.now },
  registeredBy: { type: String, required: true },
  notes: { type: String }
});

patientSchema.pre('save', function(next) {
  if (!this.patientId) {
    const prefix = this.emergency ? 'URG' : (this.pediatric ? 'PED' : 'PA');
    const timestamp = Date.now().toString().slice(-6);
    this.patientId = `${prefix}${timestamp}`;
  }
  next();
});
const Patient = mongoose.model('Patient', patientSchema);

// Consultation Schema
const consultationSchema = new mongoose.Schema({
  consultationId: { type: String, required: true, unique: true },
  patientId: { type: String, required: true },
  doctor: { type: String, required: true },
  diagnosis: { type: String, required: true },
  medications: [{
    name: String,
    dosage: String,
    frequency: String,
    duration: String
  }],
  analyses: { type: String },
  notes: { type: String },
  emergency: { type: Boolean, default: false },
  date: { type: Date, default: Date.now },
  status: { type: String, default: 'completed' }
});

consultationSchema.pre('save', function(next) {
  if (!this.consultationId) {
    const timestamp = Date.now().toString().slice(-8);
    this.consultationId = `CON${timestamp}`;
  }
  next();
});
const Consultation = mongoose.model('Consultation', consultationSchema);

// Analysis Schema
const analysisSchema = new mongoose.Schema({
  patientId: { type: String, required: true },
  consultationId: { type: String },
  analyses: { type: String, required: true },
  results: { type: String },
  technician: { type: String },
  date: { type: Date, default: Date.now },
  status: { type: String, default: 'pending' },
  emergency: { type: Boolean, default: false },
  completedAt: { type: Date }
});
const Analysis = mongoose.model('Analysis', analysisSchema);

// Prescription Schema
const prescriptionSchema = new mongoose.Schema({
  patientId: { type: String, required: true },
  consultationId: { type: String, required: true },
  prescription: { type: String, required: true },
  doctor: { type: String, required: true },
  delivered: { type: Boolean, default: false },
  deliveredBy: { type: String },
  deliveredAt: { type: Date },
  date: { type: Date, default: Date.now },
  status: { type: String, default: 'pending' },
  emergency: { type: Boolean, default: false }
});
const Prescription = mongoose.model('Prescription', prescriptionSchema);

// Transaction Schema
const transactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true },
  patientId: { type: String, required: true },
  service: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  doctor: { type: String, required: true },
  status: { type: String, default: 'pending' },
  paymentMethod: { type: String },
  paymentDetails: { type: Object },
  emergency: { type: Boolean, default: false },
  date: { type: Date, default: Date.now },
  paidAt: { type: Date },
  cashier: { type: String }
});

transactionSchema.pre('save', function(next) {
  if (!this.transactionId) {
    const timestamp = Date.now().toString().slice(-8);
    this.transactionId = `TXN${timestamp}`;
  }
  next();
});
const Transaction = mongoose.model('Transaction', transactionSchema);

// Stock Schema
const stockSchema = new mongoose.Schema({
  medicationId: { type: String, required: true, unique: true },
  medication: { type: String, required: true, unique: true },
  quantity: { type: Number, required: true, min: 0 },
  threshold: { type: Number, required: true, min: 0 },
  price: { type: Number, required: true, min: 0 },
  category: { type: String },
  supplier: { type: String },
  lastRestocked: { type: Date, default: Date.now }
});

stockSchema.pre('save', function(next) {
  if (!this.medicationId) {
    const timestamp = Date.now().toString().slice(-6);
    this.medicationId = `MED${timestamp}`;
  }
  next();
});
const Stock = mongoose.model('Stock', stockSchema);

// Appointment Schema
const appointmentSchema = new mongoose.Schema({
  patientId: { type: String, required: true },
  patientName: { type: String, required: true },
  doctor: { type: String, required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  reason: { type: String },
  status: { type: String, default: 'scheduled' },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  notes: { type: String }
});
const Appointment = mongoose.model('Appointment', appointmentSchema);

// Employee Schema
const employeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, required: true },
  pin: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  access: { type: String, default: 'limited' },
  isActive: { type: Boolean, default: true },
  hireDate: { type: Date, default: Date.now },
  department: { type: String },
  salary: { type: Number },
  address: { type: String }
});

employeeSchema.pre('save', function(next) {
  if (!this.employeeId) {
    const timestamp = Date.now().toString().slice(-6);
    this.employeeId = `EMP${timestamp}`;
  }
  next();
});
const Employee = mongoose.model('Employee', employeeSchema);

// Attendance Schema
const attendanceSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  checkIn: { type: Date, required: true, default: Date.now },
  checkOut: { type: Date },
  hoursWorked: { type: Number },
  status: { type: String, default: 'present' },
  notes: { type: String }
});
const Attendance = mongoose.model('Attendance', attendanceSchema);

// Emergency Schema
const emergencySchema = new mongoose.Schema({
  patientId: { type: String, required: true },
  doctor: { type: String, required: true },
  admissionTime: { type: Date, default: Date.now },
  dischargeTime: { type: Date },
  status: { type: String, default: 'En traitement' },
  triageLevel: { type: String },
  active: { type: Boolean, default: true },
  notes: { type: String },
  createdBy: { type: String, required: true }
});
const Emergency = mongoose.model('Emergency', emergencySchema);

// ==================== INITIAL DATA ====================
const initializeData = async () => {
  try {
    // Check if users already exist
    const userCount = await User.countDocuments();
    
    if (userCount === 0) {
      // Create default users
      const defaultUsers = [
        { username: 'admin', password: 'admin123', role: 'admin', fullName: 'Administrateur Principal', email: 'admin@hospital.com', phone: '1234567890' },
        { username: 'doctor1', password: 'doctor123', role: 'doctor', fullName: 'Dr. Jean Pierre', email: 'doctor1@hospital.com', phone: '1234567891' },
        { username: 'doctor2', password: 'doctor123', role: 'doctor', fullName: 'Dr. Marie Claire', email: 'doctor2@hospital.com', phone: '1234567892' },
        { username: 'labtech', password: 'lab123', role: 'lab', fullName: 'Technicien Laboratoire', email: 'lab@hospital.com', phone: '1234567893' },
        { username: 'pharmacist', password: 'pharmacy123', role: 'pharmacy', fullName: 'Pharmacien Principal', email: 'pharmacy@hospital.com', phone: '1234567894' },
        { username: 'reception', password: 'reception123', role: 'reception', fullName: 'Réceptionniste', email: 'reception@hospital.com', phone: '1234567895' },
        { username: 'cashier', password: 'cashier123', role: 'cashier', fullName: 'Caissier', email: 'cashier@hospital.com', phone: '1234567896' }
      ];

      await User.insertMany(defaultUsers);
      console.log('✅ Default users created');
    }

    // Check if stock already exists
    const stockCount = await Stock.countDocuments();
    
    if (stockCount === 0) {
      // Create default stock items
      const defaultStock = [
        { medication: 'Paracétamol 500mg', quantity: 100, threshold: 20, price: 50, category: 'Antidouleur' },
        { medication: 'Ibuprofène 400mg', quantity: 80, threshold: 20, price: 60, category: 'Anti-inflammatoire' },
        { medication: 'Amoxicilline 500mg', quantity: 50, threshold: 10, price: 120, category: 'Antibiotique' },
        { medication: 'Vitamine C 1000mg', quantity: 200, threshold: 30, price: 30, category: 'Vitamine' },
        { medication: 'Bandage stérile', quantity: 150, threshold: 25, price: 20, category: 'Matériel médical' },
        { medication: 'Seringue 5ml', quantity: 300, threshold: 50, price: 15, category: 'Matériel médical' },
        { medication: 'Pansement adhésif', quantity: 200, threshold: 40, price: 10, category: 'Matériel médical' }
      ];

      await Stock.insertMany(defaultStock);
      console.log('✅ Default stock items created');
    }

    console.log('✅ Database initialization completed');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
};

// ==================== ROUTES ====================

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Hospital Management System API', status: 'OK' });
});

// 1. AUTHENTICATION ROUTES
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    // Find user
    const user = await User.findOne({ username, role });
    
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Check password (plain text comparison)
    if (user.password !== password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Return user info (without password)
    const userResponse = {
      id: user._id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone
    };

    res.json({
      success: true,
      user: userResponse
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 2. PATIENT ROUTES
app.get('/api/patients', async (req, res) => {
  try {
    const patients = await Patient.find().sort({ registrationDate: -1 });
    res.json(patients);
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/patients/:id', async (req, res) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.id });
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    res.json(patient);
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/patients', async (req, res) => {
  try {
    const {
      name,
      dob,
      birthplace,
      phone,
      address,
      responsible,
      pediatric,
      emergency,
      bloodType,
      allergies,
      notes
    } = req.body;

    const newPatient = new Patient({
      name,
      dob: new Date(dob),
      birthplace,
      phone,
      address,
      responsible,
      pediatric: pediatric || false,
      emergency: emergency || false,
      bloodType,
      allergies: allergies || [],
      notes,
      registeredBy: req.body.username || 'system'
    });

    await newPatient.save();

    res.json({
      success: true,
      patientId: newPatient.patientId,
      patient: newPatient,
      message: 'Patient registered successfully'
    });
  } catch (error) {
    console.error('Create patient error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 3. CONSULTATION ROUTES
app.get('/api/consultations', async (req, res) => {
  try {
    const consultations = await Consultation.find().sort({ date: -1 });
    res.json(consultations);
  } catch (error) {
    console.error('Get consultations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/consultations', async (req, res) => {
  try {
    const {
      patientId,
      diagnosis,
      medications,
      analyses,
      notes,
      emergency
    } = req.body;

    const newConsultation = new Consultation({
      patientId,
      doctor: req.body.username || 'doctor',
      diagnosis,
      medications: medications || [],
      analyses,
      notes,
      emergency: emergency || false
    });

    await newConsultation.save();

    res.json({
      success: true,
      consultationId: newConsultation.consultationId,
      consultation: newConsultation
    });
  } catch (error) {
    console.error('Create consultation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 4. ANALYSIS ROUTES
app.get('/api/analyses', async (req, res) => {
  try {
    const analyses = await Analysis.find().sort({ date: -1 });
    res.json(analyses);
  } catch (error) {
    console.error('Get analyses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/analyses', async (req, res) => {
  try {
    const {
      patientId,
      consultationId,
      analyses,
      emergency
    } = req.body;

    const newAnalysis = new Analysis({
      patientId,
      consultationId,
      analyses,
      emergency: emergency || false,
      status: emergency ? 'pending' : 'pending-payment'
    });

    await newAnalysis.save();

    res.json({
      success: true,
      analysis: newAnalysis
    });
  } catch (error) {
    console.error('Create analysis error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/analyses/:id', async (req, res) => {
  try {
    const { results } = req.body;

    const analysis = await Analysis.findById(req.params.id);
    
    if (!analysis) {
      return res.status(404).json({ message: 'Analysis not found' });
    }

    analysis.results = results;
    analysis.status = 'completed';
    analysis.completedAt = new Date();
    analysis.technician = req.body.username || 'technician';

    await analysis.save();

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error('Update analysis error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 5. PRESCRIPTION ROUTES
app.get('/api/prescriptions', async (req, res) => {
  try {
    const prescriptions = await Prescription.find().sort({ date: -1 });
    res.json(prescriptions);
  } catch (error) {
    console.error('Get prescriptions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/prescriptions', async (req, res) => {
  try {
    const {
      patientId,
      consultationId,
      prescription,
      emergency
    } = req.body;

    const newPrescription = new Prescription({
      patientId,
      consultationId,
      prescription,
      doctor: req.body.username || 'doctor',
      emergency: emergency || false,
      status: emergency ? 'pending' : 'pending-payment'
    });

    await newPrescription.save();

    res.json({
      success: true,
      prescription: newPrescription
    });
  } catch (error) {
    console.error('Create prescription error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/prescriptions/:id', async (req, res) => {
  try {
    const { delivered } = req.body;

    const prescription = await Prescription.findById(req.params.id);
    
    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    prescription.delivered = delivered;
    if (delivered) {
      prescription.deliveredBy = req.body.username || 'pharmacist';
      prescription.deliveredAt = new Date();
      prescription.status = 'delivered';
    }

    await prescription.save();

    res.json({
      success: true,
      prescription
    });
  } catch (error) {
    console.error('Update prescription error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 6. TRANSACTION ROUTES
app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ date: -1 });
    res.json(transactions);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const {
      patientId,
      service,
      amount,
      emergency
    } = req.body;

    const newTransaction = new Transaction({
      patientId,
      service,
      amount,
      doctor: req.body.username || 'system',
      emergency: emergency || false,
      status: emergency ? 'pending' : 'pending'
    });

    await newTransaction.save();

    res.json({
      success: true,
      transactionId: newTransaction.transactionId,
      transaction: newTransaction
    });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const { status, paymentMethod, paymentDetails } = req.body;

    const transaction = await Transaction.findOne({ transactionId: req.params.id });
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    transaction.status = status;
    if (paymentMethod) transaction.paymentMethod = paymentMethod;
    if (paymentDetails) transaction.paymentDetails = paymentDetails;
    
    if (status === 'paid') {
      transaction.paidAt = new Date();
      transaction.cashier = req.body.username || 'cashier';
    }

    await transaction.save();

    res.json({
      success: true,
      transaction
    });
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 7. STOCK ROUTES
app.get('/api/stock', async (req, res) => {
  try {
    const stock = await Stock.find().sort({ medication: 1 });
    res.json(stock);
  } catch (error) {
    console.error('Get stock error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/stock', async (req, res) => {
  try {
    const {
      medication,
      quantity,
      threshold,
      price,
      category,
      supplier
    } = req.body;

    const existingMed = await Stock.findOne({ medication });
    if (existingMed) {
      return res.status(400).json({ message: 'Medication already exists' });
    }

    const newStock = new Stock({
      medication,
      quantity: quantity || 0,
      threshold: threshold || 10,
      price: price || 0,
      category,
      supplier
    });

    await newStock.save();

    res.json({
      success: true,
      medicationId: newStock.medicationId,
      stock: newStock
    });
  } catch (error) {
    console.error('Create stock error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/stock/:id', async (req, res) => {
  try {
    const { quantity } = req.body;

    const stockItem = await Stock.findById(req.params.id);
    
    if (!stockItem) {
      return res.status(404).json({ message: 'Stock item not found' });
    }

    stockItem.quantity = quantity;
    stockItem.lastRestocked = new Date();

    await stockItem.save();

    res.json({
      success: true,
      stock: stockItem
    });
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 8. APPOINTMENT ROUTES
app.get('/api/appointments', async (req, res) => {
  try {
    const appointments = await Appointment.find().sort({ date: 1, time: 1 });
    res.json(appointments);
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/appointments', async (req, res) => {
  try {
    const {
      patientId,
      patientName,
      doctor,
      date,
      time,
      reason
    } = req.body;

    const newAppointment = new Appointment({
      patientId,
      patientName,
      doctor,
      date: new Date(date),
      time,
      reason,
      createdBy: req.body.username || 'system'
    });

    await newAppointment.save();

    res.json({
      success: true,
      appointment: newAppointment
    });
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/appointments/:id', async (req, res) => {
  try {
    const { status } = req.body;

    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    appointment.status = status;
    if (status === 'completed') {
      appointment.completedAt = new Date();
    }

    await appointment.save();

    res.json({
      success: true,
      appointment
    });
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 9. EMPLOYEE ROUTES
app.get('/api/employees', async (req, res) => {
  try {
    const employees = await Employee.find().sort({ hireDate: -1 });
    res.json(employees);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/employees', async (req, res) => {
  try {
    const {
      name,
      role,
      pin,
      email,
      phone,
      access,
      department,
      salary,
      address
    } = req.body;

    const existingEmployee = await Employee.findOne({ email });
    if (existingEmployee) {
      return res.status(400).json({ message: 'Employee already exists' });
    }

    const newEmployee = new Employee({
      name,
      role,
      pin,
      email,
      phone,
      access: access || 'limited',
      department,
      salary,
      address
    });

    await newEmployee.save();

    res.json({
      success: true,
      employeeId: newEmployee.employeeId,
      employee: newEmployee
    });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/employees/:id', async (req, res) => {
  try {
    const {
      name,
      role,
      pin,
      email,
      phone,
      access,
      department,
      salary,
      address,
      isActive
    } = req.body;

    const employee = await Employee.findById(req.params.id);
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    if (name) employee.name = name;
    if (role) employee.role = role;
    if (pin) employee.pin = pin;
    if (email) employee.email = email;
    if (phone) employee.phone = phone;
    if (access) employee.access = access;
    if (department) employee.department = department;
    if (salary !== undefined) employee.salary = salary;
    if (address) employee.address = address;
    if (isActive !== undefined) employee.isActive = isActive;

    await employee.save();

    res.json({
      success: true,
      employee
    });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/employees/:id', async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    employee.isActive = false;
    await employee.save();

    res.json({
      success: true,
      message: 'Employee deactivated successfully'
    });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 10. ATTENDANCE ROUTES
app.get('/api/attendance', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const attendance = await Attendance.find({
      checkIn: { $gte: today, $lt: tomorrow }
    }).sort({ checkIn: -1 });

    res.json(attendance);
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/attendance', async (req, res) => {
  try {
    const { employeeId } = req.body;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingRecord = await Attendance.findOne({
      employeeId,
      checkIn: { $gte: today, $lt: tomorrow },
      checkOut: { $exists: false }
    });

    if (existingRecord) {
      return res.status(400).json({ 
        message: 'Employee already checked in today' 
      });
    }

    const newAttendance = new Attendance({
      employeeId,
      checkIn: new Date()
    });

    await newAttendance.save();

    res.json({
      success: true,
      attendance: newAttendance
    });
  } catch (error) {
    console.error('Create attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/attendance/:id', async (req, res) => {
  try {
    const { checkOut } = req.body;

    const attendance = await Attendance.findById(req.params.id);
    
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    if (attendance.checkOut) {
      return res.status(400).json({ 
        message: 'Employee already checked out' 
      });
    }

    attendance.checkOut = checkOut || new Date();

    await attendance.save();

    res.json({
      success: true,
      attendance
    });
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 11. EMERGENCY ROUTES
app.get('/api/emergency', async (req, res) => {
  try {
    const emergencies = await Emergency.find().sort({ admissionTime: -1 });
    res.json(emergencies);
  } catch (error) {
    console.error('Get emergencies error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/emergency', async (req, res) => {
  try {
    const {
      patientId,
      doctor,
      status,
      triageLevel,
      notes
    } = req.body;

    const existingEmergency = await Emergency.findOne({ 
      patientId, 
      active: true 
    });

    if (existingEmergency) {
      return res.status(400).json({ 
        message: 'Patient already has active emergency record' 
      });
    }

    const newEmergency = new Emergency({
      patientId,
      doctor: doctor || req.body.username,
      status: status || 'En traitement',
      triageLevel,
      notes,
      active: true,
      createdBy: req.body.username || 'system'
    });

    await newEmergency.save();

    res.json({
      success: true,
      emergency: newEmergency
    });
  } catch (error) {
    console.error('Create emergency error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/emergency/:id', async (req, res) => {
  try {
    const {
      status,
      active,
      dischargeTime,
      notes,
      triageLevel
    } = req.body;

    const emergency = await Emergency.findById(req.params.id);
    
    if (!emergency) {
      return res.status(404).json({ message: 'Emergency record not found' });
    }

    if (status) emergency.status = status;
    if (active !== undefined) emergency.active = active;
    if (dischargeTime) emergency.dischargeTime = new Date(dischargeTime);
    if (notes) emergency.notes = notes;
    if (triageLevel) emergency.triageLevel = triageLevel;

    await emergency.save();

    res.json({
      success: true,
      emergency
    });
  } catch (error) {
    console.error('Update emergency error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 12. STATISTICS ROUTES
app.get('/api/stats/dashboard', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const totalPatients = await Patient.countDocuments();
    const todayConsultations = await Consultation.countDocuments({
      date: { $gte: today, $lt: tomorrow }
    });
    const todayAppointments = await Appointment.countDocuments({
      date: { $gte: today, $lt: tomorrow },
      status: 'scheduled'
    });
    const pendingAnalyses = await Analysis.countDocuments({
      status: { $in: ['pending', 'pending-payment'] }
    });

    const todayTransactions = await Transaction.find({
      date: { $gte: today, $lt: tomorrow },
      status: 'paid'
    });
    const todayRevenue = todayTransactions.reduce((sum, t) => sum + t.amount, 0);

    res.json({
      totalPatients,
      todayConsultations,
      todayAppointments,
      pendingAnalyses,
      todayRevenue
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/stats/admin', async (req, res) => {
  try {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);

    const paidTransactions = await Transaction.find({ status: 'paid' });
    const totalRevenue = paidTransactions.reduce((sum, t) => sum + t.amount, 0);

    const thisMonthTransactions = await Transaction.find({
      date: { $gte: firstDay },
      status: 'paid'
    });
    const monthlyRevenue = thisMonthTransactions.reduce((sum, t) => sum + t.amount, 0);

    const totalPatients = await Patient.countDocuments();
    const totalAppointments = await Appointment.countDocuments();
    const totalAnalyses = await Analysis.countDocuments();
    const totalConsultations = await Consultation.countDocuments();

    const recentPatients = await Patient.find()
      .sort({ registrationDate: -1 })
      .limit(5);

    const recentTransactions = await Transaction.find()
      .sort({ date: -1 })
      .limit(10);

    res.json({
      totalRevenue,
      monthlyRevenue,
      totalPatients,
      totalAppointments,
      totalAnalyses,
      totalConsultations,
      recentPatients,
      recentTransactions
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== START SERVER ====================
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  
  // Initialize database with default data
  setTimeout(initializeData, 2000);
});