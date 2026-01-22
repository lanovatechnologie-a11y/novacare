// server.js - Backend Hospital Management System
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'https://novacare-8ep5.onrender.com', 'https://novacare-qahi.onrender.com'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== ROUTE RACINE ====================
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 Hospital Management System API is running!',
    version: '1.0.0',
    status: 'OK',
    endpoints: {
      login: '/api/auth/login',
      patients: '/api/patients',
      consultations: '/api/consultations',
      analyses: '/api/analyses',
      transactions: '/api/transactions',
      stock: '/api/stock',
      appointments: '/api/appointments',
      employees: '/api/employees',
      emergency: '/api/emergency',
      stats: '/api/stats/dashboard'
    }
  });
});

// ==================== IN-MEMORY DATABASE ====================
const memoryDB = {
  users: [],
  patients: [],
  consultations: [],
  analyses: [],
  prescriptions: [],
  transactions: [],
  stock: [],
  appointments: [],
  employees: [],
  attendance: [],
  emergencies: []
};

let idCounter = {
  patient: 1,
  consultation: 1,
  transaction: 1,
  medication: 1,
  appointment: 1,
  employee: 1,
  emergency: 1
};

// ==================== ROUTES ====================

// 1. AUTHENTICATION ENDPOINTS
app.post('/api/auth/login', (req, res) => {
  const { username, password, role } = req.body;
  
  // Default users for testing
  const defaultUsers = [
    { id: 1, username: 'admin', password: 'admin123', role: 'admin', fullName: 'Administrateur Principal', email: 'admin@hospital.com', phone: '1234567890' },
    { id: 2, username: 'doctor1', password: 'doctor123', role: 'doctor', fullName: 'Dr. Jean Pierre', email: 'doctor1@hospital.com', phone: '1234567891' },
    { id: 3, username: 'doctor2', password: 'doctor123', role: 'doctor', fullName: 'Dr. Marie Claire', email: 'doctor2@hospital.com', phone: '1234567892' },
    { id: 4, username: 'labtech', password: 'lab123', role: 'lab', fullName: 'Technicien Laboratoire', email: 'lab@hospital.com', phone: '1234567893' },
    { id: 5, username: 'pharmacist', password: 'pharmacy123', role: 'pharmacy', fullName: 'Pharmacien Principal', email: 'pharmacy@hospital.com', phone: '1234567894' },
    { id: 6, username: 'reception', password: 'reception123', role: 'reception', fullName: 'Réceptionniste', email: 'reception@hospital.com', phone: '1234567895' },
    { id: 7, username: 'cashier', password: 'cashier123', role: 'cashier', fullName: 'Caissier', email: 'cashier@hospital.com', phone: '1234567896' }
  ];

  // Initialize users if empty
  if (memoryDB.users.length === 0) {
    memoryDB.users = defaultUsers;
  }

  const user = memoryDB.users.find(u => 
    u.username === username && 
    u.password === password && 
    u.role === role
  );

  if (user) {
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone
      }
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

// 2. PATIENT ENDPOINTS
app.get('/api/patients', (req, res) => {
  res.json(memoryDB.patients);
});

app.get('/api/patients/:id', (req, res) => {
  const patient = memoryDB.patients.find(p => p.patientId === req.params.id);
  if (patient) {
    res.json(patient);
  } else {
    res.status(404).json({ message: 'Patient not found' });
  }
});

app.post('/api/patients', (req, res) => {
  const { name, dob, birthplace, phone, address, responsible, pediatric, emergency } = req.body;
  
  const patientId = emergency ? 'URG' : (pediatric ? 'PED' : 'PA') + Date.now().toString().slice(-6);
  
  const newPatient = {
    id: idCounter.patient++,
    patientId,
    name,
    dob: new Date(dob).toISOString(),
    birthplace,
    phone,
    address,
    responsible,
    pediatric: pediatric || false,
    emergency: emergency || false,
    registrationDate: new Date().toISOString(),
    registeredBy: req.body.username || 'system'
  };
  
  memoryDB.patients.push(newPatient);
  
  res.json({
    success: true,
    patientId: newPatient.patientId,
    patient: newPatient
  });
});

// 3. CONSULTATION ENDPOINTS
app.get('/api/consultations', (req, res) => {
  res.json(memoryDB.consultations);
});

app.post('/api/consultations', (req, res) => {
  const { patientId, diagnosis, medications, analyses, notes, emergency } = req.body;
  
  const consultationId = 'CON' + Date.now().toString().slice(-8);
  
  const newConsultation = {
    id: idCounter.consultation++,
    consultationId,
    patientId,
    doctor: req.body.username || 'doctor',
    diagnosis,
    medications: medications || [],
    analyses,
    notes,
    emergency: emergency || false,
    date: new Date().toISOString(),
    status: 'completed'
  };
  
  memoryDB.consultations.push(newConsultation);
  
  // Create transaction for consultation
  const consultationFee = emergency ? 800 : 500;
  const transactionId = 'TXN' + Date.now().toString().slice(-8);
  
  const newTransaction = {
    id: idCounter.transaction++,
    transactionId,
    patientId,
    service: emergency ? 'Consultation Urgence' : 'Consultation',
    amount: consultationFee,
    doctor: req.body.username || 'doctor',
    emergency: emergency || false,
    status: emergency ? 'pending' : 'pending',
    date: new Date().toISOString()
  };
  
  memoryDB.transactions.push(newTransaction);
  
  res.json({
    success: true,
    consultationId: newConsultation.consultationId,
    consultation: newConsultation
  });
});

// 4. ANALYSIS ENDPOINTS
app.get('/api/analyses', (req, res) => {
  res.json(memoryDB.analyses);
});

app.post('/api/analyses', (req, res) => {
  const { patientId, consultationId, analyses, emergency } = req.body;
  
  const newAnalysis = {
    id: memoryDB.analyses.length + 1,
    patientId,
    consultationId,
    analyses,
    emergency: emergency || false,
    status: emergency ? 'pending' : 'pending-payment',
    date: new Date().toISOString()
  };
  
  memoryDB.analyses.push(newAnalysis);
  
  res.json({
    success: true,
    analysis: newAnalysis
  });
});

app.put('/api/analyses/:id', (req, res) => {
  const { results } = req.body;
  const analysis = memoryDB.analyses.find(a => a.id == req.params.id);
  
  if (analysis) {
    analysis.results = results;
    analysis.status = 'completed';
    analysis.completedAt = new Date().toISOString();
    analysis.technician = req.body.username || 'technician';
    
    res.json({
      success: true,
      analysis
    });
  } else {
    res.status(404).json({ message: 'Analysis not found' });
  }
});

// 5. PRESCRIPTION ENDPOINTS
app.get('/api/prescriptions', (req, res) => {
  res.json(memoryDB.prescriptions);
});

app.post('/api/prescriptions', (req, res) => {
  const { patientId, consultationId, prescription, emergency } = req.body;
  
  const newPrescription = {
    id: memoryDB.prescriptions.length + 1,
    patientId,
    consultationId,
    prescription,
    doctor: req.body.username || 'doctor',
    emergency: emergency || false,
    status: emergency ? 'pending' : 'pending-payment',
    date: new Date().toISOString(),
    delivered: false
  };
  
  memoryDB.prescriptions.push(newPrescription);
  
  res.json({
    success: true,
    prescription: newPrescription
  });
});

app.put('/api/prescriptions/:id', (req, res) => {
  const { delivered } = req.body;
  const prescription = memoryDB.prescriptions.find(p => p.id == req.params.id);
  
  if (prescription) {
    prescription.delivered = delivered;
    if (delivered) {
      prescription.deliveredBy = req.body.username || 'pharmacist';
      prescription.deliveredAt = new Date().toISOString();
      prescription.status = 'delivered';
    }
    
    res.json({
      success: true,
      prescription
    });
  } else {
    res.status(404).json({ message: 'Prescription not found' });
  }
});

// 6. TRANSACTION ENDPOINTS
app.get('/api/transactions', (req, res) => {
  res.json(memoryDB.transactions);
});

app.post('/api/transactions', (req, res) => {
  const { patientId, service, amount, emergency } = req.body;
  
  const transactionId = 'TXN' + Date.now().toString().slice(-8);
  
  const newTransaction = {
    id: idCounter.transaction++,
    transactionId,
    patientId,
    service,
    amount,
    doctor: req.body.username || 'system',
    emergency: emergency || false,
    status: 'pending',
    date: new Date().toISOString()
  };
  
  memoryDB.transactions.push(newTransaction);
  
  res.json({
    success: true,
    transactionId: newTransaction.transactionId,
    transaction: newTransaction
  });
});

app.put('/api/transactions/:id', (req, res) => {
  const { status, paymentMethod, paymentDetails } = req.body;
  const transaction = memoryDB.transactions.find(t => t.transactionId === req.params.id);
  
  if (transaction) {
    transaction.status = status;
    if (paymentMethod) transaction.paymentMethod = paymentMethod;
    if (paymentDetails) transaction.paymentDetails = paymentDetails;
    
    if (status === 'paid') {
      transaction.paidAt = new Date().toISOString();
      transaction.cashier = req.body.username || 'cashier';
    }
    
    res.json({
      success: true,
      transaction
    });
  } else {
    res.status(404).json({ message: 'Transaction not found' });
  }
});

// 7. STOCK ENDPOINTS
app.get('/api/stock', (req, res) => {
  // Default stock items
  const defaultStock = [
    { id: 1, medicationId: 'MED001', medication: 'Paracétamol 500mg', quantity: 100, threshold: 20, price: 50, category: 'Antidouleur' },
    { id: 2, medicationId: 'MED002', medication: 'Ibuprofène 400mg', quantity: 80, threshold: 20, price: 60, category: 'Anti-inflammatoire' },
    { id: 3, medicationId: 'MED003', medication: 'Amoxicilline 500mg', quantity: 50, threshold: 10, price: 120, category: 'Antibiotique' },
    { id: 4, medicationId: 'MED004', medication: 'Vitamine C 1000mg', quantity: 200, threshold: 30, price: 30, category: 'Vitamine' },
    { id: 5, medicationId: 'MED005', medication: 'Bandage stérile', quantity: 150, threshold: 25, price: 20, category: 'Matériel médical' },
    { id: 6, medicationId: 'MED006', medication: 'Seringue 5ml', quantity: 300, threshold: 50, price: 15, category: 'Matériel médical' }
  ];
  
  if (memoryDB.stock.length === 0) {
    memoryDB.stock = defaultStock;
  }
  
  res.json(memoryDB.stock);
});

app.put('/api/stock/:id', (req, res) => {
  const { quantity } = req.body;
  const stockItem = memoryDB.stock.find(s => s.id == req.params.id);
  
  if (stockItem) {
    stockItem.quantity = quantity;
    stockItem.lastRestocked = new Date().toISOString();
    
    res.json({
      success: true,
      stock: stockItem
    });
  } else {
    res.status(404).json({ message: 'Stock item not found' });
  }
});

// 8. APPOINTMENT ENDPOINTS
app.get('/api/appointments', (req, res) => {
  res.json(memoryDB.appointments);
});

app.post('/api/appointments', (req, res) => {
  const { patientId, patientName, doctor, date, time, reason } = req.body;
  
  const newAppointment = {
    id: idCounter.appointment++,
    patientId,
    patientName,
    doctor,
    date: new Date(date).toISOString(),
    time,
    reason,
    status: 'scheduled',
    createdBy: req.body.username || 'system',
    createdAt: new Date().toISOString()
  };
  
  memoryDB.appointments.push(newAppointment);
  
  res.json({
    success: true,
    appointment: newAppointment
  });
});

app.put('/api/appointments/:id', (req, res) => {
  const { status } = req.body;
  const appointment = memoryDB.appointments.find(a => a.id == req.params.id);
  
  if (appointment) {
    appointment.status = status;
    if (status === 'completed') {
      appointment.completedAt = new Date().toISOString();
    }
    
    res.json({
      success: true,
      appointment
    });
  } else {
    res.status(404).json({ message: 'Appointment not found' });
  }
});

// 9. EMPLOYEE ENDPOINTS
app.get('/api/employees', (req, res) => {
  // Default employees
  const defaultEmployees = [
    { id: 1, employeeId: 'EMP001', name: 'Administrateur Principal', role: 'admin', pin: '1234', email: 'admin@hospital.com', phone: '1234567890', isActive: true },
    { id: 2, employeeId: 'EMP002', name: 'Dr. Jean Pierre', role: 'doctor', pin: '1234', email: 'doctor1@hospital.com', phone: '1234567891', isActive: true },
    { id: 3, employeeId: 'EMP003', name: 'Dr. Marie Claire', role: 'doctor', pin: '1234', email: 'doctor2@hospital.com', phone: '1234567892', isActive: true },
    { id: 4, employeeId: 'EMP004', name: 'Technicien Laboratoire', role: 'lab', pin: '1234', email: 'lab@hospital.com', phone: '1234567893', isActive: true },
    { id: 5, employeeId: 'EMP005', name: 'Pharmacien Principal', role: 'pharmacy', pin: '1234', email: 'pharmacy@hospital.com', phone: '1234567894', isActive: true },
    { id: 6, employeeId: 'EMP006', name: 'Réceptionniste', role: 'reception', pin: '1234', email: 'reception@hospital.com', phone: '1234567895', isActive: true },
    { id: 7, employeeId: 'EMP007', name: 'Caissier', role: 'cashier', pin: '1234', email: 'cashier@hospital.com', phone: '1234567896', isActive: true }
  ];
  
  if (memoryDB.employees.length === 0) {
    memoryDB.employees = defaultEmployees;
  }
  
  res.json(memoryDB.employees);
});

// 10. ATTENDANCE ENDPOINTS
app.get('/api/attendance', (req, res) => {
  res.json(memoryDB.attendance);
});

app.post('/api/attendance', (req, res) => {
  const { employeeId } = req.body;
  
  const newAttendance = {
    id: memoryDB.attendance.length + 1,
    employeeId,
    checkIn: new Date().toISOString(),
    status: 'present'
  };
  
  memoryDB.attendance.push(newAttendance);
  
  res.json({
    success: true,
    attendance: newAttendance
  });
});

// 11. EMERGENCY ENDPOINTS
app.get('/api/emergency', (req, res) => {
  res.json(memoryDB.emergencies);
});

app.post('/api/emergency', (req, res) => {
  const { patientId, doctor, status, notes } = req.body;
  
  const newEmergency = {
    id: idCounter.emergency++,
    patientId,
    doctor: doctor || req.body.username,
    status: status || 'En traitement',
    admissionTime: new Date().toISOString(),
    active: true,
    notes,
    createdBy: req.body.username || 'system'
  };
  
  memoryDB.emergencies.push(newEmergency);
  
  res.json({
    success: true,
    emergency: newEmergency
  });
});

// 12. STATISTICS ENDPOINTS
app.get('/api/stats/dashboard', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  const stats = {
    totalPatients: memoryDB.patients.length,
    todayConsultations: memoryDB.consultations.filter(c => 
      c.date.startsWith(today)
    ).length,
    todayAppointments: memoryDB.appointments.filter(a => 
      a.date.startsWith(today) && a.status === 'scheduled'
    ).length,
    pendingAnalyses: memoryDB.analyses.filter(a => 
      ['pending', 'pending-payment'].includes(a.status)
    ).length,
    todayRevenue: memoryDB.transactions.filter(t => 
      t.date.startsWith(today) && t.status === 'paid'
    ).reduce((sum, t) => sum + t.amount, 0)
  };
  
  res.json(stats);
});

app.get('/api/stats/admin', (req, res) => {
  const stats = {
    totalRevenue: memoryDB.transactions.filter(t => t.status === 'paid')
      .reduce((sum, t) => sum + t.amount, 0),
    totalPatients: memoryDB.patients.length,
    totalAppointments: memoryDB.appointments.length,
    totalAnalyses: memoryDB.analyses.length,
    recentPatients: memoryDB.patients.slice(-5).reverse(),
    recentTransactions: memoryDB.transactions.slice(-10).reverse()
  };
  
  res.json(stats);
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Backend is working!',
    database: 'Using in-memory database',
    endpoints: [
      '/api/auth/login',
      '/api/patients',
      '/api/consultations',
      '/api/analyses',
      '/api/prescriptions',
      '/api/transactions',
      '/api/stock',
      '/api/appointments',
      '/api/employees',
      '/api/attendance',
      '/api/emergency',
      '/api/stats/dashboard',
      '/api/stats/admin'
    ]
  });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Access the API at: https://novacare-qahi.onrender.com`);
  console.log(`📊 Health check: https://novacare-qahi.onrender.com/`);
  console.log(`🔍 Test endpoint: https://novacare-qahi.onrender.com/api/test`);
  console.log(`📡 Using in-memory database (no MongoDB required)`);
});