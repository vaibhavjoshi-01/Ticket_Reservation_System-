# 🎟️ Ticket Reservation System

A full-stack **Movie Ticket Booking System** (like BookMyShow) built using **React.js, Node.js, Express, MongoDB, and Socket.IO**.
This project enables users to browse movies, select seats in real-time, and book tickets with concurrency-safe seat locking.

---

## 🚀 Features

### 👤 Authentication

* User Signup & Login (JWT-based authentication)
* Secure password hashing using bcrypt
* Persistent login using localStorage

### 🎬 Movie Management

* View all available movies
* Movie details (genre, duration, release date, etc.)
* Admin can add/update/delete movies (backend ready)

### 🏙️ City Selection

* Users can select cities (Mumbai, Delhi, Pune, etc.)
* Movies filtered based on selected city

### 🎭 Theater & Seat Booking

* Interactive seat selection UI
* Real-time seat availability updates
* Seat states:

  * 🟢 Available
  * 🔵 Selected
  * 🟠 Held
  * 🔴 Booked

### ⚡ Real-Time Features

* Live seat updates using **Socket.IO**
* Prevents double booking
* Automatic seat release after timeout

### 💳 Booking System

* Booking confirmation page
* Booking history tracking
* Cancel bookings with refund logic (basic)

### 📊 Advanced Features

* Seat locking mechanism (in-memory + DB)
* API request caching
* Duplicate request prevention
* Optimized frontend performance

---

## 🛠️ Tech Stack

### Frontend

* React.js (Vite)
* React Router DOM
* Axios
* Context API
* CSS (Custom styling)

### Backend

* Node.js
* Express.js
* MongoDB (Mongoose)
* Socket.IO
* JWT Authentication
* bcrypt.js

---

## 📁 Project Structure

```
Ticket_Reservation_System/
│
├── backend/
│   ├── config/          # Database config
│   ├── middleware/      # Auth middleware
│   ├── models/          # Mongoose schemas
│   ├── routes/          # API routes
│   └── server.js        # Backend entry point
│
├── src/
│   ├── assets/          # Images & static files
│   ├── components/      # UI components (Theater, Confirmation)
│   ├── services/        # API calls (Axios setup)
│   ├── App.jsx          # Main app routing
│   ├── main.jsx         # React entry point
│   ├── Index.jsx        # Login page
│   ├── Signup.jsx       # Signup page
│   ├── Book.jsx         # City selection
│   ├── Movie.jsx        # Movie listing
│   └── UserContext.jsx  # Global user state
│
├── index.html
├── package.json
└── README.md
```

---

## ⚙️ Installation & Setup

### 1️⃣ Clone Repository

```bash
git clone https://github.com/your-username/Ticket_Reservation_System.git
cd Ticket_Reservation_System
```

---

### 2️⃣ Install Dependencies

#### Frontend

```bash
npm install
```

#### Backend

```bash
cd backend
npm install
```

---

### 3️⃣ Setup Environment Variables

Create `.env` file inside `backend/`:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/bookmyshow
JWT_SECRET=your_secret_key
```

---

### 4️⃣ Run Project

#### Start Backend

```bash
cd backend
npm run dev
```

#### Start Frontend

```bash
npm run dev
```

#### OR Run Both Together

```bash
npm run dev:all
```

---

## 🌐 API Endpoints (Sample)

### Auth

* `POST /api/users/register`
* `POST /api/users/login`

### Movies

* `GET /api/movies`
* `POST /api/movies`

### Bookings

* `POST /api/bookings`
* `GET /api/bookings/user/:username`
* `DELETE /api/bookings/:id`

### Seats

* `POST /api/seats/hold`
* `POST /api/seats/release`
* `POST /api/seats/book`

---

## 🔄 Real-Time Flow

1. User selects seat
2. Seat is **held temporarily**
3. Socket emits update to all users
4. On payment → seat becomes **booked**
5. If timeout → seat is released

---

## ⚠️ Known Issues / Improvements

* Payment gateway is simulated (no real integration)
* JWT secret fallback needs improvement
* Duplicate auth logic can be optimized
* MongoDB transactions not fully implemented
* Socket URL is hardcoded (should use env)

---

## 🚀 Future Enhancements

* 💳 Integrate Razorpay / Stripe
* 🔐 Role-based authentication (Admin panel)
* 📊 Analytics dashboard
* 📱 Mobile responsive UI improvements
* ☁️ Deployment (Render / Vercel / AWS)
* 🔄 Redis for distributed seat locking

---

## 👨‍💻 Author

**Vaibhav Joshi**
B.Tech CSE Student
Graphic Era Hill University

---

## 📜 License

This project is for educational purposes only.

---

## ⭐ If you like this project

Give it a ⭐ on GitHub!
