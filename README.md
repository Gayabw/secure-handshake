
#  Secure Handshake - BlockShield

### Strengthening Blockchain Node Authentication

## 📌 Overview

**Secure Handshake** is a final-year cybersecurity project designed to enhance the security of blockchain node communication during the **handshake phase**.
The system introduces an additional security layer that prevents unauthorized access, detects malicious behavior, and ensures trust between nodes before communication begins.


##  Problem Statement
Traditional blockchain networks allow nodes to establish connections during the handshake phase without strong identity verification.

This exposes systems to threats such as:

* Node impersonation
* Replay attacks
* Unauthorized network access
* Malicious node injection


## Objectives
* Strengthen node authentication during handshake
* Prevent replay and impersonation attacks
* Implement secure login with OTP verification
* Enforce Role-Based Access Control (RBAC)
* Provide real-time monitoring and anomaly detection
* Visualize system activity through dashboards



##  Key Features
### Authentication & Access Control

* Secure login system
* OTP-based verification
* Role-Based Access Control (RBAC)

### Secure Handshake Mechanism

* Node identity validation
* Protection against replay attacks
* Pre-connection verification layer

### Monitoring & Detection

* Real-time event logging
* Anomaly detection system
* Alert and monitoring dashboards

### Interactive Frontend

* Role-based dashboards
* Clean UI with theme support
* Login → OTP → Dashboard workflow

### Demo Module

* Wallet signing demonstration
* Simulated blockchain interaction



## Tech Stack
### Frontend

* React
* Vite
* TypeScript
* CSS

### Backend

* Node.js
* Express

### Other Tools

* Git & GitHub
* REST APIs
* Blockchain test environment (simulated/demo)



## Project Structure
secure-handshake/
│
├── backend/        # Backend APIs and security logic
├── frontend/       # React frontend application
├── demo/           # Wallet signing demo
├── README.md


## Getting Started
### Prerequisites

* Node.js (v18 or higher)
* npm (v9 or higher)
* Git


### Run Backend

cd backend
npm install
npm start

### Run Frontend

bash
cd frontend
npm install
npm run dev


### Access Application
Frontend: http://localhost:5173
Backend:  http://localhost:5000 (or configured port)


## System Flow


Home → Role Selection → Login → OTP Verification → Dashboard → Monitoring


## Security Contributions

This project enhances blockchain security by:

* Adding a secure **pre-handshake validation layer**
* Preventing replay attacks using verification logic
* Introducing OTP-based identity confirmation
* Enforcing strict access control through RBAC
* Providing visibility through monitoring dashboards



## Team

* Member 1 - Amaya Weerawardhana
* Member 2 - Devdini Weerasinghe
* Member 3 - Thulshi Rasunika
* Member 4 - Gayathmee Kiveka
* Member 5 - Minsadhi Edirisinghe



##  Academic Note

This project was developed as part of the **Bachelor of Information Technology (Cybersecurity specialization)** and is intended for academic and educational purposes.


**License**
This repository is provided for **academic use only**.


## Final Note

Secure Handshake demonstrates how traditional blockchain communication can be strengthened by introducing modern security mechanisms at the earliest stage of connection — the handshake.

---

