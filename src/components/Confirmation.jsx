import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Confirmation.css";
import { useUser } from "../UserContext";

const Confirmation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, setUser } = useUser();
  const booking = location.state;
  if (!booking) return <div>No booking found.</div>;

  const handleLogout = () => {
    localStorage.removeItem('user');
    if (setUser) setUser(null);
    navigate('/');
  };

  return (
    <div className="div-body">
      <div className="confirmation-profile-bar">
        <div className="confirmation-profile-details">
          <span className="confirmation-profile-label">User:</span>
          {user?.username || user?.name || user?.email || 'Guest'}
          {user?.email && <span className="confirmation-profile-email">({user.email})</span>}
          <button className="confirmation-logout-btn" onClick={handleLogout}>Log out</button>
        </div>
      </div>
      <div className="confirmation-page">
        <h2 className="confirmation-title">Booking Confirmed!</h2>
        <div className="confirmation-details">
          <div><b>User:</b> {booking.user}</div>
          <div><b>Email:</b> {booking.email}</div>
          <div><b>Theater:</b> {booking.theaterName}</div>
          <div><b>Slot(s):</b> {booking.showtime}</div>
          <div><b>Seats:</b> {booking.seatsBooked && booking.seatsBooked.join(', ')}</div>
          <div><b>Net Payment:</b> ₹{booking.totalAmount}</div>
        </div>
        <button className="confirmation-btn" onClick={() => navigate("/movie")}>Return to Movies</button>
      </div>
    </div>
  );
};

export default Confirmation; 