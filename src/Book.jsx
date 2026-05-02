import React, { useState, useEffect } from "react";
import "./Bookclass.css";
import Logo from "./photo2.jpg"
import profile from "./photo3.jpg"
import { BrowserRouter as Router, Routes, Route,useNavigate} from "react-router-dom";
import { useUser } from "./UserContext";
const cities = [
  { name: "Mumbai", img: "https://in.bmscdn.com/m6/images/common-modules/regions/mumbai.png" },
  { name: "Delhi", img: "https://in.bmscdn.com/m6/images/common-modules/regions/ncr.png" },
  { name: "Pune", img: "https://in.bmscdn.com/m6/images/common-modules/regions/pune.png" },
];

const cities2 = [
  { name: "Bengaluru", img: "https://in.bmscdn.com/m6/images/common-modules/regions/bang.png" },
  { name: "Kolkata", img: "https://in.bmscdn.com/m6/images/common-modules/regions/kolk.png" },
  { name: "Chennai", img: "https://in.bmscdn.com/m6/images/common-modules/regions/chen.png" }
];

const Booking = () => {
  const navigate = useNavigate();
  const { user, setUser } = useUser();
  const [selectedCity, setSelectedCity] = useState(localStorage.getItem('selectedCity') || 'All Cities');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key === 'selectedCity') {
        setSelectedCity(event.newValue || 'All Cities');
      }
    };
    const handleCityChange = () => {
      setSelectedCity(localStorage.getItem('selectedCity') || 'All Cities');
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('cityChanged', handleCityChange); 
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('cityChanged', handleCityChange);
    };
  }, []);

  const handleCityClick = (cityName) => {
    localStorage.setItem('selectedCity', cityName);
    window.dispatchEvent(new Event('cityChanged'));
    navigate('/Movie');
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    if (setUser) setUser(null);
    navigate('/');
  };

  return (
    <div className="body">
      <header>
        <div className="nav">
          <div className="Logo">
            <img src={Logo} alt="Logo" />
          </div>
          <div className="Profile">
            <div>
              Welcome {user && (user.username || user.name || user.email) ? user.username || user.name || user.email : "Guest"},
            </div>
            <div className="Image">
              <img src={profile} alt="Profile" />
            </div>
            <button onClick={handleLogout} style={{ marginLeft: '10px', padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#EB4E62', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>Log out</button>
          </div>
        </div>
      </header>
      <main>
        <div className="Booking_box">
          <div className="start"><b>Select your City</b></div>
          {loading ? (
            <div className="loading">Loading cities...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : (
            <>
              <div className="Row">
                {cities.map((city, index) => (
                  <div className="Div-BOX" key={index}>
                    <div className="box1">
                      <a onClick={() => handleCityClick(city.name)}>
                        <img
                          src={city.img}
                          alt={city.name}
                          className="city-image"
                          loading="lazy"
                          onError={e => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/100x100?text=No+Image"; }}
                        />
                      </a>
                      {city.name}
                    </div>
                  </div>
                ))}
              </div>
              <div className="Row">
                {cities2.map((city, index) => (
                  <div className="Div-BOX" key={index}>
                    <div className="box1">
                      <a onClick={() => handleCityClick(city.name)}>
                        <img
                          src={city.img}
                          alt={city.name}
                          className="city-image"
                          loading="lazy"
                          onError={e => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/100x100?text=No+Image"; }}
                        />
                      </a>
                      {city.name}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Booking;